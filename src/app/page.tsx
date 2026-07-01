"use client";

import { useCallback, useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/types";
import ResultView from "./_components/ResultView";
import ContactForm from "./_components/ContactForm";

type Phase = "idle" | "running" | "done" | "error";

const EVOLUTION = [
  {
    tag: "SEO",
    period: "1998~2015",
    title: "검색 결과에 나타나는 것",
    desc: "Google 검색 1페이지를 목표로 키워드·백링크·기술 SEO를 최적화하던 시대.",
  },
  {
    tag: "AEO",
    period: "2015~2022",
    title: "검색 결과 자체가 되는 것",
    desc: "Featured Snippet·음성 검색 등장. Schema와 Q&A 구조로 답이 화면에 직접 표시되게 했다.",
  },
  {
    tag: "GEO",
    period: "2022~",
    title: "AI 답변에 인용되는 브랜드가 되는 것",
    desc: "ChatGPT·Claude·Perplexity가 답을 생성한다. 이제 기준은 Google이 아니라 AI다.",
    active: true,
  },
];

const FEATURES = [
  { title: "GEO 진단", desc: "AI 가시성·브랜드 인식·인용 구조를 5레벨로 점수화", icon: "🔍" },
  { title: "브랜드 분석", desc: "여러 LLM이 브랜드를 일관되게 설명하는지 측정", icon: "🎯" },
  { title: "모니터링", desc: "언급 빈도·SOV·예측 가능성을 지속 추적", icon: "📊" },
];

const LEVELS = [
  { n: 1, name: "AI 가시성 기반", q: "AI가 내 사이트를 읽을 수 있는가?" },
  { n: 2, name: "브랜드 인식 확인", q: "AI가 내 브랜드를 알고 있는가?" },
  { n: 3, name: "인용 구조 최적화", q: "AI가 인용하고 싶어지는 구조인가?", pivot: true },
  { n: 4, name: "브랜드 목소리 일관성", q: "AI가 브랜드를 일관되게 설명하는가?" },
  { n: 5, name: "카테고리 연상 지배", q: "그 분야를 물으면 우리가 먼저 나오는가?" },
];

type Plan = {
  name: string;
  original?: string;
  price: string;
  per?: string;
  discount?: string;
  desc: string;
  items: string[];
  highlight?: boolean;
};

const PLANS: Plan[] = [
  { name: "Free 진단", price: "₩0", desc: "회원가입 없이 즉시", items: ["GEO 종합 점수 (Lv 1~2)", "기술 진단 요약", "액션 TOP 3"] },
  { name: "Pro 구독", original: "₩39,000", price: "₩19,000", per: "/월", discount: "51%", desc: "직접 적용하는 분", items: ["전체 점수 (Lv 1~5)", "5개 LLM × 인텐트 매트릭스", "콘텐츠·서사 분석", "모니터링 대시보드"] },
  { name: "적용 대행", original: "₩300,000", price: "₩199,000", per: "~/건", discount: "33%", desc: "대신 적용해 드림", items: ["기술 적용 패키지", "콘텐츠 최적화", "권위 신호 구축", "Before/After 점수 보증"], highlight: true },
  { name: "관리 리테이너", original: "₩900,000", price: "₩690,000", per: "~/월", discount: "23%", desc: "지속 성과 관리", items: ["월간 모니터링·최적화", "경쟁사 추적", "정기 리포트", "성과 기반 과금 옵션"] },
];

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [statusLabel, setStatusLabel] = useState("");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const analyze = useCallback(async () => {
    if (!url.trim() || phase === "running") return;
    setPhase("running");
    setError("");
    setResult(null);
    setJobId(null);
    setCopied(false);
    setProgress(5);
    setStatusLabel("분석 요청 중");
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청 실패");

      const id = data.jobId as string;
      setJobId(id);

      // 서버리스(동기) 경로: 결과가 바로 옴
      if (data.result) {
        setResult(data.result);
        setProgress(100);
        setPhase("done");
        return;
      }

      // 로컬/서버 경로: status 폴링
      stopPoll();
      pollRef.current = setInterval(async () => {
        const s = await fetch(`/api/analyze/${id}/status`).then((r) => r.json());
        setStatusLabel(s.statusLabel ?? "");
        setProgress(s.progress ?? 0);
        if (s.status === "done") {
          stopPoll();
          setResult(s.result);
          setPhase("done");
        } else if (s.status === "error") {
          stopPoll();
          setError(s.error || "분석 중 오류가 발생했습니다.");
          setPhase("error");
        }
      }, 1000);
    } catch (e: any) {
      setError(e.message);
      setPhase("error");
    }
  }, [url, phase]);

  const shareUrl = jobId ? `${typeof window !== "undefined" ? window.location.origin : ""}/result/${jobId}` : "";
  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showMarketing = phase === "idle";

  return (
    <div>
      {/* 네비게이션 */}
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <span className="font-bold tracking-tight">GEO Analyzer</span>
          <div className="flex gap-5 text-sm text-slate-600">
            <a href="#features" className="hover:text-slate-900">기능</a>
            <a href="#levels" className="hover:text-slate-900">성숙도</a>
            <a href="#pricing" className="hover:text-slate-900">가격</a>
            <a href="#contact" className="hover:text-slate-900">문의</a>
            <a href="/security" className="font-medium text-emerald-600 hover:text-emerald-700">보안 스캔</a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-white to-slate-50">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
            SEO <span className="text-slate-300">→</span> AEO <span className="text-slate-300">→</span> <span className="text-slate-900">GEO</span>
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Google 최적화는 했나요?
            <br />
            <span className="text-blue-600">AI는 당신 브랜드를 알고 있나요?</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-slate-600">
            검색의 패러다임이 바뀔 때마다 최적화의 기준도 바뀝니다. URL을 입력하면 AI가 당신의 사이트를 어떻게 보는지 진단해 드립니다.
          </p>

          <div className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && analyze()}
              placeholder="https://your-website.com"
              className="flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
            />
            <button onClick={analyze} disabled={phase === "running"} className="whitespace-nowrap rounded-lg bg-slate-900 px-6 py-3 font-medium text-white disabled:opacity-50">
              {phase === "running" ? "분석 중…" : "분석 시작 →"}
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-400">무료 · 회원가입 불필요 · 약 2분 소요</p>
        </div>
      </section>

      {/* 진행 상태 / 결과 */}
      <div ref={resultRef} className="mx-auto max-w-3xl px-5">
        {phase === "running" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex justify-between text-sm text-slate-500">
              <span>분석 중: {url}</span>
              <span>{statusLabel} · {progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-slate-900 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {phase === "error" && <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">⚠ {error}</p>}

        {phase === "done" && jobId && (
          <div className="mb-4 flex items-center gap-2">
            <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500" />
            <button onClick={copy} className="whitespace-nowrap rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
              {copied ? "복사됨 ✓" : "링크 복사"}
            </button>
          </div>
        )}
        {result && <ResultView result={result} />}
        {phase !== "idle" && (
          <div className="py-6 text-center">
            <button onClick={() => { setPhase("idle"); setResult(null); setUrl(""); }} className="text-sm text-blue-600 underline">
              ← 처음으로
            </button>
          </div>
        )}
      </div>

      {showMarketing && (
        <>
          {/* SEO → AEO → GEO 진화 */}
          <section className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="mb-2 text-center text-2xl font-bold">검색 최적화의 진화</h2>
            <p className="mb-8 text-center text-slate-500">“이제 기준은 Google이 아니라 AI다”</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {EVOLUTION.map((e) => (
                <div key={e.tag} className={`rounded-2xl border p-6 ${e.active ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-lg font-bold ${e.active ? "text-blue-600" : "text-slate-800"}`}>{e.tag}</span>
                    <span className="text-xs text-slate-400">{e.period}</span>
                  </div>
                  <p className="mt-2 font-medium">{e.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{e.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 기능 */}
          <section id="features" className="bg-slate-50">
            <div className="mx-auto max-w-5xl px-5 py-16">
              <h2 className="mb-8 text-center text-2xl font-bold">무엇을 해주나요</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="text-2xl">{f.icon}</div>
                    <p className="mt-3 font-semibold">{f.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 5레벨 성숙도 */}
          <section id="levels" className="mx-auto max-w-3xl px-5 py-16">
            <h2 className="mb-2 text-center text-2xl font-bold">GEO 5단계 성숙도 모델</h2>
            <p className="mb-8 text-center text-slate-500">AI가 당신의 브랜드를 어떻게 인식하는지, 그 성숙도를 진단합니다</p>
            <ol className="space-y-3">
              {LEVELS.map((l) => (
                <li key={l.n} className={`flex items-start gap-4 rounded-xl border p-4 ${l.pivot ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${l.pivot ? "bg-amber-400 text-white" : "bg-slate-900 text-white"}`}>{l.n}</span>
                  <div>
                    <p className="font-medium">
                      {l.name} {l.pivot && <span className="ml-1 text-xs font-semibold text-amber-600">← 변곡점</span>}
                    </p>
                    <p className="text-sm text-slate-500">{l.q}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 가격 */}
          <section id="pricing" className="bg-slate-50">
            <div className="mx-auto max-w-5xl px-5 py-16">
              <div className="mx-auto mb-6 w-fit rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white">
                🔥 런칭 기념 한정 특가 — 선착순 30팀
              </div>
              <h2 className="mb-2 text-center text-2xl font-bold">가격</h2>
              <p className="mb-8 text-center text-slate-500">진단은 무료. 직접 하거나, 적용을 맡기거나, 관리까지 — 성과로 이어집니다.</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {PLANS.map((p) => (
                  <div key={p.name} className={`relative rounded-2xl border bg-white p-6 ${p.highlight ? "border-red-500 shadow-md ring-1 ring-red-200" : "border-slate-200"}`}>
                    {p.highlight && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-500 px-3 py-0.5 text-xs font-bold text-white">
                        가장 인기
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{p.name}</p>
                      {p.discount && <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-600">{p.discount} 할인</span>}
                    </div>
                    {p.original && <p className="mt-2 text-sm text-slate-400 line-through">{p.original}{p.per}</p>}
                    <p className={`${p.original ? "mt-0.5" : "mt-2"} text-2xl font-bold ${p.discount ? "text-red-600" : ""}`}>
                      {p.price}
                      {p.per && <span className="text-sm font-normal text-slate-400">{p.per}</span>}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
                    <ul className="mt-4 space-y-1 text-sm text-slate-600">
                      {p.items.map((it) => (
                        <li key={it}>✓ {it}</li>
                      ))}
                    </ul>
                    <a
                      href={p.name === "Pro 구독" ? "/checkout?plan=pro" : "#contact"}
                      className={`mt-5 block rounded-lg py-2.5 text-center text-sm font-medium ${p.highlight ? "bg-red-500 text-white hover:bg-red-600" : "border border-slate-300 hover:bg-slate-50"}`}
                    >
                      {p.name === "Free 진단" ? "무료로 시작" : p.name === "Pro 구독" ? "구독 결제" : "문의하기"}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {/* 문의하기 */}
      <section id="contact" className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-xl px-5 py-16">
          <h2 className="mb-2 text-center text-2xl font-bold">문의하기</h2>
          <p className="mb-8 text-center text-slate-500">적용 대행·관리 상담, 무엇이든 남겨주세요. 빠르게 회신드립니다.</p>
          <ContactForm />
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-400">
        GEO Analyzer · AI 검색 최적화 진단 서비스
      </footer>
    </div>
  );
}
