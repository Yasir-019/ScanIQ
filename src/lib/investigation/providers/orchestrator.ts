import type {
  ProviderContext,
  ProviderExecutionStatus,
  ProviderResult,
  ProviderTarget,
  TargetType,
} from "./types";
import type {
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
  TargetCollection,
} from "../types";
import { ProviderRegistry, RateLimitTracker } from "./registry";
import { useSettings } from "@/lib/settings";

export interface OrchestrationOptions {
  userConsent?: boolean;
  sourceToggles?: Record<string, boolean>;
  timeoutMs?: number;
  providerIds?: string[];
  signal?: AbortSignal;
}

export interface OrchestrationSummary {
  providerId: string;
  providerName: string;
  category: string;
  status: ProviderExecutionStatus;
  executionTimeMs: number;
  findingsCount: number;
  error?: string;
  warnings: string[];
}

export interface OrchestrationResult {
  results: ProviderResult[];
  findings: InvestigationFinding[];
  evidence: RiskEvidence[];
  summaries: OrchestrationSummary[];
  executedAt: number;
  totalDurationMs: number;
}

export class ProviderOrchestrator {
  /**
   * Converts a TargetCollection and raw content into discrete ProviderTargets.
   */
  public static extractTargets(
    targets: TargetCollection,
    rawContent: string,
  ): ProviderTarget[] {
    const extracted: ProviderTarget[] = [];
    const seen = new Set<string>();

    const addTarget = (type: TargetType, value: string, metadata?: Record<string, unknown>) => {
      const key = `${type}:${value}`;
      if (!seen.has(key) && value.trim().length > 0) {
        seen.add(key);
        extracted.push({ type, value: value.trim(), raw: rawContent, metadata });
      }
    };

    // 1. URLs
    for (const u of targets.urls) {
      const fullUrl = u.fqdn ? `${u.scheme}://${u.fqdn}${u.path}${u.query}` : "";
      if (fullUrl) {
        addTarget("url", fullUrl, { fqdn: u.fqdn, domain: u.domain, scheme: u.scheme });
      }
    }

    // 2. Domains and FQDNs
    for (const d of targets.domains) {
      addTarget("domain", d);
    }
    for (const h of targets.hosts) {
      addTarget("fqdn", h);
    }

    // 3. IP Addresses
    for (const ip of targets.ips) {
      addTarget("ip", ip);
    }

    // 4. Emails
    for (const email of targets.emails) {
      addTarget("email", email);
    }

    // 5. Phone numbers
    for (const phone of targets.phoneNumbers) {
      addTarget("phone", phone);
    }

    // 6. Product codes (EAN/UPC/GTIN)
    for (const code of targets.productCodes) {
      addTarget("product", code);
    }

    // 7. Crypto addresses
    for (const crypto of targets.cryptoAddresses) {
      addTarget("crypto", crypto.address, { currency: crypto.currency });
    }

    // Fallback: If no structured targets extracted, add raw payload
    if (extracted.length === 0 && rawContent.trim().length > 0) {
      addTarget("raw_payload", rawContent);
    }

    return extracted;
  }

