import { NextRequest, NextResponse } from "next/server";
import { getUser, createUser } from "@/lib/auth/userStore";
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await rateLimit(`signup:${clientIp(req)}`, 10, 3600);
  if (!rl.allowed) return NextResponse.json({ error: "시도가 많습니다. 잠시 후 다시." }, { status: 429 });

  const { email, password } = await req.json().catch(() => ({}));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "")) return NextResponse.json({ error: "유효한 이메일을 입력하세요." }, { status: 400 });
  if (!password || password.length < 8) return NextResponse.json({ error: "비밀번호는 8자 이상이어야 합니다." }, { status: 400 });

  if (await getUser(email)) return NextResponse.json({ error: "이미 가입된 이메일입니다." }, { status: 409 });

  const user = await createUser(email, password);
  const token = signSession({ email: user.email, plan: user.plan });
  const res = NextResponse.json({ email: user.email, plan: user.plan });
  res.cookies.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: SESSION_MAX_AGE });
  return res;
}
