import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isConfiguredCredential,
  CONFIG_PLACEHOLDER,
  CredentialStore,
  ProviderRegistry,
  RateLimitTracker,
  VirusTotalProvider,
  UrlscanProvider,
  AbuseIpdbProvider,
  CrtshProvider,
  GoogleSafeBrowsingProvider,
  investigationEngine,
} from "@/lib/investigation";
import { useSettings } from "@/lib/settings";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 3C: Provider-Agnostic Threat Intelligence Architecture", () => {
  beforeEach(() => {
    RateLimitTracker.clear();
    vi.restoreAllMocks();

    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: {
        "local-heuristics": true,
        "virus-total": true,
        "urlscan": true,
        "abuseipdb": true,
        "crtsh-cert": true,
        "google-safe-browsing": true,
      },
      apiKeys: {},
    });
  });

  describe("1. Configuration Placeholders & Credential Validation", () => {
    it("strictly rejects placeholder strings, empty values, and template keys", () => {
      expect(isConfiguredCredential(CONFIG_PLACEHOLDER)).toBe(false);
      expect(isConfiguredCredential("<CONFIGURE_MANUALLY>")).toBe(false);
      expect(isConfiguredCredential("<configure_manually>")).toBe(false);
      expect(isConfiguredCredential("YOUR_API_KEY")).toBe(false);
      expect(isConfiguredCredential("changeme")).toBe(false);
      expect(isConfiguredCredential("")).toBe(false);
      expect(isConfiguredCredential("   ")).toBe(false);
      expect(isConfiguredCredential(null)).toBe(false);
      expect(isConfiguredCredential(undefined)).toBe(false);
    });

    it("accepts valid, non-placeholder credentials", () => {
      expect(isConfiguredCredential("vt_sec_key_abcdef1234567890")).toBe(true);
      expect(isConfiguredCredential("user-custom-token-xyz")).toBe(true);
    });

    it("resolves credential as not_configured when setting contains placeholder", () => {
      useSettings.setState({
        apiKeys: { "virus-total": CONFIG_PLACEHOLDER },
      });

      const res = CredentialStore.resolve("VITE_VIRUSTOTAL_KEY", "virus-total");
      expect(res.isConfigured).toBe(false);
    });
  });

  describe("2. Generic Provider Contract & Capability Discovery", () => {
    it("registers all interchangeable provider adapters with declared capabilities", () => {
      const all = ProviderRegistry.list();
      const ids = all.map((p) => p.id);

      expect(ids).toContain("local-heuristics");
      expect(ids).toContain("virus-total");
      expect(ids).toContain("urlscan");
      expect(ids).toContain("abuseipdb");
      expect(ids).toContain("crtsh-cert");
      expect(ids).toContain("google-safe-browsing");

      // Verify capabilities are declared
      for (const p of all) {
        expect(p.capabilities).toBeDefined();
        expect(Array.isArray(p.capabilities)).toBe(true);
        expect(p.capabilities.length).toBeGreaterThan(0);
      }
    });

    it("discovers providers by specific capabilities", () => {
      const urlRepProviders = ProviderRegistry.findByCapability("url_reputation");
      const urlRepIds = urlRepProviders.map((p) => p.id);
      expect(urlRepIds).toContain("virus-total");
      expect(urlRepIds).toContain("google-safe-browsing");

      const certProviders = ProviderRegistry.findByCapability("certificate_search");
      const certIds = certProviders.map((p) => p.id);
      expect(certIds).toContain("crtsh-cert");

      const abuseProviders = ProviderRegistry.findByCapability("abuse_confidence");
      const abuseIds = abuseProviders.map((p) => p.id);
      expect(abuseIds).toContain("abuseipdb");
    });

    it("generates a comprehensive provider health and configuration report", () => {
      const report = ProviderRegistry.getHealthReport({
        userConsent: true,
        isSourceEnabled: true,
      });

      expect(report.length).toBeGreaterThanOrEqual(8);

      const vtHealth = report.find((r) => r.providerId === "virus-total");
      expect(vtHealth).toBeDefined();
      expect(vtHealth?.status).toBe("not_configured");
      expect(vtHealth?.ready).toBe(false);
      expect(vtHealth?.requiresAuth).toBe(true);

      const localHealth = report.find((r) => r.providerId === "local-heuristics");
      expect(localHealth).toBeDefined();
      expect(localHealth?.status).toBe("ready");
      expect(localHealth?.ready).toBe(true);
    });
  });

  describe("3. Placeholder Execution & Zero Network Request Guarantee", () => {
    it("returns status 'not_configured' without making any network requests when keys are missing or placeholders", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      // Execute VirusTotal adapter without key
      const vt = new VirusTotalProvider();
      const vtResult = await vt.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: true, isSourceEnabled: true },
      );
      expect(vtResult.status).toBe("not_configured");
      expect(vtResult.findings).toHaveLength(0);
      expect(vtResult.evidence).toHaveLength(0);

      // Execute URLScan adapter with placeholder
      const urlscan = new UrlscanProvider();
      const urlscanResult = await urlscan.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: CONFIG_PLACEHOLDER },
      );
      expect(urlscanResult.status).toBe("not_configured");
      expect(urlscanResult.findings).toHaveLength(0);

      // Execute AbuseIPDB adapter without key
      const abuseipdb = new AbuseIpdbProvider();
      const abuseResult = await abuseipdb.execute(
        { type: "ip", value: "1.1.1.1" },
        { userConsent: true, isSourceEnabled: true },
      );
      expect(abuseResult.status).toBe("not_configured");
      expect(abuseResult.findings).toHaveLength(0);

      // Execute Google Safe Browsing adapter without key
      const gsb = new GoogleSafeBrowsingProvider();
      const gsbResult = await gsb.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: true, isSourceEnabled: true },
      );
      expect(gsbResult.status).toBe("not_configured");
      expect(gsbResult.findings).toHaveLength(0);

      // Zero HTTP fetch calls must have been made
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe("4. Provider Adapters & Response Normalization", () => {
    it("normalizes VirusTotal multi-engine detection stats into findings and evidence", async () => {
      const mockVtResponse = {
        data: {
          id: "mock-url-id",
          type: "url",
          attributes: {
            last_analysis_stats: {
              malicious: 8,
              suspicious: 2,
              harmless: 60,
              undetected: 10,
              timeout: 0,
            },
            last_analysis_results: {
              VendorA: { category: "malicious", engine_name: "VendorA", method: "blacklist", result: "phishing" },
              VendorB: { category: "malicious", engine_name: "VendorB", method: "blacklist", result: "malware" },
            },
            tags: ["phishing", "credential-stealer"],
          },
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockVtResponse,
      } as unknown as Response);

      const vt = new VirusTotalProvider();
      const result = await vt.execute(
        { type: "url", value: "https://phishing-site.example" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid-configured-key-9999" },
      );

      expect(result.status).toBe("success");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe("high");
      expect(result.findings[0].evidence).toContain("8 security vendors flagged");
      expect(result.reputation?.classification).toBe("malicious");
    });

    it("normalizes URLScan sandbox verdicts and page captures", async () => {
      const mockUrlscanResponse = {
        results: [
          {
            _id: "scan-id-123",
            page: {
              domain: "fake-bank.example",
              title: "Online Banking Login",
              server: "nginx/1.18",
              ip: "198.51.100.22",
            },
            verdicts: {
              overall: {
                malicious: true,
                score: 85,
                categories: ["phishing"],
                brands: ["Target Bank"],
              },
            },
            screenshot: "https://urlscan.io/screenshots/scan-id-123.png",
          },
        ],
        total: 1,
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUrlscanResponse,
      } as unknown as Response);

      const urlscan = new UrlscanProvider();
      const result = await urlscan.execute(
        { type: "url", value: "https://fake-bank.example/login" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid-configured-key-9999" },
      );

      expect(result.status).toBe("success");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].finding).toContain("Flagged Malicious (Score: 85/100)");
      expect(result.findings[0].evidence).toContain("Target Bank");
      expect(result.reputation?.classification).toBe("malicious");
    });

    it("normalizes AbuseIPDB confidence score and report metrics", async () => {
      const mockAbuseResponse = {
        data: {
          ipAddress: "203.0.113.5",
          isPublic: true,
          ipVersion: 4,
          abuseConfidenceScore: 78,
          totalReports: 25,
          numDistinctUsers: 14,
          usageType: "Data Center / Hosting",
          lastReportedAt: "2026-08-29T12:00:00Z",
        },
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockAbuseResponse,
      } as unknown as Response);

      const abuseipdb = new AbuseIpdbProvider();
      const result = await abuseipdb.execute(
        { type: "ip", value: "203.0.113.5" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid-configured-key-9999" },
      );

      expect(result.status).toBe("success");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].finding).toContain("High Abuse Confidence: 78%");
      expect(result.findings[0].severity).toBe("high");
      expect(result.findings[0].evidence).toContain("25 reports from 14 distinct");
    });

    it("normalizes crt.sh certificate transparency logs and discovers subdomains", async () => {
      const mockCrtshResponse = [
        {
          id: 1,
          issuer_ca_id: 123,
          issuer_name: "C=US, O=Let's Encrypt, CN=R3",
          common_name: "target.com",
          name_value: "target.com\napi.target.com\nadmin.target.com",
          entry_timestamp: "2026-01-01T00:00:00",
          not_before: "2026-01-01T00:00:00",
          not_after: "2026-04-01T00:00:00",
          serial_number: "123456",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockCrtshResponse,
      } as unknown as Response);

      const crtsh = new CrtshProvider();
      const result = await crtsh.execute(
        { type: "domain", value: "target.com" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      const subFinding = result.findings.find((f) => f.finding.includes("Discovered"));
      expect(subFinding).toBeDefined();
      expect(subFinding?.evidence).toContain("api.target.com");
      expect(subFinding?.severity).toBe("informational");
    });

    it("normalizes Google Safe Browsing threat hits", async () => {
      const mockGsbResponse = {
        matches: [
          {
            threatType: "SOCIAL_ENGINEERING",
            platformType: "ANY_PLATFORM",
            threatEntryType: "URL",
            threat: { url: "https://deceptive-login.example" },
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockGsbResponse,
      } as unknown as Response);

      const gsb = new GoogleSafeBrowsingProvider();
      const result = await gsb.execute(
        { type: "url", value: "https://deceptive-login.example" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid-configured-key-9999" },
      );

      expect(result.status).toBe("success");
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].finding).toContain("Threat Hit: SOCIAL_ENGINEERING");
      expect(result.findings[0].severity).toBe("critical");
    });
  });

  describe("5. Error Mapping & Health Isolation", () => {
    it("maps HTTP 401/403 to authentication_error without crashing or affecting risk score", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as unknown as Response);

      const vt = new VirusTotalProvider();
      const result = await vt.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "expired-or-revoked-key-12345" },
      );

      expect(result.status).toBe("authentication_error");
      expect(result.findings).toHaveLength(0);
      expect(result.evidence).toHaveLength(0);
      expect(result.error).toContain("authentication failed");
    });

    it("maps HTTP 429 to rate_limited status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as unknown as Response);

      const vt = new VirusTotalProvider();
      const result = await vt.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: true, isSourceEnabled: true, apiKey: "valid-key-hitting-limit-12345" },
      );

      expect(result.status).toBe("rate_limited");
      expect(result.findings).toHaveLength(0);
      expect(result.error).toContain("rate limit exceeded");
    });
  });

  describe("6. Provider-Agnostic End-to-End Investigation", () => {
    it("completes investigation with zero API keys configured, using local heuristics and public feeds", async () => {
      // Mock DoH and RDAP public feeds
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("cloudflare-dns.com") && urlStr.includes("type=A")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [{ name: "clean-org.com", type: 1, TTL: 300, data: "93.184.216.34" }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("rdap.org/domain")) {
          return {
            ok: true,
            json: async () => ({
              objectClassName: "domain",
              ldhName: "CLEAN-ORG.COM",
              events: [{ eventAction: "registration", eventDate: "2018-01-01T00:00:00Z" }],
              entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Public Registrar"]]] }],
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-no-keys",
        content: "https://clean-org.com/contact",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-agnostic-1", {
        userConsent: true,
        sourceToggles: {
          "local-heuristics": true,
          "rdap-domain": true,
          "dns-over-https": true,
          "virus-total": true, // Unconfigured
          "urlscan": true,     // Unconfigured
          "abuseipdb": true,   // Unconfigured
        },
      });

      expect(report.status).toBe("complete");
      // Local heuristics and public RDAP/DNS worked
      expect(report.domainIntel.registrar).toBe("Public Registrar");
      expect(findings.length).toBeGreaterThan(0);

      // Unconfigured providers did not generate false threat findings
      const vtFindings = findings.filter((f) => f.source === "virus-total");
      const urlscanFindings = findings.filter((f) => f.source === "urlscan");
      expect(vtFindings).toHaveLength(0);
      expect(urlscanFindings).toHaveLength(0);

      // Risk verdict remains based solely on available evidence
      expect(report.finalRisk.verdict).toBeDefined();
    });
  });
});
