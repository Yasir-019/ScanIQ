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
  HostIntelligence,
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
} from "../types";
import { IntelligenceCache } from "../cache";

export interface IpinfoResponse {
  ip: string;
  hostname?: string;
  anycast?: boolean;
  bogon?: boolean;
  city?: string;
  region?: string;
  country?: string;
  loc?: string; // "lat,long"
  org?: string; // e.g. "AS13335 Cloudflare, Inc."
  postal?: string;
  timezone?: string;
  readme?: string;
}

/**
 * Extracts ASN number and Org Name from IPinfo org string (e.g. "AS13335 Cloudflare, Inc.").
 */
function parseAsnOrg(orgStr?: string): { asnNumber?: number; asnOrg?: string } {
  if (!orgStr) return {};

  const match = orgStr.match(/^(AS\d+)\s+(.+)$/i);
  if (match) {
    const num = parseInt(match[1].replace(/^AS/i, ""), 10);
    return {
      asnNumber: isNaN(num) ? undefined : num,
      asnOrg: match[2].trim(),
    };
  }

  return { asnOrg: orgStr.trim() };
}

/**
 * IP / ASN & Geolocation Intelligence Provider.
 * Queries IPinfo to gather ASN, Autonomous System organization, Reverse DNS,
 * and approximate infrastructure geolocation.
 */
export class IpinfoProvider extends BaseIntelligenceProvider {
  public readonly id = "ipinfo";
  public readonly name = "IPinfo ASN & Geolocation";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "asn";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["ip"];
  public readonly capabilities: ProviderCapability[] = ["geo_intelligence", "ip_reputation", "network_allocation"];
  public readonly requiresAuth = false;
  public readonly envKey = "VITE_IPINFO_TOKEN";
  public readonly description =
    "Resolves Autonomous System Numbers (ASN), routing organizations, reverse DNS, and approximate infrastructure geolocation.";
  public readonly docsUrl = "https://ipinfo.io/developers";
  public readonly rateLimitHints = "Free tier allows 50,000 queries/month anonymous. Optional token in settings.";

  protected async performQuery(
    target: ProviderTarget,
    context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: IpinfoResponse; fromCache: boolean; ageSeconds: number }> {
    const ip = target.value.trim();

    // Check bounded cache first
    const cached = IntelligenceCache.get<IpinfoResponse>(this.id, ip);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const token = context.apiKey;
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json`;

    const headers: Record<string, string> = {
      Accept: "application/json",
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers,
      signal,
    });

    if (res.status === 404) {
      throw new Error(`IP address '${ip}' not found in IP intelligence database (HTTP 404).`);
    }

    if (res.status === 429) {
      throw new Error("IPinfo query rate limit exceeded (HTTP 429).");
    }

    if (!res.ok) {
      throw new Error(`IPinfo query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as IpinfoResponse;

    // Cache results for 24 hours
    IntelligenceCache.set(this.id, ip, data, 86400);

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
      data: IpinfoResponse;
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const ip = target.value.trim();
    const now = Date.now();

    // 1. Bogon / Unroutable IP detection
    if (data.bogon) {
      findings.push({
        id: `finding-ip-bogon-${ip}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Unroutable / Bogon IP Address (${ip})`,
        severity: "low",
        evidence: `IP '${ip}' is flagged as a bogon/private address space and is not globally routable on the public Internet.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { bogon: true, fromCache, ageSeconds },
      });
    }

    // 2. ASN & Organization
    const { asnNumber, asnOrg } = parseAsnOrg(data.org);
    const orgLabel = asnOrg || "Unknown Organization";
    const asnLabel = asnNumber ? `AS${asnNumber}` : "Unallocated ASN";

    if (data.org) {
      findings.push({
        id: `finding-ip-asn-${ip}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Autonomous System: ${asnLabel} (${orgLabel})`,
        severity: "informational",
        evidence: `IP '${ip}' routes via ${asnLabel} operated by ${orgLabel}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { asnNumber, asnOrg: orgLabel, rawOrg: data.org, fromCache, ageSeconds },
      });
    }

    // 3. Reverse DNS (PTR Hostname)
    if (data.hostname) {
      findings.push({
        id: `finding-ip-ptr-${ip}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Reverse DNS (PTR): ${data.hostname}`,
        severity: "informational",
        evidence: `IP '${ip}' resolves in PTR reverse DNS to '${data.hostname}'.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { hostname: data.hostname },
      });
    }

    // 4. Approximate Infrastructure Geolocation (with mandatory non-attribution disclaimer)
    let latitude: number | undefined;
    let longitude: number | undefined;
    if (data.loc) {
      const parts = data.loc.split(",");
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lon = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          latitude = lat;
          longitude = lon;
        }
      }
    }

    const geoParts = [data.city, data.region, data.country].filter(Boolean);
    const locationString = geoParts.length > 0 ? geoParts.join(", ") : "Unknown Location";

    if (geoParts.length > 0) {
      findings.push({
        id: `finding-ip-geo-${ip}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Approximate Infrastructure Geolocation: ${locationString}`,
        severity: "informational",
        evidence: `Hosting infrastructure for '${ip}' is located approximately in ${locationString} (Timezone: ${data.timezone || "unknown"}). Notice: Geolocation reflects hosting infrastructure location and must not be interpreted as the physical location of the domain owner, attacker, or user.`,
        confidence: 0.9,
        source: this.id,
        timestamp: now,
        metadata: {
          city: data.city,
          region: data.region,
          country: data.country,
          latitude,
          longitude,
          timezone: data.timezone,
          isInfrastructureLocation: true,
        },
      });
    }

    const hostIntel: HostIntelligence = {
      ip,
      reverseDns: data.hostname,
      asn: {
        number: asnNumber,
        organization: orgLabel,
        country: data.country,
        type: "hosting",
      },
      geolocation: {
        country: data.country,
        region: data.region,
        city: data.city,
        latitude,
        longitude,
        timezone: data.timezone,
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
        ipinfo: data,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const ipinfoProvider = new IpinfoProvider();
