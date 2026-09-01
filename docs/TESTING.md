# ScanIQ Community — Automated Testing & Regression Architecture

This document describes the automated testing framework, test layers, regression suites, local execution workflows, and continuous integration standards for ScanIQ Community.

---

## 🏛️ Test Architecture & Pyramid

ScanIQ employs a deterministic, multi-layered automated testing strategy built on [Vitest](https://vitest.dev/) and [@testing-library/react](https://testing-library.com/docs/react-testing-library/intro/):

```text
               ┌──────────────────────┐
               │    E2E Workflows     │  Critical user journey integration
               │   (15% of tests)     │  (Scan → Cases → Reports → Export)
               ├──────────────────────┤
               │   Integration & UI   │  Component integration, BYOK modal,
               │   (35% of tests)     │  Sources catalog, State synchronizers
               ├──────────────────────┤
               │  Deterministic Unit  │  RFC 3986 normalization, Shannon entropy,
               │   (50% of tests)     │  Punycode detection, SHA-256 digests
               └──────────────────────┘
```

### Core Principles
1. **Zero External Dependencies**: Tests run 100% offline with zero reliance on live internet connectivity or third-party APIs.
2. **Zero Real Credentials**: No real API keys, tokens, or private secrets are ever used in test suites. Controlled mocks and fixtures simulate provider behavior.
3. **Deterministic & Isolated**: Each test runs in an isolated environment with fresh mocks, cleared IndexedDB state, and reset localStorage stores.
4. **Fast Execution**: The full suite runs in under 10 seconds, enabling rapid developer iteration.

---

## 🚀 Running Tests Locally

### Run All Tests (Single-Run Mode)
```bash
npm test -- --run
# or
npm run test:run
```

### Run Tests in Interactive Watch Mode
```bash
npm run test:watch
```

### Run a Specific Test Suite
```bash
# Run security regression suite
npx vitest run src/test/regression-security-owasp.test.ts

# Run provider resilience tests
npx vitest run src/test/regression-providers-resilience.test.ts

# Run case correlation tests
npx vitest run src/test/regression-cases-correlation-provenance.test.ts
```

### Run Full Quality Gate (Type Check + Lint + Tests + Build)
```bash
npx tsc --noEmit -p tsconfig.app.json && npm run lint && npm test -- --run && npm run build
```

---

## 📂 Test Suites Catalog

ScanIQ Community includes **28 test suites** spanning over **170+ automated tests**:

| Test Layer | Test File | Coverage Focus |
| :--- | :--- | :--- |
| **Core Ingestion** | `multi-input-scan.test.ts` | Dropzone, camera flow, paste entry, length limits |
| **Analysis & Heuristics** | `threat-intel-architecture.test.ts` | Shannon entropy, homoglyphs, risk scoring, TLDs |
| **Domain & Network OSINT** | `domain-infrastructure-osint.test.ts` | DoH resolution, RDAP registry, IP intelligence |
| **Correlation & Synthesis** | `correlation-synthesis.test.ts` | Entity deduplication, conflict resolution, synthesis |
| **IOC Graph** | `ioc-correlation-graph.test.ts` | Cross-artifact IOC extraction, graph node/edge linking |
| **Security & OWASP** | `regression-security-owasp.test.ts` | XSS sanitization, dangerous URI schemes, SSRF, secret isolation |
| **Threat Model** | `threat-model-verification.test.ts` | Trust boundaries, STRIDE mitigation verification |
| **Provider Fault Injection** | `regression-providers-resilience.test.ts` | HTTP 5xx errors, 429 rate limits, timeouts, corrupted JSON |
| **Integration Reliability** | `integration-reliability-resilience.test.ts` | Circuit breaker, token bucket rate limiter, fallback chains |
| **Provider Foundation** | `provider-foundation.test.ts` | Provider registry, prerequisite checks, auth masking |
| **Cases Management** | `cases-investigation-management.test.tsx` | Case CRUD, tagging, status transitions, multi-scan linking |
| **Cases & Provenance** | `regression-cases-correlation-provenance.test.ts` | Multi-scan cases, cross-case IOCs, SHA-256 evidence digests |
| **Evidence Integrity** | `evidence-integrity-provenance.test.ts` | RFC 8785 canonical JSON, tamper detection, audit trail |
| **Backup & Migration** | `backup-migration-portability.test.ts` | Full-state backup, restore, checksum check, schema migration |
| **PWA & Offline** | `regression-pwa-offline-startup.test.tsx` | Offline banner, zero-network analysis, ErrorBoundary recovery |
| **Investigation Workflow**| `investigation-workflow-e2e.test.ts` | End-to-end scan → investigate → correlate → report pipeline |
| **UI & Accessibility** | `ui-ux-refinements.test.ts` | WCAG contrast, keyboard navigation, focus management |
| **Navigation Shell** | `shell-navigation.test.tsx` | Persistent desktop sidebar, mobile bottom navigation shell |
| **Sources Catalog** | `sources-intelligence-catalog.test.tsx` | Local/Network/BYOK source filtering, details dialogs |
| **BYOK Vault** | `byok-integrations-system.test.tsx` | Add integration modal, key masking, connection test |
| **Reports Dossier** | `reports-evidence-system.test.tsx` | 11-section formal dossier rendering, JSON/MD export |
| **Payload Fuzzing** | `fuzz-scanner-payloads.test.ts` | Adversarial QR/barcodes, Unicode, RLO, nested schemes, 100KB payloads |
| **Provider Fuzzing** | `fuzz-external-providers-data.test.ts` | WAF HTML error bodies, type confusion, 30-level nested JSON, redirect loops |
| **Backup Fuzzing** | `fuzz-backup-imports.test.ts` | Corrupted JSON, negative counts, prototype pollution, 50MB size bounds |
| **Risk Engine Fuzzing**| `fuzz-risk-correlation-engine.test.ts` | Invariant testing ($0 \le \text{Score} \le 100$), multi-source conflicts, deduplication |

See [docs/FUZZING.md](FUZZING.md) for full fuzzing architecture and methodology.

---

## 🔒 Security Regression & Fault-Injection Testing

In accordance with OWASP Web Security Testing Guide (WSTG) and OpenSSF OSPS baseline guidelines:

1. **XSS / HTML Injection**: Every input component is tested against `<script>`, `<img onerror>`, and `<svg onload>` payloads to verify proper sanitization in `sanitizeInput` and React rendering.
2. **Dangerous URI Schemes**: Verified rejection of `javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `shell:`, and `intent:` schemes.
3. **SSRF & Intranet Interception**: Verified that private IP ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `[::1]`) are intercepted locally and never queried via outbound network requests.
4. **Secret Isolation**: Verified that BYOK API keys are never leaked into serialized investigation reports, findings, or export files.
5. **Provider Fault Injection**: Verified that network failures (HTTP 500, 502, 503, 429, timeouts, corrupted HTML/JSON) do not crash the investigation workflow and degrade gracefully to local analysis.

---

## ⚙️ Continuous Integration (CI) Automation

Every push and pull request to the `main` branch triggers the GitHub Actions CI pipeline (`.github/workflows/ci.yml`):

1. **TypeScript Strict Type Check**: `npx tsc --noEmit -p tsconfig.app.json`
2. **ESLint Code Quality**: `npm run lint`
3. **Automated Vitest Test Suite**: `npm test -- --run`
4. **Production Bundle Build**: `npm run build`

PRs cannot be merged until all four CI quality gates pass.

---

## 📋 Contributor Testing Expectations

When contributing new features or bug fixes:

- **Bug Fixes**: Must include a regression test in `src/test/` demonstrating the bug and verifying the fix.
- **New Features**: Must include unit and integration tests covering standard execution paths, error handling, and privacy constraints.
- **Security Changes**: Must include test cases validating that untrusted input is sanitized and trust boundaries are respected.
