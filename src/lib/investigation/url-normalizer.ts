import type { UrlPayloadSummary } from "@/lib/scan/types";
import type { InvestigationFinding, NormalizedUrlResult } from "./types";
import { computeEvidenceFingerprint } from "./evidence-integrity";

// Multi-part TLD suffixes to correctly identify apex domains
const MULTI_PART_TLDS = new Set([
  "co.uk", "org.uk", "gov.uk", "ac.uk", "me.uk",
  "com.au", "net.au", "org.au", "edu.au", "gov.au",
  "co.nz", "net.nz", "org.nz", "govt.nz",
  "co.jp", "ne.jp", "or.jp", "ac.jp",
  "co.in", "net.in", "org.in", "gov.in", "ac.in",
  "com.br", "net.br", "org.br", "gov.br",
  "com.cn", "net.cn", "org.cn", "gov.cn",
  "com.sg", "net.sg", "org.sg", "edu.sg",
  "co.za", "org.za", "web.za",
  "com.tr", "net.tr", "org.tr",
  "com.mx", "org.mx", "gob.mx",
]);

const SUSPICIOUS_REDIRECT_PARAMS = new Set([
  "url", "redirect", "redirect_url", "redirect_to", "return", "return_to",
  "returnurl", "dest", "destination", "target", "next", "link", "r", "u",
  "to", "out", "goto", "forward", "view",
]);

const SENSITIVE_QUERY_PARAMS = new Set([
  "token", "auth", "access_token", "apikey", "api_key", "key",
  "secret", "jwt", "session", "pass", "password", "signature", "sig",
]);

export function parseIpv4Notation(host: string): {
  isIp: boolean;
  canonicalIp?: string;
  isPrivate?: boolean;
  isLoopback?: boolean;
  isLinkLocal?: boolean;
  isSpecial?: boolean;
} {
  const cleanHost = host.trim().replace(/^\[|\]$/g, "");

  // Dotted decimal
  const dottedMatch = cleanHost.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  let ipNum: number | null = null;

  if (dottedMatch) {
    const octets = dottedMatch.slice(1).map(Number);
    if (octets.every((o) => o >= 0 && o <= 255)) {
      ipNum = ((octets[0] << 24) >>> 0) + ((octets[1] << 16) >>> 0) + ((octets[2] << 8) >>> 0) + (octets[3] >>> 0);
    }
  } else if (/^0x[0-9a-fA-F]{1,8}$/i.test(cleanHost)) {
    // Hex integer e.g. 0x7f000001
    ipNum = parseInt(cleanHost, 16);
  } else if (/^\d{8,10}$/.test(cleanHost)) {
    // Integer / DWORD e.g. 2130706433
    const parsed = Number(cleanHost);
    if (parsed >= 0 && parsed <= 4294967295) {
      ipNum = parsed;
    }
  } else if (/^0[0-7]{1,11}$/.test(cleanHost)) {
    // Octal integer e.g. 017700000001
    ipNum = parseInt(cleanHost, 8);
  }

  if (ipNum === null || isNaN(ipNum)) {
    // Check IPv6
    if (cleanHost.includes(":") && /^[0-9a-fA-F:]+$/.test(cleanHost)) {
      const isLoopback = cleanHost === "::1" || cleanHost === "0:0:0:0:0:0:0:1";
      const isLinkLocal = cleanHost.toLowerCase().startsWith("fe80:");
      return {
        isIp: true,
        canonicalIp: cleanHost,
        isLoopback,
        isLinkLocal,
      };
    }
    return { isIp: false };
  }

  const o1 = (ipNum >>> 24) & 255;
  const o2 = (ipNum >>> 16) & 255;
  const o3 = (ipNum >>> 8) & 255;
  const o4 = ipNum & 255;
  const canonicalIp = `${o1}.${o2}.${o3}.${o4}`;

  // Private RFC 1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  const isPrivate =
    o1 === 10 ||
    (o1 === 172 && o2 >= 16 && o2 <= 31) ||
    (o1 === 192 && o2 === 168);

  // Loopback (127.0.0.0/8)
  const isLoopback = o1 === 127;

  // Link-Local (169.254.0.0/16)
  const isLinkLocal = o1 === 169 && o2 === 254;

  // Special / Broadcast / Multicast
  const isSpecial = o1 === 0 || (o1 >= 224 && o1 <= 239) || (o1 === 255 && o2 === 255 && o3 === 255 && o4 === 255);

  return {
    isIp: true,
    canonicalIp,
    isPrivate,
    isLoopback,
    isLinkLocal,
    isSpecial,
  };
}

