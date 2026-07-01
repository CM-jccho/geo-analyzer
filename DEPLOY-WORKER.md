# 실제 스캔 엔진 워커 배포 (B4)

Vercel(서버리스)은 Trivy/ZAP 실행이 불가하므로, **실제 스캔은 별도 서버/워커**에서 처리한다.
웹(Vercel)은 스캔 잡을 Redis 큐에 등록하고, 워커가 소비해 Trivy/ZAP로 실행 후 결과를 KV에 저장한다.

```
[Web/Vercel] --enqueue--> [Redis(BullMQ)] --consume--> [Worker(Trivy/ZAP)] --save--> [KV] <--poll-- [Web]
```

## 구성 요소
- `src/lib/scan/scanQueue.ts` — 웹의 큐 등록 (SCAN_QUEUE=1 + REDIS_URL)
- `worker/scanWorker.ts` — BullMQ `geo-scan` 큐 소비 워커 (`npm run worker`)
- `Dockerfile.worker` — Trivy 포함 워커 이미지
- `docker-compose.worker.yml` — redis + ZAP 데몬 + 워커

## 로컬 실행 (Docker)
```bash
docker compose -f docker-compose.worker.yml up --build
```

## 필수 환경변수 (웹 + 워커 공통)
| 변수 | 설명 |
|---|---|
| `SCAN_QUEUE=1` | 웹이 스캔을 큐로 비동기 처리 |
| `REDIS_URL` | 큐용 Redis |
| `SCANNER_MODE=real` | 실제 엔진 사용 (워커) |
| `TRIVY_BIN` | Trivy 경로 (Docker 이미지엔 포함) |
| `ZAP_API_URL` / `ZAP_API_KEY` | DAST용 ZAP 데몬 |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | **웹↔워커 결과 공유(필수)** |

## 동작 확인 (로컬, Docker 없이)
1. Redis 실행 → `REDIS_URL=... npm run worker`
2. `SCAN_QUEUE=1 REDIS_URL=... npm run dev`
3. `POST /api/scan` → `202 { scanId, status:"queued" }` → 워커 로그에 처리 기록
4. 웹은 `/api/scan/:id/status` 폴링(결과 회수엔 KV 필요)

> 검증됨: enqueue → BullMQ → 워커 소비 → 스캔 실행까지 로컬 확인 완료.
