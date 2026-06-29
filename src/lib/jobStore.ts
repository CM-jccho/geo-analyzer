import type { AnalyzeJob, JobStatus, AnalysisResult } from "./types";

// MVP: 인메모리 잡 스토어.
// 프로덕션 전환 시 이 모듈을 BullMQ(Redis) 기반 구현으로 교체한다 (02-기술/기술스택.md 참조).
// dev 모드 HMR에서 상태가 초기화되지 않도록 globalThis에 보관한다.

const store: Map<string, AnalyzeJob> =
  (globalThis as any).__geoJobStore ?? new Map<string, AnalyzeJob>();
(globalThis as any).__geoJobStore = store;

// 간단한 ID 생성기 (외부 의존 없이)
let counter = (globalThis as any).__geoJobCounter ?? 0;
function nextId(): string {
  counter += 1;
  (globalThis as any).__geoJobCounter = counter;
  return `geo_${counter.toString(36)}_${(counter * 2654435761 % 0xffffffff).toString(36)}`;
}

export function createJob(url: string): AnalyzeJob {
  const now = new Date().toISOString();
  const job: AnalyzeJob = {
    id: nextId(),
    url,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  store.set(job.id, job);
  return job;
}

export function getJob(id: string): AnalyzeJob | undefined {
  return store.get(id);
}

export function updateJob(
  id: string,
  patch: Partial<Pick<AnalyzeJob, "status" | "progress" | "error">> & {
    result?: AnalysisResult;
  },
): void {
  const job = store.get(id);
  if (!job) return;
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  store.set(id, job);
}

export const PROGRESS_BY_STATUS: Record<JobStatus, number> = {
  queued: 5,
  crawling: 20,
  diagnosing: 40,
  "content-analyzing": 55,
  "llm-testing": 80,
  scoring: 92,
  done: 100,
  error: 100,
};
