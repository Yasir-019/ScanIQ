export type ScanFormat =
  | "QR_CODE"
  | "EAN_13"
  | "EAN_8"
  | "UPC_A"
  | "UPC_E"
  | "CODE_128"
  | "CODE_39"
  | "CODE_93"
  | "ITF"
  | "DATA_MATRIX"
  | "PDF_417"
  | "AZTEC"
  | "UNKNOWN";

export type ScanContentType =
  | "url"
  | "wifi"
  | "vcard"
  | "email"
  | "sms"
  | "phone"
  | "geo"
  | "product"
  | "text"
  | "payment";

export type SafetyStatus = "unchecked" | "safe" | "suspicious" | "malicious";

export type RiskLevel =
  | "unknown"
  | "benign"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type InvestigationStatus =
  | "pending"
  | "running"
  | "partial"
  | "complete"
  | "error";

export interface RiskEvidence {
  id: string;
  source: string;
  title: string;
  description: string;
  severity: RiskLevel;
  confidence: number;
  fields?: Record<string, string | number | boolean | string[]>;
  discoveredAt: number;
}

export interface RiskScoreSummary {
  overall: RiskLevel;
  numeric: number;
  confidence: number;
  confidenceScore?: number;
  confidenceLevel?: "low" | "medium" | "high";
  verdict: string;
  explanation: string;
  evidence: RiskEvidence[];
  primaryDrivers?: string[];
  supportingEvidence?: string[];
  mitigatingFactors?: string[];
  conflictingIntelligence?: { target: string; conflictSummary: string; opinions?: unknown[] }[];
  missingIntelligence?: string[];
}

export interface PayloadAnalysis {
  hasCredentialsEmbedded: boolean;
  hasIps: boolean;
  hasObfuscation: boolean;
  usesDangerousProtocol: boolean;
  size: number;
  entropy: number;
  anomalies: string[];
}

export interface UrlPayloadSummary {
  scheme: string;
  domain: string;
  fqdn: string;
  subdomains: string[];
  tld: string;
  port?: number;
  path: string;
  query: string;
  fragment: string;
  isIdn: boolean;
  isIp: boolean;
  isShortlinkLike: boolean;
}

export interface DnsRecord {
  type: "A" | "AAAA" | "CNAME" | "NS" | "MX" | "TXT" | "SOA" | "CAA";
  value: string;
  ttl?: number;
}

export interface DomainIntelligence {
  createdAt?: number;
  updatedAt?: number;
  expiresAt?: number;
  registrar?: string;
  registrantOrganization?: string;
  registrantCountry?: string;
  nameservers: string[];
  dns: DnsRecord[];
  statuses: string[];
  whoisRedacted: boolean;
  ageDays?: number;
  rdapSource?: string;
}

export interface HostIntelligence {
  ip?: string;
  reverseDns?: string;
  asn?: {
    number?: number;
    organization?: string;
    country?: string;
    type?: "hosting" | "isp" | "education" | "government" | "unknown";
  };
  geolocation?: {
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
  };
  hosting?: {
    provider?: string;
    service?: string;
    datacenter?: string;
  };
  certificate?: {
    subject?: string;
    issuer?: string;
    fingerprintSha256?: string;
    notBefore?: number;
    notAfter?: number;
    validForDomains?: string[];
    errors?: string[];
  };
  blacklistHits?: {
    listName: string;
    source: string;
    listed: boolean;
    category?: string;
    lastChecked?: number;
  }[];
}

export interface RedirectHop {
  index: number;
  url: string;
  status: number;
  destination: string;
  redirectMethod: "location" | "meta" | "js" | "unknown";
  latencyMs?: number;
  intermediateDomains: string[];
}

export interface RedirectChain {
  hopCount: number;
  finalUrl: string;
  finalHost: string;
  finalStatus: number;
  crossesHosts: boolean;
  crossesTlds: boolean;
  hasChainLoops: boolean;
  hops: RedirectHop[];
  warnings: string[];
}

export interface ReputationResult {
  source: string;
  scope: "domain" | "host" | "url" | "ip";
  classification: "clean" | "suspicious" | "malicious" | "unknown";
  score?: number;
  confidence?: number;
  categories: string[];
  threats: string[];
  lastChecked?: number;
  detailsUrl?: string;
}

export interface OsintFinding {
  id: string;
  kind:
    | "brand-impersonation"
    | "typosquat"
    | "new-domain"
    | "suspicious-hosting"
    | "certificate-anomaly"
    | "url-shortener"
    | "credential-harvester-likely"
    | "blocklist-hit"
    | "redirect-anomaly"
    | "payload-anomaly"
    | "dangerous-protocol"
    | "embedded-credentials"
    | "ip-hosted"
    | "lookalike-domain"
    | "general";
  title: string;
  summary: string;
  severity: RiskLevel;
  confidence: number;
  references: string[];
  nature?: "observed_fact" | "heuristic_indicator" | "external_intelligence" | "inferred_conclusion";
  metadata?: Record<string, unknown>;
}

export interface InvestigationReport {
  id: string;
  caseId: string;
  createdAt: number;
  updatedAt: number;
  status: InvestigationStatus;
  sourceScanId: string;
  rawContent: string;
  contentType: ScanContentType;
  format: ScanFormat;
  targets: {
    urls: UrlPayloadSummary[];
    domains: string[];
    hosts: string[];
    phoneNumbers: string[];
    emails: string[];
    iban?: string[];
    productCodes: string[];
  };
  payloadAnalysis: PayloadAnalysis;
  urlSafetySnapshot: RiskScoreSummary;
  domainIntel: DomainIntelligence;
  hostIntel: HostIntelligence[];
  redirectChain?: RedirectChain;
  reputation: ReputationResult[];
  findings: OsintFinding[];
  finalRisk: RiskScoreSummary;
  intelligenceFlags: {
    whoisEnabled: boolean;
    rdapEnabled: boolean;
    dnsEnabled: boolean;
    asnEnabled: boolean;
    geoEnabled: boolean;
    certEnabled: boolean;
    redirectEnabled: boolean;
    reputationEnabled: boolean;
    userControlled: boolean;
  };
  synthesis?: unknown;
  notes?: string;
}

export interface ScanRecord {
  id: string;
  content: string;
  format: ScanFormat;
  type: ScanContentType;
  parsed?: Record<string, unknown>;
  safetyStatus?: SafetyStatus;
  favorite?: boolean;
  scannedAt: number;
  investigationId?: string;
  caseId?: string;
}

export interface InvestigationCase {
  id: string;
  label?: string;
  tags?: string[];
  notes?: string;
  createdAt: number;
  updatedAt: number;
  starred?: boolean;
  latestRiskLevel?: RiskLevel;
  latestInvestigationId?: string;
}
