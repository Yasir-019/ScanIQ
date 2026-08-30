import type {
  ProviderCategory,
  ProviderCapability,
  ProviderContext,
  ProviderMetadata,
  ProviderPrivacy,
  ProviderResult,
  ProviderStatus,
  ProviderTarget,
  RateLimitInfo,
  TargetType,
} from "./types";
import type {
  ReputationResult,
  RiskEvidence,
  RiskLevel,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
  FindingSeverity,
  TargetCollection,
} from "../types";
import { CredentialStore } from "./credential-store";
import { isConfiguredCredential } from "./config";
import { normalizeAndAnalyzeUrl } from "../url-normalizer";
import { analyzeUrlHeuristics } from "../url-heuristics";
import { analyzeDomain } from "../domain-analyzer";
import { analyzeRedirectPatternsLocally } from "../redirect-analyzer";
import { analyzeHostLocally } from "../dns-analyzer";

function mapSeverityToRiskLevel(sev: FindingSeverity): RiskLevel {
  switch (sev) {
    case "critical": return "critical";
    case "high": return "high";
    case "medium": return "medium";
    case "low": return "low";
    case "informational": return "benign";
    default: return "unknown";
  }
}

/**
 * Base abstract class for all ScanIQ intelligence providers (both local and external).
 * Implements standard pre-flight validation, capability matching, timeout management,
 * error isolation, rate limit handling, secret redaction, and response normalization.
 */
export abstract class BaseIntelligenceProvider implements ProviderMetadata {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly type: "local" | "external";
  public abstract readonly category: ProviderCategory;
  public abstract readonly privacy: ProviderPrivacy;
  public abstract readonly supportedTargets: TargetType[];
  public abstract readonly capabilities: ProviderCapability[];
  public abstract readonly requiresAuth: boolean;
  public abstract readonly description: string;

  public readonly envKey?: string;
  public readonly authConfigKey?: string;
  public readonly docsUrl?: string;
  public readonly rateLimitHints?: string;
  public readonly defaultTimeoutMs: number = 8000;

  /**
   * Checks if this provider supports the given target type.
   */
  public canHandle(target: ProviderTarget): boolean {
    return this.supportedTargets.includes(target.type);
  }

  /**
   * Checks if this provider supports a specific capability.
   */
  public hasCapability(capability: ProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }

  /**
   * Checks if prerequisites (user consent, enabled toggle, and required credentials) are met.
   */
  public checkPrerequisites(context: ProviderContext): {
    ready: boolean;
    status: ProviderStatus;
    reason?: string;
  } {
    // 1. Check if source is enabled by user
    if (!context.isSourceEnabled) {
      return {
        ready: false,
        status: "disabled",
        reason: `Provider '${this.name}' is disabled in settings.`,
      };
    }

    // 2. External providers strictly require explicit user consent
    if (this.type === "external" && !context.userConsent) {
      return {
        ready: false,
        status: "consent_required",
        reason: "External intelligence lookups require explicit user consent.",
      };
    }

    // 3. Check credentials if required (validates against placeholders)
    if (this.requiresAuth) {
      const cred = CredentialStore.resolve(this.envKey, this.id);
      const isContextKeyValid = isConfiguredCredential(context.apiKey);
      if (!cred.isConfigured && !isContextKeyValid) {
        return {
          ready: false,
          status: "not_configured",
          reason: `Provider '${this.name}' is not configured (<CONFIGURE_MANUALLY>).`,
        };
      }
    }

    return { ready: true, status: "ready" };
  }

  /**
   * Safe execution template method.
   * Handles timeouts, credentials, errors, and secret redaction.
   */
  public async execute(
    target: ProviderTarget,
    context: ProviderContext,
  ): Promise<ProviderResult> {
    const startTime = performance.now();
    const queriedAt = Date.now();

    // 1. Verify target support
    if (!this.canHandle(target)) {
      return {
        providerId: this.id,
        providerName: this.name,
        category: this.category,
        privacy: this.privacy,
        target,
        queriedAt,
        executionTimeMs: Math.round(performance.now() - startTime),
        status: "unsupported",
        findings: [],
        evidence: [],
        warnings: [`Target type '${target.type}' is not supported by ${this.name}.`],
      };
    }

    // 2. Check prerequisites (handles not_configured, disabled, consent_required)
    const prereq = this.checkPrerequisites(context);
    if (!prereq.ready) {
      const execStatus = prereq.status === "not_configured"
        ? "not_configured"
        : prereq.status === "missing_key"
        ? "unauthorized"
        : "skipped";

      return {
        providerId: this.id,
        providerName: this.name,
        category: this.category,
        privacy: this.privacy,
        target,
        queriedAt,
        executionTimeMs: Math.round(performance.now() - startTime),
        status: execStatus,
        findings: [],
        evidence: [],
        error: prereq.reason,
        warnings: prereq.reason ? [prereq.reason] : [],
      };
    }

    // 3. Resolve API Key safely
    const resolvedKey = isConfiguredCredential(context.apiKey)
      ? context.apiKey
      : CredentialStore.resolve(this.envKey, this.id).key;

    // 4. Setup timeout and abort signal
    const timeoutMs = context.timeoutMs || this.defaultTimeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);

    // Merge external signal if supplied
    if (context.signal) {
      context.signal.addEventListener("abort", () => controller.abort(context.signal?.reason));
    }

