export const CONFIG_PLACEHOLDER = "<CONFIGURE_MANUALLY>";

const EXACT_INVALID_PATTERNS = [
  CONFIG_PLACEHOLDER.toLowerCase(),
  "<configure_manually>",
  "your_api_key",
  "your_key_here",
  "your_token_here",
  "changeme",
  "placeholder",
  "todo",
  "xxx",
  "none",
  "null",
  "undefined",
  "123456",
];

const SUBSTRING_INVALID_PATTERNS = [
  "configure_manually",
  "your_api_key",
  "your_token_here",
  "your_key_here",
  "placeholder",
];

/**
 * Validates whether a credential string is a real, configured key
 * rather than a placeholder, empty string, or template value.
 */
export function isConfiguredCredential(key?: string | null): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  if (trimmed.length < 6) return false;

  const lower = trimmed.toLowerCase();

  // Check exact invalid matches
  if (EXACT_INVALID_PATTERNS.includes(lower)) {
    return false;
  }

  // Check placeholder substring matches
  for (const pattern of SUBSTRING_INVALID_PATTERNS) {
    if (lower.includes(pattern)) {
      return false;
    }
  }

  return true;
}

export interface ThreatProviderConfig {
  id: string;
  name: string;
  envKey: string;
  category: string;
  description: string;
  docsUrl: string;
  placeholder: string;
  isOptionalAuth: boolean;
}

export const THREAT_PROVIDER_CONFIGS: ThreatProviderConfig[] = [
  {
    id: "virus-total",
    name: "VirusTotal Multi-Engine Reputation",
    envKey: "VITE_VIRUSTOTAL_KEY",
    category: "reputation",
    description: "Multi-AV scanner aggregation, domain/IP reputation, and threat categorization.",
    docsUrl: "https://developers.virustotal.com/reference/overview",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
  {
    id: "urlscan",
    name: "URLScan.io Threat & Page Intelligence",
    envKey: "VITE_URLSCAN_KEY",
    category: "reputation",
    description: "Deep URL sandbox scanning, DOM analysis, screenshot, and redirect chain tracing.",
    docsUrl: "https://urlscan.io/docs/api/",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
  {
    id: "abuseipdb",
    name: "AbuseIPDB IP Reputation & Confidence",
    envKey: "VITE_ABUSEIPDB_KEY",
    category: "blocklist",
    description: "Crowdsourced abuse reporting, IP confidence score, and malicious category breakdown.",
    docsUrl: "https://docs.abuseipdb.com/",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
  {
    id: "google-safe-browsing",
    name: "Google Safe Browsing",
    envKey: "VITE_SAFEBROWSING_KEY",
    category: "reputation",
    description: "Google client lookup API for known malware, phishing, and unwanted software URLs.",
    docsUrl: "https://developers.google.com/safe-browsing/v4/lookup-api",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
  {
    id: "ipinfo",
    name: "IPinfo ASN & Geolocation",
    envKey: "VITE_IPINFO_TOKEN",
    category: "asn",
    description: "ASN, organization, reverse DNS, and approximate infrastructure geolocation.",
    docsUrl: "https://ipinfo.io/developers",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: true,
  },
  {
    id: "urlvoid",
    name: "URLVoid Reputation",
    envKey: "VITE_URLVOID_KEY",
    category: "reputation",
    description: "Aggregate blocklist check across 30+ engines and domain age.",
    docsUrl: "https://www.urlvoid.com/api/",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
  {
    id: "redirect-proxy",
    name: "Redirect Tracer Proxy",
    envKey: "VITE_REDIRECT_PROXY_URL",
    category: "redirect",
    description: "Backend proxy for safely tracing multi-hop HTTP/meta redirects.",
    docsUrl: "https://github.com/scaniq-app/scaniq-osint",
    placeholder: CONFIG_PLACEHOLDER,
    isOptionalAuth: false,
  },
];
