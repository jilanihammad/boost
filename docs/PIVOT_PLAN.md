# Boost Pivot Plan: Deals Platform → Merchant Retention Platform

**Date:** 2026-03-04
**Status:** Draft — Pending Jilani's Approval
**Thesis:** Deals are the top-of-funnel hook. The real product is a merchant-facing CRM + loyalty + attribution dashboard.

---

## Executive Summary

Boost currently has 3 screens (Login, Redeem, Dashboard), 7 Firestore collections, Firebase Auth with 3-tier RBAC, and zero consumer-facing UX. The pivot requires building an entire consumer identity + discovery layer, a loyalty/retention system, a merchant CRM, and neighborhood-level geographic scoping.

This plan is organized into 5 phases over ~10 weeks. Each phase builds on the previous. Detailed UX specs are in `UX_PIVOT_PROPOSAL.md`, GTM plan is in `boost-gtm-plan.md`.

---

## What Exists Today

| Layer | Current State |
|-------|--------------|
| **Frontend** | Next.js (V0-ui), 3 pages: Login, Redeem (QR scanner), Dashboard |
| **Backend** | FastAPI on Cloud Run |
| **Data** | Firestore: Merchants, Offers, Tokens, Redemptions, Ledger, Users, PendingRoles |
| **Auth** | Firebase Auth (Google OAuth + magic link), RBAC (owner/merchant_admin/staff) |
| **Consumer-facing** | Only `/public/offers/{token}` — resolves QR to offer details. No browse, no accounts, no loyalty. |
| **Infra** | GCP: Cloud Run, Firestore, Firebase Auth, Secret Manager |

---

## Phase 1: Consumer Identity (Week 1-2)

**Why first:** Without consumer accounts, nothing else works. Can't track visits, can't build loyalty, can't do CRM.

### Backend Changes

**New Firestore collections:**

```
consumers
  ├── uid (Firebase Auth)
  ├── email
  ├── phone (optional, collected at first redemption)
  ├── display_name
  ├── home_zone_id
  ├── location_verified_at
  ├── tier: free | boost_plus
  ├── global_points: int
  ├── referral_code: string
  ├── referred_by: uid | null
  └── created_at

consumer_visits
  ├── id
  ├── consumer_id
  ├── merchant_id
  ├── offer_id
  ├── redemption_id
  ├── zone_id
  ├── visit_number: int
  ├── points_earned: int
  ├── stamp_earned: bool
  ├── referred_by: uid | null
  └── timestamp
```

**New API endpoints:**

```
POST   /api/v1/consumer/register        # Create consumer account
GET    /api/v1/consumer/profile          # Get own profile + points
POST   /api/v1/consumer/claim/{offer_id} # Claim deal (generates personal QR)
GET    /api/v1/consumer/wallet           # Active deals, points, rewards
```

**Modified endpoints:**

```
POST   /api/v1/redemptions/scan          # Now also creates consumer_visit, links to consumer_id
```

**Auth changes:**
- Add consumer role to Firebase Auth (separate from merchant roles)
- Consumer registration via Google OAuth, Apple Sign-In, or email magic link
- Consumer tokens are personal (encode user_id + offer_id + timestamp)

### Frontend Changes

**New pages:**
- `/join` — Account creation flow (OAuth + location verification)
- `/wallet` — Active deals, points, visit history (basic v1)

**Modified pages:**
- `/redeem` (staff) — After scan, show customer context: "Visit #3, returning customer"
- QR display — Now shows personal QR code with expiry timer

**Files to create/modify:**
- `apps/web/V0-ui/app/join/page.tsx` (new)
- `apps/web/V0-ui/app/wallet/page.tsx` (new)
- `apps/web/V0-ui/app/redeem/page.tsx` (modify — add customer context on scan)
- Backend: new consumer router + consumer_visit model
- Firestore rules: add consumer collection access

### Acceptance Criteria
- [ ] Consumer can create account via Google OAuth
- [ ] Consumer can claim an offer and receive a personal QR code
- [ ] Staff scanning QR creates a consumer_visit record
- [ ] Staff sees "Visit #N" after scanning a returning customer
- [ ] Consumer wallet shows visit history

---

## Phase 2: Loyalty Foundation (Week 3-4)

**Why second:** Loyalty is the retention mechanism. Without it, we're still just Groupon with accounts.

### Backend Changes

**New Firestore collections:**

