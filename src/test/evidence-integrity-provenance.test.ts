import { describe, it, expect } from "vitest";
import {
  computeSha256Hex,
  createEvidenceRecord,
  verifyEvidenceIntegrity,
  computeEvidenceFingerprint,
  deduplicateFindings,
  type EvidenceRecord,
} from "@/lib/investigation/evidence-integrity";
import type { InvestigationFinding } from "@/lib/investigation/types";

describe("ScanIQ Community — Phase 15: Evidence Integrity & Provenance", () => {
  describe("1. Cryptographic SHA-256 Hashing & Verification", () => {
    it("computes deterministic 64-character SHA-256 hex digest for evidence payloads", async () => {
      const content = "https://secure-login.bank-verify.xyz/auth?session=12345";
      const hash1 = await computeSha256Hex(content);
      const hash2 = await computeSha256Hex(content);

      expect(hash1).toBeDefined();
      expect(hash1.length).toBe(64);
      expect(hash1).toBe(hash2);
      expect(/^[0-9a-f]{64}$/i.test(hash1)).toBe(true);
    });

    it("creates EvidenceRecord with stable ID, timestamp, and SHA-256 integrity hash", async () => {
      const record = await createEvidenceRecord({
        investigationId: "inv-test-101",
        caseId: "case-test-01",
        type: "raw_payload",
        origin: "raw_evidence",
        source: "QR Barcode Scanner",
        rawContent: "https://suspicious-domain.com",
      });

      expect(record.id).toMatch(/^ev-raw_payload-/);
      expect(record.investigationId).toBe("inv-test-101");
      expect(record.sha256).toBeDefined();
      expect(record.sha256.length).toBe(64);
      expect(record.origin).toBe("raw_evidence");
      expect(record.type).toBe("raw_payload");
    });

    it("verifies untampered evidence and detects modified/corrupted evidence", async () => {
      const original = await createEvidenceRecord({
        investigationId: "inv-verify-01",
        type: "dns_record",
        origin: "raw_evidence",
        source: "Cloudflare DoH",
        rawContent: "192.0.2.1",
      });

      const intactStatus = await verifyEvidenceIntegrity(original);
      expect(intactStatus.verified).toBe(true);
      expect(intactStatus.matches).toBe(true);
      expect(intactStatus.actualSha256).toBe(original.sha256);

      // Simulate tampering/corruption of raw evidence payload
      const tamperedRecord: EvidenceRecord = {
        ...original,
        rawContent: "198.51.100.99", // Altered IP
      };

      const tamperedStatus = await verifyEvidenceIntegrity(tamperedRecord);
      expect(tamperedStatus.verified).toBe(true);
      expect(tamperedStatus.matches).toBe(false); // Hash mismatch detected!
      expect(tamperedStatus.actualSha256).not.toBe(original.sha256);
    });
  });

  describe("2. Secret Sanitization in Evidence & Provenance", () => {
    it("redacts API keys and credentials before storing or hashing evidence", async () => {
      const payloadWithSecret = "https://api.example.com/data?apiKey=AIzaSyA1234567890abcdefghijklmnopqrstuv";
      const record = await createEvidenceRecord({
        investigationId: "inv-secret-01",
        type: "raw_payload",
        origin: "raw_evidence",
        source: "Scanner",
        rawContent: payloadWithSecret,
      });

      expect(record.rawContent).not.toContain("AIzaSyA1234567890abcdefghijklmnopqrstuv");
      expect(record.rawContent).toContain("[REDACTED");
    });
  });

  describe("3. Finding Deduplication and Content Fingerprinting", () => {
    it("computes consistent fingerprints and deduplicates corroborating findings", () => {
      const findingA: InvestigationFinding = {
        id: "f-1",
        category: "domain",
        nature: "heuristic_indicator",
        finding: "Brand Impersonation Detected",
        severity: "high",
        evidence: "Domain typosquats known brand",
        confidence: 0.85,
        source: "Local Heuristics",
        timestamp: 1000,
      };

      const findingB: InvestigationFinding = {
        id: "f-2",
        category: "domain",
        nature: "heuristic_indicator",
        finding: "Brand Impersonation Detected",
        severity: "high",
        evidence: "Domain typosquats known brand",
        confidence: 0.9,
        source: "VirusTotal Community",
        timestamp: 1500,
      };

      const fpA = computeEvidenceFingerprint(findingA);
      const fpB = computeEvidenceFingerprint(findingB);
      expect(fpA).toBe(fpB);

      const deduplicated = deduplicateFindings([findingA, findingB]);
      expect(deduplicated.length).toBe(1);
      expect(deduplicated[0].source).toContain("Local Heuristics");
      expect(deduplicated[0].source).toContain("VirusTotal Community");
      expect(deduplicated[0].confidence).toBeGreaterThan(0.9); // Corroboration boost
    });
  });
});
