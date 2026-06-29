import Link from "next/link";
import { getJob } from "@/lib/jobStore";
import { STATUS_LABEL } from "@/lib/types";
import ResultView from "../../_components/ResultView";

export const dynamic = "force-dynamic";

// 공유용 결과 페이지. 인메모리 jobStore에서 결과를 읽는다.
// (서버 재시작 시 인메모리 데이터는 사라짐 — 영속 공유는 Redis/DB 백엔드 전환 후 가능)
export default function ResultPage({ params }: { params: { jobId: string } }) {
  const job = getJob(params.jobId);

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← 새 분석
        </Link>
        <span className="text-xs text-slate-400">GEO Analyzer</span>
      </header>

      {!job ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          <p className="font-medium">결과를 찾을 수 없습니다.</p>
          <p className="mt-1 text-sm">만료되었거나 서버가 재시작되었을 수 있습니다. 새로 분석해 주세요.</p>
        </div>
      ) : job.status === "done" && job.result ? (
        <ResultView result={job.result} />
      ) : job.status === "error" ? (
        <p className="text-sm text-red-600">⚠ {job.error}</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
          분석 진행 중… ({STATUS_LABEL[job.status]} · {job.progress}%) — 잠시 후 새로고침
        </div>
      )}
    </main>
  );
}
