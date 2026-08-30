import { describe, it, expect } from "vitest";
import { normalizeAndAnalyzeUrl } from "@/lib/investigation/url-normalizer";
import { analyzeUrlHeuristics } from "@/lib/investigation/url-heuristics";
import { detectBrandImpersonation } from "@/lib/investigation/brand-detector";
import { analyzePayload } from "@/lib/investigation/payload-analyzer";
import { analyzeRedirectPatternsLocally } from "@/lib/investigation/redirect-analyzer";
import { ExplainableRiskEngine } from "@/lib/investigation/risk-engine";
import type { TargetCollection } from "@/lib/investigation/types";

describe("Phase 5: Advanced OSINT & Detection Intelligence", () => {
  const riskEngine = new ExplainableRiskEngine();

  describe("1. URL Obfuscation & Confusables", () => {
    it("detects double URL encoding (%25)", () => {
      const url = "https://safe-portal.com/view?file=%252e%252e%252fetc%252fpasswd";
      const { result } = normalizeAndAnalyzeUrl(url);
      const findings = analyzeUrlHeuristics(result);

      expect(findings.some((f) => f.finding.includes("Double URL percent-encoding"))).toBe(true);
    });

    it("detects Punycode IDN homograph domain", () => {
      const url = "https://xn--pple-43d.com/login"; // apple.com with Cyrillic 'a'
      const { result, findings: normFindings } = normalizeAndAnalyzeUrl(url);
      const heurFindings = analyzeUrlHeuristics(result);
      const allFindings = [...normFindings, ...heurFindings];

      expect(allFindings.some((f) => f.finding.includes("Punycode"))).toBe(true);
      expect(result.summary.isIdn).toBe(true);
    });

    it("detects embedded basic-auth user credentials in URLs", () => {
      const url = "https://admin:supersecretpassword@router-config.local/setup";
      const { findings } = analyzePayload(url);

      expect(findings.some((f) => f.finding.includes("Embedded authentication credentials"))).toBe(true);
    });

    it("detects suspicious port destinations (non-standard web ports)", () => {
      const url = "https://bank-login.com:6667/auth";
      const { result, findings } = normalizeAndAnalyzeUrl(url);

      expect(findings.some((f) => f.finding.includes(":6667"))).toBe(true);
      expect(result.summary.port).toBe(6667);
    });
  });

  describe("2. Defensive Brand Impersonation Intelligence", () => {
    it("detects typosquatted/lookalike domains for major brands", () => {
      const result = detectBrandImpersonation("paypa1-security.com");
      expect(result.detected).toBe(true);
      expect(result.impersonatedBrand?.name).toBe("PayPal");
      expect(result.findings.length).toBeGreaterThan(0);
    });

    it("detects keyword-stuffed brand phishing hostnames", () => {
      const result = detectBrandImpersonation("chase-security-verify.com");
      expect(result.detected).toBe(true);
      expect(result.impersonatedBrand?.name).toBe("Chase");
    });
  });

  describe("3. Payload Intelligence (Wi-Fi, Crypto, vCard, Dangerous Schemes)", () => {
    it("identifies unencrypted open Wi-Fi configurations as a medium security concern", () => {
      const wifiPayload = "WIFI:S:Airport_Free_Wifi;T:nopass;P:;;";
      const { targets, findings } = analyzePayload(wifiPayload);

      expect(targets.wifiConfigs).toHaveLength(1);
      expect(targets.wifiConfigs?.[0].ssid).toBe("Airport_Free_Wifi");
      expect(findings.some((f) => f.finding.includes("Unencrypted / Open Wi-Fi Network"))).toBe(true);
    });

    it("extracts and analyzes cryptocurrency URI destinations", () => {
      const cryptoPayload = "bitcoin:1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?amount=0.5";
      const { targets, findings } = analyzePayload(cryptoPayload);

      expect(targets.cryptoAddresses.some((c) => c.currency === "BTC")).toBe(true);
      expect(findings.some((f) => f.finding.includes("Cryptocurrency Destination Address"))).toBe(true);
    });

    it("extracts contact cards (vCard) and embedded links", () => {
      const vcard = `BEGIN:VCARD
VERSION:3.0
N:Doe;John;;;
FN:John Doe
ORG:Acme Corp
TEL;TYPE=CELL:+1234567890
EMAIL:john@acme.com
URL:https://acme.com/portfolio
END:VCARD`;

      const { targets, findings } = analyzePayload(vcard);
      expect(findings.some((f) => f.finding.includes("Contact Card (vCard)"))).toBe(true);
      expect(targets.urls.some((u) => u.domain === "acme.com")).toBe(true);
    });

    it("flags dangerous executable protocols like javascript: or data:", () => {
      const scriptPayload = "javascript:alert(document.cookie)";
      const { metrics, findings } = analyzePayload(scriptPayload);

      expect(metrics.usesDangerousProtocol).toBe(true);
      expect(findings.some((f) => f.severity === "critical")).toBe(true);
    });
  });

  describe("4. Redirect Intelligence", () => {
    it("detects cross-domain redirects and protocol downgrades", () => {
      const url = "https://gateway.example.com/out?dest=http%3A%2F%2Fdestination.org%2Flanding";
      const { result } = normalizeAndAnalyzeUrl(url);
      const { chain, findings } = analyzeRedirectPatternsLocally(result);

      expect(chain).toBeDefined();
      expect(chain?.crossesHosts).toBe(true);
      expect(findings.some((f) => f.finding.includes("Insecure protocol downgrade"))).toBe(true);
    });
  });

  describe("5. Multi-Indicator Risk Correlation", () => {
    it("compoundly reinforces risk score when typosquatting domain serves direct executable", () => {
      const targets: TargetCollection = {
        urls: [{ scheme: "https", domain: "micros0ft-update.xyz", fqdn: "micros0ft-update.xyz", subdomains: [], tld: "xyz", path: "/installer.exe", query: "", fragment: "", isIdn: false, isIp: false, isShortlinkLike: false }],
        domains: ["micros0ft-update.xyz"],
        hosts: [],
        ips: [],
        emails: [],
        phoneNumbers: [],
        cryptoAddresses: [],
        productCodes: [],
      };

      const findings = [
        {
          id: "finding-homoglyph-microsoft-1",
          category: "domain" as const,
          nature: "heuristic_indicator" as const,
          finding: "Homoglyph Substitution Detected: Impersonating Microsoft",
          severity: "high" as const,
          evidence: "Domain uses '0' instead of 'o'",
          confidence: 0.95,
          source: "brand-detector",
          timestamp: Date.now(),
        },
        {
          id: "finding-rdap-new-domain",
          category: "domain" as const,
          nature: "observed_fact" as const,
          finding: "Newly registered domain (3 days old)",
          severity: "medium" as const,
          evidence: "Domain was created on 2026-08-27",
          confidence: 0.9,
          source: "rdap",
          timestamp: Date.now(),
        },
        {
          id: "finding-heur-dangerous-download-exe",
          category: "behavior" as const,
          nature: "heuristic_indicator" as const,
          finding: "Direct executable download target (.exe)",
          severity: "high" as const,
          evidence: "Path links to installer.exe",
          confidence: 0.95,
          source: "url-heuristics",
          timestamp: Date.now(),
        },
      ];

      const assessment = riskEngine.evaluate(findings, targets);

      expect(assessment.level).toBe("critical");
      expect(assessment.score).toBeGreaterThanOrEqual(85);
      expect(assessment.primaryDrivers.length).toBeGreaterThan(0);
    });
  });
});
