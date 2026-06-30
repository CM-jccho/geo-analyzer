import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

// 문의 수신 메일이 도착할 주소 (고정)
const TO = "jaechul.cho@gmail.com";
const LIMIT = Number(process.env.CONTACT_RATE_LIMIT ?? 3);
const WINDOW = Number(process.env.CONTACT_RATE_WINDOW ?? 600);

// POST /api/contact — 문의 접수 → TO로 메일 발송
// SMTP 환경변수(SMTP_HOST/PORT/USER/PASS)가 설정되면 실제 발송, 없으면 로그만 남기고 접수 처리.
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`contact:${clientIp(req)}`, LIMIT, WINDOW);
  if (!rl.allowed) {
    return NextResponse.json({ error: "문의가 너무 잦습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (!message) return NextResponse.json({ error: "문의 내용을 입력해 주세요." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "유효한 이메일을 입력해 주세요." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "전화번호를 입력해 주세요." }, { status: 400 });

  const subject = `[GEO Analyzer 문의] ${email}`;
  const text = `새 문의가 접수되었습니다.\n\n■ 이메일: ${email}\n■ 전화번호: ${phone}\n\n■ 문의 내용:\n${message}\n\n— 접수 시각: ${new Date().toLocaleString("ko-KR")}`;

  // 운영자 실시간 알림 (Telegram/Slack — 설정 시)
  void notify(`📨 새 문의\n이메일: ${email}\n전화: ${phone}\n내용: ${message.slice(0, 200)}`);

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const port = Number(SMTP_PORT ?? 465);
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });
      await transporter.sendMail({
        from: `"GEO Analyzer" <${SMTP_USER}>`,
        to: TO,
        replyTo: email, // 회신 시 문의자에게 바로
        subject,
        text,
      });
      return NextResponse.json({ ok: true, delivered: true });
    } catch (e: any) {
      console.error("[contact] 메일 발송 실패:", e?.message ?? e);
      // 발송 실패해도 접수 자체는 기록 (운영자가 로그로 확인 가능)
      console.log(`[contact:FAILED-SEND] ${subject}\n${text}`);
      return NextResponse.json({ error: "메일 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." }, { status: 502 });
    }
  }

  // SMTP 미설정: 로그만 남기고 접수 처리 (개발/배포 전 단계)
  console.log(`[contact] (SMTP 미설정 — 로그만) → ${TO}\n${subject}\n${text}`);
  return NextResponse.json({ ok: true, delivered: false });
}
