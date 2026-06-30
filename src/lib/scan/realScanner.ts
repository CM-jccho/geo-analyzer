import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ScanResult, ScanType, Vulnerability, Severity } from "./types";

const execFileP = promisify(execFile);

// 실제 스캔 엔진 연동 (SCANNER_MODE=real 일 때 사용).
// SAST: Trivy (repo/fs scan), DAST: OWASP ZAP REST API.
// 주의: 실제 활성 스캔(DAST)은 "스캔 권한이 있는 타깃"에만 수행해야 한다.

function normalizeSeverity(s: string): Severity {
  const u = (s || "").toUpperCase();
  if (u === "CRITICAL") return "Critical";
  if (u === "HIGH") return "High";
  if (u === "MEDIUM") return "Medium";
  return "Low";
}

function summarize(vulns: Vulnerability[]) {
  const s = { critical: 0, high: 0, medium: 0, low: 0, total: vulns.length };
  for (const v of vulns) {
    if (v.severity === "Critical") s.critical++;
    else if (v.severity === "High") s.high++;
    else if (v.severity === "Medium") s.medium++;
    else s.low++;
  }
  return s;
}

// ── SAST: Trivy ────────────────────────────────────────────────
// target이 GitHub URL이면 `trivy repo`, 로컬 경로면 `trivy fs`.
export async function trivyScan(target: string): Promise<ScanResult> {
  const bin = process.env.TRIVY_BIN || "trivy";
  const subcmd = /^https?:\/\//i.test(target) ? "repo" : "fs";
  const { stdout } = await execFileP(
    bin,
    [subcmd, "--quiet", "--scanners", "vuln,secret,misconfig", "--format", "json", target],
    { maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
  );
  const data = JSON.parse(stdout);

  const vulns: Vulnerability[] = [];
  let i = 0;
  for (const result of data.Results ?? []) {
    const where = result.Target ?? target;
    for (const v of result.Vulnerabilities ?? []) {
      vulns.push({
        id: `TRIVY-${++i}`,
        name: `${v.VulnerabilityID} · ${v.PkgName}`,
        severity: normalizeSeverity(v.Severity),
        category: "A06:2021 취약한 구성요소",
        location: `${where} (${v.PkgName}@${v.InstalledVersion})`,
        description: (v.Title || v.Description || "").slice(0, 300),
        remediation: v.FixedVersion ? `${v.FixedVersion} 이상으로 업그레이드` : "패치 버전 확인 후 업그레이드",
      });
    }
    for (const m of result.Misconfigurations ?? []) {
      vulns.push({
        id: `TRIVY-${++i}`,
        name: m.Title || m.ID,
        severity: normalizeSeverity(m.Severity),
        category: "A05:2021 보안 설정 오류",
        location: `${where}:${m.CauseMetadata?.StartLine ?? "?"}`,
        description: (m.Description || "").slice(0, 300),
        remediation: m.Resolution || "권장 설정으로 수정",
      });
    }
    for (const sec of result.Secrets ?? []) {
      vulns.push({
        id: `TRIVY-${++i}`,
        name: `Hardcoded Secret · ${sec.RuleID}`,
        severity: normalizeSeverity(sec.Severity),
        category: "A07:2021 식별·인증 실패",
        location: `${where}:${sec.StartLine}`,
        description: sec.Title || "소스에 시크릿이 노출되어 있습니다.",
        remediation: "시크릿을 제거·교체하고 환경변수/시크릿 매니저로 분리하세요.",
      });
    }
  }

  return {
    target,
    type: "repo",
    engine: "Trivy",
    scannedAt: new Date().toISOString(),
    summary: summarize(vulns),
    vulnerabilities: vulns,
  };
}

// ── DAST: OWASP ZAP REST API ───────────────────────────────────
// 환경변수: ZAP_API_URL(예: http://localhost:8090), ZAP_API_KEY
export async function zapScan(target: string): Promise<ScanResult> {
  const api = process.env.ZAP_API_URL;
  const key = process.env.ZAP_API_KEY ?? "";
  if (!api) throw new Error("ZAP_API_URL이 설정되지 않았습니다.");

  const call = async (path: string, params: Record<string, string>) => {
    const qs = new URLSearchParams({ apikey: key, ...params }).toString();
    const res = await fetch(`${api}${path}?${qs}`);
    if (!res.ok) throw new Error(`ZAP ${path} ${res.status}`);
    return res.json();
  };

  // 1) Spider → 2) Active Scan (실제로는 완료까지 폴링 필요, 여기선 핵심 호출만)
  await call("/JSON/spider/action/scan/", { url: target });
  await call("/JSON/ascan/action/scan/", { url: target });
  // 3) Alerts 수집
  const alerts = (await call("/JSON/core/view/alerts/", { baseurl: target })) as { alerts?: any[] };

  const riskMap: Record<string, Severity> = { High: "High", Medium: "Medium", Low: "Low", Informational: "Low" };
  const vulns: Vulnerability[] = (alerts.alerts ?? []).map((a: any, i: number) => ({
    id: `ZAP-${i + 1}`,
    name: a.alert || a.name,
    severity: a.risk === "High" && a.confidence === "High" ? "Critical" : riskMap[a.risk] ?? "Low",
    category: a.cweid ? `CWE-${a.cweid}` : "OWASP",
    location: a.url || target,
    description: (a.description || "").slice(0, 300),
    remediation: (a.solution || "").slice(0, 300),
  }));

  return {
    target,
    type: "url",
    engine: "OWASP ZAP",
    scannedAt: new Date().toISOString(),
    summary: summarize(vulns),
    vulnerabilities: vulns,
  };
}

export async function runRealScan(type: ScanType, target: string): Promise<ScanResult> {
  return type === "url" ? zapScan(target) : trivyScan(target);
}
