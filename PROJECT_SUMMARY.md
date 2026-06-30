# GEO Analyzer + AutoSec Scanner — 프로젝트 작업 정리

> 최종 정리일: 2026-07-01
> 라이브: https://geo-analyzer-brown.vercel.app · 저장소: https://github.com/CM-jccho/geo-analyzer

---

## 1. 개요

Obsidian 볼트에 **기획만 있던 `GEO-Analyzer`** 프로젝트를, 실제로 동작하는 Next.js 웹 서비스로 구현하고 Vercel에 배포했다. 이후 같은 앱에 **AutoSec Scanner(보안 취약점 스캐너)** 기능까지 추가했다.

| 제품 | 한 줄 정의 | AI 연동 | 라이브 |
|---|---|---|---|
| **GEO Analyzer** | URL을 넣으면 AI(ChatGPT·Claude 등)가 그 사이트를 어떻게 보는지 진단 | ✅ Claude 실제 호출 | ✅ |
| **AutoSec Scanner** | URL/GitHub 저장소의 보안 취약점(OWASP Top 10) 진단 | ❌ (Trivy/ZAP 또는 mock) | ⚠️ 프로덕션 mock |

---

## 2. GEO Analyzer

### 핵심 기능
- **진단 파이프라인** (100점 만점)
  - Crawl(G-01): HTML·robots.txt·sitemap·llms.txt·본문 추출
  - Tech(40점): HTTPS·AI크롤러·Schema·sitemap·meta·OG·canonical·llms.txt·H1
  - Content(30점): **Claude**가 팩트 밀도·인용 가능 문장·명료성 평가
  - Multi-LLM(30점): **Claude/GPT/Perplexity/Gemini**로 브랜드 인식·예측 가능성 측정
  - Report: 영역별 즉시 개선 액션 TOP 5
- **랜딩 페이지**: Hero("AI는 당신 브랜드를 알고 있나요?"), SEO→AEO→GEO 진화, GEO 5단계 성숙도 모델
- **결과 공유**: `/result/[jobId]` 페이지 + 링크 복사 (KV 연동 시 영속)

### 비즈니스 모델 (가치 사다리)
| 단계 | 상품 | 가격(런칭 세일) | 역할 |
|---|---|---|---|
| 1 | Free 진단 | ₩0 | 리드 생성 |
| 2 | Pro 구독 | ~~₩39,000~~ **₩19,000/월** | DIY |
| 3 | **적용 대행** | ~~₩300,000~~ **₩199,000~/건** | 핵심 수익 |
| 4 | 관리 리테이너 | ~~₩900,000~~ **₩690,000~/월** | 반복 수익 |

- **진단 → 자동 견적**: 실패 항목을 서비스 패키지에 매핑해 "현재 70점 → 목표 92점" 견적 자동 산출
- **문의 폼 → 메일 발송**: 이메일·전화·내용을 `jaechul.cho@gmail.com`으로 SMTP(Gmail) 발송 (실발송 확인)

### 인프라
- **레이트리밋**: 분석 10분 5회 / 문의 10분 3회 (초과 429)
- **잡 큐**: BullMQ(Redis) ↔ 인메모리 폴백, Vercel은 동기 분석(maxDuration 60초)
- **KV 영속화**: 결과 공유 링크 저장(TTL 30일) — KV 연동 시 동작

---

## 3. AutoSec Scanner (`/security`)

### 핵심 기능
- **입력**: URL 스캔(DAST) / GitHub 저장소(SAST) 탭
- **스캔 엔진** (서비스 레이어 분리)
  - `mock`(기본/프로덕션): OWASP Top 10 기반 결정적 모의 결과
  - `real`(`SCANNER_MODE=real`): **Trivy**(SAST) / **OWASP ZAP**(DAST)
- **대시보드**(다크모드): 심각도 요약 카드 + Recharts 도넛 차트 + 취약점 리스트(위치·설명·해결방안)
- **결과 공유**: `/scan/[id]` 리포트 페이지 + 링크 복사 (KV 연동 시 영속)
- **플랜별 1일 한도**: Free 3 / Pro 50 / Enterprise 1000회 (`x-plan-key` 헤더)

