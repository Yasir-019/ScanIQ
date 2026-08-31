import { describe, it, expect } from "vitest";
import { analyzeUrlSafety } from "@/lib/url-safety";
import { redactSecrets, sanitizeObject } from "@/lib/investigation/sanitization";
import { parseIpv4Notation } from "@/lib/investigation/url-normalizer";
import { CredentialStore } from "@/lib/investigation/providers/credential-store";

describe("ScanIQ Community — Phase 8: Security, Privacy & Self-Hosted Hardening", () => {
  describe("1. Dangerous Protocol & Executable Payload Protection", () => {
    it("flags javascript: and vbscript: payloads as malicious", () => {
      const jsPayload = analyzeUrlSafety("javascript:alert(document.cookie)");
      expect(jsPayload.level).toBe("malicious");
      expect(jsPayload.reasons.some((r) => r.toLowerCase().includes("dangerous"))).toBe(true);

      const vbsPayload = analyzeUrlSafety("vbscript:MsgBox(1)");
      expect(vbsPayload.level).toBe("malicious");
    });

    it("flags data:, file:, blob:, and shell: schemes as dangerous", () => {
      const filePayload = analyzeUrlSafety("file:///etc/passwd");
      expect(filePayload.level).toBe("malicious");

      const dataPayload = analyzeUrlSafety("data:text/html,<script>alert(1)</script>");
      expect(dataPayload.level).toBe("malicious");

      const blobPayload = analyzeUrlSafety("blob:http://evil.com/uuid");
      expect(blobPayload.level).toBe("malicious");

      const shellPayload = analyzeUrlSafety("shell:startup");
      expect(shellPayload.level).toBe("malicious");
    });
  });

  describe("2. Secret Redaction & Zero Credential Exposure", () => {
    it("redacts plaintext credentials embedded in URLs", () => {
      const urlWithCreds = "https://analyst:SuperSecretPassword123@portal.victim-bank.com/auth";
      const redacted = redactSecrets(urlWithCreds);

      expect(redacted).not.toContain("SuperSecretPassword123");
      expect(redacted).toContain("[REDACTED_SECRET]");
    });

    it("deeply sanitizes objects to redact any API keys, tokens, or auth headers", () => {
      const sensitiveObj = {
        investigationId: "inv-12345",
        status: "complete",
        apiKey: "vt_secret_key_abcdef1234567890",
        nested: {
          authToken: "bearer_token_xyz987654321",
          passwordHash: "secret_hash_value",
        },
      };

      const sanitized = sanitizeObject(sensitiveObj);
      expect(sanitized.apiKey).toBe("[REDACTED]");
      expect(sanitized.nested.authToken).toBe("[REDACTED]");
      expect(sanitized.nested.passwordHash).toBe("[REDACTED]");
      expect(sanitized.investigationId).toBe("inv-12345");
    });

    it("securely masks credentials for safe UI rendering", () => {
      const testKey = "1234567890abcdef1234567890abcdef1234567890abcdef";
      const masked = CredentialStore.mask(testKey);

      expect(masked).not.toBe(testKey);
      expect(masked.startsWith("123")).toBe(true);
      expect(masked.endsWith("def")).toBe(true);
      expect(masked.includes("••••")).toBe(true);
    });
  });

  describe("3. Private IP & SSRF Containment", () => {
    it("correctly identifies loopback (127.0.0.1, localhost) and private RFC 1918 ranges", () => {
      const loopback = parseIpv4Notation("127.0.0.1");
      expect(loopback.isLoopback).toBe(true);

      const rfc1918A = parseIpv4Notation("10.50.1.1");
      expect(rfc1918A.isPrivate).toBe(true);

      const rfc1918B = parseIpv4Notation("172.16.0.5");
      expect(rfc1918B.isPrivate).toBe(true);

      const rfc1918C = parseIpv4Notation("192.168.1.100");
      expect(rfc1918C.isPrivate).toBe(true);

      const publicIp = parseIpv4Notation("1.1.1.1");
      expect(publicIp.isPrivate).toBe(false);
      expect(publicIp.isLoopback).toBe(false);
    });
  });
});
