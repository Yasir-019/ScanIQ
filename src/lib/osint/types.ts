/**
 * Core OSINT / threat-intelligence domain model.
 *
 * Design rules:
 * - Every analyzer is pure, local, and offline by default.
 * - Every finding must be explainable: it carries evidence a human can audit.
 * - Nothing here performs network calls; enrichment providers are opt-in and
 *   implemented separately against the `IntelProvider` interface.
 */

import type { ScanContentType, ScanFormat } from "@/lib/scan/types";

/** Severity of an individual finding. */
export type FindingSeverity = "info" | "low" | "medium" | "high" | "critical";

/** Overall verdict for an analyzed artifact. */
export type Verdict = "clean" | "notable" | "suspicious" | "malicious" | "unknown";

/** Broad category used to group findings in the investigation report. */
export type FindingCategory =
  | "transport"      // http, mixed content, downgrade
  | "identity"       // brand impersonation, homograph, punycode
  | "obfuscation"    // shorteners, redirects, encoded payloads
  | "infrastructure" // IP hosts, odd ports, deep subdomains, suspicious TLDs
  | "payload"        // executable/script/data URIs, injection attempts
  | "credential"     // embedded credentials, login lures
  | "privacy"        // trackers, PII exposure in payload
  | "metadata";      // structural notes about the code itself

/** A single, auditable observation produced by an analyzer. */
export interface Finding {
  id: string;
  analyzer: string;
  category: FindingCategory;
  severity: FindingSeverity;
  /** Short human-readable statement of what was observed. */
  title: string;
  /** Why this matters, in plain language. */
  rationale: string;
  /** The exact substring / value the finding is based on. */
  evidence?: string;
  /** Optional external reference (MITRE, RFC, docs) for further reading. */
  reference?: string;
}

/** Normalized, decomposed view of the scanned payload. */
export interface Artifact {
  raw: string;
  format: ScanFormat;
  type: ScanContentType;
  /** Structured fields extracted by the content parser. */
  parsed?: Record<string, unknown>;
  /** URL decomposition when the artifact is a link. */
  url?: {
    scheme: string;
    host: string;
    port?: string;
    path: string;
    query: Record<string, string>;
    registrableDomain?: string;
    isIpHost: boolean;
    isPunycode: boolean;
  };
}

/** Weighted, explainable risk score. */
export interface RiskScore {
  /** 0-100. Higher means more risk. */
  value: number;
  verdict: Verdict;
  /** Per-finding contribution to the score, for transparency. */
  contributions: Array<{ findingId: string; weight: number }>;
}

/** The full result of analyzing one scanned artifact. */
export interface Investigation {
  id: string;
  artifact: Artifact;
  findings: Finding[];
  risk: RiskScore;
  /** Analyzers that ran, for reproducibility. */
  analyzers: string[];
  analyzedAt: number;
  /** True when only offline analyzers contributed. */
  offlineOnly: boolean;
}

/** A pure, offline analyzer. Must never perform I/O. */
export interface Analyzer {
  id: string;
  /** Content types this analyzer applies to; empty means "all". */
  appliesTo?: ScanContentType[];
  run(artifact: Artifact): Finding[];
}

/**
 * Optional, explicitly user-enabled enrichment source (e.g. a public
 * reputation API). Implementations MUST be opt-in, disclose what leaves the
 * device, and degrade gracefully when offline.
 */
export interface IntelProvider {
  id: string;
  label: string;
  /** What data is transmitted, shown to the user before enabling. */
  dataLeavingDevice: string;
  enrich(artifact: Artifact, signal?: AbortSignal): Promise<Finding[]>;
}
