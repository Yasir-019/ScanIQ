export type SourceArchitecture = "local" | "network" | "reputation";

export type SourceCategory =
  | "payload"
  | "heuristics"
  | "ioc"
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

export type SourcePrivacy = "local" | "offline" | "direct" | "proxied";

export type SourceStatusType =
  | "available"
  | "enabled"
  | "disabled"
  | "connected"
  | "not_configured"
  | "unavailable";

export interface OsintSource {
  id: string;
  name: string;
  architecture: SourceArchitecture;
  category: SourceCategory;
  privacy: SourcePrivacy;
  defaultEnabled: boolean;
  userToggleable: boolean;
  requiresAuth: boolean;
  requiredIntegrationId?: string;
  scope: ("domain" | "fqdn" | "ip" | "url" | "email" | "phone" | "product" | "text")[];
  homepage: string;
  destination?: string;
  description: string;
  privacyImplications?: string;
  terms?: string;
  privacyPolicy?: string;
  docsUrl?: string;
  rateLimitHints?: string;
  envKey?: string;
}

export const OSINT_SOURCES: OsintSource[] = [
  // =========================================================================
  // 1. LOCAL ANALYSIS SOURCES (Offline, Zero Network, No API Keys)
  // =========================================================================
  {
    id: "local-payload-analysis",
    name: "Local Payload Analysis & Entropy",
    architecture: "local",
    category: "payload",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["url", "domain", "fqdn", "ip", "text"],
    homepage: "https://github.com/Yasir-019/ScanIQ",
    destination: "Local Browser Memory (Web Crypto & WASM)",
    description:
      "Client-side barcode parsing, Shannon entropy scoring, non-printable character anomaly detection, and payload structure profiling.",
    privacyImplications: "100% offline. Zero network traffic leaves your browser.",
    docsUrl: "https://github.com/Yasir-019/ScanIQ#local-analysis",
  },
  {
    id: "local-url-safety",
    name: "Local URL Safety & Symbology Heuristics",
    architecture: "local",
    category: "heuristics",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["url", "domain", "fqdn"],
    homepage: "https://github.com/Yasir-019/ScanIQ",
    destination: "Local Browser Sandbox",
    description:
      "Deterministic heuristics checking for IP-hosted targets, HTTP schemes, embedded credentials, suspicious TLDs, lookalike homoglyphs, deep path structures, and brand impersonation tokens.",
    privacyImplications: "100% offline. No external HTTP requests are made.",
    docsUrl: "https://github.com/Yasir-019/ScanIQ#url-safety",
  },
  {
    id: "local-ioc-extraction",
    name: "Indicator of Compromise (IOC) Extraction",
    architecture: "local",
    category: "ioc",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["url", "domain", "fqdn", "ip", "email", "phone", "product"],
    homepage: "https://github.com/Yasir-019/ScanIQ",
    destination: "Local Browser Sandbox",
    description:
      "Extracts and categorizes domains, FQDNs, IPv4/IPv6 addresses, email handles, phone numbers, and GS1 GTIN product identifiers from untrusted text.",
    privacyImplications: "100% offline. Operates strictly in client memory.",
    docsUrl: "https://github.com/Yasir-019/ScanIQ#ioc-extraction",
  },
  {
    id: "local-punycode",
    name: "Punycode & IDN Lookalike Detection",
    architecture: "local",
    category: "brand-protection",
    privacy: "local",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["domain", "fqdn"],
    homepage: "https://github.com/Yasir-019/ScanIQ",
    destination: "Local Browser Sandbox",
    description:
      "Decodes Internationalized Domain Names (IDN / xn--) and flags Cyrillic, Greek, and Unicode confusables mimicking recognized brand domains.",
    privacyImplications: "100% offline. Safe algorithmic Unicode normalization.",
    docsUrl: "https://github.com/Yasir-019/ScanIQ#punycode-analysis",
  },
  {
    id: "openintel-geoip",
    name: "DB-IP Country Geolocation (Offline DB)",
    architecture: "local",
    category: "geolocation",
    privacy: "offline",
    defaultEnabled: true,
    userToggleable: false,
    requiresAuth: false,
    scope: ["ip"],
    homepage: "https://db-ip.com/db/download/ip-to-country-lite",
    destination: "Bundled Offline DB (Local IndexedDB / Memory)",
    description:
      "Offline country-level IP geolocation database. Resolves IP target coordinates and ISO country codes without querying any remote server.",
    privacyImplications: "100% offline. No outbound IP lookups performed.",
    docsUrl: "https://db-ip.com/db/lite.php",
  },

  // =========================================================================
  // 2. NETWORK SOURCES (Direct Network, No API Keys Required)
  // =========================================================================
  {
    id: "dns-over-https",
    name: "DNS-over-HTTPS (DoH)",
    architecture: "network",
    category: "dns",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["fqdn", "domain"],
    homepage: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/",
    destination: "Cloudflare 1.1.1.1 / Quad9 DNS Resolver",
    description:
      "Resolves A, AAAA, CNAME, MX, TXT, and NS DNS records for domain targets via encrypted DNS-over-HTTPS.",
    privacyImplications:
      "Direct network query. The destination resolver (Cloudflare) receives the domain query and your client IP address.",
    privacyPolicy: "https://www.cloudflare.com/privacypolicy/",
    terms: "https://www.cloudflare.com/website-terms/",
    docsUrl: "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/",
    rateLimitHints: "Public DoH: Standard rate limit < 1,000 req/min.",
  },
  {
    id: "rdap-domain",
    name: "RDAP Domain Registration",
    architecture: "network",
    category: "rdap",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["domain"],
    homepage: "https://rdap.org",
    destination: "rdap.org (ICANN / Regional TLD Registries)",
    description:
      "Queries Registration Data Access Protocol (RDAP) to retrieve registrar name, registration dates, expiration timestamp, and domain lifecycle status.",
    privacyImplications:
      "Direct network query. The target TLD registry logs the requested domain query.",
    docsUrl: "https://www.icann.org/rdap",
  },
  {
    id: "rdap-ip",
    name: "RDAP IP Network & ASN Allocation",
    architecture: "network",
    category: "rdap",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["ip"],
    homepage: "https://rdap.org",
    destination: "Regional Internet Registries (ARIN, RIPE, APNIC, LACNIC, AFRINIC)",
    description:
      "Queries Regional Internet Registries for IP block allocations, autonomous system handles, CIDR ranges, and abuse contact emails.",
    privacyImplications:
      "Direct network query. Regional registry receives IP query.",
    docsUrl: "https://www.icann.org/rdap",
  },
  {
    id: "crtsh-cert",
    name: "crt.sh Certificate Transparency Logs",
    architecture: "network",
    category: "certificate",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["domain", "fqdn"],
    homepage: "https://crt.sh",
    destination: "crt.sh (Sectigo Certificate Transparency Archive)",
    description:
      "Searches global Certificate Transparency logs to discover registered subdomains, Subject Alternative Names (SANs), issuers, and SSL/TLS validity windows.",
    privacyImplications:
      "Direct network query. crt.sh receives the domain query.",
    docsUrl: "https://github.com/crtsh/certwatch_db",
  },
  {
    id: "ssllabs-tls",
    name: "Qualys SSL Labs TLS Inspection",
    architecture: "network",
    category: "certificate",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["fqdn"],
    homepage: "https://www.ssllabs.com/projects/ssllabs-apis/",
    destination: "Qualys SSL Labs Servers",
    description:
      "Inspects SSL/TLS cipher suite configurations, certificate trust chains, protocol versions, and vulnerability exposure.",
    privacyImplications:
      "Qualys servers initiate an active TLS handshake against the target FQDN.",
    terms: "https://www.ssllabs.com/downloads/Qualys_SSL_Labs_Terms_of_Use.pdf",
  },
  {
    id: "gs1-product",
    name: "GS1 Global Product Prefix Directory",
    architecture: "network",
    category: "product",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["product"],
    homepage: "https://www.gepir.org",
    destination: "GS1 GEPIR Registry",
    description:
      "Resolves EAN-13, UPC-A, and GTIN product barcodes to verified manufacturing member organizations via official GS1 registries.",
    privacyImplications:
      "Direct query. Product barcode number is queried against GS1 directory.",
  },

  // =========================================================================
  // 3. REPUTATION & THREAT INTEL SOURCES (BYOK / User Key Required)
  // =========================================================================
  {
    id: "virus-total",
    name: "VirusTotal Threat Intelligence",
    architecture: "reputation",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    requiredIntegrationId: "virustotal",
    scope: ["domain", "ip", "url"],
    homepage: "https://developers.virustotal.com/",
    destination: "virustotal.com (Google Chronicle)",
    description:
      "Multi-scanner threat intelligence aggregating 70+ antivirus engines, WHOIS records, threat relations, and historical reputation.",
    privacyImplications:
      "Target URLs, domains, or hashes are submitted to VirusTotal and may be accessible to the VirusTotal security community.",
    privacyPolicy: "https://support.virustotal.com/hc/en-us/articles/115002131105-Privacy-Policy",
    docsUrl: "https://developers.virustotal.com/reference/overview",
    rateLimitHints: "Free Public API: 500 requests/day, 4 req/min limit.",
    envKey: "VITE_VIRUSTOTAL_KEY",
  },
  {
    id: "abuseipdb",
    name: "AbuseIPDB Threat Intelligence",
    architecture: "reputation",
    category: "blocklist",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    requiredIntegrationId: "abuseipdb",
    scope: ["ip"],
    homepage: "https://www.abuseipdb.com/api",
    destination: "abuseipdb.com API v2",
    description:
      "Crowdsourced IP reputation database checking reported abuse confidence scores, port scan activity, and malicious hosting classifications.",
    privacyImplications:
      "Queried IP address is checked against AbuseIPDB database.",
    docsUrl: "https://docs.abuseipdb.com/",
    rateLimitHints: "Free Webmaster API: 1,000 checks/day limit.",
    envKey: "VITE_ABUSEIPDB_KEY",
  },
  {
    id: "urlvoid",
    name: "URLVoid Multi-Engine Reputation",
    architecture: "reputation",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    requiredIntegrationId: "urlvoid",
    scope: ["domain"],
    homepage: "https://www.urlvoid.com/api/",
    destination: "urlvoid.com API",
    description:
      "Cross-references domains against 30+ domain blocklists, web safety engines, domain creation age, and hosting reputation.",
    privacyImplications:
      "Queried domain is submitted to URLVoid reputation database.",
    docsUrl: "https://www.urlvoid.com/api/",
    rateLimitHints: "API key required for automated query endpoints.",
    envKey: "VITE_URLVOID_KEY",
  },
  {
    id: "google-safe-browsing",
    name: "Google Safe Browsing",
    architecture: "reputation",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    requiredIntegrationId: "safebrowsing",
    scope: ["url"],
    homepage: "https://developers.google.com/safe-browsing",
    destination: "safebrowsing.googleapis.com (Google Security)",
    description:
      "Checks URLs against Google's continuously updated lists of suspected phishing, malware, and social engineering destinations.",
    privacyImplications:
      "Target URLs (or URL prefix hashes) are verified with Google Safe Browsing servers.",
    docsUrl: "https://developers.google.com/safe-browsing/v4/lookup-api",
    rateLimitHints: "Free standard quota: 10,000 requests/day.",
    envKey: "VITE_SAFEBROWSING_KEY",
  },
  {
    id: "urlscan",
    name: "URLScan.io Sandbox Intelligence",
    architecture: "reputation",
    category: "reputation",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: true,
    requiredIntegrationId: "urlscan",
    scope: ["url", "domain"],
    homepage: "https://urlscan.io",
    destination: "urlscan.io API v1",
    description:
      "Automated URL sandbox execution, DOM analysis, IP relationship mapping, and screenshot intelligence.",
    privacyImplications:
      "Target URL is submitted to URLScan sandbox engine.",
    docsUrl: "https://urlscan.io/docs/api/",
    rateLimitHints: "Free Community API: 5,000 public scans/month.",
    envKey: "VITE_URLSCAN_KEY",
  },
  {
    id: "ipinfo",
    name: "IPinfo ASN & Network Intelligence",
    architecture: "reputation",
    category: "asn",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    requiredIntegrationId: "ipinfo",
    scope: ["ip"],
    homepage: "https://ipinfo.io",
    destination: "ipinfo.io API",
    description:
      "High-accuracy ASN, organization type, hosting vs residential classification, geocoordinates, and carrier details.",
    privacyImplications:
      "IP address is queried via ipinfo.io REST API.",
    privacyPolicy: "https://ipinfo.io/privacy-policy",
    docsUrl: "https://ipinfo.io/developers",
    rateLimitHints: "Free tier: 50,000 requests/month anonymous or with token.",
    envKey: "VITE_IPINFO_TOKEN",
  },
  {
    id: "phishtank",
    name: "PhishTank Community Blocklist",
    architecture: "network",
    category: "blocklist",
    privacy: "direct",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["url"],
    homepage: "https://www.phishtank.com",
    destination: "phishtank.org Database Feed",
    description:
      "Checks URLs against community-verified phishing dumps and blocklists.",
    privacyImplications:
      "URL target is verified against PhishTank feed.",
  },
  {
    id: "redirect-head",
    name: "Redirect Chain Tracing (Proxied)",
    architecture: "network",
    category: "redirect",
    privacy: "proxied",
    defaultEnabled: false,
    userToggleable: true,
    requiresAuth: false,
    scope: ["url"],
    homepage: "https://github.com/Yasir-019/ScanIQ",
    destination: "Configured User Proxy Server",
    description:
      "Traces HTTP 3xx Location headers and JavaScript redirection chains via user-configured proxy. Disabled by default.",
    privacyImplications:
      "Target URL is fetched via your designated proxy gateway.",
    envKey: "VITE_REDIRECT_PROXY_URL",
  },
];

export function listSourcesByArchitecture(arch: SourceArchitecture): OsintSource[] {
  return OSINT_SOURCES.filter((s) => s.architecture === arch);
}

export function listSourcesByCategory(cat: SourceCategory): OsintSource[] {
  return OSINT_SOURCES.filter((s) => s.category === cat);
}

export function getSourceById(id: string): OsintSource | undefined {
  return OSINT_SOURCES.find((s) => s.id === id);
}

export function defaultSourceToggles(): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of OSINT_SOURCES) {
    out[s.id] = s.defaultEnabled;
  }
  return out;
}
