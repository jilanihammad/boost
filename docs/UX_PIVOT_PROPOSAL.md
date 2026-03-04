# Boost UX Pivot Proposal: Deals Platform → Merchant Retention Platform

**Date:** 2025-07-09  
**Status:** Draft  
**Thesis:** Deals are the top-of-funnel hook. The real product is a merchant-facing CRM + loyalty + attribution dashboard.

---

## Current State Assessment

### What Exists Today
- **3 screens:** Login, Redeem (staff-facing QR scanner), Dashboard (merchant-facing KPI cards + redemption history)
- **Data model:** Merchants, Offers, Tokens, Redemptions, Ledger, Users, PendingRoles (7 Firestore collections)
- **Auth:** Firebase Auth (Google OAuth + magic link), 3-tier RBAC (owner/merchant_admin/staff)
- **Consumer-facing:** Essentially nothing. There's a `/public/offers/{token}` endpoint that resolves a QR code to offer details, but no browse/discovery/account/loyalty UX
- **Merchant-facing:** Offer CRUD, redemption counting, basic ledger. No CRM, no customer profiles, no retention analytics, no loyalty config

### What's Missing for the Pivot
1. **Consumer identity** — No consumer accounts. Can't track individuals across visits.
2. **Discovery UX** — No way for consumers to browse deals. QR codes are distributed via external ads.
3. **Loyalty/retention** — Zero infrastructure. No points, no return-visit tracking, no personalized rewards.
4. **Merchant CRM** — No customer list, no visit history per customer, no automated follow-ups.
5. **Attribution** — No way to tell which deals drive repeat business vs one-and-done.
6. **Neighborhood/zone model** — No concept of geographic clusters.

---

## Part 1: Consumer-Facing UX

### 1.1 Information Architecture — Consumer Side

```
/                           → Landing / neighborhood selector
/n/{slug}                   → Neighborhood page (e.g., /n/capitol-hill)
/m/{slug}                   → Merchant profile page
/deals/{id}                 → Individual deal detail
/wallet                     → My wallet: active deals, points, rewards
/wallet/history             → Visit/redemption history
/account                    → Profile, location, preferences
/account/referrals          → Referral dashboard
/r/{code}                   → Referral landing page (shared link)
/join                       → Account creation flow
/qr/{code}                  → QR landing page (scanned from physical media)
```

### 1.2 Discovery & Browsing — Hyperlocal Deals

**Primary discovery model: Neighborhood pages, not a global map.**

The unit of Boost is the *neighborhood zone* — 15-20 merchants in a walkable area. This is the core differentiator from Groupon (which was city-wide) and Yelp (which is search-driven).

#### Screen: Neighborhood Page (`/n/{slug}`)

```
┌─────────────────────────────────────────────────┐
│  🏘️ Capitol Hill                    [📍 Near you] │
│  12 active deals · 18 merchants                  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │         [Interactive Map - Mapbox GL]        │ │
│  │     Pins for each merchant with active deal  │ │
│  │     Tap pin → mini card with deal preview    │ │
│  │     User's location dot (if permitted)       │ │
│  │     ~400px tall, collapsible                 │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  Filter: [All] [Coffee] [Food] [Drinks] [Shop]  │
│  Sort:   [Nearest] [Best deal] [Ending soon]     │
│                                                   │
│  ┌───────────────────────────────┐               │
│  │  ☕ Elm Coffee Roasters       │  0.2 mi       │
│  │  $2 off any drink             │               │
│  │  ⭐ 4.7 · 142 redeemed       │  [Get Deal →] │
│  │  ⏰ Ends in 3 days            │               │
│  └───────────────────────────────┘               │
│  ┌───────────────────────────────┐               │
│  │  🍕 Via Tribunali             │  0.4 mi       │
│  │  Free appetizer with entree   │               │
│  │  ⭐ 4.5 · 89 redeemed        │  [Get Deal →] │
│  └───────────────────────────────┘               │
│  ...                                              │
└─────────────────────────────────────────────────┘
```

**Key design decisions:**
- **Map + list hybrid.** Map is prominent but not primary — the list below it is the main browse surface. Map collapses to a slim bar on scroll down.
- **No infinite scroll of the entire city.** Page is scoped to one neighborhood. Cross-neighborhood discovery happens via the neighborhood selector.
- **Social proof baked in.** "142 redeemed" signals real activity, not ghost deals.
- **Urgency signals.** "Ends in 3 days", "12 left today" drive action.

#### Screen: Home / Neighborhood Selector (`/`)

```
┌─────────────────────────────────────────────────┐
│                    BOOST                          │
│         Deals from your neighborhood              │
│                                                   │
│  [📍 Use my location]                            │
│                                                   │
│  ── or pick a neighborhood ──                    │
│                                                   │
│  ┌─────────────┐  ┌─────────────┐               │
│  │ Capitol Hill │  │  Fremont    │               │
│  │  12 deals   │  │   8 deals   │               │
│  └─────────────┘  └─────────────┘               │
│  ┌─────────────┐  ┌─────────────┐               │
│  │  Ballard    │  │ U District  │               │
│  └─────────────┘  └─────────────┘               │
│                                                   │
│  [See all neighborhoods →]                       │
└─────────────────────────────────────────────────┘
```

