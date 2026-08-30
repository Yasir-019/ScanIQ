# ScanIQ Production Deployment Guide

This guide details the deployment requirements, HTTP security headers, and hosting configurations for ScanIQ.

---

## 1. Hosting Requirements

* **HTTPS Enforcement:** The Web MediaStream Camera API (`navigator.mediaDevices.getUserMedia`) strictly requires a secure context (HTTPS or `localhost`). Unencrypted HTTP deployments will disable camera scanning.
* **Single-Page Application (SPA) Fallback:** Client-side routing with React Router requires all non-asset paths (e.g. `/cases`, `/sources`, `/investigation/:id`) to rewrite to `/index.html`.
* **Zero Backend Dependency:** ScanIQ is 100% client-side; no server runtimes (Node.js, Python, PHP) or cloud databases are required for hosting.

---

## 2. OWASP ASVS 5.0 Browser Security Mechanism Headers (V3.4)

Production hosting environments MUST serve the following HTTP response headers:

| ASVS 5.0 Req | HTTP Response Header | Configured Value / Purpose |
| :--- | :--- | :--- |
| **V3.4.1** | `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| **V3.4.3** | `Content-Security-Policy` | Restricts script, object, and style evaluation. |
| **V3.4.4** | `X-Content-Type-Options` | `nosniff` |
| **V3.4.5** | `Referrer-Policy` | `strict-origin-when-cross-origin` |
| **V3.4.6** | `frame-ancestors` (in CSP) | `frame-ancestors 'none';` (blocks clickjacking) |
| **V3.4.8** | `Cross-Origin-Opener-Policy` | `same-origin` |
| **Policy** | `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), payment=(), usb=()` |

---

## 3. Supported Deployment Targets

The repository includes pre-configured deployment definitions:

1. **Cloudflare Pages / Netlify:**
   * File: `public/_headers` (automatically copied to `dist/_headers` on build).
2. **Vercel:**
   * File: `vercel.json` (defines rewrites and security header overrides).
3. **Nginx:**
   * File: `docs/deployment/nginx.conf` (reverse proxy and static file server configuration).

---

## 4. Build and Deployment Commands

```bash
# Install dependencies
npm.cmd install

# Production build (outputs to dist/)
npm.cmd run build

# Preview build locally
npm.cmd run preview
```