```
loyalty_configs
  ├── merchant_id
  ├── program_type: "stamps"
  ├── stamps_required: int
  ├── reward_description: string
  ├── reward_value: float
  ├── reset_on_reward: bool
  ├── double_stamp_days: [int]
  ├── birthday_reward: bool
  └── automations: [{trigger, message, delay}]

loyalty_progress
  ├── consumer_id
  ├── merchant_id
  ├── current_stamps: int
  ├── total_stamps: int
  ├── rewards_earned: int
  ├── rewards_redeemed: int
  └── last_visit: timestamp

rewards
  ├── consumer_id
  ├── merchant_id
  ├── description: string
  ├── status: earned | redeemed | expired
  ├── earned_at / redeemed_at / expires_at
```

**New API endpoints:**

```
GET    /api/v1/merchants/{id}/loyalty     # Get loyalty config
PUT    /api/v1/merchants/{id}/loyalty     # Update loyalty config
GET    /api/v1/consumer/loyalty           # Consumer's loyalty progress across merchants
POST   /api/v1/rewards/{id}/redeem        # Redeem an earned reward
```

**Modified endpoints:**

```
POST   /api/v1/redemptions/scan           # Now also awards stamps + points, checks reward threshold
```

### Frontend Changes

**New pages:**
- `/biz/loyalty` — Merchant loyalty program configuration (stamp count, reward, automations)

**Modified pages:**
- `/wallet` — Add stamp progress per merchant, global points bar, available rewards
- `/biz/dashboard` — Add loyalty stats (rewards earned, redemption rate)
- `/redeem` — Show stamp progress: "Stamp 3/5 — 2 more visits → free drink"

**Files to create/modify:**
- `apps/web/V0-ui/app/biz/loyalty/page.tsx` (new)
- `apps/web/V0-ui/app/wallet/page.tsx` (modify)
- `apps/web/V0-ui/app/redeem/page.tsx` (modify)
- `apps/web/V0-ui/app/dashboard/page.tsx` (modify)
- Backend: loyalty router, loyalty_progress model, reward model
- Modified redemption logic to handle stamp/point awarding

### Acceptance Criteria
- [ ] Merchant can configure stamp-based loyalty (N visits → reward)
- [ ] Each redemption awards a stamp and global points
- [ ] Consumer wallet shows stamp progress per merchant
- [ ] When stamp threshold hit, reward auto-created and consumer notified
- [ ] Consumer can redeem earned rewards at the store
- [ ] Staff sees loyalty context during redemption scan

---

## Phase 3: Merchant CRM + Retention Dashboard (Week 5-6)

**Why third:** The CRM is the product merchants pay for. This is where Boost becomes indispensable.

### Backend Changes

**New API endpoints:**

```
GET    /api/v1/merchants/{id}/customers                    # Customer list with segments
GET    /api/v1/merchants/{id}/customers/{consumer_id}      # Individual customer profile
GET    /api/v1/merchants/{id}/analytics/retention           # Cohort retention data
GET    /api/v1/merchants/{id}/analytics/deals               # Deal comparison (repeat vs one-and-done)
GET    /api/v1/merchants/{id}/analytics/ltv                 # LTV distribution
```

**Customer segmentation logic (computed from consumer_visits):**
- **New** — 1 visit, within last 14 days
- **Returning** — 2-4 visits
- **VIP** — 5+ visits or top 10% by LTV
- **At-risk** — Previously returning, no visit in 14+ days
- **Lost** — No visit in 30+ days

**Analytics computations:**
- Cohort retention: group customers by first-visit week, track return rates at week 1/2/3/4
- Deal comparison: for each offer, calculate % of redeemers who returned within 14/30 days
- LTV estimation: visit count × average ticket size (configurable per merchant)

### Frontend Changes

**New pages:**
- `/biz/customers` — CRM customer list with segments, search, export
- `/biz/customers/{id}` — Individual customer profile (visits, stamps, LTV)
- `/biz/analytics` — Retention cohort heatmap, deal comparison chart, LTV distribution

**Modified pages:**
- `/biz/dashboard` — Replace redemption-first layout with retention-first: New vs Returning split, return rate, estimated LTV, deal ROI comparison, AI insight

**Files to create/modify:**
- `apps/web/V0-ui/app/biz/customers/page.tsx` (new)
- `apps/web/V0-ui/app/biz/customers/[id]/page.tsx` (new)
- `apps/web/V0-ui/app/biz/analytics/page.tsx` (new)
- `apps/web/V0-ui/app/dashboard/page.tsx` (major rewrite)
- Backend: customers router, analytics router, segmentation logic

### Acceptance Criteria
- [ ] Merchant sees customer list with auto-segments (New/Returning/VIP/At-risk/Lost)
- [ ] Merchant can view individual customer profile with visit timeline
- [ ] Dashboard shows New vs Returning customers, return rate, estimated LTV
- [ ] Deal performance table shows repeat rate per deal
- [ ] Cohort retention heatmap renders correctly
- [ ] Customer list is exportable as CSV

