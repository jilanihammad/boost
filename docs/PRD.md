# Boost — PRD (v0)

## Goal
Build a **performance-only** local growth product where merchants pay **per verified redemption**.

## Target users
- **Merchants**: coffee shops, restaurants, quick service, local services (Seattle to start)
- **Consumers**: deal-seekers within a city/neighborhood

## Success criteria (pilot)
- 3 pilot merchants live in Seattle
- ≥30 verified redemptions across 2 weeks
- ≥2 merchants agree to continue post-pilot (repeat campaign or expand)

## Core value proposition
- Merchants pay only for verified outcomes (redemptions), not impressions.

## Product flows
### Consumer
1. Open Boost (web)
2. Browse nearby offers (location-based + SEO city pages)
3. Claim offer → receive **QR + short code**
4. Present QR at register

### Merchant
1. Create offer (title, terms, cap, hours)
2. At register: scan customer QR (primary) OR enter code (backup)
3. See dashboard (redemptions, owed amount, history)

## Fraud / integrity requirements (v0)
- Redemption is **idempotent** (token can only be redeemed once)
- Rate limits:
  - 1 redemption per user per merchant per day (configurable)
  - max redemptions/day per offer
- Time windows:
  - optional hours-of-day allowed
  - token expiry (e.g., 30 minutes after claim)
- Basic anomaly flags (later): repeated redemptions from same device/IP, unusually high velocity

## Pricing model
- Default: $X paid to Boost per verified redemption (merchant-funded)
- Optional later: split with consumer as cashback

## MVP scope
### Must-have
- Merchant onboarding (admin-created OK for v0)
- Offer CRUD
- Consumer nearby offers list + offer detail
- Claim flow (QR + short code)
- Merchant redemption flow (scan + manual)
- Ledger
- Simple reporting export

### Not in v0
- Native mobile apps
- Complex attribution beyond redemption
- Ad network integrations
- Automated merchant billing/payouts (manual invoice is fine v0)

## Open questions
- Bounty: $/redemption vs % ticket
- Offer types: $ off vs free item
- Merchant locations: single vs multi-location v0
