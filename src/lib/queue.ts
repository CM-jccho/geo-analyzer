import { runAnalysis } from "./pipeline";

// 잡 큐 추상화.
// - REDIS_URL이 설정되면 BullMQ(Redis) 큐 + 인프로세스 워커로 처리 (동시성 제어·재시도).
// - 없거나 연결 실패 시 인메모리(즉시 비동기 실행)로 graceful fallback.
//
// 참고: 잡 상태/결과 저장(jobStore)은 현재 인메모리이므로 워커를 같은 프로세스에서 띄운다.
// 멀티프로세스 워커로 확장하려면 jobStore도 Redis 백엔드로 교체해야 한다.

let queue: any = null;
let initialized = false;
let usingRedis = false;

async function initRedis(): Promise<boolean> {
  if (initialized) return usingRedis;
  initialized = true;
  if (!process.env.REDIS_URL) return false;
  try {
    const { Queue, Worker } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    // BullMQ가 번들한 ioredis와 최상위 ioredis 타입이 충돌하므로 connection은 any로 전달(런타임 동작은 동일).
    const connection: any = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

    queue = new Queue("geo-analyze", { connection });
    new Worker(
      "geo-analyze",
      async (job: any) => {
        await runAnalysis(job.data.jobId, job.data.url);
      },
      { connection, concurrency: Number(process.env.GEO_CONCURRENCY ?? 3) },
    );
    usingRedis = true;
    console.log("[queue] BullMQ/Redis 워커 활성화");
    return true;
  } catch (e: any) {
    console.error("[queue] Redis 초기화 실패 → 인메모리 폴백:", e?.message ?? e);
    usingRedis = false;
    return false;
  }
}

export async function enqueue(jobId: string, url: string): Promise<"redis" | "memory"> {
  if (process.env.REDIS_URL) {
    const ok = await initRedis();
    if (ok && queue) {
      try {
        await queue.add("analyze", { jobId, url }, { removeOnComplete: 100, removeOnFail: 100, attempts: 1 });
        return "redis";
      } catch (e: any) {
        console.error("[queue] enqueue 실패 → 인메모리 폴백:", e?.message ?? e);
      }
    }
  }
  // 인메모리: 즉시 비동기 실행 (응답은 막지 않음)
  void runAnalysis(jobId, url);
  return "memory";
}
