import type { AnalysisResult } from "./types";

// 진단 결과 → 적용 대행 견적 자동 산출.
// 실패/부족 항목을 서비스 패키지에 매핑하고 예상 점수 회복분을 계산한다.

export interface ServicePackage {
  key: string;
  name: string;
  scope: string;
  priceFrom: number; // KRW, 시작가
  addresses: string[]; // 이 패키지가 해결하는 진단 항목
  scoreImpact: number; // 예상 회복 점수
}

export interface Quote {
  currentScore: number;
  maxScore: number;
  targetScore: number; // 적용 시 현실적 목표
  headroom: number; // 개선 여력
  packages: ServicePackage[];
  retainer: { name: string; priceFrom: number; desc: string };
  oneTimeRange: { min: number; max: number } | null; // 1회성 패키지 합계 범위
}

export function buildQuote(r: AnalysisResult): Quote {
  const s = r.score;
  const packages: ServicePackage[] = [];

  // 1) 기술 적용 — 실패한 기술 체크
  const failedTech = r.techChecks.filter((c) => !c.passed);
  if (failedTech.length) {
    packages.push({
      key: "tech",
      name: "기술 적용 패키지",
      scope: "robots.txt·Schema·llms.txt·sitemap·canonical·OG 등 AI 가시성 기반 구현",
      priceFrom: 300000,
      addresses: failedTech.map((c) => c.label),
      scoreImpact: failedTech.reduce((a, c) => a + c.weight, 0),
    });
  }

  // 2) 콘텐츠 최적화 — 콘텐츠 점수 부족
  if (r.content.status === "ok") {
    const gap = s.content.max - s.content.score;
    if (gap >= 6) {
      const axes = [
        ["팩트 밀도", r.content.factDensity],
        ["인용 가능 문장", r.content.citableSentences],
        ["명료성", r.content.clarity],
      ] as const;
      packages.push({
        key: "content",
        name: "콘텐츠 최적화 패키지",
        scope: "핵심 5개 페이지를 인용 가능 구조로 재작성 (팩트 밀도·자족 문장·FAQ 구조)",
        priceFrom: 500000,
        addresses: axes.filter(([, v]) => v < 7).map(([l]) => `${l} 강화`),
        scoreImpact: gap,
      });
    }
  }

  // 3) 권위·브랜드 신호 — LLM 미인식
  if (r.llmExposure.status === "ok") {
    const unrec = r.llmExposure.results.filter((x) => !x.recognized).length;
    if (unrec > 0) {
      packages.push({
        key: "authority",
        name: "권위·브랜드 신호 구축",
        scope: "위키/디렉터리 등재, 일관된 브랜드 설명 배포, 인용 가능 소개 페이지 제작",
        priceFrom: 700000,
        addresses: [`AI 미인식 ${unrec}건 개선`],
        scoreImpact: s.llm.max - s.llm.score,
      });
    }
  }

  const sumFrom = packages.reduce((a, p) => a + p.priceFrom, 0);
  const oneTimeRange = packages.length ? { min: sumFrom, max: Math.round((sumFrom * 1.8) / 10000) * 10000 } : null;

  const headroom = s.max - s.total;
  const targetScore = Math.min(s.max, s.total + Math.round(headroom * 0.9));

  return {
    currentScore: s.total,
    maxScore: s.max,
    targetScore,
    headroom,
    packages,
    retainer: {
      name: "GEO 관리 리테이너",
      priceFrom: 900000,
      desc: "월간 모니터링 + 최적화 작업 + 경쟁사 추적 + 리포트",
    },
    oneTimeRange,
  };
}

export function formatKRW(n: number): string {
  return "₩" + n.toLocaleString("ko-KR");
}
