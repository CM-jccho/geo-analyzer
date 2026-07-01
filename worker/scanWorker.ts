import { Worker } from "bullmq";
import IORedis from "ioredis";
import { runScan } from "../src/lib/scan/scanner";
import { saveScan } from "../src/lib/scan/scanStore";
import type { ScanType } from "../src/lib/scan/types";

// 독립 스캔 워커 — BullMQ 'geo-scan' 큐를 소비해 실제 엔진(Trivy/ZAP)으로 스캔 실행.
// 결과는 scanStore(KV)에 저장 → 웹의 /api/scan/:id/status 가 조회.
// 실행: REDIS_URL=... SCANNER_MODE=real TRIVY_BIN=... npm run worker
//
// 주의: 웹과 워커는 별도 프로세스이므로 결과 공유에 KV(KV_REST_API_*)가 필요하다.

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const connection: any = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const worker = new Worker(
  "geo-scan",
  async (job) => {
    const { scanId, type, target } = job.data as { scanId: string; type: ScanType; target: string };
    console.log(`[scanWorker] 시작: ${scanId} (${type}) ${target}`);
    const result = await runScan(type, target);
    await saveScan(scanId, result);
    console.log(`[scanWorker] 완료: ${scanId} — 취약점 ${result.summary.total}건 (엔진: ${result.engine})`);
    return { scanId, total: result.summary.total };
  },
  { connection, concurrency: Number(process.env.SCAN_CONCURRENCY ?? 2) },
);

worker.on("failed", (job, err) => console.error(`[scanWorker] 실패: ${job?.id}`, err?.message));
console.log("[scanWorker] geo-scan 큐 대기 중...");
