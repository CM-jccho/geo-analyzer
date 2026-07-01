"use client";

import { useEffect, useState } from "react";

type Mode = "login" | "signup";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [me, setMe] = useState<{ email: string; plan: string } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => setMe(d.user));
  }, []);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setMe({ email: d.email, plan: d.plan });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
  };

  return (
    <main className="mx-auto max-w-sm px-5 py-20">
      <a href="/" className="text-sm text-blue-600 underline">← 홈</a>
      {me ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-slate-500">로그인됨</p>
          <p className="mt-1 font-semibold">{me.email}</p>
          <span className="mt-2 inline-block rounded-full border border-slate-300 px-3 py-0.5 text-sm">{me.plan} 플랜</span>
          <button onClick={logout} className="mt-6 block w-full rounded-lg border border-slate-300 py-2.5 text-sm font-medium hover:bg-slate-50">로그아웃</button>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 inline-flex rounded-lg border border-slate-200 p-1 text-sm">
            {(["login", "signup"] as Mode[]).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={`rounded-md px-4 py-1.5 font-medium ${mode === m ? "bg-slate-900 text-white" : "text-slate-500"}`}>
                {m === "login" ? "로그인" : "회원가입"}
              </button>
            ))}
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="이메일" className="mb-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-900" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" placeholder="비밀번호 (8자 이상)" className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-900" />
          {err && <p className="mt-2 text-sm text-red-600">⚠ {err}</p>}
          <button onClick={submit} disabled={busy} className="mt-4 w-full rounded-lg bg-slate-900 py-2.5 font-medium text-white disabled:opacity-50">
            {busy ? "처리 중…" : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </div>
      )}
    </main>
  );
}
