# Security Policy

ScanIQ Community is committed to protecting the privacy and security of our users, cybersecurity analysts, and research community. As a local-first, privacy-first threat intelligence platform, security is built into our core architecture.

---

## 🛡️ Supported Versions

We provide security updates and patches for the following versions:

| Version | Supported | Release Notes |
| :--- | :---: | :--- |
| **1.0.x (Community)** | ✅ | Current stable production release |
| **< 1.0.0** | ❌ | Pre-release / legacy builds |

---

## 🔒 Security & Privacy Model

ScanIQ operates under strict security and privacy guarantees:

1. **Local-First Processing**: QR/barcode decoding, payload deconstruction, RFC 3986 normalization, entropy calculation, and heuristic risk analysis execute 100% locally in the browser/client environment.
2. **BYOK (Bring-Your-Own-Key) Isolation**: User-configured API keys (VirusTotal, AbuseIPDB, URLScan, SafeBrowsing, IPinfo) are stored only in local browser storage, sent exclusively in HTTP authorization headers directly to provider endpoints, and never transmitted to any ScanIQ server.
3. **Zero Telemetry by Default**: No tracking scripts, analytics cookies, or phone-home telemetry are activated without explicit opt-in.
4. **Dangerous Scheme Protection**: Executable URI schemes (`javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `shell:`, `intent:`) are blocked and sanitized to prevent XSS.
5. **SSRF & Intranet Containment**: Loopback and private RFC 1918 IP addresses are intercepted locally without making external network queries.

---

## 🚨 Reporting a Vulnerability

If you discover a potential security vulnerability in ScanIQ, please report it responsibly:

### How to Report

1. **GitHub Security Advisories (Preferred)**:
   - Navigate to the **[Security tab](https://github.com/Yasir-019/ScanIQ/security/advisories/new)** on GitHub.
   - Click **"Report a vulnerability"** to submit a private disclosure directly to the maintainers.

2. **Include in Your Report**:
   - Detailed description of the vulnerability and attack vector.
   - Steps to reproduce or Proof of Concept (PoC) payload.
   - Impact assessment (e.g. XSS, credential leakage, SSRF bypass).
   - Affected components and browser environment.

---

## ⏱️ Response & Disclosure Policy

- **Initial Acknowledgment**: Within **48 hours** of receiving the report.
- **Assessment & Triage**: Within **5 business days**, detailing validation and planned remediation.
- **Fix & Public Advisory**: Security patches will be merged and released with a CVE/GHSA advisory following coordinated disclosure.

Please do not disclose security vulnerabilities publicly in GitHub Issues or public forums before a patch is released.
