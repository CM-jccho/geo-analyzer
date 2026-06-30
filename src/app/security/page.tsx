"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ScanResult, ScanType } from "@/lib/scan/types";
import ScanDashboard from "../_components/ScanDashboard";

type Phase = "idle" | "running" | "done" | "error";
const STEPS = ["타깃 검증", "스캐닝 엔진 구동", "취약점 탐지", "리포트 생성"];

export default function SecurityScanner() {
  const [type, setType] = useState<ScanType>("url");
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [planLabel, setPlanLabel] = useState("Free");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [planKey, setPlanKey] = useState("");
  const [showPlanKey, setShowPlanKey] = useState(false);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  useEffect(() => {
    setPlanKey(localStorage.getItem("geo_plan_key") || "");
  }, []);

  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  const scan = useCallback(async () => {
    if (!target.trim() || phase === "running") return;
    setPhase("running");
    setError("");
    setResult(null);
    setScanId(null);
    setCopied(false);
    setProgress(0);
    setStepIdx(0);

    clearTimers();
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(92, p + 4);
      setProgress(p);
      setStepIdx(Math.min(STEPS.length - 1, Math.floor(p / 24)));
    }, 200);
    timers.current.push(t);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (planKey) headers["x-plan-key"] = planKey;
      const res = await fetch("/api/scan", { method: "POST", headers, body: JSON.stringify({ type, target }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "스캔 실패");
      clearTimers();
      setProgress(100);
      setStepIdx(STEPS.length - 1);
      setResult(data.result);
      setScanId(data.scanId);
      setPlanLabel(data.planLabel ?? "Free");
      setRemaining(typeof data.remaining === "number" ? data.remaining : null);
      setPhase("done");
    } catch (e: any) {
      clearTimers();
      setError(e.message);
      setPhase("error");
    }
  }, [target, type, phase, planKey]);

  const savePlanKey = () => {
    localStorage.setItem("geo_plan_key", planKey);
    setShowPlanKey(false);
  };

  const shareUrl = scanId ? `${typeof window !== "undefined" ? window.location.origin : ""}/scan/${scanId}` : "";
  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-bold tracking-tight">
            AutoSec <span className="text-emerald-400">Scanner</span>
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="rounded-full border border-slate-700 px-3 py-0.5 text-slate-300">
              {planLabel} 플랜{remaining !== null ? ` · 남은 ${remaining}회` : ""}
            </span>
            <button onClick={() => setShowPlanKey((v) => !v)} className="text-slate-400 hover:text-slate-100">플랜 키</button>
            <a href="/" className="text-slate-400 hover:text-slate-100">← GEO Analyzer</a>
          </div>
        </div>
        {showPlanKey && (
          <div className="border-t border-slate-800 bg-slate-900">
            <div className="mx-auto flex max-w-5xl items-center gap-2 px-5 py-3">
              <input
                value={planKey}
                onChange={(e) => setPlanKey(e.target.value)}
                placeholder="Pro/Enterprise 플랜 키 입력"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              />
              <button onClick={savePlanKey} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900">저장</button>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">자동 보안 취약점 스캐너</h1>
          <p className="mt-2 text-slate-400">URL 또는 GitHub 저장소를 입력하면 OWASP Top 10 중심 취약점을 진단합니다.</p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 inline-flex rounded-lg border border-slate-700 p-1 text-sm">
            {(["url", "repo"] as ScanType[]).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-md px-4 py-1.5 font-medium transition ${type === t ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:text-slate-100"}`}
              >
                {t === "url" ? "URL 스캔 (DAST)" : "GitHub 저장소 (SAST)"}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && scan()}
              placeholder={type === "url" ? "https://api.example.com" : "https://github.com/org/repo"}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none placeholder:text-slate-600 focus:border-emerald-500"
            />
            <button
              onClick={scan}
              disabled={phase === "running"}
              className="whitespace-nowrap rounded-lg bg-emerald-500 px-6 py-3 font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {phase === "running" ? "스캐닝 중…" : "스캔 시작"}
            </button>
          </div>

          {phase === "running" && (
            <div className="mt-5">
              <p className="mb-2 text-sm text-emerald-400">보안 스캐닝 엔진 구동 중… — {STEPS[stepIdx]}</p>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {phase === "error" && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-400">⚠ {error}</p>}

          {phase === "done" && scanId && (
            <div className="mt-4 flex items-center gap-2">
              <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-400" />
              <button onClick={copy} className="whitespace-nowrap rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800">
                {copied ? "복사됨 ✓" : "리포트 링크 복사"}
              </button>
            </div>
          )}
        </section>

        {result && (
          <div className="mt-8">
            <ScanDashboard result={result} />
          </div>
        )}
      </main>
    </div>
  );
}
