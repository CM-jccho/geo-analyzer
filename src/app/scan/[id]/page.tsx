import { loadScan } from "@/lib/scan/scanStore";
import ScanDashboard from "../../_components/ScanDashboard";

export const dynamic = "force-dynamic";

// 공유용 스캔 리포트 페이지 (KV 또는 인메모리에서 로드)
export default async function ScanReportPage({ params }: { params: { id: string } }) {
  const result = await loadScan(params.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-bold tracking-tight">
            AutoSec <span className="text-emerald-400">Scanner</span>
          </span>
          <a href="/security" className="text-sm text-slate-400 hover:text-slate-100">새 스캔 →</a>
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-5 py-12">
        {result ? (
          <ScanDashboard result={result} />
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
            <p className="font-medium">리포트를 찾을 수 없습니다.</p>
            <p className="mt-1 text-sm">만료되었거나 링크가 잘못되었을 수 있습니다. 새로 스캔해 주세요.</p>
          </div>
        )}
      </main>
    </div>
  );
}
