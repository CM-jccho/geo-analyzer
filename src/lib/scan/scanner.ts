import type { ScanResult, ScanType, Vulnerability, Severity } from "./types";

// AutoSec Scanner — 스캔 서비스 레이어
// ─────────────────────────────────────────────────────────────────────────
// MVP는 검증된 Mock 데이터를 반환한다. 실제 운영에서는 아래 runRealScan()의
// 주석 뼈대처럼 검증된 오픈소스 엔진을 호출한다(직접 해킹 엔진 개발 금지):
//   - DAST(url):  OWASP ZAP (zap-api-scan / ZAP REST API)
//   - SAST(repo): Trivy (fs/repo scan), SonarQube, Semgrep
// 무거운 스캔은 작업 큐(BullMQ)에 등록해 Worker에서 비동기 실행한다.
// ─────────────────────────────────────────────────────────────────────────

// OWASP Top 10 / API Security 기반 취약점 카탈로그
const DAST_CATALOG: Omit<Vulnerability, "id" | "location">[] = [
  { name: "SQL Injection", severity: "Critical", category: "A03:2021 Injection", description: "사용자 입력이 SQL 쿼리에 직접 삽입되어 DB 조작·유출이 가능합니다.", remediation: "파라미터라이즈드 쿼리(Prepared Statement)와 ORM 바인딩을 사용하고 입력을 검증하세요." },
  { name: "Cross-Site Scripting (XSS)", severity: "High", category: "A03:2021 Injection", description: "악성 스크립트가 페이지에 반영되어 사용자 세션 탈취가 가능합니다.", remediation: "출력 인코딩, CSP 헤더 적용, 사용자 입력 sanitize를 적용하세요." },
  { name: "Broken Object Level Authorization (BOLA)", severity: "High", category: "API1:2023", description: "객체 ID 조작으로 타 사용자 리소스에 접근할 수 있습니다.", remediation: "모든 객체 접근에 소유권/권한 검증을 서버에서 강제하세요." },
  { name: "Security Misconfiguration", severity: "Medium", category: "A05:2021", description: "디버그 모드 노출, 불필요한 서비스 활성화 등 설정 미흡이 발견됐습니다.", remediation: "프로덕션 하드닝(디버그 off, 기본 계정 제거, 최소 권한)을 적용하세요." },
  { name: "Missing Security Headers (HSTS/CSP)", severity: "Medium", category: "A05:2021", description: "HSTS·CSP·X-Frame-Options 등 보안 헤더가 누락되었습니다.", remediation: "Strict-Transport-Security, Content-Security-Policy 등 보안 헤더를 추가하세요." },
  { name: "Missing Rate Limiting", severity: "Low", category: "API4:2023", description: "엔드포인트에 요청 제한이 없어 무차별 대입·자원 고갈에 취약합니다.", remediation: "IP/사용자별 레이트리밋과 백오프를 적용하세요." },
  { name: "Cross-Site Request Forgery (CSRF)", severity: "Medium", category: "A01:2021", description: "상태 변경 요청에 CSRF 토큰 검증이 없습니다.", remediation: "CSRF 토큰 또는 SameSite 쿠키를 적용하세요." },
];

const SAST_CATALOG: Omit<Vulnerability, "id" | "location">[] = [
  { name: "Hardcoded Secret", severity: "Critical", category: "A07:2021", description: "소스에 API 키/비밀번호가 하드코딩되어 있습니다.", remediation: "환경변수·시크릿 매니저로 분리하고 노출된 키는 즉시 폐기·교체하세요." },
  { name: "Vulnerable Dependency", severity: "High", category: "A06:2021", description: "알려진 CVE가 있는 구버전 의존성을 사용 중입니다.", remediation: "취약 패키지를 패치 버전으로 업그레이드하고 SCA를 CI에 통합하세요." },
  { name: "Insecure Deserialization", severity: "High", category: "A08:2021", description: "신뢰할 수 없는 데이터의 역직렬화로 원격 코드 실행 위험이 있습니다.", remediation: "역직렬화 대상을 검증·화이트리스트화하고 안전한 포맷을 사용하세요." },
  { name: "Path Traversal", severity: "High", category: "A01:2021", description: "파일 경로에 사용자 입력이 사용되어 임의 파일 접근이 가능합니다.", remediation: "경로 정규화·화이트리스트 검증을 적용하세요." },
  { name: "Weak Cryptography", severity: "Medium", category: "A02:2021", description: "MD5/SHA1 등 취약한 해시·암호화를 사용 중입니다.", remediation: "bcrypt/argon2, AES-GCM 등 권장 알고리즘으로 교체하세요." },
  { name: "Verbose Error Logging", severity: "Low", category: "A09:2021", description: "스택 트레이스·민감정보가 로그/응답에 노출됩니다.", remediation: "에러 메시지를 일반화하고 민감정보 로깅을 제거하세요." },
];

