# Boost

**Boost** is a performance-based local growth product: merchants pay **per verified redemption** (no upfront SaaS fee).

## What it is (v0)
- **Consumer web**: find nearby offers, claim, show QR at register
- **Merchant web**: create offers, scan QR to redeem (manual code backup)
- **Backend**: verifies redemption, prevents fraud, tracks a ledger (what merchant owes)

## Repo layout
- `apps/web` — Next.js (TypeScript) responsive web app
- `apps/api` — FastAPI backend (Firebase Admin token verification)
- `docs/*` — PRD / Architecture / Runbook / Backlog

## Local development

### 1) Web (Next.js)

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Routes (v0 placeholders):
- `/login` — Firebase Auth (Google + email-link)
- `/dashboard` — requires auth
- `/redeem` — requires auth
- `/admin` — requires auth + `role=admin` custom claim

> Role-based redirects are placeholders: the app reads `role` from Firebase custom claims and defaults to `consumer`.

### 2) API (FastAPI)

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Option A: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON file
# Option B: set FIREBASE_SERVICE_ACCOUNT_JSON to the full JSON contents

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Endpoints (stubs, auth required):
- `GET /offers`
- `POST /claim`
- `POST /redeem`
- `GET /ledger`

Auth:
- Send `Authorization: Bearer <firebase_id_token>`

## Docs
- `docs/PRD.md` — v0 spec + scope
- `docs/ARCHITECTURE.md` — system design + data model + flows
- `docs/RUNBOOK.md` — how to operate a pilot (onboard merchants, fraud checks, payouts)
- `docs/BACKLOG.md` — build plan

## Status
- v0 scaffolding in place (web + api). Next: implement offer CRUD, claim/redeem flows, and custom-claims role management.
