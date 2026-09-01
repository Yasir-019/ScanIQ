import { describe, it, expect, beforeEach, vi } from "vitest";
import { investigationEngine } from "@/lib/investigation";
import { RateLimitTracker } from "@/lib/investigation/providers/registry";
import { IntelligenceCache } from "@/lib/investigation/cache";
import { analyzeRedirectPatternsLocally } from "@/lib/investigation/redirect-analyzer";
import { normalizeAndAnalyzeUrl } from "@/lib/investigation/url-normalizer";
import { useSettings } from "@/lib/settings";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 19: External Provider Data & Network Adversarial Fuzzing", () => {
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
        "virus-total": "mock-fuzz-vt-key",
        "urlscan": "mock-fuzz-urlscan-key",
        "abuseipdb": "mock-fuzz-abuse-key",
        "safebrowsing": "mock-fuzz-gsb-key",
      },
    });
  });

  describe("1. Fuzzing Provider Response Shapes & Type Confusion", () => {
    it("safely handles bizarre, inverted, and malformed JSON types from external mocks", async () => {
      const adversarialResponses = [
        // Type confusion: array instead of object
        [],
        // Primitive string instead of JSON object
        "Just a plain string response",
        // Null and primitives
        null,
        123456789,
        true,
        // Nested array chaos
        [[[[]]], { data: [[null, false, "error"]] }],
        // Prototype pollution payload in response
        {
          __proto__: { polluted: true },
          constructor: { prototype: { admin: true } },
          status: "OK",
          data: { attributes: null },
        },
        // Extremely deep object nesting (30 levels)
        Array.from({ length: 30 }).reduce<Record<string, unknown>>((acc, _, i) => ({ [`level_${i}`]: acc }), { leaf: "deep" }),
        // Missing expected keys
        { unexpected_key_1: 1, unexpected_key_2: [] },
      ];

      for (const advPayload of adversarialResponses) {
        vi.spyOn(globalThis, "fetch").mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => advPayload,
          text: async () => JSON.stringify(advPayload),
        } as unknown as Response);

        const scan: ScanRecord = {
          id: `scan-fuzz-${Math.random()}`,
          content: "https://test-fuzz-provider-target.org",
          type: "url",
          format: "QR_CODE",
          scannedAt: Date.now(),
        };

        const { report } = await investigationEngine.runInvestigation(scan, "case-fuzz-resp");
        expect(report.status).toBe("complete");
        expect(report.finalRisk.verdict).toBeDefined();

        // Verify prototype was NOT polluted
        expect((Object.prototype as unknown as Record<string, unknown>).polluted).toBeUndefined();
        expect((Object.prototype as unknown as Record<string, unknown>).admin).toBeUndefined();
      }
    });
  });

  describe("2. Fuzzing Adversarial Redirect Chains", () => {
    it("analyzes nested, cyclic, and deceptive redirect URLs without infinite loops", () => {
      const deceptiveRedirectUrls = [
        // Self-referential redirect parameter
        "https://portal.bank.com/login?redirect=https://portal.bank.com/login?redirect=https://evil.com",
        // Nested double-encoded URL redirect
        "https://example.com/out?dest=https%253A%252F%252Fevil-phish.net%252Fauth",
        // Relative redirect path
        "https://example.com/login?next=/../../admin/settings",
        // Protocol downgrade
        "https://secure-site.com/track?url=http://insecure-http.com/steal",
        // Cross-TLD redirect
        "https://brand.com/go?to=https://brand.xyz/login",
        // Multiple redirect keys in same URL
        "https://example.com/r?url=https://target1.com&dest=https://target2.com&next=https://target3.com",
      ];

      for (const targetUrl of deceptiveRedirectUrls) {
        const { result } = normalizeAndAnalyzeUrl(targetUrl);
        const redirectAnalysis = analyzeRedirectPatternsLocally(result);

        expect(redirectAnalysis).toBeDefined();
        if (redirectAnalysis.chain) {
          expect(redirectAnalysis.chain.hopCount).toBeGreaterThanOrEqual(1);
          expect(typeof redirectAnalysis.chain.finalUrl).toBe("string");
          expect(typeof redirectAnalysis.chain.crossesHosts).toBe("boolean");
        }
      }
    });
  });

  describe("3. Fuzzing Massive Provider Payloads", () => {
    it("survives massive 500KB+ JSON response trees without blocking the event loop", async () => {
      // Generate a massive mock response with 2,000 entities
      const massiveData = {
        data: Array.from({ length: 2000 }).map((_, i) => ({
          id: `entity-${i}`,
          type: "indicator",
          attributes: {
            host: `sub-${i}.massive-target.com`,
            ip: `198.51.${(i >> 8) & 255}.${i & 255}`,
            score: i % 100,
            flags: ["anomaly", "suspicious", "fuzzed"],
          },
        })),
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => massiveData,
        text: async () => JSON.stringify(massiveData),
      } as unknown as Response);

      const startTime = performance.now();

      const scan: ScanRecord = {
        id: "scan-massive-fuzz",
        content: "https://massive-target.com",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-fuzz-massive");
      const elapsed = performance.now() - startTime;

      expect(report.status).toBe("complete");
      expect(elapsed).toBeLessThan(1000); // Must complete under 1 second
    });
  });
});
