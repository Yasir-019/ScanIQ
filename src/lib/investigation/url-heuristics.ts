import type { InvestigationFinding, NormalizedUrlResult } from "./types";
import { calculateShannonEntropy } from "./payload-analyzer";
import { detectBrandImpersonation } from "./brand-detector";

const KNOWN_SHORTENERS = new Set([
  "bit.ly", "t.co", "goo.gl", "tinyurl.com", "ow.ly", "is.gd", "buff.ly",
  "adf.ly", "cutt.ly", "t.ly", "rb.gy", "clck.ru", "shorte.st", "b.link",
  "lnkd.in", "fb.me", "g.co", "aka.ms", "s.id", "snip.ly", "linktr.ee",
  "campsite.bio", "shorturl.at", "tiny.cc", "j.mp", "qr.ae", "v.gd",
  "qr.net", "qrco.de", "me-qr.com", "qrfy.com", "flowcode.com",
]);

const SUSPICIOUS_TLDS = new Set([
  "top", "xyz", "buzz", "icu", "cam", "click", "link", "surf", "work",
  "gq", "cf", "ga", "ml", "tk", "rest", "fit", "monster", "cfd", "sbs",
  "beauty", "hair", "skin", "quest", "today", "bid", "loan", "men",
  "country", "kim", "win", "stream", "download", "racing",
]);

const DANGEROUS_DOWNLOAD_EXTENSIONS = new Set([
  "apk", "exe", "scr", "bat", "cmd", "vbs", "ps1", "msi", "jar",
  "dmg", "pkg", "deb", "rpm", "iso", "img", "vhd", "hta", "wsf", "reg",
  "dll", "sys", "com", "cpl", "inf", "gadget",
]);

const TRACKING_PARAMS = new Set([
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "msclkid", "dclid", "twclid", "mc_eid", "ad_id",
  "affiliate_id", "aff_id", "ref", "ref_src",
]);

