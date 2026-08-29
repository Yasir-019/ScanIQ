# ScanIQ — open-source QR & barcode OSINT toolkit

**Scan. Analyze. Verify.**

ScanIQ is a free, open-source, privacy-first tool for inspecting QR codes and barcodes
before you trust them. It is built for privacy-conscious users, cybersecurity students,
OSINT researchers, and security professionals.

## Product direction

A consumer scanner asks *"what does this code do?"* and does it. ScanIQ asks
*"what is this code, who is behind it, and should you trust it?"* — and shows its work.

Core principles:

1. **Every code is untrusted input.** Nothing is opened, connected to, or executed automatically
   unless the user explicitly opts in.
2. **Local-first and offline by default.** All analysis runs on-device. No accounts, no backend,
   no telemetry unless enabled.
3. **Explainable, not magic.** Every verdict is a set of findings with evidence, a rationale,
   and a documented score weight.
4. **Auditable.** MIT licensed. Heuristics and scoring live in the repo so they can be reviewed
   and challenged.
5. **No paywalls.** There is no paid tier, no feature gating, no upsell.

## What ScanIQ does

- Multi-format scanning (QR, EAN, UPC, Code 39/93/128, ITF, Data Matrix, PDF417, Aztec) via
  camera, image file, or manual entry.
- Artifact decomposition: scheme, host, registrable domain, port, path, query parameters.
- Offline threat analysis across seven categories: transport, identity, obfuscation,
  infrastructure, payload, credential, and privacy.
- Explainable risk scoring (0–100) with a verdict of clean / notable / suspicious / malicious.
- Local case history with search, favourites, and CSV evidence export.
- Full i18n (8 languages, incl. RTL) and installable PWA / offline support.

## What was intentionally removed

- The QR code **generator** and app-promotion QR screen (generic consumer features).
- The **Pro tier**, simulated checkout, and history limits — the project is free forever.
- Telemetry now defaults to **off**.

## Roadmap

- Investigation report UI replacing the consumer result sheet.
- Redirect-chain unwrapping (offline heuristics + opt-in resolution).
- Opt-in `IntelProvider` implementations with explicit data-leaving-device disclosure.
- Signed, exportable investigation reports (JSON + CSV) for evidence handling.
- Analyzer test suite with a labelled malicious/benign corpus.

## Tech stack

React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Dexie (IndexedDB) · Zustand ·
`@zxing/browser` · react-i18next.

## Development

```bash
npm install
npm run dev
```

## License

MIT.
