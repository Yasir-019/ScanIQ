import type {
  DnsRecord,
  DomainIntelligence,
  HostIntelligence,
} from "@/lib/scan/types";
import type { ProviderResult } from "./providers/types";
import type {
  ConflictingIntelligence,
  EntityType,
  InvestigationEntity,
  InvestigationGraphModel,
  SynthesisGraphEdge,
  SynthesisGraphNode,
  UnifiedInvestigationModel,
} from "./synthesis-types";
import { evaluateFreshness, IntelligenceSynthesizer } from "./synthesizer";

export type GraphNodeType = EntityType;
export type GraphNode = SynthesisGraphNode;
export type GraphEdge = SynthesisGraphEdge;
export type InfrastructureGraph = InvestigationGraphModel;

export interface CorrelatedInfrastructure {
  domainIntel: DomainIntelligence;
  hostIntel: HostIntelligence[];
  graph: InfrastructureGraph;
  unifiedModel: UnifiedInvestigationModel;
}

/**
 * Correlates multi-provider OSINT results (Local Heuristics, RDAP, DNS, IPinfo, Certificates, Threat Reputations)
 * into a unified investigation entity model, evidence-backed graph, and conflicting intelligence registry.
 */
export function correlateInfrastructure(
  providerResults: ProviderResult[],
  initialDomain?: string,
  initialIp?: string,
  rawPayload?: string,
  initialUrl?: string,
): CorrelatedInfrastructure {
  const entitiesMap = new Map<string, InvestigationEntity>();
  const nodesMap = new Map<string, SynthesisGraphNode>();
  const edgesMap = new Map<string, SynthesisGraphEdge>();
  const now = Date.now();

  const upsertEntity = (
    id: string,
    type: EntityType,
    value: string,
    label: string,
    source: string,
    timestamp: number,
    confidence: number = 1.0,
    metadata?: Record<string, unknown>,
  ): InvestigationEntity => {
    const existing = entitiesMap.get(id);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      existing.lastObserved = Math.max(existing.lastObserved, timestamp);
      existing.firstObserved = Math.min(existing.firstObserved, timestamp);
      existing.confidence = Math.max(existing.confidence, confidence);
      if (metadata) {
        existing.metadata = { ...existing.metadata, ...metadata };
      }
      return existing;
    }

    const freshness = evaluateFreshness(timestamp);
    const entity: InvestigationEntity = {
      id,
      type,
      value,
      label,
      sources: [source],
      firstObserved: timestamp,
      lastObserved: timestamp,
      confidence,
      freshness,
      metadata,
      relatedEntityIds: [],
    };
    entitiesMap.set(id, entity);
    return entity;
  };

  const addGraphNode = (
    id: string,
    type: EntityType,
    label: string,
    sublabel: string | undefined,
    source: string,
    timestamp: number,
    confidence: number = 1.0,
    metadata?: Record<string, unknown>,
  ) => {
    upsertEntity(id, type, label, label, source, timestamp, confidence, metadata);

    const existingNode = nodesMap.get(id);
    if (existingNode) {
      if (!existingNode.sources.includes(source)) {
        existingNode.sources.push(source);
      }
      existingNode.confidence = Math.max(existingNode.confidence, confidence);
      return;
    }

    nodesMap.set(id, {
      id,
      type,
      label,
      sublabel,
      sources: [source],
      freshness: evaluateFreshness(timestamp),
      confidence,
      metadata,
    });
  };

  const addGraphEdge = (
    sourceId: string,
    targetId: string,
    type: SynthesisGraphEdge["type"],
    label: string,
    source: string,
    confidence: number = 1.0,
  ) => {
    const edgeId = `${sourceId}->${type}->${targetId}`;
    const existing = edgesMap.get(edgeId);
    if (existing) {
      if (!existing.sources.includes(source)) {
        existing.sources.push(source);
      }
      existing.confidence = Math.max(existing.confidence, confidence);
      return;
    }

    edgesMap.set(edgeId, {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type,
      label,
      sources: [source],
      confidence,
    });

    // Update entity relations
    const srcEntity = entitiesMap.get(sourceId);
    const tgtEntity = entitiesMap.get(targetId);
    if (srcEntity && !srcEntity.relatedEntityIds.includes(targetId)) {
      srcEntity.relatedEntityIds.push(targetId);
    }
    if (tgtEntity && !tgtEntity.relatedEntityIds.includes(sourceId)) {
      tgtEntity.relatedEntityIds.push(sourceId);
    }
  };

  // Base Domain Intelligence
  let domainIntel: DomainIntelligence = {
    nameservers: [],
    dns: [],
    statuses: [],
    whoisRedacted: true,
  };

  // Base Host Intelligence map (keyed by IP)
  const hostIntelMap = new Map<string, HostIntelligence>();

  // 1. Initial Target Registration (QR, Payload, URL, Domain, IP)
  if (rawPayload) {
    const payloadId = "payload:root";
    addGraphNode(payloadId, "payload", "QR Payload", "Raw Content", "scanner", now);

    if (initialUrl) {
      const urlId = `url:${initialUrl}`;
      addGraphNode(urlId, "url", initialUrl, "Target URL", "url-normalizer", now);
      addGraphEdge(payloadId, urlId, "decodes_to", "decodes to", "url-normalizer");
    }
  }

  if (initialDomain) {
    const cleanDomain = initialDomain.toLowerCase().trim();
    const domainId = `domain:${cleanDomain}`;
    addGraphNode(domainId, "domain", cleanDomain, "Apex Domain", "domain-analyzer", now);

    if (initialUrl) {
      addGraphEdge(`url:${initialUrl}`, domainId, "hosts_domain", "hosts domain", "domain-analyzer");
    }
  }

  if (initialIp) {
    const cleanIp = initialIp.trim();
    const ipId = `ip:${cleanIp}`;
    addGraphNode(ipId, "ip", cleanIp, "IP Address", "dns-analyzer", now);
    hostIntelMap.set(cleanIp, { ip: cleanIp });
  }

  // 2. Process all provider results
  for (const res of providerResults) {
    if (res.status !== "success" || !res.metadata) continue;

    const pSource = res.providerName || res.providerId;
    const pTime = res.queriedAt;

    // A. RDAP Domain
    if (res.providerId === "rdap-domain" && res.metadata.domainIntel) {
      const rdapIntel = res.metadata.domainIntel as DomainIntelligence;
      const targetDomain = res.target.value.toLowerCase().trim();
      const domainId = `domain:${targetDomain}`;

      domainIntel = {
        ...domainIntel,
        ...rdapIntel,
        dns: domainIntel.dns.length > 0 ? domainIntel.dns : rdapIntel.dns,
        nameservers: Array.from(new Set([...domainIntel.nameservers, ...rdapIntel.nameservers])),
      };

      addGraphNode(
        domainId,
        "domain",
        targetDomain,
        rdapIntel.ageDays !== undefined ? `${rdapIntel.ageDays}d old` : "Apex Domain",
        pSource,
        pTime,
        1.0,
        { registrar: rdapIntel.registrar, ageDays: rdapIntel.ageDays, createdAt: rdapIntel.createdAt },
      );

      if (rdapIntel.registrar) {
        const regId = `registrar:${rdapIntel.registrar.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        addGraphNode(regId, "registrar", rdapIntel.registrar, "Domain Registrar", pSource, pTime);
        addGraphEdge(domainId, regId, "registered_with", "registered with", pSource);
      }

      for (const ns of rdapIntel.nameservers) {
        const nsId = `nameserver:${ns.toLowerCase()}`;
        addGraphNode(nsId, "nameserver", ns.toLowerCase(), "Authoritative NS", pSource, pTime);
        addGraphEdge(domainId, nsId, "uses_nameserver", "uses nameserver", pSource);
      }
    }

    // B. DNS-over-HTTPS
    if (res.providerId === "dns-over-https") {
      const targetHost = res.target.value.toLowerCase().trim();
      const hostId = `domain:${targetHost}`;

      addGraphNode(hostId, "domain", targetHost, "Queried Host", pSource, pTime);

      const records = (res.metadata.records as DnsRecord[]) || [];
      const discoveredIps = (res.metadata.discoveredIps as string[]) || [];
      const cnames = (res.metadata.cnames as string[]) || [];
      const mailServers = (res.metadata.mailServers as string[]) || [];
      const nameservers = (res.metadata.nameservers as string[]) || [];

      domainIntel.dns = Array.from(new Set([...domainIntel.dns, ...records]));
      domainIntel.nameservers = Array.from(new Set([...domainIntel.nameservers, ...nameservers]));

      for (const ip of discoveredIps) {
        const ipId = `ip:${ip}`;
        addGraphNode(ipId, "ip", ip, "Resolved IP", pSource, pTime);
        addGraphEdge(hostId, ipId, "resolves_to", "resolves to", pSource);

        if (!hostIntelMap.has(ip)) {
          hostIntelMap.set(ip, { ip });
        }
      }

      for (const cname of cnames) {
        const cnameId = `domain:${cname.toLowerCase()}`;
        addGraphNode(cnameId, "subdomain", cname, "Canonical Alias (CNAME)", pSource, pTime);
        addGraphEdge(hostId, cnameId, "subdomain_of", "alias of", pSource);
      }

      for (const mx of mailServers) {
        const mxId = `nameserver:${mx.toLowerCase()}`;
        addGraphNode(mxId, "nameserver", mx, "Mail Handler (MX)", pSource, pTime);
        addGraphEdge(hostId, mxId, "uses_nameserver", "mail handled by", pSource);
      }
    }

    // C. IPinfo & RDAP IP
    if ((res.providerId === "ipinfo" || res.providerId === "rdap-ip") && res.metadata.hostIntel) {
      const hIntel = res.metadata.hostIntel as HostIntelligence;
      const targetIp = (hIntel.ip || res.target.value).trim();
      const ipId = `ip:${targetIp}`;

      const existing = hostIntelMap.get(targetIp) || { ip: targetIp };
      const mergedHost: HostIntelligence = {
        ...existing,
        ...hIntel,
        asn: { ...existing.asn, ...hIntel.asn },
        geolocation: { ...existing.geolocation, ...hIntel.geolocation },
      };
      hostIntelMap.set(targetIp, mergedHost);

      addGraphNode(ipId, "ip", targetIp, mergedHost.reverseDns || "IP Address", pSource, pTime);

      if (mergedHost.asn?.organization) {
        const asnNum = mergedHost.asn.number ? `AS${mergedHost.asn.number}` : "ASN";
        const asnId = `asn:${asnNum}_${mergedHost.asn.organization.replace(/[^a-z0-9]/gi, "_")}`;
        addGraphNode(asnId, "asn", `${asnNum} ${mergedHost.asn.organization}`, "Autonomous System", pSource, pTime);
        addGraphEdge(ipId, asnId, "routed_by", "routed by", pSource);
      }

      if (mergedHost.geolocation?.country) {
        const locParts = [
          mergedHost.geolocation.city,
          mergedHost.geolocation.region,
          mergedHost.geolocation.country,
        ].filter(Boolean);
        const locLabel = locParts.join(", ");
        const locId = `location:${locLabel.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;

        addGraphNode(locId, "location", locLabel, "Approx Infrastructure Location", pSource, pTime);
        addGraphEdge(ipId, locId, "located_in", "hosted in", pSource);
      }
    }

    // D. crt.sh Certificate Transparency
    if (res.providerId === "crtsh-cert" && res.metadata) {
      const subdomains = (res.metadata.subdomains as string[]) || [];
      const issuers = (res.metadata.issuers as string[]) || [];
      const targetDomain = res.target.value.toLowerCase().trim();
      const domainId = `domain:${targetDomain}`;

      for (const sub of subdomains.slice(0, 10)) {
        const subId = `domain:${sub}`;
        addGraphNode(subId, "subdomain", sub, "Discovered Subdomain", pSource, pTime);
        addGraphEdge(domainId, subId, "subdomain_of", "parent domain of", pSource);
      }

      for (const issuer of issuers.slice(0, 3)) {
        const certId = `certificate:${issuer.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        addGraphNode(certId, "certificate", issuer, "Certificate Authority", pSource, pTime);
        addGraphEdge(domainId, certId, "has_certificate", "certified by", pSource);
      }
    }

    // E. Threat Reputation Providers (VirusTotal, URLScan, AbuseIPDB, SafeBrowsing)
    if (res.reputation && (res.reputation.classification === "malicious" || res.reputation.classification === "suspicious")) {
      const threatTarget = res.target.value;
      const targetId = res.target.type === "url" ? `url:${threatTarget}` : res.target.type === "ip" ? `ip:${threatTarget}` : `domain:${threatTarget.toLowerCase()}`;
      const threatId = `threat:${res.providerId}_${threatTarget.replace(/[^a-z0-9]/gi, "_")}`;

      const label = `${res.providerName}: ${res.reputation.classification.toUpperCase()}`;
      addGraphNode(threatId, "threat_indicator", label, `Score: ${res.reputation.score ?? "flagged"}`, pSource, pTime, res.reputation.confidence || 0.9);
      addGraphEdge(targetId, threatId, "reported_by", "flagged by", pSource);
    }
  }

  // Detect contradictions & missing intelligence
  const conflicts: ConflictingIntelligence[] = IntelligenceSynthesizer.detectContradictions(providerResults);
  const missingSources: string[] = IntelligenceSynthesizer.identifyMissingIntelligence(providerResults);

  const graph: InfrastructureGraph = {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
  };

  const entities: Record<string, InvestigationEntity> = {};
  for (const [key, ent] of entitiesMap.entries()) {
    entities[key] = ent;
  }

  const unifiedModel: UnifiedInvestigationModel = {
    entities,
    graph,
    conflicts,
    missingSources,
    synthesizedAt: now,
  };

  return {
    domainIntel,
    hostIntel: Array.from(hostIntelMap.values()),
    graph,
    unifiedModel,
  };
}
