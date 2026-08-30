import type { InvestigationFinding } from "./types";
import { detectBrandImpersonation } from "./brand-detector";

export function analyzeDomain(domain: string): InvestigationFinding[] {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];

  if (!domain || domain.includes(":") || /^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
    return findings; // Skip IP addresses or invalid domains
  }

  const parts = domain.toLowerCase().split(".");
  const label = parts[0];

  const hyphenCount = (label.match(/-/g) || []).length;
  const digitCount = (label.match(/\d/g) || []).length;

  // 1. Structural Domain Complexity
  if (hyphenCount >= 3) {
    findings.push({
      id: `finding-domain-hyphens-${domain}-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `Multiple hyphens in domain label (${hyphenCount} hyphens)`,
      severity: "medium",
      evidence: `Domain '${domain}' uses ${hyphenCount} hyphens. Attackers frequently assemble compound phrases with multiple hyphens (e.g., 'secure-login-update-service.com') to create convincing fake URLs.`,
      confidence: 0.8,
      source: "domain-analyzer",
      timestamp: now,
      metadata: { hyphenCount },
    });
  }

  if (digitCount >= 4 && label.length <= 15) {
    findings.push({
      id: `finding-domain-digits-${domain}-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `High numerical density in domain name (${digitCount} digits)`,
      severity: "low",
      evidence: `Domain '${domain}' contains ${digitCount} numbers, a common trait in automatically provisioned disposable domains and bulletproof hosting networks.`,
      confidence: 0.7,
      source: "domain-analyzer",
      timestamp: now,
      metadata: { digitCount },
    });
  }

  // 2. Comprehensive Brand Impersonation, Homoglyphs & Typosquatting
  const brandResult = detectBrandImpersonation(domain);
  if (brandResult.detected) {
    findings.push(...brandResult.findings);
  }

  return findings;
}
