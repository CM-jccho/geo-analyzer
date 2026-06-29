// GEO Analyzer — 공용 타입
// 점수 체계(V1): 기술 40 + 콘텐츠 30 + LLM 노출 30 = 100점 만점
// (콘텐츠/LLM은 ANTHROPIC_API_KEY 없으면 skip → 해당 배점은 분모에서 제외)

export type JobStatus =
  | "queued"
  | "crawling" // G-01 Crawl Agent
  | "diagnosing" // Tech Agent
  | "content-analyzing" // Content Agent
  | "llm-testing" // Multi-LLM Agent
  | "scoring" // GEO Report
  | "done"
  | "error";

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "대기 중",
  crawling: "사이트 크롤링 중",
  diagnosing: "기술 진단 중",
  "content-analyzing": "콘텐츠 품질 분석 중",
  "llm-testing": "AI 노출 테스트 중",
  scoring: "점수 산정 중",
  done: "완료",
  error: "오류",
};

export interface CrawlResult {
  finalUrl: string;
  https: boolean;
  brand: string;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  h1: string[];
  headingOutline: string[]; // H1~H3 텍스트 순서 (구조 파악용)
  hasJsonLd: boolean;
  jsonLdTypes: string[];
  hasOpenGraph: boolean;
  llmsTxt: boolean; // /llms.txt 존재 (신흥 GEO 표준)
  category: string | null;
  bodyText: string; // 콘텐츠 분석용 본문 텍스트(정제·절단)
  wordCount: number;
  robotsTxt: { found: boolean; aiCrawlersBlocked: string[]; aiCrawlersAllowed: string[] };
  sitemap: { found: boolean; url: string | null };
}

export interface Check {
  id: string;
  label: string;
  passed: boolean;
  weight: number;
  detail: string;
  fix?: string;
  codeExample?: string;
}

export interface LlmQueryResult {
  provider: string; // "Claude" | "GPT" | "Perplexity" | "Gemini"
  query: string;
  queryType: "brand" | "category" | "trust";
  recognized: boolean;
  accurate: boolean;
  note: string;
}

export interface LlmExposure {
  status: "ok" | "skipped" | "error";
  providers: string[]; // 실제로 테스트한 프로바이더
  results: LlmQueryResult[];
  consistency: number | null; // 예측 가능성(0~100): 프로바이더 간 인식 일관성
  note: string;
}

export interface ContentAnalysis {
  status: "ok" | "skipped" | "error";
  factDensity: number; // 0~10
  citableSentences: number; // 0~10
  clarity: number; // 0~10
  summary: string;
  strengths: string[];
  weaknesses: string[];
}

export interface Action {
  rank: number;
  category: "기술" | "콘텐츠" | "AI노출";
  title: string;
  why: string;
  how: string;
  codeExample?: string;
}

export interface ScoreBucket {
  score: number;
  max: number;
}

export interface AnalysisResult {
  url: string;
  brand: string;
  score: {
    total: number;
    max: number;
    tech: ScoreBucket;
    content: ScoreBucket;
    llm: ScoreBucket;
  };
  crawl: CrawlResult;
  techChecks: Check[];
  content: ContentAnalysis;
  llmExposure: LlmExposure;
  actions: Action[];
  generatedAt: string;
}

export interface AnalyzeJob {
  id: string;
  url: string;
  status: JobStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  result?: AnalysisResult;
  error?: string;
}
