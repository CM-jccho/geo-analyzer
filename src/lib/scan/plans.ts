// 플랜별 1일 스캔 한도.
// 인증은 MVP에서 'x-plan-key' 헤더 기반(키→플랜 매핑)으로 처리한다.
// 프로덕션에서는 이 resolvePlan을 실제 인증(NextAuth/Clerk + DB 조회)으로 교체한다.

export type PlanId = "free" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  label: string;
  dailyLimit: number;
}

export const PLANS: Record<PlanId, Plan> = {
  free: { id: "free", label: "Free", dailyLimit: Number(process.env.SCAN_DAILY_LIMIT ?? 3) },
  pro: { id: "pro", label: "Pro", dailyLimit: Number(process.env.PRO_SCAN_DAILY_LIMIT ?? 50) },
  enterprise: { id: "enterprise", label: "Enterprise", dailyLimit: Number(process.env.ENT_SCAN_DAILY_LIMIT ?? 1000) },
};

// env로 플랜 키를 설정: PRO_PLAN_KEYS="key1,key2", ENTERPRISE_PLAN_KEYS="key3"
function keysFor(env: string | undefined): Set<string> {
  return new Set((env ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export function resolvePlan(req: Request): Plan {
  const key = req.headers.get("x-plan-key")?.trim();
  if (key) {
    if (keysFor(process.env.ENTERPRISE_PLAN_KEYS).has(key)) return PLANS.enterprise;
    if (keysFor(process.env.PRO_PLAN_KEYS).has(key)) return PLANS.pro;
  }
  return PLANS.free;
}
