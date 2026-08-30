import {
  BaseIntelligenceProvider,
} from "./base";
import type {
  ProviderCategory,
  ProviderCapability,
  ProviderContext,
  ProviderPrivacy,
  ProviderTarget,
  RateLimitInfo,
  TargetType,
} from "./types";
import type {
  ReputationResult,
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
} from "../types";
import { IntelligenceCache } from "../cache";

export interface AbuseIpdbReportData {
  ipAddress: string;
  isPublic: boolean;
  ipVersion: number;
  isWhitelisted?: boolean;
  abuseConfidenceScore: number; // 0 - 100
  countryCode?: string;
  usageType?: string;
  isp?: string;
  domain?: string;
  hostnames?: string[];
  isTor?: boolean;
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt?: string;
}

export interface AbuseIpdbResponse {
  data?: AbuseIpdbReportData;
  errors?: { detail: string; status: number }[];
}

/**
 * AbuseIPDB IP Reputation & Abuse Confidence Provider Adapter.
 * Queries AbuseIPDB v2 API to check crowdsourced abuse reports and confidence scores.
 */
export class AbuseIpdbProvider extends BaseIntelligenceProvider {
  public readonly id = "abuseipdb";
  public readonly name = "AbuseIPDB Threat Intelligence";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "blocklist";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["ip"];
  public readonly capabilities: ProviderCapability[] = [
    "ip_reputation",
    "abuse_confidence",
    "threat_categorization",
  ];
  public readonly requiresAuth = true;
  public readonly envKey = "VITE_ABUSEIPDB_KEY";
  public readonly description =
    "Queries crowdsourced abuse repository for reported attacks, spam, port scanning, and abusive IP confidence scores.";
  public readonly docsUrl = "https://docs.abuseipdb.com/";
  public readonly rateLimitHints = "Free plan allows 1,000 checks/day.";

  protected async performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: AbuseIpdbResponse; fromCache: boolean; ageSeconds: number }> {
    const ip = target.value.trim();

    // Check cache
    const cached = IntelligenceCache.get<AbuseIpdbResponse>(this.id, ip);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error("AbuseIPDB API key is missing or unconfigured (<CONFIGURE_MANUALLY>).");
    }

    const endpoint = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Key": apiKey,
        "Accept": "application/json",
      },
      signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("AbuseIPDB authentication failed (Invalid API key or unauthorized HTTP 401/403).");
    }

    if (res.status === 429) {
      throw new Error("AbuseIPDB rate limit exceeded (HTTP 429 Too Many Requests).");
    }

    if (!res.ok) {
      throw new Error(`AbuseIPDB query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as AbuseIpdbResponse;

    // Cache results for 2 hours
    IntelligenceCache.set(this.id, ip, data, 7200);

    return { data, fromCache: false, ageSeconds: 0 };
  }

  protected async normalize(
    rawResponse: unknown,
    target: ProviderTarget,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    reputation?: ReputationResult;
    rateLimit?: RateLimitInfo;
    warnings?: string[];
    metadata?: Record<string, unknown>;
  }> {
    const { data, fromCache, ageSeconds } = rawResponse as {
      data: AbuseIpdbResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const now = Date.now();
    const rep = data?.data;

    if (!rep) {
      return {
        findings: [],
        evidence: [],
        warnings: [`No AbuseIPDB data returned for IP '${target.value}'.`],
        metadata: { cached: fromCache, cacheAgeSeconds: ageSeconds },
      };
    }

    const score = rep.abuseConfidenceScore ?? 0;
    const totalReports = rep.totalReports ?? 0;
    const distinctUsers = rep.numDistinctUsers ?? 0;

    let classification: ReputationResult["classification"] = "clean";
    if (score >= 50 || totalReports >= 10) {
      classification = "malicious";
    } else if (score >= 10 || totalReports > 0) {
      classification = "suspicious";
    }

    const repResult: ReputationResult = {
      source: this.id,
      scope: "ip",
      classification,
      score,
      confidence: 0.9,
      categories: [rep.usageType || "Hosting/ISP", rep.isTor ? "Tor Exit Node" : ""].filter(Boolean),
      threats: totalReports > 0 ? [`${totalReports} abuse reports from ${distinctUsers} reporters`] : [],
      lastChecked: now,
      detailsUrl: `https://www.abuseipdb.com/check/${encodeURIComponent(target.value)}`,
    };

    if (score >= 50 || totalReports >= 10) {
      findings.push({
        id: `finding-abuseipdb-high-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `AbuseIPDB High Abuse Confidence: ${score}% (${totalReports} reports)`,
        severity: "high",
        evidence: `IP '${target.value}' has an abuse confidence score of ${score}% based on ${totalReports} reports from ${distinctUsers} distinct security reporters.${rep.lastReportedAt ? ` Most recent report: ${rep.lastReportedAt}.` : ""}`,
        confidence: 0.93,
        source: this.id,
        timestamp: now,
        metadata: { score, totalReports, distinctUsers, lastReportedAt: rep.lastReportedAt, fromCache, ageSeconds },
        remediation: "Block connections to this IP address and investigate associated infrastructure.",
      });
    } else if (score >= 10 || totalReports > 0) {
      findings.push({
        id: `finding-abuseipdb-med-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `AbuseIPDB Moderate Abuse History: ${score}% (${totalReports} report${totalReports === 1 ? "" : "s"})`,
        severity: "medium",
        evidence: `IP has ${totalReports} abuse report(s) recorded in the last 90 days.`,
        confidence: 0.85,
        source: this.id,
        timestamp: now,
        metadata: { score, totalReports, distinctUsers, fromCache, ageSeconds },
      });
    } else {
      findings.push({
        id: `finding-abuseipdb-clean-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: "AbuseIPDB Confidence Score: 0% (0 Reports)",
        severity: "informational",
        evidence: `No abusive activity reported for IP '${target.value}' in the last 90 days.`,
        confidence: 0.9,
        source: this.id,
        timestamp: now,
        metadata: { score: 0, totalReports: 0, fromCache, ageSeconds },
      });
    }

    const evidence: RiskEvidence[] = findings.map((f) => ({
      id: f.id,
      source: this.id,
      title: f.finding,
      description: f.evidence,
      severity: f.severity === "high" ? "high" : f.severity === "medium" ? "medium" : f.severity === "low" ? "low" : "benign",
      confidence: f.confidence,
      fields: f.metadata as RiskEvidence["fields"],
      discoveredAt: f.timestamp,
    }));

    return {
      findings,
      evidence,
      reputation: repResult,
      metadata: {
        reportData: rep,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const abuseIpdbProvider = new AbuseIpdbProvider();
