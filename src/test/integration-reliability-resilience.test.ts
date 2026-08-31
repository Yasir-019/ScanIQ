import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntelligenceCache } from "@/lib/investigation/cache";
import { virusTotalProvider } from "@/lib/investigation/providers/virustotal-provider";
import { abuseIpdbProvider } from "@/lib/investigation/providers/abuseipdb-provider";
import { urlscanProvider } from "@/lib/investigation/providers/urlscan-provider";
import { googleSafeBrowsingProvider } from "@/lib/investigation/providers/safebrowsing-provider";
import { crtshProvider } from "@/lib/investigation/providers/crtsh-provider";
import { investigationEngine } from "@/lib/investigation/engine";
import type { ScanRecord } from "@/lib/scan/types";

describe("ScanIQ Community — Phase 13: Integration Reliability & Resilience", () => {
  beforeEach(() => {
    IntelligenceCache.clear();
    IntelligenceCache.clearRateLimits();
    vi.restoreAllMocks();
  });

  describe("1. Rate Limiting & Cooldown Management", () => {
    it("enters cooldown upon receiving HTTP 429 and skips repeated queries", async () => {
      // Mock fetch returning 429
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      const result1 = await virusTotalProvider.execute(
        { type: "domain", value: "rate-limited-test.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid_dummy_vt_key" }
      );

      expect(result1.status).toBe("rate_limited");
      expect(IntelligenceCache.getRateLimitStatus("virus-total").isLimited).toBe(true);

      // Immediate second call should be caught by checkPrerequisites without triggering fetch
      const result2 = await virusTotalProvider.execute(
        { type: "domain", value: "rate-limited-test.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid_dummy_vt_key" }
      );

      expect(result2.status).toBe("rate_limited");
      expect(result2.error).toContain("cooling down");
      // fetch should only have been called once
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("2. Authentication Failure Handling", () => {
    it("accurately classifies HTTP 401/403 as authentication_error and sanitizes secret", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const result = await abuseIpdbProvider.execute(
        { type: "ip", value: "1.1.1.1" },
        { userConsent: true, isSourceEnabled: true, apiKey: "secret_abuse_key_12345" }
      );

      expect(result.status).toBe("authentication_error");
      expect(result.error).not.toContain("secret_abuse_key_12345");
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("3. Timeout and Network Failure Resilience", () => {
    it("handles request timeout cleanly via AbortSignal", async () => {
      global.fetch = vi.fn().mockImplementationOnce(
        (_url, options) =>
          new Promise((_, reject) => {
            options.signal.addEventListener("abort", () => {
              reject(new Error("Timeout after 50ms"));
            });
          })
      );

      const result = await urlscanProvider.execute(
        { type: "domain", value: "slow-endpoint.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "dummy_key", timeoutMs: 50 }
      );

      expect(result.status).toBe("timeout");
      expect(result.findings).toHaveLength(0);
    });

    it("handles unexpected network disconnects without throwing exceptions", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch"));

      const result = await googleSafeBrowsingProvider.execute(
        { type: "url", value: "https://test-offline.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "dummy_gsb_key" }
      );

      expect(result.status).toBe("network_error");
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("4. Malformed Response Defense", () => {
    it("defensively handles non-JSON / HTML error pages from upstream providers", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON at position 0");
        },
      });

      const result = await crtshProvider.execute(
        { type: "domain", value: "malformed-response.com" },
        { userConsent: true, isSourceEnabled: true }
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("invalid or non-JSON");
      expect(result.findings).toHaveLength(0);
    });
  });

  describe("5. Graceful Degradation & Zero Fabrication Guarantee", () => {
    it("completes full local investigation even when all external providers fail", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("All networks down"));

      const scan: ScanRecord = {
        id: "scan-failover-1",
        content: "https://paypal-update-account-portal.xyz/login",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-failover", {
        userConsent: true,
      });

      // Report should be complete
      expect(report.status).toBe("complete");
      // Local heuristics must still flag the brand impersonation and suspicious TLD
      expect(findings.length).toBeGreaterThan(0);
      expect(report.finalRisk.overall).not.toBe("unknown");
      // Missing intelligence must be recorded truthfully
      expect(report.finalRisk.missingIntelligence.length).toBeGreaterThan(0);
    });
  });
});
