"use client";

import { useEffect, useState } from "react";

export default function CheckoutFail() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setMsg(q.get("message") || "결제가 취소되었거나 실패했습니다.");
  }, []);
  return (
    <main className="mx-auto max-w-md px-5 py-20 text-center">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-2xl">❌</p>
        <h1 className="mt-2 text-xl font-bold">결제 실패</h1>
        <p className="mt-2 text-sm text-slate-500">{msg}</p>
        <a href="/checkout" className="mt-6 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white">다시 시도</a>
      </div>
    </main>
  );
}
