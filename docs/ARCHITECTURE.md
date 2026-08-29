# ScanIQ architecture

## Layers

```text
camera / image / manual input
        v
  scanner-service        decode -> raw payload + format
        v
  scan/parser            classify content type + structured fields
        v
  osint/buildArtifact    normalize + decompose (URL parts, query, host)
        v
  osint/investigate      run offline analyzer registry
        v
  osint/scoreFindings    weighted, explainable risk score
        v
  UI: investigation report + local case history (Dexie)
```

## Modules

| Path | Responsibility |
| --- | --- |
| `src/lib/scanner-service.ts` | Camera lifecycle, torch, zoom, file decoding. No analysis. |
| `src/lib/scan/parser.ts` | Content-type classification and field extraction. |
| `src/lib/osint/types.ts` | Domain model: `Artifact`, `Finding`, `RiskScore`, `Investigation`, `Analyzer`, `IntelProvider`. |
| `src/lib/osint/analyzers.ts` | Analyzer registry, artifact builder, scoring. Pure and offline. |
| `src/lib/url-safety.ts` | Legacy URL heuristics, wrapped by the `url-heuristics` analyzer. |
| `src/lib/db.ts` | Dexie case store. Unlimited, local, user-clearable. |
| `src/lib/settings.ts` | Zustand settings. Privacy-hostile options default to off. |

## Analyzer contract

An analyzer is a pure function over an `Artifact`:

- must not perform network, storage, or clipboard I/O;
- returns zero or more `Finding`s, each with `category`, `severity`, `title`, `rationale`,
  and — where possible — the exact `evidence` string;
- may declare `appliesTo` content types; omitting it means "all".

Add one by appending to `ANALYZERS` in `src/lib/osint/analyzers.ts`.

## Scoring

Severity weights: `info 0`, `low 8`, `medium 20`, `high 35`, `critical 60`.
The score is the capped sum of contributions, retained per finding in
`RiskScore.contributions` so the UI can show exactly why a verdict was reached.

Verdict thresholds: `>= 60 malicious`, `>= 25 suspicious`, `> 0 notable`, otherwise `clean`.

## Online enrichment

`IntelProvider` is the only sanctioned network surface. Providers are opt-in
(`settings.onlineEnrichment`), must declare `dataLeavingDevice`, and must fail closed when
offline. No provider ships enabled.

## Non-goals

- Accounts, cloud sync, or server-side storage.
- Paid tiers or feature gating.
- Automatic execution of scanned payloads.
