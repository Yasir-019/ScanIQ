import { describe, it, expect, beforeEach } from "vitest";
import {
  BaseIntelligenceProvider,
  CredentialStore,
  ProviderOrchestrator,
  ProviderRegistry,
  RateLimitTracker,
  type ProviderCapability,
  type ProviderContext,
  type ProviderTarget,
  type TargetType,
} from "@/lib/investigation/providers";
import type { RiskEvidence, RiskLevel } from "@/lib/scan/types";
import type { InvestigationFinding, FindingSeverity, TargetCollection } from "@/lib/investigation/types";
import { useSettings } from "@/lib/settings";

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

// Mock external provider for testing lifecycle and failure modes
class MockExternalThreatProvider extends BaseIntelligenceProvider {
  public readonly id = "mock-threat-intel";
  public readonly name = "Mock Threat Intel Provider";
  public readonly type = "external" as const;
  public readonly category = "reputation" as const;
  public readonly privacy = "direct" as const;
  public readonly supportedTargets: TargetType[] = ["url", "domain", "ip"];
  public readonly capabilities: ProviderCapability[] = ["url_reputation", "domain_reputation", "ip_reputation"];
  public readonly requiresAuth = true;
  public readonly envKey = "VITE_MOCK_THREAT_KEY";
  public readonly description = "Mock provider used to test external provider lifecycle.";

