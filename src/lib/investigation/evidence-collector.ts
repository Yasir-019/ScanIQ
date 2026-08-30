import type { FindingCategory, FindingSeverity, InvestigationFinding } from "./types";

export class EvidenceCollector {
  private findings: Map<string, InvestigationFinding> = new Map();

  public add(finding: InvestigationFinding): void {
    if (!finding.id) {
      finding.id = `finding-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
    // Deduplicate by ID
    this.findings.set(finding.id, finding);
  }

  public addAll(findings: InvestigationFinding[]): void {
    for (const f of findings) {
      this.add(f);
    }
  }

  public getAll(): InvestigationFinding[] {
    return Array.from(this.findings.values()).sort((a, b) => {
      // Sort by severity weight first, then timestamp
      const weight: Record<FindingSeverity, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        informational: 1,
        unknown: 0,
      };
      const diff = weight[b.severity] - weight[a.severity];
      if (diff !== 0) return diff;
      return b.confidence - a.confidence;
    });
  }

  public getByCategory(category: FindingCategory): InvestigationFinding[] {
    return this.getAll().filter((f) => f.category === category);
  }

  public getBySeverity(severity: FindingSeverity): InvestigationFinding[] {
    return this.getAll().filter((f) => f.severity === severity);
  }

  public getSeverityCounts(): Record<FindingSeverity, number> {
    const counts: Record<FindingSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      informational: 0,
      unknown: 0,
    };
    for (const f of this.findings.values()) {
      counts[f.severity] = (counts[f.severity] ?? 0) + 1;
    }
    return counts;
  }

  public clear(): void {
    this.findings.clear();
  }
}
