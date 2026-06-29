import type { AnalysisResult } from "@/lib/types";
import RemediationCTA from "./RemediationCTA";

// 결과 렌더링 (서버/클라이언트 공용, 훅 없음). 홈 화면과 공유 페이지에서 함께 사용.

function pctColor(score: number, max: number): string {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-500" : "text-red-500";
}

function Bar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span>{max > 0 ? `${score}/${max}` : "미측정"}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const CAT_STYLE: Record<string, string> = {
  기술: "bg-sky-100 text-sky-700",
  콘텐츠: "bg-violet-100 text-violet-700",
  AI노출: "bg-amber-100 text-amber-700",
};

export default function ResultView({ result }: { result: AnalysisResult }) {
  const s = result.score;
  return (
    <div className="space-y-6">
      {/* 점수 요약 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">GEO 종합 점수</p>
            <h2 className="truncate text-xl font-semibold">{result.brand}</h2>
            <a href={result.url} className="text-sm text-blue-600 underline" target="_blank" rel="noreferrer">
              {result.url}
            </a>
          </div>
          <div className="flex shrink-0 items-baseline gap-1">
            <span className={`text-5xl font-bold ${pctColor(s.total, s.max)}`}>{s.total}</span>
            <span className="text-xl text-slate-400">/ {s.max}</span>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Bar label="기술" score={s.tech.score} max={s.tech.max} />
          <Bar label="콘텐츠" score={s.content.score} max={s.content.max} />
          <Bar label="AI 노출" score={s.llm.score} max={s.llm.max} />
        </div>
      </section>

      {/* 액션 */}
      {result.actions.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold">즉시 개선 액션 TOP {result.actions.length}</h3>
          <ol className="space-y-4">
            {result.actions.map((a) => (
              <li key={a.rank} className="rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${CAT_STYLE[a.category] ?? "bg-slate-200"}`}>{a.category}</span>
                  <p className="font-medium">
                    {a.rank}. {a.title}
                  </p>
                </div>
                <p className="mt-1 text-sm text-slate-600">{a.why}</p>
                <p className="mt-1 text-sm text-slate-800">→ {a.how}</p>
                {a.codeExample && (
                  <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-xs text-slate-100">{a.codeExample}</pre>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* 적용 대행 — 진단을 실제 점수로 (수익 전환) */}
      <RemediationCTA result={result} />

      {/* 콘텐츠 분석 */}
      {result.content.status === "ok" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold">콘텐츠 품질</h3>
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <Bar label="팩트 밀도" score={result.content.factDensity} max={10} />
            <Bar label="인용 가능 문장" score={result.content.citableSentences} max={10} />
            <Bar label="명료성" score={result.content.clarity} max={10} />
          </div>
          <p className="text-sm text-slate-600">{result.content.summary}</p>
          {result.content.weaknesses.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-sm text-slate-500">
              {result.content.weaknesses.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* 기술 진단 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 font-semibold">기술 진단</h3>
        <ul className="space-y-2">
          {result.techChecks.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-sm">
              <span>{c.passed ? "✅" : "❌"}</span>
              <span>
                <span className="font-medium">{c.label}</span> <span className="text-slate-400">({c.weight}점)</span>
                <br />
                <span className="text-slate-600">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* AI 노출 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-semibold">AI 노출 테스트</h3>
        <p className="mb-3 text-xs text-slate-500">{result.llmExposure.note}</p>
        {result.llmExposure.status === "ok" ? (
          <ul className="space-y-2 text-sm">
            {result.llmExposure.results.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span>{r.recognized ? (r.accurate ? "✅" : "🟡") : "❌"}</span>
                <span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{r.provider}</span>{" "}
                  <span className="text-slate-700">{r.query}</span>
                  <br />
                  <span className="text-slate-500">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">건너뜀 / 측정 불가 — {result.llmExposure.note}</p>
        )}
      </section>

      <p className="text-center text-xs text-slate-400">생성 시각 {new Date(result.generatedAt).toLocaleString("ko-KR")}</p>
    </div>
  );
}
