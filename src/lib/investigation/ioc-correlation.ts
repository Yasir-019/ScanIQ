import { db } from "@/lib/db";
import type { InvestigationCase, RiskLevel } from "@/lib/scan/types";

export interface CrossCaseIocOccurrence {
  caseId: string;
  caseLabel: string;
  caseStatus: string;
  investigationId?: string;
  targetValue: string;
  riskLevel: RiskLevel;
  firstObserved: number;
  lastObserved: number;
  matchingFindings: string[];
}

export interface CrossCaseIocResult {
  ioc: string;
  iocType: "domain" | "ip" | "url" | "email" | "hash" | "other";
  occurrences: CrossCaseIocOccurrence[];
  totalCasesCount: number;
  earliestObservation: number;
  latestObservation: number;
  highestRiskLevel: RiskLevel;
}

export interface IocSearchResultItem {
  ioc: string;
  iocType: string;
  cases: {
    id: string;
    label: string;
    risk: RiskLevel;
    updatedAt: number;
  }[];
  findingsCount: number;
  latestFindingTitle?: string;
}

/**
 * Normalizes an IOC string for deterministic indexing and cross-case comparison.
 */
export function normalizeIoc(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  // Strip http/https prefixes for hostname/domain matching
  if (trimmed.startsWith("http://")) return trimmed.slice(7).replace(/\/+$/, "");
  if (trimmed.startsWith("https://")) return trimmed.slice(8).replace(/\/+$/, "");
  return trimmed;
}

/**
 * Categorizes an IOC string into standard entity types.
 */
export function detectIocType(ioc: string): "domain" | "ip" | "url" | "email" | "hash" | "other" {
  const clean = ioc.trim().toLowerCase();
  if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(clean)) return "ip";
  if (/^[a-f0-9]{32}$|^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(clean)) return "hash";
  if (clean.includes("@") && !clean.includes("://")) return "email";
  if (clean.startsWith("http://") || clean.startsWith("https://") || clean.includes("/")) return "url";
  if (clean.includes(".") && !clean.includes(" ")) return "domain";
  return "other";
}

const RISK_WEIGHTS: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  benign: 1,
  safe: 1,
  unknown: 0,
  unchecked: 0,
};

function getHighestRisk(levels: string[]): RiskLevel {
  let highest: RiskLevel = "unknown";
  let maxWeight = -1;
  for (const lvl of levels) {
    const w = RISK_WEIGHTS[lvl] ?? 0;
    if (w > maxWeight) {
      maxWeight = w;
      highest = lvl as RiskLevel;
    }
  }
  return highest;
}

export class IocCorrelationService {
  /**
   * Queries all stored cases, scans, and investigation reports in IndexedDB
   * to find occurrences of a specific indicator across historical cases.
   */
  public static async correlateIocAcrossCases(
    ioc: string,
    currentCaseId?: string
  ): Promise<CrossCaseIocResult | null> {
    if (!ioc || !ioc.trim()) return null;

    const normalizedTarget = normalizeIoc(ioc);
    const iocType = detectIocType(ioc);

    // Fetch all cases, scans, and investigations from Dexie
    const [allCases, allScans, allInvs] = await Promise.all([
      db.cases.toArray(),
      db.scans.toArray(),
      db.investigations.toArray(),
    ]);

    const caseMap = new Map<string, InvestigationCase>();
    for (const c of allCases) caseMap.set(c.id, c);

    const occurrences: CrossCaseIocOccurrence[] = [];
    const matchedCaseIds = new Set<string>();

    // 1. Match against Scans
    for (const scan of allScans) {
      if (!scan.caseId) continue;
      const normalizedContent = normalizeIoc(scan.content);

      if (
        normalizedContent === normalizedTarget ||
        normalizedContent.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedContent)
      ) {
        matchedCaseIds.add(scan.caseId);
      }
    }

    // 2. Match against Investigation Reports (Targets & Findings)
    for (const inv of allInvs) {
      if (!inv.caseId) continue;

      let hasMatch = false;
      const matchingFindings: string[] = [];

      // Check targets
      const urls = inv.targets?.urls || [];
      const domains = inv.targets?.domains || [];
      const hosts = inv.targets?.hosts || [];

      if (
        urls.some((u) => normalizeIoc(u.fqdn || "").includes(normalizedTarget)) ||
        domains.some((d) => normalizeIoc(d).includes(normalizedTarget)) ||
        hosts.some((h) => normalizeIoc(h).includes(normalizedTarget))
      ) {
        hasMatch = true;
      }

      // Check findings
      for (const f of inv.findings || []) {
        if (
          normalizeIoc(f.title).includes(normalizedTarget) ||
          normalizeIoc(f.summary).includes(normalizedTarget)
        ) {
          hasMatch = true;
          if (!matchingFindings.includes(f.title)) {
            matchingFindings.push(f.title);
          }
        }
      }

      if (hasMatch) {
        matchedCaseIds.add(inv.caseId);
      }
    }

    // Compile occurrence records for matched cases
    const observedTimestamps: number[] = [];
    const observedRisks: string[] = [];

