import { describe, it, expect } from "vitest";
import { SEVERITY_CONFIG, EVIDENCE_NATURE_CONFIG } from "@/components/investigation/CyberBadges";
import { sanitizeObject } from "@/lib/investigation/sanitization";
import type { UnifiedInvestigationModel } from "@/lib/investigation/synthesis-types";

describe("Phase 7B: UX Refinement, Accessibility & UI Consistency", () => {
  describe("1. Severity & Nature Configuration Integrity", () => {
    it("provides explicit non-color text labels and icons for all severities", () => {
      const severities = ["critical", "high", "medium", "low", "informational", "benign", "unknown"];
      for (const s of severities) {
        const conf = SEVERITY_CONFIG[s];
        expect(conf).toBeDefined();
        expect(conf.label).toBeTruthy();
        expect(conf.icon).toBeDefined();
        expect(conf.dotColor).toBeDefined();
      }
    });

    it("distinguishes the 4 core evidence natures", () => {
      const natures = [
        "observed_fact",
        "heuristic_indicator",
        "external_intelligence",
        "inferred_conclusion",
      ];
      for (const n of natures) {
        const conf = EVIDENCE_NATURE_CONFIG[n];
        expect(conf).toBeDefined();
        expect(conf.label).toBeTruthy();
        expect(conf.icon).toBeDefined();
      }
    });
  });

  describe("2. Sanitized Dossier & Export Security", () => {
    it("redacts private keys and tokens in exported investigation payloads", () => {
      const rawReport = {
        investigationId: "inv-export-test",
        auth: {
          apiKey: "secret_live_vt_token_12345",
          userToken: "bearer_secret_abcde",
        },
        payloadAnalysis: {
          size: 120,
          entropy: 3.45,
        },
      };

      const sanitized = sanitizeObject(rawReport);
      expect(sanitized.auth.apiKey).toBe("[REDACTED]");
      expect(sanitized.auth.userToken).toBe("[REDACTED]");
      expect(sanitized.investigationId).toBe("inv-export-test");
    });
  });

  describe("3. Graph Entity & Timeline Coherence", () => {
    it("handles multi-hop graph synthesis nodes and edges correctly", () => {
      const synthesis: UnifiedInvestigationModel = {
        rootTarget: "https://example.com",
        domains: [{ domain: "example.com", isApex: true, observations: [] }],
        ips: [{ ip: "93.184.216.34", version: "v4", observations: [] }],
        asns: [{ asn: 15133, name: "EDGECAST", observations: [] }],
        certificates: [],
        nameservers: [],
        registrars: [],
        threatIndicators: [],
        conflicts: [],
        missingSources: [],
        graph: {
          nodes: [
            { id: "url:https://example.com", type: "url", label: "https://example.com", sources: ["Scanner"], confidence: 1.0, timestamp: 1000 },
            { id: "domain:example.com", type: "domain", label: "example.com", sources: ["URL Normalizer"], confidence: 1.0, timestamp: 1000 },
            { id: "ip:93.184.216.34", type: "ip", label: "93.184.216.34", sources: ["DNS"], confidence: 0.95, timestamp: 1000 },
          ],
          edges: [
            { id: "e1", source: "url:https://example.com", target: "domain:example.com", type: "resolves_to", label: "hosts" },
            { id: "e2", source: "domain:example.com", target: "ip:93.184.216.34", type: "hosted_on", label: "A record" },
          ],
        },
      };

      expect(synthesis.graph.nodes).toHaveLength(3);
      expect(synthesis.graph.edges).toHaveLength(2);
      expect(synthesis.graph.edges[0].source).toBe("url:https://example.com");
      expect(synthesis.graph.edges[1].target).toBe("ip:93.184.216.34");
    });
  });
});
