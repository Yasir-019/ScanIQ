import type { UrlPayloadSummary } from "@/lib/scan/types";
import type { ConflictingIntelligence } from "./synthesis-types";
import type { InvestigationAction } from "./evidence-integrity";

export type FindingCategory =
  | "payload"
  | "url"
  | "domain"
  | "infrastructure"
  | "reputation"
  | "identity"
  | "behavior";

export type FindingNature =
  | "observed_fact"
  | "heuristic_indicator"
  | "external_intelligence"
  | "inferred_conclusion";

export type FindingSeverity =
  | "informational"
  | "low"
  | "medium"
  | "high"
  | "critical"
  | "unknown";

export interface InvestigationFinding {
  id: string;
  fingerprint?: string;
  investigationId?: string;
  runId?: string;
  category: FindingCategory;
  nature: FindingNature;
  finding: string;
  severity: FindingSeverity;
  evidence: string;
  confidence: number; // 0.0 to 1.0
  source: string;
  provider?: string;
  timestamp: number;
  observedAt?: number;
  retrievedAt?: number;
  metadata?: Record<string, unknown>;
  remediation?: string;
  technicalDetails?: string;
}

export interface RiskAssessment {
  level: FindingSeverity;
  score: number; // 0 to 100
  confidence: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0 (evidence completeness)
  confidenceLevel: "low" | "medium" | "high";
  verdict: string;
  rationale: string;
  primaryDrivers: InvestigationFinding[];
  supportingEvidence: InvestigationFinding[];
  mitigatingFactors: string[];
  conflictingIntelligence: ConflictingIntelligence[];
  missingIntelligence: string[];
  findingCounts: Record<FindingSeverity, number>;
  evaluatedAt: number;
  provenanceLog?: InvestigationAction[];
}

export interface TargetCollection {
  urls: UrlPayloadSummary[];
  domains: string[];
  hosts: string[];
  ips: string[];
  emails: string[];
  phoneNumbers: string[];
  cryptoAddresses: { currency: string; address: string }[];
  productCodes: string[];
  wifiConfigs?: { ssid: string; authType?: string; hidden?: boolean }[];
  paymentIdentifiers?: string[];
}

export interface LocalPayloadAnalysisResult {
  size: number;
  entropy: number;
  hasCredentialsEmbedded: boolean;
  hasIps: boolean;
  hasObfuscation: boolean;
  usesDangerousProtocol: boolean;
  detectedEncodings: string[];
  anomalies: string[];
  characterDistribution: {
    asciiPrintable: number;
    nonAscii: number;
    whitespace: number;
    controlChars: number;
  };
}

export interface NormalizedUrlResult {
  original: string;
  normalized: string;
  summary: UrlPayloadSummary;
  parsedUrl?: URL;
  isValid: boolean;
  parseError?: string;
  ipHostInfo?: {
    isIp: boolean;
    version?: 4 | 6;
    isPrivate?: boolean;
    isLoopback?: boolean;
    isLinkLocal?: boolean;
    isSpecial?: boolean;
    canonicalIp?: string;
  };
  suspiciousQueryParams: { key: string; value: string; reason: string }[];
}

export * from "./providers/types";
export * from "./synthesis-types";
export * from "./evidence-integrity";
export * from "./sanitization";
