import { describe, it, expect, beforeEach, vi } from "vitest";
import { investigationEngine } from "@/lib/investigation";
import type { ScanRecord } from "@/lib/scan/types";
import { useSettings } from "@/lib/settings";

describe("Phase 4A: Investigation Report & Analyst Workspace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: {
        "local-heuristics": true,
        "rdap-domain": true,
        "dns-over-https": true,
        "ipinfo": true,
        "crtsh-cert": true,
        "virus-total": true,
      },
      apiKeys: {},
    });
  });

  describe("1. Complete Investigation Workspace Model", () => {
    it("generates a complete investigation report with all workspace sections populated", async () => {
      // Mock DoH and RDAP
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("cloudflare-dns.com")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [{ name: "portal.example.com", type: 1, TTL: 300, data: "198.51.100.45" }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("rdap.org/domain")) {
          return {
            ok: true,
            json: async () => ({
              objectClassName: "domain",
              ldhName: "EXAMPLE.COM",
              events: [{ eventAction: "registration", eventDate: "2012-05-10T00:00:00Z" }],
              entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Global Registrar LLC"]]] }],
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-workspace-1",
        content: "https://portal.example.com/login?session=active",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now() - 60000,
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-ws-1");

      // 1. Executive Verdict
      expect(report.status).toBe("complete");
      expect(report.finalRisk.verdict).toBeDefined();
      expect(report.finalRisk.numeric).toBeGreaterThanOrEqual(0);
      expect(report.finalRisk.confidenceScore).toBeDefined();
      expect(report.finalRisk.confidenceLevel).toBeDefined();

      // 2. Decoded Payload
      expect(report.rawContent).toBe("https://portal.example.com/login?session=active");
      expect(report.payloadAnalysis.size).toBeGreaterThan(0);
      expect(report.targets.urls).toHaveLength(1);
      expect(report.targets.urls[0].domain).toBe("example.com");

      // 3. Domain & Infrastructure Intelligence
      expect(report.domainIntel.registrar).toBe("Global Registrar LLC");
      expect(report.hostIntel.some((h) => h.ip === "198.51.100.45")).toBe(true);

      // 4. Investigation Graph Synthesis
      expect(report.synthesis).toBeDefined();
      const synthesis = report.synthesis as { graph: { nodes: unknown[]; edges: unknown[] } };
      expect(synthesis.graph.nodes.length).toBeGreaterThan(3);
      expect(synthesis.graph.edges.length).toBeGreaterThan(2);

      // 5. Evidence
      expect(findings.length).toBeGreaterThan(0);
      expect(report.finalRisk.evidence.length).toBeGreaterThan(0);
    });
  });

  describe("2. Missing & Unconfigured Sources Handling", () => {
    it("transparently lists unconfigured providers in missingIntelligence without penalizing risk score", async () => {
      const scan: ScanRecord = {
        id: "scan-missing-sources",
        content: "https://clean-verified-portal.org",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-missing-1", {
        userConsent: true,
        sourceToggles: {
          "local-heuristics": true,
          "virus-total": true, // Unconfigured
          "urlscan": true,     // Unconfigured
        },
      });

      expect(report.finalRisk.missingIntelligence).toBeDefined();
      expect(report.finalRisk.missingIntelligence?.length).toBeGreaterThan(0);
      expect(report.finalRisk.missingIntelligence?.some((m) => m.includes("VirusTotal"))).toBe(true);
      expect(report.finalRisk.missingIntelligence?.some((m) => m.includes("URLScan"))).toBe(true);

      // Unconfigured providers must not produce false threats
      expect(report.finalRisk.overall).toBe("benign");
      expect(report.finalRisk.numeric).toBe(0);
    });
  });

  describe("3. High-Risk vs Benign Investigations", () => {
    it("correctly identifies primary risk drivers for a high-risk phishing URL", async () => {
      const scan: ScanRecord = {
        id: "scan-phishing",
        content: "https://admin:secret123@login-bank-account-security-update.xyz/verify",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-phishing-1");

      expect(report.finalRisk.numeric).toBeGreaterThanOrEqual(40);
      expect(["medium", "high", "critical"]).toContain(report.finalRisk.overall);
      expect(report.finalRisk.primaryDrivers).toBeDefined();
      expect(report.finalRisk.primaryDrivers?.length).toBeGreaterThan(0);
    });

    it("correctly evaluates a plain barcode payload with insufficient evaluable web targets", async () => {
      const scan: ScanRecord = {
        id: "scan-barcode-plain",
        content: "9780134685991",
        type: "product",
        format: "EAN_13",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-barcode-1");

      expect(report.status).toBe("complete");
      expect(report.targets.urls).toHaveLength(0);
      expect(report.targets.domains).toHaveLength(0);
      expect(report.finalRisk.numeric).toBe(0);
    });
  });
});
