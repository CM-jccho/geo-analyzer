import type { Check, LlmExposure, ContentAnalysis, Action } from "../types";

// GEO Report Agent (V1) — 기술/콘텐츠/AI노출 영역의 개선점을 가중치 순으로 모아 액션 TOP N을 만든다.

export function buildActions(
  techChecks: Check[],
  content: ContentAnalysis,
  llm: LlmExposure,
  limit = 5,
): Action[] {
  const candidates: { weight: number; action: Omit<Action, "rank"> }[] = [];

  // 기술 — 실패 체크
  for (const c of techChecks) {
    if (!c.passed) {
      candidates.push({
        weight: c.weight,
        action: {
          category: "기술",
          title: `${c.label} 개선`,
          why: c.detail,
          how: c.fix ?? "해당 항목을 보완하세요.",
          codeExample: c.codeExample,
        },
      });
    }
  }

  // 콘텐츠 — 낮은 축 + 약점
  if (content.status === "ok") {
    const axes: [string, number][] = [
      ["팩트 밀도", content.factDensity],
      ["인용 가능 문장", content.citableSentences],
      ["명료성", content.clarity],
    ];
    for (const [label, v] of axes) {
      if (v < 6) {
        candidates.push({
          weight: 6 + (6 - v), // 낮을수록 우선
          action: {
            category: "콘텐츠",
            title: `${label} 강화 (${v}/10)`,
            why: content.weaknesses[0] ?? `${label} 점수가 낮아 AI 인용에 불리합니다.`,
            how:
              label === "팩트 밀도"
                ? "구체적 수치·정의·고유명사를 본문에 더 담으세요."
                : label === "인용 가능 문장"
                  ? "한 문장만 떼어도 의미가 완결되는 자족적 문장을 늘리세요."
                  : "문단 구조와 용어를 명확히 정리하세요.",
          },
        });
      }
    }
  }

  // AI 노출 — 미인식
  if (llm.status === "ok") {
    const unrecognized = llm.results.filter((r) => !r.recognized).length;
    if (unrecognized > 0) {
      candidates.push({
        weight: 8,
        action: {
          category: "AI노출",
          title: "AI 인용 가능한 권위 신호 강화",
          why: `LLM 노출 테스트에서 ${unrecognized}/${llm.results.length} 셀이 브랜드를 인식하지 못했습니다.`,
          how: "위키·공신력 있는 디렉터리 등재, 일관된 브랜드 설명, 팩트 밀도 높은 소개 페이지를 마련하세요.",
        },
      });
    }
  }

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((c, i) => ({ rank: i + 1, ...c.action }));
}
