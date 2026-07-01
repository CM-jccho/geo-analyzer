import { NextRequest, NextResponse } from "next/server";
import { CHECKOUT_ITEMS } from "@/lib/checkout";
import { notify } from "@/lib/notify";

export const runtime = "nodejs";

// POST /api/payments/confirm  { paymentKey, orderId, amount, plan? }
// Toss Payments 결제 승인 (시크릿 키 Basic auth). 금액 위변조 방지 검증 포함.
const SECRET = process.env.TOSS_SECRET_KEY || "test_sk_zXLkKEypNArWmo50nX3lmeaxYG5R";

export async function POST(req: NextRequest) {
  let body: { paymentKey?: string; orderId?: string; amount?: number; plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON 본문이 필요합니다." }, { status: 400 });
  }

  const { paymentKey, orderId, amount, plan } = body;
  if (!paymentKey || !orderId || typeof amount !== "number") {
    return NextResponse.json({ error: "paymentKey·orderId·amount가 필요합니다." }, { status: 400 });
  }

  // 금액 위변조 검증 (plan이 있으면 정의된 가격과 일치해야 함)
  if (plan && CHECKOUT_ITEMS[plan] && CHECKOUT_ITEMS[plan].amount !== amount) {
    return NextResponse.json({ error: "결제 금액이 상품 가격과 일치하지 않습니다." }, { status: 400 });
  }

  const auth = Buffer.from(`${SECRET}:`).toString("base64");
  try {
    const res = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
      method: "POST",
      headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.message || "결제 승인 실패", code: data.code }, { status: res.status });
    }
    void notify(`💳 결제 완료\n상품: ${data.orderName ?? plan}\n금액: ${amount.toLocaleString("ko-KR")}원\n주문: ${orderId}`);
    return NextResponse.json({
      ok: true,
      orderName: data.orderName,
      amount: data.totalAmount,
      method: data.method,
      approvedAt: data.approvedAt,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "결제 승인 중 오류" }, { status: 500 });
  }
}
