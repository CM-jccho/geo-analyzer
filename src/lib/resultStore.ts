import { kvAvailable, kvSet, kvGet } from "./kv";
import type { AnalysisResult } from "./types";

// 분석 결과 영속 저장 (공유 링크용). KV 있으면 저장/조회, 없으면 no-op.
// 서버리스(Vercel)에서는 인메모리 jobStore가 인스턴스 간 공유되지 않으므로,
// 공유 링크(/result/:id)가 동작하려면 KV가 필요하다.

const TTL_SEC = 60 * 60 * 24 * 30; // 30일

export async function saveResult(jobId: string, result: AnalysisResult): Promise<void> {
  if (!kvAvailable()) return;
  try {
    await kvSet(`geo:result:${jobId}`, JSON.stringify(result), TTL_SEC);
  } catch (e: any) {
    console.error("[kv] 결과 저장 실패:", e?.message ?? e);
  }
}

export async function loadResult(jobId: string): Promise<AnalysisResult | null> {
  if (!kvAvailable()) return null;
  try {
    const v = await kvGet(`geo:result:${jobId}`);
    return v ? (JSON.parse(v) as AnalysisResult) : null;
  } catch {
    return null;
  }
}
