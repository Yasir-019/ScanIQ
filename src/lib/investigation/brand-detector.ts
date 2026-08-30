import type { InvestigationFinding } from "./types";

export interface TargetBrand {
  name: string;
  category: "financial" | "technology" | "social" | "logistics" | "crypto" | "government" | "telecom";
  canonicalDomains: string[];
  keywords: string[];
}

export const TARGET_BRANDS: TargetBrand[] = [
  // Financial & Banking
  { name: "PayPal", category: "financial", canonicalDomains: ["paypal.com", "paypal.me"], keywords: ["paypal"] },
  { name: "Chase", category: "financial", canonicalDomains: ["chase.com"], keywords: ["chase", "chasebank"] },
  { name: "Bank of America", category: "financial", canonicalDomains: ["bankofamerica.com", "bofa.com"], keywords: ["bankofamerica", "bofamerica", "bofa"] },
  { name: "Wells Fargo", category: "financial", canonicalDomains: ["wellsfargo.com"], keywords: ["wellsfargo", "wells-fargo"] },
  { name: "Citibank", category: "financial", canonicalDomains: ["citi.com", "citibank.com"], keywords: ["citibank", "citigroup", "citi-bank"] },
  { name: "American Express", category: "financial", canonicalDomains: ["americanexpress.com", "amex.com"], keywords: ["americanexpress", "amex"] },
  { name: "Barclays", category: "financial", canonicalDomains: ["barclays.co.uk", "barclays.com"], keywords: ["barclays", "barclay"] },
  { name: "HSBC", category: "financial", canonicalDomains: ["hsbc.com", "hsbc.co.uk"], keywords: ["hsbc", "hsbcbank"] },
  { name: "Santander", category: "financial", canonicalDomains: ["santander.com", "santander.co.uk"], keywords: ["santander"] },

  // Big Tech & Cloud
  { name: "Google", category: "technology", canonicalDomains: ["google.com", "youtube.com", "gmail.com"], keywords: ["google", "gmail"] },
  { name: "Microsoft", category: "technology", canonicalDomains: ["microsoft.com", "live.com", "office.com", "outlook.com"], keywords: ["microsoft", "office365", "msft"] },
  { name: "Apple", category: "technology", canonicalDomains: ["apple.com", "icloud.com"], keywords: ["apple", "icloud", "appleid"] },
  { name: "Amazon", category: "technology", canonicalDomains: ["amazon.com", "amazon.co.uk", "aws.amazon.com"], keywords: ["amazon", "primevideo"] },
  { name: "Netflix", category: "technology", canonicalDomains: ["netflix.com"], keywords: ["netflix"] },
  { name: "Meta / Facebook", category: "social", canonicalDomains: ["meta.com", "facebook.com", "fb.com"], keywords: ["facebook", "meta-security"] },
  { name: "Instagram", category: "social", canonicalDomains: ["instagram.com"], keywords: ["instagram"] },
  { name: "WhatsApp", category: "social", canonicalDomains: ["whatsapp.com"], keywords: ["whatsapp"] },
  { name: "Telegram", category: "social", canonicalDomains: ["telegram.org", "t.me"], keywords: ["telegram"] },

  // Crypto & Web3
  { name: "Binance", category: "crypto", canonicalDomains: ["binance.com"], keywords: ["binance"] },
  { name: "Coinbase", category: "crypto", canonicalDomains: ["coinbase.com"], keywords: ["coinbase"] },
  { name: "MetaMask", category: "crypto", canonicalDomains: ["metamask.io"], keywords: ["metamask"] },
  { name: "Ledger", category: "crypto", canonicalDomains: ["ledger.com"], keywords: ["ledger", "ledger-live"] },
  { name: "Trezor", category: "crypto", canonicalDomains: ["trezor.io"], keywords: ["trezor"] },
  { name: "Kraken", category: "crypto", canonicalDomains: ["kraken.com"], keywords: ["kraken"] },

  // Logistics & Delivery
  { name: "DHL", category: "logistics", canonicalDomains: ["dhl.com", "dhl.de"], keywords: ["dhl-express", "dhl-tracking"] },
  { name: "FedEx", category: "logistics", canonicalDomains: ["fedex.com"], keywords: ["fedex", "fedextracking"] },
  { name: "UPS", category: "logistics", canonicalDomains: ["ups.com"], keywords: ["ups-delivery", "ups-tracking"] },
  { name: "USPS", category: "logistics", canonicalDomains: ["usps.com"], keywords: ["usps", "usps-tracking"] },

  // Government & Tax
  { name: "IRS", category: "government", canonicalDomains: ["irs.gov"], keywords: ["irs-gov", "irs-tax"] },
  { name: "HMRC", category: "government", canonicalDomains: ["gov.uk"], keywords: ["hmrc-tax", "hmrc-refund"] },
  { name: "US Gov", category: "government", canonicalDomains: ["usa.gov"], keywords: ["usa-gov", "social-security-admin"] },
];

