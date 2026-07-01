import { NextRequest, NextResponse } from "next/server";
import { loadScan } from "@/lib/scan/scanStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/scan/:id/status — 비동기 스캔 폴링용. 결과 있으면 done, 없으면 pending.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await loadScan(params.id);
  if (result) {
    return NextResponse.json({ scanId: params.id, status: "done", result });
  }
  return NextResponse.json({ scanId: params.id, status: "pending", result: null });
}
