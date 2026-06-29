# 배포 가이드 (Vercel)

리포지토리: https://github.com/CM-jccho/geo-analyzer

## 1. Vercel에 리포 연결
1. https://vercel.com/new 접속 → GitHub 계정(CM-jccho) 연결
2. `geo-analyzer` 리포 **Import**
3. Framework: Next.js 자동 감지 → 그대로 **Deploy**

## 2. 환경변수 설정 (Vercel → Project → Settings → Environment Variables)

| 변수 | 값 | 필수 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic 키 | 분석(콘텐츠·AI노출)에 필요 |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | 선택 |
| `SMTP_HOST` | `smtp.gmail.com` | 문의 메일 발송 |
| `SMTP_PORT` | `465` | 문의 메일 발송 |
| `SMTP_USER` | `jaechul.cho@gmail.com` | 문의 메일 발송 |
| `SMTP_PASS` | Gmail **앱 비밀번호**(아래) | 문의 메일 발송 |
| `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` / `GEMINI_API_KEY` | 각 키 | 선택(LLM 추가) |

> 환경변수 추가 후 **Redeploy** 해야 반영됩니다.

## 3. Gmail 앱 비밀번호 발급 (SMTP_PASS)
1. https://myaccount.google.com/security → **2단계 인증** 켜기
2. https://myaccount.google.com/apppasswords → 앱 이름(예: "GEO Analyzer") 입력 → 생성
3. 생성된 16자리(공백 제거) 비밀번호를 `SMTP_PASS`에 입력

문의 폼 제출 시 입력한 이메일·전화번호·내용이 **jaechul.cho@gmail.com** 으로 발송됩니다.
(회신 주소는 문의자 이메일로 설정되어 있어, 받은 메일에서 바로 답장하면 문의자에게 갑니다.)

## 4. 변경 자동 배포 (권장) — GitHub 연동
현재는 CLI로 배포돼 있어 `git push`가 자동 배포되지 않습니다. 한 번만 연결하면 이후 푸시마다 자동 배포됩니다.
1. Vercel → 프로젝트 `geo-analyzer` → **Settings → Git → Connect Git Repository** → `CM-jccho/geo-analyzer` 선택
2. 연결 후 **Redeploy**(또는 다음 push)부터 자동 반영

## 5. 결과 공유 영속화 (Vercel KV)
공유 링크(`/result/:id`)를 서버 재시작/인스턴스와 무관하게 유지하려면 KV가 필요합니다.
1. Vercel → **Storage → Create Database → KV (Upstash Redis)** 생성
2. 해당 프로젝트에 **Connect** → `KV_REST_API_URL`, `KV_REST_API_TOKEN` 자동 주입
3. **Redeploy**. 이후 분석 결과가 30일간 저장되고 공유 링크가 영속됩니다.
   (레이트리밋도 KV가 있으면 인스턴스 간 공유되어 더 정확해집니다.)

## 6. 레이트리밋 한도 (선택, env)
| 변수 | 기본 | 설명 |
|---|---|---|
| `ANALYZE_RATE_LIMIT` / `ANALYZE_RATE_WINDOW` | 5 / 600 | 10분당 분석 5회 |
| `CONTACT_RATE_LIMIT` / `CONTACT_RATE_WINDOW` | 3 / 600 | 10분당 문의 3회 |

## 7. 커스텀 도메인
1. Vercel → 프로젝트 → **Settings → Domains → Add** → 보유 도메인 입력
2. 안내되는 DNS 레코드(A/CNAME)를 도메인 등록업체에 추가 → 검증되면 자동 HTTPS

## 동작 메모
- Vercel(서버리스)에서는 분석이 **동기 실행**(요청 1건에 결과 반환, 최대 60초)됩니다. — `VERCEL` 환경변수로 자동 분기.
- 로컬/상시서버에서는 큐(인메모리, REDIS_URL 있으면 BullMQ) + 폴링 방식으로 동작합니다.
- 결과 공유 링크(`/result/:id`)는 인메모리 저장이라 서버리스에서는 영속되지 않습니다. 영속 공유가 필요하면 Vercel KV/Upstash로 jobStore를 교체하세요.
