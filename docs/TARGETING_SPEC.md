# De-Identified Customer Targeting with Spend Analytics

## Goals
Enable merchants to target individual customers or micro-segments using spend behavior (avg/median ticket, biggest order, favored items) without revealing PII (names/phones). Deliver insights and coupon targeting inside the merchant dashboard.

---

## 1) Data Model Gaps

We currently track visits but NOT orders or spend. Minimum new data needed:

**Order event**: order_id, merchant_id, consumer_id (optional), visit_id (optional link to existing visit), order_total, sub_total, tax, tip, discount_total, currency, channel (pos/web/app), timestamp

**Line items**: order_id, name_raw, normalized_name, category, qty, unit_price, modifiers (free-form), offer_id_applied (optional)

**Customer spend profile** (per merchant × consumer): avg_ticket, median_ticket, max_ticket, orders_count, last_order_at, top_items [{item, count, last_seen_price}], fav_categories, lifetime_spend, coupon_response_history (offer_ids redeemed)

**Targeting artifact**: TargetAudienceRule (filter expression on spend stats + segments) + optional explicit consumer_ids; links to offer_id or targeted_coupon template

**Privacy fields**: hashed contact keys (phone_sha256, email_sha256) for matching only; never displayed

---

## 2) Architecture (End-to-End)

### Ingestion
- Merchants upload orders via CSV or manual single-order form
- POST /merchants/{id}/orders with order + items payload
- Optional consumer_id or hashed phone/email for matching; unmatched records held for reconciliation
- Validate via Pydantic; store raw in Firestore CONSUMER_ORDERS and ORDER_ITEMS

### Normalization & Matching
- Normalize item names (lowercase, trim, strip emojis)
- Bucket into categories via rule table ITEM_NORMALIZATION
- Match to consumer by consumer_id or hashed phone/email lookup
- Backfill to historical visits on match

### Spend Profile Computation
- Nightly batch job: reads new orders, computes per (merchant, consumer) aggregates
- avg/median/max ticket, last order, lifetime spend, top 5 items/categories
- Store in CUSTOMER_SPEND_PROFILES
- Also compute merchant-level "popular items" for targeting UI defaults

### Targeting Workflow
- Dashboard: de-identified customer list with spend stats and top items
- Filters: segment (existing), avg ticket range, top item contains, last order window
- Select one customer or filtered set → choose offer or create product-specific coupon
- Write TARGETING_JOBS: merchant_id, audience, offer/coupon, created_by, created_at
- Feeds into existing automation/message pipeline for delivery

### Privacy Model
- UI shows only masked display names ("First L.") + spend stats; never raw phone/email
- Hashed contact stored solely for matching; access controlled (staff_or_above)
- Audit log for each targeting job (who, when, audience size, template)
- Data retention: orders stored; delete cascade on consumer deletion

---

## 3) Pragmatic MVP

- **Ingestion**: CSV upload + single-order form only. No POS integration. Required: order_total + timestamp. Items optional (free-text accepted).
- **Matching**: consumer_id if provided; manual mapping page for unmatched. Skip hashed contact matching in v0.
- **Computation**: Simple batch job, nightly. Median via in-memory sort. No streaming.
- **Spend surface**: avg, median, max ticket, last order date, top 3 items in customer list/detail. No category hierarchy.
- **Targeting**: Select customer(s) or segment+spend filter → create targeted coupon → records "would send" row (like automations). No actual SMS yet.
- **Safety**: All displays masked. CSV upload warns to omit PII columns.

---

## 4) Beads

### dude-0f7.17 — Data Primitives
- **What**: Add Pydantic models for Order, LineItem, SpendProfile, TargetingJob. Register Firestore collection constants.
- **Files**: models.py, db.py
- **Acceptance**: Models validate sample payloads; collection constants available
- **Depends on**: none

### dude-0f7.18 — Order Ingestion API
- **What**: POST /merchants/{id}/orders — single/batch orders with line items. Auth: staff_or_above. Validation: reject missing order_total/timestamp.
- **Files**: new orders.py router, main.py, models.py
- **Acceptance**: Valid payload stores order + items; 400 on invalid; returns order_id(s)
- **Depends on**: .17

### dude-0f7.19 — Item Normalization + Consumer Matching
- **What**: Normalize item names, match orders to consumers by consumer_id. Mark unmatched orders. Stub hashed contact matching.
- **Files**: orders.py (helpers), db.py
- **Acceptance**: Orders saved with normalized_items + match_status; unmatched count in response
- **Depends on**: .18

### dude-0f7.20 — Spend Profile Batch Job
- **What**: Batch endpoint to aggregate orders per (merchant, consumer): avg/median/max ticket, orders_count, last_order_at, top 5 items. Write to CUSTOMER_SPEND_PROFILES. Idempotent.
- **Files**: analytics.py (new job endpoint), db.py
- **Acceptance**: Job produces profiles with all fields; idempotent reruns; works after seed data
- **Depends on**: .19

### dude-0f7.21 — Customer List/Detail with Spend Stats
- **What**: Extend customer list/detail endpoints to join spend profiles. Expose masked spend fields.
- **Files**: customers.py, models.py
- **Acceptance**: GET customers returns avg_ticket, median_ticket, max_ticket, top_items[3]; names masked
- **Depends on**: .20

### dude-0f7.22 — Targeting Job API
- **What**: POST /merchants/{id}/targeting-jobs — accepts audience (consumer_ids or filter snapshot) + offer_id/coupon_text. Stores job + audit trail.
- **Files**: new targeting.py router, models.py, main.py
- **Acceptance**: Creates job with size estimate; response hides PII; RBAC enforced
- **Depends on**: .21

### dude-0f7.23 — Dashboard UI: Spend + Targeting
- **What**: Add spend stats to customer table/detail. CSV upload modal. Targeting drawer to pick customers/segment and configure coupon.
- **Files**: V0-ui customer pages, new components
- **Acceptance**: UI shows masked customers with spend stats; CSV upload posts orders; targeting drawer submits job; no PII displayed
- **Depends on**: .21, .22

### dude-0f7.24 — QA + Guardrails
- **What**: Tests for aggregation, masking, privacy. Docs for CSV format. Privacy notes.
- **Files**: tests/, docs/
- **Acceptance**: Tests pass; CSV format documented; privacy expectations documented
- **Depends on**: .23

---

## 5) Privacy & Security Checklist
- Masking by default in all responses/UI; never return phone/email
- Hashed identifiers stored only for matching; not exposed via API
- RBAC: staff_or_above for ingestion, analytics, targeting
- Audit log on every targeting job with actor + timestamp
- Delete cascade: consumer deletion removes spend profile + order links

## 6) Open Questions
- POS integration priority? If yes, which vendor(s) first?
- Tax/fees breakdown for ROI, or total-only?
- Throttle targeting message volume per consumer per day?
