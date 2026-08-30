import type {
  FindingSeverity,
  InvestigationFinding,
  RiskAssessment,
  TargetCollection,
} from "./types";
import type { ConflictingIntelligence } from "./synthesis-types";

import { deduplicateFindings } from "./evidence-integrity";

export class ExplainableRiskEngine {
  /**
   * Evaluates all synthesized findings, mitigating factors, and conflicting intelligence
   * using deterministic, rule-based explainable weights.
   */
  public evaluate(
    findings: InvestigationFinding[],
    targets: TargetCollection,
    hasEvaluableContent: boolean = true,
    conflicts: ConflictingIntelligence[] = [],
    missingSources: string[] = [],
  ): RiskAssessment {
    const now = Date.now();
    const dedupedFindings = deduplicateFindings(findings);

    const counts: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
      unknown: 0,
    };

    for (const f of dedupedFindings) {
      counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    }

    // 1. Identify primary risk drivers (critical, high, medium adverse indicators)
    const primaryDrivers = dedupedFindings
      .filter((f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium")
      .sort((a, b) => {
        const sevOrder: Record<FindingSeverity, number> = {
          critical: 5,
          high: 4,
          medium: 3,
          low: 2,
          informational: 1,
          unknown: 0,
        };
        return sevOrder[b.severity] - sevOrder[a.severity] || b.confidence - a.confidence;
      });

    // 2. Identify supporting evidence (low severity indicators & relevant observations)
    const supportingEvidence = dedupedFindings
      .filter((f) => f.severity === "low" || (f.severity === "informational" && f.nature === "observed_fact"))
      .slice(0, 10);

    // 3. Identify mitigating factors
    const mitigatingFactors: string[] = [];
    const urlTarget = targets.urls[0];

    if (urlTarget) {
      if (urlTarget.scheme === "https") {
        mitigatingFactors.push("Encrypted transport (HTTPS) enforced.");
      }
      if (!urlTarget.isIp && urlTarget.domain) {
        mitigatingFactors.push(`Standard named apex domain (${urlTarget.domain}).`);
      }
      if (!urlTarget.port || urlTarget.port === 443 || urlTarget.port === 80) {
        mitigatingFactors.push("Standard web communications port.");
      }
    }

    // Check for clean RDAP / DNS mitigating factors
    const rdapAgeFinding = dedupedFindings.find((f) => f.id.includes("finding-rdap-age"));
    if (rdapAgeFinding && !dedupedFindings.some((f) => f.id.includes("finding-rdap-new-domain"))) {
      mitigatingFactors.push("Established domain registration history without recent creation anomalies.");
    }

    if (primaryDrivers.length === 0 && counts.low === 0) {
      mitigatingFactors.push("No adverse heuristic anomalies or known threat patterns detected.");
    }

    // 4. Compute Risk Score based on adverse finding weights and confidence
    let rawScore = 0;
    let confidenceSum = 0;
    let confidenceCount = 0;

    for (const f of dedupedFindings) {
      confidenceSum += f.confidence;
      confidenceCount += 1;

      switch (f.severity) {
        case "critical":
          rawScore += 45 * f.confidence;
          break;
        case "high":
          rawScore += 25 * f.confidence;
          break;
        case "medium":
          rawScore += 12 * f.confidence;
          break;
        case "low":
          rawScore += 4 * f.confidence;
          break;
        case "informational":
        case "unknown":
          // Informational facts do not elevate adversarial risk
          break;
      }
    }

    // Multi-Indicator Compound Reinforcement
    const hasBrandImpersonation = dedupedFindings.some((f) => f.finding.toLowerCase().includes("impersonat") || f.finding.toLowerCase().includes("typosquat"));
    const hasNewDomain = dedupedFindings.some((f) => f.id.includes("finding-rdap-new-domain") || f.finding.toLowerCase().includes("newly registered"));
    const hasDangerousDownload = dedupedFindings.some((f) => f.id.includes("dangerous-download") || f.finding.toLowerCase().includes("executable"));
    const hasObfuscation = dedupedFindings.some((f) => f.id.includes("obf-") || f.finding.toLowerCase().includes("double url percent-encoding"));

    if (hasBrandImpersonation && hasNewDomain) {
      rawScore += 15; // Typosquatting/brand theft on newly registered domain
    }
    if (hasDangerousDownload && (hasBrandImpersonation || hasNewDomain)) {
      rawScore += 20; // Direct executable dropper on synthetic/brand site
    }
    if (hasObfuscation && counts.high > 0) {
      rawScore += 10;
    }
    if (counts.high >= 1 && counts.medium >= 1) {
      rawScore += 10; // Correlated high + medium indicators boost risk
    }

    const finalScore = Math.min(100, Math.round(rawScore));

    // 5. Separate Confidence Calculation (Breadth, corroboration, conflicts, missing sources)
    const findingsAvgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0.85;
    let baseConfidence = findingsAvgConfidence;

    if (dedupedFindings.some((f) => f.source.includes(","))) {
      baseConfidence += 0.05; // Corroborated by multiple sources
    }
    if (conflicts.length > 0) {
      baseConfidence -= 0.15; // Disagreements reduce certainty
    }
    if (missingSources.length > 2) {
      baseConfidence -= 0.1; // Multiple unconfigured providers reduce confidence
    }

    const confidenceScore = Math.max(0.1, Math.min(0.99, Number(baseConfidence.toFixed(2))));
    let confidenceLevel: "low" | "medium" | "high" = "medium";
    if (confidenceScore >= 0.8) {
      confidenceLevel = "high";
    } else if (confidenceScore < 0.5) {
      confidenceLevel = "low";
    }

    // If zero evaluable content or targets
    if (!hasEvaluableContent && findings.length <= 1) {
      return {
        level: "unknown",
        score: 0,
        confidence: 0,
        confidenceScore: 0,
        confidenceLevel: "low",
        verdict: "Insufficient evaluable evidence",
        rationale: "The scanned payload does not contain actionable web, network, or cryptographic targets to evaluate.",
        primaryDrivers: [],
        supportingEvidence: [],
        mitigatingFactors: [],
        conflictingIntelligence: conflicts,
        missingIntelligence: missingSources,
        findingCounts: counts,
        evaluatedAt: now,
      };
    }

    // 6. Map final score to qualitative risk level
    let level: FindingSeverity = "informational";
    if (counts.critical > 0 || finalScore >= 90) {
      level = "critical";
    } else if (counts.high > 0 || finalScore >= 70) {
      level = "high";
    } else if (counts.medium > 0 || finalScore >= 40) {
      level = "medium";
    } else if (counts.low > 0 || finalScore >= 15) {
      level = "low";
    } else {
      level = "informational";
    }

    // 7. Generate explainable verdict and rationale
    const { verdict, rationale } = this.generateExplanation(
      level,
      finalScore,
      counts,
      primaryDrivers,
      mitigatingFactors,
      conflicts,
    );

    return {
      level,
      score: finalScore,
      confidence: confidenceScore,
      confidenceScore,
      confidenceLevel,
      verdict,
      rationale,
      primaryDrivers,
      supportingEvidence,
      mitigatingFactors,
      conflictingIntelligence: conflicts,
      missingIntelligence: missingSources,
      findingCounts: counts,
      evaluatedAt: now,
    };
  }

  private generateExplanation(
    level: FindingSeverity,
    score: number,
    counts: Record<FindingSeverity, number>,
    primaryDrivers: InvestigationFinding[],
    mitigatingFactors: string[],
    conflicts: ConflictingIntelligence[] = [],
  ): { verdict: string; rationale: string } {
    const conflictSuffix =
      conflicts.length > 0 ? " Note: Conflicting threat intelligence was observed across external providers." : "";

    if (level === "critical") {
      const topDriver = primaryDrivers[0]?.finding ?? "Severe security anomaly detected";
      return {
        verdict: `Critical Security Risk: ${topDriver}`,
        rationale: `This payload was evaluated at ${score}/100 risk due to ${counts.critical} critical indicator(s). It poses an immediate threat (such as direct script execution, confirmed malicious blocklist match, or dangerous URI scheme).${conflictSuffix}`,
      };
    }

    if (level === "high") {
      const topDriver = primaryDrivers[0]?.finding ?? "Adverse indicator detected";
      return {
        verdict: `High Risk: ${topDriver}`,
        rationale: `Assigned a risk score of ${score}/100 based on ${counts.high} high-severity finding(s). The indicators point to active deception, brand impersonation, typosquatting, or high abuse confidence.${conflictSuffix}`,
      };
    }

    if (level === "medium") {
      const topDriver = primaryDrivers[0]?.finding ?? "Suspicious anomalies observed";
      return {
        verdict: `Suspicious: ${topDriver}`,
        rationale: `Calculated a moderate risk score of ${score}/100 based on ${counts.medium} medium-severity heuristic(s). While not confirmed malicious, patterns such as high-risk TLDs, raw IP addressing, or recent domain creation warrant caution.${conflictSuffix}`,
      };
    }

    if (level === "low") {
      return {
        verdict: "Low Risk: Minor heuristic deviations observed",
        rationale: `Calculated a low risk score of ${score}/100. Payload is generally benign but exhibits minor structural flags (e.g. link shortener or elevated entropy) that warrant awareness.${conflictSuffix}`,
      };
    }

    return {
      verdict: "Informational: No adverse threat indicators identified",
      rationale: `Assigned a score of ${score}/100. Local and external intelligence identified 0 adverse indicators across all evaluated categories. ${mitigatingFactors.join(" ")}${conflictSuffix}`,
    };
  }
}

export const riskEngine = new ExplainableRiskEngine();
