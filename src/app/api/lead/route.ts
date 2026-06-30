import { NextRequest, NextResponse } from "next/server";
import { addLead } from "@/lib/leadStore";
import { notify } from "@/lib/notify";

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

  console.log(`[lead] ${email} · ${body.url} · ${body.score}/${body.maxScore} · ${(body.packages ?? []).join(", ")}`);

  // 운영자 실시간 알림 (Telegram/Slack — 설정 시)
  void notify(`💼 적용 대행 리드\n이메일: ${email}\n대상: ${body.url}\n점수: ${body.score}/${body.maxScore}\n패키지: ${(body.packages ?? []).join(", ")}`);

  return NextResponse.json({ ok: true });
}
