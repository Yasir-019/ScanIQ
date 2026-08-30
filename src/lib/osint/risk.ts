import type {
  InvestigationReport,
  InvestigationStatus,
  OsintFinding,
  PayloadAnalysis,
  ReputationResult,
  RiskEvidence,
  RiskLevel,
  RiskScoreSummary,
  ScanContentType,
  ScanFormat,
  ScanRecord,
  UrlPayloadSummary,
} from "@/lib/scan/types";
import { parseScanContent } from "@/lib/scan/parser";
import { validateWebUrl } from "@/lib/scan/security";
import { analyzeUrlSafety } from "@/lib/url-safety";

const RISK_NUMERIC: Record<RiskLevel, number> = {
  unknown: 0,
  benign: 5,
  low: 30,
  medium: 55,
  high: 80,
  critical: 95,
};

export function riskLevelToNumeric(level: RiskLevel): number {
  return RISK_NUMERIC[level] ?? 0;
}

export function numericToRiskLevel(n: number): RiskLevel {
  if (n < 5) return "unknown";
  if (n < 25) return "benign";
  if (n < 45) return "low";
  if (n < 70) return "medium";
  if (n < 90) return "high";
  return "critical";
}

export function summarizeRiskLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return numericToRiskLevel(Math.max(riskLevelToNumeric(a), riskLevelToNumeric(b)));
}

export function emptyUrlPayload(): UrlPayloadSummary {
  return {
    scheme: "",
    domain: "",
    fqdn: "",
    subdomains: [],
    tld: "",
    path: "",
    query: "",
    fragment: "",
    isIdn: false,
    isIp: false,
    isShortlinkLike: false,
  };
}

export function parseUrlPayload(raw: string): UrlPayloadSummary | null {
  try {
    const u = new URL(raw.startsWith("http") ? raw : `http://${raw}`);
    const hostname = u.hostname;
    const isIp =
      /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.startsWith("[");
    const puny = /xn--/.test(hostname);
    const parts = hostname.split(".");
    const tld = parts.length >= 2 ? parts[parts.length - 1] : "";
    const domain = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : hostname;
    const subdomains = parts.slice(0, -2);
    const shortTlds = ["t.ly", "bit.ly", "ow.ly", "cutt.ly", "tinyurl", "tiktok", "x.com", "t.co"];
    const isShortlinkLike =
      hostname.length <= 10 || shortTlds.some((s) => hostname.includes(s));
    return {
      scheme: u.protocol.replace(":", ""),
      domain,
      fqdn: hostname,
      subdomains,
      tld,
      port: u.port ? Number(u.port) : undefined,
      path: u.pathname,
      query: u.search,
      fragment: u.hash,
      isIdn: puny,
      isIp,
      isShortlinkLike,
    };
  } catch {
    return null;
  }
}

const SHORT_LINK_DOMAINS = new Set([
  "bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "is.gd", "buff.ly", "adf.ly",
  "cutt.ly", "t.ly", "rb.gy", "clck.ru", "shorte.st", "b.link", "lnkd.in", "fb.me",
  "g.co", "aka.ms", "s.id", "snip.ly", "linktr.ee", "campsite.bio",
]);

export function looksLikeShortLink(fqdn: string): boolean {
  const host = fqdn.toLowerCase();
  if (SHORT_LINK_DOMAINS.has(host)) return true;
  return SHORT_LINK_DOMAINS.has(host.split(".").slice(-2).join("."));
}

export function shannonEntropy(s: string): number {
  if (!s) return 0;
  const len = s.length;
  const freq = new Map<string, number>();
  for (const c of s) freq.set(c, (freq.get(c) ?? 0) + 1);
  let e = 0;
  for (const [, count] of freq) {
    const p = count / len;
    e -= p * Math.log2(p);
  }
  return e;
}

export function analyzePayload(raw: string): PayloadAnalysis {
  const anomalies: string[] = [];
  const hasCredentialsEmbedded = /^[a-z][a-z0-9+.-]*:\/\/[^\s:@]+:[^\s:@]+@/i.test(raw);
  if (hasCredentialsEmbedded) anomalies.push("embedded-credentials");
  const ipMatches = raw.match(/(?:\d{1,3}\.){3}\d{1,3}/g);
  const hasIps = !!ipMatches;
  if (hasIps) anomalies.push("ip-address-present");
  const hasPercentEncoding = (raw.match(/%[0-9a-fA-F]{2}/g)?.length ?? 0) > 8;
  const hasCharcodeEscapes = /\\x[0-9a-fA-F]{2}|\\u[0-9a-fA-F]{4}/.test(raw);
  const hasBase64Block = raw.length > 120 && /[A-Za-z0-9+/]{80,}={0,2}/.test(raw);
  const hasObfuscation = hasPercentEncoding || hasCharcodeEscapes || hasBase64Block;
  if (hasObfuscation) anomalies.push("obfuscated");
  const dangerousProtocols = /^(javascript:|data:|vbscript:|file:|mhtml:|ms-|ms-excel:|ms-word:)/i.test(raw);
  if (dangerousProtocols) anomalies.push("dangerous-protocol");
  if (raw.length > 1000) anomalies.push("oversized-payload");
  const entropy = shannonEntropy(raw.substring(0, 800));
  if (entropy > 5.6) anomalies.push("high-entropy");
  return {
    hasCredentialsEmbedded,
    hasIps,
    hasObfuscation,
    usesDangerousProtocol: dangerousProtocols,
    size: raw.length,
    entropy,
    anomalies,
  };
}

