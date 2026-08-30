import { describe, it, expect } from "vitest";
import { investigationEngine } from "@/lib/investigation";
import type { ScanRecord } from "@/lib/scan/types";

describe("Investigation Engine Pipeline", () => {
  it("evaluates a legitimate HTTPS URL as benign with 0 adverse findings", async () => {
    const scan: ScanRecord = {
      id: "scan-test-1",
      content: "https://github.com/torvalds/linux",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const { report, findings } = await investigationEngine.runInvestigation(scan);

    expect(report.finalRisk.overall).toBe("benign");
    expect(report.finalRisk.numeric).toBe(0);
    expect(report.finalRisk.confidence).toBeGreaterThanOrEqual(0.9);
    expect(findings.every((f) => f.severity === "informational" || f.severity === "low")).toBe(true);
    expect(report.finalRisk.mitigatingFactors).toBeDefined();
    expect(report.finalRisk.mitigatingFactors?.length).toBeGreaterThan(0);
  });

  it("evaluates a dangerous javascript protocol as critical", async () => {
    const scan: ScanRecord = {
      id: "scan-test-2",
      content: "javascript:/*--></title></style></textarea></script><svg/onload=alert(1)>",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const { report, findings } = await investigationEngine.runInvestigation(scan);

    expect(report.finalRisk.overall).toBe("critical");
    expect(findings.some((f) => f.severity === "critical")).toBe(true);
    expect(report.finalRisk.primaryDrivers?.length).toBeGreaterThan(0);
  });

  it("detects embedded credentials as high severity", async () => {
    const scan: ScanRecord = {
      id: "scan-test-3",
      content: "https://admin:SuperSecretPassword123@login.bankofamerica.com/verify",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const { report, findings } = await investigationEngine.runInvestigation(scan);

    expect(report.finalRisk.overall).toBe("high");
    expect(findings.some((f) => f.finding.includes("Embedded authentication credentials"))).toBe(true);
  });

  it("detects cross-domain open redirects and suspicious TLDs", async () => {
    const scan: ScanRecord = {
      id: "scan-test-4",
      content: "http://paypa1-security-verification.top/signin?redirect=https%3A%2F%2Fattacker.com",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const { report, findings } = await investigationEngine.runInvestigation(scan);

    expect(["medium", "high", "critical"]).toContain(report.finalRisk.overall);
    expect(findings.some((f) => f.category === "behavior" || f.category === "domain")).toBe(true);
  });

  it("flags private RFC 1918 addresses", async () => {
    const scan: ScanRecord = {
      id: "scan-test-5",
      content: "http://192.168.1.1:8080/setup.cgi",
      format: "QR_CODE",
      type: "url",
      scannedAt: Date.now(),
    };

    const { findings } = await investigationEngine.runInvestigation(scan);

    expect(findings.some((f) => f.evidence.includes("RFC 1918") || f.finding.includes("private/internal network IP"))).toBe(true);
  });

  it("evaluates plain barcode with 0 false positive alarms as unknown/insufficient evidence", async () => {
    const scan: ScanRecord = {
      id: "scan-test-6",
      content: "5012345678900",
      format: "EAN_13",
      type: "product",
      scannedAt: Date.now(),
    };

    const { report } = await investigationEngine.runInvestigation(scan);

    expect(report.finalRisk.overall).toBe("unknown");
    expect(report.finalRisk.numeric).toBe(0);
    expect(report.targets.productCodes).toContain("5012345678900");
  });
});
