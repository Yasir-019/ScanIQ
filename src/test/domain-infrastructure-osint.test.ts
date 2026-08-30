import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  IntelligenceCache,
  RdapDomainProvider,
  RdapIpProvider,
  DnsOverHttpsProvider,
  IpinfoProvider,
  correlateInfrastructure,
  investigationEngine,
  RateLimitTracker,
} from "@/lib/investigation";
import { useSettings } from "@/lib/settings";
import type { ScanRecord } from "@/lib/scan/types";

describe("Phase 3B: Domain & Infrastructure OSINT", () => {
  beforeEach(() => {
    IntelligenceCache.clear();
    RateLimitTracker.clear();
    vi.restoreAllMocks();

    useSettings.setState({
      externalLookupsOptedIn: true,
      sourceToggles: {
        "local-heuristics": true,
        "rdap-domain": true,
        "rdap-ip": true,
        "dns-over-https": true,
        "ipinfo": true,
      },
      apiKeys: {},
    });
  });

  describe("1. Bounded Intelligence Cache", () => {
    it("stores, retrieves, and checks existence of cached items", () => {
      IntelligenceCache.set("dns-over-https", "example.com", { resolved: "93.184.216.34" }, 60);

      expect(IntelligenceCache.has("dns-over-https", "example.com")).toBe(true);
      const cached = IntelligenceCache.get<{ resolved: string }>("dns-over-https", "example.com");
      expect(cached).not.toBeNull();
      expect(cached?.data.resolved).toBe("93.184.216.34");
      expect(cached?.ttlSeconds).toBe(60);
      expect(cached?.ageSeconds).toBeGreaterThanOrEqual(0);
    });

    it("returns null for expired entries and purges them", () => {
      // Set an entry with -1 second TTL (already expired)
      IntelligenceCache.set("rdap-domain", "expired.com", { status: "ok" }, -1);

      expect(IntelligenceCache.has("rdap-domain", "expired.com")).toBe(false);
      expect(IntelligenceCache.get("rdap-domain", "expired.com")).toBeNull();
    });

    it("clears entries selectively by provider ID or globally", () => {
      IntelligenceCache.set("rdap-domain", "domain1.com", { val: 1 });
      IntelligenceCache.set("dns-over-https", "domain1.com", { val: 2 });
      IntelligenceCache.set("ipinfo", "1.1.1.1", { val: 3 });

      expect(IntelligenceCache.size()).toBe(3);

      IntelligenceCache.clear("rdap-domain");
      expect(IntelligenceCache.has("rdap-domain", "domain1.com")).toBe(false);
      expect(IntelligenceCache.has("dns-over-https", "domain1.com")).toBe(true);
      expect(IntelligenceCache.size()).toBe(2);

      IntelligenceCache.clear();
      expect(IntelligenceCache.size()).toBe(0);
    });
  });

  describe("2. RDAP Domain & IP Providers", () => {
    const mockRdapDomainJson = {
      objectClassName: "domain",
      handle: "DOM-12345",
      ldhName: "EXAMPLE.COM",
      status: ["clientTransferProhibited", "active"],
      events: [
        { eventAction: "registration", eventDate: "2015-08-14T07:00:00Z" },
        { eventAction: "expiration", eventDate: "2028-08-14T07:00:00Z" },
        { eventAction: "last changed", eventDate: "2023-08-14T07:00:00Z" },
      ],
      entities: [
        {
          roles: ["registrar"],
          vcardArray: [
            "vcard",
            [
              ["version", {}, "text", "4.0"],
              ["fn", {}, "text", "Example Registrar LLC"],
            ],
          ],
        },
        {
          roles: ["registrant"],
          vcardArray: [
            "vcard",
            [
              ["version", {}, "text", "4.0"],
              ["fn", {}, "text", "Redacted for Privacy"],
              ["org", {}, "text", "Privacy Protection Service"],
              ["adr", {}, "text", ["", "", "", "", "", "", "US"]],
            ],
          ],
        },
      ],
      nameservers: [{ ldhName: "ns1.example.com" }, { ldhName: "ns2.example.com" }],
      links: [{ rel: "self", href: "https://rdap.verisign.com/com/v1/domain/example.com" }],
    };

    it("parses domain registration, registrar, dates, and nameservers correctly", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRdapDomainJson,
      } as unknown as Response);

      const provider = new RdapDomainProvider();
      const result = await provider.execute(
        { type: "domain", value: "example.com" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      expect(result.findings.length).toBeGreaterThan(0);

      // Verify Registrar finding
      const regFinding = result.findings.find((f) => f.finding.includes("Registrar"));
      expect(regFinding).toBeDefined();
      expect(regFinding?.evidence).toContain("Example Registrar LLC");
      expect(regFinding?.nature).toBe("observed_fact");

      // Verify Age & Expiration findings
      const ageFinding = result.findings.find((f) => f.finding.includes("Domain Age"));
      expect(ageFinding).toBeDefined();
      expect(ageFinding?.severity).toBe("informational");

      // Verify Privacy Protection is informational and NOT marked as malicious
      const privacyFinding = result.findings.find((f) => f.finding.includes("Privacy-Protected"));
      expect(privacyFinding).toBeDefined();
      expect(privacyFinding?.severity).toBe("informational");
    });

    it("flags recently registered domains (<14 days) with appropriate heuristic severity", async () => {
      const recentDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
      const newDomainJson = {
        ...mockRdapDomainJson,
        events: [
          { eventAction: "registration", eventDate: recentDate },
          { eventAction: "expiration", eventDate: "2027-01-01T00:00:00Z" },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => newDomainJson,
      } as unknown as Response);

      const provider = new RdapDomainProvider();
      const result = await provider.execute(
        { type: "domain", value: "newly-created-suspicious.com" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      const newDomainFinding = result.findings.find((f) => f.id.includes("finding-rdap-new-domain"));
      expect(newDomainFinding).toBeDefined();
      expect(newDomainFinding?.severity).toBe("medium");
      expect(newDomainFinding?.evidence).toContain("less than 14 days ago");
    });

    it("handles RDAP upstream 404/errors gracefully without false malicious findings", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as unknown as Response);

      const provider = new RdapDomainProvider();
      const result = await provider.execute(
        { type: "domain", value: "nonexistent-domain-xyz999.com" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("error");
      expect(result.error).toContain("404");
      // Must NOT produce negative security findings
      expect(result.findings).toHaveLength(0);
      expect(result.evidence).toHaveLength(0);
    });

    it("parses RDAP IP network allocation correctly", async () => {
      const mockRdapIpJson = {
        objectClassName: "ip network",
        handle: "NET-1-1-1-0-24",
        startAddress: "1.1.1.0",
        endAddress: "1.1.1.255",
        ipVersion: "v4",
        name: "CLOUDFLARENET",
        country: "US",
        entities: [
          {
            roles: ["registrant"],
            vcardArray: [
              "vcard",
              [
                ["version", {}, "text", "4.0"],
                ["org", {}, "text", "Cloudflare, Inc."],
              ],
            ],
          },
        ],
        links: [{ rel: "self", href: "https://rdap.arin.net/registry/ip/1.1.1.0" }],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRdapIpJson,
      } as unknown as Response);

      const provider = new RdapIpProvider();
      const result = await provider.execute(
        { type: "ip", value: "1.1.1.1" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      const netFinding = result.findings.find((f) => f.finding.includes("IP Network"));
      expect(netFinding).toBeDefined();
      expect(netFinding?.evidence).toContain("CLOUDFLARENET");
      expect(netFinding?.severity).toBe("informational");
    });
  });

  describe("3. DNS-over-HTTPS (DoH) Provider", () => {
    it("resolves multiple DNS record types (A, CNAME, MX, NS, TXT) and correlates addresses", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("type=A")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [
                { name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" },
              ],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("type=CNAME")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [
                { name: "example.com", type: 5, TTL: 300, data: "canonical.example.com." },
              ],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("type=MX")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [
                { name: "example.com", type: 15, TTL: 300, data: "10 mail.example.com." },
              ],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("type=TXT")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [
                { name: "example.com", type: 16, TTL: 300, data: '"v=spf1 -all"' },
              ],
            }),
          } as unknown as Response;
        }
        return {
          ok: true,
          json: async () => ({ Status: 0, Answer: [] }),
        } as unknown as Response;
      });

      const provider = new DnsOverHttpsProvider();
      const result = await provider.execute(
        { type: "domain", value: "example.com" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      expect(result.metadata?.discoveredIps).toContain("93.184.216.34");
      expect(result.metadata?.cnames).toContain("canonical.example.com");

      // Verify SPF record finding
      const spfFinding = result.findings.find((f) => f.finding.includes("SPF"));
      expect(spfFinding).toBeDefined();
      expect(spfFinding?.evidence).toContain("v=spf1 -all");
    });

    it("detects loopback and RFC 1918 IPs in public DNS as objective heuristic anomalies", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("type=A")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [
                { name: "probe.local", type: 1, TTL: 60, data: "127.0.0.1" },
                { name: "probe.local", type: 1, TTL: 60, data: "192.168.1.1" },
              ],
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const provider = new DnsOverHttpsProvider();
      const result = await provider.execute(
        { type: "fqdn", value: "probe.local" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");
      const loopbackFinding = result.findings.find((f) => f.finding.includes("Loopback Interface"));
      expect(loopbackFinding).toBeDefined();
      expect(loopbackFinding?.severity).toBe("medium");

      const privateFinding = result.findings.find((f) => f.finding.includes("RFC 1918"));
      expect(privateFinding).toBeDefined();
      expect(privateFinding?.severity).toBe("low");
    });
  });

  describe("4. IP / ASN & Geolocation (IPinfo)", () => {
    it("resolves ASN, routing organization, reverse DNS, and labeled approximate geolocation", async () => {
      const mockIpinfo = {
        ip: "8.8.8.8",
        hostname: "dns.google",
        city: "Mountain View",
        region: "California",
        country: "US",
        loc: "37.4056,-122.0775",
        org: "AS15169 Google LLC",
        postal: "94043",
        timezone: "America/Los_Angeles",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockIpinfo,
      } as unknown as Response);

      const provider = new IpinfoProvider();
      const result = await provider.execute(
        { type: "ip", value: "8.8.8.8" },
        { userConsent: true, isSourceEnabled: true },
      );

      expect(result.status).toBe("success");

      // Verify ASN finding
      const asnFinding = result.findings.find((f) => f.finding.includes("Autonomous System"));
      expect(asnFinding).toBeDefined();
      expect(asnFinding?.evidence).toContain("AS15169");
      expect(asnFinding?.evidence).toContain("Google LLC");

      // Verify Reverse DNS finding
      const ptrFinding = result.findings.find((f) => f.finding.includes("Reverse DNS"));
      expect(ptrFinding).toBeDefined();
      expect(ptrFinding?.evidence).toContain("dns.google");

      // Verify Geolocation is explicitly labeled as Approximate Infrastructure Geolocation
      const geoFinding = result.findings.find((f) => f.finding.includes("Approximate Infrastructure Geolocation"));
      expect(geoFinding).toBeDefined();
      expect(geoFinding?.evidence).toContain("Notice: Geolocation reflects hosting infrastructure location");
      expect(geoFinding?.severity).toBe("informational");
    });
  });

  describe("5. Infrastructure Correlation & Graph Model", () => {
    it("correlates Domain -> DNS -> IP -> ASN -> Location into an investigation graph", () => {
      const mockResults = [
        {
          providerId: "rdap-domain",
          providerName: "RDAP Domain Registration",
          category: "rdap" as const,
          privacy: "direct" as const,
          target: { type: "domain" as const, value: "example.com" },
          queriedAt: Date.now(),
          executionTimeMs: 120,
          status: "success" as const,
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            domainIntel: {
              registrar: "MarkMonitor Inc.",
              nameservers: ["a.iana-servers.net", "b.iana-servers.net"],
              dns: [],
              statuses: ["active"],
              whoisRedacted: false,
              ageDays: 3000,
            },
          },
        },
        {
          providerId: "dns-over-https",
          providerName: "DNS-over-HTTPS",
          category: "dns" as const,
          privacy: "direct" as const,
          target: { type: "domain" as const, value: "example.com" },
          queriedAt: Date.now(),
          executionTimeMs: 80,
          status: "success" as const,
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            records: [{ type: "A", value: "93.184.216.34", ttl: 300 }],
            discoveredIps: ["93.184.216.34"],
            cnames: [],
            mailServers: [],
            nameservers: ["a.iana-servers.net"],
          },
        },
        {
          providerId: "ipinfo",
          providerName: "IPinfo",
          category: "asn" as const,
          privacy: "direct" as const,
          target: { type: "ip" as const, value: "93.184.216.34" },
          queriedAt: Date.now(),
          executionTimeMs: 90,
          status: "success" as const,
          findings: [],
          evidence: [],
          warnings: [],
          metadata: {
            hostIntel: {
              ip: "93.184.216.34",
              reverseDns: "93.184.216.34",
              asn: { number: 15133, organization: "EdgeCast Networks, Inc." },
              geolocation: { country: "US", region: "California", city: "Los Angeles" },
            },
          },
        },
      ];

      const correlated = correlateInfrastructure(mockResults, "example.com", "93.184.216.34");

      expect(correlated.domainIntel.registrar).toBe("MarkMonitor Inc.");
      expect(correlated.domainIntel.nameservers).toContain("a.iana-servers.net");
      expect(correlated.hostIntel).toHaveLength(1);
      expect(correlated.hostIntel[0].asn?.number).toBe(15133);

      // Verify Graph nodes and edges
      const nodeTypes = correlated.graph.nodes.map((n) => n.type);
      expect(nodeTypes).toContain("domain");
      expect(nodeTypes).toContain("registrar");
      expect(nodeTypes).toContain("nameserver");
      expect(nodeTypes).toContain("ip");
      expect(nodeTypes).toContain("asn");
      expect(nodeTypes).toContain("location");

      const edgeTypes = correlated.graph.edges.map((e) => e.type);
      expect(edgeTypes).toContain("registered_with");
      expect(edgeTypes).toContain("resolves_to");
      expect(edgeTypes).toContain("routed_by");
      expect(edgeTypes).toContain("located_in");
    });
  });

  describe("6. Multi-Stage Pipeline & Investigation Integration", () => {
    it("executes multi-stage pipeline: domain triggers DNS -> discovers IP -> resolves IPinfo", async () => {
      // Mock fetch responses for DoH, RDAP, and IPinfo
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("cloudflare-dns.com") && urlStr.includes("type=A")) {
          return {
            ok: true,
            json: async () => ({
              Status: 0,
              Answer: [{ name: "target-corp.com", type: 1, TTL: 300, data: "198.51.100.55" }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("rdap.org/domain")) {
          return {
            ok: true,
            json: async () => ({
              objectClassName: "domain",
              ldhName: "TARGET-CORP.COM",
              events: [{ eventAction: "registration", eventDate: "2020-01-01T00:00:00Z" }],
              entities: [{ roles: ["registrar"], vcardArray: ["vcard", [["fn", {}, "text", "Test Registrar"]]] }],
            }),
          } as unknown as Response;
        }
        if (urlStr.includes("ipinfo.io")) {
          return {
            ok: true,
            json: async () => ({
              ip: "198.51.100.55",
              org: "AS64496 Example Net Org",
              country: "US",
              city: "Austin",
            }),
          } as unknown as Response;
        }
        return { ok: true, json: async () => ({ Status: 0, Answer: [] }) } as unknown as Response;
      });

      const scan: ScanRecord = {
        id: "scan-multi-stage",
        content: "https://target-corp.com/login",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report, findings } = await investigationEngine.runInvestigation(scan, "case-test-1", {
        userConsent: true,
        sourceToggles: {
          "local-heuristics": true,
          "rdap-domain": true,
          "dns-over-https": true,
          "ipinfo": true,
        },
      });

      expect(report.status).toBe("complete");
      expect(report.domainIntel.registrar).toBe("Test Registrar");
      expect(report.hostIntel.length).toBeGreaterThanOrEqual(1);
      expect(report.hostIntel[0].asn?.organization).toBe("Example Net Org");

      // Verify active intelligence flags
      expect(report.intelligenceFlags.rdapEnabled).toBe(true);
      expect(report.intelligenceFlags.dnsEnabled).toBe(true);
      expect(report.intelligenceFlags.asnEnabled).toBe(true);
      expect(report.intelligenceFlags.geoEnabled).toBe(true);

      // Verify findings contains correlated facts
      const findingTitles = findings.map((f) => f.finding);
      expect(findingTitles.some((t) => t.includes("Registrar"))).toBe(true);
      expect(findingTitles.some((t) => t.includes("DNS Resolution"))).toBe(true);
      expect(findingTitles.some((t) => t.includes("Autonomous System"))).toBe(true);
    });

    it("respects privacy consent: blocks all external lookups when user consent is false", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      const scan: ScanRecord = {
        id: "scan-privacy-strict",
        content: "https://unconsented-example.com/checkout",
        type: "url",
        format: "QR_CODE",
        scannedAt: Date.now(),
      };

      const { report } = await investigationEngine.runInvestigation(scan, "case-privacy", {
        userConsent: false, // Explicitly no consent
      });

      // No external fetch should have occurred
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(report.intelligenceFlags.rdapEnabled).toBe(false);
      expect(report.intelligenceFlags.dnsEnabled).toBe(false);
    });
  });
});