**If location is granted:** Auto-redirect to nearest neighborhood page. Show a "Your neighborhood: Capitol Hill" persistent header.

**SEO play:** `/n/capitol-hill-seattle` pages are statically generated with merchant listings and structured data. These rank for "deals near capitol hill" etc.

#### Screen: Merchant Profile (`/m/{slug}`)

```
┌─────────────────────────────────────────────────┐
│  [← Back]                                        │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │          [Hero image of merchant]            │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ☕ Elm Coffee Roasters                           │
│  Capitol Hill · 0.2 mi · Open until 7pm          │
│  ⭐ 4.7 on Google · 142 Boost redemptions        │
│                                                   │
│  ── Active Deals ──                              │
│  ┌───────────────────────────────┐               │
│  │  $2 off any drink             │  [Get Deal]   │
│  │  Valid Mon-Fri, 7am-2pm       │               │
│  │  23 left today                │               │
│  └───────────────────────────────┘               │
│                                                   │
│  ── Your History ── (if logged in)               │
│  │  Visited 3x · Last: Jun 28                   │
│  │  🔥 2 more visits → free drink               │
│  │  Points: 340 / 500                            │
│                                                   │
│  ── About ──                                     │
│  │  Specialty coffee roaster since 2012...       │
│  │  📍 1600 E Olive Way, Seattle                 │
│  │  [Directions] [Website] [Instagram]           │
└─────────────────────────────────────────────────┘
```

**Key:** The merchant profile is where the loyalty loop surfaces. "2 more visits → free drink" is the retention hook that makes Boost different from Groupon.

---

### 1.3 Account Creation — Qualifying Friction

**Goal:** Filter out pure deal-chasers who'll never return. We want people who *live or work* in the neighborhood.

#### Flow: Sign Up (`/join`)

```
Step 1: Identity
┌─────────────────────────────────────────┐
│  Create your Boost account              │
│                                         │
│  [Continue with Google]                 │
│  [Continue with Apple]                  │
│  ── or ──                              │
│  Email: [________________]              │
│  [Send verification link]               │
└─────────────────────────────────────────┘

Step 2: Location Verification
┌─────────────────────────────────────────┐
│  Where are you based?                   │
│                                         │
│  We match you with deals in your        │
│  neighborhood. You can browse other     │
│  areas, but rewards are tied to your    │
│  home zone.                             │
│                                         │
│  [📍 Use my location]                  │
│  ── or ──                              │
│  ZIP code: [______]                     │
│                                         │
│  Your neighborhood: Capitol Hill ✅      │
│  [Continue]                             │
└─────────────────────────────────────────┘

Step 3: (Optional) Boost Membership
┌─────────────────────────────────────────┐
│  Want early access to the best deals?   │
│                                         │
│  🆓 Free                               │
│  • Browse all deals                     │
│  • Redeem up to 3/week                  │
│  • Basic points                         │
│                                         │
│  ⭐ Boost+ ($4.99/mo)                  │
│  • Unlimited redemptions                │
│  • 2x points on every visit             │
│  • Exclusive merchant deals             │
│  • Early access (24hr before public)    │
│                                         │
│  [Start Free]  [Try Boost+ Free 30d]   │
└─────────────────────────────────────────┘
```

**Qualifying friction mechanics:**
1. **Account required** to redeem any deal (no anonymous redemptions). This is the data moat.
2. **Location verification** — browser geolocation or ZIP code. Not GPS-precise, just neighborhood-level. This lets us scope the loyalty program geographically.
3. **Redemption limits** on free tier — 3/week prevents pure deal-hoppers from burning through every merchant's cap. Boost+ removes the limit and adds value for real locals.
4. **Phone number** (collected at first redemption, not signup) — for SMS follow-ups and merchant CRM. "Add your phone to get your receipt and earn double points on this visit."

**Why this works:** The friction isn't onerous (Google OAuth + location = 30 seconds), but it creates enough commitment that the people who complete it are real potential repeat customers. The Boost+ tier is a future revenue line but also a self-selection mechanism — people who pay $5/mo *intend* to use it regularly.

---

### 1.4 Deal Redemption Experience

**Current flow (v0):** Universal QR code → staff scans with camera → redemption recorded.

**New flow:** Consumer has a *personal* redemption code tied to their account.

#### Consumer Side: Getting a Deal

```
Screen: Deal Detail (/deals/{id})
┌─────────────────────────────────────────┐
│  [← Back to Capitol Hill]               │
│                                         │
│  ☕ Elm Coffee Roasters                  │
│  $2 off any drink                       │
│                                         │
│  Valid: Mon-Fri, 7am-2pm                │
│  Remaining today: 23 of 50              │
│  Terms: One per customer per day.       │
│         New customers: any drink.       │
│         Returning: espresso drinks only.│
│                                         │
│  [🎟️ Claim This Deal]                  │
│                                         │
│  ── What others say ──                  │
│  "Great cortado" — redeemed 2 days ago  │
│  "Love this place" — redeemed last week │
└─────────────────────────────────────────┘
```

Tapping "Claim This Deal" (requires login):

