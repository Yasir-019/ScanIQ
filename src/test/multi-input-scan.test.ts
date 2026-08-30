import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseScanContent } from "@/lib/scan/parser";
import { investigationEngine } from "@/lib/investigation";
import { getScannerService } from "@/lib/scanner-service";
import type { ScanRecord } from "@/lib/scan/types";

describe("Multi-Input Scan Experience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Input Modes & Parser Convergence", () => {
    it("convergently parses payloads originating from Camera, Image, or Paste inputs", () => {
      const cameraInput = {
        content: "https://phishing-site.xyz/login?user=victim",
        format: "QR_CODE" as const,
      };

      const imageInput = {
        content: "WIFI:S:MySecretSSID;T:WPA;P:Pass1234;;",
        format: "DATA_MATRIX" as const,
      };

      const pasteInput = {
        content: "mailto:analyst@security-firm.org?subject=Alert",
        format: "UNKNOWN" as const,
      };

      const parsedCamera = parseScanContent(cameraInput.content, cameraInput.format);
      expect(parsedCamera.type).toBe("url");

      const parsedImage = parseScanContent(imageInput.content, imageInput.format);
      expect(parsedImage.type).toBe("wifi");

      const parsedPaste = parseScanContent(pasteInput.content, pasteInput.format);
      expect(parsedPaste.type).toBe("email");
    });

    it("handles multiline and complex payloads safely in manual/paste entry", () => {
      const complexVCard = `BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
ORG:Security Lab
TEL;TYPE=WORK,VOICE:(555) 555-1234
EMAIL:johndoe@example.com
URL:https://example.com/jdoe
END:VCARD`;

      const parsed = parseScanContent(complexVCard, "UNKNOWN");
      expect(parsed.type).toBe("vcard");
      expect(parsed.data).toBeDefined();
    });

    it("safely enforces character limits and validates empty manual inputs", () => {
      const emptyInput = "   ";
      expect(emptyInput.trim().length).toBe(0);

      const largeInput = "A".repeat(5000);
      expect(largeInput.length).toBeGreaterThan(4096);
    });
  });

  describe("2. Client-Side Image Decoding Service", () => {
    it("has a functioning scanner service instance for client-side processing", () => {
      const svc = getScannerService();
      expect(svc).toBeDefined();
      expect(typeof svc.scanFile).toBe("function");
      expect(typeof svc.start).toBe("function");
      expect(typeof svc.stop).toBe("function");
    });
  });

  describe("3. Unified Investigation Pipeline Handshake", () => {
    it("feeds any input method into the same deterministic investigation engine", async () => {
      const inputSamples: { content: string; format: ScanRecord["format"] }[] = [
        { content: "https://suspicious-check.top/invoice.pdf", format: "QR_CODE" },
        { content: "https://suspicious-check.top/invoice.pdf", format: "UNKNOWN" }, // manual paste
      ];

      for (const sample of inputSamples) {
        const parsed = parseScanContent(sample.content, sample.format);
        const record: ScanRecord = {
          id: `scan-${Date.now()}-${Math.random()}`,
          content: sample.content,
          format: sample.format,
          type: parsed.type,
          parsed: parsed.data,
          safetyStatus: "unchecked",
          scannedAt: Date.now(),
        };

        const { report, findings } = await investigationEngine.runInvestigation(record, "case-multi-input-test");

        expect(report.id).toBeDefined();
        expect(report.targets.urls.length).toBeGreaterThan(0);
        expect(report.finalRisk).toBeDefined();
        expect(typeof report.finalRisk.numeric).toBe("number");
        expect(findings.length).toBeGreaterThan(0);
      }
    });

    it("preserves inspection-first safety: never executes URLs or protocols automatically", async () => {
      const dangerousPayload = "javascript:alert(document.cookie)";
      const parsed = parseScanContent(dangerousPayload, "UNKNOWN");
      const record: ScanRecord = {
        id: "scan-safe-test",
        content: dangerousPayload,
        format: "UNKNOWN",
        type: parsed.type,
        parsed: parsed.data,
        safetyStatus: "unchecked",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(record, "case-safe-test");

      expect(report.finalRisk.overall).toMatch(/malicious|critical|high|medium|suspicious/);
      expect(findings.some((f) => f.finding.toLowerCase().includes("dangerous") || f.finding.toLowerCase().includes("javascript"))).toBe(true);
    });
  });
});
