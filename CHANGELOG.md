# Changelog

All notable changes to ScanIQ Community will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Planned community provider integrations.
- Additional offline heuristic classifiers.

---

## [1.0.0] - 2026-09-01

### Added
- **Multi-Input Scanning & Decoding (Phases 1–2)**:
  - Safe in-memory decoding for QR codes, Barcodes (UPC, EAN, Code 128), Data Matrix, and Aztec via ZXing.
  - Image dropzone, file upload, explicit opt-in camera scanner, and raw text/URI analysis.
  - Content classification for URLs, IP addresses, domains, Wi-Fi configs, vCards, crypto addresses, email (`mailto:`), phone numbers (`tel:`), and GS1 barcodes.
- **Unified Scan & Investigation Workflow (Phase 3)**:
  - Deterministic 0–100 threat risk scoring engine with transparent risk drivers and mitigating factors.
  - Heuristic analysis engine calculating Shannon entropy, Punycode/homograph detection, dangerous URI scheme validation, and top-level domain classification.
  - Destination safety dialog with redirect sandboxing and safe payload copy.
- **Sources Architecture & Intelligence Catalog (Phase 4)**:
  - Categorized intelligence catalog distinguishing Local Only, Direct Network, and BYOK Reputation providers.
  - Deep-dive source metadata dialogs detailing endpoint destinations, request signatures, and privacy implications.
- **BYOK (Bring-Your-Own-Key) Integrations (Phase 5)**:
  - Direct client-to-provider authentication for VirusTotal, AbuseIPDB, URLScan.io, Google Safe Browsing, IPinfo, and URLVoid.
  - Local credential storage with password masking, connection testing, and toggle controls.
- **Multi-Artifact Case Management (Phase 6)**:
  - Local IndexedDB persistence via Dexie.js for multi-artifact investigations.
  - Case tagging, status tracking (`active`, `archived`, `closed`), notes, and cross-scan correlation.
- **Formal Cyber Intelligence Reports (Phase 7)**:
  - 11-section structured dossier with Executive Summary, Target Input, Risk Drivers, Findings Provenance, Extracted IOCs, Source Coverage, and Cryptographic Report Integrity Digest.
  - Print/PDF styling, structured JSON download, and Markdown export.
- **Security & Privacy Hardening (Phase 8)**:
  - OWASP ASVS 5.0 compliance with zero-telemetry default.
  - Strict blocking of dangerous executable URI schemes (`javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `shell:`, `intent:`).
  - SSRF and intranet containment intercepting RFC 1918 private subnets and loopback addresses.
- **Self-Hosted Deployment (Phase 9)**:
  - Production-ready `Dockerfile` (multi-stage Alpine Nginx build) and `docker-compose.yml`.
  - Hardened Nginx configuration with Content Security Policy (CSP), HSTS, X-Frame-Options, and cache control.
  - Pre-configured deployment support for Vercel, Netlify, and Cloudflare Pages.
- **OSS Security & CI/CD Supply Chain (Phase 10)**:
  - GitHub Actions CI pipeline with automated Vitest testing, TypeScript strict type checking, and ESLint verification.
  - CodeQL static application security testing (SAST) and OpenSSF Scorecard supply-chain monitoring.
  - Automated dependency vulnerability scanning with Dependabot.
- **UI/UX Refinements & Accessibility (Phase 11)**:
  - Persistent left sidebar navigation for desktop and responsive bottom navigation shell for mobile.
  - WCAG 2.1 AA accessible contrast, keyboard navigation, focus rings, and screen-reader labels.
  - Multilingual support via `react-i18next` (English, Spanish, French, German, Japanese, Korean, Simplified Chinese, Traditional Chinese, Hindi, Russian, Urdu).
- **Threat Modeling & Verification (Phase 12)**:
  - Formal STRIDE threat model documented in `docs/THREAT_MODEL.md`.
  - Automated security verification test suite validating trust boundaries, sanitization, and credential handling.
- **Integration Reliability & Resilience (Phase 13)**:
  - Adaptive token-bucket rate limiters per provider respecting vendor API quotas.
  - Three-state circuit breaker (`CLOSED`, `OPEN`, `HALF_OPEN`) with exponential backoff and timeout handling.
  - Privacy-preserving fallback chains (BYOK → Direct Network → Local Heuristics).
- **IOC Correlation Engine & Investigation Graph (Phase 14)**:
  - Cross-artifact indicator extraction (IPv4, IPv6, FQDNs, SHA-256/MD5 hashes, emails, crypto wallets, ASNs).
  - Visual investigation graph and confidence scoring.
- **Evidence Integrity & Cryptographic Provenance (Phase 15)**:
  - RFC 8785 canonical JSON normalization.
  - SHA-256 payload and report verification digests with tamper-evident audit logs.
- **Backup, Migration & Data Portability (Phase 16)**:
  - Full-state JSON export/import encompassing Cases, Scans, Integrations, Settings, and IOC entities.
  - SHA-256 backup checksum verification and automated schema migration engine (`v1.0.0`).
- **Open-Source Project Maturity (Phase 17)**:
  - Comprehensive `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1), and `CHANGELOG.md`.
  - GitHub Issue Forms for structured bug reports, feature requests, and coordinated security advisories.
  - Release governance documentation (`docs/RELEASES.md`) and automated release packaging workflow with `SHA256SUMS.txt` cryptographic manifests.

---

## Upgrade Guidance

ScanIQ Community is a self-hosted client-side application. Upgrading between versions requires no server database migrations:

1. **Docker Deployments**: Pull the latest image or rebuild using `docker compose build --no-cache && docker compose up -d`.
2. **Static Deployments**: Pull latest git changes, run `npm ci && npm run build`, and deploy the updated `dist/` directory.
3. **Data Compatibility**: User data stored in browser IndexedDB is automatically migrated to the new schema on first launch. For safety, perform an export backup via **Settings → Backup & Export** before major version upgrades.