    try {
      // Execute the provider-specific query
      const rawData = await this.performQuery(target, { ...context, apiKey: resolvedKey }, controller.signal);
      clearTimeout(timer);

      // Normalize the raw response into standard findings & evidence
      const normalized = await this.normalize(rawData, target, context);

      return {
        providerId: this.id,
        providerName: this.name,
        category: this.category,
        privacy: this.privacy,
        target,
        queriedAt,
        executionTimeMs: Math.round(performance.now() - startTime),
        status: "success",
        findings: normalized.findings,
        evidence: normalized.evidence,
        reputation: normalized.reputation,
        rateLimit: normalized.rateLimit,
        warnings: normalized.warnings || [],
        metadata: normalized.metadata,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isTimeout = controller.signal.aborted || (err instanceof Error && err.message.includes("Timeout"));
      const rawMsg = err instanceof Error ? err.message : String(err);
      
      // Redact any secrets that might be present in error message
      const secretsToRedact = resolvedKey ? [resolvedKey] : [];
      const cleanError = CredentialStore.redact(rawMsg, secretsToRedact);

      let status: ProviderResult["status"] = "error";
      if (isTimeout) {
        status = "timeout";
      } else if (cleanError.includes("429") || cleanError.toLowerCase().includes("rate limit")) {
        status = "rate_limited";
      } else if (cleanError.includes("401") || cleanError.includes("403") || cleanError.toLowerCase().includes("unauthorized") || cleanError.toLowerCase().includes("forbidden")) {
        status = "authentication_error";
      } else if (cleanError.toLowerCase().includes("network") || cleanError.toLowerCase().includes("fetch") || cleanError.toLowerCase().includes("failed to fetch")) {
        status = "network_error";
      }

      return {
        providerId: this.id,
        providerName: this.name,
        category: this.category,
        privacy: this.privacy,
        target,
        queriedAt,
        executionTimeMs: Math.round(performance.now() - startTime),
        status,
        findings: [],
        evidence: [],
        error: cleanError,
        warnings: [`Provider query failed: ${cleanError}`],
      };
    }
  }

  /**
   * Provider-specific query execution.
   */
  protected abstract performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<unknown>;

  /**
   * Provider-specific normalization into standardized findings and evidence.
   */
  protected abstract normalize(
    rawResponse: unknown,
    target: ProviderTarget,
    context: ProviderContext,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    reputation?: ReputationResult;
    rateLimit?: RateLimitInfo;
    warnings?: string[];
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Local Heuristic Intelligence Provider.
 * Runs instantly on device with 0 network calls.
 */
export class LocalHeuristicProvider extends BaseIntelligenceProvider {
  public readonly id = "local-heuristics";
  public readonly name = "Local Heuristic & Static Engine";
  public readonly type = "local" as const;
  public readonly category = "heuristic" as const;
  public readonly privacy = "local" as const;
  public readonly requiresAuth = false;
  public readonly supportedTargets: TargetType[] = ["url", "domain", "fqdn", "ip", "raw_payload"];
  public readonly capabilities: ProviderCapability[] = ["heuristic_analysis"];
  public readonly description =
    "Performs instant, zero-network analysis on decoded QR payloads, URL structures, domain names, and encoding anomalies.";

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
  ): Promise<{ target: ProviderTarget }> {
    // Local query is synchronous and immediate
    return { target };
  }

  protected async normalize(
    _raw: unknown,
    target: ProviderTarget,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    warnings?: string[];
  }> {
    const findings: InvestigationFinding[] = [];

    if (target.type === "url" || (target.type === "raw_payload" && (target.value.startsWith("http") || target.value.includes("://")))) {
      const { result: normResult, findings: normFindings } = normalizeAndAnalyzeUrl(target.value);
      findings.push(...normFindings);

      if (normResult.isValid) {
        // Run URL Heuristics
        findings.push(...analyzeUrlHeuristics(normResult));

        // Run Domain Analysis
        if (normResult.summary.domain) {
          findings.push(...analyzeDomain(normResult.summary.domain));
        }

        // Run Local Redirect Analysis
        const { findings: redirectFindings } = analyzeRedirectPatternsLocally(normResult);
        findings.push(...redirectFindings);
      }
    } else if (target.type === "domain" || target.type === "fqdn") {
      findings.push(...analyzeDomain(target.value));
    } else if (target.type === "ip") {
      const { findings: hostFindings } = analyzeHostLocally(target.value);
      findings.push(...hostFindings);
    }

    const evidence: RiskEvidence[] = findings.map((f) => ({
      id: f.id,
      source: this.id,
      title: f.finding,
      description: f.evidence,
      severity: mapSeverityToRiskLevel(f.severity),
      confidence: f.confidence,
      discoveredAt: f.timestamp,
    }));

    return { findings, evidence };
  }

  /**
   * Comprehensive local target collection analyzer for the investigation engine.
   */
  public async analyzeCollection(
    targets: TargetCollection,
    rawContent: string,
    context: ProviderContext,
  ): Promise<ProviderResult[]> {
    const results: ProviderResult[] = [];

    // Analyze URL targets
    if (targets.urls.length > 0) {
      for (const u of targets.urls) {
        const fullUrl = u.fqdn ? `${u.scheme}://${u.fqdn}${u.path}${u.query}` : rawContent;
        results.push(await this.execute({ type: "url", value: fullUrl }, context));
      }
    } else if (rawContent.startsWith("http") || rawContent.includes("://")) {
      results.push(await this.execute({ type: "url", value: rawContent }, context));
    } else {
      results.push(await this.execute({ type: "raw_payload", value: rawContent }, context));
    }

    // Analyze IP targets
    for (const ip of targets.ips) {
      results.push(await this.execute({ type: "ip", value: ip }, context));
    }

    return results;
  }
}

export const localHeuristicProvider = new LocalHeuristicProvider();
