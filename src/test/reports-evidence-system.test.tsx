import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import ReportsScreen from "@/pages/Reports";
import { FormalReportDossier } from "@/components/reports/FormalReportDossier";
import type { InvestigationReport, RiskScoreSummary } from "@/lib/scan/types";

const mockRisk: RiskScoreSummary = {
  overall: "critical",
  numeric: 85,
  confidence: 0.9,
  confidenceScore: 0.9,
  confidenceLevel: "high",
  verdict: "High-Risk Credential Harvester Phishing Site",
  explanation: "Target employs deceptive domain name spoofing and embedded credentials.",
  evidence: [],
  primaryDrivers: ["Domain lookalike spoofing targeted financial brand", "Embedded plaintext user authentication credentials"],
  mitigatingFactors: ["Valid TLS certificate issued via Let's Encrypt"],
  missingIntelligence: ["VirusTotal: Not configured in BYOK Integrations"],
};

const mockReport: InvestigationReport = {
  id: "rep-test-12345",
  caseId: "case-test-9999",
  createdAt: Date.now() - 3600000,
  updatedAt: Date.now(),
  status: "complete",
  sourceScanId: "scan-test-12345",
  rawContent: "https://admin:pass123@secure-login-verify-bank.com/portal",
  contentType: "url",
  format: "QR_CODE",
  targets: {
    urls: [{ url: "https://admin:pass123@secure-login-verify-bank.com/portal", domain: "secure-login-verify-bank.com" }],
    domains: ["secure-login-verify-bank.com"],
    hosts: ["198.51.100.22"],
    phoneNumbers: [],
    emails: [],
    productCodes: [],
  },
  payloadAnalysis: {
    hasCredentialsEmbedded: true,
    hasIps: false,
    hasObfuscation: true,
    entropy: 4.85,
    size: 56,
  },
  urlSafetySnapshot: mockRisk,
  domainIntel: {
    domain: "secure-login-verify-bank.com",
    registrar: "NameCheap Inc",
    creationDate: Date.now() - 86400000 * 2,
    tld: "com",
  },
  hostIntel: [
    {
      ip: "198.51.100.22",
      asn: { number: 13335, organization: "Cloudflare Inc", type: "hosting" },
    },
  ],
  reputation: [
    {
      source: "Local Heuristic Engine",
      scope: "url",
      classification: "malicious",
      categories: ["credential-harvester"],
      threats: ["Embedded credentials"],
    },
  ],
  findings: [
    {
      id: "find-1",
      kind: "embedded-credentials",
      title: "Embedded HTTP Basic Credentials",
      summary: "Plaintext user credentials detected in URL payload.",
      severity: "critical",
      confidence: 0.95,
      references: ["RFC 3986", "CWE-522"],
    },
  ],
  finalRisk: mockRisk,
  intelligenceFlags: {
    whoisEnabled: true,
    rdapEnabled: true,
    dnsEnabled: true,
    asnEnabled: true,
    geoEnabled: true,
    certEnabled: true,
    redirectEnabled: true,
    reputationEnabled: true,
    userControlled: false,
  },
};

const mockReportsList = [mockReport];

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => {
    const fnStr = fn.toString();
    if (fnStr.includes("cases")) {
      return [
        {
          id: "case-test-9999",
          label: "Operation Bank Phish",
          primaryTarget: "https://secure-login-verify-bank.com",
          latestRiskLevel: "critical",
          latestInvestigationId: "rep-test-12345",
          updatedAt: Date.now(),
        },
      ];
    }
    return mockReportsList;
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    investigations: {
      orderBy: () => ({
        reverse: () => ({
          toArray: async () => mockReportsList,
        }),
      }),
      delete: vi.fn(),
      put: vi.fn(),
    },
    cases: {
      toArray: async () => [
        {
          id: "case-test-9999",
          label: "Operation Bank Phish",
          primaryTarget: "https://secure-login-verify-bank.com",
          latestRiskLevel: "critical",
          latestInvestigationId: "rep-test-12345",
          updatedAt: Date.now(),
        },
      ],
      update: vi.fn(),
    },
  },
}));

describe("ScanIQ Community — Phase 7: Reports & Evidence", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. FormalReportDossier renders structured investigation sections with SHA-256 integrity", async () => {
    const onClose = vi.fn();
    render(
      <TooltipProvider>
        <FormalReportDossier isOpen={true} onClose={onClose} report={mockReport} />
      </TooltipProvider>
    );

    // Section 1: Executive Verdict
    expect(screen.getByText(/1\. executive summary & verdict/i)).toBeDefined();
    expect(screen.getByText(/high-risk credential harvester phishing site/i)).toBeDefined();
    expect(screen.getByText(/85\/100/i)).toBeDefined();

    // Section 2: Target & Decoded Input
    expect(screen.getByText(/2\. target & decoded input/i)).toBeDefined();
    expect(screen.getByText(/https:\/\/admin:pass123@secure-login-verify-bank\.com\/portal/i)).toBeDefined();

    // Section 3: Risk Drivers
    expect(screen.getByText(/3\. risk drivers & mitigating factors/i)).toBeDefined();
    expect(screen.getByText(/domain lookalike spoofing targeted financial brand/i)).toBeDefined();

    // Section 4: Evidence Findings
    expect(screen.getByText(/4\. evidence findings/i)).toBeDefined();
    expect(screen.getByText(/embedded http basic credentials/i)).toBeDefined();

    // Section 5: Sources Coverage Matrix
    expect(screen.getByText(/5\. intelligence sources coverage matrix/i)).toBeDefined();
    expect(screen.getByText(/dns-over-https/i)).toBeDefined();

    // Section 6: Limitations
    expect(screen.getByText(/6\. analysis scope & limitations/i)).toBeDefined();

    // Section 7: Cryptographic Integrity
    expect(screen.getByText(/report canonical digest \(sha-256\)/i)).toBeDefined();
  });

  it("2. ReportsScreen renders list of reports and aggregate metrics", async () => {
    render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/reports"]}>
          <ReportsScreen />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/investigation reports & evidence/i)).toBeDefined();
      expect(screen.getByText(/total reports/i)).toBeDefined();
      expect(screen.getByText(/generate from case/i)).toBeDefined();
      expect(screen.getAllByText(/https:\/\/admin:pass123@secure-login-verify-bank\.com/i).length).toBeGreaterThan(0);
    });
  });

  it("3. Opens Formal Report Dossier when clicking View Dossier", async () => {
    render(
      <TooltipProvider>
        <MemoryRouter initialEntries={["/reports"]}>
          <ReportsScreen />
        </MemoryRouter>
      </TooltipProvider>
    );

    await waitFor(() => {
      const viewBtns = screen.getAllByRole("button", { name: /view dossier/i });
      fireEvent.click(viewBtns[0]);
    });

    expect(screen.getByText(/scaniq cyber intelligence report/i)).toBeDefined();
    expect(screen.getByText(/1\. executive summary & verdict/i)).toBeDefined();
  });
});