    for (const cid of matchedCaseIds) {
      const caseRecord = caseMap.get(cid);
      const caseInvs = allInvs.filter((i) => i.caseId === cid);
      const caseScans = allScans.filter((s) => s.caseId === cid);

      const caseFindings: string[] = [];
      for (const inv of caseInvs) {
        for (const f of inv.findings || []) {
          if (
            normalizeIoc(f.title).includes(normalizedTarget) ||
            normalizeIoc(f.summary).includes(normalizedTarget)
          ) {
            if (!caseFindings.includes(f.title)) caseFindings.push(f.title);
          }
        }
      }

      const caseDates = [
        caseRecord?.createdAt,
        caseRecord?.updatedAt,
        ...caseInvs.map((i) => i.createdAt),
        ...caseScans.map((s) => s.scannedAt),
      ].filter((d): d is number => typeof d === "number" && !isNaN(d));

      const firstObs = caseDates.length > 0 ? Math.min(...caseDates) : Date.now();
      const lastObs = caseDates.length > 0 ? Math.max(...caseDates) : Date.now();

      observedTimestamps.push(firstObs, lastObs);

      const caseRisk = (caseRecord?.latestRiskLevel || "unknown") as RiskLevel;
      observedRisks.push(caseRisk);

      // Exclude currentCaseId from cross-case count if requested, but include in occurrences list with flag
      occurrences.push({
        caseId: cid,
        caseLabel: caseRecord?.label || `Case #${cid.replace("case-", "").slice(0, 8)}`,
        caseStatus: caseRecord?.status || "active",
        investigationId: caseRecord?.latestInvestigationId,
        targetValue: caseRecord?.primaryTarget || ioc,
        riskLevel: caseRisk,
        firstObserved: firstObs,
        lastObserved: lastObs,
        matchingFindings: caseFindings.slice(0, 5),
      });
    }

    if (occurrences.length === 0) return null;

    // Filter other cases (excluding current case if specified)
    const otherCases = currentCaseId
      ? occurrences.filter((o) => o.caseId !== currentCaseId)
      : occurrences;

    return {
      ioc,
      iocType,
      occurrences,
      totalCasesCount: otherCases.length,
      earliestObservation: observedTimestamps.length > 0 ? Math.min(...observedTimestamps) : Date.now(),
      latestObservation: observedTimestamps.length > 0 ? Math.max(...observedTimestamps) : Date.now(),
      highestRiskLevel: getHighestRisk(observedRisks),
    };
  }

  /**
   * Performs global multi-case search for indicators, domains, IPs, and keywords.
   */
  public static async searchIocs(query: string): Promise<IocSearchResultItem[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const [allCases, allScans, allInvs] = await Promise.all([
      db.cases.toArray(),
      db.scans.toArray(),
      db.investigations.toArray(),
    ]);

    const caseMap = new Map<string, InvestigationCase>();
    for (const c of allCases) caseMap.set(c.id, c);

    const resultMap = new Map<string, IocSearchResultItem>();

    // 1. Search in Investigations Targets & Domains
    for (const inv of allInvs) {
      const cid = inv.caseId || "unknown";
      const caseRecord = caseMap.get(cid);
      const caseLabel = caseRecord?.label || `Case #${cid.replace("case-", "").slice(0, 8)}`;
      const caseRisk = (caseRecord?.latestRiskLevel || "unknown") as RiskLevel;
      const updatedAt = caseRecord?.updatedAt || inv.updatedAt || Date.now();

      const candidateIocs = [
        ...(inv.targets?.domains || []),
        ...(inv.targets?.hosts || []),
        ...(inv.targets?.urls?.map((u) => u.fqdn || u.domain) || []),
      ].filter(Boolean);

      for (const ioc of candidateIocs) {
        if (ioc.toLowerCase().includes(q)) {
          const key = ioc.toLowerCase();
          const existing = resultMap.get(key) || {
            ioc,
            iocType: detectIocType(ioc),
            cases: [],
            findingsCount: 0,
            latestFindingTitle: inv.findings?.[0]?.title,
          };

          if (!existing.cases.some((c) => c.id === cid)) {
            existing.cases.push({
              id: cid,
              label: caseLabel,
              risk: caseRisk,
              updatedAt,
            });
          }

          existing.findingsCount += inv.findings?.length || 0;
          resultMap.set(key, existing);
        }
      }
    }

    // 2. Search in Scan Records
    for (const scan of allScans) {
      if (scan.content.toLowerCase().includes(q)) {
        const cid = scan.caseId || "unknown";
        const caseRecord = caseMap.get(cid);
        const caseLabel = caseRecord?.label || `Case #${cid.replace("case-", "").slice(0, 8)}`;
        const caseRisk = (caseRecord?.latestRiskLevel || "unknown") as RiskLevel;
        const updatedAt = caseRecord?.updatedAt || scan.scannedAt;

        const key = scan.content.trim().toLowerCase();
        const existing = resultMap.get(key) || {
          ioc: scan.content,
          iocType: detectIocType(scan.content),
          cases: [],
          findingsCount: 0,
        };

        if (!existing.cases.some((c) => c.id === cid)) {
          existing.cases.push({
            id: cid,
            label: caseLabel,
            risk: caseRisk,
            updatedAt,
          });
        }
        resultMap.set(key, existing);
      }
    }

    return Array.from(resultMap.values()).sort((a, b) => b.cases.length - a.cases.length);
  }
}
