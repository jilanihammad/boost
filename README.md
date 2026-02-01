# Boost

**Live Demo:** https://boost-dev-3fabf.web.app
**API Endpoint:** https://boost-api-985021868372.us-central1.run.app

**Boost** is a performance-based local marketing platform where small businesses pay only for verified customer redemptions - no upfront fees, no impressions, just results.

---

## Table of Contents

1. [What is Boost?](#what-is-boost)
2. [How It Works](#how-it-works)
3. [Architecture Overview](#architecture-overview)
4. [Tech Stack](#tech-stack)
5. [Repository Structure](#repository-structure)
6. [Roles & Permissions (RBAC)](#roles--permissions-rbac)
7. [Firebase Custom Claims](#firebase-custom-claims)
8. [Data Models](#data-models)
9. [API Reference](#api-reference)
10. [Frontend Pages](#frontend-pages)
11. [Key Code Files](#key-code-files)
12. [Local Development](#local-development)
13. [Environment Variables](#environment-variables)
14. [Deployment](#deployment)
15. [Bootstrap & First-Time Setup](#bootstrap--first-time-setup)
16. [Current Status](#current-status)
17. [Troubleshooting](#troubleshooting)

---

## What is Boost?

Boost solves a problem for local businesses: traditional advertising charges for impressions or clicks, but doesn't guarantee customers actually show up. Boost flips this model:

- **Merchants** create discount offers (e.g., "$2 off any coffee")
- **Customers** receive QR codes via social media ads (TikTok, Instagram, Google Ads)
- **Staff** scans QR codes at the register to verify redemption
- **Merchants pay only** when a redemption is verified - typically $2-3 per redemption

### Value Proposition

| Traditional Ads | Boost |
|----------------|-------|
| Pay for impressions | Pay for redemptions |
| No tracking | Verified at register |
| Hope customers come | Know they came |
| Upfront costs | Pay-per-result |

---

## How It Works

### User Flow Diagram

```
+-----------------------------------------------------------------------+
|                           BOOST FLOW                                   |
+-----------------------------------------------------------------------+
|                                                                        |
|  1. ADMIN SETUP                                                        |
|     +----------+    +----------+    +----------+                       |
|     | Create   |--->| Create   |--->| Generate |                       |
|     | Merchant |    | Offer    |    | QR Codes |                       |
|     +----------+    +----------+    +----------+                       |
|                                           |                            |
|  2. DISTRIBUTION                          v                            |
|     +---------------------------------------------+                    |
|     |  Merchant posts QR codes on social media    |                    |
|     |  (TikTok, Instagram, Google Ads)            |                    |
|     +---------------------------------------------+                    |
|                                           |                            |
|  3. REDEMPTION                            v                            |
|     +----------+    +----------+    +----------+                       |
|     | Customer |--->| Staff    |--->| System   |                       |
|     | shows QR |    | scans QR |    | verifies |                       |
|     +----------+    +----------+    +----------+                       |
|                                           |                            |
|  4. TRACKING                              v                            |
|     +---------------------------------------------+                    |
|     |  Dashboard shows redemptions + amount owed  |                    |
|     +---------------------------------------------+                    |
|                                                                        |
+-----------------------------------------------------------------------+
```

### Step-by-Step

1. **Owner creates a merchant** in the system with business details
2. **Owner creates an offer** for the merchant (e.g., "$2 off any coffee", 50/day cap)
3. **Owner generates QR codes** - each code is unique and single-use
4. **Merchant downloads QR codes** and posts them on social media ads
5. **Customer sees ad**, screenshots or saves QR code
6. **Customer visits store** and shows QR on their phone
7. **Staff opens /redeem page**, scans QR with camera (or enters code manually)
8. **System validates**: Is token valid? Not expired? Not already used? Offer still active?
9. **System records redemption** and adds to merchant's ledger
10. **Merchant sees dashboard** with redemption count and amount owed

---

## Architecture Overview

```
+-----------------------------------------------------------------------+
|                         ARCHITECTURE                                   |
+-----------------------------------------------------------------------+
|                                                                        |
|   +-------------+         +-------------+         +-------------+      |
|   |   BROWSER   |         |   BACKEND   |         |  DATABASE   |      |
|   |  (Next.js)  |<------->|  (FastAPI)  |<------->| (Firestore) |      |
|   +-------------+   REST  +-------------+         +-------------+      |
|         |                       |                                      |
|         |                       |                                      |
|         v                       v                                      |
|   +-------------+         +-------------+                              |
|   |  Firebase   |         |  Firebase   |                              |
|   |    Auth     |<------->|   Admin     |                              |
|   |  (Client)   |  verify |   (Server)  |                              |
|   +-------------+  token  +-------------+                              |
|                                                                        |
|   Hosting:                                                             |
|   - Frontend: Firebase Hosting (boost-dev-3fabf.web.app)               |
|   - Backend: Cloud Run (boost-api-*.run.app)                           |
|                                                                        |
+-----------------------------------------------------------------------+
```

### Components

| Component | Technology | Purpose | URL |
|-----------|------------|---------|-----|
| Frontend | Next.js 16 + React 19 | Merchant dashboard, QR scanner, admin panel | https://boost-dev-3fabf.web.app |
| Backend | FastAPI (Python 3.11) | REST API, business logic, Firestore access | https://boost-api-985021868372.us-central1.run.app |
| Database | Firestore | Merchants, offers, tokens, redemptions, ledger, users | GCP Console |
| Auth | Firebase Auth | Google OAuth, email-link sign-in, custom claims | Firebase Console |
| Hosting | Firebase Hosting | Static frontend hosting | Firebase Console |
| API Hosting | Cloud Run | Containerized backend | GCP Console |

---

## Tech Stack

### Frontend (`apps/web`)

| Package | Version | Purpose |
|---------|---------|---------|
| next | 16.1.6 | React framework with App Router |
| react | 19.2.3 | UI library |
| typescript | 5.x | Type safety |
| tailwindcss | 4.x | Utility-first CSS |
| @radix-ui/* | various | Accessible UI primitives (shadcn/ui) |
| recharts | 2.x | Dashboard charts |
| @zxing/browser | 0.1.x | QR code scanning |
| firebase | 11.x | Client-side auth |
| lucide-react | latest | Icons |

### Backend (`apps/api`)

| Package | Version | Purpose |
|---------|---------|---------|
| fastapi | 0.115.8 | Modern Python web framework |
| uvicorn | 0.30.6 | ASGI server |
| firebase-admin | 6.5.0 | Server-side Firebase (auth + Firestore) |
| pydantic | 2.10.6 | Data validation |
| qrcode | 8.0 | QR code generation |
| pillow | latest | Image processing for QR codes |
| python-dotenv | latest | Environment variable loading |

---

## Repository Structure

```
boost/
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                  # App Router pages
│   │   │   │   ├── page.tsx              # Landing page (/)
│   │   │   │   ├── login/page.tsx        # Auth page (/login)
│   │   │   │   ├── dashboard/page.tsx    # Merchant dashboard (/dashboard)
│   │   │   │   ├── redeem/page.tsx       # QR scanner (/redeem)
│   │   │   │   ├── admin/page.tsx        # Admin panel (/admin)
│   │   │   │   ├── claim-role/page.tsx   # Role claim after invite (/claim-role)
│   │   │   │   ├── layout.tsx            # Root layout with providers
│   │   │   │   ├── providers.tsx         # Theme + Auth providers
│   │   │   │   └── globals.css           # Global styles + Tailwind
│   │   │   ├── components/
│   │   │   │   ├── ui/                   # shadcn/ui components (70+)
│   │   │   │   ├── boost-logo.tsx        # App logo
│   │   │   │   ├── status-badge.tsx      # Status indicators
│   │   │   │   ├── role-toggle.tsx       # Role display (Owner/Admin/Staff)
│   │   │   │   ├── theme-provider.tsx    # Dark mode provider
│   │   │   │   └── RequireRole.tsx       # Route protection by role
│   │   │   ├── hooks/
│   │   │   │   └── use-mobile.ts         # Mobile detection hook
│   │   │   └── lib/
│   │   │       ├── api.ts                # API client (typed fetch wrapper)
│   │   │       ├── auth.tsx              # Auth context + hooks (Firebase)
│   │   │       ├── firebase.ts           # Firebase client initialization
│   │   │       ├── utils.ts              # Utility functions (cn, etc.)
│   │   │       └── mock-data.ts          # Development mock data
│   │   ├── public/                       # Static assets
│   │   ├── .env.example                  # Example environment variables
│   │   ├── .env.local                    # Local dev config (git-ignored)
│   │   ├── .env.production.local         # Production API URL (git-ignored)
│   │   ├── firebase.json                 # Firebase Hosting config
│   │   ├── next.config.js                # Next.js config (static export)
│   │   ├── tailwind.config.ts            # Tailwind configuration
│   │   ├── postcss.config.mjs            # PostCSS for Tailwind
│   │   ├── tsconfig.json                 # TypeScript config
│   │   └── package.json                  # Dependencies
│   │
│   └── api/                          # FastAPI backend
│       ├── app/
│       │   ├── main.py                   # All API endpoints (~990 lines)
│       │   ├── auth.py                   # Firebase auth + role helpers
│       │   ├── deps.py                   # FastAPI dependencies
│       │   ├── db.py                     # Firestore client + collection names
│       │   ├── models.py                 # Pydantic models (~225 lines)
│       │   └── tokens.py                 # QR/token generation
│       ├── scripts/
│       │   └── bootstrap_owner.py        # First-time owner setup script
│       ├── Dockerfile                    # Container for Cloud Run
│       ├── cloudbuild.yaml               # Cloud Build config (CI/CD)
│       ├── .env.example                  # Example environment variables
│       ├── .env                          # Local dev config (git-ignored)
│       └── requirements.txt              # Python dependencies
│
├── docs/
│   ├── PRD.md                        # Product requirements
│   ├── ARCHITECTURE.md               # System design
│   ├── RUNBOOK.md                    # Operations guide
│   ├── BACKLOG.md                    # Feature backlog
│   └── updates_1.31.md               # RBAC implementation plan
│
└── README.md                         # This file
```

---

## Roles & Permissions (RBAC)

Boost uses a three-tier role hierarchy: **owner > merchant_admin > staff**

### Role Hierarchy

| Role | Scope | Permissions |
|------|-------|-------------|
| **owner** | Global | All permissions. Create/edit/delete merchants. Create co-owners. Impersonate any merchant view. Cannot be deleted if `is_primary=true`. |
| **merchant_admin** | Single merchant | Create offers, generate QR codes, edit merchant profile, invite staff, view as staff. |
| **staff** | Single merchant | Redeem tokens, view dashboard + redemptions (read-only). |

### Account Structure

- One `merchant_admin` per merchant
- Multiple `staff` per merchant
- First owner bootstrapped via script (jilanihammad@gmail.com)
- Additional owners can be created by existing owners

### View Hierarchy (Impersonation - UI Only)

This affects **UI visibility only**, not API permissions:

- **Owner** → can view as `merchant_admin` or `staff`
- **Merchant Admin** → can view as `staff`
- **Staff** → staff view only

### Permission Matrix

| Action | owner | merchant_admin | staff |
|--------|-------|----------------|-------|
| Create merchant | Yes | No | No |
| Edit any merchant | Yes | No | No |
| Edit own merchant | Yes | Yes | No |
| Delete merchant (soft) | Yes | No | No |
| Create offer | Yes | For own merchant | No |
| Edit offer | Yes | For own merchant | No |
| Generate tokens | Yes | For own merchant | No |
| Redeem tokens | Yes | For own merchant | For own merchant |
| View dashboard | Yes | For own merchant | For own merchant |
| View redemptions | Yes | For own merchant | For own merchant |
| Invite users | Yes (all roles) | staff only | No |
| Delete users | Yes (except primary) | own staff only | No |

---

## Firebase Custom Claims

Custom claims are stored on Firebase Auth tokens and used for authorization:

```javascript
// Owner claims
{
  "role": "owner",
  "is_primary": true  // Only for primary owner (cannot be deleted)
}

// Merchant Admin claims
{
  "role": "merchant_admin",
  "merchant_id": "merchant_abc123"
}

// Staff claims
{
  "role": "staff",
  "merchant_id": "merchant_abc123"
}
```

### How Claims Are Set

1. **Primary owner**: Set via `scripts/bootstrap_owner.py` (run once after first deployment)
2. **Other users**: Set via `POST /admin/users` endpoint (owner only)
3. **Pending invites**: If user doesn't exist in Firebase, a pending role is created. Claims are applied when user signs up and calls `POST /auth/claim-role`.

### Frontend Access

```typescript
// In auth.tsx
const tokenResult = await user.getIdTokenResult(true);
const role = tokenResult.claims.role;        // "owner" | "merchant_admin" | "staff"
const merchantId = tokenResult.claims.merchant_id;  // string | undefined
```

---

## Data Models

### Firestore Collections

```
firestore/
├── merchants/                        # Merchant businesses
│   └── {merchant_id}/
│       ├── name: string
│       ├── email: string
│       ├── locations: string[]          # Store locations
│       ├── status: "active" | "deleted" # Soft delete support
│       ├── created_at: timestamp
│       ├── deleted_at: timestamp | null
│       └── deleted_by: string | null    # UID of owner who deleted
│
├── offers/                           # Discount offers/campaigns
│   └── {offer_id}/
│       ├── merchant_id: string
│       ├── name: string                  # "Happy Hour Special"
│       ├── discount_text: string         # "$2 off any coffee"
│       ├── terms: string                 # "Valid Mon-Fri 2-5pm"
│       ├── cap_daily: number             # Max redemptions per day
│       ├── active_hours: string          # "2pm-5pm" (display only)
│       ├── value_per_redemption: number  # Amount merchant owes ($2.00)
│       ├── status: "active" | "paused" | "expired"
│       ├── created_at: timestamp
│       └── updated_at: timestamp
│
├── redemption_tokens/                # QR code tokens
│   └── {token_id}/                       # UUID
│       ├── offer_id: string
│       ├── short_code: string            # "ABC123" (human-readable)
│       ├── qr_data: string               # Full URL for QR
│       ├── status: "active" | "redeemed" | "expired"
│       ├── expires_at: timestamp
│       ├── redeemed_at: timestamp | null
│       ├── redeemed_by_location: string | null
│       └── created_at: timestamp
│
├── redemptions/                      # Verified redemptions
│   └── {redemption_id}/
│       ├── token_id: string
│       ├── offer_id: string
│       ├── merchant_id: string
│       ├── method: "scan" | "manual"
│       ├── location: string
│       ├── value: number                 # Amount added to ledger
│       └── timestamp: timestamp
│
├── ledger_entries/                   # Billing/payment tracking
│   └── {entry_id}/
│       ├── merchant_id: string
│       ├── redemption_id: string
│       ├── offer_id: string
│       ├── amount: number
│       └── created_at: timestamp
│
├── users/                            # User records (synced with Firebase Auth)
│   └── {uid}/                            # Firebase Auth UID
│       ├── email: string
│       ├── role: "owner" | "merchant_admin" | "staff"
│       ├── merchant_id: string | null    # null for owner
│       ├── is_primary: boolean           # true only for primary owner
│       ├── status: "active" | "deleted" | "orphaned"
│       ├── created_at: timestamp
│       └── created_by: string | null     # UID of inviter
│
└── pending_roles/                    # Pending invitations
    └── {id}/
        ├── email: string
        ├── role: "owner" | "merchant_admin" | "staff"
        ├── merchant_id: string | null
        ├── created_by: string            # UID of inviter
        ├── created_at: timestamp
        ├── expires_at: timestamp         # 7 days after created_at
        └── claimed: boolean
```

### TypeScript Types (Frontend)

Located in `apps/web/src/lib/api.ts`:

```typescript
export type OfferStatus = "active" | "paused" | "expired"
export type RedemptionMethod = "scan" | "manual"

export interface Offer {
  id: string
  merchant_id: string
  name: string
  discount_text: string
  terms?: string
  cap_daily: number
  active_hours?: string
  status: OfferStatus
  value_per_redemption: number
  created_at: string
  updated_at: string
  today_redemptions: number  // Computed at runtime by API
  cap_remaining: number      // Computed at runtime by API
}

export interface Redemption {
  id: string
  token_id: string
  offer_id: string
  merchant_id: string
  method: RedemptionMethod
  location: string
  value: number
  timestamp: string
}

export interface LedgerSummary {
  merchant_id?: string
  total_owed: number
  redemption_count: number
  entries: LedgerEntry[]
}
```

### Pydantic Models (Backend)

Located in `apps/api/app/models.py` - see the file for complete definitions.

Key models:
- `MerchantCreate`, `MerchantUpdate`, `Merchant`
- `OfferCreate`, `OfferUpdate`, `Offer`
- `TokenCreate`, `Token`
- `RedeemRequest`, `RedeemResponse`, `Redemption`
- `UserCreate`, `User`, `PendingRole`, `ClaimRoleResponse`
- Enums: `OfferStatus`, `TokenStatus`, `RedemptionMethod`, `UserRole`, `UserStatus`, `MerchantStatus`

---

## API Reference

**Base URL (Production):** https://boost-api-985021868372.us-central1.run.app
**Base URL (Development):** http://localhost:8000

**Authentication:** All endpoints (except `/health`) require:
```
Authorization: Bearer <firebase_id_token>
```

### Health Check

```
GET /health
Response: { "ok": true }
```

### Merchants

```
POST /merchants                        # Owner only
Body: { "name": "...", "email": "...", "locations": ["..."] }
Response: Merchant object

GET /merchants                         # Owner sees all; others see own merchant
Response: { "merchants": [...] }

GET /merchants/{id}                    # Requires staff_or_above for merchant
Response: Merchant object

PATCH /merchants/{id}                  # Owner or merchant_admin for that merchant
Body: { "name": "..." }
Response: Merchant object

DELETE /merchants/{id}                 # Owner only (soft delete)
Response: { "deleted": true, "id": "...", "orphaned_users": 2 }

PATCH /merchants/{id}/restore          # Owner only (restore soft-deleted)
Response: Merchant object
```

### Offers

```
POST /offers                           # Owner or merchant_admin
Body: {
  "merchant_id": "...",
  "name": "Happy Hour",
  "discount_text": "$2 off",
  "terms": "Valid weekdays only",
  "cap_daily": 50,
  "active_hours": "2pm-5pm",
  "value_per_redemption": 2.0
}
Response: Offer object

GET /offers?merchant_id=...            # Scoped by role
Response: { "offers": [...] }

GET /offers/{id}                       # Requires staff_or_above
Response: Offer object (with today_redemptions, cap_remaining)

PATCH /offers/{id}                     # Owner or merchant_admin
Body: { "status": "paused" }           # Pause/resume/edit
Response: Offer object

DELETE /offers/{id}                    # Owner or merchant_admin
Response: { "deleted": true, "id": "..." }
```

### Tokens

```
POST /offers/{offer_id}/tokens         # Owner or merchant_admin
Body: { "count": 100, "expires_days": 30 }
Response: {
  "offer_id": "...",
  "count": 100,
  "tokens": [{ "id": "...", "short_code": "ABC123", "qr_data": "..." }, ...]
}

GET /offers/{offer_id}/tokens?status=active&limit=100
Response: { "offer_id": "...", "tokens": [...] }

GET /tokens/{token_id}/qr              # Owner or merchant_admin
Response: PNG image (QR code)
```

### Redemptions

```
POST /redeem                           # Staff or above for that merchant
Body: {
  "token": "ABC123",           # Token ID or short code
  "location": "Downtown",
  "method": "scan"             # or "manual"
}
Response (success): {
  "success": true,
  "message": "Redemption successful!",
  "offer_name": "Happy Hour",
  "discount_text": "$2 off",
  "redemption_id": "..."
}
Response (failure): {
  "success": false,
  "message": "This code has already been redeemed"
}

GET /redemptions?merchant_id=...&offer_id=...&limit=50
Response: { "redemptions": [...] }
```

### Ledger

```
GET /ledger?merchant_id=...            # Scoped by role
Response: {
  "merchant_id": "...",
  "total_owed": 574.00,
  "redemption_count": 287,
  "entries": [...]
}
```

### User Management

```
POST /admin/users                      # Owner only
Body: {
  "email": "merchant@example.com",
  "role": "merchant_admin",            # or "staff" or "owner"
  "merchant_id": "..."                 # Required for merchant_admin/staff
}
Response: {
  "email": "...",
  "status": "claimed",         # or "pending" if user doesn't exist yet
  "user_id": "..."             # or "pending_id" if pending
}

POST /auth/claim-role                  # Any authenticated user
Response: {
  "success": true,
  "message": "Role claimed successfully",
  "role": "merchant_admin",
  "merchant_id": "..."
}

GET /admin/users?merchant_id=...       # Owner sees all; merchant_admin sees own
Response: {
  "users": [...],
  "pending": [...]             # Unclaimed invitations
}

DELETE /admin/users/{uid}              # Owner or merchant_admin (own staff only)
Response: { "deleted": true, "uid": "..." }
```

---

## Frontend Pages

### `/` - Landing Page

Simple landing with "Get Started" link to login.

### `/login` - Authentication

- Google OAuth popup sign-in
- Email-link (passwordless) sign-in option
- Redirects to `/dashboard` on success
- Handles errors: popup blocked, cancelled, expired links

### `/dashboard` - Merchant Dashboard

**Access:** All authenticated users with a role

**Features:**
- Header with email, role badge (Crown/Shield/User icon), logout button
- Admin link (for owner/merchant_admin)
- KPI cards: Today's redemptions, WTD count, Amount owed, Active offer status
- Offer sidebar: List all offers with status badges, scroll navigation
- Offer details: Daily cap, active hours, discount value
- Charts: Redemptions by day (bar), Method split (pie)
- Redemptions table: Recent redemptions with offer name, method, value
- Pause/Resume button for offers (merchant_admin+ only)
- "View as Staff" toggle (merchant_admin only)
- Empty state with "Create Offer" button when no offers exist

**Data Flow:**
```
useAuth() -> idToken -> listOffers() + listRedemptions() + getLedger()
                              |
              Render dashboard with real data
```

### `/redeem` - QR Scanner

**Access:** Staff and above for their merchant

**Features:**
- Camera-based QR scanning (BrowserQRCodeReader)
- Manual code entry fallback
- Location selector (which store location)
- Result states: success (green), already_redeemed (yellow), expired (red)
- Session counter (redemptions this session)
- Dashboard link for users with roles

**Data Flow:**
```
Scan QR -> Extract token from URL -> POST /redeem -> Show result
```

### `/admin` - Admin Panel

**Access:** Owner and merchant_admin

**Features:**
- Tabbed interface: Merchants, Offers, QR Codes, Users
- Create merchant form (owner only)
- Create offer form
- Generate QR codes for offers
- Download QR codes
- User management (invite, view, delete)

### `/claim-role` - Invite Acceptance

**Access:** Any authenticated user with pending invite

**Flow:**
1. User clicks magic link -> signs in -> lands on `/claim-role`
2. Page calls `POST /auth/claim-role`
3. Backend applies claims from `pending_roles`
4. Frontend calls `refreshToken()` to get updated claims
5. Redirect to appropriate dashboard based on role

---

## Key Code Files

### Frontend

| File | Lines | Purpose |
|------|-------|---------|
| `src/lib/auth.tsx` | ~220 | Auth context with Firebase, provides `useAuth()` hook, role/merchantId/viewAs state, token refresh |
| `src/lib/api.ts` | ~200 | Typed API client, all backend calls, type definitions |
| `src/lib/firebase.ts` | ~25 | Firebase client initialization (lazy, client-side only) |
| `src/app/dashboard/page.tsx` | ~930 | Main merchant dashboard UI, charts, tables, sidebar |
| `src/app/redeem/page.tsx` | ~350 | QR scanner with camera access |
| `src/app/admin/page.tsx` | ~600 | Admin panel with forms |
| `src/app/login/page.tsx` | ~150 | Authentication page |
| `src/components/role-toggle.tsx` | ~35 | Role badge display (Crown/Shield/User) |
| `src/components/RequireRole.tsx` | ~25 | Route protection component |

### Backend

| File | Lines | Purpose |
|------|-------|---------|
| `app/main.py` | ~990 | All API endpoints, FastAPI app, route handlers |
| `app/auth.py` | ~160 | Firebase token verification, role check helpers (`require_owner`, `require_merchant_admin`, `require_staff_or_above`) |
| `app/models.py` | ~225 | Pydantic models, enums, request/response validation |
| `app/db.py` | ~28 | Firestore client singleton, collection name constants |
| `app/tokens.py` | ~100 | Token generation, QR code creation, short code generation |
| `app/deps.py` | ~13 | FastAPI dependency injection for auth |
| `scripts/bootstrap_owner.py` | ~75 | First-time owner setup script |

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.10+
- Firebase project with Auth + Firestore enabled
- Google Cloud SDK (for deployment)

### 1. Clone and Setup

```bash
git clone <repo>
cd boost
```

### 2. Backend Setup

```bash
cd apps/api

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Firebase service account path

# Run development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Open http://localhost:8000/docs for Swagger UI

### 3. Frontend Setup

```bash
cd apps/web

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your Firebase config

# Run development server
npm run dev
```

Open http://localhost:3000

### 4. Firebase Setup

1. Create Firebase project at https://console.firebase.google.com
2. Enable Authentication:
   - Google sign-in provider
   - Email/Password with email-link enabled
3. Enable Firestore Database (start in test mode for dev)
4. Add authorized domains: `localhost`, `your-app.web.app`
5. Download service account JSON:
   - Project Settings -> Service accounts -> Generate new private key
   - Save to a secure location, reference in `GOOGLE_APPLICATION_CREDENTIALS`
6. Get web config:
   - Project Settings -> General -> Your apps -> Web app
   - Copy config values to `.env.local`

---

## Environment Variables

### Frontend (`apps/web/.env.local`)

```bash
# Firebase client config (from Firebase Console -> Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=boost-dev-3fabf.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=boost-dev-3fabf
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=boost-dev-3fabf.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=985021868372
NEXT_PUBLIC_FIREBASE_APP_ID=1:985021868372:web:...

# Email-link redirect URL (optional, defaults to window.location.origin/login)
NEXT_PUBLIC_EMAIL_LINK_REDIRECT=http://localhost:3000/login

# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Frontend Production (`apps/web/.env.production.local`)

```bash
NEXT_PUBLIC_API_URL=https://boost-api-985021868372.us-central1.run.app
```

### Backend (`apps/api/.env`)

```bash
# Firebase Admin SDK credentials (one of these methods)
# Method 1: Path to service account JSON
GOOGLE_APPLICATION_CREDENTIALS=/path/to/boost-dev-firebase-admin.json

# Method 2: JSON string (useful for CI/CD)
# FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3000,https://boost-dev-3fabf.web.app

# Environment indicator
ENVIRONMENT=development
```

---

## Deployment

### Current Deployment

| Component | URL | Last Deployed |
|-----------|-----|---------------|
| Frontend | https://boost-dev-3fabf.web.app | 2026-01-31 |
| API | https://boost-api-985021868372.us-central1.run.app | 2026-01-31 |
| Project | boost-dev-3fabf | - |
| Region | us-central1 | - |

### Deploy Backend (Cloud Run)

```bash
cd apps/api

# Deploy directly from source
gcloud run deploy boost-api \
  --source . \
  --region us-central1 \
  --project boost-dev-3fabf \
  --allow-unauthenticated \
  --set-env-vars "^@^CORS_ORIGINS=http://localhost:3000,https://boost-dev-3fabf.web.app"

# Note: ^@^ is the delimiter to allow commas in env vars

# Get the deployed URL
gcloud run services describe boost-api \
  --region us-central1 \
  --format 'value(status.url)'
```

### Deploy Frontend (Firebase Hosting)

```bash
cd apps/web

# Set production API URL
echo "NEXT_PUBLIC_API_URL=https://boost-api-985021868372.us-central1.run.app" > .env.production.local

# Build static export
npm run build

# Deploy to Firebase Hosting
firebase deploy --only hosting --project boost-dev-3fabf
```

### CI/CD with Cloud Build

The `cloudbuild.yaml` file supports automated deployments:

```bash
# Trigger a Cloud Build (requires COMMIT_SHA)
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=COMMIT_SHA=$(git rev-parse HEAD)
```

---

## Bootstrap & First-Time Setup

### Set Up Primary Owner

After first deployment, run the bootstrap script to set the primary owner:

```bash
cd apps/api

# Activate virtual environment
source .venv/bin/activate

# Set credentials
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/boost-dev-firebase-admin.json

# Run bootstrap (sets jilanihammad@gmail.com as primary owner)
python scripts/bootstrap_owner.py
```

Output:
```
Bootstrapping primary owner: jilanihammad@gmail.com
SUCCESS: Set PRIMARY owner role for jilanihammad@gmail.com
  UID: lY57LNFIUzS5m6eZxcR89IOsXoN2
  This user cannot be deleted by other owners.
  User record created in Firestore.
```

### Important: Token Refresh

After running the bootstrap script, the user must **sign out and sign back in** to get a fresh token with the new claims. The old cached token won't have the owner role.

---

## Current Status

### Implemented (as of 2026-01-31)

- [x] Firebase Authentication (Google + email-link)
- [x] Three-tier RBAC (owner > merchant_admin > staff)
- [x] Firebase custom claims for roles
- [x] Bootstrap script for primary owner
- [x] Firestore data models (7 collections)
- [x] Merchant CRUD API with soft delete/restore
- [x] Offer CRUD API with pause/resume
- [x] Token generation with QR codes
- [x] Redemption API with full validation
- [x] Ledger tracking per merchant
- [x] User management API (invite, claim, delete)
- [x] Dashboard with real API data
- [x] QR scanner with camera + manual entry
- [x] Admin panel with tabs
- [x] Role-based UI (view as staff toggle)
- [x] Empty states with proper navigation
- [x] Logout functionality
- [x] **Backend deployed to Cloud Run**
- [x] **Frontend deployed to Firebase Hosting**

### Pending / Known Issues

- [ ] First-time merchant admin invite flow (needs testing)
- [ ] Email-link sign-in redirect configuration
- [ ] Firestore security rules (currently permissive)
- [ ] QR code download as ZIP/PDF
- [ ] End-to-end testing with real users

### Future Features (Backlog)

- [ ] Consumer-facing offer discovery app
- [ ] SEO city/neighborhood pages
- [ ] Automated billing (Stripe integration)
- [ ] Analytics dashboard with trends
- [ ] Fraud detection alerts
- [ ] Push notifications for staff
- [ ] Multi-language support

---

## Troubleshooting

### "Admin access required" error

**Cause:** Your Firebase token doesn't have the `owner` role claim.

**Solution:**
1. Run the bootstrap script (if first time)
2. Sign out completely
3. Sign back in to get a fresh token with claims

### Can't see logout button

**Cause:** Old frontend version deployed.

**Solution:**
1. Rebuild: `npm run build`
2. Redeploy: `firebase deploy --only hosting`
3. Hard refresh browser: Cmd+Shift+R

### API returns 403 Forbidden

**Cause:** Either wrong role or stale token.

**Solution:**
1. Check Cloud Run logs: `gcloud logging read 'resource.type="cloud_run_revision"' --limit=20`
2. Verify claims are set correctly in Firebase Console -> Authentication -> Users -> (user) -> Custom Claims
3. Sign out and sign back in

### Cloud Run deployment fails

**Cause:** Missing COMMIT_SHA or Docker build error.

**Solution:** Use direct deployment instead of Cloud Build:
```bash
gcloud run deploy boost-api --source . --region us-central1 ...
```

### Firebase Hosting shows old version

**Cause:** Browser caching or incomplete deploy.

**Solution:**
1. Clear browser cache
2. Check Firebase Console -> Hosting -> Release history
3. Redeploy with `firebase deploy --only hosting`

---

## Documentation

- `docs/PRD.md` - Product requirements and success criteria
- `docs/ARCHITECTURE.md` - System design and data flow
- `docs/RUNBOOK.md` - Operations guide for running a pilot
- `docs/BACKLOG.md` - Feature backlog and build plan
- `docs/updates_1.31.md` - RBAC implementation plan (detailed)

---

## License

Proprietary - All rights reserved
