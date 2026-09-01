import { describe, it, expect, beforeEach, vi } from "vitest";
import { investigationEngine } from "@/lib/investigation";
import { ProviderRegistry, RateLimitTracker } from "@/lib/investigation/providers/registry";
import { IntelligenceCache } from "@/lib/investigation/cache";
import { useSettings } from "@/lib/settings";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 18: Provider Fault Injection & Resilience Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    RateLimitTracker.clear();
    IntelligenceCache.clearRateLimits();
    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: {
        "local-heuristics": true,
        "dns-over-https": true,
        "rdap-domain": true,
        "ipinfo": true,
        "virus-total": true,
        "urlscan": true,
        "abuseipdb": true,
        "safebrowsing": true,
      },
      apiKeys: {
        "virus-total": "mock-test-vt-key",
        "urlscan": "mock-test-urlscan-key",
        "abuseipdb": "mock-test-abuseipdb-key",
        "safebrowsing": "mock-test-gsb-key",
      },
    });
  });

  describe("1. Upstream HTTP 5xx Server Errors", () => {
    it("handles HTTP 500 / 502 / 503 from external providers without breaking pipeline", async () => {
      // Mock fetch returning HTTP 500 for external providers
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("virustotal.com") || urlStr.includes("abuseipdb.com")) {
          return {
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            text: async () => "Upstream provider error: Service Unavailable",
            json: async () => ({ error: { message: "Service Unavailable" } }),
          } as unknown as Response;
        }
        // DoH returns empty valid response
        return {
          ok: true,
          status: 200,
          json: async () => ({ Status: 0, Answer: [] }),
        } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-resilience-500",
        content: "https://test-upstream-fail.org/path",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-resilience-1");

      // Investigation completes successfully
      expect(report.status).toBe("complete");
      expect(report.finalRisk.verdict).toBeDefined();
      expect(findings.length).toBeGreaterThan(0);

      // Missing intelligence accounts for failed providers
      expect(report.finalRisk.missingIntelligence).toBeDefined();
    });
  });

  describe("2. Rate Limiting & HTTP 429 Handling", () => {
    it("handles HTTP 429 rate limit responses gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("urlscan.io") || urlStr.includes("virustotal.com")) {
          return {
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            headers: new Headers({ "Retry-After": "60" }),
            text: async () => "Rate limit exceeded. Try again in 60 seconds.",
            json: async () => ({ message: "Rate limit exceeded", status: 429 }),
          } as unknown as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ Status: 0, Answer: [] }),
        } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-resilience-429",
        content: "https://test-rate-limit.org",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-resilience-2");
      expect(report.status).toBe("complete");
    });
  });

  describe("3. Network Timeouts & AbortController", () => {
    it("handles network timeouts and aborted requests gracefully", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        // Simulate a delayed/hanging request that throws AbortError
        const err = new Error("The operation was aborted");
        err.name = "AbortError";
        throw err;
      });

      const scan: ScanRecord = {
        id: "scan-resilience-timeout",
        content: "https://test-timeout-target.org",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-resilience-3", {
        timeoutMs: 50,
      });

      expect(report.status).toBe("complete");
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("4. Malformed JSON & Corrupted Provider Payloads", () => {
    it("safely handles HTML error pages returned when JSON was expected", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return {
          ok: true,
          status: 200,
          // When a WAF or proxy returns HTML instead of JSON
          json: async () => {
            throw new SyntaxError("Unexpected token '<', '<!DOCTYPE '... is not valid JSON");
          },
          text: async () => "<!DOCTYPE html><html><body>Error 520 Ray ID</body></html>",
        } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-resilience-corrupt-json",
        content: "https://test-corrupt-json.com",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-resilience-4");
      expect(report.status).toBe("complete");
      expect(report.finalRisk).toBeDefined();
    });
  });

  describe("5. Graceful Degradation & Fallback Chain", () => {
    it("executes local heuristics and entropy analyzers even when all external networks are down", async () => {
      // Complete network failure
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Failed to fetch: NetworkError"));

      const scan: ScanRecord = {
        id: "scan-offline-degradation",
        content: "https://suspicious-malware-domain.xyz/login?session=123",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-resilience-5");

      expect(report.status).toBe("complete");
      // Local heuristics still fire: .xyz TLD, Shannon entropy, path inspection
      expect(findings.some((f) => f.finding.toLowerCase().includes("extension") || f.finding.toLowerCase().includes("entropy") || f.finding.toLowerCase().includes("tld"))).toBe(true);
      expect(report.finalRisk.numeric).toBeGreaterThanOrEqual(0);
    });
  });

  describe("6. Zero-Real-Credential Enforcement", () => {
    it("correctly identifies unconfigured providers and disables outbound requests", () => {
      // Clear rate limits and all API keys
      RateLimitTracker.clear();
      IntelligenceCache.clearRateLimits();
      useSettings.setState({ apiKeys: {} });

      const providers = ProviderRegistry.list();
      const authProviders = providers.filter((p) => p.requiresAuth);

      for (const provider of authProviders) {
        const prereq = provider.checkPrerequisites({
          userConsent: true,
          isSourceEnabled: true,
        });
        expect(["not_configured", "unauthorized", "disabled"]).toContain(prereq.status);
      }
    });
  });
});