  public shouldFail = false;
  public failureError = "Simulated upstream 503 Service Unavailable";
  public simulateTimeout = false;
  public rateLimitHit = false;

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ targetValue: string; isMalicious: boolean }> {
    if (this.simulateTimeout) {
      await new Promise((_, reject) => {
        const timer = setTimeout(() => reject(new Error("Timeout")), 500);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("Query aborted"));
        });
      });
    }

    if (this.rateLimitHit) {
      throw new Error("HTTP 429 Too Many Requests: Rate limit exceeded");
    }

    if (this.shouldFail) {
      throw new Error(this.failureError);
    }

    return {
      targetValue: target.value,
      isMalicious: target.value.includes("malicious"),
    };
  }

  protected async normalize(
    rawResponse: unknown,
    target: ProviderTarget,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    warnings?: string[];
  }> {
    const data = rawResponse as { targetValue: string; isMalicious: boolean };
    const findings: InvestigationFinding[] = [];

    if (data.isMalicious) {
      findings.push({
        id: `finding-mock-${target.value}`,
        category: "reputation",
        nature: "external_intelligence",
        finding: `Threat intelligence hit for ${target.value}`,
        severity: "high",
        evidence: "Flagged by community threat intelligence repository",
        confidence: 0.95,
        source: this.name,
        timestamp: Date.now(),
      });
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
}

describe("OSINT Provider Foundation (Phase 3A)", () => {
  let mockProvider: MockExternalThreatProvider;

  beforeEach(() => {
    RateLimitTracker.clear();
    mockProvider = new MockExternalThreatProvider();
    ProviderRegistry.register(mockProvider);
    useSettings.setState({
      externalLookupsOptedIn: false,
      sourceToggles: { [mockProvider.id]: true },
      apiKeys: {},
    });
  });

  describe("Credential Store & Secret Safety", () => {
    it("safely masks API keys without exposing secrets", () => {
      expect(CredentialStore.mask("abcdef1234567890")).toBe("abc••••••••890");
      expect(CredentialStore.mask("12345")).toBe("••••••");
      expect(CredentialStore.mask("")).toBe("");
    });

    it("redacts configured API keys from error messages and logs", () => {
      const secretKey = "super-secret-key-xyz-98765";
      const dirtyError = `Failed to connect with token ${secretKey} on endpoint /v1`;
      const cleanError = CredentialStore.redact(dirtyError, [secretKey]);

      expect(cleanError).not.toContain(secretKey);
      expect(cleanError).toContain("[REDACTED_API_KEY]");
    });

    it("resolves user-configured settings key over environment default", () => {
      useSettings.setState({
        apiKeys: { [mockProvider.id]: "user-supplied-key-12345" },
      });

      const res = CredentialStore.resolve(mockProvider.envKey, mockProvider.id);
      expect(res.isConfigured).toBe(true);
      expect(res.source).toBe("user_setting");
      expect(res.key).toBe("user-supplied-key-12345");
    });
  });

  describe("Privacy & Consent Enforcement", () => {
    it("blocks external lookup when global user consent is disabled", async () => {
      const target: ProviderTarget = { type: "url", value: "https://example.com" };
      const context: ProviderContext = {
        userConsent: false,
        isSourceEnabled: true,
        apiKey: "valid-key-123",
      };

      const result = await mockProvider.execute(target, context);

      expect(result.status).toBe("skipped");
      expect(result.error).toContain("require explicit user consent");
      expect(result.findings).toHaveLength(0);
    });

    it("blocks external lookup when individual provider is disabled", async () => {
      const target: ProviderTarget = { type: "url", value: "https://example.com" };
      const context: ProviderContext = {
        userConsent: true,
        isSourceEnabled: false,
        apiKey: "valid-key-123",
      };

      const result = await mockProvider.execute(target, context);

      expect(result.status).toBe("skipped");
      expect(result.error).toContain("disabled in settings");
    });

    it("blocks execution with not_configured status when required API key is missing", async () => {
      const target: ProviderTarget = { type: "url", value: "https://example.com" };
      const context: ProviderContext = {
        userConsent: true,
        isSourceEnabled: true,
      };

      const result = await mockProvider.execute(target, context);

      expect(["not_configured", "unauthorized"]).toContain(result.status);
      expect(result.error).toMatch(/(not configured|requires an API key)/i);
    });
  });

  describe("Execution & Normalization", () => {
    it("successfully queries and normalizes findings when prerequisites are met", async () => {
      const target: ProviderTarget = { type: "url", value: "https://malicious-site.com" };
      const context: ProviderContext = {
        userConsent: true,
        isSourceEnabled: true,
        apiKey: "valid-test-key-99999",
      };

      const result = await mockProvider.execute(target, context);

      expect(result.status).toBe("success");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe("high");
      expect(result.findings[0].nature).toBe("external_intelligence");
      expect(result.evidence).toHaveLength(1);
    });
  });

  describe("Rate-Limit and Error Handling", () => {
    it("handles rate limit HTTP 429 and records rate limit state", async () => {
      mockProvider.rateLimitHit = true;
      const target: ProviderTarget = { type: "url", value: "https://example.com" };
      const context: ProviderContext = {
        userConsent: true,
        isSourceEnabled: true,
        apiKey: "valid-key-123",
      };

      const result = await mockProvider.execute(target, context);

      expect(result.status).toBe("rate_limited");
      expect(result.error).toContain("429");
    });

    it("handles query timeout gracefully without unhandled rejection", async () => {
      mockProvider.simulateTimeout = true;
      const target: ProviderTarget = { type: "url", value: "https://example.com" };
      const context: ProviderContext = {
        userConsent: true,
        isSourceEnabled: true,
        apiKey: "valid-key-123",
        timeoutMs: 50, // Short timeout
      };

      const result = await mockProvider.execute(target, context);

      expect(result.status).toBe("timeout");
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("Provider Orchestrator & Failure Isolation", () => {
    it("executes multiple providers in parallel and isolates a failing provider from healthy ones", async () => {
      // Configure mock provider to fail
      mockProvider.shouldFail = true;

      const targets: TargetCollection = {
        urls: [
          {
            scheme: "https",
            domain: "example.com",
            fqdn: "example.com",
            subdomains: [],
            tld: "com",
            path: "/",
            query: "",
            fragment: "",
            isIdn: false,
            isIp: false,
            isShortlinkLike: false,
          },
        ],
        domains: ["example.com"],
        hosts: ["example.com"],
        ips: [],
        emails: [],
        phoneNumbers: [],
        cryptoAddresses: [],
        productCodes: [],
      };

      const orchestration = await ProviderOrchestrator.execute(targets, "https://example.com", {
        userConsent: true,
        sourceToggles: {
          "local-heuristics": true,
          [mockProvider.id]: true,
        },
      });

      // Local heuristic provider succeeded
      const localResult = orchestration.results.find((r) => r.providerId === "local-heuristics");
      expect(localResult).toBeDefined();
      expect(localResult?.status).toBe("success");

      // Mock external provider failed safely with error/unconfigured status
      const mockResult = orchestration.results.find((r) => r.providerId === mockProvider.id);
      expect(mockResult).toBeDefined();
      expect(["error", "unauthorized", "not_configured"]).toContain(mockResult?.status);

      // Orchestration succeeded without throwing
      expect(orchestration.summaries.length).toBeGreaterThanOrEqual(2);
      expect(orchestration.findings).toBeDefined();
    });
  });
});
