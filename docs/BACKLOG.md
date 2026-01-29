# Boost — Build Backlog

## Week 1 — MVP that can run a pilot
### Backend (FastAPI)
- [ ] Data models + Firestore client
- [ ] Offer CRUD
- [ ] Claim endpoint (issue redeem token)
- [ ] Redemption endpoints (scan QR / manual code)
- [ ] Idempotency + token expiry
- [ ] Ledger entries (per redemption)

### Merchant web (Next.js)
- [ ] Auth (magic link or Firebase)
- [ ] Create/pause offers
- [ ] QR scanner redemption page
- [ ] Manual code entry redemption page
- [ ] Dashboard (today/all-time redemptions, owed amount)

### Consumer web (Next.js)
- [ ] Nearby offers list
- [ ] Offer detail + claim
- [ ] QR display + short code
- [ ] Basic SEO city page(s)

## Week 2 — Operability + monetization loop
- [ ] Admin console (you can onboard merchants quickly)
- [ ] CSV export for billing
- [ ] Fraud flags + basic alerts
- [ ] Better reporting to merchants
- [ ] Growth loop hooks (share offer, invite merchant)

## Explicitly not now
- Native apps
- Complicated attribution (beyond redemption)
- Paid ads automation
- Full Stripe billing (do after pilot proves demand)
