import { describe, it, expect, beforeEach, vi } from "vitest";
import { computeEvidenceFingerprint, deduplicateFindings } from "@/lib/investigation/evidence-integrity";
import { redactSecrets, sanitizeObject } from "@/lib/investigation/sanitization";
import { normalizeAndAnalyzeUrl } from "@/lib/investigation/url-normalizer";
import { analyzePayload } from "@/lib/investigation/payload-analyzer";
import { investigationEngine } from "@/lib/investigation/engine";
import { useSettings } from "@/lib/settings";
import type { InvestigationFinding, ScanRecord } from "@/lib/investigation/types";

describe("Phase 6: Evidence Integrity, Detection Calibration & Security Hardening", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: { "local-heuristics": true },
      apiKeys: {},
    });
  });

  describe("1. Deterministic Evidence Fingerprinting & Deduplication", () => {
    it("generates consistent deterministic fingerprint for identical findings", () => {
      const f1 = {
        category: "domain",
        finding: "Punycode domain detected",
        nature: "heuristic_indicator",
        severity: "medium",
        evidence: "Host contains xn-- prefix",
      };
      const f2 = {
        category: "domain",
        finding: "Punycode domain detected",
        nature: "heuristic_indicator",
        severity: "medium",
        evidence: "Host contains xn-- prefix",
      };

      const fp1 = computeEvidenceFingerprint(f1);
      const fp2 = computeEvidenceFingerprint(f2);

      expect(fp1).toBe(fp2);
      expect(fp1.startsWith("fp-")).toBe(true);
    });

    it("deduplicates identical findings across multiple providers and boosts confidence", () => {
      const findings: InvestigationFinding[] = [
        {
          id: "f1",
          category: "reputation",
          nature: "external_intelligence",
          finding: "Malicious domain classification",
          severity: "high",
          evidence: "Listed on blocklist",
          confidence: 0.85,
          source: "VirusTotal",
          timestamp: 1000,
        },
        {
          id: "f2",
          category: "reputation",
          nature: "external_intelligence",
          finding: "Malicious domain classification",
          severity: "high",
          evidence: "Listed on blocklist",
          confidence: 0.9,
          source: "URLScan",
          timestamp: 1005,
        },
      ];

      const deduped = deduplicateFindings(findings);
      expect(deduped).toHaveLength(1);
      expect(deduped[0].source).toBe("VirusTotal, URLScan");
      expect(deduped[0].confidence).toBeGreaterThan(0.9); // Corroboration boost
    });
  });

  describe("2. Secret Redaction & Sanitization", () => {
    it("redacts embedded URL credentials and API keys", () => {
      const sensitiveUrl = "https://admin:SuperSecretPassword123@internal.corp.com/api";
      const sanitized = redactSecrets(sensitiveUrl);

      expect(sanitized).not.toContain("SuperSecretPassword123");
      expect(sanitized).toContain("[REDACTED_SECRET]");
    });

    it("deeply scrubs sensitive key-value pairs in exported objects", () => {
      const rawObject = {
        scanId: "scan-123",
        config: {
          apiKey: "vt_live_9948838291039485729102",
          userToken: "bearer_xyz_secret_999",
        },
        findings: [{ title: "Clean scan" }],
      };

      const sanitized = sanitizeObject(rawObject);
      expect(sanitized.config.apiKey).toBe("[REDACTED]");
      expect(sanitized.config.userToken).toBe("[REDACTED]");
      expect(sanitized.scanId).toBe("scan-123");
    });
  });

  describe("3. Input Bounding & Adversarial Resilience", () => {
    it("safely handles oversized 100KB payload without crashing or hanging", () => {
      const oversizedString = "A".repeat(100000);
      const { metrics, findings } = analyzePayload(oversizedString);

      expect(metrics.size).toBe(100000);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings.some((f) => f.finding.includes("Large payload volume"))).toBe(true);
    });

    it("safely handles malformed percent-encoding (%zz, truncated %) without throwing", () => {
      const malformedUrl = "https://example.com/search?q=%zz%E0%80%&test=%";
      const { result, findings } = normalizeAndAnalyzeUrl(malformedUrl);

      expect(result.isValid).toBe(true);
      expect(result.summary.domain).toBe("example.com");
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  describe("4. Detection Calibration & False-Positive Prevention", () => {
    it("does NOT classify a standard legitimate /login endpoint as high risk", async () => {
      const scan: ScanRecord = {
        id: "scan-legit-login",
        content: "https://example.com/login",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-calib-1");

      expect(report.finalRisk.overall).toBe("benign");
      expect(report.finalRisk.numeric).toBe(0);
    });

    it("treats alternate development ports (e.g. 8080) as informational, not high risk", () => {
      const url = "http://192.168.1.50:8080/dashboard";
      const { result, findings } = normalizeAndAnalyzeUrl(url);

      const portFinding = findings.find((f) => f.finding.includes(":8080"));
      expect(portFinding).toBeDefined();
      expect(portFinding?.severity).toBe("informational");
    });

    it("records complete provenance actions during investigation execution", async () => {
      const scan: ScanRecord = {
        id: "scan-provenance-test",
        content: "https://example.org/about",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-prov-1");
      const synthesis = report.synthesis as { provenanceLog?: { action: string }[] };

      expect(synthesis.provenanceLog).toBeDefined();
      expect(synthesis.provenanceLog?.length).toBeGreaterThanOrEqual(4);
      expect(synthesis.provenanceLog?.some((a) => a.action === "investigation_created")).toBe(true);
      expect(synthesis.provenanceLog?.some((a) => a.action === "report_generated")).toBe(true);
    });
  });
});
