export type SourceCategory =
  | "dns"
  | "whois"
  | "rdap"
  | "asn"
  | "geolocation"
  | "certificate"
  | "reputation"
  | "blocklist"
  | "redirect"
  | "brand-protection"
  | "product"
  | "payment";

export type SourcePrivacy = "direct" | "proxied" | "local" | "offline";

export interface OsintSource {
  id: string;
  name: string;
  category: SourceCategory;
  privacy: SourcePrivacy;
  defaultEnabled: boolean;
  userToggleable: boolean;
  requiresAuth: boolean;
  scope: ("domain" | "fqdn" | "ip" | "url" | "email" | "phone" | "product")[];
  homepage: string;
  description: string;
  terms?: string;
  privacyPolicy?: string;
  docsUrl?: string;
  rateLimitHints?: string;
  envKey?: string;
}

export const OSINT_SOURCES: OsintSource[] = [
  {
    id: "local-payload-analysis",
    name: "Local Payload Analysis",
    category: "dns",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["url", "domain", "fqdn", "ip"],
    homepage: "https://github.com/scaniq-app/scaniq-osint",
    description:
      "Client-side parsing, URL deconstruction, Punycode decoding, entropy/anomaly detection, protocol safety, short-link heuristics, and regex-based indicators.",
    docsUrl: "https://github.com/scaniq-app/scaniq-osint#local-payload-analysis",
  },
  {
    id: "local-url-safety",
    name: "Local URL Safety Heuristics",
    category: "reputation",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["url", "domain", "fqdn"],
    homepage: "https://github.com/scaniq-app/scaniq-osint",
    description:
      "Deterministic heuristics (IP-hosted, HTTP, embedded creds, suspicious TLD, lookalike chars, depth, well-known shorteners, brand impersonation tokens) with no network call.",
    docsUrl: "https://github.com/scaniq-app/scaniq-osint#local-url-safety",
  },
  {
    id: "dns-over-https",
    name: "DNS-over-HTTPS (DoH)",
    category: "dns",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["fqdn", "domain"],
    homepage: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/",
    description:
      "Resolve A / AAAA / CNAME / NS / MX / TXT records via a DoH provider (Cloudflare 1.1.1.1 by default). Resolver receives queries; avoid with sensitive targets unless proxied.",
    privacyPolicy: "https://www.cloudflare.com/privacypolicy/",
    terms: "https://www.cloudflare.com/website-terms/",
    docsUrl: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/",
    rateLimitHints: "Cloudflare public DoH: no published hard cap; keep requests < 1000/min.",
  },
  {
    id: "rdap-domain",
    name: "RDAP Domain Registration",
    category: "rdap",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["domain"],
    homepage: "https://rdap.org",
    description:
      "Registration Data Access Protocol — lookup registrar, nameservers, created/updated/expired dates, status codes. Public lookup; registrar logs query origin.",
    docsUrl: "https://www.icann.org/rdap",
  },
  {
    id: "rdap-ip",
    name: "RDAP IP Network",
    category: "rdap",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["ip"],
    homepage: "https://rdap.org",
    description:
      "RDAP for IPv4/IPv6 networks — ORG/handle, registration date, CIDR, country, abuse contact.",
  },
  {
    id: "ipinfo",
    name: "IPinfo ASN & Geolocation",
    category: "asn",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["ip"],
    homepage: "https://ipinfo.io",
    description:
      "ASN, organization, AS type (hosting/ISP/Edu/Gov), country/region/city, geocoordinates, timezone, carrier.",
    privacyPolicy: "https://ipinfo.io/privacy-policy",
    docsUrl: "https://ipinfo.io/developers",
    rateLimitHints: "Free tier: 50k/month anonymous. Env key VITE_IPINFO_TOKEN for higher.",
    envKey: "VITE_IPINFO_TOKEN",
  },
  {
    id: "crtsh-cert",
    name: "crt.sh Certificate Transparency",
    category: "certificate",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["domain", "fqdn"],
    homepage: "https://crt.sh",
    description:
      "Certificate Transparency log search — discovered subdomains, SANs, issuers, validity windows via Comodo crt.sh JSON feed.",
    docsUrl: "https://github.com/crtsh/certwatch_db",
  },
  {
    id: "ssllabs-tls",
    name: "Qualys SSL Labs (pending)",
    category: "certificate",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["fqdn"],
    homepage: "https://www.ssllabs.com/projects/ssllabs-apis/",
    description:
      "TLS configuration quality — cipher suites, protocol version, HSTS, certificate chain, trust issues. SLOW; runs full TLS scan from Qualys servers.",
    terms: "https://www.ssllabs.com/downloads/Qualys_SSL_Labs_Terms_of_Use.pdf",
  },
  {
    id: "urlvoid",
    name: "URLVoid Reputation",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    scope: ["domain"],
    homepage: "https://www.urlvoid.com/api/",
    description:
      "Aggregate blocklist check across 30+ engines + domain age + hosting reputation. Requires VITE_URLVOID_KEY.",
    docsUrl: "https://www.urlvoid.com/api/",
    envKey: "VITE_URLVOID_KEY",
  },
  {
    id: "virus-total",
    name: "VirusTotal (pending)",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    scope: ["domain", "ip", "url"],
    homepage: "https://developers.virustotal.com/",
    description:
      "Multi-AV scanner + WHOIS + relations + community comments. Requires VITE_VIRUSTOTAL_KEY. Note: submitted URLs/hashes are visible to the VirusTotal community per their policy.",
    privacyPolicy: "https://support.virustotal.com/hc/en-us/articles/115002131105-Privacy-Policy",
    envKey: "VITE_VIRUSTOTAL_KEY",
  },
  {
    id: "google-safe-browsing",
    name: "Google Safe Browsing (pending)",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    scope: ["url"],
    homepage: "https://developers.google.com/safe-browsing",
    description:
      "Look up URLs against Google's malware, phishing, unwanted-software lists. Requires VITE_SAFEBROWSING_KEY.",
    docsUrl: "https://developers.google.com/safe-browsing/v4/lookup-api",
    envKey: "VITE_SAFEBROWSING_KEY",
  },
  {
    id: "phishtank",
    name: "Phishtank (pending)",
    category: "blocklist",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["url"],
    homepage: "https://www.phishtank.com",
    description: "Community-curated phishing URL dumps — check if a scan URL appears in the latest valid-verified list.",
  },
  {
    id: "abuseipdb",
    name: "AbuseIPDB",
    category: "blocklist",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    scope: ["ip"],
    homepage: "https://www.abuseipdb.com/api",
    description: "Reported abusive IP confidence score + abuse categories. Requires VITE_ABUSEIPDB_KEY.",
    envKey: "VITE_ABUSEIPDB_KEY",
  },
  {
    id: "openintel-geoip",
    name: "DB-IP / OpenIntel Geolocation (offline)",
    category: "geolocation",
    privacy: "offline",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["ip"],
    homepage: "https://db-ip.com/db/download/ip-to-country-lite",
    description:
      "Bundled offline country-level IP database — no outbound network call for geolocation. Attribution required per CC-BY license.",
    docsUrl: "https://db-ip.com/db/lite.php",
  },
  {
    id: "redirect-head",
    name: "Redirect Chain Tracing (proxied)",
    category: "redirect",
    privacy: "proxied",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    scope: ["url"],
    homepage: "https://github.com/scaniq-app/scaniq-osint",
    description:
      "Head-style follow of 3xx Location, meta refresh, and JS window.location chains. CLIENT-SIDE DISABLED by default to avoid navigation to untrusted targets. Requires a backend proxy (VITE_REDIRECT_PROXY_URL).",
    envKey: "VITE_REDIRECT_PROXY_URL",
  },
  {
    id: "gs1-product",
    name: "GS1 Company Prefix Lookup",
    category: "product",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["product"],
    homepage: "https://www.gepir.org",
    description:
      "Resolve EAN/UPC/GTIN barcode to owning GS1 member org via GEPIR (where legally available).",
  },
];

export function listSourcesByCategory(cat: SourceCategory): OsintSource[] {
  return OSINT_SOURCES.filter((s) => s.category === cat);
}

export function getSourceById(id: string): OsintSource | undefined {
  return OSINT_SOURCES.find((s) => s.id === id);
}

export function defaultSourceToggles(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of OSINT_SOURCES) out[s.id] = s.defaultEnabled;
  return out;
}
