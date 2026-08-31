# ScanIQ Community — Open-Source Threat Intelligence & QR/Barcode OSINT Workspace

ScanIQ is a free, open-source, self-hosted, single-user OSINT and QR/barcode cyber investigation platform. Built for privacy-conscious security analysts, threat intelligence researchers, fraud investigators, and incident responders.

---

## 🛡️ Core Principles & Privacy Model

- **Local-First & Zero-Telemetry**: Operates 100% locally by default with zero tracking, zero telemetry, and zero centralized database requirements.
- **Explainable Threat Scoring**: Deterministic, evidence-backed risk analysis (0–100 score + severity categorization) distinguishing observed facts from external threat intelligence feeds.
- **BYOK (Bring-Your-Own-Key) Architecture**: Connect your own API keys for VirusTotal, AbuseIPDB, URLScan, Google Safe Browsing, IPinfo, and URLVoid stored securely in local browser storage.
- **Cryptographic Provenance**: Formal investigation reports calculate SHA-256 canonical integrity digests of input artifacts and report structures.
- **Offline Resilient (PWA)**: Full local payload analysis, decoding, and IndexedDB case management work without an internet connection.

---

## 🚀 Navigation & Application Architecture

ScanIQ Community features a persistent desktop left-sidebar and mobile app shell:

1. **Scan (`/`)**: Image upload/dropzone-first inspection with explicit camera opt-in and manual paste analysis.
2. **Cases (`/cases`)**: Multi-artifact investigation workspace with tagging, status management (`active` / `archived` / `closed`), and cross-scan correlation.
3. **Sources (`/sources`)**: Intelligence catalog dividing capabilities into Local Analysis, Direct Network queries, and Reputation APIs.
4. **Integrations (`/integrations`)**: BYOK secret management with credential masking, connection testing, and toggle controls.
5. **Reports (`/reports`)**: 11-section formal cyber intelligence dossiers with Print/PDF formatting, structured JSON downloads, and Markdown export.
6. **Settings (`/privacy-settings`)**: Retention limits, scanner controls, offline caching, and destructive data purges.
7. **About (`/about`)**: Architecture diagrams, license details, and open-source documentation.

---

## 📦 Quick Start & Development

### Prerequisites
- Node.js 20+ (or Docker for containerized deployment)
- Modern web browser (Chrome, Firefox, Safari, Edge)

```bash
# Clone the repository
git clone https://github.com/Yasir-019/ScanIQ.git
cd ScanIQ

# Install dependencies
npm install

# Start development server
npm run dev

# Run automated test suites (19 test files, 126+ tests)
npm test -- --run

# Build production bundle
npm run build
```

---

## 🐳 Self-Hosted Deployment Options

ScanIQ does not require any ScanIQ-owned backend infrastructure. You can deploy it completely standalone.

### Option 1: Docker Compose (Recommended)

```bash
# Launch container on port 8080
docker compose up -d

# Visit in your browser
http://localhost:8080
```

### Option 2: Standalone Docker

```bash
# Build the container image
docker build -t scaniq-community .

# Run container
docker run -d -p 8080:80 --name scaniq scaniq-community
```

### Option 3: Static Hosting (Vercel, Netlify, Cloudflare Pages, Nginx)

ScanIQ compiles to static HTML/JS/CSS assets in the `dist/` directory.

- **Vercel**: Configuration is pre-wired in `vercel.json`.
- **Netlify / Cloudflare Pages**: SPA routing rewrites are pre-configured in `public/_redirects` and `public/_headers`.
- **Nginx**: Production Nginx configuration with OWASP ASVS security headers is provided in `nginx.conf`.

---

## 🔑 BYOK Integrations

ScanIQ connects to external threat intelligence providers using your own keys:

| Provider | Purpose | Default Behavior |
| :--- | :--- | :--- |
| **VirusTotal** | Multi-engine file & domain hash reputation | BYOK (Disabled if unconfigured) |
| **AbuseIPDB** | Crowdsourced IP abuse reports & confidence | BYOK (Disabled if unconfigured) |
| **URLScan.io** | Automated page scan & screenshot intelligence | BYOK (Disabled if unconfigured) |
| **Google Safe Browsing** | Phishing & malware blocklist validation | BYOK (Disabled if unconfigured) |
| **IPinfo** | Autonomous System (ASN) & geo infrastructure | Free Anonymous tier / Optional BYOK |
| **Cloudflare DoH** | DNS-over-HTTPS standard resource records | Direct Network (Privacy-preserving) |
| **RDAP Directory** | Authoritative domain & IP registry data | Direct Network (Direct lookup) |

---

## 📄 Formal Reports & Evidence Dossiers

Reports generated from investigations follow an 11-section structured hierarchy:
1. Executive Summary & Verdict
2. Investigation Overview & Metadata
3. Target & Decoded Input (with SHA-256 payload hash)
4. Risk Drivers & Mitigating Evidence
5. Key Findings with Source Provenance
6. Extracted Indicators of Compromise (IOCs)
7. Intelligence Sources Coverage Matrix
8. Evidence & Technical Details (DNS, RDAP, Entropy)
9. Analysis Scope & Limitations
10. Timeline & Provenance Logs
11. Cryptographic Report Integrity Digest (SHA-256)

---

## 📜 License

ScanIQ is free and open-source software licensed under the **GNU General Public License v3.0 (GPL-3.0-or-later)**.
See the [LICENSE](LICENSE) file for complete terms.
