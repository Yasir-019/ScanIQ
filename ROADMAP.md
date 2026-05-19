# ScanIQ — Production Roadmap & Success Metrics

This document outlines the prioritized action plan for moving Scan Pro from its current optimized state to a fully production-ready, revenue-generating product.

## Phase 1: Security & Compliance (High Priority)
- [x] **CSP Implementation**: Content Security Policy headers added to prevent XSS.
- [ ] **Data Encryption**: Implement at-rest encryption for IndexedDB using `dexie-encrypted` or similar.
- [ ] **Privacy & Terms**: Finalize Legal pages and link them in the Profile/Onboarding.
- [ ] **GDPR/CCPA Audit**: Ensure all data collection (analytics) is compliant and provides opt-out.

## Phase 2: Monetization & Growth (Medium Priority)
- [x] **Pro Tier Logic**: Core state management for Pro status implemented.
- [ ] **Payment Integration**: Integrate Stripe/LemonSqueezy for subscription handling.
- [ ] **Cloud Sync**: Implement backend (Supabase/Firebase) for Pro users to sync history across devices.
- [ ] **AI Insights**: Connect to LLM API (Gemini/OpenAI) for the "Explain" feature.

## Phase 3: Infrastructure & Scale (Medium Priority)
- [ ] **Monitoring**: Setup Sentry for error tracking and performance monitoring.
- [ ] **Analytics**: Integrate PostHog or Amplitude for tracking LTV, CAC, and conversion funnels.
- [x] **CI/CD**: Configure automated build/deploy via GitHub Actions.
- [ ] **A/B Testing**: Implement feature flags for testing different pricing models.

## Success Metrics
| Metric | Target (Q1) | Method |
|--------|-------------|--------|
| **Reload Time** | < 1.5s | Lighthouse / WebVitals |
| **Conversion Rate** | > 2% | Stripe / Analytics |
| **Churn Rate** | < 5% | Subscription Dashboard |
| **User Growth** | 10k MAU | Acquisition Funnel |
| **System Uptime** | 99.9% | UptimeRobot / Sentry |

---
*Last Updated: 2026-05-19*
