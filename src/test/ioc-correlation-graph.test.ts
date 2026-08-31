import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InvestigationCase, InvestigationReport, ScanRecord } from "@/lib/scan/types";

const mockCases = new Map<string, InvestigationCase>();
const mockScans = new Map<string, ScanRecord>();
const mockInvestigations = new Map<string, InvestigationReport>();

vi.mock("@/lib/db", () => {
  return {
    db: {
      cases: {
        toArray: () => Array.from(mockCases.values()),
        get: (id: string) => mockCases.get(id),
        put: (c: InvestigationCase) => {
          mockCases.set(c.id, c);
          return c.id;
        },
        bulkPut: (items: InvestigationCase[]) => {
          items.forEach((c) => mockCases.set(c.id, c));
        },
        clear: () => {
          mockCases.clear();
        },
      },
      scans: {
        toArray: () => Array.from(mockScans.values()),
        put: (s: ScanRecord) => {
          mockScans.set(s.id, s);
          return s.id;
        },
        bulkPut: (items: ScanRecord[]) => {
          items.forEach((s) => mockScans.set(s.id, s));
        },
        clear: () => {
          mockScans.clear();
        },
      },
      investigations: {
        toArray: () => Array.from(mockInvestigations.values()),
        put: (inv: InvestigationReport) => {
          mockInvestigations.set(inv.id, inv);
          return inv.id;
        },
        bulkPut: (items: InvestigationReport[]) => {
          items.forEach((i) => mockInvestigations.set(i.id, i));
        },
        clear: () => {
          mockInvestigations.clear();
        },
      },
    },
  };
});

import {
  IocCorrelationService,
  normalizeIoc,
  detectIocType,
} from "@/lib/investigation/ioc-correlation";

describe("ScanIQ Community — Phase 14: IOC Correlation & Investigation Graph", () => {
  beforeEach(() => {
    mockCases.clear();
    mockScans.clear();
    mockInvestigations.clear();
  });

  describe("1. IOC Normalization and Categorization", () => {
    it("correctly normalizes URLs and domains for cross-case matching", () => {
      expect(normalizeIoc("https://example.com/login/")).toBe("example.com/login");
      expect(normalizeIoc("http://Phish-Domain.XYZ/")).toBe("phish-domain.xyz");
      expect(normalizeIoc(" 192.168.1.100 ")).toBe("192.168.1.100");
    });

    it("accurately detects IOC types (IP, Domain, URL, Hash, Email)", () => {
      expect(detectIocType("192.168.1.1")).toBe("ip");
      expect(detectIocType("malicious-domain.com")).toBe("domain");
      expect(detectIocType("https://evil.com/path")).toBe("url");
      expect(detectIocType("admin@phish-corp.net")).toBe("email");
      expect(detectIocType("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("hash");
    });
  });

  describe("2. Cross-Case IOC Correlation", () => {
    it("identifies matching indicators across multiple investigation cases", async () => {
      const case1: InvestigationCase = {
        id: "case-001",
        label: "Phishing Campaign Alpha",
        status: "active",
        createdAt: 1000,
        updatedAt: 2000,
        latestRiskLevel: "high",
        primaryTarget: "https://phish-login.com/auth",
      };

      const case2: InvestigationCase = {
        id: "case-002",
        label: "Malware Drop Beta",
        status: "active",
        createdAt: 3000,
        updatedAt: 4000,
        latestRiskLevel: "critical",
        primaryTarget: "https://phish-login.com/payload.exe",
      };

      const scan1: ScanRecord = {
        id: "scan-1",
        caseId: "case-001",
        content: "https://phish-login.com/auth",
        type: "url",
        format: "QR_CODE",
        scannedAt: 1000,
      };

      const scan2: ScanRecord = {
        id: "scan-2",
        caseId: "case-002",
        content: "https://phish-login.com/payload.exe",
        type: "url",
        format: "QR_CODE",
        scannedAt: 3000,
      };

      mockCases.set(case1.id, case1);
      mockCases.set(case2.id, case2);
      mockScans.set(scan1.id, scan1);
      mockScans.set(scan2.id, scan2);

      const result = await IocCorrelationService.correlateIocAcrossCases("phish-login.com", "case-001");

      expect(result).not.toBeNull();
      expect(result?.ioc).toBe("phish-login.com");
      expect(result?.occurrences.length).toBe(2);
      expect(result?.totalCasesCount).toBe(1); // 1 other case besides case-001
      expect(result?.highestRiskLevel).toBe("critical");
    });
  });

  describe("3. Global Multi-Case IOC Search", () => {
    it("returns relevant cases when searching by partial domain or indicator", async () => {
      const caseRec: InvestigationCase = {
        id: "case-search-1",
        label: "Credential Harvest Investigation",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        latestRiskLevel: "high",
      };

      const inv: InvestigationReport = {
        id: "inv-search-1",
        caseId: "case-search-1",
        status: "complete",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        rawContent: "https://secure-bank-login.xyz",
        contentType: "url",
        format: "QR_CODE",
        targets: {
          urls: [],
          domains: ["secure-bank-login.xyz"],
          hosts: ["secure-bank-login.xyz"],
          phoneNumbers: [],
          emails: [],
          productCodes: [],
        },
        payloadAnalysis: {
          hasCredentialsEmbedded: false,
          hasIps: false,
          hasObfuscation: false,
          usesDangerousProtocol: false,
          size: 28,
          entropy: 3.5,
          anomalies: [],
        },
        urlSafetySnapshot: {
          overall: "high",
          numeric: 80,
          confidence: 0.9,
          verdict: "Malicious",
          explanation: "Brand typosquatting",
          evidence: [],
          primaryDrivers: [],
          supportingEvidence: [],
          mitigatingFactors: [],
          conflictingIntelligence: [],
          missingIntelligence: [],
        },
        findings: [],
        sourceScanId: "scan-mock-1",
        domainIntel: {
          nameservers: [],
          dns: [],
          statuses: [],
          whoisRedacted: false,
        },
        hostIntel: [],
        reputation: [],
        intelligenceFlags: {
          whoisEnabled: false,
          rdapEnabled: false,
          dnsEnabled: false,
          asnEnabled: false,
          geoEnabled: false,
          certEnabled: false,
          redirectEnabled: false,
          reputationEnabled: false,
          userControlled: false,
        },
        finalRisk: {
          overall: "high",
          numeric: 80,
          confidence: 0.9,
          verdict: "Malicious",
          explanation: "Brand typosquatting",
          evidence: [],
          primaryDrivers: [],
          supportingEvidence: [],
          mitigatingFactors: [],
          conflictingIntelligence: [],
          missingIntelligence: [],
        },
      };

      mockCases.set(caseRec.id, caseRec);
      mockInvestigations.set(inv.id, inv);

      const results = await IocCorrelationService.searchIocs("secure-bank");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].ioc).toBe("secure-bank-login.xyz");
      expect(results[0].cases.some((c) => c.id === "case-search-1")).toBe(true);
    });
  });
});
