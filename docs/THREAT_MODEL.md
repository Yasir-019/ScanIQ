# ScanIQ Community — Threat Model & Security Verification Record

**Version:** 1.0.0 (Community Edition)  
**Methodology:** STRIDE / OWASP ASVS 5.0 / OWASP Threat Modeling Guidance  
**Scope:** Client-side Web Application, Scanner Ingestion, Local Heuristic Engine, BYOK Intelligence Adapters, Persistent IndexedDB Storage, PWA Service Worker, and Export System.

---

## 1. System Overview & Trust Boundaries

```
[ UNTRUSTED ZONE ]
  ┌────────────────────────────────────────────────────────────┐
  │  • Physical/Digital QR Codes & Barcodes                    │
  │  • Uploaded PNG/JPG/WebP/SVG Images                        │
  │  • Clipboard Content & Pasted Strings                      │
  │  • External Threat Intelligence Upstream APIs              │
  └─────────────────────────────┬──────────────────────────────┘
                                │
════════════════════════════════╪════════════════════════════════════ [ TB-1: Ingestion & Decode Boundary ]
                                │
[ LOCAL APPLICATION RUNTIME (Browser Sandbox) ]
  ┌─────────────────────────────▼──────────────────────────────┐
  │ 1. Multi-Input Normalization & ZXing Decoder               │
  │    (Strict length limits, safe text decoding)              │
  ├────────────────────────────────────────────────────────────┤
  │ 2. Heuristic Analysis Engine                               │
  │    (Shannon entropy, Punycode, RFC 3986, dangerous schemes)│
  ├────────────────────────────────────────────────────────────┤
  │ 3. BYOK Credential Store & Sanitizer                       │
  │    (Headers-only auth, secret redaction)                   │
  └─────────────────────────────┬──────────────────────────────┘
                                │
════════════════════════════════╪════════════════════════════════════ [ TB-2: External Network & Intranet Boundary ]
                                │
  ┌─────────────────────────────▼──────────────────────────────┐
  │ 4. Controlled Outbound OSINT Adapters                      │
  │    (RFC 1918 / Loopback interception, strict HTTPS, DoH)   │
  └─────────────────────────────┬──────────────────────────────┘
                                │
════════════════════════════════╪════════════════════════════════════ [ TB-3: Local Storage & Export Boundary ]
                                │
  ┌─────────────────────────────▼──────────────────────────────┐
  │ 5. IndexedDB Storage (Dexie) & SHA-256 Digest Reports      │
  │    (Local-only cases, scrubbed JSON / PDF exports)         │
  └────────────────────────────────────────────────────────────┘
```

---

## 2. Sensitive Asset Inventory

| Asset ID | Asset Name | Description | Sensitivity |
| :--- | :--- | :--- | :---: |
| **A-1** | **BYOK API Credentials** | User-configured API tokens (VirusTotal, AbuseIPDB, URLScan, SafeBrowsing, IPinfo). | **CRITICAL** |
| **A-2** | **Investigation Cases & Notes** | Analyst case files, extracted IOCs, investigation dossiers, and analyst annotations. | **HIGH** |
| **A-3** | **Host / Browser Integrity** | Prevention of client-side code execution, XSS, or unauthorized camera/hardware access. | **HIGH** |
| **A-4** | **Privacy & Network Secrecy** | Preventing unauthorized data leakage, unintended outbound queries, or telemetry. | **HIGH** |
| **A-5** | **Evidence Integrity & Provenance** | Ensuring reported findings and threat scores cannot be silently tampered with. | **MEDIUM** |

---

## 3. STRIDE Threat Evaluation & Verification Matrix

### 1. Spoofing (S)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-S1** | **Brand Impersonation / Typosquatting:** Adversary crafts lookalike domain QR code (e.g. `chase-secure-login.com`, `xn--...`). | High | Levenshtein distance brand matching, Punycode/IDN homoglyph flagging, and visual severity badges. | **VERIFIED** |
| **T-S2** | **Captive Portal / Rogue Wi-Fi:** Malicious Wi-Fi QR code simulates open corporate network. | Medium | Automatic detection of open/unencrypted Wi-Fi configurations (`T:NONE`, `T:NOPASS`) and deprecated `WEP`. | **VERIFIED** |

---

### 2. Tampering (T)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-T1** | **Report Falsification / Evidence Tampering:** Altering investigation outputs or threat assessments. | High | Real-time calculation of canonical **SHA-256 integrity digests** on raw payload and report structures. | **VERIFIED** |
| **T-T2** | **BiDi Text / Invisible Character Injection:** Using Right-to-Left (U+202E) or zero-width characters to obscure malicious URLs. | High | Explicit regex checks in `payload-analyzer.ts` detecting and flagging zero-width and BiDi override characters. | **VERIFIED** |

---

