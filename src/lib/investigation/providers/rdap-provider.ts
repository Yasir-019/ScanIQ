import {
  BaseIntelligenceProvider,
} from "./base";
import type {
  ProviderCategory,
  ProviderCapability,
  ProviderContext,
  ProviderPrivacy,
  ProviderTarget,
  RateLimitInfo,
  TargetType,
} from "./types";
import type {
  DomainIntelligence,
  HostIntelligence,
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
} from "../types";
import { IntelligenceCache } from "../cache";

export interface RdapEvent {
  eventAction: string;
  eventDate: string;
  eventActor?: string;
}

export interface RdapEntity {
  handle?: string;
  roles?: string[];
  vcardArray?: unknown[];
  entities?: RdapEntity[];
}

export interface RdapDomainResponse {
  objectClassName?: string;
  handle?: string;
  ldhName?: string;
  unicodeName?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  nameservers?: { ldhName?: string; unicodeName?: string }[];
  port43?: string;
  links?: { value?: string; rel?: string; href?: string; type?: string }[];
  notices?: { title?: string; description?: string[] }[];
}

export interface RdapIpResponse {
  objectClassName?: string;
  handle?: string;
  startAddress?: string;
  endAddress?: string;
  ipVersion?: string;
  name?: string;
  type?: string;
  country?: string;
  parentHandle?: string;
  status?: string[];
  events?: RdapEvent[];
  entities?: RdapEntity[];
  links?: { value?: string; rel?: string; href?: string; type?: string }[];
  notices?: { title?: string; description?: string[] }[];
}

/**
 * Extracts formatted vCard properties from RDAP vcardArray.
 */
function parseVCardArray(vcardArray?: unknown[]): {
  fn?: string;
  org?: string;
  email?: string;
  country?: string;
} {
  const result: { fn?: string; org?: string; email?: string; country?: string } = {};
  if (!Array.isArray(vcardArray) || vcardArray.length < 2 || !Array.isArray(vcardArray[1])) {
    return result;
  }

  const props = vcardArray[1] as [string, Record<string, unknown>, string, unknown][];
  for (const item of props) {
    if (!Array.isArray(item) || item.length < 4) continue;
    const [name, , , value] = item;
    if (name === "fn" && typeof value === "string") {
      result.fn = value;
    } else if (name === "org" && typeof value === "string") {
      result.org = value;
    } else if (name === "email" && typeof value === "string") {
      result.email = value;
    } else if (name === "adr" && Array.isArray(value) && value.length >= 7) {
      // Address structure [pobox, ext, street, locality, region, code, country]
      const country = value[6];
      if (typeof country === "string" && country) {
        result.country = country;
      }
    }
  }

  return result;
}

/**
 * Extracts registrar and registrant info from RDAP entities.
 */
function extractEntities(entities?: RdapEntity[]): {
  registrar?: string;
  registrantOrg?: string;
  registrantCountry?: string;
  abuseEmail?: string;
  isPrivacyProtected: boolean;
} {
  let registrar: string | undefined;
  let registrantOrg: string | undefined;
  let registrantCountry: string | undefined;
  let abuseEmail: string | undefined;
  let isPrivacyProtected = false;

  if (!Array.isArray(entities)) {
    return { isPrivacyProtected: true };
  }

  for (const entity of entities) {
    const roles = entity.roles || [];
    const vcard = parseVCardArray(entity.vcardArray);

    if (roles.includes("registrar")) {
      registrar = vcard.fn || vcard.org || entity.handle;
    }

    if (roles.includes("registrant")) {
      registrantOrg = vcard.org || vcard.fn;
      registrantCountry = vcard.country;
    }

    if (roles.includes("abuse")) {
      abuseEmail = vcard.email;
    }

    const entityStr = JSON.stringify(entity).toLowerCase();
    if (
      entityStr.includes("privacy") ||
      entityStr.includes("redacted") ||
      entityStr.includes("withheld") ||
      entityStr.includes("whoisguard") ||
      entityStr.includes("proxy")
    ) {
      isPrivacyProtected = true;
    }

    // Check nested entities (e.g. registrar abuse contacts)
    if (entity.entities) {
      const nested = extractEntities(entity.entities);
      if (!registrar && nested.registrar) registrar = nested.registrar;
      if (!registrantOrg && nested.registrantOrg) registrantOrg = nested.registrantOrg;
      if (!registrantCountry && nested.registrantCountry) registrantCountry = nested.registrantCountry;
      if (!abuseEmail && nested.abuseEmail) abuseEmail = nested.abuseEmail;
      if (nested.isPrivacyProtected) isPrivacyProtected = true;
    }
  }

  return {
    registrar,
    registrantOrg,
    registrantCountry,
    abuseEmail,
    isPrivacyProtected: isPrivacyProtected || (!registrantOrg && !registrantCountry),
  };
}

