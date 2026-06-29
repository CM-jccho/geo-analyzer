"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import { buildQuote, formatKRW } from "@/lib/quote";

// 진단 → 자동 견적 → 적용 대행 상담 신청 (수익 전환 퍼널)
export default function RemediationCTA({ result }: { result: AnalysisResult }) {
  const quote = buildQuote(result);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  const submit = async () => {
    if (!email.trim() || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          url: result.url,
          score: result.score.total,
          maxScore: result.score.max,
          packages: quote.packages.map((p) => p.name),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "신청 실패");
      setState("done");
    } catch (e: any) {
      setMsg(e.message);
      setState("error");
    }
  };

  if (quote.packages.length === 0) {
    return (
      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 className="font-semibold text-emerald-800">GEO 준비도가 우수합니다 🎉</h3>
        <p className="mt-1 text-sm text-emerald-700">
          현재 {quote.currentScore}/{quote.maxScore}점. 지속적인 노출 유지·경쟁사 추적은 <strong>GEO 관리 리테이너</strong>({formatKRW(quote.retainer.priceFrom)}~/월)로 이어가실 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="text-lg font-bold">이 진단, 실제 점수로 만들어 드립니다</h3>
        <span className="text-sm text-slate-500">적용 대행</span>
      </div>

      {/* 점수 여력 */}
      <div className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 p-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-400">{quote.currentScore}</div>
          <div className="text-xs text-slate-400">현재</div>
        </div>
        <div className="flex-1 text-center text-slate-400">────▶</div>
        <div className="text-center">
          <div className="text-2xl font-bold text-emerald-600">{quote.targetScore}</div>
          <div className="text-xs text-slate-400">적용 후 목표</div>
        </div>
        <div className="ml-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">+{quote.targetScore - quote.currentScore}점</div>
      </div>

      {/* 추천 패키지 */}
      <ul className="mt-4 space-y-2">
        {quote.packages.map((p) => (
          <li key={p.key} className="rounded-lg border border-slate-200 p-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">{p.name}</span>
              <span className="text-sm font-semibold">{formatKRW(p.priceFrom)}~ <span className="text-xs font-normal text-emerald-600">(+{p.scoreImpact}점)</span></span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{p.scope}</p>
            <p className="mt-1 text-xs text-slate-400">해결: {p.addresses.join(" · ")}</p>
          </li>
        ))}
      </ul>

      {quote.oneTimeRange && (
        <p className="mt-3 text-sm text-slate-600">
          예상 견적 합계 <strong>{formatKRW(quote.oneTimeRange.min)} ~ {formatKRW(quote.oneTimeRange.max)}</strong> (1회성) · 또는 {quote.retainer.name} {formatKRW(quote.retainer.priceFrom)}~/월
        </p>
      )}

      {/* 리드 캡처 */}
      <div className="mt-5 border-t border-slate-100 pt-5">
        {state === "done" ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            ✓ 신청 완료. 입력하신 이메일로 견적과 작업 범위를 보내드리겠습니다.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium">무료 상담 신청 — 정확한 견적과 작업 범위를 보내드립니다</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="you@example.com"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-900"
              />
              <button onClick={submit} disabled={state === "sending"} className="whitespace-nowrap rounded-lg bg-slate-900 px-5 py-2.5 font-medium text-white disabled:opacity-50">
                {state === "sending" ? "신청 중…" : "적용 대행 신청 →"}
              </button>
            </div>
            {state === "error" && <p className="mt-2 text-sm text-red-600">⚠ {msg}</p>}
          </>
        )}
      </div>
    </section>
  );
}
