# Boost — Architecture (v0)

## Design principles
- **Prove outcomes** (verified redemptions) over impressions.
- Keep v0 **simple + auditable**.
- Optimize for **SEO + social distribution** (TikTok/IG + city/neighborhood landing pages).

## High-level system
- **Consumer web (Next.js)**: offer discovery + claim + QR display
- **Merchant web (Next.js)**: offer management + QR scanner redemption
- **Backend API (FastAPI)**: verification + anti-fraud + ledger
- **Data store**: Firestore (v0) or Postgres (later)

## GCP recommendation (pragmatic)
Given your existing stack and desire for portability, the *default* best path is:
- **Cloud Run** for backend
- **Firestore** for v0 (fast iteration, simple admin)
- **Firebase Auth** for merchant/admin auth (consumer auth optional)
- **Secret Manager** for prod secrets

This is not “because GreenLens/Uplift did it” — it’s because it’s a strong speed/ops tradeoff for v0.

## Key data objects
- Merchant
- Location
- Offer (campaign)
- Claim (user claimed an offer)
- Redemption (verified redemption)
- LedgerEntry (money owed per redemption)

## Redemption model (recommended)
**Customer shows QR; merchant scans in merchant web app.**

Why: a customer-only scan is easy to spoof. Merchant confirmation is stronger.

Fallback: staff enters short code.

## API sketch
- `POST /api/v1/offers` (merchant)
- `GET /api/v1/offers?lat=..&lng=..` (consumer)
- `POST /api/v1/offers/{id}/claim` (consumer)
- `POST /api/v1/redemptions/scan` (merchant)
- `POST /api/v1/redemptions/code` (merchant)
- `GET /api/v1/ledger` (merchant)

## SEO strategy
- Static city pages: `/seattle`, `/seattle/capitol-hill`, etc.
- Offer pages with canonical URLs
- Structured data (later)

## Future-proofing
- Add a snapshot/evidence style contract for analytics later (for dashboards + reporting).
