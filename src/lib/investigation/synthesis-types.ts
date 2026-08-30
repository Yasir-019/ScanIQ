export type EntityType =
  | "qr_code"
  | "barcode"
  | "payload"
  | "url"
  | "domain"
  | "subdomain"
  | "ip"
  | "asn"
  | "organization"
  | "registrar"
  | "nameserver"
  | "dns_record"
  | "certificate"
  | "location"
  | "threat_indicator";

export type TemporalFreshness =
  | "current" // < 1 hour
  | "recent" // < 24 hours
  | "aging" // < 30 days
  | "historical" // >= 30 days
  | "stale" // expired beyond cache TTL
  | "unknown";

export interface InvestigationEntity {
  id: string; // e.g. "domain:example.com", "ip:93.184.216.34"
  type: EntityType;
  value: string;
  label: string;
  sources: string[]; // all provider IDs that observed this entity
  firstObserved: number;
  lastObserved: number;
  confidence: number; // 0.0 to 1.0
  freshness: TemporalFreshness;
  metadata?: Record<string, unknown>;
  relatedEntityIds: string[];
}

export interface ProviderOpinion {
  providerId: string;
  providerName: string;
  classification: "clean" | "suspicious" | "malicious" | "unknown";
  score?: number;
  confidence?: number;
  threats?: string[];
  categories?: string[];
  observedAt: number;
}

export interface ConflictingIntelligence {
  target: string;
  targetType: "url" | "domain" | "ip";
  opinions: ProviderOpinion[];
  conflictSummary: string;
  detectedAt: number;
}

export type SynthesisGraphNodeType = EntityType;

export interface SynthesisGraphNode {
  id: string;
  type: SynthesisGraphNodeType;
  label: string;
  sublabel?: string;
  sources: string[];
  freshness: TemporalFreshness;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export type SynthesisGraphEdgeType =
  | "decodes_to"
  | "targets_url"
  | "hosts_domain"
  | "subdomain_of"
  | "resolves_to"
  | "redirects_to"
  | "registered_with"
  | "hosted_by"
  | "belongs_to_asn"
  | "routed_by"
  | "nameserver_for"
  | "uses_nameserver"
  | "has_certificate"
  | "located_in"
  | "associated_with"
  | "alias_of"
  | "mail_handler_for"
  | "observed_by"
  | "reported_by";

export interface SynthesisGraphEdge {
  id: string;
  source: string;
  target: string;
  type: SynthesisGraphEdgeType;
  label?: string;
  sources: string[];
  confidence: number;
}

export interface InvestigationGraphModel {
  nodes: SynthesisGraphNode[];
  edges: SynthesisGraphEdge[];
}

export interface UnifiedInvestigationModel {
  entities: Record<string, InvestigationEntity>;
  graph: InvestigationGraphModel;
  conflicts: ConflictingIntelligence[];
  missingSources: string[];
  synthesizedAt: number;
}
