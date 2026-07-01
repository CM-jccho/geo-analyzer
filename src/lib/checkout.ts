// 결제 상품 정의 (클라이언트/서버 공용). 금액은 서버에서 검증에 사용.

export interface CheckoutItem {
  key: string;
  name: string;
  amount: number; // KRW
}

export const CHECKOUT_ITEMS: Record<string, CheckoutItem> = {
  pro: { key: "pro", name: "Pro 구독 (월)", amount: 19000 },
  remediation: { key: "remediation", name: "적용 대행 패키지", amount: 199000 },
  retainer: { key: "retainer", name: "관리 리테이너 (월)", amount: 690000 },
};

export function getItem(key: string | null | undefined): CheckoutItem {
  return (key && CHECKOUT_ITEMS[key]) || CHECKOUT_ITEMS.pro;
}

// Toss 테스트 키(공개). 프로덕션은 env로 실제 키 주입.
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq";
