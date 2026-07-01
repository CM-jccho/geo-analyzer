import crypto from "node:crypto";

// 경량 세션 토큰 (HMAC 서명, JWT 유사). 외부 의존 없음.
// 프로덕션에서는 AUTH_SECRET을 반드시 강한 값으로 설정.

const SECRET = process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
export const SESSION_COOKIE = "geo_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

export interface Session {
  email: string;
  plan: string;
  iat: number;
}

function b64url(s: string | Buffer): string {
  return Buffer.from(s).toString("base64url");
}

export function signSession(payload: { email: string; plan: string }): string {
  const body = b64url(JSON.stringify({ ...payload, iat: Date.now() }));
  const sig = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined | null): Session | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.iat && Date.now() - p.iat > SESSION_MAX_AGE * 1000) return null; // 만료
    return p as Session;
  } catch {
    return null;
  }
}

// 요청의 쿠키 헤더에서 세션 파싱
export function getSession(req: Request): Session | null {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|; )${SESSION_COOKIE}=([^;]+)`));
  return m ? verifySession(decodeURIComponent(m[1])) : null;
}
