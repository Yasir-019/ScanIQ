
# ScanIQ — Smart Scanner App (Capacitor + Web)

A modern, fast QR + barcode scanner shipped as a single React/Vite codebase you can preview in the browser today and wrap into a real Android `.apk`/`.aab` with Capacitor when you're ready for the Play Store. Built with Lovable Cloud (auth, DB, edge functions), Lovable AI (smart features), and Stripe (Pro tier).

---

## 1. App identity
- **Name suggestions:** ScanIQ, Scanly, PulseScan, QRWise, Lensr
- **Value prop:** "Scan anything. Understand instantly." Not just a reader — flags risky links, looks up products, and explains what you scanned.
- **Audience:** Everyday users, shoppers, small business owners, security-conscious users
- **Edge vs competitors:** AI explanations, malicious-link warnings, and product lookup baked into a clean, ad-light UX

---

## 2. Screens & navigation

Bottom tab navigation with 4 tabs:
1. **Scan** (default) — full-screen camera with overlay, torch, gallery picker, manual entry
2. **History** — searchable list, favorites tab, swipe to delete, filter by type
3. **Generate** — pick type (URL, text, WiFi, vCard, email, SMS, phone) → live preview → save/share/download PNG
4. **Profile** — sign in, Pro upgrade, settings (sound, vibrate, auto-open URLs, theme), about

Plus modal/stack screens: **Scan Result**, **Onboarding** (3 slides + camera permission), **Paywall**, **Auth**, **QR Customizer**.

---

## 3. Core user flows

**First launch:** Splash → 3-slide onboarding (Scan / Smart actions / Privacy) → Camera permission → Scan tab. Auth is optional and deferred.

**Scanning:** Open Scan tab → live camera with reticle overlay → on detect: haptic + sound → Result sheet slides up showing parsed type, value, smart actions (Open, Copy, Share, Save Contact, Connect WiFi), AI explain button, and safety badge for URLs.

**History:** Auto-saves every scan locally. Signed-in users get cloud sync. Tap to reopen result, star to favorite, swipe to delete, long-press for bulk actions.

**Generate:** Choose type → fill form with validation → live QR preview → customize (color, background, logo, error correction — Pro) → download PNG / share / save to "My Codes."

---

## 4. Smart layer (AI + safety)

- **Malicious URL warning:** Heuristic check (IP-only URLs, punycode, suspicious TLDs, known shorteners, length anomalies) runs in an edge function; shows a red warning sheet before opening with "Open anyway" requiring a second tap.
- **Product lookup:** When EAN-8/13 or UPC-A/E detected, edge function queries Open Food Facts (free) and falls back to UPCitemdb. Result card shows product name, image, brand, category.
- **AI explain/summarize:** "What is this?" button on result screen calls Lovable AI (default `google/gemini-3-flash-preview`) via edge function — explains URLs, summarizes long text, identifies vCard/WiFi payloads in plain language. Streams token-by-token.

---

## 5. Freemium / Pro

- **Free:** Unlimited scanning, last 50 history items locally, basic generator, malicious URL warnings, 5 AI explains/day
- **Pro (Stripe subscription, monthly + yearly):** Unlimited cloud-synced history, bulk export (CSV), QR customization (colors, logo embed), unlimited AI explains, unlimited product lookups, no banner ad slot, priority generator types
- Paywall triggers: 51st history item, custom QR color picker, 6th AI call of the day, export button
- Stripe via Lovable's built-in Stripe payments (test mode immediately, live after account claim)

---

## 6. Tech & architecture

- **Frontend:** React 18 + Vite + TypeScript + Tailwind + shadcn/ui (already in project)
- **Routing:** React Router with bottom-tab layout
- **State:** React Query for server state, Zustand for local UI state, Dexie (IndexedDB) for offline history cache
- **Scanning:**
  - Web/PWA preview: `@zxing/browser` with `BarcodeDetector` API fallback
  - Capacitor build: `@capacitor-mlkit/barcode-scanning` (Google ML Kit, near-instant) — abstracted behind a `ScannerService` interface so the same UI works in both
- **QR generation:** `qrcode` lib + canvas for logo overlay
- **Backend (Lovable Cloud):**
  - Auth: email/password + Google
  - Tables: `profiles`, `user_roles`, `scans`, `favorites`, `generated_codes`, `subscribers`
  - RLS: users only see their own rows; roles via `has_role()` security-definer function
  - Edge functions: `check-url-safety`, `lookup-product`, `ai-explain` (streaming), `create-checkout`, `customer-portal`, `stripe-webhook`
- **Mobile wrap:** Capacitor config with `appId: app.lovable.bd8a6ecb3f924abcb68eed2dd875e450`, hot-reload server URL pointed at the sandbox preview during dev. After export to GitHub: `npm i && npx cap add android && npx cap sync && npx cap run android`.

---

## 7. Database (Lovable Cloud)

- `profiles` — id (FK auth.users), display_name, avatar_url, settings jsonb
- `user_roles` — id, user_id, role (enum: admin, user)
- `scans` — id, user_id, content, type, format, parsed jsonb, safety_status, scanned_at
- `favorites` — id, user_id, scan_id, created_at
- `generated_codes` — id, user_id, type, payload, style jsonb, created_at
- `subscribers` — user_id, stripe_customer_id, subscribed bool, tier, current_period_end

All tables: RLS enabled, owner-only policies, indexes on `user_id` + `scanned_at desc`.

---

## 8. Performance, security, accessibility

- Lazy-load Generate + History routes; scanner mounts only on Scan tab
- Throttle decode loop to ~10 fps; release camera on tab blur
- Service worker caches shell + last 50 scans for offline view
- Server-side Zod validation on every edge function input
- URL safety check runs server-side; never auto-open without user tap
- Large tap targets (≥44px), bottom-anchored actions for one-hand use, dark mode default with light toggle, reduced-motion support

---

## 9. Build phases

- **Phase 1 (MVP, this build):** Bottom-tab shell, scanner (web + Capacitor abstraction), result sheet with smart actions, local history + favorites, QR generator (basic), onboarding, dark theme
- **Phase 2:** Lovable Cloud auth + cloud sync, malicious URL warning, product lookup, AI explain
- **Phase 3:** Stripe Pro tier + paywall + customer portal, QR customization, bulk export
- **Phase 4:** Capacitor packaging instructions, Play Store assets, optional Apple/iOS

I'll execute Phase 1 + Phase 2 in the first implementation pass, then Phase 3, then prep Capacitor + Play Store guidance in Phase 4.
