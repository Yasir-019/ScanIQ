import type { SafetyStatus } from "@/lib/scan/types";

export interface SafetyResult {
  level: SafetyStatus;
  reasons: string[];
}

const SUSPICIOUS_TLDS = [".tk", ".ml", ".ga", ".cf", ".gq", ".buzz", ".top", ".xyz", ".click", ".link", ".info", ".icu", ".cam", ".surf"];

const URL_SHORTENERS = [
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd",
  "buff.ly", "j.mp", "rb.gy", "cutt.ly", "shorturl.at", "tiny.cc",
];

const BRAND_DOMAINS: Record<string, string[]> = {
  paypal: ["paypal.com"],
  google: ["google.com", "google.co.uk", "google.co.in", "google.co.jp", "googleapis.com"],
  apple: ["apple.com", "icloud.com"],
  microsoft: ["microsoft.com", "live.com", "outlook.com", "office.com"],
  amazon: ["amazon.com", "amazon.co.uk", "amazon.co.jp", "amazon.de", "amazonaws.com"],
  facebook: ["facebook.com", "fb.com", "fb.me"],
  instagram: ["instagram.com"],
  netflix: ["netflix.com"],
  bank: ["chase.com", "bankofamerica.com", "wellsfargo.com", "hsbc.com", "citibank.com"],
};

function isIPHost(host: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}(:\d+)?$/.test(host) || host.startsWith("[");
}

const DANGEROUS_PROTOCOLS = [
  "javascript:",
  "vbscript:",
  "data:",
  "file:",
  "blob:",
  "mhtml:",
  "shell:",
  "jar:",
  "about:",
  "chrome:",
  "ms-windows-store:",
  "intent:",
];

export function analyzeUrlSafety(rawUrl: string): SafetyResult {
  const reasons: string[] = [];

  // Check dangerous protocols
  const lower = rawUrl.trim().toLowerCase();
  if (DANGEROUS_PROTOCOLS.some((p) => lower.startsWith(p))) {
    return { level: "malicious", reasons: ["Dangerous or executable protocol detected"] };
  }

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return { level: "safe", reasons: [] }; // not a URL
  }

  const host = url.hostname.toLowerCase();

  // IP address host
  if (isIPHost(host)) {
    reasons.push("Links to an IP address instead of a named domain");
  }

  // Punycode / homograph
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    reasons.push("Uses encoded international characters (possible impersonation)");
  }

  // Excessive subdomains (4+)
  const parts = host.split(".");
  if (parts.length >= 5) {
    reasons.push("Unusually deep subdomain structure");
  }

  // Suspicious TLD
  const tld = "." + parts[parts.length - 1];
  if (SUSPICIOUS_TLDS.includes(tld)) {
    reasons.push("Uses a domain extension commonly associated with spam");
  }

  // URL shortener
  if (URL_SHORTENERS.some((s) => host === s || host.endsWith("." + s))) {
    reasons.push("Shortened URL — destination is hidden");
  }

  // Brand impersonation
  for (const [brand, legitimateDomains] of Object.entries(BRAND_DOMAINS)) {
    if (host.includes(brand) && !legitimateDomains.some((d) => host === d || host.endsWith("." + d))) {
      reasons.push(`Brand impersonation: domain mentions "${brand}" but is not the official site`);
      break;
    }
  }

  // HTTP (not HTTPS)
  if (url.protocol === "http:") {
    reasons.push("Unencrypted connection (HTTP)");
  }

  // @ in URL (credential phishing)
  if (url.username || url.password || rawUrl.includes("@")) {
    reasons.push("Contains embedded credentials");
  }

  // Classify
  if (reasons.length === 0) {
    return { level: "safe", reasons: [] };
  }

  const hasCritical = reasons.some((r) =>
    r.includes("impersonation") || r.includes("Dangerous protocol") || r.includes("embedded credentials")
  );
  const level: SafetyStatus = hasCritical || reasons.length >= 3 ? "malicious" : "suspicious";

  return { level, reasons };
}