```
Screen: My Deal Code (replaces current QR display)
┌─────────────────────────────────────────┐
│                                         │
│  ✅ Deal claimed!                       │
│                                         │
│  Show this at the register:             │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │                                 │   │
│  │        [QR CODE]                │   │
│  │     (unique to this user)       │   │
│  │                                 │   │
│  │     Code: BOOST-7K3M           │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ⏰ Valid until 2:00 PM today          │
│  📍 Elm Coffee · 0.2 mi away          │
│  [Get Directions]                       │
│                                         │
│  ── After you visit ──                  │
│  You'll earn 50 points toward your      │
│  next free drink at Elm Coffee.         │
│                                         │
│  [Add to Wallet 📲] (PWA home screen)  │
└─────────────────────────────────────────┘
```

**Key changes from v0:**
1. **QR is personal** — encodes `user_id + offer_id + timestamp`. No universal tokens. This is the foundation for CRM.
2. **Time-limited** — code expires same day or within configurable window. Creates urgency.
3. **Points preview** — before they even visit, they see what they'll earn. Primes the retention loop.
4. **"Add to Wallet"** — PWA install prompt disguised as a useful action. Gets Boost on their home screen.

#### Staff Side: Scanning (minimal changes to current Redeem page)

The existing Redeem page is well-designed. Changes:

```
After successful scan:
┌─────────────────────────────────────────┐
│  ✅ Redemption Successful               │
│                                         │
│  Customer: Sarah M.                     │
│  Deal: $2 off any drink                 │
│  Visit #: 3rd visit                     │
│                                         │
│  💡 Returning customer! They're 2       │
│     visits away from a free drink.      │
│     Consider mentioning it!             │
│                                         │
│  [Scan Next Customer]                   │
└─────────────────────────────────────────┘
```

**The staff sees customer context at redemption time.** "3rd visit" and "2 away from free drink" lets staff create a personal moment. This is the CRM surfacing at point of sale.

---

### 1.5 Loyalty & Retention UX — Consumer Side

#### Screen: My Wallet (`/wallet`)

This is the consumer's home base after first redemption. PWA home screen opens here.

```
┌─────────────────────────────────────────────────┐
│  BOOST                           [Capitol Hill] │
│                                                   │
│  ── Your Points ──                               │
│  ┌─────────────────────────────────────────────┐ │
│  │  🏆 340 points                               │ │
│  │  ████████████░░░░░░░░  340 / 500             │ │
│  │  160 more → $5 reward at any merchant        │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ── Active Deals ──                              │
│  ┌───────────────────────────────┐               │
│  │  ☕ Elm Coffee · $2 off       │  [Show Code]  │
│  │  Claimed today · expires 2pm  │               │
│  └───────────────────────────────┘               │
│                                                   │
│  ── Your Merchants ──                            │
│  (merchants you've visited via Boost)            │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐     │
│  │ Elm Coffee│ │Via Tribun.│ │ Rione XIII│      │
│  │ 3 visits  │ │ 1 visit   │ │ 5 visits  │      │
│  │ ███░░ 3/5 │ │ █░░░░ 1/5 │ │ █████ ★   │      │
│  │ → Free drk│ │ → 10% off │ │ UNLOCKED! │      │
│  └───────────┘ └───────────┘ └───────────┘      │
│                                                   │
│  ── Rewards Available ──                         │
│  ┌───────────────────────────────┐               │
│  │  🎁 Free drink at Rione XIII  │  [Redeem]    │
│  │  Earned: 5/5 visits           │               │
│  └───────────────────────────────┘               │
│                                                   │
│  ── New Deals Near You ──                        │
│  [Browse Capitol Hill deals →]                   │
│                                                   │
│  [Nav: 🏠 Home  🔍 Explore  🎟️ Wallet  👤 Me] │
└─────────────────────────────────────────────────┘
```

**Loyalty model:**

Two parallel systems:
1. **Boost Points (global)** — Earned at any merchant. 50 pts per visit. Redeemable for $5 credits at any participating merchant at 500 pts. This incentivizes cross-merchant exploration within the zone.
2. **Merchant Stamps (per-merchant)** — "Visit 5 times, get a free X." Configurable by each merchant. This drives single-merchant repeat visits. Visual punch-card UI.

**Why two systems:**
- Global points keep customers *in the Boost ecosystem* — if they've accumulated 340 points, leaving Boost means losing value.
- Merchant stamps drive *individual merchant retention* — the merchant sees direct ROI from loyalty.
- Customers see progress toward both on every visit.

#### Screen: Visit History (`/wallet/history`)

```
┌─────────────────────────────────────────┐
│  Visit History                          │
│                                         │
│  June 2025                              │
│  ├─ Jun 28 · Elm Coffee · $2 off       │
│  │  +50 pts · Stamp 3/5                │
│  ├─ Jun 25 · Via Tribunali · Free app  │
│  │  +50 pts · Stamp 1/5                │
│  ├─ Jun 22 · Elm Coffee · $2 off       │
│  │  +50 pts · Stamp 2/5                │
│  ├─ Jun 18 · Rione XIII · 10% off      │
│  │  +50 pts · Stamp 5/5 → 🎁 REWARD   │
│  ...                                    │
│                                         │
│  Total visits: 12 · Points earned: 600  │
└─────────────────────────────────────────┘
```

