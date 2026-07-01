"use client";

import { useEffect, useState } from "react";
import { CHECKOUT_ITEMS, TOSS_CLIENT_KEY, getItem } from "@/lib/checkout";

export default function Checkout() {
  const [plan, setPlan] = useState("pro");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("plan") || "pro";
    setPlan(CHECKOUT_ITEMS[p] ? p : "pro");
    const s = document.createElement("script");
    s.src = "https://js.tosspayments.com/v1/payment";
    s.onload = () => setReady(true);
    document.body.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const item = getItem(plan);

  const pay = () => {
    const TossPayments = (window as any).TossPayments;
    if (!TossPayments) return;
    const toss = TossPayments(TOSS_CLIENT_KEY);
    const orderId = "order_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    toss.requestPayment("카드", {
      amount: item.amount,
      orderId,
      orderName: item.name,
      successUrl: `${location.origin}/checkout/success?plan=${plan}`,
      failUrl: `${location.origin}/checkout/fail`,
    });
  };

  return (
    <main className="mx-auto max-w-md px-5 py-16">
      <a href="/#pricing" className="text-sm text-blue-600 underline">← 요금제로</a>
      <h1 className="mt-4 text-2xl font-bold">결제</h1>
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">선택 상품</p>
        <p className="mt-1 text-lg font-semibold">{item.name}</p>
        <p className="mt-4 text-3xl font-bold">₩{item.amount.toLocaleString("ko-KR")}</p>
        <div className="mt-4 flex gap-2 text-sm">
          {Object.values(CHECKOUT_ITEMS).map((it) => (
            <button
              key={it.key}
              onClick={() => setPlan(it.key)}
              className={`rounded-lg border px-3 py-1.5 ${plan === it.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300"}`}
            >
              {it.name}
            </button>
          ))}
        </div>
        <button
          onClick={pay}
          disabled={!ready}
          className="mt-6 w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {ready ? "카드로 결제하기" : "결제 모듈 로딩 중…"}
        </button>
        <p className="mt-3 text-center text-xs text-slate-400">테스트 모드 · 실제 청구되지 않습니다 (Toss 테스트 카드 사용)</p>
      </div>
    </main>
  );
}