export const SECURITY_ACTION_TERMS = [
  "login",
  "log-in",
  "signin",
  "sign-in",
  "verify",
  "verification",
  "authenticate",
  "security",
  "secure",
  "update",
  "account",
  "billing",
  "payment",
  "unlock",
  "suspended",
  "kyc",
  "wallet",
  "recovery",
  "support",
  "portal",
  "validation",
  "confirm",
  "password",
];

const HOMOGLYPH_MAP: Record<string, string> = {
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  "vv": "w",
  "rn": "m",
  "cl": "d",
};

/**
 * Computes Levenshtein edit distance between two strings.
 */
export function calculateLevenshtein(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
  for (let j = 0; j <= an; j++) matrix[0][j] = j;

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Normalizes common homoglyphs and leetspeak substitutions to standard Latin characters.
 */
export function normalizeHomoglyphs(str: string): string {
  let normalized = str.toLowerCase();
  for (const [sub, rep] of Object.entries(HOMOGLYPH_MAP)) {
    normalized = normalized.split(sub).join(rep);
  }
  return normalized;
}

export interface BrandDetectionResult {
  detected: boolean;
  impersonatedBrand?: TargetBrand;
  matchedKeyword?: string;
  similarityType?: "homoglyph" | "typosquat" | "subdomain_deception" | "keyword_insertion" | "punycode";
  findings: InvestigationFinding[];
}

/**
 * Detects brand impersonation, typosquatting, character substitutions, and deceptive subdomain structures.
 */
export function detectBrandImpersonation(domain: string, fqdn?: string): BrandDetectionResult {
  const findings: InvestigationFinding[] = [];
  const now = Date.now();
  const cleanDomain = domain.toLowerCase().trim();
  const cleanFqdn = (fqdn || domain).toLowerCase().trim();

  // Strip TLD for core name analysis
  const parts = cleanDomain.split(".");
  const sld = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const normalizedSld = normalizeHomoglyphs(sld);

  // Check Punycode (IDN homograph attack)
  if (cleanDomain.startsWith("xn--") || cleanDomain.includes(".xn--")) {
    findings.push({
      id: `finding-punycode-${cleanDomain}-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `Internationalized Domain Name (Punycode): ${cleanDomain}`,
      severity: "medium",
      evidence: `Domain uses Punycode encoding (${cleanDomain}), a common technique in IDN homograph phishing to display visually identical foreign scripts.`,
      confidence: 0.85,
      source: "Brand & Homoglyph Detector",
      timestamp: now,
      metadata: { domain: cleanDomain, isPunycode: true },
      technicalDetails: "Punycode domain names represent Unicode characters using ASCII compatible encoding (ACE).",
    });
  }

  for (const brand of TARGET_BRANDS) {
    // Skip if domain IS canonical for this brand
    if (brand.canonicalDomains.some((cd) => cleanDomain === cd || cleanDomain.endsWith(`.${cd}`))) {
      continue;
    }

    const brandNameLower = brand.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 1. Deceptive Subdomain Structure (e.g. paypal.com.verify-account.xyz or paypal.evil.com)
    if (cleanFqdn !== cleanDomain) {
      for (const canonical of brand.canonicalDomains) {
        if (cleanFqdn.includes(canonical) && !cleanFqdn.endsWith(canonical)) {
          findings.push({
            id: `finding-subdomain-deception-${brand.name}-${now}`,
            category: "domain",
            nature: "heuristic_indicator",
            finding: `Deceptive Subdomain Structure Impersonating ${brand.name}`,
            severity: "high",
            evidence: `Hostname '${cleanFqdn}' prefixes the brand's canonical domain ('${canonical}') as a deceptive subdomain under unrelated apex domain '${cleanDomain}'.`,
            confidence: 0.94,
            source: "Brand & Homoglyph Detector",
            timestamp: now,
            metadata: { fqdn: cleanFqdn, apexDomain: cleanDomain, targetBrand: brand.name },
            remediation: `Do not enter credentials. This domain is hosted on '${cleanDomain}', not '${canonical}'.`,
          });
          return {
            detected: true,
            impersonatedBrand: brand,
            matchedKeyword: canonical,
            similarityType: "subdomain_deception",
            findings,
          };
        }
      }
    }

    // 2. Homoglyph Substitution (e.g. paypa1, micros0ft, goog1e) - check FIRST before exact keyword insertion
    if (normalizedSld.includes(brandNameLower) && !sld.includes(brandNameLower)) {
      findings.push({
        id: `finding-homoglyph-${brand.name}-${now}`,
        category: "domain",
        nature: "heuristic_indicator",
        finding: `Homoglyph Substitution Detected: Impersonating ${brand.name}`,
        severity: "high",
        evidence: `Domain SLD '${sld}' uses character substitutions (homoglyphs) that visually normalize to '${brand.name}' (${brandNameLower}).`,
        confidence: 0.95,
        source: "Brand & Homoglyph Detector",
        timestamp: now,
        metadata: { sld, normalizedSld, brand: brand.name },
      });

      return {
        detected: true,
        impersonatedBrand: brand,
        matchedKeyword: brandNameLower,
        similarityType: "homoglyph",
        findings,
      };
    }

    // 3. Keyword Insertion with Security / Financial Action Term (e.g. paypal-security-update.com)
    for (const kw of brand.keywords) {
      if (sld.includes(kw)) {
        const hasActionTerm = SECURITY_ACTION_TERMS.some((term) => sld.includes(term) || cleanFqdn.includes(term));
        const severity = hasActionTerm || brand.category === "financial" || brand.category === "crypto" ? "high" : "medium";

        findings.push({
          id: `finding-brand-insertion-${brand.name}-${now}`,
          category: "domain",
          nature: "heuristic_indicator",
          finding: `Brand Impersonation Indicator: ${brand.name}`,
          severity,
          evidence: `Domain SLD '${sld}' contains targeted brand identifier '${kw}'${hasActionTerm ? " combined with security/account action keywords" : ""}, but is not operated by ${brand.name} (Canonical: ${brand.canonicalDomains.join(", ")}).`,
          confidence: 0.9,
          source: "Brand & Homoglyph Detector",
          timestamp: now,
          metadata: { sld, brand: brand.name, keyword: kw, hasActionTerm },
          remediation: `Verify legitimacy via official ${brand.name} portal before interacting.`,
        });

        return {
          detected: true,
          impersonatedBrand: brand,
          matchedKeyword: kw,
          similarityType: "keyword_insertion",
          findings,
        };
      }
    }

    // 4. Typosquatting (Levenshtein Distance 1 on core brand name for length >= 5)
    if (sld.length >= 5 && Math.abs(sld.length - brandNameLower.length) <= 1) {
      const dist = calculateLevenshtein(sld, brandNameLower);
      if (dist === 1) {
        findings.push({
          id: `finding-typosquat-${brand.name}-${now}`,
          category: "domain",
          nature: "heuristic_indicator",
          finding: `Typosquatting Deviation from ${brand.name}`,
          severity: "high",
          evidence: `Domain SLD '${sld}' has an edit distance of 1 from known brand '${brand.name}' (${brandNameLower}), indicating likely typosquatting registration.`,
          confidence: 0.88,
          source: "Brand & Homoglyph Detector",
          timestamp: now,
          metadata: { sld, brand: brand.name, distance: dist },
        });

        return {
          detected: true,
          impersonatedBrand: brand,
          matchedKeyword: brandNameLower,
          similarityType: "typosquat",
          findings,
        };
      }
    }
  }

  return {
    detected: findings.length > 0,
    findings,
  };
}
