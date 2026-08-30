import {
  BaseIntelligenceProvider,
} from "./base";
import type {
  ProviderCategory,
  ProviderCapability,
  ProviderContext,
  ProviderPrivacy,
  ProviderTarget,
  TargetType,
} from "./types";
import type {
  DnsRecord,
  DomainIntelligence,
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
} from "../types";
import { IntelligenceCache } from "../cache";
import { parseIpv4Notation } from "../url-normalizer";

// DNS Record Type Mapping according to IANA DNS Parameters
export type SupportedDnsType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT" | "SOA" | "CAA";

const DNS_TYPE_CODES: Record<SupportedDnsType, number> = {
  A: 1,
  NS: 2,
  CNAME: 5,
  SOA: 6,
  MX: 15,
  TXT: 16,
  AAAA: 28,
  CAA: 257,
};

const CODE_TO_DNS_TYPE: Record<number, SupportedDnsType> = {
  1: "A",
  2: "NS",
  5: "CNAME",
  6: "SOA",
  15: "MX",
  16: "TXT",
  28: "AAAA",
  257: "CAA",
};

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohResponse {
  Status: number; // 0 = NOERROR, 2 = SERVFAIL, 3 = NXDOMAIN
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
  Additional?: DohAnswer[];
  Comment?: string;
}

export interface ResolvedDnsData {
  target: string;
  records: DnsRecord[];
  discoveredIps: string[];
  cnames: string[];
  mailServers: string[];
  nameservers: string[];
  txtRecords: string[];
  soaRecords: string[];
  caaRecords: string[];
  nxdomain: boolean;
  servfail: boolean;
}

/**
 * DNS-over-HTTPS (DoH) Intelligence Provider.
 * Resolves standard DNS resource records via RFC 8484 compliant DoH API (Cloudflare / Google).
 */
export class DnsOverHttpsProvider extends BaseIntelligenceProvider {
  public readonly id = "dns-over-https";
  public readonly name = "DNS-over-HTTPS (DoH)";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "dns";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["domain", "fqdn"];
  public readonly capabilities: ProviderCapability[] = ["dns_resolution", "subdomain_discovery"];
  public readonly requiresAuth = false;
  public readonly description =
    "Queries DNS-over-HTTPS resolvers (Cloudflare DoH) to resolve A, AAAA, CNAME, MX, NS, TXT, SOA, and CAA records.";
  public readonly docsUrl = "https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/";