export function extractDomainParts(fqdn: string): {
  domain: string;
  subdomains: string[];
  tld: string;
} {
  const parts = fqdn.toLowerCase().split(".");
  if (parts.length <= 1) {
    return { domain: fqdn, subdomains: [], tld: "" };
  }

  // Check 2-level TLD
  if (parts.length >= 3) {
    const twoLevel = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
    if (MULTI_PART_TLDS.has(twoLevel)) {
      const domain = `${parts[parts.length - 3]}.${twoLevel}`;
      const subdomains = parts.slice(0, parts.length - 3);
      return { domain, subdomains, tld: twoLevel };
    }
  }

  const tld = parts[parts.length - 1];
  const domain = `${parts[parts.length - 2]}.${tld}`;
  const subdomains = parts.slice(0, parts.length - 2);
  return { domain, subdomains, tld };
}

export function normalizeAndAnalyzeUrl(rawUrl: string): {
  result: NormalizedUrlResult;
  findings: InvestigationFinding[];
} {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];

  // Input bound protection (max 20,000 chars)
  const boundedInput = typeof rawUrl === "string" ? rawUrl.slice(0, 20000) : "";
  const trimmed = boundedInput.trim();

  let parsed: URL;
  try {
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
      parsed = new URL(trimmed);
    } else {
      parsed = new URL(`http://${trimmed}`);
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Failed to parse URI structure";
    const invalidFinding: InvestigationFinding = {
      id: `finding-url-invalid-${now}`,
      category: "url",
      nature: "observed_fact",
      finding: "Malformed URL syntax",
      severity: "low",
      evidence: `The string cannot be parsed according to RFC 3986 standard: ${errorMsg}`,
      confidence: 1.0,
      source: "url-normalizer",
      timestamp: now,
    };
    invalidFinding.fingerprint = computeEvidenceFingerprint(invalidFinding);

    return {
      result: {
        original: rawUrl,
        normalized: rawUrl,
        summary: {
          scheme: "",
          domain: "",
          fqdn: "",
          subdomains: [],
          tld: "",
          path: "",
          query: "",
          fragment: "",
          isIdn: false,
          isIp: false,
          isShortlinkLike: false,
        },
        isValid: false,
        parseError: errorMsg,
        suspiciousQueryParams: [],
      },
      findings: [invalidFinding],
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const isIdn = /xn--/.test(hostname);
  const ipInfo = parseIpv4Notation(hostname);
  const domainParts = ipInfo.isIp
    ? { domain: hostname, subdomains: [], tld: "" }
    : extractDomainParts(hostname);

  const portNumber = parsed.port ? Number(parsed.port) : undefined;
  const isHttp = parsed.protocol === "http:";

  // 1. Observed URL Properties
  const structureFinding: InvestigationFinding = {
    id: `finding-url-structure-${hostname}`,
    category: "url",
    nature: "observed_fact",
    finding: `Target: ${parsed.protocol}//${hostname}${parsed.pathname}`,
    severity: "informational",
    evidence: `Normalized URL scheme: ${parsed.protocol.replace(":", "")}, Host: ${hostname}, Domain: ${domainParts.domain}, Path: ${parsed.pathname || "/"}`,
    confidence: 1.0,
    source: "url-normalizer",
    timestamp: now,
    metadata: {
      scheme: parsed.protocol.replace(":", ""),
      host: hostname,
      domain: domainParts.domain,
      subdomains: domainParts.subdomains,
      port: portNumber,
      isIp: ipInfo.isIp,
    },
  };
  structureFinding.fingerprint = computeEvidenceFingerprint(structureFinding);
  findings.push(structureFinding);

  // 2. IP as Host Indicator
  if (ipInfo.isIp) {
    if (ipInfo.isPrivate || ipInfo.isLoopback || ipInfo.isLinkLocal) {
      const privFinding: InvestigationFinding = {
        id: `finding-url-private-ip-${ipInfo.canonicalIp}`,
        category: "infrastructure",
        nature: "observed_fact",
        finding: `Target points to private/internal network IP (${ipInfo.canonicalIp})`,
        severity: "medium",
        evidence: `URL points to an unroutable RFC 1918 private address or loopback (${ipInfo.canonicalIp}). In barcode payloads, this is often used in internal network attacks (SSRF) or router administration exploits.`,
        confidence: 0.95,
        source: "url-normalizer",
        timestamp: now,
        metadata: { ip: ipInfo.canonicalIp, scope: "private" },
      };
      privFinding.fingerprint = computeEvidenceFingerprint(privFinding);
      findings.push(privFinding);
    } else {
      const rawIpFinding: InvestigationFinding = {
        id: `finding-url-raw-ip-${ipInfo.canonicalIp}`,
        category: "url",
        nature: "heuristic_indicator",
        finding: `URL uses raw IP host instead of domain name (${ipInfo.canonicalIp})`,
        severity: "medium",
        evidence: `Host is directly addressed via IP ${ipInfo.canonicalIp} instead of a registered domain name, bypassing DNS reputation mechanisms.`,
        confidence: 0.85,
        source: "url-normalizer",
        timestamp: now,
        metadata: { ip: ipInfo.canonicalIp },
      };
      rawIpFinding.fingerprint = computeEvidenceFingerprint(rawIpFinding);
      findings.push(rawIpFinding);
    }
  }

  // 3. Internationalized Domain Name (Punycode / IDN)
  if (isIdn) {
    const idnFinding: InvestigationFinding = {
      id: `finding-url-punycode-${hostname}`,
      category: "domain",
      nature: "heuristic_indicator",
      finding: `Punycode / IDN encoding detected (${hostname})`,
      severity: "medium",
      evidence: "Host contains 'xn--' prefix indicating internationalized Unicode characters. Punycode is frequently leveraged in homograph attacks to impersonate legitimate brand domains with visually identical Cyrillic or Greek glyphs.",
      confidence: 0.85,
      source: "url-normalizer",
      timestamp: now,
      metadata: { fqdn: hostname },
      remediation: "Verify the Unicode decoding to check if latin characters are substituted with foreign script equivalents.",
    };
    idnFinding.fingerprint = computeEvidenceFingerprint(idnFinding);
    findings.push(idnFinding);
  }

  // 4. Calibrated Port Check
  if (portNumber && portNumber !== 80 && portNumber !== 443) {
    const isStandardAltPort = [8080, 8443, 3000, 8000, 8008, 5000].includes(portNumber);
    const isDangerousPort = [21, 22, 23, 25, 53, 110, 135, 139, 445, 1433, 3306, 3389, 5900].includes(portNumber);

    const portFinding: InvestigationFinding = {
      id: `finding-url-nonstandard-port-${portNumber}`,
      category: "infrastructure",
      nature: "observed_fact",
      finding: `Target port :${portNumber}`,
      severity: isDangerousPort ? "high" : isStandardAltPort ? "informational" : "low",
      evidence: `Target specifies an explicit port :${portNumber}. ${isDangerousPort ? "This port is associated with administrative or non-HTTP services." : isStandardAltPort ? "Standard alternate web service/development port." : "Standard web traffic typically routes through 80/443."}`,
      confidence: 0.9,
      source: "url-normalizer",
      timestamp: now,
      metadata: { port: portNumber, dangerous: isDangerousPort, standardAlt: isStandardAltPort },
    };
    portFinding.fingerprint = computeEvidenceFingerprint(portFinding);
    findings.push(portFinding);
  }

  // 5. Query String Parameter Analysis
  const suspiciousParams: { key: string; value: string; reason: string }[] = [];
  parsed.searchParams.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (SUSPICIOUS_REDIRECT_PARAMS.has(lowerKey)) {
      suspiciousParams.push({
        key,
        value,
        reason: "Potential open redirect or destination forwarding parameter",
      });
      const redFinding: InvestigationFinding = {
        id: `finding-url-redirect-param-${key}`,
        category: "behavior",
        nature: "heuristic_indicator",
        finding: `Destination forwarding parameter: ?${key}=`,
        severity: "low",
        evidence: `URL contains a parameter (?${key}=) that commonly specifies an downstream destination URL. This can be abused for open redirects.`,
        confidence: 0.75,
        source: "url-normalizer",
        timestamp: now,
        metadata: { paramKey: key, paramValue: value.slice(0, 100) },
      };
      redFinding.fingerprint = computeEvidenceFingerprint(redFinding);
      findings.push(redFinding);
    }

    if (SENSITIVE_QUERY_PARAMS.has(lowerKey)) {
      suspiciousParams.push({
        key,
        value,
        reason: "Potential authentication token or secret exposed in query string",
      });
      const tokFinding: InvestigationFinding = {
        id: `finding-url-token-param-${key}`,
        category: "payload",
        nature: "observed_fact",
        finding: `Authentication / secret parameter present in URL: ?${key}=`,
        severity: "medium",
        evidence: `Parameter ?${key}= appears to contain a security token or credential. URLs in QR codes can be logged by cameras, proxies, and browser histories.`,
        confidence: 0.85,
        source: "url-normalizer",
        timestamp: now,
      };
      tokFinding.fingerprint = computeEvidenceFingerprint(tokFinding);
      findings.push(tokFinding);
    }
  });

  // 6. Path Traversal & Dot Segment Anomaly
  if (/\.\.[/\\]|%2e%2e[/\\]/i.test(parsed.pathname) || /\/\/+/.test(parsed.pathname)) {
    const travFinding: InvestigationFinding = {
      id: "finding-url-path-traversal",
      category: "url",
      nature: "heuristic_indicator",
      finding: "Suspicious path formatting (redundant slashes or directory traversal)",
      severity: "medium",
      evidence: `Path segment contains redundant slashes or '..' sequences (${parsed.pathname}). This is commonly seen in directory traversal attempts or WAF bypass techniques.`,
      confidence: 0.8,
      source: "url-normalizer",
      timestamp: now,
    };
    travFinding.fingerprint = computeEvidenceFingerprint(travFinding);
    findings.push(travFinding);
  }

  // 7. Plaintext HTTP Alert (if not local)
  if (isHttp && !ipInfo.isLoopback && !ipInfo.isPrivate) {
    const httpFinding: InvestigationFinding = {
      id: "finding-url-plaintext-http",
      category: "infrastructure",
      nature: "observed_fact",
      finding: "Unencrypted transport protocol (HTTP)",
      severity: "low",
      evidence: "Communication with this host is unencrypted, rendering all exchanged data susceptible to local Wi-Fi sniffing and adversary-in-the-middle tampering.",
      confidence: 0.95,
      source: "url-normalizer",
      timestamp: now,
    };
    httpFinding.fingerprint = computeEvidenceFingerprint(httpFinding);
    findings.push(httpFinding);
  }

  const normalizedSummary: UrlPayloadSummary = {
    scheme: parsed.protocol.replace(":", ""),
    domain: domainParts.domain,
    fqdn: hostname,
    subdomains: domainParts.subdomains,
    tld: domainParts.tld,
    port: portNumber,
    path: parsed.pathname,
    query: parsed.search,
    fragment: parsed.hash,
    isIdn,
    isIp: ipInfo.isIp,
    isShortlinkLike: domainParts.domain.length <= 8,
  };

  return {
    result: {
      original: rawUrl,
      normalized: parsed.toString(),
      summary: normalizedSummary,
      parsedUrl: parsed,
      isValid: true,
      ipHostInfo: ipInfo,
      suspiciousQueryParams: suspiciousParams,
    },
    findings,
  };
}
