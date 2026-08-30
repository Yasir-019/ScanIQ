import type { InvestigationFinding } from "./types";

export interface InvestigationAction {
  id: string;
  investigationId: string;
  action:
    | "investigation_created"
    | "scan_performed"
    | "analysis_started"
    | "provider_queried"
    | "provider_skipped"
    | "provider_failed"
    | "evidence_received"
    | "evidence_correlated"
    | "risk_recalculated"
    | "investigation_rerun"
    | "report_generated"
    | "report_exported";
  timestamp: number;
  provider?: string;
  target?: string;
  details?: string;
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
