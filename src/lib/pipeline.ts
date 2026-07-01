import { updateJob } from "./jobStore";
import { runCrawlAgent } from "./agents/crawl";
import { runTechAgent } from "./agents/tech";
import { runContentAgent } from "./agents/content";
import { runMultiLlmAgent } from "./agents/multiLlm";
import { buildActions } from "./agents/report";
import { saveResult } from "./resultStore";
import { setCachedAnalysis } from "./analysisCache";
import type { AnalysisResult } from "./types";

// GEO Orchestrator (V1)
// Phase 1: Crawl → Tech (기술 40)
// Phase 2: Content (콘텐츠 30) + Multi-LLM (AI노출 30) 병렬
// Phase 3: Report (점수 + 액션)

type Progress = (status: Parameters<typeof updateJob>[1]["status"], progress: number) => void;

export interface AnalysisOptions {
  onProgress?: Progress;
  maxLlmProviders?: number; // 플랜별 LLM 프로바이더 수 제한(비용 통제)
}

// 순수 분석 로직 — 결과를 반환한다 (잡 스토어에 의존하지 않음).
// 동기(serverless) 경로와 큐(in-memory/Redis) 경로 양쪽에서 재사용.
export async function runAnalysisCore(url: string, opts: AnalysisOptions = {}): Promise<AnalysisResult> {
  const { onProgress, maxLlmProviders } = opts;
  onProgress?.("crawling", 20);
  const crawl = await runCrawlAgent(url);

  onProgress?.("diagnosing", 40);
  const tech = runTechAgent(crawl);

  onProgress?.("content-analyzing", 55);
  const [contentRes, llmRes] = await Promise.all([runContentAgent(crawl), runMultiLlmAgent(crawl, maxLlmProviders)]);
  onProgress?.("llm-testing", 80);

  onProgress?.("scoring", 92);
  const actions = buildActions(tech.checks, contentRes.content, llmRes.exposure);

  return {
    url: crawl.finalUrl,
    brand: crawl.brand,
    score: {
      total: tech.score + contentRes.score + llmRes.score,
      max: tech.max + contentRes.max + llmRes.max, // skip된 영역은 분모에서 자동 제외
      tech: { score: tech.score, max: tech.max },
      content: { score: contentRes.score, max: contentRes.max },
      llm: { score: llmRes.score, max: llmRes.max },
    },
    crawl,
    techChecks: tech.checks,
    content: contentRes.content,
    llmExposure: llmRes.exposure,
    actions,
    generatedAt: new Date().toISOString(),
  };
}

// 큐/인메모리 경로용 래퍼 — 진행 상태를 잡 스토어에 기록하고, 결과를 KV·캐시에 저장한다.
export async function runAnalysis(jobId: string, url: string): Promise<void> {
  try {
    const result = await runAnalysisCore(url, {
      onProgress: (status, progress) => updateJob(jobId, { status, progress }),
    });
    updateJob(jobId, { status: "done", progress: 100, result });
    await Promise.all([saveResult(jobId, result), setCachedAnalysis(url, result)]); // C9 공유 영속화 + C8 캐시
  } catch (e: any) {
    updateJob(jobId, { status: "error", progress: 100, error: e?.message ?? String(e) });
  }
}