---

## Phase 4: Discovery + Neighborhoods + Growth (Week 7-8)

**Why fourth:** Now that the retention engine works, we need the consumer acquisition funnel.

### Backend Changes

**New Firestore collections:**

```
zones
  ├── id
  ├── name ("Capitol Hill")
  ├── slug ("capitol-hill")
  ├── city ("Seattle")
  ├── bounds: GeoJSON polygon
  ├── center: {lat, lng}
  └── merchant_ids: [...]

referrals
  ├── referrer_id
  ├── referred_id
  ├── zone_id
  ├── status: pending | completed
  ├── referrer_bonus_awarded: bool
  └── created_at
```

**New API endpoints:**

```
GET    /api/v1/zones                      # List neighborhoods
GET    /api/v1/zones/{slug}               # Neighborhood detail + merchants
GET    /api/v1/zones/{slug}/deals         # Active deals in zone
GET    /api/v1/merchants/{id}/public      # Public merchant profile
GET    /api/v1/consumer/referral-link     # Get/generate referral link
POST   /api/v1/referrals/complete         # Mark referral as completed on first redemption
```

### Frontend Changes

**New pages:**
- `/` — Landing / neighborhood selector (geo-detect or manual pick)
- `/n/{slug}` — Neighborhood page (map + merchant list + active deals)
- `/m/{slug}` — Public merchant profile (hero image, active deals, loyalty progress if logged in)
- `/deals/{id}` — Individual deal detail + claim button
- `/r/{code}` — Referral landing page
- `/join` — Enhanced with location verification step + optional Boost+ membership

**Static generation (SSG):**
- Neighborhood pages statically generated for SEO
- Merchant profile pages statically generated with structured data (JSON-LD)
- Target keywords: "[neighborhood] deals", "[merchant name] coupons"

**PWA setup:**
- Service worker for offline QR display
- Web app manifest for "Add to Home Screen"
- Push notification registration (for Phase 5 automations)

**Files to create/modify:**
- `apps/web/V0-ui/app/page.tsx` (rewrite — neighborhood selector)
- `apps/web/V0-ui/app/n/[slug]/page.tsx` (new)
- `apps/web/V0-ui/app/m/[slug]/page.tsx` (new)
- `apps/web/V0-ui/app/deals/[id]/page.tsx` (new)
- `apps/web/V0-ui/app/r/[code]/page.tsx` (new)
- `apps/web/V0-ui/app/join/page.tsx` (enhance)
- `public/manifest.json` (new — PWA)
- `public/sw.js` (new — service worker)
- Backend: zones router, referrals router, public merchant endpoints

### Acceptance Criteria
- [ ] Consumer can browse neighborhoods and see merchant listings with active deals
- [ ] Neighborhood page shows interactive map (Mapbox GL) with merchant pins
- [ ] Consumer can view merchant profile with loyalty progress (if logged in)
- [ ] Consumer can claim deals and get personal QR code from deal detail page
- [ ] Referral links work: referrer gets bonus points when referred friend redeems
- [ ] Neighborhood pages are statically generated and indexable by Google
- [ ] PWA installable from wallet page ("Add to Home Screen")

---

## Phase 5: Automation + Intelligence (Week 9-10)

**Why last:** Automations require the full data pipeline to be in place.

### Backend Changes

**New Firestore collection:**

```
automated_messages
  ├── merchant_id
  ├── consumer_id
  ├── trigger: "first_visit" | "at_risk" | "reward_earned" | "birthday"
  ├── channel: "sms" | "push" | "email"
  ├── message_body
  ├── sent_at
  └── resulted_in_visit: bool
```

**New services:**
- **Message queue (Cloud Tasks or Pub/Sub)** — Schedule and send automated messages
- **Twilio integration** — SMS for at-risk re-engagement, reward notifications
- **SendGrid integration** — Email for weekly merchant reports
- **AI service** — Deal copy generation (OpenAI API), dashboard insights

**New API endpoints:**

```
GET    /api/v1/merchants/{id}/automations     # Get automation configs
PUT    /api/v1/merchants/{id}/automations     # Update automation configs
POST   /api/v1/deals/generate-copy            # AI deal copy generation
GET    /api/v1/merchants/{id}/insights        # AI-generated dashboard insights
```

**Scheduled jobs (Cloud Scheduler):**
- Daily: identify at-risk customers (no visit in 14+ days), send re-engagement
- Daily: check for reward expirations, send reminders
- Weekly: merchant report email (redemptions, retention rate, top customers)

### Frontend Changes

