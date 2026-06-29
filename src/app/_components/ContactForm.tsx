"use client";

import { useState } from "react";

export default function ContactForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  const submit = async () => {
    if (state === "sending") return;
    if (!message.trim()) return setErr("문의 내용을 입력해 주세요."), setState("error");
    setState("sending");
    setErr("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "전송 실패");
      setState("done");
    } catch (e: any) {
      setErr(e.message);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <p className="font-semibold text-emerald-800">문의가 접수되었습니다 ✓</p>
        <p className="mt-1 text-sm text-emerald-700">입력하신 연락처로 빠르게 회신드리겠습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">문의 내용 *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="예) 쇼핑몰 사이트인데 적용 대행 견적이 궁금합니다."
            className="w-full resize-none rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">이메일 *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">전화번호 *</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-900"
            />
          </div>
        </div>
      </div>

      {state === "error" && <p className="mt-3 text-sm text-red-600">⚠ {err}</p>}

      <button
        onClick={submit}
        disabled={state === "sending"}
        className="mt-5 w-full rounded-lg bg-slate-900 py-3 font-medium text-white disabled:opacity-50"
      >
        {state === "sending" ? "전송 중…" : "문의 제출"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-400">제출 시 입력하신 이메일·전화번호와 문의 내용이 담당자에게 전달됩니다.</p>
    </div>
  );
}
