# ScanIQ Community — Fuzzing & Adversarial Testing Architecture

This document describes the fuzzing policy, adversarial input generators, property-based testing invariants, and safety boundaries for ScanIQ Community.

---

## 🎯 Purpose & Scope

ScanIQ processes untrusted, adversary-controlled input from physical QR codes, uploaded images, raw text pastes, and external third-party API feeds. The fuzzing framework systematically tests these boundaries to detect:

* **Unhandled Exceptions & Crashes**: Null-pointer dereferences, undefined property accesses, and unhandled parsing failures.
* **Hangs & Infinite Loops**: Regular Expression Denial of Service (ReDoS), cyclic redirect parameter traversal, and infinite loop traps.
* **Resource Exhaustion**: Memory bloat from oversized payloads or deeply nested JSON structures.
* **Validation & Scheme Bypasses**: Obfuscated URLs, dangerous protocol smuggling, and RFC 1918 private intranet reachability.
* **State & Prototype Pollution**: Malicious `__proto__` or `constructor` injections through backup imports or provider responses.

---

## 🛡️ Resource Safety & Zero-Network Guarantee

To protect developer workstations, CI environments, and external services, all fuzzing runs under strict safety invariants:

1. **Zero External Network Traffic**: All external threat intelligence APIs and DNS services are mocked with deterministic in-memory fixtures. No outbound network requests or API quotas are ever consumed.
2. **Bounded Execution Time**: All parser and analysis algorithms operate with strict timeout bounds (<100ms per payload, <15ms per 1,000 findings deduplicated).
3. **Bounded Input Memory**: Upper bounds of 2,048 characters for normalized inputs and 50MB for backup files are strictly validated before deep parsing.

---

## 📂 Fuzzing Suites Catalog

ScanIQ Community includes **4 dedicated adversarial fuzzing suites**:

| Fuzz Target | Test Suite | Focus & Adversarial Vectors |
| :--- | :--- | :--- |
| **Scanner & Payloads** | `src/test/fuzz-scanner-payloads.test.ts` | Null bytes (`\x00`), Unicode control characters, RTL overrides (`\u202E`), zero-width spaces (`\u200B`), nested schemes, octal/hex IP notations, corrupted vCards/Wi-Fi strings, 100KB oversized payloads. |
| **Provider Data & Network** | `src/test/fuzz-external-providers-data.test.ts` | WAF HTML error pages, truncated JSON, type-inverted responses, 30-level nested trees, prototype pollution objects, deceptive/cyclic redirect chains. |
| **Backup & Imports** | `src/test/fuzz-backup-imports.test.ts` | Truncated/corrupted JSON, negative counts, schema version overflows (`v99999`), prototype pollution vectors, oversized archive rejection (>50MB). |
| **Risk Engine & Synthesis** | `src/test/fuzz-risk-correlation-engine.test.ts` | Property-based invariant verification ($0 \le \text{Score} \le 100$, $0.0 \le \text{Confidence} \le 1.0$), extreme finding distributions (0 vs 500), multi-source conflicts, 1,000-finding deduplication performance. |

---

## 📐 Mathematical & Property Invariants

The fuzzing suites enforce strict mathematical and architectural invariants:

$$\forall \text{ Inputs } x, \quad 0 \le \text{RiskEngine.evaluate}(x).\text{score} \le 100$$
$$\forall \text{ Inputs } x, \quad 0.0 \le \text{RiskEngine.evaluate}(x).\text{confidenceScore} \le 1.0$$
$$\forall \text{ Inputs } x, \quad \text{Object.prototype.polluted} = \text{undefined}$$

---

## 🔄 Bug Reproduction & Regression Lifecycle

When a crash or anomaly is discovered through fuzzing:

```text
┌──────────────┐      ┌─────────────┐      ┌─────────────┐      ┌──────────────┐
│ Fuzz Finding │ ───► │   Minimal   │ ───► │ Fix & Patch │ ───► │  Regression  │
│  Discovered  │      │ Reproduction│      │ Vulnerability│     │  Test Added  │
└──────────────┘      └─────────────┘      └─────────────┘      └──────────────┘
```

1. **Capture & Isolate**: Extract the minimal payload seed that triggered the anomaly.
2. **Root Cause Analysis**: Identify whether the failure is in sanitization, normalization, schema validation, or error boundary containment.
3. **Remediation**: Implement defensive checks, length guards, or type validations.
4. **Regression Protection**: Add a permanent test case to the corresponding suite in `src/test/` to prevent future regressions.

---

## 🚀 Running Fuzz Tests Locally

```bash
# Run all fuzzing suites
npx vitest run src/test/fuzz-*.test.ts

# Run specific fuzz target
npx vitest run src/test/fuzz-scanner-payloads.test.ts
```
