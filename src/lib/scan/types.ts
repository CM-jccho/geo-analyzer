// AutoSec Scanner — 공용 타입

export type Severity = "Critical" | "High" | "Medium" | "Low";
export type ScanType = "url" | "repo"; // DAST(동적) | SAST(정적)

export const SEVERITY_ORDER: Severity[] = ["Critical", "High", "Medium", "Low"];

export interface Vulnerability {
  id: string;
  name: string;
  severity: Severity;
  category: string; // OWASP 분류 (예: "A03:2021 Injection")
  location: string; // 발생 위치(엔드포인트/파일)
  description: string;
  remediation: string; // 해결 방안
}

export interface ScanSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface ScanResult {
  target: string;
  type: ScanType;
  engine: string; // 사용 엔진(표시용)
  scannedAt: string;
  summary: ScanSummary;
  vulnerabilities: Vulnerability[];
}

// AI 분석 레이어 (Claude) 결과
export interface AiInsightItem {
  id: string;
  name: string;
  impact: string; // 비즈니스 영향
  fix: string; // 구체적 조치
}
export interface AiInsight {
  riskLevel: "심각" | "높음" | "보통" | "낮음";
  summary: string; // 경영진/비개발자용 총평
  prioritized: AiInsightItem[];
  topAction: string; // 가장 먼저 할 일
}
