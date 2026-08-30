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

export interface GsbThreatMatch {
  threatType: string;
  platformType: string;
  threatEntryType: string;
  threat: { url: string };
  threatEntryMetadata?: { entries: { key: string; value: string }[] };
  cacheDuration?: string;
}

export interface GsbResponse {
  matches?: GsbThreatMatch[];
}

/**
 * Google Safe Browsing Lookup Provider Adapter.
 * Queries Google Safe Browsing v4 threatMatches endpoint for known malware,
 * social engineering (phishing), and unwanted software URLs.
 */
export class GoogleSafeBrowsingProvider extends BaseIntelligenceProvider {
  public readonly id = "google-safe-browsing";
  public readonly name = "Google Safe Browsing";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "reputation";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["url"];
  public readonly capabilities: ProviderCapability[] = [
    "url_reputation",
    "threat_categorization",
  ];
  public readonly requiresAuth = true;
  public readonly envKey = "VITE_SAFEBROWSING_KEY";
  public readonly description =
    "Checks URLs against Google's global blocklists for active phishing campaigns, drive-by malware, and deceptive software.";
  public readonly docsUrl = "https://developers.google.com/safe-browsing/v4/lookup-api";
  public readonly rateLimitHints = "Standard API limits per GCP project quota.";

  protected async performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: GsbResponse; fromCache: boolean; ageSeconds: number }> {
    const url = target.value.trim();

    // Check cache
    const cached = IntelligenceCache.get<GsbResponse>(this.id, url);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error("Google Safe Browsing API key is missing or unconfigured (<CONFIGURE_MANUALLY>).");
    }

    const endpoint = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`;
    const body = {
      client: {
        clientId: "scaniq-threat-intel",
        clientVersion: "1.0.0",
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION",
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: [{ url }],
      },
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new Error("Google Safe Browsing authentication failed (Invalid API key or project unauthorized).");
    }

    if (res.status === 429) {
      throw new Error("Google Safe Browsing quota exceeded (HTTP 429).");
    }

    if (!res.ok) {
      throw new Error(`Google Safe Browsing query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as GsbResponse;

    // Cache results for 2 hours
    IntelligenceCache.set(this.id, url, data, 7200);

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
      data: GsbResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const now = Date.now();
    const matches = data?.matches || [];
    const hasMatches = matches.length > 0;

    const threatTypes = Array.from(new Set(matches.map((m) => m.threatType)));

    const repResult: ReputationResult = {
      source: this.id,
      scope: "url",
      classification: hasMatches ? "malicious" : "clean",
      score: hasMatches ? 95 : 0,
      confidence: 0.98,
      categories: threatTypes,
      threats: threatTypes,
      lastChecked: now,
      detailsUrl: "https://transparencyreport.google.com/safe-browsing/search",
    };

    if (hasMatches) {
      const threatList = threatTypes.join(", ");
      findings.push({
        id: `finding-gsb-match-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `Google Safe Browsing Threat Hit: ${threatList}`,
        severity: "critical",
        evidence: `URL '${target.value}' is actively flagged on Google Safe Browsing for: ${threatList}.`,
        confidence: 0.98,
        source: this.id,
        timestamp: now,
        metadata: { threatTypes, matches, fromCache, ageSeconds },
        remediation: "Do not open this URL or download content from this origin.",
      });
    } else {
      findings.push({
        id: `finding-gsb-clean-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: "Google Safe Browsing: No Threats Listed",
        severity: "informational",
        evidence: "URL is not listed on Google Safe Browsing malware, phishing, or unwanted software lists.",
        confidence: 0.9,
        source: this.id,
        timestamp: now,
        metadata: { matchesCount: 0, fromCache, ageSeconds },
      });
    }

    const evidence: RiskEvidence[] = findings.map((f) => ({
      id: f.id,
      source: this.id,
      title: f.finding,
      description: f.evidence,
      severity: f.severity === "critical" ? "critical" : f.severity === "high" ? "high" : "benign",
      confidence: f.confidence,
      fields: f.metadata as RiskEvidence["fields"],
      discoveredAt: f.timestamp,
    }));

    return {
      findings,
      evidence,
      reputation: repResult,
      metadata: {
        matches,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const googleSafeBrowsingProvider = new GoogleSafeBrowsingProvider();
