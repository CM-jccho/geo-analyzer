"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { ScanResult, Severity } from "@/lib/scan/types";

export const SEV_COLOR: Record<Severity, string> = {
  Critical: "#ef4444",
  High: "#f97316",
  Medium: "#eab308",
  Low: "#3b82f6",
};
export const SEV_BG: Record<Severity, string> = {
  Critical: "bg-red-500/10 text-red-400 border-red-500/30",
  High: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Low: "bg-blue-500/10 text-blue-400 border-blue-500/30",
};

export default function ScanDashboard({ result }: { result: ScanResult }) {
  const s = result.summary;
  const cards: { label: string; key: Severity; n: number }[] = [
    { label: "Critical", key: "Critical", n: s.critical },
    { label: "High", key: "High", n: s.high },
    { label: "Medium", key: "Medium", n: s.medium },
    { label: "Low", key: "Low", n: s.low },
  ];
  const chartData = cards.filter((c) => c.n > 0).map((c) => ({ name: c.label, value: c.n, color: SEV_COLOR[c.key] }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-slate-400">스캔 대상 · {result.engine}</p>
          <p className="font-mono text-sm text-slate-200">{result.target}</p>
        </div>
        <span className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">
          총 취약점 <strong className="text-slate-100">{s.total}</strong>건
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} className={`rounded-xl border p-4 ${SEV_BG[c.key]}`}>
            <p className="text-sm opacity-80">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.n}</p>
          </div>
        ))}
      </div>

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