**New pages:**
- `/biz/deals/new` — Enhanced deal creation with template picker + AI copy generation

**Modified pages:**
- `/biz/loyalty` — Add automation configuration (trigger messages for first visit, at-risk, reward earned)
- `/biz/dashboard` — Add AI insight card ("Your pastry deal drives 3x more return visits")
- `/biz/customers` — Add "Send Personal Offer" action on customer profiles

**Files to create/modify:**
- `apps/web/V0-ui/app/biz/deals/new/page.tsx` (new)
- `apps/web/V0-ui/app/biz/loyalty/page.tsx` (modify — add automations)
- `apps/web/V0-ui/app/biz/dashboard/page.tsx` (modify — add insights)
- Backend: automations router, AI service, Twilio/SendGrid integrations
- Cloud Scheduler configs for daily/weekly jobs

### Acceptance Criteria
- [ ] Merchant can configure automated messages (first visit, at-risk, reward earned)
- [ ] At-risk customers receive SMS re-engagement after 14 days of inactivity
- [ ] Reward notifications sent automatically via SMS
- [ ] AI generates deal copy based on merchant profile and menu
- [ ] Dashboard shows AI insight (e.g., "Deal X drives 3x more return visits than Deal Y")
- [ ] Weekly merchant report emails sent automatically
- [ ] Automation attribution: track whether automated message resulted in a visit

---

## Infrastructure Requirements (Across All Phases)

### POS Integration Strategy (Phase 3+, Optional for MVP)

POS integration is the gold standard for attribution but NOT required for MVP. Start with QR-based tracking.

**Future integration targets:**
- **Square API** — OAuth 2.0, Webhooks for transaction events, Loyalty API
- **Toast API** — Partner API, order webhooks
- **Clover API** — REST + webhooks, order notifications

**Architecture:** Create an integration service that listens for POS webhooks and matches transactions to Boost consumer_ids. This lets you track full-price return visits (not just deal redemptions).

### Third-Party Services

| Service | Purpose | Phase |
|---------|---------|-------|
| **Mapbox GL JS** | Interactive maps on neighborhood pages | 4 |
| **Twilio** | SMS for automations + phone verification | 5 |
| **SendGrid** | Email for merchant reports | 5 |
| **OpenAI API** | AI deal copy generation + dashboard insights | 5 |
| **Firebase Cloud Messaging** | Push notifications (PWA) | 4-5 |
| **Cloud Scheduler** | Scheduled automation jobs | 5 |
| **Cloud Tasks / Pub/Sub** | Message queue for async processing | 5 |

### Revenue Model Implementation

**Phase 1-3 (existing):** Commission on redeemed deals (10-15%), tracked via Ledger collection.

**Phase 4+ (new):** SaaS subscription billing for merchants.
- Stripe subscription integration
- Tiers: Free (limited), Standard ($50/mo), Premium ($100/mo)
- Feature gates based on tier (advanced analytics, AI insights, automations)

---

## Migration Path: Incremental, Not Big-Bang

Every phase is independently deployable. No phase requires a hard cutover.

**Phase 1** adds consumer identity alongside existing merchant flows — existing merchants keep working.
**Phase 2** adds loyalty as an opt-in merchant feature — merchants without loyalty configured are unaffected.
**Phase 3** replaces the dashboard, but existing data (redemptions, ledger) feeds the new views.
**Phase 4** adds consumer-facing pages that don't exist today — purely additive.
**Phase 5** adds automations as opt-in — merchants configure what they want.

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stay on Firestore or migrate to Postgres? | **Stay on Firestore for now.** Migrate analytics queries to BigQuery if needed. | Firestore handles the CRUD well. Analytics can be computed in-memory for 15-20 merchants. Premature migration would slow the pivot. |
| Separate consumer app or same Next.js app? | **Same app, different routes.** `/biz/*` for merchants, everything else for consumers. | One codebase, shared components, simpler deployment. Route-based code splitting keeps bundles manageable. |
| Build map from scratch or use Mapbox? | **Mapbox GL JS.** | Best-in-class for web maps. Free tier covers 50K map loads/mo — plenty for launch. |
| Real-time dashboard or polling? | **Polling (30s interval) for Phase 1-3.** Firestore real-time listeners for Phase 4+. | Don't over-engineer early. Polling is fine for 15-20 merchants. |

---

## Full Reference Docs

- **UX wireframes + screen specs:** `docs/UX_PIVOT_PROPOSAL.md`
- **GTM playbook:** `boost-gtm-plan.md` (root)
- **Current architecture:** `docs/ARCHITECTURE.md`
- **Current PRD:** `docs/PRD.md`
