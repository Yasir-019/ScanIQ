import type {
  DnsRecord,
  DomainIntelligence,
  HostIntelligence,
} from "@/lib/scan/types";
import type { InvestigationFinding } from "./types";
import { parseIpv4Notation } from "./url-normalizer";

export function analyzeDnsRecordsLocally(
  fqdn: string,
  records: DnsRecord[],
): {
  intel: DomainIntelligence;
  findings: InvestigationFinding[];
} {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];

  const nameservers = records
    .filter((r) => r.type === "NS")
    .map((r) => r.value.toLowerCase());

  // Check CNAME cloaking heuristic
  const cnames = records.filter((r) => r.type === "CNAME");
  for (const cname of cnames) {
    findings.push({
      id: `finding-dns-cname-${cname.value}-${now}`,
      category: "infrastructure",
      nature: "observed_fact",
      finding: `Canonical Name (CNAME) Alias: -> ${cname.value}`,
      severity: "informational",
      evidence: `DNS resolves '${fqdn}' to canonical alias '${cname.value}'.`,
      confidence: 1.0,
      source: "dns-analyzer",
      timestamp: now,
      metadata: { alias: cname.value },
    });
  }

  const intel: DomainIntelligence = {
    nameservers,
    dns: records,
    statuses: [],
    whoisRedacted: false,
  };

  return { intel, findings };
}

export function analyzeHostLocally(
  ipOrHost: string,
): {
  hostIntel: HostIntelligence;
  findings: InvestigationFinding[];
} {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];
  const ipInfo = parseIpv4Notation(ipOrHost);

  const hostIntel: HostIntelligence = {};

  if (ipInfo.isIp && ipInfo.canonicalIp) {
    hostIntel.ip = ipInfo.canonicalIp;

    if (ipInfo.isPrivate) {
      hostIntel.asn = {
        organization: "Private Network (RFC 1918)",
        type: "unknown",
      };
      findings.push({
        id: `finding-host-private-${ipInfo.canonicalIp}-${now}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Internal Network Host (${ipInfo.canonicalIp})`,
        severity: "informational",
        evidence: `Host IP falls in RFC 1918 private address space (10.0.0.0/8, 172.16.0.0/12, or 192.168.0.0/16).`,
        confidence: 1.0,
        source: "dns-analyzer",
        timestamp: now,
      });
    } else if (ipInfo.isLoopback) {
      hostIntel.asn = {
        organization: "Localhost / Loopback",
        type: "unknown",
      };
      findings.push({
        id: `finding-host-loopback-${ipInfo.canonicalIp}-${now}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Loopback Interface Target (${ipInfo.canonicalIp})`,
        severity: "medium",
        evidence: `Host points to local device loopback (127.0.0.0/8). Barcode payloads targeting localhost are typically designed for local service exploitation.`,
        confidence: 1.0,
        source: "dns-analyzer",
        timestamp: now,
      });
    }
  }

  return { hostIntel, findings };
}
