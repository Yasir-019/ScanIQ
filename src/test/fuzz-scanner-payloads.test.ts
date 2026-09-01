import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseScanContent } from "@/lib/scan/parser";
import { sanitizeInput, validateWebUrl } from "@/lib/scan/security";
import { analyzeUrlSafety } from "@/lib/url-safety";
import { parseIpv4Notation, normalizeAndAnalyzeUrl } from "@/lib/investigation/url-normalizer";
import { analyzePayload, calculateShannonEntropy } from "@/lib/investigation/payload-analyzer";
import { investigationEngine } from "@/lib/investigation";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 19: Scanner & Payload Adversarial Fuzzing Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Generative Control Characters & Unicode Fuzzing", () => {
    it("handles boundary Unicode, null bytes, and bidirectional overrides safely", () => {
      const adversarialSeeds = [
        "", // Empty
        "   \t\n\r   ", // Whitespace only
        "\x00\x00\x00\x00", // Null bytes
        "https://example.com/\x00/admin", // Null byte in path
        "https://\u202Eevil.com/doc/pdf.exe", // Right-to-Left Override (RLO)
        "https://example.com/\u200B\u200C\u200D\uFEFF/hidden", // Zero-width spaces
        "https://\uD800\uDC00.example.com", // Surrogate pairs
        "\x01\x02\x03\x04\x05\x06\x07\x08\x0B\x0C\x0E\x1F\x7F\x80\x9F", // Control characters
        "🔥🎯🛡️🔒⚡🚨".repeat(50), // Emoji flood
        "\u0000".repeat(500), // Massive null-byte flood
      ];

      for (const seed of adversarialSeeds) {
        const sanitized = sanitizeInput(seed);
        expect(typeof sanitized).toBe("string");
        expect(sanitized).not.toContain("\x00");

        const parsed = parseScanContent(seed, "QR_CODE");
        expect(parsed).toBeDefined();
        expect(typeof parsed.type).toBe("string");

        const payloadAnalysis = analyzePayload(seed);
        expect(payloadAnalysis.metrics.size).toBe(seed.length);
        expect(typeof payloadAnalysis.metrics.entropy).toBe("number");
        expect(payloadAnalysis.metrics.entropy).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("2. URL & IP Scheme Mutation Fuzzing", () => {
    it("fuzzes weird, nested, and malformed URL schemes without crashing", () => {
      const urlMutations = [
        "http://",
        "https://",
        "http:///",
        "http://:80",
        "http://user:pass@",
        "http://user:pass@:80",
        "http://[::1]:8080/path",
        "http://[fe80::1%25eth0]/",
        "http://2130706433/path", // DWORD representation of 127.0.0.1
        "http://0177.0.0.1/admin", // Octal representation
        "http://0x7f.0.0.1/test", // Hex representation
        "http://999.999.999.999/invalid", // Invalid IP octets
        "http://1.2.3.4.5.6.7/extra-dots",
        "http://example.com:0/zero-port",
        "http://example.com:65535/max-port",
        "http://example.com:65536/overflow-port",
        "http://example.com:-80/negative-port",
        "http://example.com/%25252520/double-encoded",
        "http://example.com/\r\nSet-Cookie:admin=1\r\n", // CRLF injection attempt
        "http://a.b.c.d.e.f.g.h.i.j.k.l.m.n.o.p.q.r.s.t.u.v.w.x.y.z.com/", // Deep subdomain
        "javascript://%0Aalert(1)",
        "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
        "view-source:http://example.com",
        "blob:http://example.com/3f40f098-508b-4a5e",
      ];

      for (const urlStr of urlMutations) {
        const safety = analyzeUrlSafety(urlStr);
        expect(safety).toBeDefined();
        expect(["safe", "suspicious", "malicious"]).toContain(safety.level);

        const isWeb = validateWebUrl(urlStr);
        expect(typeof isWeb).toBe("boolean");

        const { result, findings } = normalizeAndAnalyzeUrl(urlStr);
        expect(result).toBeDefined();
        expect(Array.isArray(findings)).toBe(true);

        const ipv4Info = parseIpv4Notation(urlStr);
        expect(typeof ipv4Info.isIp).toBe("boolean");
      }
    });
  });

  describe("3. Malformed Structured QR Formats Fuzzing", () => {
    it("fuzzes broken vCards, corrupted Wi-Fi strings, and invalid GS1 barcodes", () => {
      const brokenPayloads: { content: string; format: ScanRecord["format"] }[] = [
        // Broken vCards
        { content: "BEGIN:VCARD\nVERSION:3.0\nN:Unclosed", format: "QR_CODE" },
        { content: "BEGIN:VCARD\nVERSION:\nFN:\nTEL:invalid\nEND:VCARD", format: "QR_CODE" },
        { content: "BEGIN:VCARD\n" + "NOTE:x".repeat(1000) + "\nEND:VCARD", format: "QR_CODE" },

        // Broken Wi-Fi
        { content: "WIFI:;", format: "QR_CODE" },
        { content: "WIFI:S:;;P:;;T:;;", format: "QR_CODE" },
        { content: "WIFI:S:MySSID;T:UNKNOWN_AUTH;P:12345;;", format: "QR_CODE" },
        { content: "WIFI:S:" + "A".repeat(2000) + ";T:WPA;P:pass;;", format: "QR_CODE" },

        // Broken barcodes
        { content: "ABC-NOT-DIGITS", format: "EAN_13" },
        { content: "123", format: "UPC_A" },
        { content: "0".repeat(100), format: "EAN_8" },
        { content: "(01)98765432101234(10)ABC\x1D(21)", format: "CODE_128" },

        // Crypto & payment
        { content: "bitcoin:?amount=NaN", format: "QR_CODE" },
        { content: "ethereum:0xINVALID_HEX_ADDRESS", format: "QR_CODE" },
        { content: "upi://pay?pa=&pn=&am=invalid_amount", format: "QR_CODE" },
      ];

      for (const item of brokenPayloads) {
        const parsed = parseScanContent(item.content, item.format);
        expect(parsed).toBeDefined();
        expect(typeof parsed.type).toBe("string");
      }
    });
  });

  describe("4. Oversized Payload & Resource Exhaustion Bounds", () => {
    it("processes massive inputs (10KB to 100KB) within strict time bounds without stalling", async () => {
      const hugeStrings = [
        "A".repeat(10000),
        "https://example.com/search?q=" + "x".repeat(25000),
        "WIFI:S:Network;P=" + "1".repeat(50000) + ";;",
        "data:text/plain;base64," + "A".repeat(100000),
      ];

      for (const hugeStr of hugeStrings) {
        const startTime = performance.now();

        // 1. Sanitization speed
        const sanitized = sanitizeInput(hugeStr, 2048);
        expect(sanitized.length).toBeLessThanOrEqual(2048);

        // 2. Entropy calculation speed
        const entropy = calculateShannonEntropy(hugeStr);
        expect(typeof entropy).toBe("number");

        // 3. Parser execution
        const parsed = parseScanContent(hugeStr, "QR_CODE");
        expect(parsed).toBeDefined();

        const duration = performance.now() - startTime;
        // Strict bound: must process in less than 100ms
        expect(duration).toBeLessThan(100);
      }
    });

    it("runs complete investigation on adversarial oversized payload without crashing", async () => {
      const adversarialInput = "https://phish.example.org/login?" + "payload=".repeat(500) + "alert(1)";
      const parsed = parseScanContent(adversarialInput, "QR_CODE");

      const scan: ScanRecord = {
        id: "scan-fuzz-huge",
        content: adversarialInput,
        type: parsed.type,
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-fuzz-1", {
        userConsent: false, // Pure local analysis
      });

      expect(report.status).toBe("complete");
      expect(report.finalRisk.numeric).toBeGreaterThanOrEqual(0);
      expect(report.finalRisk.numeric).toBeLessThanOrEqual(100);
      expect(findings.length).toBeGreaterThan(0);
    });
  });
});
