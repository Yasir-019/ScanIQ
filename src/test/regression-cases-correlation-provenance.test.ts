import { describe, it, expect, beforeEach, vi } from "vitest";
import type { InvestigationCase, ScanRecord } from "@/lib/scan/types";
import type { InvestigationFinding } from "@/lib/investigation/types";

const mockCases = new Map<string, InvestigationCase>();
const mockScans = new Map<string, ScanRecord>();

vi.mock("@/lib/db", () => {
  return {
    db: {
      cases: {
        get: async (id: string) => mockCases.get(id),
        toArray: async () => Array.from(mockCases.values()),
        add: async (c: InvestigationCase) => {
          mockCases.set(c.id, c);
          return c.id;
        },
        put: async (c: InvestigationCase) => {
          mockCases.set(c.id, c);
          return c.id;
        },
        update: async (id: string, changes: Partial<InvestigationCase>) => {
          const existing = mockCases.get(id);
          if (existing) {
            mockCases.set(id, { ...existing, ...changes });
          }
        },
        clear: async () => {
          mockCases.clear();
        },
      },
      scans: {
        get: async (id: string) => mockScans.get(id),
        toArray: async () => Array.from(mockScans.values()),
        add: async (s: ScanRecord) => {
          mockScans.set(s.id, s);
          return s.id;
        },
        bulkAdd: async (items: ScanRecord[]) => {
          items.forEach((s) => mockScans.set(s.id, s));
        },
        where: (field: string) => ({
          equals: (value: unknown) => ({
            toArray: async () => {
              return Array.from(mockScans.values()).filter((s) => (s as unknown as Record<string, unknown>)[field] === value);
            },
          }),
        }),
        clear: async () => {
          mockScans.clear();
        },
      },
    },
  };
});

import {
  normalizeIoc,
  detectIocType,
} from "@/lib/investigation/ioc-correlation";
import {
  computeSha256Hex,
  createEvidenceRecord,
  verifyEvidenceIntegrity,
  deduplicateFindings,
} from "@/lib/investigation/evidence-integrity";
import { db } from "@/lib/db";

describe("Phase 18: Cases, IOC Correlation & Evidence Provenance Suite", () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await db.cases.clear();
    await db.scans.clear();
  });

  describe("1. Case Lifecycle & Multi-Scan Management", () => {
    it("creates, updates, and persists multi-scan cases in IndexedDB", async () => {
      const newCase: InvestigationCase = {
        id: "case-reg-101",
        label: "Operation PhishTrace",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: ["phishing", "credential-theft"],
        status: "active",
        notes: "Investigating suspicious QR codes found on parking meters",
        targetCount: 0,
        indicatorCount: 0,
        latestRiskLevel: "unknown",
      };

      await db.cases.add(newCase);
      const retrieved = await db.cases.get("case-reg-101");
      expect(retrieved?.label).toBe("Operation PhishTrace");
      expect(retrieved?.status).toBe("active");
      expect(retrieved?.tags).toContain("phishing");

      // Add two scans linked to this case
      const scan1: ScanRecord = {
        id: "scan-case-1",
        content: "https://meter-pay-scam.xyz/pay",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
        caseId: "case-reg-101",
      };

      const scan2: ScanRecord = {
        id: "scan-case-2",
        content: "https://meter-pay-scam.xyz/receipt",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
        caseId: "case-reg-101",
      };

      await db.scans.bulkAdd([scan1, scan2]);

      const caseScans = await db.scans.where("caseId").equals("case-reg-101").toArray();
      expect(caseScans.length).toBe(2);

      // Update case status to closed
      await db.cases.update("case-reg-101", { status: "closed", updatedAt: Date.now() });
      const updated = await db.cases.get("case-reg-101");
      expect(updated?.status).toBe("closed");
    });
  });

  describe("2. IOC Normalization & Type Classification", () => {
    it("normalizes diverse indicator formats consistently", () => {
      expect(normalizeIoc("  https://Evil-Domain.com/path/  ")).toBe("evil-domain.com/path");
      expect(normalizeIoc("http://Phishing.Org/")).toBe("phishing.org");
      expect(normalizeIoc("  192.168.1.1  ")).toBe("192.168.1.1");
      expect(normalizeIoc("ANALYST@SECURITY.LAB")).toBe("analyst@security.lab");
    });

    it("detects entity types accurately for IOC correlation", () => {
      expect(detectIocType("192.168.1.100")).toBe("ip");
      expect(detectIocType("malicious-c2.top")).toBe("domain");
      expect(detectIocType("https://evil.com/login")).toBe("url");
      expect(detectIocType("threat-actor@badactor.net")).toBe("email");
      expect(detectIocType("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")).toBe("hash");
      expect(detectIocType("5d41402abc4b2a76b9719d911017c592")).toBe("hash");
    });
  });

  describe("3. Evidence Hashing & Cryptographic Provenance", () => {
    it("creates tamper-evident evidence records with SHA-256 integrity digests", async () => {
      const payload = "https://legitimate-looking-phish.biz/auth";
      const evidence = await createEvidenceRecord({
        investigationId: "inv-prov-1",
        caseId: "case-prov-1",
        type: "raw_payload",
        origin: "raw_evidence",
        source: "ZXing QR Decoder",
        rawContent: payload,
      });

      expect(evidence.sha256).toBeDefined();
      expect(evidence.sha256.length).toBe(64); // Standard SHA-256 hex string

      // Verify integrity of unmodified evidence
      const verification = await verifyEvidenceIntegrity(evidence);
      expect(verification.matches).toBe(true);
      expect(verification.verified).toBe(true);

      // Tamper simulation: mutate rawContent without recalculating hash
      const tamperedEvidence = {
        ...evidence,
        rawContent: "https://tampered-payload.biz/auth",
      };

      const tamperedVerification = await verifyEvidenceIntegrity(tamperedEvidence);
      expect(tamperedVerification.matches).toBe(false);
    });

    it("generates deterministic canonical digests and deduplicates finding fingerprints", async () => {
      const payloadStr = "https://suspicious-target.com/login";
      const sha1 = await computeSha256Hex(payloadStr);
      const sha2 = await computeSha256Hex(payloadStr);
      expect(sha1).toBe(sha2);
      expect(sha1.length).toBe(64);

      // Verify fingerprint deduplication
      const findings: InvestigationFinding[] = [
        {
          id: "f-1",
          category: "url",
          finding: "Uses Unencrypted HTTP",
          nature: "heuristic_indicator",
          severity: "low",
          confidence: 0.8,
          source: "Local Analyzer",
          evidence: "Cleartext transport detected",
          timestamp: 1000,
        },
        {
          id: "f-2",
          category: "url",
          finding: "Uses Unencrypted HTTP",
          nature: "heuristic_indicator",
          severity: "low",
          confidence: 0.85,
          source: "URL Parser",
          evidence: "Cleartext transport detected",
          timestamp: 2000,
        },
      ];

      const deduped = deduplicateFindings(findings);
      expect(deduped.length).toBe(1);
      expect(deduped[0].source).toContain("Local Analyzer");
      expect(deduped[0].source).toContain("URL Parser");
    });
  });
});
