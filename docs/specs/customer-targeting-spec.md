# De-identified Customer Targeting with Spend Analytics

## Feature Spec v1.0

**Author:** Clawd (thought partner for Jilani)
**Date:** 2025-07-10
**Status:** Draft — ready for review

---

## 1. Problem Statement

Merchants on Boost can see their customers (de-identified), but they have **zero spend data**. The CRM shows visit counts and segments, but a merchant can't answer:

- "What does Sarah M. typically spend?"
- "What does she order?"
- "Which customers love my lattes but have never tried my pastries?"
- "How can I send a targeted 20%-off-pastries coupon to latte lovers?"

Without order/spend data, targeting is limited to blunt segments (VIP, at-risk). The goal is **personalized, item-aware targeting** while maintaining complete de-identification.

---

## 2. Gap Analysis: What's Missing

### Current Data Model (what we have)

| Collection | Key Fields | Limitation |
|---|---|---|
| `consumer_visits` | consumer_id, merchant_id, offer_id, visit_number, points_earned, stamp_earned, timestamp | **No spend amount. No item breakdown.** |
| `redemptions` | token_id, offer_id, merchant_id, value (merchant's cost), timestamp | `value` is *coupon cost to merchant*, not customer spend |
| `consumers` | display_name, global_points, referral_code | No purchase preferences stored |
| `customers.py` | Computes segment, LTV from `visit_count * $12` | **LTV is a guess using DEFAULT_AVG_TICKET = $12.00** |

### What We Need to Add

| Data | Why | Minimum Fields |
|---|---|---|
| **Order totals** | avg spend, biggest order, median order | `order_total: float` per visit/transaction |
| **Line items** | "most popular dishes" for item-level targeting | `item_name: str`, `item_price: float`, `quantity: int` |
| **Spend profiles** (computed) | Pre-aggregated stats per consumer×merchant | avg_spend, max_spend, median_spend, top_items, total_spend |
| **Targeted campaigns** | Merchant creates coupon → routes to specific consumers | campaign with audience filter, linked offer |
| **Campaign delivery records** | Track what was sent to whom | consumer_id, campaign_id, delivered_at, redeemed |

---

## 3. Architecture: End-to-End Design

### 3.1 How Merchants Input Order Data

This is the **critical UX question**. Three options, in order of pragmatism:

#### Option A: Manual Entry at Redemption (MVP ✅)

When staff scans a QR / redeems a deal, we add an **optional** step:

```
[Redemption Successful! ✅]

Optional: Log this order
┌─────────────────────────────┐
│ Order total: [$ _____ ]     │
│                             │
│ + Add items (optional)      │
│   Coffee - Latte    $5.50   │
│   Food - Croissant  $3.50   │
│   [+ Add item]              │
│                             │
│ [Skip]        [Save Order]  │
└─────────────────────────────┘
```

**Why this works for MVP:**
- Zero integration cost
- Staff already touch the app at redemption time
- "Order total" alone (without items) is still hugely valuable
- Items are optional — we get spend data even if they skip items
- A cafe owner enters ~20-50 orders/day — manageable

**Tradeoffs:**
- Manual = friction. Some merchants won't bother
- Item entry is tedious without a catalog
- Data quality depends on staff discipline

#### Option B: Merchant Item Catalog + Quick-Pick (v1.5)

Merchant pre-configures their menu/catalog in settings:

```
Menu Items:
  ☕ Latte         $5.50
  ☕ Americano     $4.00
  🥐 Croissant    $3.50
  🥗 Salad Bowl   $12.00
```

At redemption, staff taps items from the catalog instead of typing. Order total auto-calculates. Much faster, better data quality.

#### Option C: POS Integration (v2+, nice-to-have)

Integrate with Square, Clover, Toast, Shopify POS via webhooks/APIs. Auto-captures every transaction with full item detail. This is the dream but requires per-POS integration work.

**MVP Decision: Option A (manual entry) with the data model designed to support B and C later.**

### 3.2 Data Model Design

#### New Firestore Collection: `orders`

```
orders/{order_id}
├── consumer_id: string        # Links to consumer (for spend profile)
├── merchant_id: string        # Which merchant
├── visit_id: string | null    # Links to consumer_visits doc (if from redemption flow)
├── order_total: float          # Total spend amount
├── items: [                    # Optional line items
│   { name: "Latte", category: "coffee", price: 5.50, quantity: 1 },
│   { name: "Croissant", category: "food", price: 3.50, quantity: 1 }
│ ]
├── source: "manual" | "catalog" | "pos"   # How data was entered
├── created_at: timestamp
```

#### New Firestore Collection: `spend_profiles`

Pre-aggregated per consumer×merchant. Updated on each new order.

```
spend_profiles/{consumer_id}_{merchant_id}
├── consumer_id: string
├── merchant_id: string
├── order_count: int
├── total_spend: float
├── avg_spend: float            # total_spend / order_count
├── max_spend: float            # Biggest single order
├── median_spend: float         # Median order value
├── all_order_totals: [float]   # Stored for accurate median recalculation
├── top_items: [                # Most frequently ordered, top 5
│   { name: "Latte", category: "coffee", count: 15, total_spent: 82.50 },
│   { name: "Croissant", category: "food", count: 8, total_spent: 28.00 }
│ ]
├── item_counts: {string: int}  # Full item frequency map (for long-tail)
├── last_order_at: timestamp
├── updated_at: timestamp
```

**Why pre-aggregate?** Merchants will load customer lists with spend data frequently. Computing from raw orders on every page load is expensive with Firestore. We recompute the profile on each new order (incremental update).

**Privacy note:** `spend_profiles` contain no PII. The `consumer_id` is an opaque UID. The merchant already sees this ID in the CRM — they just can't resolve it to a name/phone.

#### New Firestore Collection: `campaigns`

```
campaigns/{campaign_id}
├── merchant_id: string
├── name: string                    # "Win back latte lovers"
├── offer_id: string | null         # Linked to an existing offer, or null for custom
├── custom_discount_text: string    # e.g., "20% off any pastry"
├── custom_terms: string | null
├── audience_type: "segment" | "individual" | "item_affinity" | "spend_range"
├── audience_filter: {
│   segment?: ["vip", "at_risk"],           # Target by segment
│   consumer_ids?: ["c1", "c3", "c7"],      # Target specific consumers
│   item_names?: ["Latte", "Americano"],    # Target by item preference
│   item_categories?: ["coffee"],            # Target by category
│   min_avg_spend?: 10.0,                   # Spend range filter
│   max_avg_spend?: 50.0,
│   min_orders?: 3                           # Minimum order history
│ }
├── matched_consumers: [string]     # Resolved consumer IDs at send time
├── status: "draft" | "sent" | "completed"
├── sent_at: timestamp | null
├── created_at: timestamp
├── stats: {                        # Populated after send
│   total_targeted: int,
│   delivered: int,
│   redeemed: int,
│   revenue_attributed: float
│ }
```

#### New Firestore Collection: `campaign_deliveries`

```
campaign_deliveries/{delivery_id}
├── campaign_id: string
├── consumer_id: string
├── merchant_id: string
├── offer_id: string | null
├── discount_text: string
├── delivered_at: timestamp
├── seen_at: timestamp | null       # When consumer saw it in wallet
├── redeemed: bool
├── redeemed_at: timestamp | null
```

#### Updated Collection: `merchant_catalogs` (for v1.5)

```
merchant_catalogs/{merchant_id}
├── items: [
│   { id: "item_1", name: "Latte", category: "coffee", price: 5.50, active: true },
│   { id: "item_2", name: "Croissant", category: "food", price: 3.50, active: true }
│ ]
├── categories: ["coffee", "food", "specialty"]
├── updated_at: timestamp
```

### 3.3 Spend Profile Computation

When a new order is saved:

```python
def update_spend_profile(db, consumer_id, merchant_id, order_total, items):
    profile_id = f"{consumer_id}_{merchant_id}"
    ref = db.collection(SPEND_PROFILES).document(profile_id)
    doc = ref.get()

    if doc.exists:
        profile = doc.to_dict()
        # Incremental update
        profile["order_count"] += 1
        profile["total_spend"] += order_total
        profile["avg_spend"] = profile["total_spend"] / profile["order_count"]
        profile["max_spend"] = max(profile["max_spend"], order_total)
        profile["all_order_totals"].append(order_total)
        sorted_totals = sorted(profile["all_order_totals"])
        n = len(sorted_totals)
        profile["median_spend"] = (
            sorted_totals[n // 2] if n % 2 == 1
            else (sorted_totals[n // 2 - 1] + sorted_totals[n // 2]) / 2
        )
        # Update item frequency
        for item in items:
            name = item["name"]
            profile["item_counts"][name] = profile["item_counts"].get(name, 0) + item.get("quantity", 1)
        # Recompute top 5
        profile["top_items"] = sorted(
            [{"name": k, "count": v} for k, v in profile["item_counts"].items()],
            key=lambda x: x["count"], reverse=True
        )[:5]
    else:
        profile = {
            "consumer_id": consumer_id,
            "merchant_id": merchant_id,
            "order_count": 1,
            "total_spend": order_total,
            "avg_spend": order_total,
            "max_spend": order_total,
            "median_spend": order_total,
            "all_order_totals": [order_total],
            "top_items": [{"name": i["name"], "count": i.get("quantity", 1)} for i in items[:5]],
            "item_counts": {i["name"]: i.get("quantity", 1) for i in items},
            "last_order_at": now,
            "updated_at": now,
        }

    ref.set(profile)
```

**Scaling note:** `all_order_totals` as a list is fine for a local business (~500-2000 orders/customer over years). If it gets unwieldy (>10K), we can switch to an approximate median algorithm.

### 3.4 What Merchants See vs. What's Hidden

| Visible to Merchant | Hidden from Merchant |
|---|---|
| De-identified name ("Sarah M.") | Full name, phone, email |
| Consumer segment (VIP, at-risk, etc.) | Consumer's other merchant activity |
| Avg spend, max spend, median spend | Raw consumer_id |
| Top items ordered (at THIS merchant) | Home address, location |
| Visit count and recency | Global points balance |
| Loyalty stamp progress | Other merchants' spend data |

**Key privacy rule:** A merchant's spend profile only contains data from THEIR store. A consumer's Latte purchases at Café A are invisible to Restaurant B.

### 3.5 Campaign Creation UI Flow

```
Dashboard → Customers → [Select Customers] → Create Campaign

Step 1: Choose Audience
┌─────────────────────────────────────────┐
│ Who do you want to target?              │
│                                         │
│ ○ A specific customer                   │
│   → Select from customer list           │
│                                         │
│ ○ A segment                             │
│   → [VIP] [At-risk] [Returning] [New]   │
│                                         │
│ ○ Customers who order specific items    │
│   → [Latte] [Americano] [Croissant]     │
│                                         │
│ ○ Customers by spend level              │
│   → Avg spend: [$10] to [$50]           │
│                                         │
│ Preview: 12 customers matched           │
└─────────────────────────────────────────┘

Step 2: Create the Offer
┌─────────────────────────────────────────┐
│ What deal will they get?                │
│                                         │
│ ○ Use existing deal                     │
│   → [Select from active offers ▼]      │
│                                         │
│ ○ Create a custom deal                  │
│   Name: [Win-back special]              │
│   Discount: [20% off any pastry]        │
│   Terms: [Valid 7 days]                 │
│                                         │
│ [Preview]              [Send Campaign]  │
└─────────────────────────────────────────┘
```

### 3.6 Campaign Delivery

When a campaign is sent:
1. Resolve audience filter → list of consumer_ids
2. For each consumer, create a `campaign_delivery` record
3. The deal appears in the consumer's **wallet** as a "Targeted Offer" (distinguished from general offers)
4. Consumer redeems it like any other deal (scan QR / enter code)
5. On redemption, mark `campaign_delivery.redeemed = true` and update campaign stats

**No push notifications in MVP.** The deal just appears in the wallet. Consumers see it next time they open the app. (Future: push notification via Firebase Cloud Messaging.)

### 3.7 Targeting Dashboard

New section on the merchant dashboard (or sub-page):

```
Campaign Performance
┌──────────────────────────────────────────────────────┐
│ Campaign           Sent    Seen   Redeemed   Revenue │
│ ─────────────────────────────────────────────────── │
│ Latte lovers 20%   24      18     7 (29%)    $84.00  │
│ Win back VIPs      8       5      2 (25%)    $36.00  │
│ New customer 2nd   12      9      4 (33%)    $48.00  │
└──────────────────────────────────────────────────────┘
```

---

## 4. Pragmatic Tradeoffs: MVP vs. Nice-to-Have

### MVP (build this first)

| Feature | Rationale |
|---|---|
| Order total capture at redemption | One number field. Huge value. |
| Spend profile computation (avg/max/median) | Basic math on order totals. No items needed. |
| Enhanced CRM with spend columns | Show spend data alongside existing customer list |
| Segment-based campaign creation | Reuses existing segment logic |
| Campaign delivery to wallet | Consumer sees it in existing wallet UI |
| Campaign performance dashboard | Basic counts: sent/redeemed |

### v1.5 (build after MVP validates)

| Feature | Rationale |
|---|---|
| Item-level entry (line items in orders) | Requires more UI work, but unlocks item targeting |
| Merchant catalog/menu management | Makes item entry fast |
| Item affinity targeting | "Target all latte lovers" |
| Campaign A/B testing | Compare two offers on similar audiences |

### v2+ (nice-to-have / future)

| Feature | Rationale |
|---|---|
| POS integration (Square, Toast, Clover) | Auto-captures everything, eliminates manual entry |
| Receipt scan (OCR) | Camera-based item extraction |
| AI-generated targeting suggestions | "Your VIPs haven't ordered pastries — try a cross-sell" |
| Push notifications for campaigns | FCM integration |
| Spend-based loyalty tiers | Auto-upgrade tiers based on spend |

### What We Can Mock Initially

- **Item data:** Pre-seed spend profiles with synthetic item data for demo/testing. The UI can show "Top items: Latte (12×), Croissant (8×)" even if we only have order totals, by generating plausible items from the merchant's category.
- **Campaign delivery:** In MVP, creating a campaign just creates the records. Actual "delivery" = it shows up in wallet on next load. No push needed.
- **Revenue attribution:** Estimate from `order_total` at redemption. Don't need a separate revenue tracking system.

---

## 5. Edge Cases & Considerations

### Privacy

1. **Merchant cannot reverse-identify consumers.** Even with spend data, "Sarah M. who spends $45 avg and orders lattes" is not identifying without cross-referencing external data. This is the same de-identification level as the existing CRM.

2. **Cross-merchant data isolation.** Spend profiles are scoped per merchant. A consumer's data at Merchant A is invisible to Merchant B. This is enforced at the query level (`where merchant_id == X`).

3. **Consumer opt-out.** Future consideration: let consumers opt out of targeted campaigns. For MVP, all consumers who visit a merchant are targetable by that merchant (they've already established a relationship).

### Small Merchant Realities

4. **A cafe with 50 orders/day can enter totals.** It adds ~5 seconds per redemption. Items are harder — maybe 10 orders/day get item-level detail. That's fine; we compute spend profiles from whatever data we have.

5. **Merchants with no order data.** The CRM still works without spend data — it just shows "No spend data yet" where the stats would be. Graceful degradation.

6. **Sparse item data.** If a consumer has 10 visits but only 3 with item data, "top items" is based on those 3. Better than nothing. We show "Based on 3 orders" as a confidence indicator.

### Technical Edge Cases

7. **Median with 1 order:** median = that order's total. Fine.

8. **`all_order_totals` growing large:** Cap at 1000 entries. After that, use running median approximation or just drop the oldest. For a local business with ~500 visits/year per top customer, this won't be hit for years.

9. **Campaign targeting with 0 matches:** Show "No customers match this filter. Try broadening your criteria." Don't let merchants send empty campaigns.

10. **Concurrent order writes:** Firestore transactions for spend profile updates to avoid race conditions on the aggregation fields.

---

## 6. Beads (Work Items)

### Epic: De-identified Customer Targeting with Spend Analytics

**Description:** Enable merchants to capture order/spend data, view customer spend profiles in the CRM, create targeted campaigns based on spend/item data, and track campaign performance — all while maintaining consumer de-identification.

**Overall Acceptance Criteria:**
- Merchants can log order totals (and optionally items) during redemption
- CRM customer list shows avg spend, max spend, top items per customer
- Merchants can create targeted campaigns filtering by segment, spend range, or specific consumers
- Campaigns appear as targeted offers in consumer wallets
- Campaign performance dashboard shows sent/redeemed/revenue metrics
- All consumer-facing data remains de-identified (no names, phones, emails visible to merchants)

---

### Bead 1: Order Data Model & Collection Constants

**Type:** code
**Description:** Add Firestore collection constants and Pydantic models for orders, spend profiles, campaigns, and campaign deliveries. This is the data foundation for everything else.

**Files to touch:**
- `apps/api/app/db.py` (modify) — add collection name constants
- `apps/api/app/models.py` (modify) — add Pydantic models for Order, SpendProfile, Campaign, CampaignDelivery

**Steps:**
1. Add to `db.py`: `ORDERS = "orders"`, `SPEND_PROFILES = "spend_profiles"`, `CAMPAIGNS = "campaigns"`, `CAMPAIGN_DELIVERIES = "campaign_deliveries"`, `MERCHANT_CATALOGS = "merchant_catalogs"`
2. Add to `models.py`:
   - `OrderItem(BaseModel)`: name, category (optional), price, quantity
   - `OrderCreate(BaseModel)`: consumer_id, merchant_id, visit_id (optional), order_total, items (list[OrderItem], optional), source (literal["manual", "catalog", "pos"])
   - `Order(BaseModel)`: id + all OrderCreate fields + created_at
   - `SpendProfileTopItem(BaseModel)`: name, category (optional), count, total_spent
   - `SpendProfile(BaseModel)`: consumer_id, merchant_id, order_count, total_spend, avg_spend, max_spend, median_spend, top_items (list[SpendProfileTopItem]), last_order_at, updated_at
   - `AudienceFilter(BaseModel)`: segment (optional list), consumer_ids (optional list), item_names (optional list), item_categories (optional list), min_avg_spend (optional float), max_avg_spend (optional float), min_orders (optional int)
   - `CampaignCreate(BaseModel)`: merchant_id, name, offer_id (optional), custom_discount_text (optional), custom_terms (optional), audience_type (literal), audience_filter (AudienceFilter)
   - `Campaign(BaseModel)`: id + CampaignCreate fields + matched_consumers, status, sent_at, created_at, stats dict
   - `CampaignDelivery(BaseModel)`: id, campaign_id, consumer_id, merchant_id, offer_id, discount_text, delivered_at, seen_at, redeemed, redeemed_at
   - `CampaignStats(BaseModel)`: total_targeted, delivered, redeemed, revenue_attributed

**Depends on:** nothing (first bead)

**Acceptance Criteria:**
- [ ] `db.py` has 5 new collection constants
- [ ] All Pydantic models validate correctly (import without error)
- [ ] Models use appropriate Field constraints (min_length, ge, etc.)
- [ ] `OrderCreate.order_total` has `ge=0.01`
- [ ] `AudienceFilter` allows all filter fields to be optional (at least one required validated in endpoint, not model)

---

### Bead 2: Orders API & Spend Profile Engine

**Type:** code
**Description:** Create the orders router with endpoint to log an order (at redemption time) and a service function that recomputes the spend profile on each new order. Also add an endpoint to retrieve a spend profile.

**Files to touch:**
- `apps/api/app/orders.py` (new) — orders router + spend profile computation
- `apps/api/app/main.py` (modify) — register the orders router

**Steps:**
1. Create `orders.py` with APIRouter(tags=["orders"])
2. Implement `POST /merchants/{merchant_id}/orders` endpoint:
   - Auth: `require_staff_or_above(user, merchant_id)`
   - Accepts `OrderCreate` body
   - Validates consumer_id exists in CONSUMERS
   - Saves order to ORDERS collection
   - Calls `update_spend_profile()` (see below)
   - Returns the created Order
3. Implement `update_spend_profile(db, consumer_id, merchant_id, order_total, items)` function:
   - Get or create spend_profiles/{consumer_id}_{merchant_id}
   - Incrementally update: order_count, total_spend, avg_spend, max_spend
   - Maintain `all_order_totals` list (capped at 1000) for median calculation
   - Update item_counts dict and recompute top_items (top 5 by count)
   - Use Firestore transaction to prevent race conditions
   - Set updated_at
4. Implement `GET /merchants/{merchant_id}/spend-profiles/{consumer_id}`:
   - Auth: `require_staff_or_above(user, merchant_id)`
   - Returns SpendProfile or 404
5. Implement `GET /merchants/{merchant_id}/spend-profiles`:
   - Auth: `require_staff_or_above(user, merchant_id)`
   - Returns list of all spend profiles for this merchant (for CRM enrichment)
   - Supports pagination (limit/offset)
6. Register router in `main.py`

**Depends on:** Bead 1

**Acceptance Criteria:**
- [ ] POST /merchants/{mid}/orders creates an order doc and updates spend profile
- [ ] Spend profile correctly computes avg, max, median after multiple orders
- [ ] Items are tracked in item_counts and top_items reflects the 5 most frequent
- [ ] GET spend-profiles returns the profile with all computed fields
- [ ] Firestore transaction prevents race conditions on concurrent writes
- [ ] all_order_totals is capped at 1000 entries
- [ ] Returns 404 for non-existent consumer_id
- [ ] Auth: staff_or_above required

---

### Bead 3: Wire Order Logging into Redemption Flow

**Type:** code
**Description:** Modify the existing redemption endpoint to optionally accept order data inline. When order_total is provided during redemption, automatically create an order record and update the spend profile — so merchants don't need a separate step.

**Files to touch:**
- `apps/api/app/models.py` (modify) — extend RedeemRequest with optional order fields
- `apps/api/app/main.py` (modify) — update the `redeem_token` endpoint

**Steps:**
1. Add optional fields to `RedeemRequest`:
   - `order_total: Optional[float] = Field(None, ge=0.01)`
   - `order_items: Optional[list[OrderItem]] = None`
2. In the personal QR redemption flow (inside `redeem_token`):
   - After successful redemption, if `data.order_total` is provided:
     - Call `create_order_and_update_profile()` from orders.py
     - Pass consumer_uid, merchant_id, visit_ref.id, order_total, items
   - Include spend summary in `RedeemResponse` (add optional fields)
3. Add to `RedeemResponse`:
   - `order_logged: Optional[bool] = None`
   - `total_visits_with_spend: Optional[int] = None`

**Depends on:** Bead 2

**Acceptance Criteria:**
- [ ] Existing redemption flow works unchanged when order_total is not provided
- [ ] When order_total is provided, an order doc is created and spend profile updated
- [ ] RedeemResponse includes `order_logged: true` when order was captured
- [ ] Order items are optional — order_total alone is sufficient
- [ ] No regression: all existing redemption tests pass

---

### Bead 4: Enhanced CRM with Spend Data

**Type:** code
**Description:** Extend the customer list and detail endpoints to include spend profile data. Replace the hardcoded `DEFAULT_AVG_TICKET = 12.0` LTV estimate with real spend data when available.

**Files to touch:**
- `apps/api/app/models.py` (modify) — extend CustomerSummary and CustomerDetail with spend fields
- `apps/api/app/customers.py` (modify) — enrich customer data with spend profiles

**Steps:**
1. Add to `CustomerSummary`:
   - `avg_spend: Optional[float] = None`
   - `max_spend: Optional[float] = None`
   - `total_spend: Optional[float] = None`
   - `order_count: Optional[int] = None`
   - `has_spend_data: bool = False`
2. Add to `CustomerDetail`:
   - Same spend fields as CustomerSummary, plus:
   - `median_spend: Optional[float] = None`
   - `top_items: list[SpendProfileTopItem] = []`
3. In `list_customers()`:
   - After computing consumer_visits groups, batch-fetch spend profiles for all consumer_ids
   - Merge spend data into CustomerSummary
   - When spend data exists, use `total_spend` for LTV instead of `visit_count * DEFAULT_AVG_TICKET`
   - Support new sort keys: `avg_spend`, `total_spend`
4. In `get_customer_detail()`:
   - Fetch spend profile for the specific consumer
   - Include top_items, median_spend in the detail response
   - Use real LTV when available

**Depends on:** Bead 2

**Acceptance Criteria:**
- [ ] Customer list includes spend columns (avg_spend, total_spend) when data exists
- [ ] `has_spend_data: false` when no orders logged (graceful degradation)
- [ ] LTV uses real total_spend when available, falls back to visit_count * $12 when not
- [ ] Customer detail shows top_items and median_spend
- [ ] No regression: existing customer list tests pass with no spend data
- [ ] Pagination and segment filtering still work correctly

---

### Bead 5: Campaign Engine (Backend)

**Type:** code
**Description:** Create the campaigns router with endpoints to create, list, send, and get campaign details. The audience resolution engine matches consumers based on filter criteria.

**Files to touch:**
- `apps/api/app/campaigns.py` (new) — campaigns router + audience resolution
- `apps/api/app/main.py` (modify) — register the campaigns router

**Steps:**
1. Create `campaigns.py` with APIRouter(tags=["campaigns"])
2. Implement audience resolution function `resolve_audience(db, merchant_id, audience_filter) -> list[str]`:
   - Filter by segment: reuse `_compute_segment()` from customers.py
   - Filter by consumer_ids: validate they exist for this merchant
   - Filter by spend range: query spend_profiles where avg_spend in range
   - Filter by item affinity: query spend_profiles where item_counts contains target items
   - Filter by min_orders: spend_profiles where order_count >= N
   - Intersect all active filters (AND logic)
   - Return list of consumer_ids
3. Implement `POST /merchants/{merchant_id}/campaigns`:
   - Auth: require_merchant_admin
   - Accepts CampaignCreate
   - Resolves audience to preview count (doesn't send yet)
   - Saves campaign with status="draft"
   - Returns Campaign with matched_consumers count
4. Implement `POST /merchants/{merchant_id}/campaigns/{campaign_id}/send`:
   - Auth: require_merchant_admin
   - Resolves audience (fresh resolution at send time)
   - Creates campaign_delivery records for each matched consumer
   - Updates campaign status to "sent", sets sent_at, stores matched_consumers
   - Returns campaign with stats
5. Implement `GET /merchants/{merchant_id}/campaigns`:
   - Auth: require_staff_or_above
   - Returns list of campaigns with stats
   - Supports status filter (draft/sent/completed)
6. Implement `GET /merchants/{merchant_id}/campaigns/{campaign_id}`:
   - Auth: require_staff_or_above
   - Returns full campaign detail with delivery stats
7. Register router in `main.py`

**Depends on:** Bead 4 (needs spend profiles and segment computation)

**Acceptance Criteria:**
- [ ] Audience resolution correctly filters by segment, spend range, consumer_ids
- [ ] Item affinity filter works (target consumers who ordered "Latte")
- [ ] Filters combine with AND logic (e.g., VIP AND avg_spend > $20)
- [ ] Draft campaigns show preview count without sending
- [ ] Send creates campaign_delivery records for all matched consumers
- [ ] Campaign list shows summary stats (targeted, redeemed)
- [ ] Empty audience returns error ("No customers match your criteria")
- [ ] Auth: merchant_admin for create/send, staff_or_above for read

---

### Bead 6: Campaign Delivery in Consumer Wallet

**Type:** code
**Description:** Surface targeted campaigns in the consumer wallet. When a consumer opens their wallet, check for undelivered campaign offers and show them as "Targeted Offers."

**Files to touch:**
- `apps/api/app/consumer.py` (modify) — extend wallet endpoint
- `apps/api/app/models.py` (modify) — add TargetedOffer model to wallet response

**Steps:**
1. Add `TargetedOffer(BaseModel)` to models.py:
   - delivery_id, campaign_name, merchant_name, discount_text, terms, delivered_at, expires_at
2. Add `targeted_offers: list[TargetedOffer] = []` to `ConsumerWalletResponse`
3. In `get_wallet()`:
   - Query campaign_deliveries where consumer_id == uid AND redeemed == false
   - For each delivery, look up campaign and merchant details
   - Mark seen_at if null (first time viewing)
   - Return as targeted_offers in wallet response
4. Handle redemption tracking:
   - When a targeted offer is redeemed (via normal redeem flow), update the campaign_delivery record
   - Add campaign_id to the redemption flow's context so we can attribute it

**Depends on:** Bead 5

**Acceptance Criteria:**
- [ ] Consumer wallet shows targeted offers section
- [ ] Targeted offers include merchant name, discount text, and expiry
- [ ] seen_at is set on first wallet load (for tracking)
- [ ] Redeemed offers are excluded from the list
- [ ] Wallet response is backwards-compatible (targeted_offers defaults to empty list)

---

### Bead 7: Redemption Flow Frontend (Order Logging UI)

**Type:** code
**Description:** Add the optional order logging UI to the redemption confirmation screen. After a successful scan/redeem, show an expandable "Log Order" section with order total field and optional item entry.

**Files to touch:**
- `apps/web/V0-ui/app/redeem/page.tsx` (modify) — add order logging UI after successful redemption
- `apps/web/V0-ui/lib/api.ts` or equivalent (modify) — update redeem API call to include order data

**Steps:**
1. After successful redemption confirmation, show collapsible "📝 Log Order (optional)" section
2. Order total: single number input with $ prefix
3. "Add Items" toggle: when expanded, show item entry rows (name + price + quantity)
4. "Add Item" button to add rows, X to remove
5. Auto-sum items to validate against order_total (warning if mismatch, not blocking)
6. "Save Order" button calls redeem endpoint with order_total and items
7. "Skip" dismisses the section
8. Show success toast: "Order logged — $XX.XX with N items"

**Depends on:** Bead 3

**Acceptance Criteria:**
- [ ] Order logging section appears after successful redemption
- [ ] Section is collapsed by default (non-intrusive)
- [ ] Order total field accepts decimal numbers
- [ ] Item entry is optional and addable/removable
- [ ] API call includes order_total and items when provided
- [ ] Skip button works without logging any order data
- [ ] Works on mobile (staff use phones to redeem)

---

### Bead 8: Enhanced CRM Frontend (Spend Columns)

**Type:** code
**Description:** Update the merchant customer list page to show spend analytics columns. Add spend data to customer detail page. Replace mock LTV with real data.

**Files to touch:**
- `apps/web/V0-ui/app/biz/customers/page.tsx` (modify) — add spend columns to table
- `apps/web/V0-ui/app/biz/customers/[id]/page.tsx` (modify) — add spend profile section to detail view

**Steps:**
1. Customer list table: add columns for "Avg Spend" and "Total Spend"
   - Show "$—" when `has_spend_data` is false
   - Show actual values when available
   - Make columns sortable
2. Update LTV column to show real LTV when spend data exists
3. Customer detail page:
   - Add "Spend Profile" card showing avg_spend, max_spend, median_spend, order_count
   - Add "Top Items" section showing ranked list with counts
   - Show "No order data yet — log orders during redemption to see spend analytics" when no data
4. Add visual indicator for data confidence: "Based on N orders"

**Depends on:** Bead 4, Bead 7

**Acceptance Criteria:**
- [ ] Customer table shows spend columns with proper formatting ($XX.XX)
- [ ] Columns are sortable by avg_spend and total_spend
- [ ] Graceful "—" display when no spend data
- [ ] Customer detail shows spend profile card with all metrics
- [ ] Top items displayed as ranked list with order counts
- [ ] Data confidence indicator shows order count
- [ ] Mobile-responsive layout

---

### Bead 9: Campaign Creation Frontend

**Type:** code
**Description:** Build the campaign creation UI: audience selector (segment/individual/spend/item filters), offer configuration (existing or custom), preview matched count, and send button.

**Files to touch:**
- `apps/web/V0-ui/app/biz/campaigns/new/page.tsx` (new) — campaign creation wizard
- `apps/web/V0-ui/app/biz/campaigns/page.tsx` (new) — campaign list page

**Steps:**
1. Campaign list page (`/biz/campaigns`):
   - Table of campaigns with name, status, targeted count, redeemed count, revenue
   - "New Campaign" button
   - Status badge (draft/sent/completed)
2. Campaign creation page (`/biz/campaigns/new`):
   - Step 1: Audience selection
     - Radio: Segment / Individual / Item Affinity / Spend Range
     - Segment: multi-select chips for VIP, at-risk, returning, new, lost
     - Individual: searchable customer list with checkboxes (de-identified names)
     - Item Affinity: text input for item names (autocomplete from spend_profiles in future)
     - Spend Range: min/max slider or inputs
     - Live "X customers matched" preview (calls POST campaigns with dry-run)
   - Step 2: Offer configuration
     - Toggle: Use existing offer / Create custom
     - Existing: dropdown of active offers
     - Custom: name, discount_text, terms fields
   - Step 3: Review & Send
     - Summary: audience description, offer, preview count
     - "Save as Draft" and "Send Now" buttons
3. Add navigation link from dashboard sidebar to Campaigns
4. Add "Target" action button on customer detail page (pre-fills individual targeting)

**Depends on:** Bead 5, Bead 8

**Acceptance Criteria:**
- [ ] Campaign list shows all campaigns with stats
- [ ] Audience selector supports all 4 targeting modes
- [ ] Live preview count updates as filters change
- [ ] Both existing offer and custom deal creation work
- [ ] "Save as Draft" creates campaign without sending
- [ ] "Send Now" creates and immediately sends campaign
- [ ] Navigation from dashboard and customer detail page works
- [ ] Empty audience shows warning, prevents sending

---

### Bead 10: Campaign Performance Dashboard

**Type:** code
**Description:** Add campaign performance section to the merchant dashboard. Show campaign stats, redemption rates, and revenue attribution.

**Files to touch:**
- `apps/web/V0-ui/app/biz/campaigns/[id]/page.tsx` (new) — campaign detail page
- `apps/web/V0-ui/app/dashboard/page.tsx` (modify) — add campaigns summary card

**Steps:**
1. Campaign detail page:
   - Campaign name, status, audience description
   - Stats cards: Targeted / Delivered / Seen / Redeemed
   - Conversion funnel visualization (targeted → seen → redeemed)
   - Revenue attributed (sum of order_totals from campaign redemptions)
   - List of targeted consumers (de-identified) with delivery status
2. Dashboard summary card:
   - "Recent Campaigns" card showing last 3 campaigns with quick stats
   - Link to full campaigns list
3. Quick stat in dashboard header: "X active campaigns"

**Depends on:** Bead 9

**Acceptance Criteria:**
- [ ] Campaign detail shows full stats with conversion funnel
- [ ] Revenue attribution calculated from linked redemptions
- [ ] Consumer list in campaign detail is de-identified
- [ ] Dashboard shows recent campaigns card
- [ ] All stats update correctly after redemptions

---

### Bead 11: Tests

**Type:** test
**Description:** Comprehensive test suite for orders, spend profiles, campaigns, and audience resolution.

**Files to touch:**
- `apps/api/tests/test_orders.py` (new) — order creation and spend profile tests
- `apps/api/tests/test_campaigns.py` (new) — campaign CRUD and audience resolution tests

**Steps:**
1. `test_orders.py`:
   - Test order creation with total only
   - Test order creation with items
   - Test spend profile computation (1 order, multiple orders, median calc)
   - Test spend profile incremental update
   - Test all_order_totals cap at 1000
   - Test top_items ranking after multiple orders
   - Test auth: staff_or_above required
   - Test invalid consumer_id returns 404
2. `test_campaigns.py`:
   - Test audience resolution by segment
   - Test audience resolution by spend range
   - Test audience resolution by item affinity
   - Test audience resolution by individual consumer_ids
   - Test combined filters (AND logic)
   - Test empty audience returns error
   - Test campaign create → draft status
   - Test campaign send → delivery records created
   - Test campaign stats update after redemption
   - Test auth: merchant_admin required for create/send

**Depends on:** Bead 5, Bead 6 (needs all backend code to test)

**Acceptance Criteria:**
- [ ] All tests pass
- [ ] Coverage for spend profile edge cases (1 order, 1000 orders, 0 items)
- [ ] Coverage for audience resolution with each filter type
- [ ] Coverage for campaign lifecycle (draft → sent → redeemed)
- [ ] Auth tests verify permission requirements

---

## 7. Dependency Graph

```
Bead 1 (Data Models)
  └── Bead 2 (Orders API + Spend Engine)
        ├── Bead 3 (Wire into Redemption)
        │     └── Bead 7 (Redemption Frontend)
        │           └── Bead 8 (CRM Frontend)
        └── Bead 4 (Enhanced CRM Backend)
              └── Bead 5 (Campaign Engine)
                    ├── Bead 6 (Wallet Delivery)
                    └── Bead 9 (Campaign Frontend)
                          └── Bead 10 (Campaign Dashboard)

Bead 11 (Tests) depends on Beads 5 + 6 (can run parallel with frontend beads)
```

**Critical path:** 1 → 2 → 3 → 4 → 5 → 6 (backend complete)
**Frontend path:** 7 → 8 → 9 → 10 (can start after respective backend beads)

---

## 8. Estimated Effort

| Bead | Complexity | Estimate |
|---|---|---|
| 1. Data Models | Low | 1-2 hours |
| 2. Orders API + Spend Engine | Medium | 4-6 hours |
| 3. Wire into Redemption | Low-Medium | 2-3 hours |
| 4. Enhanced CRM Backend | Medium | 3-4 hours |
| 5. Campaign Engine | High | 6-8 hours |
| 6. Wallet Delivery | Medium | 3-4 hours |
| 7. Redemption Frontend | Medium | 3-4 hours |
| 8. CRM Frontend | Medium | 4-5 hours |
| 9. Campaign Frontend | High | 6-8 hours |
| 10. Campaign Dashboard | Medium | 4-5 hours |
| 11. Tests | Medium | 4-6 hours |
| **Total** | | **~40-55 hours** |

**MVP (Beads 1-4 + 7-8):** ~17-24 hours — gets spend data flowing and visible in CRM.
**Full feature (all beads):** ~40-55 hours — complete targeting and campaigns.

---

## 9. Open Questions for Jilani

1. **Campaign expiry:** Should targeted offers expire after N days? (Suggested: 7 days default, configurable)

2. **Campaign frequency cap:** Can a merchant target the same consumer multiple times per week? (Suggested: max 1 campaign per consumer per merchant per 7 days)

3. **Custom offers vs. existing offers:** Should targeted campaigns always link to an existing Offer (which has daily caps, ledger entries), or can merchants create "virtual" deals that bypass the offer system? The latter is simpler but doesn't track in the ledger.

4. **Item categories:** Should we define a fixed set of categories (coffee, food, drinks, retail, services) or let merchants create custom categories? (Suggested: merchant-defined, with popular defaults pre-filled)

5. **Spend data visibility for consumers:** Should consumers see their own spend profile? (e.g., "You've spent $340 at Café Luna this year") — could increase engagement but might feel surveillance-y.

6. **Minimum data threshold:** Should we hide spend analytics until a consumer has N orders? (Suggested: show after 1 order, but display "Based on N orders" confidence indicator)
