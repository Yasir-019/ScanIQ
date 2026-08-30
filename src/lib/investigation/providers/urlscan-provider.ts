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

export interface UrlscanPage {
  domain?: string;
  ip?: string;
  country?: string;
  server?: string;
  title?: string;
  url?: string;
  status?: number;
}

export interface UrlscanVerdict {
  score?: number;
  malicious?: boolean;
  categories?: string[];
  brands?: string[];
  tags?: string[];
}

export interface UrlscanResultItem {
  _id: string;
  page?: UrlscanPage;
  verdicts?: {
    overall?: UrlscanVerdict;
    urlscan?: UrlscanVerdict;
    community?: UrlscanVerdict;
  };
  result?: string;
  screenshot?: string;
  task?: {
    time?: string;
    url?: string;
  };
}

export interface UrlscanSearchResponse {
  results: UrlscanResultItem[];
  total: number;
  took?: number;
}

/**
 * URLScan.io Threat & Page Intelligence Provider Adapter.
 * Queries URLScan.io search API for historical page snapshots, sandbox verdicts,
 * and malicious page heuristics.
 */
export class UrlscanProvider extends BaseIntelligenceProvider {
  public readonly id = "urlscan";
  public readonly name = "URLScan.io Threat Intelligence";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "reputation";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["url", "domain", "fqdn"];
  public readonly capabilities: ProviderCapability[] = [
    "live_url_scan",
    "url_search",
    "screenshot",
    "threat_categorization",
  ];
  public readonly requiresAuth = true;
  public readonly envKey = "VITE_URLSCAN_KEY";
  public readonly description =
    "Searches URLScan.io sandbox analysis repository for historical verdicts, phishing classifications, and DOM snapshots.";
  public readonly docsUrl = "https://urlscan.io/docs/api/";
  public readonly rateLimitHints = "Standard API allows search and submission with rate limits per plan.";

  protected async performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: UrlscanSearchResponse; fromCache: boolean; ageSeconds: number }> {
    const targetKey = `${target.type}:${target.value.trim()}`;

    // Check cache
    const cached = IntelligenceCache.get<UrlscanSearchResponse>(this.id, targetKey);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error("URLScan API key is missing or unconfigured (<CONFIGURE_MANUALLY>).");
    }

    let query = "";
    if (target.type === "url") {
      query = `url:"${target.value}"`;
    } else {
      query = `domain:${target.value.toLowerCase().trim()}`;
    }

    const endpoint = `https://urlscan.io/api/v1/search/?q=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "API-Key": apiKey,
        "Accept": "application/json",
      },
      signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("URLScan authentication failed (Invalid API key or unauthorized HTTP 401/403).");
    }

    if (res.status === 429) {
      throw new Error("URLScan rate limit exceeded (HTTP 429 Too Many Requests).");
    }

    if (!res.ok) {
      throw new Error(`URLScan query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as UrlscanSearchResponse;

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
      data: UrlscanSearchResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const now = Date.now();
    const latest = data?.results?.[0];

    if (!latest) {
      return {
        findings: [],
        evidence: [],
        warnings: [`No historical URLScan sandbox records found for '${target.value}'.`],
        metadata: { total: 0, cached: fromCache, cacheAgeSeconds: ageSeconds },
      };
    }

    const overallVerdict = latest.verdicts?.overall || latest.verdicts?.urlscan || {};
    const isMalicious = !!overallVerdict.malicious;
    const score = overallVerdict.score ?? 0;
    const categories = overallVerdict.categories || [];
    const brands = overallVerdict.brands || [];
    const tags = overallVerdict.tags || [];
    const combinedCategories = Array.from(new Set([...categories, ...brands, ...tags]));

    let classification: ReputationResult["classification"] = "clean";
    if (isMalicious || score >= 50) {
      classification = "malicious";
    } else if (score >= 10 || categories.length > 0) {
      classification = "suspicious";
    }

    const repResult: ReputationResult = {
      source: this.id,
      scope: target.type === "url" ? "url" : "domain",
      classification,
      score,
      confidence: 0.9,
      categories: combinedCategories,
      threats: brands.length > 0 ? brands.map((b) => `Impersonated Brand: ${b}`) : categories,
      lastChecked: now,
      detailsUrl: latest.result || `https://urlscan.io/search/#${encodeURIComponent(target.value)}`,
    };

    if (isMalicious || score >= 50) {
      findings.push({
        id: `finding-urlscan-malicious-${target.value}-${now}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `URLScan Sandbox Verdict: Flagged Malicious (Score: ${score}/100)`,
        severity: "high",
        evidence: `URLScan sandbox analysis flagged target as malicious.${brands.length > 0 ? ` Detected brand targeting: ${brands.join(", ")}.` : ""} Categories: ${combinedCategories.join(", ") || "malicious"}.`,
        confidence: 0.92,
        source: this.id,
        timestamp: now,
        metadata: { score, brands, categories, screenshot: latest.screenshot, fromCache, ageSeconds },
        remediation: "Do not interact with or provide credentials to this URL.",
      });
    } else if (latest.page?.title) {
      findings.push({
        id: `finding-urlscan-page-${target.value}-${now}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Observed Page Title: "${latest.page.title}"`,
        severity: "informational",
        evidence: `Historical page capture rendered title: "${latest.page.title}" on server ${latest.page.server || "unknown"} (${latest.page.ip || "unknown"}).`,
        confidence: 0.95,
        source: this.id,
        timestamp: now,
        metadata: { title: latest.page.title, server: latest.page.server, ip: latest.page.ip, fromCache, ageSeconds },
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
        latestScanId: latest._id,
        screenshot: latest.screenshot,
        page: latest.page,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const urlscanProvider = new UrlscanProvider();
