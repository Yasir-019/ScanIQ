import { describe, it, expect, beforeEach, vi } from "vitest";
import { investigationEngine } from "@/lib/investigation";
import { ProviderRegistry } from "@/lib/investigation/providers/registry";
import type { ScanRecord } from "@/lib/scan/types";
import { useSettings } from "@/lib/settings";

describe("Phase 4: Investigation Workspace, Report & Workflow", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: {
        "local-heuristics": true,
        "rdap-domain": true,
        "dns-over-https": true,
        "ipinfo": true,
        "virus-total": true,
      },
      apiKeys: {},
    });
  });

  describe("1. Complete Investigation Workflow Pipeline", () => {
    it("runs complete scan -> target extraction -> OSINT -> correlation -> risk synthesis pipeline", async () => {
      // Mock DoH and RDAP
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("cloudflare-dns.com")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [{ name: "secure-auth.example.com", type: 1, TTL: 300, data: "93.184.216.34" }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("rdap.org/domain")) {
          return {
            ok: true,
            json: async () => ({
              objectClassName: "domain",
              ldhName: "EXAMPLE.COM",
              events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }],
              entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Trusted Registrar Inc."]]] }],
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-pipeline-1",
        content: "https://example.com/contact",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
        caseId: "case-pipe-100",
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-pipe-100");

      // Verify Workflow Completion
      expect(report.status).toBe("complete");
      expect(report.caseId).toBe("case-pipe-100");
      expect(report.finalRisk.verdict).toBeDefined();

      // Verify Correlation and Graph Output
      expect(report.domainIntel.registrar).toBe("Trusted Registrar Inc.");
      expect(report.hostIntel.some((h) => h.ip === "93.184.216.34")).toBe(true);
      expect(report.synthesis).toBeDefined();

      // Verify Explainable Risk Separation
      expect(report.finalRisk.numeric).toBeLessThanOrEqual(15);
      expect(["benign", "low", "informational"]).toContain(report.finalRisk.overall);
      expect(report.finalRisk.confidenceScore).toBeGreaterThan(0.7);
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("2. Investigation Reruns & Intelligence Refresh", () => {
    it("reruns investigation independently without mutating previous report instance", async () => {
      const scan1: ScanRecord = {
        id: "scan-initial",
        content: "https://initial-target.example",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now() - 3600000,
        caseId: "case-rerun-1",
      };

      const initialRun = await investigationEngine.runInvestigation(scan1, "case-rerun-1", {
        userConsent: false, // Initial run with no external lookups
      });

      expect(initialRun.report.intelligenceFlags.dnsEnabled).toBe(false);

      // Now rerun with external lookups enabled
      const rerun = await investigationEngine.runInvestigation(scan1, "case-rerun-1", {
        userConsent: true,
        sourceToggles: { "local-heuristics": true, "dns-over-https": true },
      });

      expect(rerun.report.id).not.toBe(initialRun.report.id);
      expect(rerun.report.caseId).toBe("case-rerun-1");
      expect(initialRun.report.status).toBe("complete");
    });
  });

  describe("3. Provider Controls & Target Transparency", () => {
    it("exposes all registered providers and accurately evaluates prerequisite states", () => {
      const providers = ProviderRegistry.list();
      expect(providers.length).toBeGreaterThanOrEqual(7);

      for (const p of providers) {
        expect(p.id).toBeDefined();
        expect(p.name).toBeDefined();
        expect(p.capabilities.length).toBeGreaterThan(0);

        // Pre-flight check when no key is configured
        const prereq = p.checkPrerequisites({
          userConsent: true,
          isSourceEnabled: true,
        });

        if (p.requiresAuth) {
          expect(["not_configured", "unauthorized"]).toContain(prereq.status);
        } else {
          expect(prereq.status).toBe("ready");
        }
      }
    });
  });

  describe("4. Formal Report Export Structure", () => {
    it("generates a comprehensive report containing all standardized cyber investigation sections", async () => {
      const scan: ScanRecord = {
        id: "scan-export-test",
        content: "https://malicious-phish.xyz/banking/login",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-export-1");

      // Verify all 19 standardized report sections are populated
      expect(report.id).toBeDefined();
      expect(report.caseId).toBeDefined();
      expect(report.createdAt).toBeDefined();
      expect(report.status).toBe("complete");
      expect(report.finalRisk.verdict).toBeDefined();
      expect(report.finalRisk.overall).toBeDefined();
      expect(report.finalRisk.numeric).toBeDefined();
      expect(report.finalRisk.confidenceScore).toBeDefined();
      expect(report.finalRisk.primaryDrivers).toBeDefined();
      expect(report.finalRisk.mitigatingFactors).toBeDefined();
      expect(report.finalRisk.missingIntelligence).toBeDefined();
      expect(report.rawContent).toBe("https://malicious-phish.xyz/banking/login");
      expect(report.targets.urls).toBeDefined();
      expect(report.domainIntel).toBeDefined();
      expect(report.hostIntel).toBeDefined();
      expect(report.reputation).toBeDefined();
      expect(report.synthesis).toBeDefined();
      expect(report.findings).toBeDefined();
      expect(report.payloadAnalysis).toBeDefined();
    });
  });
});
