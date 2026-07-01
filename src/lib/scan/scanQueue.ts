import { runScan } from "./scanner";
import { saveScan } from "./scanStore";
import type { ScanType } from "./types";

// 스캔 잡 큐 추상화.
// - SCAN_QUEUE=1 + REDIS_URL 이면 BullMQ 큐에 등록(별도 워커가 Trivy/ZAP 실행)
// - 아니면 인라인 실행(현재 동기 동작 유지). 결과는 scanStore에 저장.
//
// 무거운 실제 스캔(real)은 워커에서 처리하는 것을 권장한다(worker/scanWorker.ts).

let queue: any = null;
let initialized = false;
let usingRedis = false;

async function initRedis(): Promise<boolean> {
  if (initialized) return usingRedis;
  initialized = true;
  if (!(process.env.SCAN_QUEUE === "1" && process.env.REDIS_URL)) return false;
  try {
    const { Queue } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection: any = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    queue = new Queue("geo-scan", { connection });
    usingRedis = true;
    console.log("[scanQueue] BullMQ 큐 활성화");
    return true;
  } catch (e: any) {
    console.error("[scanQueue] Redis 초기화 실패 → 인라인 실행:", e?.message ?? e);
    return false;
  }
}

// 스캔을 큐에 등록(async) 또는 즉시 실행(sync). 반환: 큐 등록 여부
export async function enqueueScan(scanId: string, type: ScanType, target: string): Promise<"queued" | "inline"> {
  if (await initRedis()) {
    try {
      await queue.add("scan", { scanId, type, target }, { removeOnComplete: 100, removeOnFail: 100, attempts: 1 });
      return "queued";
    } catch (e: any) {
      console.error("[scanQueue] enqueue 실패 → 인라인:", e?.message ?? e);
    }
  }
  const result = await runScan(type, target);
  await saveScan(scanId, result);
  return "inline";
}
