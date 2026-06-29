import Anthropic from "@anthropic-ai/sdk";
import type { CrawlResult, ContentAnalysis } from "../types";

// Content Agent (V1) — 본문 콘텐츠가 "AI가 인용하기 좋은" 형태인지 평가한다 (30점 만점).
// 세 축: 팩트 밀도 / 인용 가능 문장 / 명료성 (각 0~10).
// ANTHROPIC_API_KEY가 없으면 skip(분모 제외).

const SYSTEM = `당신은 GEO(생성형 엔진 최적화) 콘텐츠 품질 평가자입니다.
주어진 웹페이지 본문이 "AI가 답변 생성 시 인용하기 좋은 콘텐츠"인지 평가합니다.
세 가지 축을 각각 0~10점으로 채점합니다:
- factDensity(팩트 밀도): 구체적 수치·정의·고유명사 등 인용 가능한 사실의 밀도
- citableSentences(인용 가능 문장): 한 문장만 떼어내도 의미가 완결되는 자족적 문장의 비율
- clarity(명료성): 구조·용어·문장이 명확해 AI가 오해 없이 요약할 수 있는 정도
반드시 아래 JSON만 출력하세요(코드블록/설명 금지):
{"factDensity":0-10,"citableSentences":0-10,"clarity":0-10,"summary":"한 문장 총평","strengths":["..."],"weaknesses":["..."]}`;

function parse(text: string): Omit<ContentAnalysis, "status"> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const clamp = (n: any) => Math.max(0, Math.min(10, Math.round(Number(n) || 0)));
    return {
      factDensity: clamp(o.factDensity),
      citableSentences: clamp(o.citableSentences),
      clarity: clamp(o.clarity),
      summary: String(o.summary ?? ""),
      strengths: Array.isArray(o.strengths) ? o.strengths.map(String).slice(0, 5) : [],
      weaknesses: Array.isArray(o.weaknesses) ? o.weaknesses.map(String).slice(0, 5) : [],
    };
  } catch {
    return null;
  }
}

const SKIPPED: ContentAnalysis = {
  status: "skipped",
  factDensity: 0,
  citableSentences: 0,
  clarity: 0,
  summary: "ANTHROPIC_API_KEY가 없어 콘텐츠 분석을 건너뛰었습니다.",
  strengths: [],
  weaknesses: [],
};

export async function runContentAgent(crawl: CrawlResult): Promise<{ content: ContentAnalysis; score: number; max: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { content: SKIPPED, score: 0, max: 0 };
  if (!crawl.bodyText || crawl.wordCount < 30) {
    return {
      content: { ...SKIPPED, status: "error", summary: "본문 텍스트가 충분치 않아 분석할 수 없습니다." },
      score: 0,
      max: 0,
    };
  }

  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const client = new Anthropic({ apiKey });

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `브랜드: ${crawl.brand}\n제목: ${crawl.title ?? "(없음)"}\n\n본문:\n${crawl.bodyText}`,
        },
      ],
    });
    const text = resp.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const parsed = parse(text);
    if (!parsed) return { content: { ...SKIPPED, status: "error", summary: "콘텐츠 분석 응답 파싱 실패." }, score: 0, max: 0 };

    const score = parsed.factDensity + parsed.citableSentences + parsed.clarity; // 0~30
    return { content: { status: "ok", ...parsed }, score, max: 30 };
  } catch (e: any) {
    return {
      content: { ...SKIPPED, status: "error", summary: `콘텐츠 분석 오류: ${e?.message ?? e}` },
      score: 0,
      max: 0,
    };
  }
}
