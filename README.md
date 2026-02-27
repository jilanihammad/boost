# Boost

**Local businesses pay for ad impressions and clicks with no guarantee anyone actually walks through the door.** Boost flips the model: merchants pay only when a customer redeems an offer at the register, verified by QR scan.

Boost is a performance-based local offers platform. Merchants create discount offers, distribute QR codes via social media ads, and pay a fixed fee ($2–3) per verified redemption — not per impression, not per click.

**Live:** [boost-dev-3fabf.web.app](https://boost-dev-3fabf.web.app) (frontend) · [Cloud Run API](https://boost-api-985021868372.us-central1.run.app) (backend)

---

## How It Works

```
Merchant creates offer ("$2 off any coffee", 50/day cap)
         │
         ▼
Distributes universal QR code via TikTok/Instagram/Google Ads
         │
         ▼
Customer sees ad → visits store → shows QR at register
         │
         ▼
Staff scans QR (camera) or enters short code (manual fallback)
         │
         ▼
System validates: token active? daily cap not exceeded? offer not paused?
         │
         ▼
Redemption recorded → ledger updated → merchant owes $X per verified visit
```

**The key difference from traditional ads:** merchants know exactly how many customers came in and pay only for verified outcomes.

## What's Built

This is an early-stage product (10 commits) with a working end-to-end flow deployed to production:

- **Three-tier RBAC** — owner → merchant_admin → staff, via Firebase custom claims
- **Offer management** — CRUD with daily cap, active hours, pause/resume
- **Universal reusable QR tokens** — one code per offer, unlimited redemptions bounded by daily cap
- **Redemption flow** — camera-based QR scanning + manual code entry fallback
- **Merchant dashboard** — KPI cards (today's redemptions, WTD count, amount owed), charts (redemptions by day, method split), redemption history table
- **Admin panel** — merchant CRUD, offer management, QR generation/download, user management with invites
- **Ledger tracking** — per-merchant billing with redemption-level line items
- **Deployed** — Firebase Hosting (frontend) + Cloud Run (backend) + Firestore (data)

## Architecture

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend | Next.js 16, React 19, Tailwind 4, shadcn/ui, Recharts | Firebase Hosting |
| Backend | FastAPI (Python 3.11), Pydantic | Cloud Run |
| Database | Firestore (7 collections) | GCP |
| Auth | Firebase Auth (Google OAuth + email-link) | Firebase |
| QR | @zxing/browser (scan), qrcode + Pillow (generate) | — |

## Data Model

Seven Firestore collections: `merchants`, `offers`, `redemption_tokens`, `redemptions`, `ledger_entries`, `users`, `pending_roles`. See the full [README schema section](./README.md) for field-level detail.

## Pilot Target

- 3 pilot merchants in Seattle
- ≥30 verified redemptions across 2 weeks
- ≥2 merchants continue post-pilot

## What's Next

- Consumer-facing offer discovery (geo-based browse + SEO city pages)
- Stripe billing integration (currently manual invoicing)
- Fraud detection (repeated device/IP, velocity anomalies)
- Analytics dashboard with trends

## Quick Start

```bash
# Backend
cd apps/api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # set GOOGLE_APPLICATION_CREDENTIALS
uvicorn app.main:app --reload --port 8000

# Frontend
cd apps/web && npm install
cp .env.example .env.local  # set Firebase config + API URL
npm run dev  # → http://localhost:3000
```

Requires: Firebase project with Auth + Firestore enabled. See [Swagger docs](http://localhost:8000/docs) for API reference.

## License

Proprietary
