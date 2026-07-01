import { NextRequest, NextResponse } from "next/server";
import { getUser, verifyPassword } from "@/lib/auth/userStore";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(`login:${clientIp(req)}`, 10, 600);
  if (!rl.allowed) return NextResponse.json({ error: "로그인 시도가 많습니다. 잠시 후 다시." }, { status: 429 });

  const { email, password } = await req.json().catch(() => ({}));
  const user = email ? await getUser(email) : null;
  if (!user || !verifyPassword(user, password || "")) {
    return NextResponse.json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  }

  const token = signSession({ email: user.email, plan: user.plan });
  const res = NextResponse.json({ email: user.email, plan: user.plan });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return res;
}
