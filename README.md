# ScanIQ Community — Threat Intelligence & QR/Barcode OSINT Platform

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![CI & Quality Gate](https://github.com/Yasir-019/ScanIQ/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![CodeQL Security Scan](https://github.com/Yasir-019/ScanIQ/actions/workflows/codeql.yml/badge.svg)](.github/workflows/codeql.yml)
[![OpenSSF Scorecard](https://github.com/Yasir-019/ScanIQ/actions/workflows/scorecard.yml/badge.svg)](.github/workflows/scorecard.yml)
[![Version](https://img.shields.io/badge/version-1.0.0-emerald.svg)](CHANGELOG.md)
[![Docker Ready](https://img.shields.io/badge/docker-ready-2496ED.svg?logo=docker&logoColor=white)](#-self-hosted-deployment)

**ScanIQ Community** is a free, open-source, self-hosted, single-user OSINT (Open Source Intelligence) and QR/barcode cyber investigation workstation. Built for privacy-conscious security analysts, incident responders, fraud investigators, and threat intelligence researchers.

---

## 🛡️ Core Capabilities & Privacy Architecture

ScanIQ operates under strict privacy and security guarantees:

* **Local-First & Zero-Telemetry**: Operates 100% locally in the browser by default. No tracking scripts, analytics beacons, or centralized database servers.
* **Multi-Format Decoder**: In-memory decoding for QR codes, UPC/EAN, Code 128, Data Matrix, and Aztec via ZXing from image drops, camera feeds, or raw pasted payloads.
* **Explainable Threat Risk Scoring**: Deterministic 0–100 risk score and severity ratings (`Benign`, `Low`, `Medium`, `High`, `Critical`) with transparent risk drivers and mitigating factors.
* **BYOK (Bring-Your-Own-Key) Architecture**: Directly connect your API keys for VirusTotal, AbuseIPDB, URLScan.io, Google Safe Browsing, IPinfo, and URLVoid stored exclusively in browser local storage.
* **IOC Correlation & Graph Visualization**: Automatically extract and link cross-artifact indicators of compromise (FQDNs, IPs, hashes, ASNs, crypto wallets, and emails).
* **Cryptographic Provenance**: Formal 11-section cyber intelligence dossiers with canonical RFC 8785 JSON formatting and SHA-256 integrity digests.
* **Full-State Backup & Portability**: Export and import complete investigation cases, IOC graphs, settings, and integrations with tamper-evident SHA-256 verification and automatic schema migration.
* **Offline-Resilient PWA**: Full heuristic analysis, payload deconstruction, and IndexedDB workspace operate seamlessly without an active internet connection.

---

## 🧭 Application Modules & Workflow

```text
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ 1. Scan (/)  │ ───► │ 2. Cases     │ ───► │ 3. Sources   │ ───► │ 4. Reports   │
│ Ingest/Decode│      │ Multi-Target │      │ Intel Matrix │      │ SHA-256 PDF  │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

1. **Scan (`/`)**: Optical camera capture, drag-and-drop image analysis, and raw text/URI inspection.
2. **Cases (`/cases`)**: Multi-artifact workspace with tag management, status filters (`active`, `archived`, `closed`), and cross-scan IOC correlation.
3. **Sources (`/sources`)**: Catalog dividing capabilities into Local Analysis, Direct Network queries (DoH, RDAP), and BYOK Reputation APIs.
4. **Integrations (`/integrations`)**: BYOK credential vault with secret masking, instant latency/connectivity testing, and provider toggles.
5. **Reports (`/reports`)**: 11-section formal cyber intelligence dossiers with Print/PDF formatting, structured JSON download, and Markdown export.
6. **Privacy & Settings (`/privacy-settings`)**: Retention quotas, scanner controls, offline cache management, and full-state backup/restore.
7. **About (`/about`)**: Architecture diagrams, threat model references, license terms, and open-source documentation.

---

## 🚀 Quick Start & Local Development

### Prerequisites
- **Node.js**: v20.0+ 
- **npm**: v10.0+ (or compatible package manager)

```bash
# 1. Clone the repository
git clone https://github.com/Yasir-019/ScanIQ.git
cd ScanIQ

# 2. Install dependencies
npm ci

# 3. Start local development server
npm run dev

# 4. Run automated test suites (32 test files, 199 tests)
npm test -- --run

# 5. Build production bundle
npm run build
```

---

## 🐳 Self-Hosted Deployment

ScanIQ does not require any ScanIQ-owned backend infrastructure. You can deploy it completely standalone.

### Option 1: Docker Compose (Recommended)

```bash
# Launch containerized workspace on port 8080
docker compose up -d

# Visit in your browser
http://localhost:8080
```

### Option 2: Standalone Docker

```bash
# Build the production image
docker build -t scaniq-community .

# Run standalone container
docker run -d -p 8080:80 --name scaniq scaniq-community
```

### Option 3: Static Hosting (Vercel, Netlify, Cloudflare Pages, Nginx)

ScanIQ compiles to static HTML, JavaScript, and CSS assets in the `dist/` directory:

- **Nginx**: Hardened production Nginx configuration with ASVS security headers is provided in [`nginx.conf`](nginx.conf).
- **Vercel**: Configuration is pre-wired in [`vercel.json`](vercel.json).
- **Netlify & Cloudflare Pages**: SPA routing rewrites are pre-configured in `public/_redirects` and `public/_headers`.

---

## 🔑 BYOK Integrations

ScanIQ interfaces directly with upstream threat intelligence providers using your own API credentials without routing requests through third-party proxy servers:

| Provider | Purpose | Authentication | Privacy Impact |
| :--- | :--- | :---: | :--- |
| **VirusTotal** | Multi-engine file & domain reputation | BYOK API Key | Queries hash/domain to VirusTotal API |
| **AbuseIPDB** | Crowdsourced IP abuse reports & confidence | BYOK API Key | Queries IP to AbuseIPDB API |
| **URLScan.io** | Automated page scan & sandbox intelligence | BYOK API Key | Queries URL/domain to URLScan API |
| **Google Safe Browsing** | Phishing & malware blocklist validation | BYOK API Key | Queries URI hash prefix to Google API |
| **IPinfo** | Autonomous System (ASN) & geo infrastructure | Free / BYOK Token | Queries IP to IPinfo API |
| **Cloudflare DoH** | DNS-over-HTTPS standard resource records | Direct Network | Resolves DNS records via privacy DoH |
| **RDAP Directory** | Authoritative domain & IP registry data | Direct Network | Queries IANA/RIR directory endpoints |

---

## 💾 Backup, Migration & Data Portability

All investigation cases, IOC graphs, notes, and user configurations are persisted locally in browser IndexedDB.

- **Export Backup**: Download a timestamped, tamper-evident JSON backup file with an RFC 8785 canonical SHA-256 checksum digest.
- **Restore & Migrate**: Import previously exported JSON backup archives with automatic checksum verification and schema migration.

---

## 🔒 Security & Vulnerability Reporting

Security is fundamental to ScanIQ. If you discover a vulnerability, please disclose it privately via **GitHub Security Advisories**:

👉 **[Report a Security Vulnerability](https://github.com/Yasir-019/ScanIQ/security/advisories/new)**

For detailed disclosure guidelines, response SLAs (48h acknowledgment / 5-day triage), and our complete security policy, see [SECURITY.md](SECURITY.md).

---

## 🤝 Contributing

We welcome contributions from the community! Please review our [CONTRIBUTING.md](CONTRIBUTING.md) guide and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting pull requests.

### Contribution Workflow
`Issue → Discussion → Pull Request → CI Validation → Code Review → Merge`

---

## 📜 License

ScanIQ is free and open-source software licensed under the **GNU General Public License v3.0 (GPL-3.0-or-later)**.
See the [LICENSE](LICENSE) file for complete terms.
