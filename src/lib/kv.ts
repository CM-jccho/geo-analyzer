// 최소 KV 클라이언트 (Vercel KV / Upstash Redis REST).
// 의존성 없이 fetch로 REST 명령을 실행한다. 환경변수 없으면 비활성(호출 측에서 폴백).
//
// env: KV_REST_API_URL/TOKEN (Vercel KV) 또는 UPSTASH_REDIS_REST_URL/TOKEN (Upstash Marketplace)
// — 연동 방식에 따라 주입되는 이름이 다르므로 둘 다 지원한다.

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvAvailable(): boolean {
  return !!(URL_ && TOKEN);
}

async function cmd(args: (string | number)[]): Promise<any> {
  const res = await fetch(URL_!, {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV ${res.status}`);
  const data = await res.json();
  return data.result;
}

export function kvSet(key: string, value: string, ttlSec?: number): Promise<any> {
  return ttlSec ? cmd(["SET", key, value, "EX", ttlSec]) : cmd(["SET", key, value]);
}
export function kvGet(key: string): Promise<string | null> {
  return cmd(["GET", key]);
}
export function kvIncr(key: string): Promise<number> {
  return cmd(["INCR", key]);
}
export function kvExpire(key: string, sec: number): Promise<any> {
  return cmd(["EXPIRE", key, sec]);
}
