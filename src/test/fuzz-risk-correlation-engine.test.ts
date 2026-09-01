import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExplainableRiskEngine } from "@/lib/investigation/risk-engine";
import { deduplicateFindings } from "@/lib/investigation/evidence-integrity";
import type { InvestigationFinding, FindingSeverity, FindingNature, TargetCollection } from "@/lib/investigation/types";
import type { ConflictingIntelligence } from "@/lib/investigation/synthesis-types";

describe("Phase 19: Risk & Synthesis Invariant Fuzzing Suite", () => {
  const engine = new ExplainableRiskEngine();

  const emptyTargets: TargetCollection = {
    urls: [],
    domains: [],
    hosts: [],
    ips: [],
    emails: [],
    phoneNumbers: [],
    cryptoAddresses: [],
    productCodes: [],
  };

  const severities: FindingSeverity[] = ["critical", "high", "medium", "low", "informational", "unknown"];
  const natures: FindingNature[] = ["observed_fact", "heuristic_indicator", "external_intelligence", "inferred_conclusion"];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Mathematical Invariant Property Testing", () => {
    it("strictly preserves mathematical bounds (Score: 0–100, Confidence: 0.0–1.0) under all finding combinations", () => {
      // Run 50 random finding permutations
      for (let iteration = 0; iteration < 50; iteration++) {
        const findingCount = Math.floor(Math.random() * 50);
        const randomFindings: InvestigationFinding[] = Array.from({ length: findingCount }).map((_, i) => ({
          id: `rand-f-${iteration}-${i}`,
          category: "url",
          finding: `Random Finding ${i}`,
          severity: severities[Math.floor(Math.random() * severities.length)],
          nature: natures[Math.floor(Math.random() * natures.length)],
          confidence: Math.random(),
          source: `Source-${i % 5}`,
          evidence: `Evidence snippet ${i}`,
          timestamp: Date.now() - i * 1000,
        }));

        const assessment = engine.evaluate(randomFindings, emptyTargets, true);

        // Invariant 1: Score is bounded between 0 and 100
        expect(assessment.score).toBeGreaterThanOrEqual(0);
        expect(assessment.score).toBeLessThanOrEqual(100);
        expect(Number.isFinite(assessment.score)).toBe(true);

        // Invariant 2: Confidence is bounded between 0.0 and 1.0
        expect(assessment.confidence).toBeGreaterThanOrEqual(0.0);
        expect(assessment.confidence).toBeLessThanOrEqual(1.0);
        expect(assessment.confidenceScore).toBeGreaterThanOrEqual(0.0);
        expect(assessment.confidenceScore).toBeLessThanOrEqual(1.0);

        // Invariant 3: Levels belong to closed valid enum sets
        expect(["low", "medium", "high"]).toContain(assessment.confidenceLevel);
        expect(["unknown", "informational", "low", "medium", "high", "critical"]).toContain(assessment.level);
        expect(typeof assessment.verdict).toBe("string");
        expect(assessment.verdict.length).toBeGreaterThan(0);
      }
    });
  });

  describe("2. Extreme Finding Distribution Fuzzing", () => {
    it("handles 0 findings, all-critical findings, and all-informational findings smoothly", () => {
      // 1. Zero findings without evaluable content
      const zeroAssessment = engine.evaluate([], emptyTargets, false);
      expect(zeroAssessment.score).toBe(0);
      expect(["unknown", "informational"]).toContain(zeroAssessment.level);

      // 2. 100 All-Critical Findings
      const criticalFindings: InvestigationFinding[] = Array.from({ length: 100 }).map((_, i) => ({
        id: `crit-${i}`,
        category: "payload",
        finding: `Critical Exploit ${i}`,
        severity: "critical",
        nature: "external_intelligence",
        confidence: 0.99,
        source: "Threat Feed",
        evidence: "Confirmed weaponized exploit",
        timestamp: Date.now(),
      }));

      const critAssessment = engine.evaluate(criticalFindings, emptyTargets, true);
      expect(critAssessment.score).toBeGreaterThanOrEqual(80);
      expect(critAssessment.score).toBeLessThanOrEqual(100);
      expect(critAssessment.level).toBe("critical");

      // 3. 100 All-Informational Findings
      const infoFindings: InvestigationFinding[] = Array.from({ length: 100 }).map((_, i) => ({
        id: `info-${i}`,
        category: "domain",
        finding: `DNS Record ${i}`,
        severity: "informational",
        nature: "observed_fact",
        confidence: 0.95,
        source: "DoH",
        evidence: "Valid A Record",
        timestamp: Date.now(),
      }));

      const infoAssessment = engine.evaluate(infoFindings, emptyTargets, true);
      expect(infoAssessment.score).toBeLessThanOrEqual(15);
      expect(["informational", "low", "benign"]).toContain(infoAssessment.level);
    });
  });

  describe("3. Conflicting Intelligence Multi-Source Synthesis", () => {
    it("synthesizes complex conflicting opinions without arithmetic divergence", () => {
      const mockConflicts: ConflictingIntelligence[] = [
        {
          target: "login.example.com",
          targetType: "url",
          conflictSummary: "VirusTotal classifies as malicious while SafeBrowsing classifies as clean.",
          detectedAt: Date.now(),
          opinions: [
            { providerId: "virus-total", providerName: "VirusTotal", classification: "malicious", confidence: 0.9, observedAt: Date.now() },
            { providerId: "safebrowsing", providerName: "Google Safe Browsing", classification: "clean", confidence: 0.95, observedAt: Date.now() },
          ],
        },
      ];

      const assessment = engine.evaluate([], emptyTargets, true, mockConflicts, ["rdap-domain"]);
      expect(assessment.score).toBeDefined();
      expect(assessment.conflictingIntelligence.length).toBe(1);
      expect(assessment.missingIntelligence).toContain("rdap-domain");
    });
  });

  describe("4. Fingerprint Deduplication Performance Bounds", () => {
    it("deduplicates 1,000 synthetic findings in under 30ms", () => {
      // Create 1,000 findings with 10 duplicate groups of 100 items each
      const syntheticFindings: InvestigationFinding[] = Array.from({ length: 1000 }).map((_, i) => {
        const group = i % 10;
        return {
          id: `syn-${i}`,
          category: "domain",
          finding: `Duplicate Indicator Group ${group}`,
          severity: "medium",
          nature: "heuristic_indicator",
          confidence: 0.7 + (i % 10) * 0.02,
          source: `Provider-${i % 4}`,
          evidence: `Evidence for group ${group}`,
          timestamp: 1000 + i,
        };
      });

      const startTime = performance.now();
      const deduped = deduplicateFindings(syntheticFindings);
      const elapsed = performance.now() - startTime;

      expect(deduped.length).toBe(10); // Exactly 10 unique groups
      expect(elapsed).toBeLessThan(30); // Sub-30ms performance bound
    });
  });
});
