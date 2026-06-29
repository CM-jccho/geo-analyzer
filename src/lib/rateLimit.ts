import { kvAvailable, kvIncr, kvExpire } from "./kv";

// 고정 윈도우 레이트리밋. KV 있으면 분산(인스턴스 간 공유), 없으면 인메모리(인스턴스별).
// 서버리스에서 인메모리는 인스턴스마다 따로지만, 최소한의 남용 방지 역할은 한다.

const mem: Map<string, { count: number; reset: number }> =
  (globalThis as any).__geoRL ?? new Map();
(globalThis as any).__geoRL = mem;

export interface RateResult {
  allowed: boolean;
  remaining: number;
}

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  if (kvAvailable()) {
    try {
      const k = `geo:rl:${key}`;
      const count = await kvIncr(k);
      if (count === 1) await kvExpire(k, windowSec);
      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    } catch {
      // KV 오류 시 인메모리로 폴백
    }
  }
  const now = Date.now();
  const e = mem.get(key);
  if (!e || now > e.reset) {
    mem.set(key, { count: 1, reset: now + windowSec * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }
  e.count += 1;
  return { allowed: e.count <= limit, remaining: Math.max(0, limit - e.count) };
}

// 요청에서 클라이언트 IP 추출 (Vercel은 x-forwarded-for 제공)
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}
