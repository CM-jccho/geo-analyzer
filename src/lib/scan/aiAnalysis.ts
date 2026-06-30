import Anthropic from "@anthropic-ai/sdk";
import type { ScanResult, AiInsight } from "./types";

// AI 분석 레이어 — 스캔 결과(Trivy/ZAP/mock)를 Claude로 해석한다.
// 탐지는 전용 엔진이, "비즈니스 영향 우선순위화 · 경영진용 요약 · 우선 조치"는 LLM이 담당.
// ANTHROPIC_API_KEY 없으면 null 반환(graceful).

const SYSTEM = `당신은 시니어 보안 컨설턴트입니다. 자동 스캐너의 취약점 결과를 받아,
경영진과 비개발자도 이해할 수 있는 실행 중심 보안 분석을 제공합니다.
반드시 아래 JSON만 출력하세요(코드블록/설명 금지, 한국어):
{"riskLevel":"심각|높음|보통|낮음","summary":"전체 보안 상태 3~4문장 총평","prioritized":[{"id":"취약점ID","name":"취약점명","impact":"이 취약점이 비즈니스에 미치는 영향 한 문장","fix":"구체적 조치 한 문장"}],"topAction":"가장 먼저 해야 할 단 하나의 조치"}
- prioritized: 비즈니스 영향이 큰 순으로 최대 5개. 심각도뿐 아니라 악용 가능성·노출 범위를 함께 고려.
- 취약점이 없으면 riskLevel은 "낮음", prioritized는 빈 배열.`;

function parse(text: string): AiInsight | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const lvl = ["심각", "높음", "보통", "낮음"].includes(o.riskLevel) ? o.riskLevel : "보통";
    return {
      riskLevel: lvl,
      summary: String(o.summary ?? ""),
      prioritized: Array.isArray(o.prioritized)
        ? o.prioritized.slice(0, 5).map((p: any) => ({
            id: String(p.id ?? ""),
            name: String(p.name ?? ""),
            impact: String(p.impact ?? ""),
            fix: String(p.fix ?? ""),
          }))
        : [],
      topAction: String(o.topAction ?? ""),
    };
  } catch {
    return null;
  }
}

export async function analyzeWithAI(result: ScanResult): Promise<AiInsight | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });

  const s = result.summary;
  const list =
    result.vulnerabilities
      .map((v) => `- [${v.severity}] ${v.id} ${v.name} (${v.category}) @ ${v.location}: ${v.description}`)
      .join("\n") || "(발견된 취약점 없음)";
  const user = `스캔 대상: ${result.target}\n엔진: ${result.engine}\n심각도 요약: Critical ${s.critical} / High ${s.high} / Medium ${s.medium} / Low ${s.low}\n\n발견된 취약점:\n${list}`;

  // 일시적 API 과부하/타임아웃 대비 최대 2회 시도
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await client.messages.create({
        model,
        max_tokens: 1200,
        system: SYSTEM,
        messages: [{ role: "user", content: user }],
      });
      const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = parse(text);
      if (parsed) return parsed;
    } catch (e: any) {
      console.error(`[ai-analysis] 시도 ${attempt} 실패:`, e?.message ?? e);
    }
  }
  return null;
}
