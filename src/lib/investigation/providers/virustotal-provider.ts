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

export interface VtAnalysisStats {
  malicious: number;
  suspicious: number;
  harmless: number;
  undetected: number;
  timeout: number;
}

export interface VtAnalysisResult {
  category: string;
  engine_name: string;
  method: string;
  result: string | null;
}

export interface VtAttributes {
  last_analysis_stats?: VtAnalysisStats;
  last_analysis_results?: Record<string, VtAnalysisResult>;
  reputation?: number;
  tags?: string[];
  categories?: Record<string, string>;
  last_analysis_date?: number;
  meaningful_name?: string;
  registrar?: string;
  as_owner?: string;
  country?: string;
}

export interface VtResponse {
  data?: {
    id: string;
    type: string;
    attributes: VtAttributes;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Base64url encoding without padding as required by VirusTotal v3 URL endpoints.
 */
function toBase64Url(str: string): string {
  try {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
}

/**
 * VirusTotal Multi-Engine Reputation Provider Adapter.
 * Queries VirusTotal v3 API for URL, Domain, and IP threat intelligence.
 */
export class VirusTotalProvider extends BaseIntelligenceProvider {
  public readonly id = "virus-total";
  public readonly name = "VirusTotal Threat Intelligence";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "reputation";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["url", "domain", "ip"];
  public readonly capabilities: ProviderCapability[] = [
    "url_reputation",
    "domain_reputation",
    "ip_reputation",
    "threat_categorization",
  ];
  public readonly requiresAuth = true;
  public readonly envKey = "VITE_VIRUSTOTAL_KEY";
  public readonly description =
    "Aggregates 70+ antivirus and URL blocklist engines for detection statistics, threat tags, and reputation scores.";
  public readonly docsUrl = "https://developers.virustotal.com/reference/overview";
  public readonly rateLimitHints = "Standard free API tier allows 4 requests/min, 500/day.";

  protected async performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: VtResponse; fromCache: boolean; ageSeconds: number }> {
    const targetKey = `${target.type}:${target.value.trim()}`;

    // Check bounded cache
    const cached = IntelligenceCache.get<VtResponse>(this.id, targetKey);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error("VirusTotal API key is missing or unconfigured (<CONFIGURE_MANUALLY>).");
    }

    let endpoint = "";
    if (target.type === "url") {
      const urlId = toBase64Url(target.value);
      endpoint = `https://www.virustotal.com/api/v3/urls/${urlId}`;
    } else if (target.type === "domain" || target.type === "fqdn") {
      endpoint = `https://www.virustotal.com/api/v3/domains/${encodeURIComponent(target.value.toLowerCase().trim())}`;
    } else if (target.type === "ip") {
      endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${encodeURIComponent(target.value.trim())}`;
    } else {
      throw new Error(`Unsupported target type '${target.type}' for VirusTotal.`);
    }

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-apikey": apiKey,
        "Accept": "application/json",
      },
      signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("VirusTotal authentication failed (Invalid API key or unauthorized HTTP 401/403).");
    }

    if (res.status === 429) {
      throw new Error("VirusTotal rate limit exceeded (HTTP 429 Too Many Requests).");
    }

    if (res.status === 404) {
      // 404 in VT means item has not been scanned yet (no historical data)
      return {
        data: { data: { id: target.value, type: target.type, attributes: {} } },
        fromCache: false,
        ageSeconds: 0,
      };
    }

    if (!res.ok) {
      throw new Error(`VirusTotal query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as VtResponse;

    // Cache results for 2 hours
    IntelligenceCache.set(this.id, targetKey, data, 7200);

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
      data: VtResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const now = Date.now();
    const attrs = data?.data?.attributes || {};
    const stats = attrs.last_analysis_stats;
    const maliciousCount = stats?.malicious ?? 0;
    const suspiciousCount = stats?.suspicious ?? 0;
    const harmlessCount = stats?.harmless ?? 0;
    const undetectedCount = stats?.undetected ?? 0;
    const totalEngines = maliciousCount + suspiciousCount + harmlessCount + undetectedCount;

    const threats: string[] = [];
    if (attrs.last_analysis_results) {
      for (const [, result] of Object.entries(attrs.last_analysis_results)) {
        if (result.category === "malicious" && result.result) {
          if (!threats.includes(result.result)) {
            threats.push(result.result);
          }
        }
      }
    }

    const tags = attrs.tags || [];
    const categories = Object.values(attrs.categories || {});
    const combinedCategories = Array.from(new Set([...tags, ...categories]));

    // Determine reputation classification
    let classification: ReputationResult["classification"] = "unknown";
    if (totalEngines > 0) {
      if (maliciousCount >= 3) {
        classification = "malicious";
      } else if (maliciousCount >= 1 || suspiciousCount >= 2) {
        classification = "suspicious";
      } else {
        classification = "clean";
      }
    }

    const repScore = totalEngines > 0
      ? Math.round(((maliciousCount * 1.0 + suspiciousCount * 0.5) / totalEngines) * 100)
      : undefined;

    const repResult: ReputationResult = {
      source: this.id,
      scope: target.type === "url" ? "url" : target.type === "ip" ? "ip" : "domain",
      classification,
      score: repScore,
      confidence: totalEngines > 10 ? 0.95 : 0.8,
      categories: combinedCategories,
      threats,
      lastChecked: now,
      detailsUrl: `https://www.virustotal.com/gui/${target.type === "url" ? "url" : target.type === "ip" ? "ip-address" : "domain"}/${encodeURIComponent(target.value)}`,
    };

    // Generate Standard Findings
    if (maliciousCount > 0) {
      const topThreats = threats.slice(0, 4).join(", ") || "Threat detected";
      findings.push({
        id: `finding-vt-malicious-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `VirusTotal Multi-Engine Detection: ${maliciousCount}/${totalEngines} Engines Flagged Malicious`,
        severity: maliciousCount >= 3 ? "high" : "medium",
        evidence: `${maliciousCount} security vendors flagged '${target.value}' as malicious (${topThreats}).`,
        confidence: Math.min(0.99, 0.7 + (maliciousCount / Math.max(1, totalEngines)) * 0.3),
        source: this.id,
        timestamp: now,
        metadata: {
          maliciousCount,
          suspiciousCount,
          totalEngines,
          threats,
          categories: combinedCategories,
          fromCache,
          ageSeconds,
        },
        remediation: "Do not open, execute, or submit credentials to this destination.",
      });
    } else if (suspiciousCount > 0) {
      findings.push({
        id: `finding-vt-suspicious-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `VirusTotal Flagged Suspicious (${suspiciousCount} Engine${suspiciousCount === 1 ? "" : "s"})`,
        severity: "low",
        evidence: `${suspiciousCount} security engine(s) flagged this target as suspicious.`,
        confidence: 0.8,
        source: this.id,
        timestamp: now,
        metadata: { suspiciousCount, totalEngines, fromCache, ageSeconds },
      });
    } else if (totalEngines > 0) {
      findings.push({
        id: `finding-vt-clean-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `VirusTotal Engine Consensus: Clean (0/${totalEngines} Detections)`,
        severity: "informational",
        evidence: `0 out of ${totalEngines} security vendors flagged this target across historical and live scans.`,
        confidence: 0.9,
        source: this.id,
        timestamp: now,
        metadata: { harmlessCount, totalEngines, fromCache, ageSeconds },
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
        stats,
        threats,
        tags,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const virusTotalProvider = new VirusTotalProvider();
