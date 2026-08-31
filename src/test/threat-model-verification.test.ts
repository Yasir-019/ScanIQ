import { describe, it, expect } from "vitest";
import { analyzePayload } from "@/lib/investigation/payload-analyzer";
import { analyzeUrlSafety } from "@/lib/url-safety";
import { parseIpv4Notation } from "@/lib/investigation/url-normalizer";
import { CredentialStore } from "@/lib/investigation/providers/credential-store";
import { sanitizeObject } from "@/lib/investigation/sanitization";
import { localHeuristicProvider } from "@/lib/investigation/providers/base";

describe("ScanIQ Community — Phase 12: Threat Model & Security Verification", () => {
  describe("1. Spoofing & Impersonation Mitigations (T-S1, T-S2)", () => {
    it("flags brand typosquatting / lookalike spoofing targets", () => {
      const result = analyzeUrlSafety("https://login.paypal.verify-account-portal.com/auth");
      expect(result.level).toBe("malicious");
      expect(result.reasons.some((r) => r.toLowerCase().includes("paypal"))).toBe(true);
    });

    it("flags unencrypted open Wi-Fi configurations as security risks", () => {
      const openWifi = analyzePayload("WIFI:S:Airport_Free_Wifi;T:nopass;;");
      expect(openWifi.findings.some((f) => f.id.includes("finding-wifi-open"))).toBe(true);
      expect(openWifi.findings.some((f) => f.severity === "medium")).toBe(true);
    });
  });

  describe("2. Tampering & Obfuscation Mitigations (T-T1, T-T2)", () => {
    it("detects Right-to-Left (BiDi U+202E) override attacks in payloads", () => {
      const bidiPayload = "https://example.com/invoice\u202Ecod.exe";
      const result = analyzePayload(bidiPayload);
      expect(result.metrics.anomalies).toContain("bidi-override");
      expect(result.findings.some((f) => f.severity === "critical")).toBe(true);
    });

    it("detects invisible zero-width characters used for regex bypass", () => {
      const zeroWidthPayload = "https://safe\u200Bdomain.com";
      const result = analyzePayload(zeroWidthPayload);
      expect(result.metrics.anomalies).toContain("zero-width-characters");
    });
  });

  describe("3. Information Disclosure & Secret Isolation Mitigations (T-I1, T-I2, T-I3)", () => {
    it("scrubs embedded credentials and API tokens from error strings", () => {
      const errorWithKey = "API request failed with key vt_secret_1234567890abcdef at https://api.virustotal.com";
      const cleaned = CredentialStore.redact(errorWithKey, ["vt_secret_1234567890abcdef"]);
      expect(cleaned).not.toContain("vt_secret_1234567890abcdef");
      expect(cleaned).toContain("[REDACTED_API_KEY]");
    });

    it("deeply sanitizes structured report objects", () => {
      const reportData = {
        id: "rep-1",
        meta: {
          apiKey: "secret_token_val_12345",
          normalField: "public_value",
        },
      };
      const sanitized = sanitizeObject(reportData);
      expect(sanitized.meta.apiKey).toBe("[REDACTED]");
      expect(sanitized.meta.normalField).toBe("public_value");
    });
  });

  describe("4. Denial of Service & Timeout Containment (T-D1, T-D2)", () => {
    it("safely analyzes large payloads without catastrophic backtracking", () => {
      const largePayload = "https://test.com/path?" + "a=".repeat(2000) + "b";
      const start = performance.now();
      const result = analyzePayload(largePayload);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Must process in under 1 second
      expect(result.metrics.size).toBeGreaterThan(2000);
    });
  });

  describe("5. Elevation of Privilege & SSRF Containment (T-E1, T-E2)", () => {
    it("blocks dangerous non-web executable schemes", () => {
      const schemes = [
        "javascript:alert(1)",
        "vbscript:msgbox(1)",
        "data:text/html,<script>alert(1)</script>",
        "file:///etc/shadow",
        "blob:http://target.com/uuid",
        "shell:startup",
      ];
      for (const s of schemes) {
        const safety = analyzeUrlSafety(s);
        expect(safety.level).toBe("malicious");
      }
    });

    it("safely contains private RFC 1918 and loopback IP lookups", () => {
      const loopback = parseIpv4Notation("127.0.0.1");
      expect(loopback.isLoopback).toBe(true);

      const rfc1918 = parseIpv4Notation("192.168.1.1");
      expect(rfc1918.isPrivate).toBe(true);
    });

    it("executes local heuristic provider without network dependencies", async () => {
      const result = await localHeuristicProvider.execute(
        { type: "url", value: "https://example.com" },
        { userConsent: false, isSourceEnabled: true }
      );
      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThanOrEqual(0);
    });
  });
});
