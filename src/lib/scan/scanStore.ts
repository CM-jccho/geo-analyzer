import { kvAvailable, kvSet, kvGet } from "../kv";
import type { ScanResult } from "./types";

// 스캔 결과 영속 저장 (공유 리포트용). KV 있으면 저장/조회, 없으면 인메모리(같은 인스턴스).

const TTL_SEC = 60 * 60 * 24 * 30; // 30일
const mem: Map<string, ScanResult> = (globalThis as any).__geoScans ?? new Map();
(globalThis as any).__geoScans = mem;

let counter = (globalThis as any).__geoScanCounter ?? 0;
export function newScanId(): string {
  counter += 1;
  (globalThis as any).__geoScanCounter = counter;
  return `scan_${counter.toString(36)}_${((counter * 2654435761) % 0xffffffff).toString(36)}`;
}

export async function saveScan(id: string, result: ScanResult): Promise<void> {
  mem.set(id, result);
  if (kvAvailable()) {
    try {
      await kvSet(`geo:scan:${id}`, JSON.stringify(result), TTL_SEC);
    } catch (e: any) {
      console.error("[kv] 스캔 저장 실패:", e?.message ?? e);
    }
  }
}

export async function loadScan(id: string): Promise<ScanResult | null> {
  const local = mem.get(id);
  if (local) return local;
  if (kvAvailable()) {
    try {
      const v = await kvGet(`geo:scan:${id}`);
      return v ? (JSON.parse(v) as ScanResult) : null;
    } catch {
      return null;
    }
  }
  return null;
}