### AI 연동 여부
- 현재 **AI 미연동**. 취약점 탐지는 전용 엔진(Trivy/ZAP)이 정석.
- (후속) 탐지=엔진, **해석·우선순위·수정코드 생성=Claude** 레이어 추가 가능.

---

## 4. 기술 스택

- **Frontend**: Next.js 14.2.35(App Router), TypeScript, Tailwind CSS, Recharts
- **Backend**: Next.js API Routes(Node.js), BullMQ + ioredis, Cheerio
- **AI/LLM**: @anthropic-ai/sdk(Claude) + OpenAI/Perplexity/Gemini REST
- **메일**: nodemailer(Gmail SMTP)
- **보안 엔진(real)**: Trivy 0.72, OWASP ZAP REST
- **저장/제한**: Vercel KV(Upstash) ↔ 인메모리 폴백
- **배포**: Vercel + GitHub 자동 배포

---

## 5. 배포 현황

- **저장소**: https://github.com/CM-jccho/geo-analyzer (public)
- **라이브**: https://geo-analyzer-brown.vercel.app
- **자동 배포**: GitHub 연결됨 → push 시 자동 배포 (토큰 불필요)
- **환경변수(프로덕션)**: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `SMTP_HOST/PORT/USER/PASS`
- **미설정(선택)**: `KV_REST_API_*`(공유 영속), `SCANNER_MODE=real`(실제 스캔), `PRO_PLAN_KEYS`(플랜)

---

## 6. 검증 결과 (실측)

| 항목 | 결과 |
|---|---|
| GEO 분석(라이브) | anthropic.com **70/100**, 실제 Claude 콘텐츠분석·노출테스트 동작 |
| 문의 메일 | `delivered: true` — jaechul.cho@gmail.com 실발송 |
| BullMQ/Redis | 소스 빌드 Redis로 4개 잡 큐 처리 확인 |
| 레이트리밋 | 한도 초과 시 429 |
| 실제 Trivy 스캔 | package-lock.json에서 **실제 CVE 23건** 탐지(파서 일치) |
| 플랜 분기 | Free/Pro 한도·잔여 횟수 정상 |
| 빌드/타입체크 | 전부 통과, 자동 배포 완료 |

---

## 7. 후속 마무리 작업 (To-Do)

### A. 곧바로 가능 (코드 준비됨 / API 호출)
1. **Vercel KV 연동** — 대시보드에서 KV(Upstash) 생성·연결 → 결과/스캔 공유 링크 영속화 + 정확한 레이트리밋. (코드 완료, 프로비저닝만 필요)
2. **보안 스캐너 AI 분석 레이어** — Claude로 취약점 우선순위화·맞춤 수정코드·자연어 리포트 생성. Vercel에서 바로 동작.
3. **리드/문의 알림 연동** — 문의·상담 접수 시 Telegram/Slack 실시간 알림(`/api/contact`, `/api/lead`의 TODO).

### B. 별도 인프라 필요
4. **보안 스캐너 실제 엔진 워커** — Docker(Trivy + ZAP)로 워커 구성, `SCANNER_MODE=real`. (Vercel 서버리스는 엔진 실행 불가)
5. **결제 연동** — Toss Payments/Stripe로 Pro 구독·적용 대행 결제.
6. **실제 인증** — NextAuth/Clerk + DB. 현재 `x-plan-key`(키→플랜)를 실제 계정·구독으로 교체.

### C. 운영·품질
7. **커스텀 도메인** — Vercel Domains에 보유 도메인 연결.
8. **분석 비용 통제** — Free 진단 LLM 캐싱/2종 제한으로 API 비용 관리.
9. **결과 공유 영속화 일관화** — GEO 결과(`/result`)·스캔(`/scan`) 모두 KV 기반으로 통일.

### D. 보안 점검 (중요)
10. **노출된 자격증명 폐기·재발급** — 진행 중 채팅에 노출된 **Vercel 토큰**, **Gmail 앱 비밀번호**, **Anthropic API 키**는 모두 폐기 후 재발급 권장.
    - Vercel 토큰: https://vercel.com/account/tokens → Revoke
    - Gmail 앱 비밀번호: https://myaccount.google.com/apppasswords → 삭제 후 재발급 → Vercel `SMTP_PASS` 갱신
    - Anthropic 키: 공개 사이트에 사용 중이므로 사용량 모니터링 또는 제한 키로 교체
