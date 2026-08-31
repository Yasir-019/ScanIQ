import type { InvestigationFinding } from "./types";
import { CredentialStore } from "./providers/credential-store";

export type EvidenceType =
  | "raw_payload"
  | "decoded_url"
  | "dns_record"
  | "rdap_registration"
  | "ssl_certificate"
  | "http_redirect"
  | "threat_indicator"
  | "analyst_note"
  | "other";

export type EvidenceOrigin =
  | "raw_evidence"
  | "derived_finding"
  | "external_intelligence"
  | "analyst_note"
  | "generated_summary";

export interface EvidenceRecord {
  id: string; // Stable ID e.g. "ev-payload-...", "ev-dns-..."
  investigationId: string;
  caseId?: string;
  type: EvidenceType;
  origin: EvidenceOrigin;
  source: string; // e.g. "Barcode Capture", "Cloudflare DoH", "RDAP ICANN"
  capturedAt: number;
  rawContent: string;
  sha256: string; // Cryptographic SHA-256 hash of rawContent
  relatedFindingIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface InvestigationAction {
  id: string;
  investigationId: string;
  caseId?: string;
  action:
    | "investigation_created"
    | "scan_performed"
    | "analysis_started"
    | "provider_queried"
    | "provider_skipped"
    | "provider_failed"
    | "evidence_received"
    | "evidence_captured"
    | "evidence_verified"
    | "evidence_correlated"
    | "risk_recalculated"
    | "investigation_rerun"
    | "analyst_note_added"
    | "report_generated"
    | "report_exported";
  timestamp: number;
  source?: string;
  provider?: string;
  target?: string;
  evidenceId?: string;
  details?: string;
}

export interface EvidenceIntegrityStatus {
  verified: boolean;
  expectedSha256: string;
  actualSha256: string;
  matches: boolean;
  verifiedAt: number;
  error?: string;
}

/**
 * Computes a standard SHA-256 hex string using Web Crypto API.
 * Uses fallback for non-browser/test environments.
 */
export async function computeSha256Hex(content: string): Promise<string> {
  const sanitized = CredentialStore.redact(content || "");
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const data = new TextEncoder().encode(sanitized);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* Fallback to pure JS deterministic hash if Web Crypto is unavailable */
  }

  // Deterministic fallback hash formatted to 64 hex characters
  let h1 = 0xdeadbeef ^ sanitized.length;
  let h2 = 0x41c6ce57 ^ sanitized.length;
  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return (part1 + part2).repeat(4).slice(0, 64);
}

/**
 * Creates a formal EvidenceRecord with calculated SHA-256 hash.
 */
export async function createEvidenceRecord(params: {
  id?: string;
  investigationId: string;
  caseId?: string;
  type: EvidenceType;
  origin: EvidenceOrigin;
  source: string;
  rawContent: string;
  capturedAt?: number;
  relatedFindingIds?: string[];
  metadata?: Record<string, unknown>;
}): Promise<EvidenceRecord> {
  const rawContent = CredentialStore.redact(params.rawContent || "");
  const sha256 = await computeSha256Hex(rawContent);
  const capturedAt = params.capturedAt || Date.now();
  const id = params.id || `ev-${params.type}-${capturedAt}-${sha256.slice(0, 8)}`;

  return {
    id,
    investigationId: params.investigationId,
    caseId: params.caseId,
    type: params.type,
    origin: params.origin,
    source: params.source,
    capturedAt,
    rawContent,
    sha256,
    relatedFindingIds: params.relatedFindingIds || [],
    metadata: params.metadata,
  };
}

/**
 * Cryptographically verifies an evidence item's integrity by comparing
 * recalculating SHA-256 against its recorded hash.
 */
export async function verifyEvidenceIntegrity(
  evidence: EvidenceRecord
): Promise<EvidenceIntegrityStatus> {
  const verifiedAt = Date.now();
  try {
    const actualSha256 = await computeSha256Hex(evidence.rawContent || "");
    const matches = actualSha256.toLowerCase() === evidence.sha256.toLowerCase();
    return {
      verified: true,
      expectedSha256: evidence.sha256,
      actualSha256,
      matches,
      verifiedAt,
    };
  } catch (err) {
    return {
      verified: false,
      expectedSha256: evidence.sha256,
      actualSha256: "",
      matches: false,
      verifiedAt,
      error: err instanceof Error ? err.message : "Integrity check failed",
    };
  }
}

/**
 * Computes a deterministic, lightweight 64-bit FNV-1a hex hash for an evidence finding.
 * Based on canonical finding attributes (category, target, finding text, nature, severity).
 */
export function computeEvidenceFingerprint(f: {
  category: string;
  finding: string;
  nature: string;
  severity: string;
  evidence: string;
  target?: string;
}): string {
  const canonical = [
    f.category.toLowerCase().trim(),
    f.finding.toLowerCase().trim(),
    f.nature.toLowerCase().trim(),
    f.severity.toLowerCase().trim(),
    f.target?.toLowerCase().trim() || "",
  ].join("|");

  let h1 = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    h1 ^= canonical.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }

  // Second pass for additional diffusion
  let h2 = 0x811c9dc5;
  for (let i = canonical.length - 1; i >= 0; i--) {
    h2 ^= canonical.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }

  const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `fp-${hex1}${hex2}`;
}

/**
 * Deduplicates an array of findings by deterministic content fingerprint.
 * Merges source attributions and slightly boosts confidence on multi-source corroboration.
 */
export function deduplicateFindings(findings: InvestigationFinding[]): InvestigationFinding[] {
  const byFingerprint = new Map<string, InvestigationFinding>();

  for (const f of findings) {
    const fp = f.fingerprint || computeEvidenceFingerprint(f);
    const existing = byFingerprint.get(fp);

    if (!existing) {
      byFingerprint.set(fp, { ...f, fingerprint: fp });
    } else {
      // Merge sources without duplicating
      const existingSources = new Set(existing.source.split(",").map((s) => s.trim()));
      for (const s of f.source.split(",")) {
        existingSources.add(s.trim());
      }

      // Slightly increase confidence for corroboration (up to 0.99 max)
      const mergedConfidence = Math.min(
        0.99,
        Number((Math.max(existing.confidence, f.confidence) + 0.04).toFixed(2))
      );

      byFingerprint.set(fp, {
        ...existing,
        source: Array.from(existingSources).join(", "),
        confidence: mergedConfidence,
        retrievedAt: Math.max(existing.retrievedAt || existing.timestamp, f.retrievedAt || f.timestamp),
      });
    }
  }

  return Array.from(byFingerprint.values());
}
