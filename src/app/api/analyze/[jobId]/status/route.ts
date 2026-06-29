import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobStore";
import { STATUS_LABEL } from "@/lib/types";

export const runtime = "nodejs";

// GET /api/analyze/:jobId/status  →  { status, statusLabel, progress, result? , error? }
export async function GET(_req: NextRequest, { params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);
  if (!job) {
    return NextResponse.json({ error: "존재하지 않는 jobId입니다." }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    url: job.url,
    status: job.status,
    statusLabel: STATUS_LABEL[job.status],
    progress: job.progress,
    result: job.result ?? null,
    error: job.error ?? null,
  });
}
