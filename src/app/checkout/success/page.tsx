"use client";

import { useEffect, useState } from "react";

export default function CheckoutSuccess() {
  const [state, setState] = useState<"confirming" | "done" | "error">("confirming");
  const [info, setInfo] = useState<any>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const payload = {
      paymentKey: q.get("paymentKey"),
      orderId: q.get("orderId"),
      amount: Number(q.get("amount")),
      plan: q.get("plan"),
    };
    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "승인 실패");
        setInfo(d);
        setState("done");
      })
      .catch((e) => { setErr(e.message); setState("error"); });
  }, []);

  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      {state === "confirming" && <p className="text-slate-500">결제 승인 중…</p>}
      {state === "done" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
          <p className="text-2xl">✅</p>
          <h1 className="mt-2 text-xl font-bold text-emerald-800">결제가 완료되었습니다</h1>
          <p className="mt-2 text-sm text-emerald-700">{info?.orderName} · ₩{Number(info?.amount).toLocaleString("ko-KR")}</p>
          <p className="mt-1 text-xs text-emerald-600">{info?.method} · {info?.approvedAt}</p>
          <a href="/" className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">홈으로</a>
        </div>
      )}
      {state === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <p className="text-2xl">⚠️</p>
          <h1 className="mt-2 text-xl font-bold text-red-700">결제 승인 실패</h1>
          <p className="mt-2 text-sm text-red-600">{err}</p>
          <a href="/checkout" className="mt-6 inline-block rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium">다시 시도</a>
        </div>
      )}
    </main>
  );
}
