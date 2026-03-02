# Boost

Performance-based local offers platform. Merchants pay only when a customer redeems an offer at the register, verified by QR scan. Not per impression, not per click.

**Live:** [boost-dev-3fabf.web.app](https://boost-dev-3fabf.web.app) (frontend) · [Cloud Run API](https://boost-api-985021868372.us-central1.run.app) (backend)

## How It Works

```
Merchant creates offer ("$2 off any coffee", 50/day cap)
    → Distributes universal QR code via social media ads
    → Customer visits store, shows QR at register
    → Staff scans QR (camera) or enters short code (fallback)
    → System validates: token active? cap reached? offer paused?
    → Redemption recorded, ledger updated, merchant owes $2-3 per verified visit
```

## What's Built

Early-stage product with a working end-to-end flow deployed to production:

- Three-tier RBAC: owner, merchant_admin, staff (Firebase custom claims)
- Offer management with daily caps, active hours, pause/resume
- Universal reusable QR tokens: one code per offer, unlimited redemptions within daily cap
- Redemption flow: camera-based QR scanning + manual code entry fallback
- Merchant dashboard: KPI cards, redemption charts, history table
- Admin panel: merchant CRUD, offer management, QR generation/download, user invites
- Per-merchant ledger with redemption-level line items

## Architecture

| Component | Technology | Hosting |
|-----------|-----------|---------|
| Frontend | Next.js 16, React 19, Tailwind 4, shadcn/ui, Recharts | Firebase Hosting |
| Backend | FastAPI (Python 3.11), Pydantic | Cloud Run |
| Database | Firestore (7 collections) | GCP |
| Auth | Firebase Auth (Google OAuth + email-link) | Firebase |
| QR | @zxing/browser (scan), qrcode + Pillow (generate) | - |

## What's Next

- Consumer-facing offer discovery (geo-based browse + SEO city pages)
- Stripe billing integration (currently manual invoicing)
- Fraud detection (repeated device/IP, velocity anomalies)

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

Requires a Firebase project with Auth + Firestore enabled. See [Swagger docs](http://localhost:8000/docs) for API reference.

## License

Proprietary