---

### 1.6 Referral Mechanics

#### How Sharing Works

From any deal or merchant page:

```
[Share Deal 🔗]
┌─────────────────────────────────────────┐
│  Share this deal                        │
│                                         │
│  Your personal link:                    │
│  boost.app/r/sarah-7k3m                │
│                                         │
│  [Copy Link] [WhatsApp] [iMessage]     │
│  [Instagram Story] [Twitter]            │
│                                         │
│  You get: 25 bonus points when they     │
│  redeem their first deal                │
│  They get: $1 extra off their first deal│
└─────────────────────────────────────────┘
```

#### What the Recipient Sees (`/r/{code}`)

```
┌─────────────────────────────────────────┐
│  Sarah invited you to Boost!            │
│                                         │
│  🎁 You get $1 extra off your first    │
│     deal at any Capitol Hill merchant   │
│                                         │
│  ── Sarah's favorite deals ──           │
│  ☕ $2 off at Elm Coffee                │
│  🍕 Free app at Via Tribunali           │
│                                         │
│  [Join Boost & Claim Your Bonus]        │
│                                         │
│  Already have an account? [Sign in]     │
└─────────────────────────────────────────┘
```

**Referral tracking:** The referral code is attributed to the referrer. When recipient creates account and makes first redemption, both parties earn their bonus. The merchant sees "referred by existing customer" in their CRM — this is high-signal data.

---

## Part 2: Merchant-Facing UX

### 2.1 Information Architecture — Merchant Side

```
/biz                        → Merchant home (redirect to dashboard)
/biz/dashboard              → Overview dashboard
/biz/deals                  → Deal management (create, edit, pause)
/biz/deals/new              → Create new deal (template picker + AI)
/biz/deals/{id}             → Deal detail + performance
/biz/customers              → CRM customer list
/biz/customers/{id}         → Individual customer profile
/biz/loyalty                → Loyalty program configuration
/biz/analytics              → Deep analytics (retention, cohorts)
/biz/settings               → Business profile, team, billing
/biz/redeem                 → Staff redemption screen (existing)
```

### 2.2 Merchant Dashboard (`/biz/dashboard`)

