# Security Policy & Vulnerability Disclosure

ScanIQ Community is committed to protecting the privacy and security of our users, cybersecurity analysts, and research community. As a local-first, privacy-first threat intelligence platform, security is built into our core architecture and development lifecycle.

---

## 🛡️ Supported Versions

We provide security patches and vulnerability remediation for the following release branches:

| Version | Supported | Status | Security Updates |
| :--- | :---: | :---: | :--- |
| **1.0.x (Community)** | ✅ | Current Stable | Active security patches and vulnerability fixes |
| **< 1.0.0** | ❌ | End of Life | Unsupported legacy / pre-release builds |

---

## 🔒 Security & Privacy Architecture

ScanIQ operates under strict architectural security guarantees (see [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) for full STRIDE analysis):

1. **Local-First Processing**: QR/barcode decoding, payload deconstruction, RFC 3986 normalization, Shannon entropy calculation, and heuristic risk analysis execute 100% locally in the browser/client environment.
2. **BYOK (Bring-Your-Own-Key) Isolation**: User-configured API keys (VirusTotal, AbuseIPDB, URLScan, Safe Browsing, IPinfo, URLVoid) are stored exclusively in local browser storage, sent directly in HTTPS authorization headers to provider endpoints, and never transmitted to any intermediary ScanIQ server.
3. **Zero Telemetry by Default**: No tracking scripts, analytics cookies, or phone-home telemetry are activated without explicit user opt-in (`VITE_TELEMETRY_ENABLED=false` by default).
4. **Dangerous Scheme Protection**: Executable and high-risk URI schemes (`javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, `shell:`, `intent:`) are sanitized and blocked to prevent Cross-Site Scripting (XSS) and protocol injection attacks.
5. **SSRF & Intranet Containment**: Loopback (`127.0.0.1`, `localhost`) and private RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are intercepted locally to prevent Server-Side Request Forgery and internal network reconnaissance.
6. **Cryptographic Verification**: Formal investigation reports and backup archives calculate SHA-256 integrity digests with canonical JSON normalization (RFC 8785).

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability in ScanIQ Community, please report it through our private coordinated disclosure channel. **Do not create public GitHub issues or discuss vulnerabilities in public forums prior to a coordinated release.**

### How to Report Privately

1. **GitHub Security Advisories (Preferred)**:
   - Navigate to the **[Security Advisories](https://github.com/Yasir-019/ScanIQ/security/advisories/new)** tab of the repository.
   - Click **"Report a vulnerability"** to open a confidential report directly with project maintainers.

2. **Email Disclosure (Alternative)**:
   - If you cannot use GitHub Security Advisories, email your report to **[security@scaniq.app](mailto:security@scaniq.app)**.

---

## 📋 What to Include in Your Report

To help us investigate and remediate the issue rapidly, please provide:

- **Type of Vulnerability**: (e.g., XSS, SSRF bypass, BYOK credential leakage, Regular Expression DoS, Insecure Deserialization).
- **Affected Component(s)**: File paths, UI screens, or specific functions involved.
- **Step-by-step Reproduction**: Clear steps or a minimal Proof of Concept (PoC) payload to reproduce the behavior.
- **Impact Assessment**: The potential severity and consequences of exploitation in a real-world scenario.
- **Client Environment**: Operating system, browser name and version, and deployment type (Docker, static host, or local dev).
- **Suggested Remediation (Optional)**: If you have a patch or fix in mind, feel free to include it.

---

## ⏱️ Response & Disclosure Process

We adhere to the following Coordinated Vulnerability Disclosure (CVD) timeline:

```text
┌──────────────┐      ┌────────────┐      ┌─────────────┐      ┌─────────────┐
│ 48h Ack      │ ───► │ 5d Triage  │ ───► │ Fix & Patch │ ───► │ Public GHSA │
└──────────────┘      └────────────┘      └─────────────┘      └─────────────┘
```

1. **Acknowledgment**: Within **48 hours**, we will acknowledge receipt of your vulnerability report.
2. **Triage & Validation**: Within **5 business days**, we will validate the vulnerability, assign a severity score (CVSS v3.1), and communicate our assessment.
3. **Remediation & Testing**: We will develop and verify a security patch within a private advisory fork.
4. **Coordinated Release & Credit**: A new patched release will be published along with a GitHub Security Advisory (GHSA) and CVE identifier, acknowledging your responsible disclosure (unless you prefer anonymity).

Thank you for helping keep ScanIQ and the open-source cybersecurity community safe!
