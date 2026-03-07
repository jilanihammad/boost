# Boost — Product Requirements Document

> **Retroactive PRD.** Boost is a deployed, working product. This document captures what exists today — the product vision, architecture, features, data model, and current state — as a reference for anyone working on the codebase.

## Product Overview

Boost is a **performance-based local merchant retention platform**. Merchants create offers (e.g., "$2 off any coffee", "Free pastry with purchase"), distribute them via social media ads using universal QR codes, and pay only when a customer actually redeems at the register — not per impression, not per click.

The platform started as a simple deals/offers tool (Week 1 MVP: create offer → generate QR → staff scans → ledger tracks what's owed). It then **pivoted from a deals platform to a merchant retention platform**, adding consumer identity, loyalty stamp cards, CRM customer segmentation, retention analytics, automated re-engagement messaging, AI-powered insights, referral programs, zone-based discovery, weekly merchant reports, and a merchant self-serve onboarding flow.

All 5 pivot phases are complete:
1. **Consumer Identity** — accounts, personal QR codes, claim flow, wallet
2. **Loyalty Foundation** — stamp cards, global points, rewards, double-stamp days
3. **Merchant CRM + Retention Dashboard** — customer list with segmentation, cohort retention analytics, deal performance, LTV distribution, AI insights
4. **Discovery + Neighborhoods** — zone model, public zone pages, referral system
5. **Automation + Intelligence** — automated re-engagement messages, AI deal copy generation, weekly merchant reports

**Live:** [boost-dev-3fabf.web.app](https://boost-dev-3fabf.web.app) (frontend) · [Cloud Run API](https://boost-api-985021868372.us-central1.run.app) (backend)

---

## Target Users

### Platform Owner / Admin
The person who runs Boost as a business. Can create merchants, manage users, generate QR codes, view all data across all merchants. Accesses the Admin Panel.

### Merchant Admin
A business owner or manager on the platform. Can create and manage offers, configure loyalty programs, view their dashboard (KPIs, charts, redemption history), manage customers, and configure automations. Cannot see other merchants' data.

### Staff
An employee at a merchant location. Can scan QR codes to redeem offers at the register using the camera scanner or manual code entry. Sees redemption results with customer context (visit number, loyalty progress). Cannot create or modify offers.

### Consumer
A customer who browses deals, creates an account, claims offers, and earns points/stamps through repeat visits. Has a personal wallet with active claims, visit history, loyalty progress per merchant, and earned rewards. Can refer friends.

**What problems Boost solves:**
- Merchants can't measure which promotions drive *repeat* business vs one-time deal-chasers
- Traditional ads charge per impression/click with no guarantee of foot traffic
- Small local businesses lack CRM tools to segment and re-engage customers
- No way to track cross-merchant loyalty in a neighborhood ecosystem
- Manual billing and ledger tracking for pay-per-redemption models

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| UI | Tailwind CSS 4, shadcn/ui (Radix primitives), Lucide icons |
| Charts | Recharts 3 |
| QR Scanning | @zxing/browser (decode), qrcode + Pillow (generate server-side) |
| Auth | Firebase Auth (Google OAuth + email magic link), Firebase custom claims for RBAC |
| API Client | `src/lib/api.ts` — centralized fetch wrapper with Bearer token injection |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| Database | Firestore (21 collections) |
| Rate Limiting | SlowAPI (60 req/min default, 10/min on redemption) |
| Error Monitoring | Sentry SDK (server-side) |
| PDF Generation | ReportLab (QR code PDFs) |
| AI | OpenAI API (deal copy generation + dashboard insights), rule-based fallback |
| Hosting | Firebase Hosting (frontend), Cloud Run (backend) |
| Infra | GCP (Firestore, Firebase Auth, Secret Manager, Cloud Run) |
| Deployment | `scripts/deploy.sh` — gcloud builds + Firebase deploy |

---

## Data Model

All entities stored in Firestore. 21 collections total.

### Core Business Entities

| Collection | Key Fields | Purpose |
|---|---|---|
| `merchants` | id, name, email, locations[], status (active\|deleted), created_at, deleted_at, deleted_by, category, zone_slug | Business profiles |
| `offers` | id, merchant_id, name, discount_text, terms, cap_daily, active_hours, value_per_redemption, status (active\|paused\|expired), target_audience (everyone\|new_only\|returning_only\|referred_only), created_at, updated_at | Deals/promotions |
| `redemption_tokens` | id, offer_id, short_code (6-char), qr_data (URL), status (active\|redeemed\|expired), expires_at, is_universal (bool), last_redeemed_at, last_redeemed_by_location | Universal reusable QR tokens (1 per offer) |
| `redemptions` | id, token_id, offer_id, merchant_id, consumer_id, method (scan\|manual), location, value, timestamp | Verified redemption records |
| `ledger_entries` | id, merchant_id, redemption_id, offer_id, amount, created_at | Per-redemption billing line items |

### Auth & User Management

| Collection | Key Fields | Purpose |
|---|---|---|
| `users` | uid, email, role (owner\|merchant_admin\|staff), merchant_id, is_primary, status (active\|deleted\|orphaned), created_at, created_by | Merchant-side user records |
| `pending_roles` | id, email, role, merchant_id, created_by, created_at, expires_at (7d), claimed | Invite-before-signup flow |

### Consumer Identity

| Collection | Key Fields | Purpose |
|---|---|---|
| `consumers` | uid, email, phone, display_name, home_zone_id, zip_code, lat, lng, tier (free\|boost_plus), global_points, referral_code, referred_by, created_at | Consumer profiles with location + referral |
| `consumer_claims` | id, consumer_uid, offer_id, merchant_id, qr_data (personal HMAC-signed), short_code, expires_at, offer_name, merchant_name, claimed_at, redeemed (bool) | Claimed-but-not-yet-redeemed offers |
| `consumer_visits` | id, consumer_id, merchant_id, offer_id, redemption_id, zone_id, visit_number, points_earned (50), stamp_earned, referred_by, timestamp | Visit records linking consumer to merchant |

### Loyalty & Rewards

| Collection | Key Fields | Purpose |
|---|---|---|
| `loyalty_configs` | merchant_id (doc ID), program_type ("stamps"), stamps_required, reward_description, reward_value, reset_on_reward, double_stamp_days[], birthday_reward, automations[] | Per-merchant loyalty program configuration |
| `loyalty_progress` | "{consumer_id}_{merchant_id}" (doc ID), consumer_id, merchant_id, current_stamps, total_stamps, rewards_earned, rewards_redeemed, last_visit | Stamp progress per consumer per merchant |
| `rewards` | id, consumer_id, merchant_id, description, status (earned\|redeemed\|expired), value, is_universal, earned_at, redeemed_at, expires_at | Earned rewards (merchant-specific or universal $5 credits at 500 pts) |

### Messaging & Automations

| Collection | Key Fields | Purpose |
|---|---|---|
| `automated_messages` | id, merchant_id, consumer_id, trigger (first_visit\|at_risk\|reward_earned), channel ("sms"), message_body, sent_at, resulted_in_visit | Automated re-engagement message records |

### Discovery & Zones

| Collection | Key Fields | Purpose |
|---|---|---|
| `zones` | id, name, slug, city, center {lat, lng}, radius_miles, status | Geographic neighborhoods for deal discovery |

### Referrals

| Collection | Key Fields | Purpose |
|---|---|---|
| `referrals` | id, referrer_id, referred_id, status (pending\|completed), points_earned, created_at | Consumer-to-consumer referral tracking |

### Reports & Analytics

| Collection | Key Fields | Purpose |
|---|---|---|
| `weekly_reports` | id, merchant_id, week_start, week_end, new_customers, returning_customers, total_visits, top_deal, return_rate, return_rate_trend, rewards_earned, estimated_revenue, insights[], html_body, generated_at | Weekly merchant performance reports with rendered HTML |
| `insight_cache` | merchant_id (doc ID), insights[], generated_at | Cached AI/rule-based insights (24h TTL) |

### Onboarding

| Collection | Key Fields | Purpose |
|---|---|---|
| `merchant_invites` | id, business_name, owner_name, email, phone, category, zone_slug, status (pending\|approved\|rejected), reviewed_at, reject_reason | Self-serve merchant invite requests |

---

## Core Features

### 1. Authentication & RBAC

- **Three-tier role hierarchy:** owner → merchant_admin → staff (Firebase custom claims)
- **Consumer role:** auto-assigned when no custom claims present
- **Auth methods:** Google OAuth popup + email magic link (passwordless)
- **Claim-role flow:** Invited users (pending_roles) sign up and auto-claim their role
- **Impersonation:** Owner can "View as Merchant Admin" or "View as Staff" in the UI (display-only; API permissions unchanged)
- **Auth guard components:** `RequireAuth` (blocks unauthenticated), `RequireRole` (blocks unauthorized roles)

### 2. Offer Management

- **CRUD:** Create, read, update, delete offers (owner/merchant_admin)
- **Fields:** name, discount text, terms, daily cap, active hours, value per redemption, target audience
- **Status lifecycle:** active → paused → active (toggle) or expired
- **Target audience:** everyone, new_only, returning_only, referred_only (field stored; filtering logic for future work)
- **Daily cap tracking:** Real-time count of today's redemptions vs cap, with `cap_remaining` computed at query time
- **Batch optimization:** `_batch_daily_redemption_counts()` fetches counts in Firestore `IN` batches of 30

### 3. Universal QR Tokens

- **One reusable token per offer** (replaced legacy single-use tokens)
- **Short code fallback:** 6-character human-readable code (ambiguous chars excluded: 0, O, I, L, 1)
- **QR data format:** `https://boost-dev-3fabf.web.app/r/{token_id}`
- **QR generation:** Server-side via `qrcode` Python library (PNG)
- **PDF generation:** Styled PDF with merchant name, offer name, QR code, short code, terms (ReportLab)
- **Download options:** Single PDF, single PNG, bulk ZIP of all offers' QR PDFs

### 4. Redemption Flow

Two flows, both through `POST /redeem`:

**Universal Token Flow (legacy/staff-initiated):**
1. Staff scans QR or enters short code on `/redeem` page
2. System resolves token → validates offer status, daily cap, expiry
3. Creates redemption record + ledger entry
4. Returns success with offer details

**Personal QR Flow (consumer-initiated):**
1. Consumer claims offer → gets personal HMAC-signed QR (`boost://claim/{uid}/{offer_id}/{timestamp}/{hmac}`)
2. Staff scans personal QR at register
3. System verifies HMAC signature, checks daily cap, checks 1-per-consumer-per-day
4. Creates redemption + ledger entry + consumer_visit record
5. Awards loyalty stamps + global points (50 per visit)
6. Checks stamp threshold → auto-creates reward if earned
7. Checks global points → auto-creates universal $5 reward at 500 points
8. Marks claim as redeemed
9. Fires automation triggers (first_visit, reward_earned)
10. Updates attribution on recent automated messages (resulted_in_visit)
11. Returns success with consumer name, visit number, stamp progress, reward info

**Staff UI (`/redeem`):**
- Camera-based QR scanner using @zxing/browser
- Manual code entry dialog (6-8 chars)
- Location selector for multi-location merchants
- Result screens: Success (green), Already Redeemed (amber), Invalid/Expired (red)
- Session redemption counter

### 5. Merchant Dashboard (`/dashboard`)

- **KPI cards:** Today's redemptions, week-to-date redemptions, amount owed (WTD), active offer status with cap remaining
- **Charts:** Redemptions by day (bar chart, last 14 days), redemption method split (pie chart, scan vs manual)
- **Offers sidebar:** Scrollable list with status badges and today's count, click to select
- **Selected offer detail:** Daily cap remaining, active hours, discount value, pause/resume toggle
- **Redemption history table:** Time, offer name, method (scan/manual icon), value, status
- **Role-aware UI:** Merchant admins see "View as Staff" toggle; staff can't manage offers

### 6. Admin Panel (`/admin`)

Owner-only, four tabs:

- **Merchants:** Create new merchants (name, email, locations), view/delete/restore list, "View as Merchant" impersonation
- **Offers:** Create offers (select merchant, name, discount, terms, daily cap, value), edit/delete, status management, QR download (PDF/PNG per offer, bulk ZIP)
- **QR Codes:** Select offer → generate/update universal token → download PDF/PNG
- **Users:** Invite users (email + role + merchant), view active users + pending invites, delete users

### 7. Consumer Identity & Wallet

- **Registration:** `POST /consumer/register` — display name, optional zip/lat/lng, optional referral code → auto-assigns zone, generates unique referral code
- **Personal QR claims:** `POST /consumer/claim/{offer_id}` — HMAC-signed QR valid until end of day, 1 per consumer per offer per day, returns existing claim if already claimed today
- **Wallet:** `GET /consumer/wallet` — active (unredeemed/unexpired) claims, last 30 visits with merchant/offer names, total global points, earned rewards, loyalty stamp progress per merchant

### 8. Loyalty Program

- **Merchant configuration:** Stamps required (1-100), reward description, reward value, reset on reward, double stamp days (0=Mon..6=Sun), birthday reward
- **Stamp awarding:** Automatic on redemption. Double stamps on configured days.
- **Reward creation:** Auto-created when stamps reach threshold. 30-day expiry.
- **Global points:** 50 per visit. At 500 points → auto-create universal $5 reward at any merchant (with 500-point deduction).
- **Reward redemption:** Staff endpoint `POST /rewards/{id}/redeem` — marks as redeemed, updates loyalty_progress.

### 9. Customer CRM & Segmentation

- **Customer list:** `GET /merchants/{id}/customers` — all consumers who visited, with segment, visit count, last visit, estimated LTV, loyalty stamps. Filterable by segment, searchable by name.
- **Auto-segmentation:** new (1 visit, <14d), returning (2-4 visits), VIP (5+ visits or top 10% LTV), at_risk (2+ visits but >14d since last), lost (>30d since last)
- **Customer detail:** `GET /merchants/{id}/customers/{consumer_id}` — full profile with masked name ("First L."), visit timeline, stamp progress, segment, LTV estimate
- **Privacy:** Consumer display names masked in merchant views. Full PII not exposed.

### 10. Analytics & Insights

- **Cohort retention:** `GET /merchants/{id}/analytics/retention` — weekly cohorts of first-visit customers, return rates at weeks 1-5. Heatmap data.
- **Deal performance:** `GET /merchants/{id}/analytics/deals` — per-offer redemption count, 14d/30d return rates, estimated ROI (return visits × avg ticket - cost / cost)
- **LTV distribution:** `GET /merchants/{id}/analytics/ltv` — histogram buckets ($0-10, $10-30, $30-60, $60-100, $100+)
- **AI insights:** `GET /merchants/{id}/insights` — OpenAI-powered (gpt-4o-mini) or rule-based fallback. Compares deal return rates, flags at-risk customer concentration. Cached 24h in Firestore.

### 11. Automated Messaging

- **Three triggers:** first_visit, at_risk (configurable days threshold), reward_earned
- **Template variables:** `{merchant_name}`, `{customer_name}`, `{reward_description}`, `{current_stamps}`, `{stamps_required}`, `{stamps_remaining}`
- **Quiet hours:** 9 AM – 9 PM UTC. Outside → scheduled for 9 AM next day.
- **Daily automation job:** `POST /automations/run-daily` — identifies at-risk customers (2+ visits, no visit in N days), deduplicates (no re-send within 30 days), creates message records.
- **Attribution:** When consumer visits within 7 days of an automated message, `resulted_in_visit` is set to true.
- **Current state:** Messages are logged but not actually sent (no Twilio integration yet).

### 12. AI Deal Copy Generation

- **Endpoint:** `POST /deals/generate-copy` — merchant_id + template_type (dollar_off, free_item, bogo, happy_hour, first_time, custom)
- **OpenAI mode:** Generates 3 headline + description + terms suggestions using merchant context and existing deals
- **Mock mode:** Returns hardcoded suggestions per template type (when no OPENAI_API_KEY)
- **Personalization:** Uses merchant name, category, existing deal names for context

### 13. Weekly Merchant Reports

- **Generation:** `POST /reports/weekly` — computes metrics for all active merchants: new/returning customers, total visits, top deal, return rate (with trend vs previous week), rewards earned, estimated revenue, AI insights, full HTML email template
- **HTML rendering:** Self-contained inline-CSS email with KPI grid, metrics table, insights section
- **Idempotent:** Skips merchants that already have a report for the current week
- **Retrieval:** List reports (last N weeks) + detail view with full HTML body
- **Current state:** Reports generated and stored; email sending is logged but not wired to SendGrid

### 14. Zones / Neighborhoods

- **Zone model:** Name, slug, city, center lat/lng, radius (miles), status
- **Public endpoints:** List zones (with dynamic merchant/deal counts), zone detail (merchants + active deals), zone deals (sorted by redemption count)
- **Location matching:** Haversine distance calculation to assign consumers to zones
- **Seed data:** Capitol Hill + Fremont (Seattle) as defaults
- **No auth required:** All zone endpoints are public for SEO/discoverability

### 15. Referral System

- **Referral codes:** 8-char alphanumeric, generated at registration, collision-checked
- **Share URL:** `{FRONTEND_URL}/join?ref={code}`
- **Submission:** Consumer submits referral code → validates (no self-referral, no duplicates, no reverse pairs) → awards 100 points to referrer, 50 to referred
- **List referrals:** Consumer sees their referrals with masked names, status, points earned

### 16. Merchant Self-Serve Onboarding

- **Public invite request:** `POST /merchants/request-invite` — business name, owner name, email, phone, category, zone slug
- **Admin review:** List pending invites, approve (creates merchant + Firebase user + sets merchant_admin claims), reject with optional reason
- **Approval creates:** Merchant record, Firebase Auth user (if not exists), user record with merchant_admin role

### 17. Public Offer Claim Page (`/r/[token]`)

- Resolves token to offer details via `GET /public/offers/{token_id_or_code}` (no auth)
- Displays merchant name, offer name, discount text (gradient highlight), QR code image, short code, terms, active hours
- Urgency signals: "Only N left today — hurry!" (≤5 remaining), "Today's limit reached" (0 remaining)
- Dark theme, consumer-facing

### 18. Legal Pages

- `/terms` — Terms of Service page
- `/privacy` — Privacy Policy page
- Linked from login page footer

---

## API / Interface Design

### Authentication

All authenticated endpoints use `Authorization: Bearer <firebase_id_token>`. The `get_current_user` dependency extracts and verifies the token. Users without custom claims default to `consumer` role.

### Main Application Endpoints (main.py)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/health` | None | Health check (verifies Firestore connectivity) |
| `GET` | `/public/offers/{token_id_or_code}` | None | Resolve token to offer details (consumer claim page) |
| `POST` | `/merchants` | Owner | Create merchant |
| `GET` | `/merchants` | Auth | List merchants (scoped by role) |
| `GET` | `/merchants/{id}` | Staff+ | Get merchant |
| `PATCH` | `/merchants/{id}` | Admin+ | Update merchant |
| `DELETE` | `/merchants/{id}` | Owner | Soft-delete merchant (orphan users, pause offers, expire tokens, cancel pending roles) |
| `PATCH` | `/merchants/{id}/restore` | Owner | Restore soft-deleted merchant |
| `POST` | `/offers` | Admin+ | Create offer |
| `GET` | `/offers` | Auth | List offers (scoped by role, with today's redemption counts) |
| `GET` | `/offers/{id}` | Staff+ | Get offer with real-time cap remaining |
| `PATCH` | `/offers/{id}` | Admin+ | Update offer (pause/resume/edit) |
| `DELETE` | `/offers/{id}` | Admin+ | Delete offer |
| `POST` | `/offers/{id}/tokens` | Admin+ | Generate/update universal token |
| `GET` | `/offers/{id}/tokens` | Admin+ | List tokens for offer |
| `GET` | `/tokens/{id}/qr` | Admin+ | Get QR code PNG for token |
| `GET` | `/offers/{id}/qr/download` | Admin+ | Download styled QR PDF |
| `GET` | `/offers/{id}/qr/png` | Admin+ | Download raw QR PNG |
| `POST` | `/qr/bulk-download` | Admin+ | Download ZIP of QR PDFs for multiple offers |
| `POST` | `/redeem` | Staff+ | Redeem token (scan or manual), rate-limited 10/min |
| `GET` | `/redemptions` | Auth | List redemptions (scoped by role) |
| `GET` | `/ledger` | Auth | Get ledger summary (total owed, entries) |
| `GET` | `/ledger/export` | Admin+ | Export ledger as CSV |
| `POST` | `/admin/users` | Owner | Create/invite user with role |
| `GET` | `/admin/users` | Admin+ | List users + pending roles |
| `DELETE` | `/admin/users/{uid}` | Owner/Admin | Delete user (soft delete, clear claims) |
| `POST` | `/auth/claim-role` | Auth | Claim pending role for current user |

### Consumer Router (`/api/v1/consumer/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/consumer/register` | Auth | Register consumer profile (idempotent) |
| `GET` | `/consumer/profile` | Consumer | Get own profile |
| `POST` | `/consumer/claim/{offer_id}` | Consumer | Claim offer → personal HMAC QR |
| `GET` | `/consumer/wallet` | Consumer | Full wallet (claims, visits, points, rewards, loyalty) |

### Loyalty Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/merchants/{id}/loyalty` | Staff+ | Get loyalty config |
| `PUT` | `/merchants/{id}/loyalty` | Admin+ | Create/update loyalty config |
| `POST` | `/rewards/{id}/redeem` | Staff+ | Redeem an earned reward |

### Customers Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/merchants/{id}/customers` | Staff+ | List customers with segments (filter, search, paginate) |
| `GET` | `/merchants/{id}/customers/{consumer_id}` | Staff+ | Customer detail with visit timeline |

### Analytics Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/merchants/{id}/analytics/retention` | Staff+ | Cohort retention heatmap data |
| `GET` | `/merchants/{id}/analytics/deals` | Staff+ | Per-deal performance (return rates, ROI) |
| `GET` | `/merchants/{id}/analytics/ltv` | Staff+ | LTV distribution histogram |
| `GET` | `/merchants/{id}/insights` | Staff+ | AI/rule-based insights (24h cache) |

### Automations Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/merchants/{id}/automations` | Admin+ | Get automation config |
| `PUT` | `/merchants/{id}/automations` | Admin+ | Update automation rules |
| `POST` | `/automations/run-daily` | None (Cloud Scheduler) | Run daily at-risk re-engagement job |

### Zones Router (`/api/v1/zones/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/zones` | None | List active zones with counts |
| `GET` | `/zones/{slug}` | None | Zone detail with merchants + deals |
| `GET` | `/zones/{slug}/deals` | None | Active deals in zone, sorted by popularity |

### Reports Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/reports/weekly` | API key | Generate weekly reports for all merchants |
| `GET` | `/merchants/{id}/reports` | Admin+ | List past weekly reports |
| `GET` | `/merchants/{id}/reports/{report_id}` | Admin+ | Get report detail with HTML |

### Referrals Router (`/api/v1/consumer/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/consumer/referral-code` | Consumer | Get/generate referral code + share URL |
| `POST` | `/consumer/referral` | Consumer | Submit referral code (awards points) |
| `GET` | `/consumer/referrals` | Consumer | List referrals made by consumer |

### Merchant Onboard Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/merchants/request-invite` | None | Public merchant invite request |
| `GET` | `/admin/invites` | Owner | List invites (filterable by status) |
| `POST` | `/admin/invites/{id}/approve` | Owner | Approve → create merchant + user |
| `POST` | `/admin/invites/{id}/reject` | Owner | Reject with optional reason |

### AI Service Router (`/api/v1/`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/deals/generate-copy` | Admin+ | AI deal copy generation (3 suggestions) |

---

## User Stories

### Platform Owner
- As the owner, I want to create merchants and assign them admin users so I can onboard businesses quickly.
- As the owner, I want to see all merchants, offers, and users across the platform so I can manage operations.
- As the owner, I want to soft-delete a merchant and have all their users orphaned, offers paused, and tokens expired automatically.
- As the owner, I want to impersonate a merchant's view so I can troubleshoot their experience.
- As the owner, I want to approve or reject merchant invite requests so I can control who joins the platform.

### Merchant Admin
- As a merchant admin, I want to create offers with daily caps and see real-time redemption counts so I can control my spend.
- As a merchant admin, I want to pause/resume offers instantly so I can react to demand.
- As a merchant admin, I want to generate and download QR codes (PDF and PNG) to use in social media ads.
- As a merchant admin, I want to see my dashboard with today's redemptions, week-to-date totals, amount owed, and charts so I can track performance.
- As a merchant admin, I want to configure a loyalty stamp card (N visits → reward) so I can drive repeat business.
- As a merchant admin, I want to see my customer list segmented by new/returning/VIP/at-risk/lost so I can understand my customer base.
- As a merchant admin, I want to view individual customer profiles with visit timelines so I can identify my best customers.
- As a merchant admin, I want to see retention cohort data, deal performance, and LTV distribution so I can optimize my offers.
- As a merchant admin, I want AI-powered insights telling me which deals drive repeat visits so I can make data-driven decisions.
- As a merchant admin, I want to configure automated re-engagement messages so at-risk customers get prompted to return.
- As a merchant admin, I want weekly performance reports with new/returning customers, return rate trends, and top deals.
- As a merchant admin, I want AI-generated deal copy suggestions so I can create compelling offers quickly.
- As a merchant admin, I want to export my ledger as CSV for billing reconciliation.

### Staff
- As a staff member, I want to scan a customer's QR code at the register and see an instant success/failure result.
- As a staff member, I want a manual code entry fallback when the camera isn't available.
- As a staff member, I want to see the customer's name, visit number, and loyalty progress after a scan so I can personalize the interaction.

### Consumer
- As a consumer, I want to browse deals in my neighborhood so I can discover local businesses.
- As a consumer, I want to create an account and claim offers to get personal QR codes that I show at the register.
- As a consumer, I want to see my wallet with active claims, visit history, points, loyalty stamps, and earned rewards.
- As a consumer, I want to earn stamps at each merchant and unlock rewards after enough visits.
- As a consumer, I want to earn global Boost points (50 per visit) redeemable as $5 credits at any merchant.
- As a consumer, I want to refer friends and earn bonus points when they redeem their first deal.

---

## Files & Architecture

### Backend (`apps/api/`)

| File | Purpose |
|---|---|
| `app/main.py` | FastAPI app, CORS, rate limiting, request logging middleware, all endpoint definitions for merchants, offers, tokens, redemptions, ledger, users, QR downloads |
| `app/models.py` | All Pydantic models (~60 models) — request/response validation for every entity |
| `app/auth.py` | Firebase Admin SDK init, bearer token verification, role check helpers (require_owner, require_merchant_admin, require_staff_or_above), set/clear custom claims |
| `app/db.py` | Firestore client singleton, all 21 collection name constants |
| `app/deps.py` | FastAPI dependencies: get_current_user, get_current_consumer |
| `app/tokens.py` | Token generation (UUID), short code generation, QR data creation, QR image generation, token lookup/redemption |
| `app/consumer.py` | Consumer registration, personal QR HMAC signing/verification, claim flow, wallet endpoint |
| `app/loyalty.py` | Loyalty config CRUD, reward redemption |
| `app/customers.py` | Customer list with segmentation, customer detail with visit timeline |
| `app/analytics.py` | Retention cohorts, deal performance, LTV distribution, AI/rule-based insights |
| `app/automations.py` | Automation config CRUD, daily at-risk job, message creation with quiet hours |
| `app/reports.py` | Weekly report generation, HTML email rendering, report retrieval |
| `app/zones.py` | Zone CRUD, Haversine distance, zone-deal lookups, seed helper |
| `app/referrals.py` | Referral code generation, submission with anti-gaming, referral list |
| `app/ai_service.py` | AI deal copy generation (OpenAI or mock fallback) |
| `app/merchant_onboard.py` | Public invite request, admin approve/reject |

### Frontend (`apps/web/src/`)

| File | Purpose |
|---|---|
| `lib/api.ts` | API client with typed functions for all endpoints, `apiFetch` wrapper with Bearer token, ApiError class, download helper |
| `lib/auth.tsx` | AuthProvider context — Firebase Auth state, role resolution from custom claims, impersonation (viewAs), Google/email sign-in methods, token refresh |
| `lib/firebase.ts` | Firebase app + auth initialization from env vars |
| `lib/mock-data.ts` | Mock data for development |
| `app/login/page.tsx` | Login page — Google OAuth + email magic link, role-based redirect |
| `app/login/complete/page.tsx` | Email link completion page |
| `app/claim-role/page.tsx` | Post-login role claiming for invited users |
| `app/dashboard/page.tsx` | Main merchant dashboard — KPI cards, charts (Recharts), offers sidebar, redemption table, role-aware UI |
| `app/admin/page.tsx` | Admin panel — merchants/offers/QR/users tabs, CRUD forms, QR download (PDF/PNG/ZIP) |
| `app/redeem/page.tsx` | Staff redemption page — camera QR scanner, manual code dialog, result screens, location selector |
| `app/r/[token]/page.tsx` | Public offer claim page — resolves token, displays offer + QR + short code |
| `app/page.tsx` | Landing/home page |
| `app/privacy/page.tsx` | Privacy policy |
| `app/terms/page.tsx` | Terms of service |
| `app/providers.tsx` | App-level providers (AuthProvider, ThemeProvider) |
| `app/layout.tsx` | Root layout |
| `components/RequireAuth.tsx` | Auth guard component |
| `components/RequireRole.tsx` | Role guard component |
| `components/boost-logo.tsx` | Boost logo component |
| `components/role-toggle.tsx` | Role display/toggle component |
| `components/status-badge.tsx` | Offer status badge |
| `components/theme-provider.tsx` | next-themes provider |
| `components/ui/*` | shadcn/ui component library (~70 components) |

### Infrastructure

| File | Purpose |
|---|---|
| `firebase/firestore.rules` | Comprehensive Firestore security rules — role-based access for all collections |
| `scripts/deploy.sh` | Deployment script — Cloud Run (API) + Firebase Hosting (web) |

---

## Non-Functional Requirements

- **Rate limiting:** 60 requests/minute global, 10/minute on redemption endpoint (SlowAPI)
- **CORS:** Must be explicitly configured via `CORS_ORIGINS` env var in production (fails loudly if missing)
- **Structured logging:** JSON-formatted request logs with method, path, status code, duration_ms
- **Error monitoring:** Sentry SDK with 10% trace/profile sampling
- **Security:** Firebase Auth token verification on all authenticated endpoints. Firestore rules enforce role-based access. HMAC-signed personal QR codes prevent forgery.
- **Idempotency:** Consumer registration is idempotent (returns existing profile if exists). Weekly report generation skips existing reports. Token generation updates existing token rather than creating duplicates.
- **Soft deletes:** Merchants are soft-deleted (status=deleted), users are orphaned (claims cleared), offers paused, tokens expired. Reversible via restore endpoint.
- **Privacy:** Consumer names masked as "First L." in merchant-facing views. No full PII exposed to merchants.
- **Quiet hours:** Automated messages respect 9 AM – 9 PM UTC window.
- **Cache:** AI insights cached 24h in Firestore to avoid redundant API calls.

---

## Acceptance Criteria

### Authentication
1. Users can sign in with Google OAuth or email magic link
2. After sign-in, users are redirected based on role (owner → admin, merchant_admin/staff → dashboard, no role → claim-role)
3. Invited users can claim pending roles after first sign-in
4. Owner can impersonate merchant_admin or staff view in the UI

### Offer Management
5. Owner/admin can create offers with all fields and see them immediately in the list
6. Offers can be paused/resumed and the status persists across reloads
7. Daily cap is enforced — redemptions fail gracefully when cap is reached
8. QR codes can be downloaded as PDF (styled) or PNG (raw) per offer, or as a bulk ZIP

### Redemption
9. Staff can scan a QR code via camera and see instant success/failure feedback
10. Staff can enter a 6-8 character code manually as fallback
11. Personal QR codes are validated against HMAC signature and same-day expiry
12. Each redemption creates a redemption record, ledger entry, and (for personal QR) consumer visit
13. Rate limit of 10 redemptions/minute per IP is enforced

### Consumer
14. Consumer can register with display name and optional location → receives referral code
15. Consumer can claim an offer → receives personal QR with end-of-day expiry
16. Consumer wallet shows active claims, visit history, points, stamps per merchant, earned rewards
17. Claiming the same offer twice in one day returns the existing claim (not a duplicate)

### Loyalty
18. Merchant can configure stamp card (N visits → reward) with double stamp days
19. Each redemption awards a stamp (or 2 on double-stamp days) and 50 global points
20. When stamps reach threshold, a reward is auto-created (30-day expiry) and stamps reset
21. At 500 global points, a universal $5 reward is auto-created and points deducted
22. Staff can redeem earned rewards at the register

### CRM
23. Customer list shows all visitors with auto-calculated segments (new/returning/VIP/at-risk/lost)
24. Customer list supports segment filter and name search
25. Customer detail shows visit timeline, stamp progress, LTV estimate

### Analytics
26. Retention endpoint returns weekly cohort data with return rates for 5 weeks
27. Deal performance shows per-offer redemption count, 14d/30d return rates, estimated ROI
28. LTV distribution returns bucketed histogram of customer values
29. Insights are AI-generated (OpenAI) or rule-based, cached 24h

### Automations
30. Automation rules can be configured per trigger (first_visit, at_risk, reward_earned) with custom message templates
31. Daily job identifies at-risk customers and creates message records (deduped: no re-send within 30 days)
32. Attribution updates resulted_in_visit when consumer visits within 7 days of automated message

### Reports
33. Weekly report generation computes all metrics, renders HTML, stores in Firestore
34. Generation is idempotent (skips existing reports for the same week)
35. Reports are retrievable as a list (summaries) or individually (with full HTML)

### Zones
36. Public zone endpoints return zones with merchant/deal counts
37. Zone detail includes merchants and their active deals with redemption counts

### Referrals
38. Consumer gets a unique referral code and share URL
39. Submitting a referral code awards 100 points to referrer and 50 to referred
40. Self-referral, duplicate referrals, and reverse referrals are blocked

---

## Out of Scope / Future Work

Based on open beads (P2/P3) and documented plans:

| Item | Priority | Reference |
|---|---|---|
| **Spend Analytics + Customer Targeting** | P1 | `dude-0xu` epic — Square POS integration, order sync, spend profiles, targeting job API + UI |
| **CI/CD Pipeline** | P2 | `bo-08g` — no automated testing/deploy pipeline yet |
| **Loading States & Error Handling** | P2 | `bo-4d0` — many pages lack proper skeleton/error states |
| **Analytics Dashboard with Trends** | P3 | `bo-12z` — historical trend lines, period comparisons |
| **Stripe Billing Integration** | P3 | `bo-803` — automated billing (currently manual invoicing via ledger CSV) |
| **Push Notifications for Staff** | P3 | `bo-739` — notify staff of redemptions, cap warnings |
| **Multi-language Support (i18n)** | P3 | `bo-d23` — internationalization |
| **Consumer-Facing Discovery App** | P3 | `bo-ep5` — full consumer browse/discovery UX (zones model exists, UI does not) |
| **SEO City Pages** | Future | Statically generated neighborhood pages for organic discovery |
| **Fraud Detection** | Future | Repeated device/IP, velocity anomalies |
| **Native Mobile Apps** | Future | Currently web-only (PWA-ready architecture) |
| **POS Integration (Square/Toast/Clover)** | Future | Real transaction matching for full-price return visit tracking |
| **Twilio/SendGrid Integration** | Future | Automated messages are logged but not sent — needs SMS/email provider |
| **Boost+ Subscription Tier** | Future | Consumer premium membership with unlimited redemptions, 2x points |
| **Real-time Dashboard** | Future | Currently polling-based; Firestore real-time listeners for Phase 4+ |
| **Mapbox Integration** | Future | Interactive maps on neighborhood pages |
