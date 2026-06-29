// 적용 대행 상담 신청(리드) 저장. MVP: 인메모리.
// 프로덕션: CRM/DB + 운영자 알림(이메일·Slack·Telegram)으로 연결.

export interface Lead {
  email: string;
  url: string;
  score: number;
  maxScore: number;
  packages: string[];
  note?: string;
  createdAt: string;
}

const leads: Lead[] = (globalThis as any).__geoLeads ?? [];
(globalThis as any).__geoLeads = leads;

export function addLead(lead: Lead): void {
  leads.push(lead);
}

export function allLeads(): Lead[] {
  return leads;
}
