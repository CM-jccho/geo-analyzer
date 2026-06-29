import * as cheerio from "cheerio";
import type { CrawlResult } from "../types";

// G-01 Crawl Agent (범용 / 도메인 독립)
// 사전 도메인 지식 없이, 입력 URL을 첫 방문처럼 크롤링한다.

const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

const UA = "Mozilla/5.0 (compatible; GEOAnalyzerBot/0.1; +https://geo-analyzer.local)";

async function fetchText(
  url: string,
  timeoutMs = 12000,
): Promise<{ ok: boolean; status: number; text: string; finalUrl: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text, finalUrl: res.url || url };
  } finally {
    clearTimeout(timer);
  }
}

async function exists(url: string, validate?: (t: string) => boolean): Promise<boolean> {
  try {
    const r = await fetchText(url, 6000);
    return r.ok && (validate ? validate(r.text) : true);
  } catch {
    return false;
  }
}

function normalizeUrl(input: string): string {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

function parseRobots(robotsTxt: string): { blocked: string[]; allowed: string[] } {
  const blocked: string[] = [];
  const allowed: string[] = [];
  const blocks = robotsTxt.split(/\n(?=user-agent:)/i);
  for (const ua of AI_CRAWLERS) {
    const block = blocks.find((b) => new RegExp(`user-agent:\\s*${ua}`, "i").test(b));
    if (!block) continue;
    const disallowAll = /disallow:\s*\/\s*$/im.test(block) || /disallow:\s*\/\s*\n/im.test(block);
    if (disallowAll) blocked.push(ua);
    else allowed.push(ua);
  }
  return { blocked, allowed };
}

export async function runCrawlAgent(rawUrl: string): Promise<CrawlResult> {
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;

  const page = await fetchText(url);
  const $ = cheerio.load(page.text);

  const title = $("title").first().text().trim() || null;
  const metaDescription = $('meta[name="description"]').attr("content")?.trim() || null;
  const canonical = $('link[rel="canonical"]').attr("href")?.trim() || null;
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim();
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  const hasOpenGraph = $('meta[property^="og:"]').length > 0;

  const h1 = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .slice(0, 5);

  const headingOutline = $("h1, h2, h3")
    .map((_, el) => `${el.tagName.toUpperCase()}: ${$(el).text().trim()}`)
    .get()
    .filter((t) => t.length < 120)
    .slice(0, 30);

  const jsonLdTypes: string[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).contents().text());
      const arr = Array.isArray(data) ? data : [data];
      for (const node of arr) {
        const t = node?.["@type"];
        if (typeof t === "string") jsonLdTypes.push(t);
        else if (Array.isArray(t)) jsonLdTypes.push(...t.filter((x) => typeof x === "string"));
      }
    } catch {
      /* 무효 JSON-LD 무시 */
    }
  });

  // 본문 텍스트 추출(콘텐츠 분석용): 비콘텐츠 요소 제거 후 main/article 우선
  $("script, style, noscript, nav, footer, header, svg").remove();
  const main = $("main").text() || $("article").text() || $("body").text();
  const bodyText = main.replace(/\s+/g, " ").trim().slice(0, 6000);
  const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;

  // 브랜드 추정(짧은 비일반 세그먼트)
  const GENERIC = /^(home|home page|about|welcome|index|main|홈|메인|소개)$/i;
  const guessBrand = (s: string): string => {
    const parts = s
      .split(/[|\\/\-–·•]/)
      .map((p) => p.trim())
      .filter(Boolean);
    const named = parts.filter((p) => !GENERIC.test(p));
    const pool = named.length ? named : parts;
    return pool.sort((a, b) => a.length - b.length)[0] ?? s.trim();
  };
  const domain = new URL(url).hostname.replace(/^www\./, "");
  const brand = ogSiteName || (ogTitle && guessBrand(ogTitle)) || (title && guessBrand(title)) || domain;

  // robots.txt
  let robots: CrawlResult["robotsTxt"] = { found: false, aiCrawlersBlocked: [], aiCrawlersAllowed: [] };
  try {
    const r = await fetchText(`${origin}/robots.txt`, 6000);
    if (r.ok && /user-agent/i.test(r.text)) {
      const parsed = parseRobots(r.text);
      robots = { found: true, aiCrawlersBlocked: parsed.blocked, aiCrawlersAllowed: parsed.allowed };
    }
  } catch {
    /* 없음 */
  }

  const [sitemapFound, llmsTxt] = await Promise.all([
    exists(`${origin}/sitemap.xml`, (t) => /<(urlset|sitemapindex)/i.test(t)),
    exists(`${origin}/llms.txt`),
  ]);

  const category =
    [title, metaDescription, $('meta[property="og:type"]').attr("content"), h1[0]]
      .filter(Boolean)
      .join(" ")
      .slice(0, 300)
      .trim() || null;

  return {
    finalUrl: page.finalUrl,
    https: page.finalUrl.startsWith("https://"),
    brand,
    title,
    metaDescription,
    canonical,
    h1,
    headingOutline,
    hasJsonLd: jsonLdTypes.length > 0,
    jsonLdTypes: Array.from(new Set(jsonLdTypes)),
    hasOpenGraph,
    llmsTxt,
    category,
    bodyText,
    wordCount,
    robotsTxt: robots,
    sitemap: { found: sitemapFound, url: sitemapFound ? `${origin}/sitemap.xml` : null },
  };
}