// 타깃 문자열 기반 결정적 의사난수 (재스캔 시 동일 결과, 타깃별로는 다른 결과)
function seed(str: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSummary(vulns: Vulnerability[]) {
  const s = { critical: 0, high: 0, medium: 0, low: 0, total: vulns.length };
  for (const v of vulns) {
    if (v.severity === "Critical") s.critical++;
    else if (v.severity === "High") s.high++;
    else if (v.severity === "Medium") s.medium++;
    else s.low++;
  }
  return s;
}

function locationFor(type: ScanType, name: string, rnd: () => number): string {
  if (type === "url") {
    const paths = ["/api/login", "/api/users/{id}", "/search?q=", "/checkout", "/admin", "/api/orders/{id}"];
    return paths[Math.floor(rnd() * paths.length)];
  }
  const files = ["src/config.ts", "src/lib/db.ts", "package.json", "src/api/handler.js", "src/utils/crypto.ts"];
  return files[Math.floor(rnd() * files.length)] + `:${Math.floor(rnd() * 200) + 1}`;
}

// MVP Mock 스캔 — 타깃에 따라 취약점 부분집합을 선택해 반환
export function runMockScan(type: ScanType, target: string): ScanResult {
  const rnd = seed(`${type}:${target}`);
  const catalog = type === "url" ? DAST_CATALOG : SAST_CATALOG;
  const vulnerabilities: Vulnerability[] = catalog
    .filter(() => rnd() > 0.35) // 일부만 발견된 것으로
    .map((v, i) => ({ ...v, id: `VULN-${i + 1}`, location: locationFor(type, v.name, rnd) }));

  return {
    target,
    type,
    engine: type === "url" ? "OWASP ZAP (mock)" : "Trivy (mock)",
    scannedAt: new Date().toISOString(),
    summary: buildSummary(vulnerabilities),
    vulnerabilities,
  };
}

// 진입점 — SCANNER_MODE=real 이면 실제 엔진(Trivy/ZAP), 아니면 Mock.
// 실제 엔진은 바이너리/데몬이 필요하므로(서버리스 불가) 기본은 mock.
export async function runScan(type: ScanType, target: string): Promise<ScanResult> {
  if (process.env.SCANNER_MODE === "real") {
    const { runRealScan } = await import("./realScanner");
    return runRealScan(type, target);
  }
  return runMockScan(type, target);
}

/*
// ── 실제 엔진 연동 뼈대 (프로덕션) ──────────────────────────────────────
// 큐(BullMQ) Worker에서 호출하며, 결과를 정규화해 ScanResult로 매핑한다.
async function runRealScan(type: ScanType, target: string): Promise<ScanResult> {
  if (type === "url") {
    // DAST: OWASP ZAP REST API
    //   POST {ZAP_API}/JSON/spider/action/scan?url=<target>
    //   POST {ZAP_API}/JSON/ascan/action/scan?url=<target>
    //   GET  {ZAP_API}/JSON/core/view/alerts → severity/리스크 매핑
    // const alerts = await zap.core.alerts({ baseurl: target });
    // return normalizeZap(alerts);
  } else {
    // SAST: Trivy (repo/fs 스캔)
    //   $ trivy repo --format json <github-url>   (또는 trivy fs <path>)
    //   결과 JSON의 Vulnerabilities[] → Severity 매핑
    // const out = await execTrivy(["repo", "--format", "json", target]);
    // return normalizeTrivy(JSON.parse(out));
  }
  throw new Error("real scanner not configured");
}
*/
