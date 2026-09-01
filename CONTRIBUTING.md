# Contributing to ScanIQ Community

Thank you for your interest in contributing to ScanIQ Community! ScanIQ is a free, open-source, self-hosted, single-user OSINT and QR/barcode cyber investigation platform. We welcome contributions from developers, security analysts, and researchers of all experience levels.

---

## 🧭 Contribution Workflow

We follow a transparent, straightforward workflow designed for agility and quality:

```text
┌─────────┐      ┌────────────┐      ┌────┐      ┌────┐      ┌────────┐      ┌───────┐
│  Issue  │ ───► │ Discussion │ ───► │ PR │ ───► │ CI │ ───► │ Review │ ───► │ Merge │
└─────────┘      └────────────┘      └────┘      └────┘      └────────┘      └───────┘
```

1. **Issue**: Check existing [GitHub Issues](https://github.com/Yasir-019/ScanIQ/issues) to avoid duplicate work. If none exists, create a new issue describing the bug or feature proposal using our issue templates.
2. **Discussion**: For non-trivial features, architectural modifications, or new third-party integrations, discuss the design in the issue or in GitHub Discussions before writing code.
3. **Pull Request (PR)**: Fork the repository, create a descriptive feature branch (e.g., `fix/urlscan-timeout` or `feat/new-doh-provider`), implement your changes with tests, and submit a PR against `main`.
4. **CI Validation**: Automated GitHub Actions workflows will run type-checking, linting, Vitest unit/integration test suites, and production build checks.
5. **Review**: The maintainer will review your code for correctness, security posture, accessibility, and documentation accuracy.
6. **Merge**: Once approved and all CI checks are green, your PR will be squash-merged into `main`.

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: v20.0.0 or higher
- **npm**: v10.0.0 or higher (or compatible package manager)
- **Git**: Latest version

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Yasir-019/ScanIQ.git
   cd ScanIQ
   ```

2. **Install dependencies**:
   ```bash
   npm ci
   ```

3. **Configure environment variables (Optional)**:
   ```bash
   cp .env.example .env.development
   ```
   *(By default, all external network requests are disabled until explicitly configured or enabled in the UI).*

4. **Start the local development server**:
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:8080` (or the port specified in terminal output).

---

## 🧪 Testing & Validation Requirements

Every pull request must pass all automated validation checks before merging. Never submit a PR with failing tests or unresolved type errors. See [docs/TESTING.md](docs/TESTING.md) for full test architecture details.

### 1. Run Automated Test Suite
```bash
npm test
```
*We use [Vitest](https://vitest.dev/) for fast unit and integration testing. Run `npm test -- --run` to execute tests in single-run mode.*

### 2. TypeScript Strict Type Checking
```bash
npx tsc --noEmit -p tsconfig.app.json
```
*ScanIQ enforces strict TypeScript typing. Ensure there are no `any` leaks or unresolved type diagnostics.*

### 3. Code Linting
```bash
npm run lint
```
*ESLint is configured to verify React hooks rules, import sanity, and code formatting.*

### 4. Production Bundle Build
```bash
npm run build
```
*Confirms that Vite transforms all modules and bundles without missing asset references or build warnings.*

---

## 💻 Coding Standards & Conventions

- **Component Architecture**: Build modular, reusable functional components located in `src/components/` and structured pages in `src/pages/`.
- **UI Library**: Utilize [Radix UI](https://www.radix-ui.com/) primitives for accessible components (Dialogs, Tooltips, Tabs, Selects) and [Lucide React](https://lucide.dev/) for iconography.
- **Styling**: Use [Tailwind CSS](https://tailwindcss.com/) with semantic color tokens defined in `src/index.css`. Avoid ad-hoc inline styles or unvetted CSS frameworks.
- **State Management**: Use [Zustand](https://github.com/pmndrs/zustand) for lightweight global state stores and [Dexie.js](https://dexie.com/) for IndexedDB local storage persistence.
- **Internationalization**: Ensure all user-facing strings are localized via `react-i18next` and stored in `src/lib/i18n/locales/`.

---

## 🔒 Security & Privacy Guidelines

Because ScanIQ is a cybersecurity and OSINT tool, security and user privacy are strictly non-negotiable:

1. **Zero-Telemetry Default**: Never introduce telemetry, analytics pings, or background beaconing without explicit user opt-in (`VITE_TELEMETRY_ENABLED=false` by default).
2. **Local-First Processing**: QR/barcode decoding, URI normalization, Shannon entropy calculation, and heuristic risk scoring must always execute 100% locally in the browser.
3. **No Hardcoded Secrets**: Never commit API keys, personal tokens, test credentials, or private keys to the codebase.
4. **Input Sanitization & URI Scheme Safety**: Always validate and sanitize untrusted inputs. Executable schemes (`javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `shell:`, `intent:`) must remain blocked.
5. **SSRF Containment**: Ensure local loopback (`127.0.0.1`, `localhost`) and private RFC 1918 networks (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are blocked from outbound requests unless explicitly sandboxed.
6. **BYOK Secret Isolation**: Third-party API keys (VirusTotal, URLScan, AbuseIPDB, SafeBrowsing, IPinfo) must only be stored in local browser storage and transmitted directly to the upstream provider's HTTPS endpoint.

---

## 📋 Pull Request Submission Checklist

When opening a Pull Request, please ensure:

- [ ] Branch is based on the latest `main` branch.
- [ ] PR title is concise and descriptive (e.g. `feat(sources): add new RDAP registrar resolver`).
- [ ] PR description explains **what** was changed and **why**.
- [ ] References relevant issue(s) (e.g. `Fixes #42` or `Closes #15`).
- [ ] Added or updated automated test coverage in `src/test/`.
- [ ] All tests pass (`npm test`).
- [ ] TypeScript type checks pass (`npx tsc --noEmit -p tsconfig.app.json`).
- [ ] Linting passes (`npm run lint`).
- [ ] Build succeeds (`npm run build`).
- [ ] No generated files (`dist/`, `.local`, logs) are included in the commit.
- [ ] Documentation (`README.md`, `CHANGELOG.md`, or `docs/`) updated if user-facing behavior changed.

---

## ⚖️ Proposing Major Architectural Changes

If you plan to propose a substantial change—such as introducing a new database engine, altering the deterministic risk scoring algorithm, or integrating a new upstream provider category:

1. Open a **GitHub Issue** with the `RFC` or `Architecture` label.
2. Outline the motivation, technical design, privacy impact, and backward compatibility plan.
3. Allow time for maintainer and community feedback before opening large PRs.

---

## 👥 Code of Conduct

All contributors and maintainers are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md) to maintain an open, welcoming, and harassment-free environment for everyone.
