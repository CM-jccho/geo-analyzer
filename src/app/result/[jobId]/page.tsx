import Link from "next/link";
import { getJob } from "@/lib/jobStore";
import { loadResult } from "@/lib/resultStore";
import { STATUS_LABEL } from "@/lib/types";
import ResultView from "../../_components/ResultView";

export const dynamic = "force-dynamic";

// 공유용 결과 페이지.
// 1) 인메모리 jobStore(같은 인스턴스) → 2) KV(영속) 순으로 결과를 찾는다.
export default async function ResultPage({ params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);
  const persisted = job?.result ?? (await loadResult(params.jobId));

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 새 분석
        </Link>
        <span className="text-xs text-slate-400">GEO Analyzer</span>
      </header>

      {persisted ? (
        <ResultView result={persisted} />
      ) : job && job.status === "error" ? (
        <p className="text-sm text-red-600">⚠ {job.error}</p>
      ) : job && job.status !== "done" ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          분석 진행 중… ({STATUS_LABEL[job.status]} · {job.progress}%) — 잠시 후 새로고침
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          <p className="font-medium">결과를 찾을 수 없습니다.</p>
          <p className="mt-1 text-sm">만료되었거나 링크가 잘못되었을 수 있습니다. 새로 분석해 주세요.</p>
        </div>
      )}
    </main>
  );
}
