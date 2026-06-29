import type { CrawlResult, LlmExposure, LlmQueryResult } from "../types";
import { getProviders } from "./providers";

// Multi-LLM Agent (V1) — 여러 LLM에서 브랜드 노출 현황을 테스트한다 (30점 만점).
// 활성 프로바이더(Claude/GPT/Perplexity/Gemini) × 3개 쿼리 유형(brand/category/trust)으로
// 노출 매트릭스를 만들고, 프로바이더 간 일관성(예측 가능성)을 함께 산출한다.

const MAX = 30;

const SYSTEM = `당신은 GEO(생성형 엔진 최적화) 분석기의 평가 모듈입니다.
사용자가 특정 브랜드에 대해 질문하면, 당신의 학습 지식만으로 그 브랜드를 실제로 알고 있는지 정직하게 자기평가합니다.
모르면 모른다고 해야 하며, 추측으로 아는 척하지 마세요.
반드시 아래 JSON만 출력하세요(코드블록/설명 금지):
{"recognized": true|false, "accurate": true|false, "note": "한 문장 근거"}`;

function buildQueries(brand: string, category: string | null): { type: LlmQueryResult["queryType"]; q: string }[] {
  const cat = category ? category.slice(0, 60) : "이 분야";
  return [
    { type: "brand", q: `"${brand}"은(는) 무엇인가요? 아는 대로 설명해 주세요.` },
    { type: "category", q: `${cat} 관련 서비스나 브랜드를 추천해 주세요.` },
    { type: "trust", q: `"${brand}"은(는) 신뢰할 수 있는 서비스인가요?` },
  ];
}

function parseJson(text: string): { recognized: boolean; accurate: boolean; note: string } | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    return { recognized: !!o.recognized, accurate: !!o.accurate, note: String(o.note ?? "") };
  } catch {
    return null;
  }
}

// 예측 가능성: 각 쿼리에서 프로바이더들이 얼마나 같은 결론(인식/미인식)에 도달하는지의 평균(0~100)
function computeConsistency(results: LlmQueryResult[], providerCount: number): number | null {
  if (providerCount < 2) return null;
  const byType = new Map<string, LlmQueryResult[]>();
  for (const r of results) {
    const arr = byType.get(r.queryType) ?? [];
    arr.push(r);
    byType.set(r.queryType, arr);
  }
  const agreements: number[] = [];
  for (const arr of byType.values()) {
    const rec = arr.filter((r) => r.recognized).length;
    const majority = Math.max(rec, arr.length - rec);
    agreements.push(majority / arr.length);
  }
  return Math.round((agreements.reduce((s, a) => s + a, 0) / agreements.length) * 100);
}

export async function runMultiLlmAgent(crawl: CrawlResult): Promise<{ exposure: LlmExposure; score: number; max: number }> {
  const providers = getProviders();
  if (providers.length === 0) {
    return {
      exposure: {
        status: "skipped",
        providers: [],
        results: [],
        consistency: null,
        note: "LLM API 키가 없어 AI 노출 테스트를 건너뛰었습니다. (ANTHROPIC/OPENAI/PERPLEXITY/GEMINI 키 설정 후 재분석)",
      },
      score: 0,
      max: 0,
    };
  }

  const queries = buildQueries(crawl.brand, crawl.category);
  // 모든 프로바이더 × 쿼리를 병렬 실행
  const tasks = providers.flatMap((p) =>
    queries.map(async ({ type, q }): Promise<LlmQueryResult> => {
      try {
        const text = await p.ask(SYSTEM, q);
        const parsed = parseJson(text) ?? { recognized: false, accurate: false, note: "응답 파싱 실패" };
        return { provider: p.name, query: q, queryType: type, ...parsed };
      } catch (e: any) {
        return { provider: p.name, query: q, queryType: type, recognized: false, accurate: false, note: `오류: ${e?.message ?? e}` };
      }
    }),
  );
  const results = await Promise.all(tasks);

  const erroredCount = results.filter((r) => r.note.startsWith("오류")).length;
  if (erroredCount === results.length) {
    return {
      exposure: {
        status: "error",
        providers: providers.map((p) => p.name),
        results,
        consistency: null,
        note: `LLM 호출이 모두 실패해 측정할 수 없습니다(키/네트워크 확인). 예: ${results[0]?.note.slice(0, 100)}`,
      },
      score: 0,
      max: 0,
    };
  }

  // 점수: (인식 2/3 + 정확 1/3)을 전체 셀 평균하여 30점으로 환산
  const per = MAX / results.length;
  const score = Math.round(
    results.reduce((s, r) => s + (r.recognized ? per * (2 / 3) : 0) + (r.accurate ? per * (1 / 3) : 0), 0),
  );

  const recognizedCount = results.filter((r) => r.recognized).length;
  const consistency = computeConsistency(results, providers.length);

  return {
    exposure: {
      status: "ok",
      providers: providers.map((p) => p.name),
      results,
      consistency,
      note:
        `${providers.length}개 LLM × ${queries.length}개 쿼리 중 ${recognizedCount}개에서 브랜드 인식됨` +
        (consistency !== null ? ` · 예측 가능성 ${consistency}%` : "") +
        " (학습 지식 기반 자기평가 추정치).",
    },
    score,
    max: MAX,
  };
}
