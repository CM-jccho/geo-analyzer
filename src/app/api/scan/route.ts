import { NextRequest, NextResponse } from "next/server";
import type { ScanType } from "@/lib/scan/types";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { resolvePlan } from "@/lib/scan/plans";
import { newScanId, loadScan } from "@/lib/scan/scanStore";
import { enqueueScan } from "@/lib/scan/scanQueue";

export const runtime = "nodejs";
export const maxDuration = 60;

const DAY = 60 * 60 * 24;

// POST /api/scan  { type: "url" | "repo", target }
// 플랜별 1일 스캔 한도 적용. 결과를 저장하고 공유용 scanId를 반환.
export async function POST(req: NextRequest) {
  const plan = resolvePlan(req);
  const rl = await rateLimit(`scan:${plan.id}:${clientIp(req)}`, plan.dailyLimit, DAY);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `1일 스캔 횟수(${plan.label} 플랜 ${plan.dailyLimit}회)를 초과했습니다. 내일 다시 시도하거나 상위 플랜으로 업그레이드하세요.`,
        plan: plan.id,
      },
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

  let normalized = target;
  if (type === "url") {
    normalized = /^https?:\/\//i.test(target) ? target : `https://${target}`;
    try {
      new URL(normalized);
    } catch {
      return NextResponse.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
    }
  } else if (!/github\.com\/[^/]+\/[^/]+/i.test(target)) {
    return NextResponse.json({ error: "유효한 GitHub 저장소 URL을 입력해 주세요. (예: https://github.com/org/repo)" }, { status: 400 });
  }

  const scanId = newScanId();
  const mode = await enqueueScan(scanId, type, normalized);

  if (mode === "queued") {
    // 비동기: 워커가 처리. 클라이언트는 /api/scan/:id/status 폴링
    return NextResponse.json({ scanId, status: "queued", plan: plan.id, planLabel: plan.label, remaining: rl.remaining }, { status: 202 });
  }

  // 인라인: 결과가 저장됨
  const result = await loadScan(scanId);
  return NextResponse.json({ scanId, result, plan: plan.id, planLabel: plan.label, remaining: rl.remaining }, { status: 200 });
}
