import { NextRequest, NextResponse } from "next/server";
import { addLead } from "@/lib/leadStore";

export const runtime = "nodejs";

// POST /api/lead — 적용 대행 상담 신청 접수
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "유효한 이메일을 입력해 주세요." }, { status: 400 });
  }

  addLead({
    email,
    url: String(body.url ?? ""),
    score: Number(body.score ?? 0),
    maxScore: Number(body.maxScore ?? 0),
    packages: Array.isArray(body.packages) ? body.packages.map(String) : [],
    note: body.note ? String(body.note) : undefined,
    createdAt: new Date().toISOString(),
  });

  // TODO(프로덕션): 운영자 알림(Telegram/Slack/이메일) + CRM 연동
  console.log(`[lead] ${email} · ${body.url} · ${body.score}/${body.maxScore} · ${(body.packages ?? []).join(", ")}`);

  return NextResponse.json({ ok: true });
}
