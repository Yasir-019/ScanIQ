import type {
  InvestigationFinding,
} from "./types";
import type {
  ConflictingIntelligence,
  ProviderOpinion,
  TemporalFreshness,
} from "./synthesis-types";
import type { ProviderResult } from "./providers/types";

/**
 * Calculates temporal freshness category based on observation timestamp.
 */
export function evaluateFreshness(timestamp?: number): TemporalFreshness {
  if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
    return "unknown";
  }

  const now = Date.now();
  const elapsed = Math.max(0, now - timestamp);
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const thirtyDays = 30 * oneDay;

  if (elapsed < oneHour) return "current";
  if (elapsed < oneDay) return "recent";
  if (elapsed < thirtyDays) return "aging";
  return "historical";
}

export class IntelligenceSynthesizer {
  /**
   * Deduplicates findings from multiple providers that report identical facts,
   * merging multiple sources and boosting corroboration confidence.
   */
  public static deduplicateFindings(findings: InvestigationFinding[]): InvestigationFinding[] {
    const grouped = new Map<string, InvestigationFinding[]>();

    for (const f of findings) {
      // Normalize finding text to form canonical deduplication key
      const normalizedText = f.finding
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/https?:\/\//g, "")
        .trim();
      const key = `${f.category}:${normalizedText}`;

      const list = grouped.get(key) || [];
      list.push(f);
      grouped.set(key, list);
    }

    const deduplicated: InvestigationFinding[] = [];

    for (const group of grouped.values()) {
      if (group.length === 1) {
        deduplicated.push(group[0]);
        continue;
      }

      // Merge multiple identical findings
      const base = group[0];
      const allSources = Array.from(new Set(group.map((g) => g.source)));
      const highestSeverityFinding = group.reduce((prev, curr) => {
        const sevWeight: Record<string, number> = {
          critical: 5,
          high: 4,
          medium: 3,
          low: 2,
          informational: 1,
          unknown: 0,
        };
        return (sevWeight[curr.severity] ?? 0) > (sevWeight[prev.severity] ?? 0) ? curr : prev;
      }, base);

      // Independent multi-source corroboration slightly elevates confidence (max 0.99)
      const maxConfidence = Math.max(...group.map((g) => g.confidence));
      const boostedConfidence = Math.min(0.99, Number((maxConfidence + (allSources.length - 1) * 0.03).toFixed(2)));

      const earliestTimestamp = Math.min(...group.map((g) => g.timestamp));

      // Build composite metadata
      const mergedMetadata: Record<string, unknown> = {
        ...base.metadata,
        corroboratingSources: allSources,
        observationCount: group.length,
      };

      deduplicated.push({
        ...highestSeverityFinding,
        id: `dedup-${base.id}`,
        source: allSources.join(", "),
        confidence: boostedConfidence,
        timestamp: earliestTimestamp,
        evidence: `${base.evidence} [Corroborated by: ${allSources.join(", ")}]`,
        metadata: mergedMetadata,
      });
    }

    return deduplicated;
  }

  /**
   * Detects conflicting opinions or classifications among threat-intelligence providers.
   */
  public static detectContradictions(results: ProviderResult[]): ConflictingIntelligence[] {
    const conflicts: ConflictingIntelligence[] = [];
    const opinionsByTarget = new Map<string, ProviderOpinion[]>();

    for (const res of results) {
      if (res.status !== "success" || !res.reputation) continue;

      const targetVal = res.target.value.toLowerCase().trim();
      const opinion: ProviderOpinion = {
        providerId: res.providerId,
        providerName: res.providerName,
        classification: res.reputation.classification,
        score: res.reputation.score,
        confidence: res.reputation.confidence,
        threats: res.reputation.threats,
        categories: res.reputation.categories,
        observedAt: res.queriedAt,
      };

      const existing = opinionsByTarget.get(targetVal) || [];
      existing.push(opinion);
      opinionsByTarget.set(targetVal, existing);
    }

    for (const [target, opinions] of opinionsByTarget.entries()) {
      if (opinions.length < 2) continue;

      const hasMaliciousOrSuspicious = opinions.some(
        (o) => o.classification === "malicious" || o.classification === "suspicious",
      );
      const hasClean = opinions.some((o) => o.classification === "clean");

      if (hasMaliciousOrSuspicious && hasClean) {
        const maliciousProviders = opinions
          .filter((o) => o.classification === "malicious" || o.classification === "suspicious")
          .map((o) => `${o.providerName} (${o.classification}${o.score !== undefined ? `, score: ${o.score}` : ""})`);

        const cleanProviders = opinions
          .filter((o) => o.classification === "clean")
          .map((o) => o.providerName);

        const summary = `Contradictory intelligence on '${target}': Flagged adverse by [${maliciousProviders.join("; ")}], but reported clean by [${cleanProviders.join("; ")}].`;

        conflicts.push({
          target,
          targetType: target.includes("://") ? "url" : target.match(/^\d+\.\d+\.\d+\.\d+$/) ? "ip" : "domain",
          opinions,
          conflictSummary: summary,
          detectedAt: Date.now(),
        });
      }
    }

    return conflicts;
  }

  /**
   * Identifies intelligence sources that were missing, unconfigured, or unavailable during the investigation.
   */
  public static identifyMissingIntelligence(results: ProviderResult[]): string[] {
    const missing: string[] = [];

    for (const res of results) {
      if (res.status === "not_configured") {
        missing.push(`${res.providerName} (Not configured)`);
      } else if (res.status === "skipped" && res.error?.includes("consent")) {
        missing.push(`${res.providerName} (Consent required)`);
      } else if (res.status === "skipped" && res.error?.includes("disabled")) {
        missing.push(`${res.providerName} (Disabled)`);
      } else if (res.status === "rate_limited") {
        missing.push(`${res.providerName} (Rate limited)`);
      } else if (res.status === "error" || res.status === "timeout" || res.status === "network_error") {
        missing.push(`${res.providerName} (Unavailable: ${res.status})`);
      }
    }

    return Array.from(new Set(missing));
  }

  /**
   * Generates conflict findings to present transparently in the investigation evidence list.
   */
  public static generateConflictFindings(conflicts: ConflictingIntelligence[]): InvestigationFinding[] {
    const findings: InvestigationFinding[] = [];
    const now = Date.now();

    for (const c of conflicts) {
      findings.push({
        id: `finding-conflict-${c.target.replace(/[^a-zA-Z0-9]/g, "_")}-${now}`,
        category: "reputation",
        nature: "observed_fact",
        finding: `Conflicting Threat Intelligence: ${c.target}`,
        severity: "informational",
        evidence: `${c.conflictSummary} ScanIQ preserves both viewpoints without artificially discarding conflicting signals.`,
        confidence: 0.95,
        source: "Intelligence Synthesizer",
        timestamp: now,
        metadata: { conflict: c },
      });
    }

    return findings;
  }
}