**Current state:** KPI cards (today's redemptions, WTD, amount owed) + charts + redemption table.

**New state:** Retention-first dashboard. The hierarchy of metrics changes.

```
┌─────────────────────────────────────────────────────────────┐
│  Elm Coffee Roasters                    [Capitol Hill zone] │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  ── This Week ──                                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│  │ NEW      │ │ RETURNING│ │ RETURN   │ │ EST. LTV │     │
│  │ CUSTOMERS│ │ CUSTOMERS│ │ RATE     │ │ PER CUST │     │
│  │    18    │ │    12    │ │   40%    │ │  $47     │     │
│  │ +3 vs lw │ │ +5 vs lw │ │ +8% ↑   │ │ +$6 ↑   │     │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
│                                                             │
│  ── Retention Funnel ──                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  [Bar chart: cohort retention]                       │   │
│  │  Week 1: 30 new → Week 2: 12 returned (40%)        │   │
│  │  → Week 3: 8 returned (27%) → Week 4: 6 (20%)      │   │
│  │                                                       │   │
│  │  Industry avg: 15%  ✅ You're above average          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Active Deals Performance ──                            │
│  ┌────────────────────┬────────┬──────────┬───────────┐   │
│  │ Deal               │ Redeem │ Return % │ ROI       │   │
│  ├────────────────────┼────────┼──────────┼───────────┤   │
│  │ $2 off any drink   │ 142    │ 38%      │ 4.2x      │   │
│  │ Free pastry w/drk  │ 67     │ 52%      │ 6.1x  ⭐ │   │
│  │ BOGO Tuesday       │ 23     │ 15%      │ 1.1x  ⚠️ │   │
│  └────────────────────┴────────┴──────────┴───────────┘   │
│  💡 "Free pastry" drives 3x more return visits than BOGO. │
│     Consider pausing BOGO and scaling the pastry deal.     │
│                                                             │
│  ── Recent Activity ──                                     │
│  │ 2:34 PM · Sarah M. redeemed "$2 off" · 3rd visit      │
│  │ 2:12 PM · Alex K. redeemed "$2 off" · NEW customer    │
│  │ 1:45 PM · Jamie L. redeemed "Free pastry" · 5th visit │
│  │          🎁 Earned loyalty reward!                      │
│  [View all →]                                              │
│                                                             │
│  ── Quick Actions ──                                       │
│  [+ Create Deal]  [View Customers]  [Configure Loyalty]   │
└─────────────────────────────────────────────────────────────┘
```

**The narrative shift:** The dashboard no longer leads with "redemptions" (a vanity metric). It leads with:
1. **New vs Returning** — the fundamental question: "Am I getting repeat business?"
2. **Return Rate** — the headline metric. This is what merchants care about but couldn't measure before.
3. **LTV per customer** — projected value based on visit frequency × average ticket.
4. **Deal ROI comparison** — which deals drive *repeat* business, not just one-time traffic.
5. **AI insight** — a plain-language recommendation based on the data.

### 2.3 Self-Serve Deal Creation (`/biz/deals/new`)

```
Step 1: Choose a template
┌─────────────────────────────────────────────────────────────┐
│  Create a New Deal                                          │
│                                                             │
│  ── Popular Templates ──                                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ 💰 $ Off     │ │ 🎁 Free Item │ │ 🔄 BOGO      │       │
│  │ "$X off      │ │ "Free X with │ │ "Buy one get │       │
│  │  any Y"      │ │  purchase"   │ │  one free"   │       │
│  │ Best for:    │ │ Best for:    │ │ Best for:    │       │
│  │ New customers│ │ Return visits│ │ Slow days    │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ ⏰ Happy Hour│ │ 🆕 First-Time│ │ ✨ Custom     │       │
│  │ "X% off      │ │ "Special for │ │ Write your   │       │
│  │  during..."  │ │  new visitors│ │ own deal     │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘

Step 2: Configure the deal
┌─────────────────────────────────────────────────────────────┐
│  Template: $ Off                                            │
│                                                             │
│  Deal headline:                                             │
│  [$2 off any drink_____________]                            │
│  ✨ [Generate with AI] ← uses merchant profile + menu      │
│                                                             │
│  Discount value:  [$2.00____]                               │
│  Applies to:      [Any drink ▼]                             │
│  Terms:           [One per customer per day____]            │
│                                                             │
│  ── Limits ──                                              │
│  Daily cap:       [50___] redemptions/day                   │
│  Active hours:    [7:00 AM] to [2:00 PM]                   │
│  Active days:     [✅M ✅T ✅W ✅T ✅F ☐S ☐S]            │
│  Start date:      [Today]                                   │
│  End date:        [No end date] or [Pick date]              │
│                                                             │
│  ── Targeting (optional) ──                                │
│  Available to:    (●) Everyone                              │
│                   ( ) New customers only                     │
│                   ( ) Returning customers only               │
│                   ( ) Referred customers only                │
│                                                             │
│  ── Preview ──                                             │
│  ┌─────────────────────────────────┐                       │
│  │ How customers will see it:       │                       │
│  │ ☕ Elm Coffee Roasters           │                       │
│  │ $2 off any drink                 │                       │
│  │ Mon-Fri, 7am-2pm · 50/day       │                       │
│  └─────────────────────────────────┘                       │
│                                                             │
│  [Launch Deal]  [Save Draft]                                │
└─────────────────────────────────────────────────────────────┘
```

**AI-generated copy:** Merchant uploads their menu (or we OCR it from a photo). AI generates deal headlines, terms, and descriptions tailored to their actual offerings. "Based on your menu, we suggest: '$2 off any espresso drink' — espresso drinks have the highest margin for coffee shops."

**Targeting by customer type** is new and critical for retention. A merchant can create:
- A generous deal for new customers (acquisition)
- A different deal for returning customers (retention)
- A special deal for referred customers (growth loop)

### 2.4 CRM View (`/biz/customers`)

**This screen doesn't exist today. It's the core of the pivot.**

```
┌─────────────────────────────────────────────────────────────┐
│  Customers                           [Export CSV] [Search]  │
│                                                             │
│  ── Summary ──                                             │
│  Total: 247 · Active (30d): 89 · At-risk: 34 · Lost: 124  │
│                                                             │
│  Segment: [All ▼]  [New] [Returning] [VIP] [At-risk]      │
│                                                             │
│  ┌──────────┬────────┬───────┬─────────┬─────────┬───────┐ │
│  │ Customer │ Visits │ Last  │ Points  │ Segment │ LTV   │ │
│  ├──────────┼────────┼───────┼─────────┼─────────┼───────┤ │
│  │ Sarah M. │   7    │ Today │ 350/500 │ VIP     │ $84   │ │
│  │ Alex K.  │   1    │ Today │ 50      │ New     │ $12   │ │
│  │ Jamie L. │   5    │ Jun 28│ 250     │ Return  │ $63   │ │
│  │ Pat R.   │   3    │ May 15│ 150     │ At-risk │ $31   │ │
│  │ Chris W. │   1    │ Apr 2 │ 50      │ Lost    │ $8    │ │
│  └──────────┴────────┴───────┴─────────┴─────────┴───────┘ │
│                                                             │
│  ── Automated Actions ──                                   │
│  ⚙️ At-risk re-engagement: ON                              │
│    "Send offer when customer hasn't visited in 14 days"    │
│  ⚙️ VIP recognition: ON                                    │
│    "Send thank-you after every 5th visit"                  │
│  [Configure automations →]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Customer segments (auto-calculated):**
- **New** — 1 visit, within last 14 days
- **Returning** — 2-4 visits
- **VIP** — 5+ visits or top 10% by LTV
- **At-risk** — Previously returning but no visit in 14+ days
- **Lost** — No visit in 30+ days

#### Screen: Individual Customer Profile (`/biz/customers/{id}`)

```
┌─────────────────────────────────────────────────────────────┐
│  [← Customers]                                              │
│                                                             │
│  Sarah M.                                      VIP ⭐      │
│  sarah.m***@gmail.com · (206) ***-**89                     │
│  Member since: May 2025                                     │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │ VISITS   │ │ TOTAL    │ │ AVG FREQ │                    │
│  │    7     │ │ SPENT*   │ │ Every    │                    │
│  │          │ │  ~$84    │ │ 5 days   │                    │
│  └──────────┘ └──────────┘ └──────────┘                    │
│  *estimated from avg ticket × visits                        │
│                                                             │
│  ── Loyalty Progress ──                                    │
│  ████████████████████░░░░  350 / 500 points                │
│  Stamps: ★★★★★★★☆☆☆ (7/10 → free drink)                  │
│                                                             │
│  ── Visit Timeline ──                                      │
│  Jul 9  · $2 off any drink     · Redeemed via QR scan      │
│  Jul 4  · $2 off any drink     · Redeemed via QR scan      │
│  Jun 28 · Free pastry w/ drink · Redeemed via QR scan      │
│  Jun 22 · $2 off any drink     · Redeemed via manual code  │
│  Jun 15 · $2 off any drink     · Redeemed via QR scan      │
│  Jun 8  · $2 off any drink     · Redeemed via QR scan      │
│  May 29 · $2 off any drink     · NEW (via referral: Pat R.)│
│                                                             │
│  ── Actions ──                                             │
│  [Send Personal Offer]  [Add Note]                          │
└─────────────────────────────────────────────────────────────┘
```

**Privacy note:** Merchants see first name, last initial, and masked contact info by default. Full contact info available only for customers who opted in to "share my info with merchants I visit." This is configurable in consumer account settings.

### 2.5 Loyalty Program Configuration (`/biz/loyalty`)

```
┌─────────────────────────────────────────────────────────────┐
│  Loyalty Program                              [Preview]     │
│                                                             │
│  ── Stamp Card ──                                          │
│  Program type: [Stamp card (visit-based) ▼]                │
│  Visits to earn reward:  [5_____]                           │
│  Reward:                 [Free drink (any size)____]        │
│  Reset after reward:     [✅ Yes, start new card]          │
│                                                             │
│  ── Bonus Rules ──                                         │
│  ┌─────────────────────────────────────────────┐           │
│  │ Double stamps on:  [☐M ☐T ☐W ☐T ☐F ☐S ☐S] │           │
│  │ Bonus stamp for:   [✅ Referral redemption]  │           │
│  │ Birthday reward:   [✅ Free item on birthday]│           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
│  ── Automated Messages ──                                  │
│  (sent via SMS or push notification)                       │
│                                                             │
│  After 1st visit:                                          │
│  [✅] "Thanks for visiting! You earned your first stamp.   │
│        4 more visits → free drink 🎉"                      │
│  [Edit message]                                            │
│                                                             │
│  At-risk (no visit in __ days): [14]                       │
│  [✅] "We miss you! Here's $2 off your next visit.         │
│        Your stamp card: 3/5 — so close!"                   │
│  [Edit message]                                            │
│                                                             │
│  Reward earned:                                            │
│  [✅] "🎉 You earned a free drink! Show this at            │
│        Elm Coffee to redeem. Valid for 30 days."           │
│  [Edit message]                                            │
│                                                             │
│  [Save Changes]                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2.6 Analytics — Retention Deep Dive (`/biz/analytics`)

```
┌─────────────────────────────────────────────────────────────┐
│  Analytics                     [Last 30 days ▼] [Export]   │
│                                                             │
│  ── Tabs ──                                                │
│  [Overview] [Retention] [Deals] [Customers]                │
│                                                             │
│  ══════ RETENTION TAB ══════                               │
│                                                             │
│  ── Cohort Retention Heatmap ──                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Week 1  Week 2  Week 3  Week 4  Week 5      │   │
│  │ Jun 2   30      12(40%) 8(27%)  6(20%)  5(17%)     │   │
│  │ Jun 9   25      11(44%) 7(28%)  5(20%)  —          │   │
│  │ Jun 16  35      16(46%) 10(29%) —       —          │   │
│  │ Jun 23  28      14(50%) —       —       —          │   │
│  │ Jun 30  32      —       —       —       —          │   │
│  │                                                       │   │
│  │ ■ >40% (great)  ■ 20-40% (ok)  ■ <20% (needs work) │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Deal Comparison: Repeat vs One-and-Done ──             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Stacked bar chart]                                   │   │
│  │                                                       │   │
│  │ $2 off drink    ████████████ 38% returned             │   │
│  │ Free pastry     ████████████████ 52% returned         │   │
│  │ BOGO Tuesday    ████ 15% returned                     │   │
│  │ 10% off total   ██████████ 31% returned               │   │
│  │                                                       │   │
│  │ ■ Returned within 14 days  ■ Never returned           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 INSIGHT: "Free pastry with drink" has 3.5x higher     │
│  return rate than BOGO. Customers who redeem the pastry    │
│  deal return an average of 4.2 times.                      │
│                                                             │
│  ── Customer Lifetime Value Distribution ──                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [Histogram]                                           │   │
│  │ $0-10: ████████████████ 124 customers                 │   │
│  │ $10-30: ████████ 67 customers                         │   │
│  │ $30-60: ████ 34 customers                             │   │
│  │ $60-100: ██ 15 customers                              │   │
│  │ $100+: █ 7 customers                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── Referral Network ──                                    │
│  Top referrers: Sarah M. (5), Pat R. (3), Jamie L. (2)   │
│  Referral conversion rate: 67% (of invitees who redeemed) │
│  Avg LTV of referred customers: $52 (vs $31 organic)      │
└─────────────────────────────────────────────────────────────┘
```

**The killer insight for merchants:** "Which of my deals bring people back vs which attract deal-chasers who never return?" No one provides this today. Groupon couldn't because they had no consumer identity. Yelp can't because they don't track redemptions. Google Ads can't because they lose attribution at the door.

---

## Part 3: Navigation Structure

### Consumer Navigation

**Bottom tab bar (mobile-first, since it's a PWA):**

```
┌─────────┬─────────┬─────────┬─────────┐
│ 🏠 Home │ 🔍 Find │ 🎟️ Wallet│ 👤 Me  │
└─────────┴─────────┴─────────┴─────────┘
```

| Tab | Destination | Description |
|-----|------------|-------------|
| Home | `/n/{user-neighborhood}` | Neighborhood deals feed (default view) |
| Find | `/` with search focus | Search merchants/deals, neighborhood picker |
| Wallet | `/wallet` | Active deals, points, loyalty progress, rewards |
| Me | `/account` | Profile, history, referrals, settings |

**Pre-login:** Home and Find work. Wallet and Me prompt sign-in.

### Merchant Navigation

**Left sidebar (desktop) / bottom sheet (mobile):**

```
┌──────────────────┐
│  BOOST BIZ       │
│  Elm Coffee      │
│                  │
│  📊 Dashboard    │
│  🎟️ Deals       │
│  👥 Customers   │
│  ⭐ Loyalty     │
│  📈 Analytics   │
│  ─────────────  │
│  📱 Redeem      │
│  ⚙️ Settings    │
└──────────────────┘
```

| Nav Item | Screen | Primary Use |
|----------|--------|-------------|
| Dashboard | `/biz/dashboard` | Daily check-in: new/returning split, deal performance, recent activity |
| Deals | `/biz/deals` | Create, edit, pause/resume deals. Template picker, AI copy. |
| Customers | `/biz/customers` | CRM list, segments, individual profiles, automated actions |
| Loyalty | `/biz/loyalty` | Configure stamp card, rewards, automated messages |
| Analytics | `/biz/analytics` | Retention cohorts, deal comparison, LTV distribution |
| Redeem | `/biz/redeem` | Staff-facing QR scanner (existing screen, enhanced) |
| Settings | `/biz/settings` | Business profile, team management, billing, integrations |

---

## Part 4: Data Architecture — What Flows Between Consumer and Merchant

### New Collections Needed (additions to existing 7)

```
consumers                    # Consumer profiles (separate from merchant users)
  ├── uid (Firebase Auth)
  ├── email
  ├── phone (optional, collected at first redemption)
  ├── display_name
  ├── home_zone_id           # Their primary neighborhood
  ├── location_verified_at
  ├── tier: free | boost_plus
  ├── global_points: int
  ├── referral_code: string  # Unique shareable code
  ├── referred_by: uid | null
  └── created_at

zones                        # Neighborhood/zone definitions
  ├── id
  ├── name ("Capitol Hill")
  ├── slug ("capitol-hill")
  ├── city ("Seattle")
  ├── bounds: GeoJSON polygon
  ├── center: {lat, lng}
  └── merchant_ids: [...]

consumer_visits              # Every verified visit (replaces pure redemption tracking)
  ├── id
  ├── consumer_id
  ├── merchant_id
  ├── offer_id
  ├── redemption_id          # Links to existing redemptions collection
  ├── zone_id
  ├── visit_number: int      # Nth visit to THIS merchant
  ├── points_earned: int
  ├── stamp_earned: bool
  ├── referred_by: uid | null
  └── timestamp

loyalty_configs              # Per-merchant loyalty program settings
  ├── merchant_id
  ├── program_type: "stamps" | "points" | "tiers"
  ├── stamps_required: int
  ├── reward_description: string
  ├── reward_value: float
  ├── reset_on_reward: bool
  ├── double_stamp_days: [int]
  ├── birthday_reward: bool
  └── automations: [{trigger, message, delay}]

loyalty_progress             # Per consumer-merchant loyalty state
  ├── id
  ├── consumer_id
  ├── merchant_id
  ├── current_stamps: int
  ├── total_stamps: int
  ├── rewards_earned: int
  ├── rewards_redeemed: int
  └── last_visit: timestamp

rewards                      # Earned rewards
  ├── id
  ├── consumer_id
  ├── merchant_id
  ├── loyalty_config_id
  ├── description: string
  ├── status: earned | redeemed | expired
  ├── earned_at: timestamp
  ├── redeemed_at: timestamp | null
  └── expires_at: timestamp

referrals                    # Referral tracking
  ├── id
  ├── referrer_id (consumer)
  ├── referred_id (consumer)
  ├── merchant_id | null      # If referred for specific merchant
  ├── zone_id
  ├── status: pending | completed
  ├── referrer_bonus_awarded: bool
  └── created_at

automated_messages           # Log of automated outreach
  ├── id
  ├── merchant_id
  ├── consumer_id
  ├── trigger: "first_visit" | "at_risk" | "reward_earned" | "birthday"
  ├── channel: "sms" | "push" | "email"
  ├── message_body
  ├── sent_at
  └── resulted_in_visit: bool  # Attribution!
```

### Data Flow Diagram

```
Consumer Action          → What Consumer Sees      → What Merchant Sees
─────────────────────────────────────────────────────────────────────────
Creates account          → Wallet (empty)           → (nothing yet)
                           Zone assigned

Browses neighborhood     → Deal listings            → (nothing — browse
page                       Map with merchants         is anonymous)

Claims a deal            → QR code + points          → (nothing until
                           preview                     redemption)

Redeems at register      → Points awarded            → New customer alert
(staff scans QR)           Stamp progress              Visit logged in CRM
                           Next-reward preview          Retention metrics
                                                        updated

Returns & redeems again  → "Visit #3!"              → Return visit counted
                           Updated stamps              Return rate updated
                           Points balance              LTV recalculated
                           "2 more → reward"           Customer segment
                                                        may change

Earns loyalty reward     → Reward in wallet          → Reward cost logged
                           Celebration animation       ROI calculated
                           "Redeem at store"

Shares referral link     → Unique link generated     → (nothing until
                           Points-pending shown         referred redeems)

Referred friend joins    → Referrer: bonus points    → "New customer via
& redeems                  Referred: bonus on deal     referral" in CRM
                                                       Referral network
                                                        in analytics

Doesn't return for 14d   → Re-engagement SMS/push   → At-risk alert
                           with personal offer         Customer moved to
                                                        "at-risk" segment

Returns after nudge      → "Welcome back!"          → Win-back tracked
                           Points + stamps              Automation ROI
                                                        measured
```

### API Additions Needed

```
# Consumer APIs (new)
POST   /consumer/register            # Create consumer account
GET    /consumer/profile              # Get own profile + points
GET    /consumer/wallet               # Active deals, points, rewards, stamps
GET    /consumer/visits               # Visit history
GET    /consumer/referral-link        # Get/generate referral link
POST   /consumer/claim/{offer_id}    # Claim a deal (generates personal QR)

# Discovery APIs (new, public)
GET    /zones                         # List available neighborhoods
GET    /zones/{slug}                  # Neighborhood detail + merchants
GET    /zones/{slug}/deals            # Active deals in zone
GET    /merchants/{id}/public         # Public merchant profile

# Merchant CRM APIs (new)
GET    /merchants/{id}/customers                  # Customer list with segments
GET    /merchants/{id}/customers/{consumer_id}    # Individual customer profile
GET    /merchants/{id}/analytics/retention        # Cohort retention data
GET    /merchants/{id}/analytics/deals            # Deal comparison (repeat vs one-and-done)
GET    /merchants/{id}/analytics/ltv              # LTV distribution

# Loyalty APIs (new)
GET    /merchants/{id}/loyalty        # Get loyalty config
PUT    /merchants/{id}/loyalty        # Update loyalty config
GET    /merchants/{id}/loyalty/rewards # List earned rewards for merchant's customers

# Redeem API (modified)
POST   /redeem                        # Now also creates consumer_visit, awards points/stamps
```

---

## Part 5: Implementation Priority

### Phase 1: Consumer Identity (Week 1-2)
**Without consumer accounts, nothing else works.**
- Consumer registration (Firebase Auth, separate from merchant auth)
- Consumer profile + zone assignment
- Personal QR codes (replace universal tokens)
- Modified `/redeem` endpoint to create `consumer_visits`
- Basic `/wallet` showing visit history

### Phase 2: Loyalty Foundation (Week 3-4)
- `loyalty_configs` collection + merchant config UI
- Stamp tracking on every redemption
- Consumer wallet: stamp progress per merchant
- Reward earning + redemption flow
- Staff redemption screen: show customer context

### Phase 3: Merchant CRM (Week 5-6)
- Customer list with auto-segments (new/returning/VIP/at-risk/lost)
- Individual customer profiles
- Retention dashboard (replace current redemption-only dashboard)
- Deal performance: repeat rate comparison

### Phase 4: Discovery & Growth (Week 7-8)
- Zone/neighborhood model
- Neighborhood browse pages
- Merchant profile pages (public)
- Referral system
- SEO: static neighborhood + merchant pages

### Phase 5: Automation & Intelligence (Week 9-10)
- Automated re-engagement messages (at-risk customers)
- AI deal copy generation
- Cohort retention analytics
- LTV calculations
- AI insights on dashboard ("Your pastry deal drives 3x more return visits")

---

## Key Design Principles

1. **Retention metrics > vanity metrics.** Every screen leads with return rate, not total redemptions.
2. **The consumer earns, the merchant learns.** Every interaction creates value on both sides.
3. **Neighborhood is the unit.** Not city, not individual store. The zone creates network effects between merchants.
4. **Qualifying friction is a feature.** Account creation isn't a barrier — it's a filter that makes the remaining users more valuable.
5. **Surface CRM at point of sale.** The staff scanning the QR should see "3rd visit, 2 away from reward" — that's the moment that creates personal connection.
6. **PWA-first, not browser-first.** The wallet experience needs to feel like an app. Push notifications, home screen icon, offline QR display.
