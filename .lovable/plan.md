
# Smart Action Scanner USP

## What Already Exists
The app already has solid foundations: content type detection (URL, Wi-Fi, vCard, email, SMS, phone, geo, product, text), type-specific actions in ResultSheet, URL safety analysis, and an auto-open URLs toggle. This plan builds on top of that.

## What Will Be Added

### 1. Action Learning System (`src/lib/action-stats.ts`)
A lightweight Zustand store (persisted to localStorage) that tracks how many times the user performs each action type (e.g. "open_url", "copy_text", "save_contact"). This data is used to sort and highlight the most relevant action as "primary" in the result sheet. No personal data is stored — just action counters.

### 2. Expanded Automation Settings
Add new toggles to `src/lib/settings.ts` and the Profile screen:
- **Auto-copy text** — automatically copy plain text scans to clipboard
- **Auto-connect Wi-Fi** — copy Wi-Fi password automatically on scan (true auto-connect is not possible from a web app)
- Safe links auto-open already exists via `autoOpenUrls`

### 3. Enhanced Smart Action Result Card (`src/components/ResultSheet.tsx`)
Redesign the result sheet to show a "Smart Action" card layout:
- Large primary action button (determined by content type + learning data)
- Secondary actions row below
- Type icon + detected type label at top
- Safety badge integrated inline
- "Translate" action for plain text scans (copies text and opens Google Translate)
- Payment QR detection (UPI/payment scheme URLs show a "Payment detected" badge)

### 4. Payment QR Detection (`src/lib/scan/parser.ts`)
Add detection for UPI (`upi://`), PayPal (`https://paypal.me/`), and other payment scheme URLs. New content type: `payment`. The result sheet will show a "Payment detected" card with the amount/recipient if parseable, plus a safe "Open payment app" action.

### 5. Auto-Actions on Scan (`src/pages/Scan.tsx`)
After a successful scan, before showing the result sheet:
- If text + auto-copy enabled → copy to clipboard, show toast
- If Wi-Fi + auto-connect enabled → copy password, show toast  
- If safe URL + auto-open enabled → open link (already partially implemented)
- Track the action in the learning store

### 6. i18n Updates
Add new translation keys to all 8 locale files for: automation setting labels, smart action labels, payment type, translate action.

## Files to Create
- `src/lib/action-stats.ts` — action frequency tracker store

## Files to Edit
- `src/lib/settings.ts` — add `autoCopyText`, `autoConnectWifi` settings
- `src/lib/scan/types.ts` — add `"payment"` to `ScanContentType`
- `src/lib/scan/parser.ts` — add payment URL detection
- `src/components/ResultSheet.tsx` — smart action card redesign, learning integration, translate action, payment display
- `src/pages/Scan.tsx` — auto-action execution after scan
- `src/pages/Profile.tsx` — new automation toggles
- All 8 locale JSON files — new translation keys

## Technical Details

**Action stats store shape:**
```typescript
interface ActionStats {
  counts: Record<string, number>;  // e.g. { open_url: 42, copy_text: 15 }
  record: (action: string) => void;
  topAction: (type: ScanContentType) => string;
}
```

**Payment detection regex:**
`/^upi:\/\//i` for UPI, hostname checks for paypal.me, venmo, cash.app

**Primary action selection logic:**
Each content type has a default primary action. The learning system can override it if the user has performed an alternative action 3+ more times than the default for that type.

**Translate action:**
Opens `https://translate.google.com/?sl=auto&tl={userLang}&text={encoded}` in a new tab. Available for `text` type scans.