### 3. Repudiation (R)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-R1** | **Unverifiable Source Attribution:** Ambiguity over which intelligence feeds were evaluated vs unconfigured. | Medium | 11-section formal report includes an explicit **Intelligence Sources Coverage Matrix** displaying exact feed statuses. | **VERIFIED** |

---

### 4. Information Disclosure (I)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-I1** | **API Key Leakage in Outbound URLs:** Passing API tokens in query parameters where they appear in logs. | Critical | All keyed providers pass credentials exclusively in HTTP headers (`Authorization: Bearer`, `X-Goog-Api-Key`, `x-apikey`). | **VERIFIED** |
| **T-I2** | **Secret Leakage in Error Messages & Exports:** Stack traces or JSON exports containing basic auth credentials or API keys. | High | Deep object tree scrubbing via `sanitizeObject()` and string redaction via `redactSecrets()` and `CredentialStore.redact()`. | **VERIFIED** |
| **T-I3** | **Silent Phone-Home Telemetry:** Unconsented beaconing or telemetry queries to centralized servers. | High | Zero-telemetry default (`VITE_TELEMETRY_ENABLED=false` and `telemetryEnabled: false` in settings). | **VERIFIED** |

---

### 5. Denial of Service (D)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-D1** | **ReDoS / Giant Payload Crash:** Maliciously oversized QR code or nested URL percent-encoding choking regex parsers. | Medium | Bounded entropy slicing (`raw.slice(0, 1000)`), non-backtracking regex patterns, and asynchronous processing. | **VERIFIED** |
| **T-D2** | **Upstream OSINT Provider Hangs:** External API stalling connection indefinitely. | Medium | Configurable per-provider timeout with `AbortController` (default 8000ms) ensuring immediate fallback. | **VERIFIED** |

---

### 6. Elevation of Privilege / SSRF (E)

| Threat ID | Threat & Attack Vector | Impact | Existing Controls & Mitigations | Status |
| :--- | :--- | :---: | :--- | :---: |
| **T-E1** | **Cross-Site Scripting (XSS):** Injecting `javascript:`, `vbscript:`, or `data:text/html` payloads into scanner. | Critical | Comprehensive dangerous protocol deny list in `url-safety.ts`, Content Security Policy without `unsafe-eval`, React text escaping. | **VERIFIED** |
| **T-E2** | **Intranet SSRF / Loopback Scanning:** Submitting private RFC 1918 or `127.0.0.1` IPs to query internal microservices. | High | `parseIpv4Notation` detects loopback and RFC 1918 ranges, synthesizing safe local data without network requests. | **VERIFIED** |
| **T-E3** | **Dangerous Destination Navigation:** User accidentally clicking a malicious link from payload viewer. | High | Protocol validation in `DecodedPayloadSection.tsx` blocking non-HTTP/HTTPS schemes, plus elevated-risk confirmation modal. | **VERIFIED** |

---

## 4. Fail-Safe Behavior Verification

ScanIQ follows the principle of **Failing Safely & Securely**:

1. **Network Disconnection**:
   - If offline, external intelligence lookups immediately mark sources as `unavailable` or `skipped` without throwing uncaught exceptions.
   - Local heuristic analysis and IndexedDB cases browsing remain 100% operational.
2. **Unconfigured Integrations**:
   - Missing or placeholder API keys (`<CONFIGURE_MANUALLY>`) are marked as `not_configured` and skipped.
   - *Missing intelligence is never converted into a false "safe" or "clean" rating.*
3. **Invalid or Corrupt Artifacts**:
   - Corrupted barcode images or malformed URLs produce structured diagnostic warnings rather than unhandled UI crashes.
4. **Destination Navigation Guard**:
   - Payloads with high/critical risk ratings require deliberate confirmation before opening. Non-web protocols (`file:`, `javascript:`, `shell:`) are unconditionally blocked.

---

## 5. Accepted Residual Risks & Operational Guidance

| Residual Risk | Risk Level | Context & Rationale | Analyst Guidance |
| :--- | :---: | :--- | :--- |
| **Client-Side Storage Access on Shared Machines** | Low | IndexedDB data is unencrypted on the host OS file system in single-user environments. | In multi-user desktop environments, users should utilize individual OS user accounts or clear case history before logout. |
| **Upstream Provider Outages** | Low | Third-party threat intelligence APIs (e.g. VirusTotal, crt.sh) may experience occasional downtime or rate limiting. | Handled gracefully via timeouts and cached local heuristics; verify API quotas in BYOK Integrations. |
| **Novel Zero-Day Phishing Heuristics** | Low | Newly registered domains with no prior threat history may not trigger third-party blocklists immediately. | Always review structural heuristic indicators (entropy, typosquatting, embedded credentials) alongside reputation feeds. |

---

## 6. Threat Model Maintenance

This threat model should be reviewed and updated when:
- Adding new intelligence providers or network endpoints.
- Introducing new input formats or parser decoders.
- Modifying client-side storage architectures.
