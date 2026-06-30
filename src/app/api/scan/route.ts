import { NextRequest, NextResponse } from "next/server";
import { runScan } from "@/lib/scan/scanner";
import type { ScanType } from "@/lib/scan/types";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 1일 스캔 횟수 제한 — 무거운 스캔의 자원 고갈 방지 (MVP 단계부터 적용)
const DAILY_LIMIT = Number(process.env.SCAN_DAILY_LIMIT ?? 3);
const DAY = 60 * 60 * 24;

// POST /api/scan  { type: "url" | "repo", target: string }
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`scan:${clientIp(req)}`, DAILY_LIMIT, DAY);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `1일 스캔 횟수(${DAILY_LIMIT}회)를 초과했습니다. 내일 다시 시도하거나 플랜을 업그레이드하세요.` },
      { status: 429 },
    );
  }

  let body: { type?: ScanType; target?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const type = body.type;
  const target = body.target?.trim();
  if (type !== "url" && type !== "repo") {
    return NextResponse.json({ error: "type은 'url' 또는 'repo'여야 합니다." }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json({ error: "스캔 대상을 입력해 주세요." }, { status: 400 });
  }

  // 입력 검증
  if (type === "url") {
    const candidate = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    try {
      new URL(candidate);
    } catch {
      return NextResponse.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
    }
    const result = await runScan("url", candidate);
    return NextResponse.json({ result, remaining: rl.remaining }, { status: 200 });
  }

  // repo
  if (!/github\.com\/[^/]+\/[^/]+/i.test(target)) {
    return NextResponse.json({ error: "유효한 GitHub 저장소 URL을 입력해 주세요. (예: https://github.com/org/repo)" }, { status: 400 });
  }
  const result = await runScan("repo", target);
  return NextResponse.json({ result, remaining: rl.remaining }, { status: 200 });
}