  /**
   * Executes intelligence providers against targets in parallel with strict failure isolation.
   */
  public static async execute(
    targets: TargetCollection,
    rawContent: string,
    options: OrchestrationOptions = {},
  ): Promise<OrchestrationResult> {
    const startTime = performance.now();
    const executedAt = Date.now();

    // 1. Read app settings for user consent and source toggles
    let userConsent = options.userConsent;
    let sourceToggles = options.sourceToggles;

    try {
      const settings = useSettings.getState();
      if (userConsent === undefined) {
        userConsent = settings.externalLookupsOptedIn;
      }
      if (sourceToggles === undefined) {
        sourceToggles = settings.sourceToggles;
      }
    } catch {
      userConsent = userConsent ?? false;
      sourceToggles = sourceToggles ?? {};
    }

    // 2. Extract discrete targets
    const providerTargets = this.extractTargets(targets, rawContent);

    // 3. Filter providers to execute
    const allProviders = ProviderRegistry.list();
    const activeProviders = options.providerIds
      ? allProviders.filter((p) => options.providerIds?.includes(p.id))
      : allProviders;

    // 4. Prepare execution tasks (provider x matching targets)
    interface Task {
      provider: (typeof activeProviders)[number];
      target: ProviderTarget;
      context: ProviderContext;
    }

    const tasks: Task[] = [];

    for (const provider of activeProviders) {
      const isEnabled = sourceToggles?.[provider.id] !== false;
      const context: ProviderContext = {
        signal: options.signal,
        timeoutMs: options.timeoutMs || provider.defaultTimeoutMs,
        userConsent: !!userConsent,
        isSourceEnabled: isEnabled,
      };

      // Match targets this provider can handle
      const matchedTargets = providerTargets.filter((t) => provider.canHandle(t));

      if (matchedTargets.length > 0) {
        for (const target of matchedTargets) {
          tasks.push({ provider, target, context });
        }
      } else if (provider.supportedTargets.includes("raw_payload")) {
        // Run against raw payload if supported
        tasks.push({
          provider,
          target: { type: "raw_payload", value: rawContent },
          context,
        });
      }
    }

    // 5. Execute all tasks in parallel using Promise.allSettled for complete failure isolation
    const settledResults = await Promise.allSettled(
      tasks.map((task) => task.provider.execute(task.target, task.context)),
    );

    // 6. Aggregate results
    const results: ProviderResult[] = [];
    const allFindings: InvestigationFinding[] = [];
    const allEvidence: RiskEvidence[] = [];
    const summaries: OrchestrationSummary[] = [];

    for (let i = 0; i < settledResults.length; i++) {
      const outcome = settledResults[i];
      const task = tasks[i];

      if (outcome.status === "fulfilled") {
        const res = outcome.value;
        results.push(res);
        allFindings.push(...res.findings);
        allEvidence.push(...res.evidence);

        // Record rate limit state if reported
        if (res.rateLimit) {
          RateLimitTracker.recordLimit(res.providerId, res.rateLimit);
        }

        summaries.push({
          providerId: res.providerId,
          providerName: res.providerName,
          category: res.category,
          status: res.status,
          executionTimeMs: res.executionTimeMs,
          findingsCount: res.findings.length,
          error: res.error,
          warnings: res.warnings,
        });
      } else {
        // Unexpected unhandled rejection in provider execution
        const errMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
        const errorResult: ProviderResult = {
          providerId: task.provider.id,
          providerName: task.provider.name,
          category: task.provider.category,
          privacy: task.provider.privacy,
          target: task.target,
          queriedAt: Date.now(),
          executionTimeMs: 0,
          status: "error",
          findings: [],
          evidence: [],
          error: errMsg,
          warnings: [`Unexpected provider execution failure: ${errMsg}`],
        };
        results.push(errorResult);
        summaries.push({
          providerId: task.provider.id,
          providerName: task.provider.name,
          category: task.provider.category,
          status: "error",
          executionTimeMs: 0,
          findingsCount: 0,
          error: errMsg,
          warnings: errorResult.warnings,
        });
      }
    }

    // 7. Secondary Target Discovery (e.g. DNS resolved public IPs not originally in targets.ips)
    const discoveredIps = new Set<string>();
    for (const res of results) {
      if (res.status === "success" && res.metadata?.discoveredIps && Array.isArray(res.metadata.discoveredIps)) {
        for (const ip of res.metadata.discoveredIps) {
          if (typeof ip === "string" && !targets.ips.includes(ip)) {
            discoveredIps.add(ip);
          }
        }
      }
    }

    if (discoveredIps.size > 0) {
      const ipProviders = activeProviders.filter((p) => p.canHandle({ type: "ip", value: "" }));
      const stage2Tasks: Task[] = [];

      for (const ip of discoveredIps) {
        for (const provider of ipProviders) {
          const isEnabled = sourceToggles?.[provider.id] !== false;
          const context: ProviderContext = {
            signal: options.signal,
            timeoutMs: options.timeoutMs || provider.defaultTimeoutMs,
            userConsent: !!userConsent,
            isSourceEnabled: isEnabled,
          };
          stage2Tasks.push({ provider, target: { type: "ip", value: ip }, context });
        }
      }

      if (stage2Tasks.length > 0) {
        const stage2Settled = await Promise.allSettled(
          stage2Tasks.map((t) => t.provider.execute(t.target, t.context)),
        );

        for (let i = 0; i < stage2Settled.length; i++) {
          const outcome = stage2Settled[i];
          const task = stage2Tasks[i];

          if (outcome.status === "fulfilled") {
            const res = outcome.value;
            results.push(res);
            allFindings.push(...res.findings);
            allEvidence.push(...res.evidence);

            if (res.rateLimit) {
              RateLimitTracker.recordLimit(res.providerId, res.rateLimit);
            }

            summaries.push({
              providerId: res.providerId,
              providerName: res.providerName,
              category: res.category,
              status: res.status,
              executionTimeMs: res.executionTimeMs,
              findingsCount: res.findings.length,
              error: res.error,
              warnings: res.warnings,
            });
          } else {
            const errMsg = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
            results.push({
              providerId: task.provider.id,
              providerName: task.provider.name,
              category: task.provider.category,
              privacy: task.provider.privacy,
              target: task.target,
              queriedAt: Date.now(),
              executionTimeMs: 0,
              status: "error",
              findings: [],
              evidence: [],
              error: errMsg,
              warnings: [`Secondary IP provider query failed: ${errMsg}`],
            });
          }
        }
      }
    }

    const totalDurationMs = Math.round(performance.now() - startTime);

    return {
      results,
      findings: allFindings,
      evidence: allEvidence,
      summaries,
      executedAt,
      totalDurationMs,
    };
  }
}