export function emptyRiskSummary(): RiskScoreSummary {
  return {
    overall: "unknown",
    numeric: 0,
    confidence: 0,
    verdict: "Pending analysis",
    explanation: "No evidence collected yet. Enable intelligence sources or run investigation.",
    evidence: [],
  };
}

export function summarizeUrlSafetyAsRisk(raw: string): RiskScoreSummary {
  const urlCheck = analyzeUrlSafety(raw);
  const evidences: RiskEvidence[] = [];
  let maxSev: RiskLevel = "unknown";
  let confSum = 0;
  let confCount = 0;

  const add = (
    source: string,
    title: string,
    description: string,
    severity: RiskLevel,
    confidence: number,
    fields?: RiskEvidence["fields"],
  ) => {
    evidences.push({
      id: `${source}-${evidences.length}`,
      source,
      title,
      description,
      severity,
      confidence,
      fields,
      discoveredAt: Date.now(),
    });
    maxSev = summarizeRiskLevel(maxSev, severity);
    confSum += confidence;
    confCount += 1;
  };

  add(
    "local-url-safety",
    "Local safety heuristic",
    `URL classified as ${urlCheck.level} by deterministic heuristics.`,
    urlCheck.level === "malicious"
      ? "high"
      : urlCheck.level === "suspicious"
        ? "medium"
        : urlCheck.level === "safe"
          ? "benign"
          : "unknown",
    0.6,
    { level: urlCheck.level },
  );
  for (const reason of urlCheck.reasons) {
    add("local-url-safety-flag", "heuristic-flag", reason, "medium", 0.5, {
      reason,
    });
  }
  const numeric = evidences.length
    ? Math.min(100, RISK_NUMERIC[maxSev] + evidences.filter((e) =>
        ["high", "critical"].includes(e.severity)).length * 4)
    : 0;
  const confidence = confCount ? confSum / confCount : 0;
  return {
    overall: numericToRiskLevel(numeric),
    numeric,
    confidence,
    verdict: urlCheck.reasons.length ? urlCheck.reasons.join(", ") : "No significant threats identified.",
    explanation: `Aggregated ${evidences.length} evidence items.`,
    evidence: evidences,
  };
}

export function aggregateEvidence(
  base: RiskScoreSummary,
  extras: RiskEvidence[],
): RiskScoreSummary {
  const evidence = [...base.evidence, ...extras];
  let maxSev: RiskLevel = base.overall;
  let confSum = base.confidence * base.evidence.length;
  let confCount = base.evidence.length;
  for (const e of extras) {
    maxSev = summarizeRiskLevel(maxSev, e.severity);
    confSum += e.confidence;
    confCount += 1;
  }
  const negatives = evidence.filter((e) => e.severity === "benign").length;
  const positives = evidence.filter((e) =>
    ["medium", "high", "critical"].includes(e.severity)).length;
  const numerator = positives * 9 + negatives * 0.4 + base.numeric * 0.3;
  const numeric = Math.min(100, Math.round(Math.min(100, numerator)));
  const confidence = confCount ? Math.min(1, confSum / confCount + 0.05) : 0;
  return {
    overall: numericToRiskLevel(numeric),
    numeric,
    confidence,
    verdict:
      positives === 0 && negatives >= 2
        ? "Consistent benign evidence"
        : positives >= 3
          ? "Multiple high-severity indicators"
          : positives >= 1
            ? "Adverse indicators present"
            : "Mixed or insufficient evidence",
    explanation: `Aggregated ${evidence.length} evidence items (${positives} adverse, ${negatives} benign).`,
    evidence,
  };
}

