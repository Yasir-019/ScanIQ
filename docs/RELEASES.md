# ScanIQ Community — Release & Versioning Policy

ScanIQ Community adheres to predictable, transparent, and cryptographically verifiable release practices in accordance with the OpenSSF Open Source Project Security (OSPS) Baseline.

---

## 🏷️ Versioning Convention

ScanIQ follows [Semantic Versioning 2.0.0](https://semver.org/):

$$\text{v}\mathbf{MAJOR}.\mathbf{MINOR}.\mathbf{PATCH}$$

- **MAJOR** (`vX.0.0`): Breaking changes to local data schemas requiring automated migration, removal of deprecated configuration flags, or architectural paradigm shifts.
- **MINOR** (`v1.X.0`): New features, threat intelligence adapters, decoding formats, export capabilities, or UI enhancements that are fully backward compatible.
- **PATCH** (`v1.0.X`): Backward-compatible bug fixes, security vulnerability patches, dependency upgrades, or performance improvements.

---

## 🚀 Release Lifecycle & Quality Gates

Before any version is tagged and released, it must successfully pass the following quality gates:

```text
┌──────────────┐      ┌────────────┐      ┌────────────┐      ┌──────────────┐
│  Automated   │ ───► │ Production │ ───► │  Security  │ ───► │  Checksum    │
│  CI Tests    │      │ Vite Build │      │  Advisory  │      │  Manifest    │
└──────────────┘      └────────────┘      └────────────┘      └──────────────┘
```

1. **Automated CI Validation**:
   - `npm test`: 100% test pass rate across all unit and integration test suites.
   - `npx tsc --noEmit`: Zero strict TypeScript diagnostics.
   - `npm run lint`: Zero ESLint warnings or errors.
2. **Deterministic Production Build**:
   - `npm run build`: Clean Vite bundling with minified chunks in `dist/`.
3. **Changelog & Documentation Synchronization**:
   - `CHANGELOG.md` updated with release notes following [Keep a Changelog](https://keepachangelog.com/).
   - `SECURITY.md` supported versions table updated if necessary.
4. **Tagging & Release Manifest**:
   - Git annotated tag created (e.g., `git tag -a v1.0.0 -m "Release v1.0.0"`).
   - Automated GitHub Actions workflow builds distribution tarball and computes canonical `SHA256SUMS.txt`.

---

## 🔒 Verifying Release Asset Integrity

Every official release artifact (e.g., `scaniq-community-v1.0.0.tar.gz`) is published alongside a canonical SHA-256 checksum manifest (`SHA256SUMS.txt`).

### Verification Steps

1. **Download the release archive and checksum file**:
   ```bash
   curl -LO https://github.com/Yasir-019/ScanIQ/releases/download/v1.0.0/scaniq-community-v1.0.0.tar.gz
   curl -LO https://github.com/Yasir-019/ScanIQ/releases/download/v1.0.0/SHA256SUMS.txt
   ```

2. **Verify SHA-256 Checksum on Linux/macOS**:
   ```bash
   sha256sum -c SHA256SUMS.txt
   # Expected output: scaniq-community-v1.0.0.tar.gz: OK
   ```

3. **Verify SHA-256 Checksum on Windows (PowerShell)**:
   ```powershell
   Get-FileHash scaniq-community-v1.0.0.tar.gz -Algorithm SHA256
   # Compare the output Hash against SHA256SUMS.txt
   ```

---

## 🔄 Upgrade & Data Compatibility

ScanIQ stores all state locally in the user's browser IndexedDB (Cases, Scans, IOCs, Settings, and BYOK credentials).

- **Client-Side Schema Migrations**: When opening a new version of ScanIQ, the Dexie database automatically runs versioned schema upgrades without requiring manual database commands.
- **Safety Precaution**: Before upgrading major versions, users are encouraged to export a full-state backup via **Settings → Backup & Export** (`scaniq-backup-*.json`).
- **Rollback**: If a rollback is ever needed, deploying the prior version and re-importing the backup file restores the exact previous state.
