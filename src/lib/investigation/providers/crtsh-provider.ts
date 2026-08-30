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
  RiskEvidence,
} from "@/lib/scan/types";
import type {
  InvestigationFinding,
} from "../types";
import { IntelligenceCache } from "../cache";

export interface CrtshEntry {
  issuer_ca_id: number;
  issuer_name: string;
  common_name: string;
  name_value: string;
  id: number;
  entry_timestamp: string;
  not_before: string;
  not_after: string;
  serial_number: string;
}

/**
 * crt.sh Certificate Transparency Provider Adapter.
 * Queries public Certificate Transparency (CT) logs to discover issued TLS certificates
 * and associated subdomains.
 */
export class CrtshProvider extends BaseIntelligenceProvider {
  public readonly id = "crtsh-cert";
  public readonly name = "crt.sh Certificate Transparency";
  public readonly type = "external" as const;
  public readonly category: ProviderCategory = "certificate";
  public readonly privacy: ProviderPrivacy = "direct";
  public readonly supportedTargets: TargetType[] = ["domain", "fqdn"];
  public readonly capabilities: ProviderCapability[] = [
    "certificate_search",
    "subdomain_discovery",
  ];
  public readonly requiresAuth = false;
  public readonly description =
    "Queries Certificate Transparency (CT) logs via crt.sh to discover issued SSL/TLS certificates and active subdomains.";
  public readonly docsUrl = "https://crt.sh";

  protected async performQuery(
    target: ProviderTarget,
    _context: ProviderContext,
    signal: AbortSignal,
  ): Promise<{ data: CrtshEntry[]; fromCache: boolean; ageSeconds: number }> {
    const domain = target.value.toLowerCase().trim();

    // Check cache
    const cached = IntelligenceCache.get<CrtshEntry[]>(this.id, domain);
    if (cached) {
      return { data: cached.data, fromCache: true, ageSeconds: cached.ageSeconds };
    }

    const endpoint = `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`;
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal,
    });

    if (res.status === 429) {
      throw new Error("crt.sh rate limit exceeded (HTTP 429).");
    }

    if (!res.ok) {
      throw new Error(`crt.sh query failed with status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as CrtshEntry[];

    // Cache results for 2 hours
    IntelligenceCache.set(this.id, domain, data, 7200);

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
      data: CrtshEntry[];
      fromCache: boolean;
      ageSeconds: number;
    };

    const findings: InvestigationFinding[] = [];
    const now = Date.now();
    const domain = target.value.toLowerCase().trim();

    if (!Array.isArray(data) || data.length === 0) {
      return {
        findings: [],
        evidence: [],
        warnings: [`No public Certificate Transparency entries logged for '${domain}'.`],
        metadata: { cached: fromCache, cacheAgeSeconds: ageSeconds },
      };
    }

    const subdomains = new Set<string>();
    const issuers = new Set<string>();

    for (const entry of data.slice(0, 100)) {
      if (entry.name_value) {
        const names = entry.name_value.split("\n");
        for (const n of names) {
          const clean = n.trim().toLowerCase();
          if (clean && !clean.includes("*") && clean.endsWith(domain)) {
            subdomains.add(clean);
          }
        }
      }
      if (entry.issuer_name) {
        const match = entry.issuer_name.match(/O=([^,]+)/);
        if (match) {
          issuers.add(match[1].trim());
        }
      }
    }

    const subList = Array.from(subdomains);
    const issuerList = Array.from(issuers);

    if (subList.length > 0) {
      findings.push({
        id: `finding-crtsh-subs-${domain}-${now}`,
        category: "domain",
        nature: "observed_fact",
        finding: `Discovered ${subList.length} Subdomain(s) in Certificate Transparency Logs`,
        severity: "informational",
        evidence: `CT logs reveal active/historical subdomains: ${subList.slice(0, 5).join(", ")}${subList.length > 5 ? ` (+${subList.length - 5} more)` : ""}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { subdomains: subList, totalLogged: data.length, fromCache, ageSeconds },
      });
    }

    if (issuerList.length > 0) {
      findings.push({
        id: `finding-crtsh-issuers-${domain}-${now}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `TLS Certificate Issuers: ${issuerList.slice(0, 3).join(", ")}`,
        severity: "informational",
        evidence: `Observed Certificate Authorities: ${issuerList.join(", ")}.`,
        confidence: 1.0,
        source: this.id,
        timestamp: now,
        metadata: { issuers: issuerList, fromCache, ageSeconds },
      });
    }

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
        subdomains: subList,
        issuers: issuerList,
        totalCertificates: data.length,
        cached: fromCache,
        cacheAgeSeconds: ageSeconds,
      },
    };
  }
}

export const crtshProvider = new CrtshProvider();