export function analyzeUrlHeuristics(urlResult: NormalizedUrlResult): InvestigationFinding[] {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];

  if (!urlResult.isValid || !urlResult.parsedUrl) {
    return findings;
  }

  const { summary, original } = urlResult;
  const fqdn = summary.fqdn.toLowerCase();
  const domain = summary.domain.toLowerCase();
  const path = summary.path.toLowerCase();
  const query = summary.query.toLowerCase();

  // 1. URL Shortener Detection
  const isShortener =
    KNOWN_SHORTENERS.has(fqdn) ||
    KNOWN_SHORTENERS.has(domain);

  if (isShortener) {
    findings.push({
      id: `finding-heur-shortener-${now}`,
      category: "url",
      nature: "observed_fact",
      finding: `URL Shortener Service Detected: ${domain}`,
      severity: "low",
      evidence: `The destination URL uses a known link-shortening service (${domain}). Shortened links conceal the actual destination server and intermediate redirect hops until resolved.`,
      confidence: 0.95,
      source: "url-heuristics",
      timestamp: now,
      metadata: { shortener: domain },
      remediation: "Inspect intermediate hops or expand the shortened link safely before visiting.",
    });
  }

  // 2. Suspicious TLD Check
  const tldClean = summary.tld.replace(/^\./, "").toLowerCase();
  if (SUSPICIOUS_TLDS.has(tldClean)) {
    findings.push({
      id: `finding-heur-tld-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `High-risk top-level domain (.${tldClean})`,
      severity: "medium",
      evidence: `The domain extension .${tldClean} is statistically correlated with spam campaigns, disposable redirect gates, and phishing kits.`,
      confidence: 0.75,
      source: "url-heuristics",
      timestamp: now,
      metadata: { tld: tldClean },
    });
  }

  // 3. Subdomain Nesting & Complexity (DGA & multi-level subdomains)
  if (summary.subdomains.length >= 3) {
    findings.push({
      id: `finding-heur-deep-subdomain-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `Deep subdomain structure (${summary.subdomains.length} levels)`,
      severity: summary.subdomains.length >= 4 ? "medium" : "low",
      evidence: `Subdomain chain contains ${summary.subdomains.length} labels (${summary.subdomains.join(".")}). Attackers frequently use multi-level subdomains to mimic legitimate paths or evade domain-based reputation filters.`,
      confidence: 0.8,
      source: "url-heuristics",
      timestamp: now,
      metadata: { subdomains: summary.subdomains },
    });
  }

  // Check high entropy in subdomains
  for (const sub of summary.subdomains) {
    if (sub.length >= 10) {
      const subEntropy = calculateShannonEntropy(sub);
      if (subEntropy >= 3.6 && !/^[0-9]+$/.test(sub)) {
        findings.push({
          id: `finding-heur-subdomain-entropy-${sub}-${now}`,
          category: "domain",
          nature: "heuristic_indicator",
          finding: `High-entropy subdomain label: '${sub}' (${subEntropy})`,
          severity: "low",
          evidence: `The subdomain label '${sub}' demonstrates high character randomness, consistent with domain generation algorithms (DGA), dynamic DNS tunnels, or session tokens.`,
          confidence: 0.7,
          source: "url-heuristics",
          timestamp: now,
          metadata: { label: sub, entropy: subEntropy },
        });
        break;
      }
    }
  }

  // 4. Advanced Brand Impersonation, Homoglyphs & Typosquatting
  const brandResult = detectBrandImpersonation(domain, fqdn);
  if (brandResult.detected) {
    findings.push(...brandResult.findings);
  }

  // 5. Double URL Encoding & Obfuscation Detection
  if (/%25[0-9a-fA-F]{2}/i.test(original) || /%252f|%252e/i.test(original)) {
    findings.push({
      id: `finding-heur-double-encoding-${now}`,
      category: "url",
      nature: "heuristic_indicator",
      finding: "Double URL percent-encoding detected",
      severity: "high",
      evidence: "URL contains nested percent-encoded sequences (e.g. %25). Double encoding is frequently utilized to bypass web application firewalls (WAF) and URL security filters.",
      confidence: 0.92,
      source: "url-heuristics",
      timestamp: now,
      technicalDetails: "Nested percent-encoding (%25) resolves into secondary encoded characters upon single decoding pass.",
    });
  }

  if (/\\u[0-9a-fA-F]{4}/i.test(original)) {
    findings.push({
      id: `finding-heur-unicode-escapes-${now}`,
      category: "url",
      nature: "heuristic_indicator",
      finding: "Unicode escape sequences in URL string",
      severity: "medium",
      evidence: "URL incorporates raw Unicode escape sequences (\\uXXXX) to obfuscate destination characters.",
      confidence: 0.88,
      source: "url-heuristics",
      timestamp: now,
    });
  }

  // 6. Direct Executable / Dangerous File Download
  const pathExtensionMatch = path.match(/\.([a-z0-9]{2,5})(?:$|\?)/i);
  if (pathExtensionMatch) {
    const ext = pathExtensionMatch[1].toLowerCase();
    if (DANGEROUS_DOWNLOAD_EXTENSIONS.has(ext)) {
      findings.push({
        id: `finding-heur-dangerous-download-${ext}-${now}`,
        category: "behavior",
        nature: "heuristic_indicator",
        finding: `Direct executable download target (.${ext})`,
        severity: "high",
        evidence: `The URL links directly to a '${ext.toUpperCase()}' file binary. QR codes distributing standalone executables, APK packages, or disk images pose immediate risk of malware delivery or dropper execution.`,
        confidence: 0.95,
        source: "url-heuristics",
        timestamp: now,
        metadata: { fileExtension: ext },
        remediation: "Do not allow device to download, parse, or install this binary file package.",
      });
    }
  }

  // 7. Embedded Secondary URLs in Query Parameters (Open Redirects)
  const secondaryUrlMatch = query.match(/(?:https?%3A%2F%2F|https?:\/\/)[^\s&]+/i);
  if (secondaryUrlMatch) {
    findings.push({
      id: `finding-heur-nested-url-${now}`,
      category: "behavior",
      nature: "heuristic_indicator",
      finding: "Secondary nested destination URL detected inside query parameters",
      severity: "medium",
      evidence: `URL search query carries a nested secondary web address (${secondaryUrlMatch[0].slice(0, 60)}...). This is commonly employed in open-redirect bouncers, tracking gates, and phishing lures.`,
      confidence: 0.88,
      source: "url-heuristics",
      timestamp: now,
      metadata: { nestedUrl: secondaryUrlMatch[0].slice(0, 100) },
    });
  }

  // 8. Tracking & Telemetry Parameters
  const foundTracking: string[] = [];
  if (urlResult.parsedUrl) {
    urlResult.parsedUrl.searchParams.forEach((_, key) => {
      if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith("utm_")) {
        foundTracking.push(key);
      }
    });
  }

  if (foundTracking.length >= 2) {
    findings.push({
      id: `finding-heur-tracking-params-${now}`,
      category: "behavior",
      nature: "observed_fact",
      finding: `Surveillance & Ad Tracking Parameters Present: [${foundTracking.join(", ")}]`,
      severity: "informational",
      evidence: `URL contains commercial user-tracking and campaign attribution parameters (${foundTracking.join(", ")}).`,
      confidence: 1.0,
      source: "url-heuristics",
      timestamp: now,
      metadata: { trackingParams: foundTracking },
    });
  }

  // 9. URL Length & Total Entropy Anomaly
  if (original.length >= 150) {
    const totalEntropy = calculateShannonEntropy(original);
    findings.push({
      id: `finding-heur-url-length-${now}`,
      category: "url",
      nature: "observed_fact",
      finding: `Elevated URL length (${original.length} characters) · Entropy: ${totalEntropy.toFixed(2)}`,
      severity: totalEntropy >= 4.6 ? "medium" : "low",
      evidence: `URL exceeds typical length (${original.length} chars). Long URLs with high entropy often package encrypted payloads, exploit buffers, or extensive tracking data.`,
      confidence: 0.85,
      source: "url-heuristics",
      timestamp: now,
      metadata: { length: original.length, entropy: totalEntropy },
    });
  }

  // 10. Hostname Structural Anomaly (Excessive hyphens or consonant clusters)
  const hyphenCount = (domain.match(/-/g) || []).length;
  if (hyphenCount >= 3) {
    findings.push({
      id: `finding-heur-hyphen-anomaly-${now}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `Excessive hyphens in domain name (${hyphenCount} hyphens)`,
      severity: "low",
      evidence: `Domain '${domain}' contains ${hyphenCount} hyphens. Multi-hyphen domain synthesis is frequently observed in automated phishing domain registrations.`,
      confidence: 0.75,
      source: "url-heuristics",
      timestamp: now,
      metadata: { hyphenCount },
    });
  }

  return findings;
}
