# GEO Analyzer (코드 / V1)

URL을 입력하면 AI 검색 엔진(ChatGPT·Claude·Perplexity·Gemini) 노출 준비 상태를 진단하는 서비스.

> 기획 문서: `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Project/GEO-Analyzer/`
> (코드는 iCloud 동기화 이슈를 피하기 위해 별도 위치)

## 스택
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- 크롤링: 네이티브 fetch + cheerio
- LLM: 프로바이더 추상화 (Claude / GPT / Perplexity / Gemini) — `@anthropic-ai/sdk` + fetch
- 잡 큐: BullMQ(Redis) ↔ 인메모리 자동 폴백

## 점수 체계 (100점)
- **기술 40점** — HTTPS, AI 크롤러 허용(robots.txt), Schema.org, sitemap, meta, OG, canonical, llms.txt, H1
- **콘텐츠 30점** — 팩트 밀도 / 인용 가능 문장 / 명료성 (Claude 분석)
- **AI 노출 30점** — 활성 LLM × 브랜드/카테고리/신뢰 쿼리 노출 매트릭스 + 예측 가능성(프로바이더 일관성)
- **즉시 액션 TOP 5** — 영역별(기술/콘텐츠/AI노출) 가중치 정렬 + 코드 예시
- 키가 없는 영역(콘텐츠·LLM)은 분모에서 제외되어 점수가 왜곡되지 않음

## 실행
```bash
npm install
cp .env.example .env    # 키 입력 (아래)
npm run dev             # http://localhost:3000
```

## 환경 변수 (.env)
| 변수 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY` | 콘텐츠 분석 + AI 노출(Claude). 없으면 두 단계 skip |
| `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` / `GEMINI_API_KEY` | 있는 것만 LLM 프로바이더로 자동 활성화 |
| `*_MODEL` | 각 프로바이더 모델 오버라이드 |
| `REDIS_URL` | 설정 시 BullMQ로 처리, 없으면 인메모리 |
| `GEO_CONCURRENCY` | BullMQ 워커 동시성 (기본 3) |

## API
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/analyze` | body `{ url }` → `{ jobId, queue }` (202) |
| GET | `/api/analyze/:jobId/status` | `{ status, progress, result, error }` |
| 페이지 | `/result/:jobId` | 공유용 결과 페이지 |

## 아키텍처 (Phase)
1. **Crawl** (`agents/crawl.ts`) → 2. **Tech** (`agents/tech.ts`) →
3. **Content** + **Multi-LLM** 병렬 (`agents/content.ts`, `agents/multiLlm.ts` + `providers.ts`) →
4. **Report** (`agents/report.ts`)
오케스트레이터 `lib/pipeline.ts`, 큐 `lib/queue.ts`, 잡 상태 `lib/jobStore.ts`

## 알려진 한계 / 다음 단계
- 잡 상태(jobStore)는 인메모리 → 멀티프로세스 워커/영속 공유는 Redis/DB 백엔드 전환 필요(서버 재시작 시 공유 링크 만료)
- LLM 인식 여부는 모델 자기평가 기반 **추정치**
- 단일 페이지 크롤(루트만) → 다중 페이지/사이트맵 순회는 후속
