# URL Safety Analysis API

<cite>
**Referenced Files in This Document**
- [url-safety.ts](file://src/lib/url-safety.ts)
- [types.ts](file://src/lib/scan/types.ts)
- [ResultSheet.tsx](file://src/components/ResultSheet.tsx)
- [Scan.tsx](file://src/pages/Scan.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)
10. [Appendices](#appendices)

## Introduction
This document provides comprehensive API documentation for the URL safety analysis system, focusing on the analyzeUrlSafety function and its threat detection capabilities. It explains how URLs are evaluated for malicious patterns, phishing indicators, brand impersonation attempts, insecure transport (HTTP), and credential exposure. The document also details the SafetyResult interface, risk classification rules, heuristic-based detection algorithms, customization options, and practical usage examples.

## Project Structure
The URL safety feature is implemented as a lightweight, client-side module that can be imported by any component or page. It is used within the scanning workflow to evaluate scanned content when it represents a URL.

```mermaid
graph TB
A["Scan.tsx<br/>Scanning workflow"] --> B["url-safety.ts<br/>analyzeUrlSafety()"]
B --> C["types.ts<br/>SafetyStatus type"]
A --> D["ResultSheet.tsx<br/>Display warnings and actions"]
```

**Diagram sources**
- [Scan.tsx:50-72](file://src/pages/Scan.tsx#L50-L72)
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)
- [ResultSheet.tsx:122-125](file://src/components/ResultSheet.tsx#L122-L125)

**Section sources**
- [Scan.tsx:50-72](file://src/pages/Scan.tsx#L50-L72)
- [url-safety.ts:1-106](file://src/lib/url-safety.ts#L1-L106)
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)
- [ResultSheet.tsx:122-125](file://src/components/ResultSheet.tsx#L122-L125)

## Core Components
- analyzeUrlSafety(rawUrl: string): SafetyResult
  - Purpose: Analyze a raw URL string and return a structured safety assessment with reasons.
  - Input: A single string representing a URL.
  - Output: An object containing:
    - level: One of "unchecked", "safe", "suspicious", "malicious"
    - reasons: Array of human-readable strings explaining findings

- SafetyResult
  - level: SafetyStatus
  - reasons: string[]

- SafetyStatus
  - Values: "unchecked" | "safe" | "suspicious" | "malicious"

Risk Classification Rules
- Immediate "malicious":
  - Dangerous protocols detected (e.g., javascript:, data:)
  - Brand impersonation detected
  - Embedded credentials detected
- Otherwise:
  - If three or more reasons are found: "malicious"
  - Else if one or two reasons are found: "suspicious"
  - Else: "safe"

Heuristic Checks Implemented
- Dangerous protocol check
- IP address host detection
- Punycode/homograph domain detection
- Excessive subdomain depth
- Suspicious TLD list
- URL shortener detection
- Brand impersonation detection
- Unencrypted HTTP protocol
- Embedded credentials via @username/password

Customization Options
- Suspicious TLDs: Configurable list of top-level domains considered suspicious.
- URL Shorteners: Configurable list of known shortener hosts.
- Brand Impersonation: Configurable mapping of brand names to their legitimate domains.

**Section sources**
- [url-safety.ts:3-6](file://src/lib/url-safety.ts#L3-L6)
- [url-safety.ts:8-25](file://src/lib/url-safety.ts#L8-L25)
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)

## Architecture Overview
The URL safety analysis integrates into the scanning pipeline. When a scan result contains a URL, the application computes a safety assessment and displays warnings accordingly.

```mermaid
sequenceDiagram
participant UI as "Scan.tsx"
participant Parser as "parseScanContent()"
participant Safety as "analyzeUrlSafety()"
participant Store as "IndexedDB"
participant View as "ResultSheet.tsx"
UI->>Parser : Parse scanned content
Parser-->>UI : {type, data}
alt type === "url"
UI->>Safety : analyzeUrlSafety(content)
Safety-->>UI : SafetyResult
UI->>Store : Save ScanRecord with safetyStatus
else
UI->>Store : Save ScanRecord without safetyStatus
end
UI->>View : Render result
View->>Safety : Re-evaluate safety for display
View-->>UI : Show warnings/actions based on level
```

**Diagram sources**
- [Scan.tsx:50-72](file://src/pages/Scan.tsx#L50-L72)
- [ResultSheet.tsx:122-125](file://src/components/ResultSheet.tsx#L122-L125)
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)

## Detailed Component Analysis

### Function: analyzeUrlSafety
- Signature: analyzeUrlSafety(rawUrl: string): SafetyResult
- Behavior:
  - Normalizes input and checks for dangerous protocols early.
  - Parses the URL; if parsing fails, returns safe with no reasons.
  - Applies multiple heuristics to collect reasons.
  - Classifies the final level based on criticality and count of reasons.

Key Heuristics and Threat Categories
- Malicious URL Detection
  - Dangerous protocols (javascript:, data:)
  - IP address hosts
  - Excessive subdomains
  - Suspicious TLDs
  - URL shorteners
- Phishing Attempt Identification
  - Brand impersonation (domain mentions brand but not official)
  - Punycode/homograph domains
  - Embedded credentials (@username/password)
- SSL/TLS Validation
  - Detects unencrypted HTTP connections (no HTTPS)
  - Note: Actual certificate validation is not performed
- Credential Exposure Alerts
  - Flags embedded credentials in URL

Return Value Structure
- level: SafetyStatus
- reasons: string[] describing each finding

Risk Classification System
- Critical triggers:
  - Dangerous protocol
  - Brand impersonation
  - Embedded credentials
- Threshold:
  - Three or more reasons => "malicious"
  - Fewer than three reasons => "suspicious"
  - No reasons => "safe"

Practical Examples
- Safe URL:
  - Example: https://example.com/page
  - Expected level: "safe"
- Suspicious URL:
  - Example: http://example.xyz/path
  - Expected level: "suspicious" (unencrypted + suspicious TLD)
- Malicious URL:
  - Example: javascript:alert(1)
  - Expected level: "malicious" (dangerous protocol)
- Brand Impersonation:
  - Example: https://paypa1-login.example.net
  - Expected level: "malicious" (brand impersonation)
- Embedded Credentials:
  - Example: https://user:pass@example.com
  - Expected level: "malicious" (embedded credentials)

Usage Patterns
- In scanning flow:
  - Compute safety status only for URL-type scans
  - Persist safetyStatus alongside scan record
- In result view:
  - Re-compute safety for display and render warnings and action buttons

**Section sources**
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)
- [Scan.tsx:50-72](file://src/pages/Scan.tsx#L50-L72)
- [ResultSheet.tsx:122-125](file://src/components/ResultSheet.tsx#L122-L125)

#### Heuristic Flowchart
```mermaid
flowchart TD
Start(["Function Entry"]) --> Normalize["Normalize input and trim"]
Normalize --> CheckDangerous{"Dangerous protocol?"}
CheckDangerous --> |Yes| ReturnMalicious["Return 'malicious' with reason"]
CheckDangerous --> |No| ParseURL["Parse URL"]
ParseURL --> ParseOK{"Parsed OK?"}
ParseOK --> |No| ReturnSafe["Return 'safe' with no reasons"]
ParseOK --> |Yes| ExtractHost["Extract hostname"]
ExtractHost --> Heuristics["Run heuristics:<br/>IP host, punycode, deep subdomains,<br/>suspicious TLD, shortener,<br/>brand impersonation, HTTP, credentials"]
Heuristics --> CountReasons["Count reasons"]
CountReasons --> AnyCritical{"Any critical reason?"}
AnyCritical --> |Yes| SetMalicious["Set level='malicious'"]
AnyCritical --> |No| Threshold{"reasons >= 3?"}
Threshold --> |Yes| SetMalicious
Threshold --> |No| SetSuspicious["Set level='suspicious'"]
SetMalicious --> ReturnResult["Return SafetyResult"]
SetSuspicious --> ReturnResult
ReturnSafe --> End(["Function Exit"])
ReturnMalicious --> End
ReturnResult --> End
```

**Diagram sources**
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)

### Interface: SafetyResult
- Fields:
  - level: SafetyStatus
  - reasons: string[]
- Usage:
  - Returned by analyzeUrlSafety
  - Consumed by UI components to render warnings and control actions

**Section sources**
- [url-safety.ts:3-6](file://src/lib/url-safety.ts#L3-L6)

### Type: SafetyStatus
- Values:
  - "unchecked": Not analyzed
  - "safe": No issues detected
  - "suspicious": Some issues detected
  - "malicious": Critical issues detected

**Section sources**
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)

### Integration Points
- Scanning Workflow
  - Computes safetyStatus for URL-type scans and persists it
- Result Display
  - Re-evaluates safety for rendering warnings and dynamic button states

**Section sources**
- [Scan.tsx:50-72](file://src/pages/Scan.tsx#L50-L72)
- [ResultSheet.tsx:122-125](file://src/components/ResultSheet.tsx#L122-L125)

## Dependency Analysis
The URL safety module depends on a shared type definition and is consumed by UI components.

```mermaid
graph LR
Types["types.ts<br/>SafetyStatus"] --> Safety["url-safety.ts<br/>analyzeUrlSafety()"]
Safety --> ResultSheet["ResultSheet.tsx<br/>Display logic"]
Safety --> ScanPage["Scan.tsx<br/>Workflow integration"]
```

**Diagram sources**
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)
- [url-safety.ts:1-6](file://src/lib/url-safety.ts#L1-L6)
- [ResultSheet.tsx:26-26](file://src/components/ResultSheet.tsx#L26-L26)
- [Scan.tsx:8-8](file://src/pages/Scan.tsx#L8-L8)

**Section sources**
- [url-safety.ts:1-6](file://src/lib/url-safety.ts#L1-L6)
- [types.ts:28-28](file://src/lib/scan/types.ts#L28-L28)
- [ResultSheet.tsx:26-26](file://src/components/ResultSheet.tsx#L26-L26)
- [Scan.tsx:8-8](file://src/pages/Scan.tsx#L8-L8)

## Performance Considerations
- Time Complexity: O(n) where n is proportional to the number of heuristics and string operations (hostname splitting, substring checks).
- Space Complexity: O(k) for storing reasons, where k is small and bounded by the number of heuristics.
- Early Returns: Dangerous protocols and invalid URLs exit quickly to avoid unnecessary processing.
- UI Recomputation: The result view recomputes safety for display; consider memoization if performance becomes an issue.

[No sources needed since this section provides general guidance]

## Troubleshooting Guide
Common Issues and Resolutions
- Invalid URL Input:
  - Behavior: Returns "safe" with no reasons
  - Resolution: Validate inputs before calling the analyzer or handle empty results gracefully
- False Positives:
  - Symptoms: Legitimate sites flagged due to shorteners or suspicious TLDs
  - Resolution: Customize lists (shorteners, TLDs) and brand mappings to reduce noise
- Missing HTTPS Warnings:
  - Symptom: Only HTTP is flagged; actual TLS certificate errors are not checked
  - Resolution: Integrate additional network checks if required by your security policy
- Brand Impersonation Accuracy:
  - Symptom: Missed or over-flagged brands
  - Resolution: Update brand-to-domain mappings to reflect current official domains

Operational Tips
- Use safetyStatus from stored records to avoid repeated computation
- Present reasons to users clearly and provide actionable guidance
- For high-risk levels, consider blocking or requiring explicit user confirmation

**Section sources**
- [url-safety.ts:31-105](file://src/lib/url-safety.ts#L31-L105)
- [ResultSheet.tsx:84-109](file://src/components/ResultSheet.tsx#L84-L109)

## Conclusion
The URL safety analysis API provides a concise, efficient, and extensible mechanism for evaluating URLs against common threat patterns. It balances usability with security by offering clear risk levels and actionable reasons. Teams can tailor detection sensitivity through configurable lists and brand mappings while integrating seamlessly into scanning workflows and result displays.

[No sources needed since this section summarizes without analyzing specific files]

## Appendices

### API Reference Summary
- Function
  - analyzeUrlSafety(rawUrl: string): SafetyResult
- Interfaces
  - SafetyResult { level: SafetyStatus; reasons: string[] }
- Types
  - SafetyStatus = "unchecked" | "safe" | "suspicious" | "malicious"

### Customization Configuration
- Suspicious TLDs: Extend or modify the list to align with organizational risk tolerance
- URL Shorteners: Add or remove known shortener hosts
- Brand Impersonation: Maintain accurate mappings of brand names to official domains

### Practical Usage Examples
- Basic call:
  - const result = analyzeUrlSafety("https://example.com");
  - Inspect result.level and result.reasons
- Conditional handling:
  - If result.level === "malicious", block navigation or prompt user
  - If result.level === "suspicious", show warning and allow optional continuation
  - If result.level === "safe", proceed normally

[No sources needed since this section provides general guidance]