import { NextRequest, NextResponse } from "next/server";
import { analyzeWithAI } from "@/lib/scan/aiAnalysis";
import type { ScanResult } from "@/lib/scan/types";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/scan/ai  { result: ScanResult }  →  { insight }
// 스캔 결과를 Claude로 분석 (비즈니스 영향 우선순위 + 경영진용 요약).
export async function POST(req: NextRequest) {
  const rl = await rateLimit(`scanai:${clientIp(req)}`, Number(process.env.SCAN_AI_RATE_LIMIT ?? 10), 600);
  if (!rl.allowed) {
    return NextResponse.json({ error: "AI 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429 });
  }

  let body: { result?: ScanResult };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const result = body.result;
  if (!result || !Array.isArray(result.vulnerabilities) || !result.summary) {
    return NextResponse.json({ error: "유효한 스캔 결과가 필요합니다." }, { status: 400 });
  }

  const insight = await analyzeWithAI(result);
  if (!insight) {
    return NextResponse.json({ error: "AI 분석을 사용할 수 없습니다 (ANTHROPIC_API_KEY 미설정 또는 일시 오류)." }, { status: 503 });
  }
  return NextResponse.json({ insight }, { status: 200 });
}
