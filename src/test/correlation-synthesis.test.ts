import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  evaluateFreshness,
  IntelligenceSynthesizer,
  correlateInfrastructure,
  investigationEngine,
  type InvestigationFinding,
} from "@/lib/investigation";
import type { ProviderResult } from "@/lib/investigation/providers/types";
import type { ScanRecord } from "@/lib/scan/types";
import { useSettings } from "@/lib/settings";

describe("Phase 3D: OSINT Correlation & Intelligence Synthesis", () => {
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
        "urlscan": true,
      },
      apiKeys: {},
    });
  });

  describe("1. Temporal Freshness Evaluation", () => {
    it("categorizes observation timestamps accurately based on age", () => {
      const now = Date.now();

      // Current (< 1 hour)
      expect(evaluateFreshness(now - 10 * 60 * 1000)).toBe("current");

      // Recent (< 24 hours)
      expect(evaluateFreshness(now - 5 * 60 * 60 * 1000)).toBe("recent");

      // Aging (< 30 days)
      expect(evaluateFreshness(now - 10 * 24 * 60 * 60 * 1000)).toBe("aging");

      // Historical (>= 30 days)
      expect(evaluateFreshness(now - 60 * 24 * 60 * 60 * 1000)).toBe("historical");

      // Invalid / Missing
      expect(evaluateFreshness(undefined)).toBe("unknown");
      expect(evaluateFreshness(0)).toBe("unknown");
    });
  });

  describe("2. Evidence Deduplication", () => {
    it("merges multiple providers reporting the exact same fact into a single corroborated finding", () => {
      const now = Date.now();
      const findings: InvestigationFinding[] = [
        {
          id: "finding-dns-1",
          category: "infrastructure",
          nature: "observed_fact",
          finding: "DNS Resolution: 93.184.216.34",
          severity: "informational",
          evidence: "Cloudflare DoH resolved host to 93.184.216.34.",
          confidence: 0.9,
          source: "DNS-over-HTTPS",
          timestamp: now - 5000,
        },
        {
          id: "finding-urlscan-1",
          category: "infrastructure",
          nature: "observed_fact",
          finding: "DNS Resolution: 93.184.216.34",
          severity: "informational",
          evidence: "URLScan sandbox observed IP 93.184.216.34.",
          confidence: 0.85,
          source: "URLScan.io",
          timestamp: now,
        },
      ];

      const deduplicated = IntelligenceSynthesizer.deduplicateFindings(findings);

      expect(deduplicated).toHaveLength(1);
      const merged = deduplicated[0];
      expect(merged.source).toContain("DNS-over-HTTPS");
      expect(merged.source).toContain("URLScan.io");
      expect(merged.evidence).toContain("Corroborated by");
      expect(merged.confidence).toBeGreaterThan(0.9); // Corroboration boost
      expect(merged.severity).toBe("informational"); // Does not artificially inflate severity
    });
  });

  describe("3. Contradiction Detection", () => {
    it("detects conflicting intelligence when threat providers disagree on classification", () => {
      const now = Date.now();
      const mockResults: ProviderResult[] = [
        {
          providerId: "virus-total",
          providerName: "VirusTotal",
          category: "reputation",
          privacy: "direct",
          target: { type: "url", value: "https://suspicious-test.example" },
          queriedAt: now,
          executionTimeMs: 100,
          status: "success",
          findings: [],
          evidence: [],
          warnings: [],
          reputation: {
            source: "virus-total",
            scope: "url",
            classification: "malicious",
            score: 80,
            categories: ["phishing"],
            threats: ["Credential Stealer"],
          },
        },
        {
          providerId: "google-safe-browsing",
          providerName: "Google Safe Browsing",
          category: "reputation",
          privacy: "direct",
          target: { type: "url", value: "https://suspicious-test.example" },
          queriedAt: now,
          executionTimeMs: 80,
          status: "success",
          findings: [],
          evidence: [],
          warnings: [],
          reputation: {
            source: "google-safe-browsing",
            scope: "url",
            classification: "clean",
            score: 0,
            categories: [],
            threats: [],
          },
        },
      ];

      const conflicts = IntelligenceSynthesizer.detectContradictions(mockResults);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].target).toBe("https://suspicious-test.example");
      expect(conflicts[0].conflictSummary).toContain("Contradictory intelligence");
      expect(conflicts[0].opinions).toHaveLength(2);

      const conflictFindings = IntelligenceSynthesizer.generateConflictFindings(conflicts);
      expect(conflictFindings).toHaveLength(1);
      expect(conflictFindings[0].finding).toContain("Conflicting Threat Intelligence");
      expect(conflictFindings[0].nature).toBe("observed_fact");
    });
  });

  describe("4. Unified Intelligence Model & Multi-Hop Entity Graph", () => {
    it("builds a connected multi-hop entity graph: QR -> Payload -> URL -> Domain -> DNS -> IP -> ASN -> Location", () => {
      const now = Date.now();
      const mockResults: ProviderResult[] = [
        {
          providerId: "rdap-domain",
          providerName: "RDAP Domain Registration",
          category: "rdap",
          privacy: "direct",
          target: { type: "domain", value: "bank-corp.example" },
          queriedAt: now,
          executionTimeMs: 120,
          status: "success",
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            domainIntel: {
              registrar: "Secured Registrar Corp",
              nameservers: ["ns1.bank-corp.example"],
              dns: [],
              statuses: ["active"],
              whoisRedacted: false,
              ageDays: 500,
            },
          },
        },
        {
          providerId: "dns-over-https",
          providerName: "DNS-over-HTTPS",
          category: "dns",
          privacy: "direct",
          target: { type: "domain", value: "bank-corp.example" },
          queriedAt: now,
          executionTimeMs: 60,
          status: "success",
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            records: [{ type: "A", value: "198.51.100.10", ttl: 300 }],
            discoveredIps: ["198.51.100.10"],
            cnames: ["auth.bank-corp.example"],
            mailServers: ["mail.bank-corp.example"],
            nameservers: ["ns1.bank-corp.example"],
          },
        },
        {
          providerId: "ipinfo",
          providerName: "IPinfo",
          category: "asn",
          privacy: "direct",
          target: { type: "ip", value: "198.51.100.10" },
          queriedAt: now,
          executionTimeMs: 70,
          status: "success",
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            hostIntel: {
              ip: "198.51.100.10",
              reverseDns: "host10.bank-corp.example",
              asn: { number: 64496, organization: "Bank Hosting Org" },
              geolocation: { country: "US", region: "New York", city: "New York" },
            },
          },
        },
      ];

      const correlated = correlateInfrastructure(
        mockResults,
        "bank-corp.example",
        "198.51.100.10",
        "https://bank-corp.example/portal",
        "https://bank-corp.example/portal",
      );

      // Verify Unified Entities
      const entities = correlated.unifiedModel.entities;
      expect(entities["payload:root"]).toBeDefined();
      expect(entities["url:https://bank-corp.example/portal"]).toBeDefined();
      expect(entities["domain:bank-corp.example"]).toBeDefined();
      expect(entities["ip:198.51.100.10"]).toBeDefined();

      // Verify Entity Relations
      expect(entities["payload:root"].relatedEntityIds).toContain("url:https://bank-corp.example/portal");
      expect(entities["domain:bank-corp.example"].relatedEntityIds).toContain("ip:198.51.100.10");

      // Verify Graph Edge Types
      const edgeTypes = correlated.graph.edges.map((e) => e.type);
      expect(edgeTypes).toContain("decodes_to");
      expect(edgeTypes).toContain("hosts_domain");
      expect(edgeTypes).toContain("resolves_to");
      expect(edgeTypes).toContain("registered_with");
      expect(edgeTypes).toContain("routed_by");
      expect(edgeTypes).toContain("located_in");
    });
  });

  describe("5. Risk vs Confidence Separation & Explainable Risk Drivers", () => {
    it("distinguishes threat risk from evidence confidence and populates explainable risk drivers", async () => {
      // Mock public DNS & RDAP
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("cloudflare-dns.com") && urlStr.includes("type=A")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [{ name: "enterprise-secure.example", type: 1, TTL: 300, data: "93.184.216.34" }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("rdap.org/domain")) {
          return {
            ok: true,
            json: async () => ({
              objectClassName: "domain",
              ldhName: "ENTERPRISE-SECURE.EXAMPLE",
              events: [{ eventAction: "registration", eventDate: "2015-01-01T00:00:00Z" }],
              entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Official Registrar"]]] }],
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-synth-test",
        content: "https://enterprise-secure.example/docs",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-synth-1", {
        userConsent: true,
        sourceToggles: {
          "local-heuristics": true,
          "rdap-domain": true,
          "dns-over-https": true,
          "virus-total": true, // Unconfigured
        },
      });

      expect(report.status).toBe("complete");
      expect(report.urlSafetySnapshot.verdict).toBeDefined();

      // Verify separate confidence metrics
      expect(report.urlSafetySnapshot.confidenceScore).toBeDefined();
      expect(report.urlSafetySnapshot.confidenceLevel).toBeDefined();
      expect(["low", "medium", "high"]).toContain(report.urlSafetySnapshot.confidenceLevel);

      // Verify Mitigating Factors
      expect(report.urlSafetySnapshot.mitigatingFactors?.length).toBeGreaterThan(0);
      expect(report.urlSafetySnapshot.mitigatingFactors?.some((m) => m.includes("HTTPS"))).toBe(true);

      // Verify Missing Intelligence includes unconfigured VirusTotal
      expect(report.urlSafetySnapshot.missingIntelligence).toBeDefined();
      expect(report.urlSafetySnapshot.missingIntelligence?.some((m) => m.includes("VirusTotal"))).toBe(true);

      // Verify Synthesis is attached to the report
      expect(report.synthesis).toBeDefined();
    });
  });
});
