import type {
  RiskEvidence,
  ReputationResult,
} from "@/lib/scan/types";
import type { InvestigationFinding } from "../types";

export type TargetType =
  | "url"
  | "domain"
  | "fqdn"
  | "ip"
  | "email"
  | "phone"
  | "product"
  | "crypto"
  | "raw_payload";

export type ProviderCategory =
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
  | "payment"
  | "infrastructure"
  | "heuristic";

export type ProviderCapability =
  | "url_reputation"
  | "domain_reputation"
  | "ip_reputation"
  | "live_url_scan"
  | "url_search"
  | "screenshot"
  | "abuse_confidence"
  | "threat_categorization"
  | "certificate_search"
  | "subdomain_discovery"
  | "passive_dns"
  | "dns_resolution"
  | "registration_lookup"
  | "network_allocation"
  | "geo_intelligence"
  | "heuristic_analysis"
  | "redirect_tracing";

export type ProviderPrivacy = "direct" | "proxied" | "local" | "offline";

export type ProviderStatus =
  | "ready"
  | "not_configured"
  | "disabled"
  | "consent_required"
  | "missing_key"
  | "querying"
  | "rate_limited"
  | "authentication_error"
  | "network_error"
  | "provider_error"
  | "error"
  | "unreachable"
  | "unsupported_target";

export type ProviderExecutionStatus =
  | "success"
  | "not_configured"
  | "no_data"
  | "skipped"
  | "unauthorized"
  | "authentication_error"
  | "rate_limited"
  | "network_error"
  | "error"
  | "timeout"
  | "unsupported";

export interface RateLimitInfo {
  limit?: number;
  remaining?: number;
  resetAt?: number;
  isExceeded?: boolean;
  retryAfterSeconds?: number;
  lastChecked?: number;
}

export interface ProviderTarget {
  type: TargetType;
  value: string;
  raw?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderContext {
  signal?: AbortSignal;
  timeoutMs?: number;
  apiKey?: string;
  userConsent: boolean;
  isSourceEnabled: boolean;
  requestedCapabilities?: ProviderCapability[];
  options?: Record<string, unknown>;
}

export interface ProviderResult {
  providerId: string;
  providerName: string;
  category: ProviderCategory;
  privacy: ProviderPrivacy;
  target: ProviderTarget;
  queriedAt: number;
  executionTimeMs: number;
  status: ProviderExecutionStatus;
  findings: InvestigationFinding[];
  evidence: RiskEvidence[];
  reputation?: ReputationResult;
  rateLimit?: RateLimitInfo;
  error?: string;
  warnings: string[];
  metadata?: Record<string, unknown>;
}

export interface ProviderMetadata {
  id: string;
  name: string;
  type: "local" | "external";
  category: ProviderCategory;
  privacy: ProviderPrivacy;
  supportedTargets: TargetType[];
  capabilities: ProviderCapability[];
  requiresAuth: boolean;
  envKey?: string;
  authConfigKey?: string;
  description: string;
  docsUrl?: string;
  rateLimitHints?: string;
  defaultTimeoutMs?: number;
}
