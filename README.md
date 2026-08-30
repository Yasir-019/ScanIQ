# ScanIQ OSINT

Free, open-source, privacy-first QR/barcode scanner and **threat-intelligence / OSINT investigation workspace** for privacy-conscious users, cybersecurity students, researchers, and professionals.

## Product Mission

ScanIQ scans a QR or barcode **safely** (never auto-opening), then turns that payload into a structured investigation case with:

- Local-first payload & URL deconstruction, protocol & obfuscation analysis.
- Explainable risk scoring with supporting evidence & confidence.
- Target extraction (URLs, domains, hosts, IPs, emails, phones, product codes, IBANs).
- User-controlled, opt-in intelligence lookups:
  - DNS / DoH (Cloudflare by default)
  - RDAP (domain + IP registration)
  - ASN & hosting info (IPinfo)
  - Geolocation (offline DB-IP or online IPinfo)
  - Certificate Transparency (crt.sh) & TLS (Qualys SSL Labs)
  - Redirect-chain tracing (proxied)
  - Reputation & blocklists (URLVoid, VirusTotal, Google Safe Browsing, Phishtank, AbuseIPDB)
  - Brand-protection & lookalike/typosquat detection
  - GS1 product-code registration lookups
- Structured **investigation report** per case, with findings, evidence, notes, and case retention.
- Zero paywalls, zero Pro tiers, zero lock-in, no telemetry by default.

## Tech Stack

- **Frontend:** React 19 + TypeScript, Radix UI primitives, Tailwind CSS, framer-motion, sonner toasts.
- **Build:** Vite 7 with SWC, code-splitting, manual vendor chunks.
- **Storage:** IndexedDB (Dexie) — cases, scans, and investigations are **stored locally on-device**.
- **State:** Zustand (persisted settings).
- **Scanner:** ZXing (`@zxing/browser` + ImageBarcodeReader) — 14 symbologies.
- **i18n:** react-i18next, 8 languages (EN, HI, JA, KO, RU, UR, ZH-CN, ZH-TW).
- **PWA:** Custom service worker (`/public/sw.js`), install prompt, offline page, Web App Manifest.
- **Tests:** Vitest + Testing Library (config in `vitest.config.ts`, setup at `src/test/setup.ts`).
- **Lint/Format:** ESLint 9 (typescript-eslint strict-type-checked) + Prettier (`pretty-quick`).

## Getting Started

```powershell
# Windows PowerShell — use npm.cmd; do not use &&
npm.cmd install
npm.cmd run dev       # start Vite dev server (HTTPS recommended for camera)
npm.cmd run build     # production build -> dist/
npm.cmd run preview   # preview production build
npm.cmd run lint      # ESLint
npx.cmd tsc --noEmit -p tsconfig.app.json   # TypeScript strict check
npm.cmd run test      # Vitest (see src/**/*.test.tsx)
```

The camera APIs require **HTTPS or localhost**. On a LAN mobile device, set `VITE_DEV_HOST` or `vite.config.ts` server.https.

## Architecture

```
src/
  pages/
    Scan.tsx               # Entry: camera + paste + image → creates a Case & Investigation
    Cases.tsx              # Private, local investigation cases
    Sources.tsx            # Opt-in intelligence sources catalog + per-source toggle
    PrivacySettings.tsx    # Settings, consent, case retention, destructive actions
    Investigation.tsx      # Full investigation report (5 tabs)
  lib/
    investigation/         # Core modular investigation engine
      payload-analyzer.ts  # Shannon entropy, character distribution, dangerous protocols, creds
      url-normalizer.ts    # RFC 3986 normalization, Punycode/IDN, IP formats, port & redirect checks
      url-heuristics.ts    # Brand impersonation, typosquatting, DGA subdomains, shorteners, dangerous files
      domain-analyzer.ts   # Domain complexity, Levenshtein distance & homoglyph substitutions
      redirect-analyzer.ts # Redirect chain modeling & cross-domain tracking
      dns-analyzer.ts      # DNS records & infrastructure intelligence modeling
      evidence-collector.ts# Deduplication, sorting, and indexing of findings
      risk-engine.ts       # Deterministic, explainable risk scoring (0-100 & verdict)
      engine.ts            # Top-level InvestigationEngine orchestrator
    scan/types.ts          # Core domain types incl. InvestigationReport, RiskScoreSummary, etc.
    osint/sources.ts       # Source catalog & per-source metadata
    db.ts                  # Dexie schema: scans / cases / investigations
    settings.ts            # Zustand settings w/ per-source toggles
    scanner-service.ts, parser.ts, security.ts, url-safety.ts, feedback.ts, telemetry.ts, action-stats.ts, utils.ts
  components/
    AppShell.tsx           # 4-tab shell (Scan · Cases · Sources · Settings)
    ResultSheet.tsx        # Post-scan bottom sheet with prominent "Open Investigation" CTA
    ErrorBoundary.tsx, OfflineBanner.tsx, InstallBanner.tsx, SmartActions.tsx, SafetyWarningCard.tsx, CameraOverlay.tsx
  hooks/
    use-pinch-to-zoom.ts, use-network-status.ts, use-install-prompt.ts
```

## Opt-In External Lookups

No network calls leave the device unless the user has:

1. Toggled the global **Enable external network lookups** consent in **Privacy & Settings**, **and**
2. Individually enabled a source in the **Sources** catalog, **and** for keyed sources, added the env var (see `.env.example`).

### Available env keys

```
VITE_IPINFO_TOKEN
VITE_URLVOID_KEY
VITE_VIRUSTOTAL_KEY
VITE_SAFEBROWSING_KEY
VITE_ABUSEIPDB_KEY
VITE_REDIRECT_PROXY_URL
```

Set these in `.env.local` (dev) or `.env.production` (build). Never commit secrets.

## Case Retention & Privacy

- All data stays on-device unless a user explicitly navigates to an external link or enables networked sources.
- Cases are silently pruned after `caseRetentionDays` (default 90 days) or at `DEFAULT_CASE_LIMIT` (500) cases, with starred cases preserved.
- Use **Privacy & Settings → Destructive actions** to Clear all data or Reset to defaults.

## License & Philosophy

Open-source under **GPL-3.0-or-later**. Always free. No paywalls. No Pro upgrades. No telemetry by default. For researchers, by researchers. See `/licenses`.
