import type {
  InvestigationReport,
  OsintFinding,
  RiskEvidence,
  RiskLevel,
  RiskScoreSummary,
  ScanRecord,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
  TargetCollection,
  InvestigationAction,
} from "./types";
import { analyzePayload } from "./payload-analyzer";
import { normalizeAndAnalyzeUrl } from "./url-normalizer";
import { EvidenceCollector } from "./evidence-collector";
import { riskEngine } from "./risk-engine";
import { ProviderOrchestrator, type OrchestrationOptions } from "./providers/orchestrator";
import { correlateInfrastructure } from "./correlation";
import { IntelligenceSynthesizer } from "./synthesizer";
import { computeEvidenceFingerprint, deduplicateFindings } from "./evidence-integrity";

export class InvestigationEngine {
  /**
   * Primary pipeline entry point: Runs complete investigation on a scan record,
   * combining local heuristics, external provider orchestration, evidence deduplication,
   * contradiction detection, unified entity graph correlation, provenance logging,
   * and explainable risk evaluation.
   */
  public async runInvestigation(
    scan: ScanRecord,
    caseId?: string,
    options?: OrchestrationOptions,
  ): Promise<{
    report: InvestigationReport;
    findings: InvestigationFinding[];
  }> {
    const now = Date.now();
    const invId = scan.investigationId || `inv-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
    const resCaseId = caseId || scan.caseId || `case-${crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)}`;
    const runId = `run-${Date.now().toString(36)}`;

    const provenanceLog: InvestigationAction[] = [
      {
        id: `act-init-${Date.now()}`,
        investigationId: invId,
        action: "investigation_created",
        timestamp: now,
        details: `Investigation case #${resCaseId} initiated for ${scan.format} payload.`,
      },
      {
        id: `act-scan-${Date.now()}`,
        investigationId: invId,
        action: "scan_performed",
        timestamp: scan.scannedAt || now,
        details: `Scan recorded with format ${scan.format} (${scan.content.length} characters).`,
      },
      {
        id: `act-analysis-${Date.now()}`,
        investigationId: invId,
        action: "analysis_started",
        timestamp: Date.now(),
      },
    ];

    const collector = new EvidenceCollector();

    // 1. Initial Payload Analysis & Target Extraction
    const payloadResult = analyzePayload(scan.content);
    collector.addAll(payloadResult.findings);

    const targets: TargetCollection = payloadResult.targets;
    let initialUrl: string | undefined;

    // 2. If scan type is URL or contains URL pattern, normalize and parse
    if (scan.type === "url" || scan.content.startsWith("http") || scan.content.includes("://")) {
      const { result: normUrl, findings: normFindings } = normalizeAndAnalyzeUrl(scan.content);
      collector.addAll(normFindings);

      if (normUrl.isValid && normUrl.summary.fqdn) {
        initialUrl = normUrl.normalized;
        targets.urls.push(normUrl.summary);
        if (!targets.domains.includes(normUrl.summary.domain)) {
          targets.domains.push(normUrl.summary.domain);
        }
        if (!targets.hosts.includes(normUrl.summary.fqdn)) {
          targets.hosts.push(normUrl.summary.fqdn);
        }
      }
    }

    // 3. Execute all active providers via ProviderOrchestrator
    const orchestration = await ProviderOrchestrator.execute(targets, scan.content, options);
    collector.addAll(orchestration.findings);

    // Record Provider Provenance Actions
    for (const res of orchestration.results) {
      if (res.status === "success") {
        provenanceLog.push({
          id: `act-prov-${res.providerId}-${Date.now()}`,
          investigationId: invId,
          action: "provider_queried",
          provider: res.providerName,
          target: res.target.value,
          timestamp: res.queriedAt,
        });
      } else if (res.status === "skipped" || res.status === "not_configured") {
        provenanceLog.push({
          id: `act-prov-skip-${res.providerId}-${Date.now()}`,
          investigationId: invId,
          action: "provider_skipped",
          provider: res.providerName,
          target: res.target.value,
          timestamp: res.queriedAt,
          details: res.error || "Provider unconfigured or disabled by user preference",
        });
      } else if (res.status === "error" || res.status === "rate_limited") {
        provenanceLog.push({
          id: `act-prov-err-${res.providerId}-${Date.now()}`,
          investigationId: invId,
          action: "provider_failed",
          provider: res.providerName,
          target: res.target.value,
          timestamp: res.queriedAt,
          details: res.error,
        });
      }
    }

    // 4. Correlate Domain, Host, Threat & Entity Graph
    const primaryDomain = targets.domains[0] || targets.hosts[0];
    const primaryIp = targets.ips[0];
    const correlated = correlateInfrastructure(
      orchestration.results,
      primaryDomain,
      primaryIp,
      scan.content,
      initialUrl,
    );

    // Add conflict findings to evidence list if any contradictions exist
    if (correlated.unifiedModel.conflicts.length > 0) {
      const conflictFindings = IntelligenceSynthesizer.generateConflictFindings(correlated.unifiedModel.conflicts);
      collector.addAll(conflictFindings);
    }

    provenanceLog.push({
      id: `act-corr-${Date.now()}`,
      investigationId: invId,
      action: "evidence_correlated",
      timestamp: Date.now(),
      details: `Correlated ${correlated.unifiedModel.graph.nodes.length} entity nodes and ${correlated.unifiedModel.graph.edges.length} multi-hop relationships.`,
    });

    // 5. Evidence Deduplication across multiple provider sources
    const rawFindings = collector.getAll().map((f) => ({
      ...f,
      investigationId: invId,
      runId,
      observedAt: f.observedAt || f.timestamp,
      retrievedAt: f.retrievedAt || Date.now(),
      fingerprint: f.fingerprint || computeEvidenceFingerprint(f),
    }));

    const deduplicatedFindings = deduplicateFindings(rawFindings);

    provenanceLog.push({
      id: `act-ev-rec-${Date.now()}`,
      investigationId: invId,
      action: "evidence_received",
      timestamp: Date.now(),
      details: `Synthesized ${deduplicatedFindings.length} distinct evidence findings (${rawFindings.length} raw observations).`,
    });

    // 6. Run Explainable Risk Evaluation with separate Risk & Confidence dimensions
    const hasEvaluableContent =
      targets.urls.length > 0 ||
      targets.domains.length > 0 ||
      targets.ips.length > 0 ||
      payloadResult.metrics.anomalies.length > 0 ||
      scan.type === "url" ||
      scan.type === "wifi";

    const riskAssessment = riskEngine.evaluate(
      deduplicatedFindings,
      targets,
      hasEvaluableContent,
      correlated.unifiedModel.conflicts,
      correlated.unifiedModel.missingSources,
    );

    provenanceLog.push({
      id: `act-risk-${Date.now()}`,
      investigationId: invId,
      action: "risk_recalculated",
      timestamp: Date.now(),
      details: `Evaluated threat score ${riskAssessment.score}/100 (${riskAssessment.level}) with confidence ${Math.round(riskAssessment.confidenceScore * 100)}%.`,
    });

    // 7. Convert findings to backward-compatible OsintFinding and RiskEvidence for legacy/UI consumers
    const osintFindings: OsintFinding[] = deduplicatedFindings.map((f) => ({
      id: f.id,
      kind: mapCategoryToKind(f.category, f.finding),
      title: f.finding,
      summary: f.evidence,
      severity: mapSeverityToRiskLevel(f.severity),
      confidence: f.confidence,
      references: [f.source],
      nature: f.nature,
      metadata: f.metadata,
    }));

    const riskEvidences: RiskEvidence[] = deduplicatedFindings.map((f) => ({
      id: f.id,
      source: f.source,
      title: f.finding,
      description: f.evidence,
      severity: mapSeverityToRiskLevel(f.severity),
      confidence: f.confidence,
      fields: f.metadata as RiskEvidence["fields"],
      discoveredAt: f.timestamp,
    }));

    const finalRiskSummary: RiskScoreSummary = {
      overall: mapSeverityToRiskLevel(riskAssessment.level),
      numeric: riskAssessment.score,
      confidence: riskAssessment.confidence,
      confidenceScore: riskAssessment.confidenceScore,
      confidenceLevel: riskAssessment.confidenceLevel,
      verdict: riskAssessment.verdict,
      explanation: riskAssessment.rationale,
      evidence: riskEvidences,
      primaryDrivers: riskAssessment.primaryDrivers.map((d) => d.finding),
      supportingEvidence: riskAssessment.supportingEvidence.map((d) => d.finding),
      mitigatingFactors: riskAssessment.mitigatingFactors,
      conflictingIntelligence: riskAssessment.conflictingIntelligence.map((c) => ({
        target: c.target,
        conflictSummary: c.conflictSummary,
        opinions: c.opinions,
      })),
      missingIntelligence: riskAssessment.missingIntelligence,
    };

    // Determine active provider flags
    const executedProviders = new Set(orchestration.results.filter((r) => r.status === "success").map((r) => r.providerId));

    provenanceLog.push({
      id: `act-rep-${Date.now()}`,
      investigationId: invId,
      action: "report_generated",
      timestamp: Date.now(),
      details: "Complete investigation dossier prepared and validated.",
    });

    const report: InvestigationReport = {
      id: invId,
      caseId: resCaseId,
      createdAt: scan.scannedAt || now,
      updatedAt: Date.now(),
      status: "complete",
      sourceScanId: scan.id,
      rawContent: scan.content,
      contentType: scan.type,
      format: scan.format,
      targets: {
        urls: targets.urls,
        domains: targets.domains,
        hosts: targets.hosts,
        phoneNumbers: targets.phoneNumbers,
        emails: targets.emails,
        productCodes: targets.productCodes,
      },
      payloadAnalysis: {
        hasCredentialsEmbedded: payloadResult.metrics.hasCredentialsEmbedded,
        hasIps: payloadResult.metrics.hasIps,
        hasObfuscation: payloadResult.metrics.hasObfuscation,
        usesDangerousProtocol: payloadResult.metrics.usesDangerousProtocol,
        size: payloadResult.metrics.size,
        entropy: payloadResult.metrics.entropy,
        anomalies: payloadResult.metrics.anomalies,
      },
      urlSafetySnapshot: finalRiskSummary,
      domainIntel: correlated.domainIntel,
      hostIntel: correlated.hostIntel,
      reputation: [],
      findings: osintFindings,
      finalRisk: finalRiskSummary,
      intelligenceFlags: {
        whoisEnabled: executedProviders.has("rdap-domain") || executedProviders.has("rdap-ip"),
        rdapEnabled: executedProviders.has("rdap-domain") || executedProviders.has("rdap-ip"),
        dnsEnabled: executedProviders.has("dns-over-https"),
        asnEnabled: executedProviders.has("ipinfo") || executedProviders.has("rdap-ip"),
        geoEnabled: executedProviders.has("ipinfo"),
        certEnabled: executedProviders.has("crtsh-cert"),
        redirectEnabled: false,
        reputationEnabled: executedProviders.has("virus-total") || executedProviders.has("urlscan") || executedProviders.has("google-safe-browsing"),
        userControlled: true,
      },
      synthesis: {
        ...correlated.unifiedModel,
        provenanceLog,
      },
    };

    return {
      report,
      findings: deduplicatedFindings,
    };
  }
}

function mapSeverityToRiskLevel(sev: string): RiskLevel {
  switch (sev) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    case "informational": return "benign";
    default: return "unknown";
  }
}

function mapCategoryToKind(category: string, title: string): OsintFinding["kind"] {
  const lower = title.toLowerCase();
  if (lower.includes("impersonat") || lower.includes("brand")) return "brand-impersonation";
  if (lower.includes("typosquat")) return "typosquat";
  if (lower.includes("shortener")) return "url-shortener";
  if (lower.includes("credential")) return "embedded-credentials";
  if (lower.includes("dangerous protocol") || lower.includes("scheme")) return "dangerous-protocol";
  if (lower.includes("raw ip") || lower.includes("private ip")) return "ip-hosted";
  if (lower.includes("redirect")) return "redirect-anomaly";
  if (category === "payload") return "payload-anomaly";
  return "general";
}

export const investigationEngine = new InvestigationEngine();
