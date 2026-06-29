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

## 동작 메모
- Vercel(서버리스)에서는 분석이 **동기 실행**(요청 1건에 결과 반환, 최대 60초)됩니다. — `VERCEL` 환경변수로 자동 분기.
- 로컬/상시서버에서는 큐(인메모리, REDIS_URL 있으면 BullMQ) + 폴링 방식으로 동작합니다.
- 결과 공유 링크(`/result/:id`)는 인메모리 저장이라 서버리스에서는 영속되지 않습니다. 영속 공유가 필요하면 Vercel KV/Upstash로 jobStore를 교체하세요.
