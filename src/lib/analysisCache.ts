import { kvAvailable, kvGet, kvSet } from "./kv";
import type { AnalysisResult } from "./types";

// GEO 분석 결과 캐시 — 같은 URL 재분석 시 LLM 재호출 없이 반환(비용 통제).
// KV 있으면 분산 캐시, 없으면 인메모리.

const TTL_SEC = Number(process.env.GEO_CACHE_TTL ?? 3600); // 기본 1시간
const mem: Map<string, { result: AnalysisResult; exp: number }> = (globalThis as any).__geoCache ?? new Map();
(globalThis as any).__geoCache = mem;

const key = (url: string) => `geo:cache:${url.toLowerCase()}`;

export async function getCachedAnalysis(url: string): Promise<AnalysisResult | null> {
  const local = mem.get(key(url));
  if (local && local.exp > Date.now()) return local.result;
  if (kvAvailable()) {
    try {
      const v = await kvGet(key(url));
      if (v) return JSON.parse(v) as AnalysisResult;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function setCachedAnalysis(url: string, result: AnalysisResult): Promise<void> {
  mem.set(key(url), { result, exp: Date.now() + TTL_SEC * 1000 });
  if (kvAvailable()) {
    try {
      await kvSet(key(url), JSON.stringify(result), TTL_SEC);
    } catch {
      /* ignore */
    }
  }
}
