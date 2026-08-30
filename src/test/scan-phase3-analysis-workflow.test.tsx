import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ScanAnalysisResult } from "@/components/investigation/ScanAnalysisResult";
import type { InvestigationReport, ScanRecord } from "@/lib/scan/types";
import type { InvestigationFinding } from "@/lib/investigation/types";

describe("ScanIQ Community — Phase 3: Unified Scan & Analysis Workflow", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const mockScanRecord: ScanRecord = {
    id: "scan-test-123",
    content: "https://auth.internal-gateway.xyz/login?token=abc12345",
    format: "QR_CODE",
    type: "url",
    parsed: { domain: "auth.internal-gateway.xyz", scheme: "https" },
    safetyStatus: "suspicious",
    scannedAt: Date.now(),
    investigationId: "inv-test-123",
    caseId: "case-test-123",
  };

  const mockReport: InvestigationReport = {
    id: "inv-test-123",
    caseId: "case-test-123",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "complete",
    sourceScanId: "scan-test-123",
    rawContent: "https://auth.internal-gateway.xyz/login?token=abc12345",
    contentType: "url",
    format: "QR_CODE",
    targets: {
      urls: [
        {
          scheme: "https",
          domain: "internal-gateway.xyz",
          fqdn: "auth.internal-gateway.xyz",
          subdomains: ["auth"],
          tld: "xyz",
          path: "/login",
          query: "token=abc12345",
          fragment: "",
          isIdn: false,
          isIp: false,
          isShortlinkLike: false,
        },
      ],
      domains: ["internal-gateway.xyz"],
      hosts: ["auth.internal-gateway.xyz"],
      phoneNumbers: [],
      emails: ["security-alert@internal-gateway.xyz"],
      productCodes: [],
    },
    payloadAnalysis: {
      hasCredentialsEmbedded: true,
      hasIps: false,
      hasObfuscation: true,
      usesDangerousProtocol: false,
      size: 55,
      entropy: 4.82,
      anomalies: [
        "Embedded authentication token in URL query parameter",
        "High Shannon entropy in query string (4.82 bits)",
      ],
    },
    urlSafetySnapshot: {
      overall: "high",
      numeric: 74,
      confidence: 90,
    },
    domainIntel: {
      nameservers: ["ns1.cloudflare.com"],
      dns: [],
      statuses: [],
      whoisRedacted: true,
    },
    hostIntel: [],
    reputation: [],
    findings: [],
    finalRisk: {
      overall: "high",
      numeric: 74,
      confidence: 90,
      verdict: "High Risk: Obfuscated authentication token & suspicious TLD",
      primaryDrivers: [
        "Embedded authentication credentials in URL query parameter",
        "Suspicious TLD '.xyz' commonly associated with credential phishing",
      ],
    },
    intelligenceFlags: {
      whoisEnabled: false,
      rdapEnabled: false,
      dnsEnabled: false,
      asnEnabled: false,
      geoEnabled: false,
      certEnabled: false,
      redirectEnabled: false,
      reputationEnabled: false,
      userControlled: true,
    },
  };

  const mockFindings: InvestigationFinding[] = [
    {
      id: "f-1",
      category: "url",
      nature: "heuristic_indicator",
      finding: "Embedded Credentials in Query",
      severity: "high",
      evidence: "URL parameter 'token' contains sensitive credential payload.",
      confidence: 0.9,
      source: "url-heuristics",
      timestamp: Date.now(),
    },
    {
      id: "f-2",
      category: "payload",
      nature: "observed_fact",
      finding: "High Shannon Entropy",
      severity: "medium",
      evidence: "Payload entropy calculated at 4.82 bits/byte indicating obfuscation.",
      confidence: 0.85,
      source: "payload-analyzer",
      timestamp: Date.now(),
    },
  ];

  const renderResult = (onScanAnother = vi.fn()) => {
    return render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/"]}>
          <ScanAnalysisResult
            scan={mockScanRecord}
            report={mockReport}
            findings={mockFindings}
            caseId={mockScanRecord.caseId}
            onScanAnother={onScanAnother}
          />
        </MemoryRouter>
      </TooltipProvider>
    );
  };

  it("renders the 1. Verdict & Risk Summary with primary drivers", () => {
    renderResult();

    expect(screen.getByText(/evaluation verdict/i)).toBeDefined();
    expect(screen.getByText(/risk assessment: high/i)).toBeDefined();
    expect(screen.getByText(/74\/100/i)).toBeDefined();
    expect(
      screen.getByText(/embedded authentication credentials/i)
    ).toBeDefined();
  });

  it("renders 2. Raw Decoded Payload and 3. Normalized Representation", () => {
    renderResult();

    expect(screen.getByText(/raw decoded payload/i)).toBeDefined();
    expect(screen.getByText(/normalized representation/i)).toBeDefined();
    expect(screen.getAllByText(/https:\/\/auth.internal-gateway.xyz/i).length).toBeGreaterThan(0);
  });

  it("renders 4. Extracted Indicators of Compromise (IOCs)", () => {
    renderResult();

    expect(screen.getByText(/extracted indicators \(iocs\)/i)).toBeDefined();
    expect(screen.getAllByText(/auth.internal-gateway.xyz/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/security-alert@internal-gateway.xyz/i)).toBeDefined();
  });

  it("renders 5. Local Heuristic Findings with nature and confidence", () => {
    renderResult();

    expect(screen.getByText(/local heuristic findings/i)).toBeDefined();
    expect(screen.getByText(/embedded credentials in query/i)).toBeDefined();
    expect(screen.getByText(/conf: 90%/i)).toBeDefined();
  });

  it("renders 6. Technical Analysis Details and 7. Intelligence Coverage Matrix", () => {
    renderResult();

    expect(screen.getByText(/technical analysis metrics/i)).toBeDefined();
    expect(screen.getByText(/intelligence coverage & scope/i)).toBeDefined();
    expect(screen.getByText(/active local analyzers \(offline\)/i)).toBeDefined();
    expect(screen.getByText(/external services \(not queried\)/i)).toBeDefined();
  });

  it("provides 8. Recommended Actions with Destination Safety Dialog", () => {
    renderResult();

    expect(screen.getByRole("button", { name: /export json report/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /open destination/i })).toBeDefined();

    // Click Open Destination to verify safety confirmation dialog
    const openBtn = screen.getByRole("button", { name: /open destination/i });
    fireEvent.click(openBtn);

    expect(screen.getByText(/confirm external destination/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /proceed to destination/i })).toBeDefined();
  });
});
