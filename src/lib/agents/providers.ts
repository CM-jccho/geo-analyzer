import Anthropic from "@anthropic-ai/sdk";

// LLM 프로바이더 추상화 — 키가 있는 프로바이더만 활성화된다.
// 각 프로바이더는 (system, user) → 텍스트 응답을 반환한다.

export interface LlmProvider {
  name: string;
  model: string;
  ask(system: string, user: string): Promise<string>;
}

const TIMEOUT = 20000;

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(data).slice(0, 120)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function getProviders(): LlmProvider[] {
  const providers: LlmProvider[] = [];

  if (process.env.ANTHROPIC_API_KEY) {
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    providers.push({
      name: "Claude",
      model,
      async ask(system, user) {
        const r = await client.messages.create({
          model,
          max_tokens: 256,
          system,
          messages: [{ role: "user", content: user }],
        });
        return r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      },
    });
  }

  if (process.env.OPENAI_API_KEY) {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    providers.push({
      name: "GPT",
      model,
      async ask(system, user) {
        const d = await postJson(
          "https://api.openai.com/v1/chat/completions",
          { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          { model, max_tokens: 256, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
        );
        return d.choices?.[0]?.message?.content ?? "";
      },
    });
  }

  if (process.env.PERPLEXITY_API_KEY) {
    const model = process.env.PERPLEXITY_MODEL || "sonar";
    providers.push({
      name: "Perplexity",
      model,
      async ask(system, user) {
        const d = await postJson(
          "https://api.perplexity.ai/chat/completions",
          { authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}` },
          { model, messages: [{ role: "system", content: system }, { role: "user", content: user }] },
        );
        return d.choices?.[0]?.message?.content ?? "";
      },
    });
  }

  if (process.env.GEMINI_API_KEY) {
    const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    providers.push({
      name: "Gemini",
      model,
      async ask(system, user) {
        const d = await postJson(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {},
          {
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
          },
        );
        return d.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      },
    });
  }

  return providers;
}
