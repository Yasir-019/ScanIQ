# ScanIQ Community — Project Roadmap

This document outlines the strategic vision, upcoming milestones, and community development roadmap for ScanIQ Community.

---

## 🎯 Strategic Principles

1. **Local-First & Zero-Telemetry**: ScanIQ will always operate 100% client-side by default with zero mandatory cloud connectivity or central tracking.
2. **Bring-Your-Own-Key (BYOK)**: Integrations will remain direct from browser/local container to upstream APIs with zero intermediary proxies.
3. **Cryptographic Integrity & Provenance**: Evidence records and dossiers will continue to utilize RFC 8785 canonical hashing and SHA-256 digests.
4. **Single-User Simplicity**: Maintain self-hosted, frictionless deployment without heavy multi-tenant infrastructure requirements.

---

## 🗺️ Release Roadmap

```text
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│     v1.0.0 (Current)    │ ──► │     v1.1.0 (Q4 2026)    │ ──► │     v1.2.0 (Q1 2027)    │
│ Production Community GA │     │ Threat Feeds & Rules    │     │ STIX 2.1 & Extensibility│
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

---

### v1.0.0 — Production Community GA (Current Release)
- [x] Multi-format QR/barcode decoding (ZXing WebAssembly/Canvas).
- [x] Local threat heuristic analyzer & Shannon entropy scoring.
- [x] 8-source intelligence catalog (Local, DoH, RDAP, VirusTotal, AbuseIPDB, URLScan, Safe Browsing, IPinfo).
- [x] BYOK Credential Vault with zero-leakage guarantee.
- [x] Multi-artifact Cases management & IndexedDB local persistence.
- [x] Interactive IOC Correlation Graph visualization.
- [x] Cryptographic evidence provenance & RFC 8785 canonical hashing.
- [x] 11-section formal cyber intelligence dossier generation (Print/PDF, JSON, Markdown).
- [x] Full-state JSON backup & restore with SHA-256 integrity verification.
- [x] Offline-first PWA with Service Worker static caching.
- [x] 32 automated test suites (199 tests) with fuzzing and OWASP regression coverage.

---

### v1.1.0 — Threat Rules & Offline Intelligence (Q4 2026)
- [ ] **Offline Community YARA/Sigma Rule Ingestion**: Support importing custom YARA-L and Sigma rules for offline payload inspection.
- [ ] **Expanded Local Blocklists**: In-browser Bloom filter support for local phishing URL checks without network requests.
- [ ] **Advanced GS1 Digital Link Parsing**: Deep parsing for healthcare and pharmaceutical barcode structures.
- [ ] **Batch Processing Mode**: Drag-and-drop multiple images or CSV of payloads for batch triage and analysis.
- [ ] **Automated Dependency Bumps**: Proactive Dependabot / Renovate integration for dependencies (React Router v7 / Vite v6).

---

### v1.2.0 — Open Standards & OSINT Extensibility (Q1 2027)
- [ ] **STIX 2.1 / TAXII Export**: Export investigation cases and IOC correlation graphs in standard OASIS STIX 2.1 JSON format.
- [ ] **MISP Event Synchronization**: One-click export to local MISP instances for threat sharing.
- [ ] **Browser Extension Companion**: Lightweight Manifest V3 companion for right-click QR code inspection on web pages.
- [ ] **Additional Threat Intelligence Providers**: AlienVault OTX, Shodan, Censys, GreyNoise, and ThreatFox integration.
- [ ] **Pre-built Container Registry**: Automated multi-arch container images published to GitHub Container Registry (`ghcr.io/yasir-019/scaniq`).

---

## 💡 Proposing Features

Have an idea for ScanIQ?
1. Check existing [GitHub Issues](https://github.com/Yasir-019/ScanIQ/issues) to ensure it isn't already planned.
2. Open a [Feature Request](https://github.com/Yasir-019/ScanIQ/issues/new?template=feature_request.yml) with your use case.
3. Discuss the implementation architecture with the community maintainers.
