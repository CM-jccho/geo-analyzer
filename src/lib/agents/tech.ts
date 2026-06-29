import type { CrawlResult, Check } from "../types";

// Tech Agent — Level 1 기술 진단 (V1: 40점 만점)
// AI 엔진이 사이트를 참조할 수 있는 "기술적 준비 상태"를 점검한다.

export function runTechAgent(crawl: CrawlResult): { checks: Check[]; score: number; max: number } {
  const checks: Check[] = [];

  // 1) HTTPS (4점)
  checks.push({
    id: "https",
    label: "HTTPS 보안 연결",
    passed: crawl.https,
    weight: 4,
    detail: crawl.https ? "HTTPS로 서비스됩니다." : "HTTP로 서비스되어 신뢰도와 크롤링에 불리합니다.",
    fix: crawl.https ? undefined : "SSL 인증서를 적용하고 모든 트래픽을 HTTPS로 리다이렉트하세요.",
  });

  // 2) AI 크롤러 허용 (robots.txt) (8점)
  const blocked = crawl.robotsTxt.aiCrawlersBlocked;
  const aiAllowed = blocked.length === 0;
  checks.push({
    id: "ai-crawlers",
    label: "AI 크롤러 접근 허용",
    passed: aiAllowed,
    weight: 8,
    detail: aiAllowed
      ? "GPTBot·ClaudeBot 등 주요 AI 크롤러를 차단하지 않습니다."
      : `AI 크롤러 차단 감지: ${blocked.join(", ")}. 차단 시 AI가 콘텐츠를 학습/인용할 수 없습니다.`,
    fix: aiAllowed ? undefined : "robots.txt에서 AI 크롤러의 Disallow: / 규칙을 제거하세요.",
    codeExample: aiAllowed
      ? undefined
      : `# robots.txt — AI 크롤러 허용 예시\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: ClaudeBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /`,
  });

  // 3) Schema.org 구조화 데이터 (8점)
  checks.push({
    id: "schema",
    label: "Schema.org 구조화 데이터(JSON-LD)",
    passed: crawl.hasJsonLd,
    weight: 8,
    detail: crawl.hasJsonLd
      ? `JSON-LD 발견: ${crawl.jsonLdTypes.join(", ") || "타입 미상"}`
      : "구조화 데이터가 없어 AI가 브랜드/서비스 정보를 정확히 파악하기 어렵습니다.",
    fix: crawl.hasJsonLd ? undefined : "Organization·Product 등 핵심 엔터티에 JSON-LD를 추가하세요.",
    codeExample: crawl.hasJsonLd
      ? undefined
      : `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "Organization",\n  "name": "브랜드명",\n  "url": "https://example.com",\n  "description": "한 문장 서비스 설명",\n  "sameAs": ["https://twitter.com/...", "https://www.linkedin.com/..."]\n}\n</script>`,
  });

  // 4) Sitemap (4점)
  checks.push({
    id: "sitemap",
    label: "sitemap.xml 제공",
    passed: crawl.sitemap.found,
    weight: 4,
    detail: crawl.sitemap.found ? `사이트맵 확인: ${crawl.sitemap.url}` : "sitemap.xml이 없어 크롤러가 전체 페이지를 발견하기 어렵습니다.",
    fix: crawl.sitemap.found ? undefined : "sitemap.xml을 생성하고 robots.txt에 Sitemap: 경로를 명시하세요.",
  });

  // 5) Meta description (3점)
  checks.push({
    id: "meta-description",
    label: "메타 설명(description)",
    passed: !!crawl.metaDescription,
    weight: 3,
    detail: crawl.metaDescription ? "메타 설명이 존재합니다." : "메타 설명이 없어 AI 요약 인용에 불리합니다.",
    fix: crawl.metaDescription ? undefined : "각 페이지에 50~160자의 명확한 메타 설명을 추가하세요.",
  });

  // 6) Open Graph (3점)
  checks.push({
    id: "open-graph",
    label: "Open Graph 메타데이터",
    passed: crawl.hasOpenGraph,
    weight: 3,
    detail: crawl.hasOpenGraph ? "Open Graph 태그가 있습니다." : "og: 태그가 없어 브랜드 식별 신호가 약합니다.",
    fix: crawl.hasOpenGraph ? undefined : "og:title·og:description·og:site_name 등을 추가하세요.",
  });

  // 7) Canonical URL (3점)
  checks.push({
    id: "canonical",
    label: "Canonical URL",
    passed: !!crawl.canonical,
    weight: 3,
    detail: crawl.canonical ? "정규 URL이 지정되어 중복 콘텐츠 혼란을 줄입니다." : "canonical 링크가 없어 AI가 대표 페이지를 판단하기 어렵습니다.",
    fix: crawl.canonical ? undefined : '<link rel="canonical" href="..."> 를 추가하세요.',
  });

  // 8) llms.txt (4점) — 신흥 GEO 표준
  checks.push({
    id: "llms-txt",
    label: "llms.txt 제공",
    passed: crawl.llmsTxt,
    weight: 4,
    detail: crawl.llmsTxt
      ? "llms.txt로 AI에게 핵심 정보를 우선 제공합니다."
      : "llms.txt가 없습니다. AI 친화 요약을 제공하면 인용 가능성이 높아집니다.",
    fix: crawl.llmsTxt ? undefined : "사이트 루트에 /llms.txt를 추가해 브랜드·핵심 페이지·요약을 명시하세요.",
    codeExample: crawl.llmsTxt
      ? undefined
      : `# /llms.txt 예시\n# 브랜드명\n> 한 문장 서비스 설명\n\n## 핵심 페이지\n- [제품](https://example.com/product): 설명\n- [요금](https://example.com/pricing): 설명`,
  });

  // 9) H1 제목 (3점)
  checks.push({
    id: "h1",
    label: "H1 제목 존재",
    passed: crawl.h1.length > 0,
    weight: 3,
    detail: crawl.h1.length > 0 ? `H1: "${crawl.h1[0]}"` : "H1이 없어 페이지 주제 신호가 약합니다.",
    fix: crawl.h1.length > 0 ? undefined : "페이지당 명확한 H1을 1개 두세요.",
  });

  const max = checks.reduce((s, c) => s + c.weight, 0); // = 40
  const score = checks.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  return { checks, score, max };
}
