import { NextResponse } from "next/server";
import { kvAvailable } from "@/lib/kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 헬스/버전 체크 — 배포 반영 확인용
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "geo-analyzer",
    version: "1.1.0",
    features: {
      rateLimit: true,
      kvPersistence: kvAvailable(),
      smtp: !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    },
    serverless: !!process.env.VERCEL,
  });
}
