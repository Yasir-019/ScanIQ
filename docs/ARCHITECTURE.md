# ScanIQ Architecture & Technical Design

ScanIQ is an open-source, privacy-first, client-side QR/barcode OSINT (Open Source Intelligence) and cybersecurity investigation tool.

---

## 1. System Pipeline

```text
  ┌─────────────────────────────────────────────────────────────┐
  │                   1. Multi-Input Ingestion                  │
  │     [Optical Camera]  │  [Image Dropzone]  │  [Paste/Text]  │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │                 2. Safe Client-Side Decoding                │
  │         ZXing Browser Multi-Format Decoder (In-Memory)      │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │            3. Content Classification & Extraction           │
  │ (URL, Domain, IP, Wi-Fi, vCard, Crypto, Phone, Mailto, GS1) │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │             4. Investigation Engine Orchestration           │
  │  ┌───────────────────────┐       ┌───────────────────────┐  │
  │  │ Local Payload/Entropy │       │ URL/Domain Heuristics │  │
  │  └───────────────────────┘       └───────────────────────┘  │
  │  ┌───────────────────────────────────────────────────────┐  │
  │  │   Opt-In Provider Orchestrator (Zero Outbound By Def) │  │
  │  │   (Cloudflare DoH, RDAP, crt.sh, IPinfo, VirusTotal,  │  │
  │  │    AbuseIPDB, URLScan, SafeBrowsing, Qualys SSL)      │  │
  │  └───────────────────────────────────────────────────────┘  │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │     5. Correlation, Graph Synthesis & Contradiction Engine  │
  │    (Entity Deduplication, Freshness Tracking, Conflicts)    │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │           6. Deterministic Risk & Confidence Engine         │
  │          (0-100 Score, Severity Caps, Confidence %)         │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │             7. Presentation & Storage Persistence           │
  │ [Dexie Cases DB] │ [Investigation Workspace] │ [Sanitized Export]
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. Core Modules & Responsibilities

| Path | Responsibility |
| :--- | :--- |
| `src/lib/scanner-service.ts` | Camera lifecycle, torch, zoom, file decoding via `@zxing/browser`. |
| `src/lib/scan/parser.ts` | Content classification (URL, Wi-Fi, vCard, crypto, email, phone, GS1) and safe field extraction. |
| `src/lib/investigation/engine.ts` | Top-level investigation orchestrator coordinating local analyzers and threat providers. |
| `src/lib/investigation/payload-analyzer.ts` | Shannon entropy calculation, character distribution, dangerous URI protocols, embedded credentials. |
| `src/lib/investigation/url-normalizer.ts` | RFC 3986 URL parsing, Punycode/IDN homoglyph detection, raw IP host analysis, non-standard ports. |
| `src/lib/investigation/url-heuristics.ts` | Known shorteners, typosquatting, brand impersonation, dangerous file extensions (`.exe`, `.apk`, `.dmg`). |
| `src/lib/investigation/domain-analyzer.ts` | Domain complexity, TLD reputation heuristics, Levenshtein distance brand matching. |
| `src/lib/investigation/redirect-analyzer.ts` | Headless redirect chain tracking, protocol downgrade detection, cross-domain forwarding. |
| `src/lib/investigation/dns-analyzer.ts` | DNS record modeling, CAA record validation, dangling CNAME checks. |
| `src/lib/investigation/synthesizer.ts` | Multi-hop graph generation (`nodes`, `edges`), entity correlation, and contradiction detection. |
| `src/lib/investigation/risk-engine.ts` | Deterministic 0-100 risk scoring with explicit severity caps and independent confidence calculation. |
| `src/lib/investigation/providers/` | Pluggable, provider-agnostic OSINT adapters (DoH, RDAP, crt.sh, IPinfo, VirusTotal, AbuseIPDB, URLScan). |
| `src/lib/investigation/sanitization.ts` | Redacts sensitive credentials, private keys, and user tokens during report exports. |
| `src/lib/db.ts` | Dexie IndexedDB persistence (`scans`, `cases`, `investigations`). |
| `src/lib/settings.ts` | Zustand store managing theme, language, and opt-in intelligence toggles. |

---

## 3. Threat Intelligence Provider Architecture

All external intelligence lookups implement the `BaseIntelligenceProvider` interface:

* **Opt-In Requirement:** Outbound queries are strictly disabled by default and require explicit user consent (`externalLookupsOptedIn`).
* **Granular Controls:** Each provider can be individually enabled or disabled in the **Sources** catalog.
* **Credential Isolation:** API keys are stored in client-side LocalStorage / Zustand and never transmitted to ScanIQ servers.
* **Resilience:** Upstream provider failures, timeouts, and rate limits fail gracefully without breaking the local investigation.

---

## 4. Evidence & Risk Integrity Principles

ScanIQ is designed with evidence integrity and provenance principles aligned with applicable **NIST SP 800-61 Rev. 3** incident-response guidance:

1. **Observed Fact vs Heuristic vs External Intel:** Every finding preserves its distinct evidence nature.
2. **Deterministic & Explainable:** Scores are calculated via a transparent, weighted formula with explicit evidence links.
3. **Inspection-First:** Decoded URLs, scripts, and payloads are treated as untrusted data and never automatically visited or executed.
4. **Zero Server Dependency:** Case history, investigation reports, and notes reside 100% locally on the user's device.