export function emptyInvestigationReport(opts: {
  id: string;
  caseId: string;
  sourceScanId: string;
  content: string;
  type: ScanContentType;
  format: ScanFormat;
}): InvestigationReport {
  const parsed = parseScanContent(opts.content, opts.format);
  const payload = analyzePayload(opts.content);
  const urls: UrlPayloadSummary[] = [];
  if (opts.type === "url") {
    const p = parseUrlPayload(opts.content);
    if (p) urls.push(p);
  } else if (parsed?.data && typeof parsed.data === "object") {
    const d = parsed.data as Record<string, unknown>;
    for (const k of ["url", "href", "link", "redirect"]) {
      const v = d[k];
      if (typeof v === "string") {
        const up = parseUrlPayload(v);
        if (up) urls.push(up);
      }
    }
  }
  const domains = Array.from(new Set(urls.map((u) => u.domain).filter(Boolean)));
  const hosts = Array.from(new Set(urls.map((u) => u.fqdn).filter(Boolean)));
  const safety = summarizeUrlSafetyAsRisk(
    validateWebUrl(opts.content) ? opts.content : "about:blank",
  );
  const findings: OsintFinding[] = [];
  if (payload.anomalies.includes("embedded-credentials")) {
    findings.push({
      id: `finding-creds-${opts.id}`,
      kind: "embedded-credentials",
      title: "Credentials embedded in URL",
      summary:
        "The scanned payload includes embedded username/password. These are often used in credential-harvesting attacks as fake login pre-fills.",
      severity: "high",
      confidence: 0.9,
      references: ["local-payload-analysis"],
    });
  }
  if (payload.usesDangerousProtocol) {
    findings.push({
      id: `finding-proto-${opts.id}`,
      kind: "dangerous-protocol",
      title: "Dangerous URL scheme detected",
      summary:
        "Schemes like javascript: or data: execute inside user agents and are routinely used in quishing payloads.",
      severity: "critical",
      confidence: 0.95,
      references: ["local-payload-analysis"],
    });
  }
  return {
    id: opts.id,
    caseId: opts.caseId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "pending",
    sourceScanId: opts.sourceScanId,
    rawContent: opts.content,
    contentType: opts.type,
    format: opts.format,
    targets: {
      urls,
      domains,
      hosts,
      phoneNumbers: [],
      emails: [],
      productCodes: opts.type === "product" ? [opts.content.replace(/\D/g, "")] : [],
    },
    payloadAnalysis: payload,
    urlSafetySnapshot: safety,
    domainIntel: {
      nameservers: [],
      dns: [],
      statuses: [],
      whoisRedacted: false,
    },
    hostIntel: [],
    reputation: [],
    findings,
    finalRisk: aggregateEvidence(safety, []),
    intelligenceFlags: {
      whoisEnabled: false,
      rdapEnabled: false,
      dnsEnabled: false,
      asnEnabled: false,
      geoEnabled: false,
      certEnabled: false,
      redirectEnabled: false,
      reputationEnabled: false,
      userControlled: true,
    },
  };
}

export function investigationFromScan(
  scan: ScanRecord,
  caseId?: string,
): InvestigationReport {
  const invId = `inv-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  const resCaseId = caseId ?? `case-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
  return emptyInvestigationReport({
    id: invId,
    caseId: resCaseId,
    sourceScanId: scan.id,
    content: scan.content,
    type: scan.type,
    format: scan.format,
  });
}

export function applyReputationFindings(
  rep: ReputationResult[],
  existingReport: InvestigationReport,
): InvestigationReport {
  const extras: RiskEvidence[] = [];
  const findings: OsintFinding[] = [...existingReport.findings];
  for (const r of rep) {
    const severity: RiskLevel =
      r.classification === "malicious"
        ? "high"
        : r.classification === "suspicious"
          ? "medium"
          : r.classification === "clean"
            ? "benign"
            : "unknown";
    extras.push({
      id: `rep-${r.source}-${existingReport.id}`,
      source: r.source,
      title: `${r.source} reputation: ${r.classification}`,
      description: r.threats.length
        ? r.threats.join(", ")
        : r.categories.join(", ") || "No detail",
      severity,
      confidence: r.confidence ?? 0.6,
      fields: {
        scope: r.scope,
        score: r.score,
        categories: r.categories,
        threats: r.threats,
        url: r.detailsUrl,
      },
      discoveredAt: Date.now(),
    });
    if (r.classification === "malicious") {
      findings.push({
        id: `finding-rep-${r.source}-${existingReport.id}`,
        kind: "blocklist-hit",
        title: `Blocklist hit: ${r.source}`,
        summary: `${r.source} classifies this ${r.scope} as malicious.`,
        severity: "high",
        confidence: r.confidence ?? 0.7,
        references: [r.source],
      });
    }
  }
  const finalRisk = aggregateEvidence(existingReport.urlSafetySnapshot, extras);
  return {
    ...existingReport,
    reputation: [...existingReport.reputation, ...rep],
    finalRisk,
    findings,
    updatedAt: Date.now(),
  };
}

export function setInvestigationStatus(
  r: InvestigationReport,
  status: InvestigationStatus,
): InvestigationReport {
  return { ...r, status, updatedAt: Date.now() };
}

export function scanTypeLabel(t: ScanContentType): string {
  switch (t) {
    case "url": return "URL / Link";
    case "wifi": return "Wi-Fi Network";
    case "vcard": return "Contact (vCard)";
    case "email": return "Email";
    case "sms": return "SMS";
    case "phone": return "Phone";
    case "geo": return "Geolocation";
    case "product": return "Product Code (GTIN/UPC/EAN)";
    case "payment": return "Payment Payload";
    case "text": return "Plain Text";
  }
}
