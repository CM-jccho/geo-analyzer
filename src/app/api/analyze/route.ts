import { NextRequest, NextResponse } from "next/server";
import { createJob, updateJob } from "@/lib/jobStore";
import { enqueue } from "@/lib/queue";
import { runAnalysisCore } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60; // 서버리스 동기 분석을 위한 함수 타임아웃(초)

// POST /api/analyze  { url }
//  - Vercel(서버리스): 동기 실행 → { jobId, result } 즉시 반환 (백그라운드 실행 미보장 대응)
//  - 로컬/상시서버: 큐 투입 → { jobId } 반환, 클라이언트가 status 폴링
export async function POST(req: NextRequest) {
  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) return NextResponse.json({ error: "url 필드가 필요합니다." }, { status: 400 });

  const candidate = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  try {
    new URL(candidate);
  } catch {
    return NextResponse.json({ error: "유효하지 않은 URL입니다." }, { status: 400 });
  }

  const job = createJob(candidate);

  if (process.env.VERCEL) {
    try {
      const result = await runAnalysisCore(candidate);
      updateJob(job.id, { status: "done", progress: 100, result });
      return NextResponse.json({ jobId: job.id, result }, { status: 200 });
    } catch (e: any) {
      updateJob(job.id, { status: "error", progress: 100, error: e?.message ?? String(e) });
      return NextResponse.json({ error: e?.message ?? "분석 실패" }, { status: 500 });
    }
  }

  const via = await enqueue(job.id, candidate);
  return NextResponse.json({ jobId: job.id, queue: via }, { status: 202 });
}