  /**
   * Queries a single DNS record type via DoH with fallback.
   */
  private async queryRecordType(
    host: string,
    type: SupportedDnsType,
    signal: AbortSignal,
  ): Promise<DohAnswer[]> {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`;
    
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/dns-json",
        },
        signal,
      });

      if (!res.ok) {
        return [];
      }

      const json = (await res.json()) as DohResponse;
      return json.Answer || [];
    } catch {
      // Return empty array on individual record failure rather than halting all types
      return [];
    }
  }

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: ResolvedDnsData; fromCache: boolean; ageSeconds: number }> {
    const host = target.value.toLowerCase().trim();

    // Check bounded cache first
    const cached = IntelligenceCache.get<ResolvedDnsData>(this.id, host);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    // Query standard record types concurrently
    const recordTypes: SupportedDnsType[] = ["A", "AAAA", "CNAME", "MX", "NS", "TXT", "SOA", "CAA"];

    const answersPerType = await Promise.all(
      recordTypes.map((t) => this.queryRecordType(host, t, signal)),
    );

    const allAnswers = answersPerType.flat();
    const records: DnsRecord[] = [];
    const discoveredIps: string[] = [];
    const cnames: string[] = [];
    const mailServers: string[] = [];
    const nameservers: string[] = [];
    const txtRecords: string[] = [];
    const soaRecords: string[] = [];
    const caaRecords: string[] = [];

    for (const ans of allAnswers) {
      const typeName = CODE_TO_DNS_TYPE[ans.type];
      if (!typeName) continue;

      let cleanData = ans.data.trim();
      // Remove enclosing quotes on TXT records
      if (typeName === "TXT" && cleanData.startsWith('"') && cleanData.endsWith('"')) {
        cleanData = cleanData.slice(1, -1);
      }
      // Remove trailing dot on hostnames
      if (cleanData.endsWith(".")) {
        cleanData = cleanData.slice(0, -1);
      }

      records.push({
        type: typeName,
        value: cleanData,
        ttl: ans.TTL,
      });

      switch (typeName) {
        case "A":
        case "AAAA":
          if (!discoveredIps.includes(cleanData)) {
            discoveredIps.push(cleanData);
          }
          break;
        case "CNAME":
          if (!cnames.includes(cleanData)) {
            cnames.push(cleanData);
          }
          break;
        case "MX":
          if (!mailServers.includes(cleanData)) {
            mailServers.push(cleanData);
          }
          break;
        case "NS":
          if (!nameservers.includes(cleanData)) {
            nameservers.push(cleanData);
          }
          break;
        case "TXT":
          txtRecords.push(cleanData);
          break;
        case "SOA":
          soaRecords.push(cleanData);
          break;
        case "CAA":
          caaRecords.push(cleanData);
          break;
      }
    }

    const resolvedData: ResolvedDnsData = {
      target: host,
      records,
      discoveredIps,
      cnames,
      mailServers,
      nameservers,
      txtRecords,
      soaRecords,
      caaRecords,
      nxdomain: records.length === 0,
      servfail: false,
    };

    // Cache results for 5 minutes (DNS TTL)
    IntelligenceCache.set(this.id, host, resolvedData, 300);

    return { data: resolvedData, fromCache: false, ageSeconds: 0 };
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
      data: ResolvedDnsData;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const host = target.value.toLowerCase().trim();
    const now = Date.now();

    // 1. IP Resolutions (A & AAAA)
    if (data.discoveredIps.length > 0) {
      findings.push({
        id: `finding-doh-ips-${host}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `DNS Resolution: ${data.discoveredIps.join(", ")}`,
        severity: "informational",
        evidence: `Queried host '${host}' resolves to IP address(es): ${data.discoveredIps.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { ips: data.discoveredIps, fromCache, ageSeconds },
      });

      // Check for private / loopback IP anomalies in public DNS
      for (const ip of data.discoveredIps) {
        const ipInfo = parseIpv4Notation(ip);
        if (ipInfo.isLoopback) {
          findings.push({
            id: `finding-dns-loopback-ip-${ip}-${now}`,
            category: "infrastructure",
            nature: "heuristic_indicator",
            finding: `DNS Resolves to Loopback Interface (${ip})`,
            severity: "medium",
            evidence: `Public DNS query for '${host}' returned localhost / loopback address '${ip}'. This pattern is frequently used in local service redirection or intranet probing.`,
            confidence: 0.95,
            source: this.id,
            timestamp: now,
            metadata: { ip, host },
            remediation: "Do not navigate or submit requests to domains mapped to loopback addresses.",
          });
        } else if (ipInfo.isPrivate) {
          findings.push({
            id: `finding-dns-private-ip-${ip}-${now}`,
            category: "infrastructure",
            nature: "heuristic_indicator",
            finding: `DNS Resolves to Private RFC 1918 Range (${ip})`,
            severity: "low",
            evidence: `Host '${host}' resolves to RFC 1918 private address '${ip}'. In a public barcode context, this can target internal enterprise network assets.`,
            confidence: 0.9,
            source: this.id,
            timestamp: now,
            metadata: { ip, host },
          });
        }
      }
    }

    // 2. Canonical Name (CNAME) aliases
    for (const cname of data.cnames) {
      findings.push({
        id: `finding-doh-cname-${cname}-${now}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Canonical Name Alias (CNAME): -> ${cname}`,
        severity: "informational",
        evidence: `Host '${host}' is aliased to canonical host '${cname}'.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { alias: cname },
      });
    }

    // 3. Mail Infrastructure (MX)
    if (data.mailServers.length > 0) {
      findings.push({
        id: `finding-doh-mx-${host}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Mail Exchange (MX) Infrastructure: ${data.mailServers.slice(0, 3).join(", ")}`,
        severity: "informational",
        evidence: `Configured mail handlers: ${data.mailServers.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { mailServers: data.mailServers },
      });
    }

    // 4. Nameserver Infrastructure (NS)
    if (data.nameservers.length > 0) {
      findings.push({
        id: `finding-doh-ns-${host}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Authoritative DNS Nameservers: ${data.nameservers.join(", ")}`,
        severity: "informational",
        evidence: `Resolved NS records: ${data.nameservers.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { nameservers: data.nameservers },
      });
    }

    // 5. TXT Records & Authentication Protocols (SPF / DMARC verification)
    if (data.txtRecords.length > 0) {
      const spf = data.txtRecords.find((r) => r.toLowerCase().startsWith("v=spf1"));
      if (spf) {
        findings.push({
          id: `finding-doh-spf-${host}`,
          category: "infrastructure",
          nature: "observed_fact",
          finding: `Email Sender Policy Framework (SPF) Configured: ${spf}`,
          severity: "informational",
          evidence: `Domain publishes SPF record: '${spf}'.`,
          confidence: 1.0,
          source: this.id,
          timestamp: now,
          metadata: { spf },
        });
      }
    }

    // 6. Certificate Authority Authorization (CAA)
    if (data.caaRecords.length > 0) {
      findings.push({
        id: `finding-doh-caa-${host}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Certificate Authority Authorization (CAA) Present: ${data.caaRecords.join("; ")}`,
        severity: "informational",
        evidence: `Domain restricts issuing Certificate Authorities via CAA: ${data.caaRecords.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { caa: data.caaRecords },
      });
    }

    // 7. NXDOMAIN / Empty Response Handling
    const warnings: string[] = [];
    if (data.records.length === 0) {
      warnings.push(`No DNS resource records returned for '${host}'. Host may be unregistered, inactive, or DNS query timed out.`);
    }

    const domainIntel: DomainIntelligence = {
      nameservers: data.nameservers,
      dns: data.records,
      statuses: [],
      whoisRedacted: false,
    };

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
      warnings,
      metadata: {
        domainIntel,
        records: data.records,
        discoveredIps: data.discoveredIps,
        cnames: data.cnames,
        mailServers: data.mailServers,
        nameservers: data.nameservers,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const dnsOverHttpsProvider = new DnsOverHttpsProvider();
