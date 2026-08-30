import type {
  InvestigationFinding,
  LocalPayloadAnalysisResult,
  TargetCollection,
} from "./types";

export function calculateShannonEntropy(str: string): number {
  if (!str || str.length === 0) return 0;
  const len = str.length;
  const freq = new Map<string, number>();
  for (let i = 0; i < len; i++) {
    const char = str[i];
    freq.set(char, (freq.get(char) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

export function analyzeCharacterDistribution(str: string) {
  let asciiPrintable = 0;
  let nonAscii = 0;
  let whitespace = 0;
  let controlChars = 0;

  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || code === 32) {
      whitespace++;
    } else if (code < 32 || code === 127) {
      controlChars++;
    } else if (code > 127) {
      nonAscii++;
    } else {
      asciiPrintable++;
    }
  }

  return {
    asciiPrintable,
    nonAscii,
    whitespace,
    controlChars,
  };
}

export function analyzePayload(raw: string): {
  metrics: LocalPayloadAnalysisResult;
  targets: TargetCollection;
  findings: InvestigationFinding[];
} {
  const now = Date.now();
  const findings: InvestigationFinding[] = [];
  const anomalies: string[] = [];
  const detectedEncodings: string[] = [];
  const size = raw.length;
  const entropy = calculateShannonEntropy(raw.slice(0, 1000));
  const charDist = analyzeCharacterDistribution(raw);

  // 1. Basic Payload Metrics Finding (Observed Fact)
  findings.push({
    id: "finding-payload-meta",
    category: "payload",
    nature: "observed_fact",
    finding: `Payload size: ${size} chars · Entropy: ${entropy}`,
    severity: "informational",
    evidence: `Decoded raw payload has ${size} characters across ${charDist.asciiPrintable} ASCII printable, ${charDist.nonAscii} non-ASCII, and ${charDist.controlChars} control characters.`,
    confidence: 1.0,
    source: "payload-analyzer",
    timestamp: now,
    metadata: {
      size,
      entropy,
      charDistribution: charDist,
    },
  });

  // 2. Dangerous Protocol Check
  const dangerousProtocolRegex = /^(javascript:|data:|vbscript:|file:|mhtml:|ms-excel:|ms-word:|ms-powerpoint:|ms-access:|intent:|blob:|jar:)/i;
  const usesDangerousProtocol = dangerousProtocolRegex.test(raw.trim());
  if (usesDangerousProtocol) {
    const matchedProtocol = raw.trim().match(dangerousProtocolRegex)?.[0] ?? "unknown";
    anomalies.push("dangerous-protocol");
    findings.push({
      id: `finding-proto-danger-${matchedProtocol}`,
      category: "payload",
      nature: "heuristic_indicator",
      finding: `Dangerous executable protocol detected: ${matchedProtocol}`,
      severity: "critical",
      evidence: `The scanned payload initiates a ${matchedProtocol} scheme which can directly trigger browser script execution, file exfiltration, or native application abuse without standard security boundaries.`,
      confidence: 0.95,
      source: "payload-analyzer",
      timestamp: now,
      metadata: { protocol: matchedProtocol },
      remediation: "Do not execute or open this payload in a web browser or operating system shell.",
    });
  }

  // 3. Embedded Credentials Check
  const credsRegex = /^[a-z][a-z0-9+.-]*:\/\/([^:\s@/]+):([^@\s/]+)@/i;
  const hasCredentialsEmbedded = credsRegex.test(raw.trim());
  if (hasCredentialsEmbedded) {
    anomalies.push("embedded-credentials");
    findings.push({
      id: "finding-creds-embedded",
      category: "payload",
      nature: "heuristic_indicator",
      finding: "Embedded authentication credentials detected in URI",
      severity: "high",
      evidence: "Payload contains username and password segments inside the URI authority section. This is a common quishing technique to simulate pre-authenticated sessions or deceive users.",
      confidence: 0.9,
      source: "payload-analyzer",
      timestamp: now,
      metadata: { embeddedAuth: true },
      remediation: "Inspect whether credentials are exposed or if this link masquerades as a legitimate portal.",
    });
  }

  // 4. Obfuscation & Encoding Anomalies
  const percentMatches = raw.match(/%[0-9a-fA-F]{2}/g) || [];
  if (percentMatches.length > 5) {
    detectedEncodings.push("percent-encoding");
    if (percentMatches.length > 15 || /%25[0-9a-fA-F]{2}/i.test(raw)) {
      anomalies.push("heavy-percent-encoding");
      findings.push({
        id: "finding-obf-percent",
        category: "payload",
        nature: "heuristic_indicator",
        finding: "Heavy or multi-layer URL encoding detected",
        severity: "medium",
        evidence: `Payload contains ${percentMatches.length} percent-encoded octets. Multiple layers of encoding (e.g. %25) can be used to bypass static security filters.`,
        confidence: 0.8,
        source: "payload-analyzer",
        timestamp: now,
        metadata: { percentCount: percentMatches.length },
      });
    }
  }

  // Unicode & Hex escape sequences
  const hasUnicodeEscapes = /\\u[0-9a-fA-F]{4}/i.test(raw);
  const hasHexEscapes = /\\x[0-9a-fA-F]{2}/i.test(raw);
  if (hasUnicodeEscapes || hasHexEscapes) {
    anomalies.push("character-escapes");
    detectedEncodings.push(hasUnicodeEscapes ? "unicode-escapes" : "hex-escapes");
    findings.push({
      id: "finding-obf-escapes",
      category: "payload",
      nature: "heuristic_indicator",
      finding: "Raw string escape sequences present (\\u or \\x)",
      severity: "medium",
      evidence: "Payload includes literal escape sequences commonly found in injected scripts, JSON payloads, or obfuscated payloads.",
      confidence: 0.75,
      source: "payload-analyzer",
      timestamp: now,
    });
  }

  // Zero-width and BiDi Override Characters
  const zeroWidthRegex = /[\u200B-\u200D\uFEFF]/;
  const bidiOverrideRegex = /[\u202E\u202D\u2066\u2067\u2068]/;
  if (zeroWidthRegex.test(raw)) {
    anomalies.push("zero-width-characters");
    findings.push({
      id: "finding-obf-zerowidth",
      category: "payload",
      nature: "heuristic_indicator",
      finding: "Invisible zero-width characters detected in payload",
      severity: "high",
      evidence: "Payload contains zero-width Unicode characters that are invisible to humans but alter string comparison, hashing, or regex matching.",
      confidence: 0.9,
      source: "payload-analyzer",
      timestamp: now,
    });
  }
  if (bidiOverrideRegex.test(raw)) {
    anomalies.push("bidi-override");
    findings.push({
      id: "finding-obf-bidi",
      category: "payload",
      nature: "heuristic_indicator",
      finding: "Right-to-Left (BiDi) override character detected",
      severity: "critical",
      evidence: "Payload includes bidirectional text override characters (e.g. U+202E) typically used to disguise executable file extensions or reverse apparent domain names.",
      confidence: 0.95,
      source: "payload-analyzer",
      timestamp: now,
    });
  }

  // 5. Target Entity Extraction (Wi-Fi, vCard, Crypto, Payment, Deep Links)
  const targets = extractTargetEntities(raw);

  // 6. Wi-Fi Configuration Security Analysis
  if (targets.wifiConfigs && targets.wifiConfigs.length > 0) {
    for (const wifi of targets.wifiConfigs) {
      const auth = (wifi.authType || "").toUpperCase();
      if (auth === "NOPASS" || auth === "" || auth === "NONE") {
        findings.push({
          id: `finding-wifi-open-${wifi.ssid}-${now}`,
          category: "infrastructure",
          nature: "observed_fact",
          finding: `Unencrypted / Open Wi-Fi Network Config: "${wifi.ssid}"`,
          severity: "medium",
          evidence: `The scanned QR code prompts connecting to an unencrypted Wi-Fi network with no password. Open networks allow nearby adversaries to sniff unencrypted traffic or execute captive portal attacks.`,
          confidence: 0.95,
          source: "payload-analyzer",
          timestamp: now,
          metadata: { ssid: wifi.ssid, authType: "OPEN" },
          remediation: "Do not join unknown public open Wi-Fi networks.",
        });
      } else if (auth === "WEP") {
        findings.push({
          id: `finding-wifi-wep-${wifi.ssid}-${now}`,
          category: "infrastructure",
          nature: "observed_fact",
          finding: `Deprecated & Broken WEP Encryption Configured: "${wifi.ssid}"`,
          severity: "medium",
          evidence: `Network uses WEP encryption which is cryptographically broken and easily cracked within minutes.`,
          confidence: 0.95,
          source: "payload-analyzer",
          timestamp: now,
          metadata: { ssid: wifi.ssid, authType: "WEP" },
        });
      } else {
        findings.push({
          id: `finding-wifi-secure-${wifi.ssid}-${now}`,
          category: "infrastructure",
          nature: "observed_fact",
          finding: `Wi-Fi Network Configuration: "${wifi.ssid}" (${auth})`,
          severity: "informational",
          evidence: `Payload configures auto-connection to Wi-Fi SSID "${wifi.ssid}" with ${auth} authentication.${wifi.hidden ? " Network is flagged as hidden." : ""}`,
          confidence: 1.0,
          source: "payload-analyzer",
          timestamp: now,
          metadata: { ssid: wifi.ssid, authType: auth, hidden: wifi.hidden },
        });
      }
    }
  }

  // 7. Payment & Cryptocurrency URI Analysis
  if (targets.cryptoAddresses.length > 0) {
    for (const crypto of targets.cryptoAddresses) {
      findings.push({
        id: `finding-crypto-${crypto.currency}-${now}`,
        category: "payload",
        nature: "observed_fact",
        finding: `Cryptocurrency Destination Address: ${crypto.currency}`,
        severity: "informational",
        evidence: `Payload specifies a direct ${crypto.currency} destination address: ${crypto.address}. Crypto transactions are irreversible.`,
        confidence: 1.0,
        source: "payload-analyzer",
        timestamp: now,
        metadata: { currency: crypto.currency, address: crypto.address },
      });
    }
  }

  // 8. Contact Card (vCard) Analysis
  if (/BEGIN:VCARD/i.test(raw)) {
    findings.push({
      id: `finding-vcard-contact-${now}`,
      category: "payload",
      nature: "observed_fact",
      finding: "Contact Card (vCard) Payload Detected",
      severity: "informational",
      evidence: `Payload contains structured vCard contact info.${targets.urls.length > 0 ? ` Contains embedded website URL(s): ${targets.urls.map((u) => u.domain || u.fqdn).join(", ")}.` : ""}`,
      confidence: 1.0,
      source: "payload-analyzer",
      timestamp: now,
      metadata: { emailsCount: targets.emails.length, phonesCount: targets.phoneNumbers.length },
    });
  }

  // 9. Oversized Payload Volume Check
  if (size > 1500) {
    anomalies.push("oversized-payload");
    findings.push({
      id: `finding-oversized-${now}`,
      category: "payload",
      nature: "observed_fact",
      finding: `Large payload volume (${size} bytes)`,
      severity: "informational",
      evidence: `The barcode contains an unusually high data density (${size} bytes) compared to standard single-record barcodes.`,
      confidence: 1.0,
      source: "payload-analyzer",
      timestamp: now,
    });
  }

  const hasIps = targets.ips.length > 0;
  if (hasIps) {
    anomalies.push("ip-address-present");
  }

  const hasObfuscation =
    detectedEncodings.length > 0 ||
    anomalies.includes("zero-width-characters") ||
    anomalies.includes("bidi-override");

  return {
    metrics: {
      size,
      entropy,
      hasCredentialsEmbedded,
      hasIps,
      hasObfuscation,
      usesDangerousProtocol,
      detectedEncodings,
      anomalies,
      characterDistribution: charDist,
    },
    targets,
    findings,
  };
}

export function extractTargetEntities(raw: string): TargetCollection {
  const targets: TargetCollection = {
    urls: [],
    domains: [],
    hosts: [],
    ips: [],
    emails: [],
    phoneNumbers: [],
    cryptoAddresses: [],
    productCodes: [],
    paymentIdentifiers: [],
  };

  // A. Extract IPv4 & IPv6
  const ipv4Regex = /\b(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}\b/g;
  const ipv4Matches = raw.match(ipv4Regex) || [];
  targets.ips.push(...Array.from(new Set(ipv4Matches)));

  // B. Extract Emails
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  const emailMatches = raw.match(emailRegex) || [];
  targets.emails.push(...Array.from(new Set(emailMatches.map((e) => e.toLowerCase()))));

  // C. Extract Crypto Addresses & URIs
  // Bitcoin URI & address
  const btcUriMatch = raw.match(/bitcoin:([a-zA-Z0-9]{25,62})/i);
  if (btcUriMatch) {
    targets.cryptoAddresses.push({ currency: "BTC", address: btcUriMatch[1] });
  } else {
    const btcMatches = raw.match(/\b(bc1[a-z0-9]{39,59}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g) || [];
    for (const btc of btcMatches) {
      targets.cryptoAddresses.push({ currency: "BTC", address: btc });
    }
  }

  // Ethereum URI & address
  const ethUriMatch = raw.match(/ethereum:(0x[a-fA-F0-9]{40})/i);
  if (ethUriMatch) {
    targets.cryptoAddresses.push({ currency: "ETH", address: ethUriMatch[1] });
  } else {
    const ethMatches = raw.match(/\b0x[a-fA-F0-9]{40}\b/g) || [];
    for (const eth of ethMatches) {
      targets.cryptoAddresses.push({ currency: "ETH", address: eth });
    }
  }

  // Solana URI & address
  const solUriMatch = raw.match(/solana:([1-9A-HJ-NP-Za-km-z]{32,44})/i);
  if (solUriMatch) {
    targets.cryptoAddresses.push({ currency: "SOL", address: solUriMatch[1] });
  }

  // D. Extract Wi-Fi Configuration
  if (/^WIFI:/i.test(raw)) {
    const ssidMatch = raw.match(/S:([^;]+)/i);
    const authMatch = raw.match(/T:([^;]+)/i);
    const hiddenMatch = raw.match(/H:(true|false)/i);
    if (ssidMatch) {
      targets.wifiConfigs = [
        {
          ssid: ssidMatch[1],
          authType: authMatch ? authMatch[1] : "WPA",
          hidden: hiddenMatch ? hiddenMatch[1] === "true" : false,
        },
      ];
    }
  }

  // E. Extract UPI / Payment Identifiers
  if (/^upi:\/\/pay/i.test(raw) || /^sepa:/i.test(raw) || /^iban:/i.test(raw)) {
    targets.paymentIdentifiers?.push(raw);
  }

  // F. Extract Product Codes (EAN / UPC / GTIN)
  if (/^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(raw.trim())) {
    targets.productCodes.push(raw.trim());
  }

  // G. Phone numbers & SMS
  const telMatch = raw.match(/(?:tel:|smsto:)?(\+?[0-9\s\-()]{7,20})/i);
  if (telMatch && !targets.productCodes.includes(raw.trim()) && !raw.includes("WIFI:") && !raw.includes("BEGIN:VCARD")) {
    const cleaned = telMatch[1].replace(/[\s\-()]/g, "");
    if (cleaned.length >= 7 && cleaned.length <= 15 && /^\+?[0-9]+$/.test(cleaned)) {
      targets.phoneNumbers.push(cleaned);
    }
  }

  // H. vCard Embedded URLs & Emails extraction
  if (/BEGIN:VCARD/i.test(raw)) {
    const vcardUrls = raw.match(/URL(?:;[^:]+)?:(https?:\/\/[^\r\n]+)/gi);
    if (vcardUrls) {
      for (const u of vcardUrls) {
        const cleanUrl = u.replace(/^URL(?:;[^:]+)?:/i, "").trim();
        try {
          const parsed = new URL(cleanUrl);
          targets.urls.push({
            scheme: parsed.protocol.replace(":", ""),
            domain: parsed.hostname,
            fqdn: parsed.hostname,
            subdomains: [],
            tld: "",
            path: parsed.pathname,
            query: parsed.search,
            fragment: parsed.hash,
            isIdn: false,
            isIp: false,
            isShortlinkLike: false,
          });
          if (!targets.domains.includes(parsed.hostname)) {
            targets.domains.push(parsed.hostname);
          }
        } catch {
          // ignore malformed embedded vcard url
        }
      }
    }
  }

  return targets;
}
