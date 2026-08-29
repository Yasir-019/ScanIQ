/**
 * Offline analyzer registry + explainable risk scoring.
 *
 * The current implementation wraps the existing local URL heuristics
 * (`src/lib/url-safety.ts`) and adds structural artifact analysis. New
 * analyzers should be pure functions added to `ANALYZERS`.
 */

import { analyzeUrlSafety } from "@/lib/url-safety";
import type {
  Analyzer,
  Artifact,
  Finding,
  FindingSeverity,
  Investigation,
  RiskScore,
  Verdict,
} from "./types";
import type { ScanFormat, ScanContentType } from "@/lib/scan/types";

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  info: 0,
  low: 8,
  medium: 20,
  high: 35,
  critical: 60,
};

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());

export function buildArtifact(
  raw: string,
  format: ScanFormat,
  type: ScanContentType,
  parsed?: Record<string, unknown>,
): Artifact {
  const artifact: Artifact = { raw, format, type, parsed };
  if (type === "url") {
    try {
      const u = new URL(raw.trim());
      const host = u.hostname.toLowerCase();
      const labels = host.split(".");
      artifact.url = {
        scheme: u.protocol.replace(":", ""),
        host,
        port: u.port || undefined,
        path: u.pathname,
        query: Object.fromEntries(u.searchParams.entries()),
        registrableDomain: labels.slice(-2).join("."),
        isIpHost: /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.startsWith("["),
        isPunycode: host.startsWith("xn--") || host.includes(".xn--"),
      };
    } catch {
      /* not parseable as URL */
    }
  }
  return artifact;
}

/** Maps the legacy heuristic reasons into structured findings. */
const urlHeuristics: Analyzer = {
  id: "url-heuristics",
  appliesTo: ["url", "payment"],
  run(artifact) {
    const result = analyzeUrlSafety(artifact.raw);
    return result.reasons.map((reason) => {
      const lower = reason.toLowerCase();
      const critical =
        lower.includes("dangerous protocol") ||
        lower.includes("embedded credentials") ||
        lower.includes("impersonation") ||
        lower.includes("official site");
      const category = lower.includes("http")
        ? "transport"
        : lower.includes("impersonation") || lower.includes("official site")
          ? "identity"
          : lower.includes("shortened")
            ? "obfuscation"
            : lower.includes("credential")
              ? "credential"
              : "infrastructure";
      return {
        id: newId(),
        analyzer: "url-heuristics",
        category,
        severity: (critical ? "high" : "medium") as FindingSeverity,
        title: reason,
        rationale:
          "Local heuristic pattern matched against the scanned link. No data left the device.",
        evidence: artifact.url?.host ?? artifact.raw.slice(0, 120),
      } as Finding;
    });
  },
};

/** Structural notes about the payload itself. */
const payloadStructure: Analyzer = {
  id: "payload-structure",
  run(artifact) {
    const findings: Finding[] = [];
    const raw = artifact.raw;

    if (raw.length > 1200) {
      findings.push({
        id: newId(),
        analyzer: "payload-structure",
        category: "metadata",
        severity: "info",
        title: "Unusually large payload",
        rationale:
          "Large payloads can hide additional instructions or encoded data beyond what a human reads.",
        evidence: `${raw.length} characters`,
      });
    }

    if (/%[0-9a-f]{2}/i.test(raw) && (raw.match(/%[0-9a-f]{2}/gi)?.length ?? 0) > 8) {
      findings.push({
        id: newId(),
        analyzer: "payload-structure",
        category: "obfuscation",
        severity: "low",
        title: "Heavily percent-encoded content",
        rationale: "Encoding is often used to hide the true destination or payload from the reader.",
      });
    }

    if (/^[A-Za-z0-9+/=]{80,}$/.test(raw.trim())) {
      findings.push({
        id: newId(),
        analyzer: "payload-structure",
        category: "obfuscation",
        severity: "medium",
        title: "Payload looks base64-encoded",
        rationale: "Base64 blobs in codes commonly carry hidden commands, tokens, or binary data.",
      });
    }

    if (/\b(?:powershell|cmd\.exe|bash -c|curl\s+-s|wget\s)/i.test(raw)) {
      findings.push({
        id: newId(),
        analyzer: "payload-structure",
        category: "payload",
        severity: "critical",
        title: "Shell command pattern detected",
        rationale: "The payload contains text resembling an executable command.",
        evidence: raw.slice(0, 120),
      });
    }

    return findings;
  },
};

/** Privacy signals: tracking parameters embedded in links. */
const trackingParams: Analyzer = {
  id: "tracking-params",
  appliesTo: ["url"],
  run(artifact) {
    const q = artifact.url?.query ?? {};
    const trackers = Object.keys(q).filter((k) =>
      /^(utm_|fbclid|gclid|msclkid|mc_eid|igshid|ref_?src)/i.test(k),
    );
    if (!trackers.length) return [];
    return [
      {
        id: newId(),
        analyzer: "tracking-params",
        category: "privacy",
        severity: "low",
        title: "Link contains tracking parameters",
        rationale:
          "These parameters let the destination correlate your visit with a campaign or profile.",
        evidence: trackers.join(", "),
      },
    ];
  },
};

export const ANALYZERS: Analyzer[] = [urlHeuristics, payloadStructure, trackingParams];

export function scoreFindings(findings: Finding[]): RiskScore {
  const contributions = findings.map((f) => ({
    findingId: f.id,
    weight: SEVERITY_WEIGHT[f.severity],
  }));
  const total = contributions.reduce((sum, c) => sum + c.weight, 0);
  const value = Math.min(100, total);

  let verdict: Verdict = "clean";
  if (findings.length === 0) verdict = "clean";
  else if (value >= 60) verdict = "malicious";
  else if (value >= 25) verdict = "suspicious";
  else if (value > 0) verdict = "notable";

  return { value, verdict, contributions };
}

/** Runs every applicable offline analyzer and returns a full investigation. */
export function investigate(artifact: Artifact): Investigation {
  const applicable = ANALYZERS.filter(
    (a) => !a.appliesTo || a.appliesTo.includes(artifact.type),
  );
  const findings = applicable.flatMap((a) => {
    try {
      return a.run(artifact);
    } catch {
      return [];
    }
  });

  return {
    id: newId(),
    artifact,
    findings,
    risk: scoreFindings(findings),
    analyzers: applicable.map((a) => a.id),
    analyzedAt: Date.now(),
    offlineOnly: true,
  };
}
