"use client";

import { useCallback, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ScanResult, ScanType, Severity } from "@/lib/scan/types";

type Phase = "idle" | "running" | "done" | "error";

const SEV_COLOR: Record<Severity, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#3b82f6",
};
const SEV_BG: Record<Severity, string> = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

const STEPS = ["타깃 검증", "스캐닝 엔진 구동", "취약점 탐지", "리포트 생성"];

export default function SecurityScanner() {
  const [type, setType] = useState<ScanType>("url");
  const [target, setTarget] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  const scan = useCallback(async () => {
    if (!target.trim() || phase === "running") return;
    setPhase("running");
    setError("");
    setResult(null);
    setProgress(0);
    setStepIdx(0);

    // 진행 애니메이션 (스캐닝 엔진 구동 연출)
    clearTimers();
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(92, p + 4);
      setProgress(p);
      setStepIdx(Math.min(STEPS.length - 1, Math.floor(p / 24)));
    }, 200);
    timers.current.push(t);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "스캔 실패");
      clearTimers();
      setProgress(100);
      setStepIdx(STEPS.length - 1);
      setResult(data.result);
      setPhase("done");
    } catch (e: any) {
      clearTimers();
      setError(e.message);
      setPhase("error");
    }
  }, [target, type, phase]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-bold tracking-tight">
            AutoSec <span className="text-emerald-400">Scanner</span>
          </span>
          <a href="/" className="text-sm text-slate-400 hover:text-slate-100">← GEO Analyzer</a>
        </div>
      </nav>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">자동 보안 취약점 스캐너</h1>
          <p className="mt-2 text-slate-400">URL 또는 GitHub 저장소를 입력하면 OWASP Top 10 중심 취약점을 진단합니다.</p>
        </header>

        {/* 입력 */}
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
        </section>

        {result && <Dashboard result={result} />}
      </main>
    </div>
  );
}

function Dashboard({ result }: { result: ScanResult }) {
  const s = result.summary;
  const cards: { label: string; key: Severity; n: number }[] = [
    { label: "Critical", key: "Critical", n: s.critical },
    { label: "High", key: "High", n: s.high },
    { label: "Medium", key: "Medium", n: s.medium },
    { label: "Low", key: "Low", n: s.low },
  ];
  const chartData = cards.filter((c) => c.n > 0).map((c) => ({ name: c.label, value: c.n, color: SEV_COLOR[c.key] }));

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-400">스캔 대상 · {result.engine}</p>
          <p className="font-mono text-sm text-slate-200">{result.target}</p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
          총 취약점 <strong className="text-slate-100">{s.total}</strong>건
        </span>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-xl border p-4 ${SEV_BG[c.key]}`}>
            <p className="text-sm opacity-80">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.n}</p>
          </div>
        ))}
      </div>

      {/* 도넛 + 분포 */}
      <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 font-semibold">취약점 분포</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="none" />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, color: "#f1f5f9" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-emerald-400">취약점이 발견되지 않았습니다 ✅</p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-2 text-sm">
          {cards.map((c) => (
            <div key={c.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-sm" style={{ background: SEV_COLOR[c.key] }} />
                {c.label}
              </span>
              <span className="text-slate-400">{c.n}건</span>
            </div>
          ))}
        </div>
      </section>

      {/* 취약점 리스트 */}
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <h3 className="border-b border-slate-800 px-6 py-4 font-semibold">발견된 취약점</h3>
        {result.vulnerabilities.length === 0 ? (
          <p className="px-6 py-8 text-center text-slate-400">발견된 취약점이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {result.vulnerabilities.map((v) => (
              <li key={v.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${SEV_BG[v.severity]}`}>{v.severity}</span>
                  <span className="font-medium">{v.name}</span>
                  <span className="text-xs text-slate-500">{v.category}</span>
                </div>
                <p className="mt-1 font-mono text-xs text-slate-500">📍 {v.location}</p>
                <p className="mt-1 text-sm text-slate-400">{v.description}</p>
                <p className="mt-1 text-sm text-emerald-400/90">→ {v.remediation}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-slate-600">
        스캔 시각 {new Date(result.scannedAt).toLocaleString("ko-KR")} · 엔진: {result.engine}
      </p>
    </div>
  );
}