/**
 * RDAP Provider for Domain Names.
 * Fetches structured registration data from public RDAP endpoints (rdap.org / IANA bootstrap).
 */
export class RdapDomainProvider extends BaseIntelligenceProvider {
  public readonly id = "rdap-domain";
  public readonly name = "RDAP Domain Registration";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "rdap";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["domain"];
  public readonly capabilities: ProviderCapability[] = ["registration_lookup", "domain_reputation"];
  public readonly requiresAuth = false;
  public readonly description =
    "Fetches authoritative Domain Registration Data Access Protocol (RDAP) records including creation/expiration dates, registrar, and nameservers.";
  public readonly docsUrl = "https://www.icann.org/rdap";

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: RdapDomainResponse; fromCache: boolean; ageSeconds: number }> {
    const domain = target.value.toLowerCase().trim();

    // Check bounded cache first
    const cached = IntelligenceCache.get<RdapDomainResponse>(this.id, domain);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const url = `https://rdap.org/domain/${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rdap+json, application/json",
      },
      signal,
    });

    if (res.status === 404) {
      throw new Error(`RDAP record not found for domain '${domain}' (HTTP 404).`);
    }

    if (res.status === 429) {
      throw new Error("RDAP query rate limit exceeded (HTTP 429).");
    }

    if (!res.ok) {
      throw new Error(`RDAP upstream query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as RdapDomainResponse;

    // Cache valid response
    IntelligenceCache.set(this.id, domain, data, 3600);

    return { data, fromCache: false, ageSeconds: 0 };
  }

  protected async normalize(
    rawResponse: unknown,
    target: ProviderTarget,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    warnings?: string[];
    metadata?: Record<string, unknown>;
  }> {
    const { data, fromCache, ageSeconds } = rawResponse as {
      data: RdapDomainResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const domain = target.value.toLowerCase().trim();
    const now = Date.now();

    // 1. Extract Events (Registration, Expiration, Last Update)
    let createdAt: number | undefined;
    let expiresAt: number | undefined;
    let updatedAt: number | undefined;

    if (Array.isArray(data.events)) {
      for (const evt of data.events) {
        const d = Date.parse(evt.eventDate);
        if (!isNaN(d)) {
          if (evt.eventAction === "registration") createdAt = d;
          else if (evt.eventAction === "expiration") expiresAt = d;
          else if (evt.eventAction === "last changed" || evt.eventAction === "last update") updatedAt = d;
        }
      }
    }

    // Calculate domain age in days
    let ageDays: number | undefined;
    if (createdAt) {
      ageDays = Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));
    }

    // 2. Extract Entities (Registrar, Registrant, Privacy)
    const { registrar, registrantOrg, registrantCountry, isPrivacyProtected, abuseEmail } =
      extractEntities(data.entities);

    // 3. Extract Nameservers
    const nameservers: string[] = (data.nameservers || [])
      .map((ns) => ns.ldhName || ns.unicodeName || "")
      .filter((n): n is string => !!n)
      .map((n) => n.toLowerCase());

    // 4. Extract Statuses
    const statuses = data.status || [];

    // Authoritative RDAP Source link
    const selfLink = data.links?.find((l) => l.rel === "self")?.href || "https://rdap.org";

    const intel: DomainIntelligence = {
      createdAt,
      updatedAt,
      expiresAt,
      registrar,
      registrantOrganization: registrantOrg,
      registrantCountry,
      nameservers,
      dns: [],
      statuses,
      whoisRedacted: isPrivacyProtected,
      ageDays,
      rdapSource: selfLink,
    };

    // --- Generate Structured Findings & Evidence ---

    // A. Registration Status / Registrar
    if (registrar) {
      findings.push({
        id: `finding-rdap-registrar-${domain}`,
        category: "domain",
        nature: "observed_fact",
        finding: `Domain Registrar: ${registrar}`,
        severity: "informational",
        evidence: `Domain '${domain}' is registered with ${registrar}. Source: ${selfLink}`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { registrar, rdapSource: selfLink, fromCache, ageSeconds },
      });
    }

    // B. Domain Age & Creation Date
    if (createdAt !== undefined && ageDays !== undefined) {
      const createdDateStr = new Date(createdAt).toISOString().split("T")[0];
      findings.push({
        id: `finding-rdap-age-${domain}`,
        category: "domain",
        nature: "observed_fact",
        finding: `Domain Age: ${ageDays} days (Created ${createdDateStr})`,
        severity: "informational",
        evidence: `Observed official registration timestamp: ${createdDateStr} (${ageDays} days ago).`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { createdAt, ageDays, createdDateStr },
      });

      // Objective Indicator: Very new domain (<14 days)
      if (ageDays <= 14) {
        findings.push({
          id: `finding-rdap-new-domain-${domain}`,
          category: "domain",
          nature: "heuristic_indicator",
          finding: `Recently Registered Domain (${ageDays} day${ageDays === 1 ? "" : "s"} old)`,
          severity: ageDays <= 3 ? "medium" : "low",
          evidence: `Domain was created on ${createdDateStr} (less than 14 days ago). Newly created domains are statistically more frequently leveraged for short-lived disposable campaigns, though this does not constitute definitive malice by itself.`,
          confidence: 0.85,
          source: this.id,
          timestamp: now,
          metadata: { ageDays, createdAt },
          remediation: "Verify sender authenticity and avoid entering credentials if not a known trusted vendor.",
        });
      }
    }

    // C. Expiration Date
    if (expiresAt !== undefined) {
      const expiresDateStr = new Date(expiresAt).toISOString().split("T")[0];
      findings.push({
        id: `finding-rdap-expires-${domain}`,
        category: "domain",
        nature: "observed_fact",
        finding: `Domain Expiration: ${expiresDateStr}`,
        severity: "informational",
        evidence: `Registration valid until ${expiresDateStr}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { expiresAt, expiresDateStr },
      });
    }

    // D. Nameservers
    if (nameservers.length > 0) {
      findings.push({
        id: `finding-rdap-ns-${domain}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Authoritative Nameservers: ${nameservers.slice(0, 3).join(", ")}${nameservers.length > 3 ? "..." : ""}`,
        severity: "informational",
        evidence: `RDAP delegates DNS authority to: ${nameservers.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { nameservers },
      });
    }

    // E. Privacy Protection Observation (Explicitly NOT marked as malicious)
    if (isPrivacyProtected) {
      findings.push({
        id: `finding-rdap-privacy-${domain}`,
        category: "identity",
        nature: "observed_fact",
        finding: "Redacted / Privacy-Protected Registration",
        severity: "informational",
        evidence: "Registrant contact details are redacted for privacy (standard modern GDPR/ICANN privacy proxy practice; not an indicator of malice).",
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { redacted: true },
      });
    }

    // Convert findings to RiskEvidence
    const evidence: RiskEvidence[] = findings.map((f) => ({
      id: f.id,
      source: this.id,
      title: f.finding,
      description: f.evidence,
      severity: f.severity === "medium" ? "medium" : f.severity === "low" ? "low" : "benign",
      confidence: f.confidence,
      fields: f.metadata as RiskEvidence["fields"],
      discoveredAt: f.timestamp,
    }));

    return {
      findings,
      evidence,
      metadata: {
        domainIntel: intel,
        rawRdap: {
          handle: data.handle,
          statuses,
          nameservers,
          registrar,
          abuseEmail,
          selfLink,
        },
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

/**
 * RDAP Provider for IP Networks.
 * Fetches structured network allocation data from RIRs / public RDAP endpoints.
 */
export class RdapIpProvider extends BaseIntelligenceProvider {
  public readonly id = "rdap-ip";
  public readonly name = "RDAP IP Network";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "rdap";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["ip"];
  public readonly capabilities: ProviderCapability[] = ["network_allocation"];
  public readonly requiresAuth = false;
  public readonly description =
    "Fetches authoritative IP network allocation details from Regional Internet Registries (RIRs via RDAP).";
  public readonly docsUrl = "https://www.icann.org/rdap";

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: RdapIpResponse; fromCache: boolean; ageSeconds: number }> {
    const ip = target.value.trim();

    // Check bounded cache first
    const cached = IntelligenceCache.get<RdapIpResponse>(this.id, ip);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const url = `https://rdap.org/ip/${encodeURIComponent(ip)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/rdap+json, application/json",
      },
      signal,
    });

    if (res.status === 404) {
      throw new Error(`RDAP network record not found for IP '${ip}' (HTTP 404).`);
    }

    if (res.status === 429) {
      throw new Error("RDAP query rate limit exceeded (HTTP 429).");
    }

    if (!res.ok) {
      throw new Error(`RDAP IP query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as RdapIpResponse;

    // Cache valid response
    IntelligenceCache.set(this.id, ip, data, 3600);

    return { data, fromCache: false, ageSeconds: 0 };
  }

  protected async normalize(
    rawResponse: unknown,
    target: ProviderTarget,
  ): Promise<{
    findings: InvestigationFinding[];
    evidence: RiskEvidence[];
    warnings?: string[];
    metadata?: Record<string, unknown>;
  }> {
    const { data, fromCache, ageSeconds } = rawResponse as {
      data: RdapIpResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const ip = target.value.trim();
    const now = Date.now();

    const range = data.startAddress && data.endAddress ? `${data.startAddress} - ${data.endAddress}` : undefined;
    const netName = data.name || data.handle || "Allocated Network";
    const country = data.country;
    const rirLink = data.links?.find((l) => l.rel === "self")?.href || "https://rdap.org";

    const { registrantOrg, abuseEmail } = extractEntities(data.entities);

    findings.push({
      id: `finding-rdap-ip-net-${ip}`,
      category: "infrastructure",
      nature: "observed_fact",
      finding: `IP Network: ${netName}${range ? ` (${range})` : ""}`,
      severity: "informational",
      evidence: `IP '${ip}' is allocated in network block '${netName}'${country ? ` registered in ${country}` : ""}. Source: ${rirLink}`,
      confidence: 1.0,
      source: this.id,
      timestamp: now,
      metadata: { netName, range, country, registrantOrg, abuseEmail, fromCache, ageSeconds },
    });

    if (registrantOrg) {
      findings.push({
        id: `finding-rdap-ip-org-${ip}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Network Organization: ${registrantOrg}`,
        severity: "informational",
        evidence: `Allocated to organization '${registrantOrg}'.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { registrantOrg },
      });
    }

    const hostIntel: HostIntelligence = {
      ip,
      asn: {
        organization: registrantOrg || netName,
        country,
        type: "unknown",
      },
    };

    const evidence: RiskEvidence[] = findings.map((f) => ({
      id: f.id,
      source: this.id,
      title: f.finding,
      description: f.evidence,
      severity: "benign",
      confidence: f.confidence,
      fields: f.metadata as RiskEvidence["fields"],
      discoveredAt: f.timestamp,
    }));

    return {
      findings,
      evidence,
      metadata: {
        hostIntel,
        rawRdapIp: {
          handle: data.handle,
          startAddress: data.startAddress,
          endAddress: data.endAddress,
          name: data.name,
          country: data.country,
          registrantOrg,
          abuseEmail,
        },
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const rdapDomainProvider = new RdapDomainProvider();
export const rdapIpProvider = new RdapIpProvider();
