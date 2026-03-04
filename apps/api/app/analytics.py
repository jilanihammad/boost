"""Analytics endpoints: retention cohorts, deal performance, LTV distribution, insights."""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import require_staff_or_above
from .db import get_db, CONSUMER_VISITS, OFFERS, REDEMPTIONS, INSIGHT_CACHE
from .deps import get_current_user
from .models import (
    DealPerformance,
    InsightResponse,
    LtvBucket,
    RetentionCohort,
    RetentionResponse,
    DealPerformanceResponse,
    LtvResponse,
)

logger = logging.getLogger("boost")

router = APIRouter(tags=["analytics"])

DEFAULT_AVG_TICKET = 12.0


def _week_start(dt: datetime) -> datetime:
    """Return the Monday 00:00 UTC of the week containing *dt*."""
    d = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    d -= timedelta(days=d.weekday())  # back to Monday
    return d


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/analytics/retention
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/analytics/retention",
    response_model=RetentionResponse,
)
async def get_retention_cohorts(
    merchant_id: str,
    weeks: int = Query(6, ge=1, le=52, description="Number of cohort weeks"),
    user=Depends(get_current_user),
):
    """Cohort retention heatmap data.

    Groups first-visit customers by week, computes return rates at week 1-5.
    Auth: staff_or_above.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()

    # Fetch all visits for this merchant
    visits_query = db.collection(CONSUMER_VISITS).where(
        "merchant_id", "==", merchant_id
    )
    visits = list(visits_query.stream())

    # Group visits by consumer_id
    consumer_visits: dict[str, list[datetime]] = {}
    for v in visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if cid and ts:
            consumer_visits.setdefault(cid, []).append(ts)

    # Determine first visit per consumer and cohort week
    now = datetime.now(timezone.utc)
    cohort_consumers: dict[datetime, dict[str, list[datetime]]] = {}

    for cid, timestamps in consumer_visits.items():
        timestamps.sort()
        first = timestamps[0]
        ws = _week_start(first)
        cohort_consumers.setdefault(ws, {})[cid] = timestamps

    # Build cohorts for the last N weeks
    current_week_start = _week_start(now)
    cohort_weeks = sorted(cohort_consumers.keys())

    # Only keep the requested number of most recent cohort weeks
    if len(cohort_weeks) > weeks:
        cohort_weeks = cohort_weeks[-weeks:]

    cohorts: list[RetentionCohort] = []

    for ws in cohort_weeks:
        consumers = cohort_consumers.get(ws, {})
        new_customers = len(consumers)
        if new_customers == 0:
            continue

        # Compute retention for weeks 1-5 after cohort week
        retention_rates: list[float] = []
        for week_offset in range(1, 6):
            target_week_start = ws + timedelta(weeks=week_offset)
            target_week_end = target_week_start + timedelta(weeks=1)

            # Don't compute future weeks
            if target_week_start > now:
                break

            # Count consumers who had a visit in the target week
            retained = 0
            for cid, timestamps in consumers.items():
                for ts in timestamps:
                    if target_week_start <= ts < target_week_end:
                        retained += 1
                        break

            rate = round(retained / new_customers, 3) if new_customers > 0 else 0.0
            retention_rates.append(rate)

        cohorts.append(
            RetentionCohort(
                week_start=ws.strftime("%Y-%m-%d"),
                new_customers=new_customers,
                retention_rates=retention_rates,
            )
        )

    return RetentionResponse(cohorts=cohorts)


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/analytics/deals
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/analytics/deals",
    response_model=DealPerformanceResponse,
)
async def get_deal_performance(
    merchant_id: str,
    user=Depends(get_current_user),
):
    """Per-deal comparison: redemption count, 14d/30d return rates, estimated ROI.

    Auth: staff_or_above.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()

    # Fetch active offers for this merchant
    offers_query = db.collection(OFFERS).where("merchant_id", "==", merchant_id)
    offer_docs = list(offers_query.stream())

    # Fetch all visits for this merchant (for return rate computation)
    visits_query = db.collection(CONSUMER_VISITS).where(
        "merchant_id", "==", merchant_id
    )
    all_visits = list(visits_query.stream())

    # Build lookup: consumer_id -> sorted list of visit timestamps
    consumer_all_visits: dict[str, list[datetime]] = {}
    for v in all_visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if cid and ts:
            consumer_all_visits.setdefault(cid, []).append(ts)

    for cid in consumer_all_visits:
        consumer_all_visits[cid].sort()

    # Also group visits by offer_id -> list of (consumer_id, timestamp)
    offer_visits: dict[str, list[tuple[str, datetime]]] = {}
    for v in all_visits:
        vdata = v.to_dict()
        oid = vdata.get("offer_id")
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if oid and cid and ts:
            offer_visits.setdefault(oid, []).append((cid, ts))

    deals: list[DealPerformance] = []

    for odoc in offer_docs:
        odata = odoc.to_dict()
        offer_id = odoc.id
        offer_name = odata.get("name", "Unknown")
        value_per = odata.get("value_per_redemption", 2.0)

        visits_for_offer = offer_visits.get(offer_id, [])
        redemption_count = len(visits_for_offer)

        # Compute return rates: for each consumer who used this offer,
        # did they come back to the merchant within 14d / 30d?
        returned_14d = 0
        returned_30d = 0
        unique_consumers = set()

        for cid, visit_ts in visits_for_offer:
            if cid in unique_consumers:
                continue
            unique_consumers.add(cid)

            # Check if they had a subsequent visit (any offer) within 14d/30d
            all_ts = consumer_all_visits.get(cid, [])
            for later_ts in all_ts:
                if later_ts <= visit_ts:
                    continue
                delta_days = (later_ts - visit_ts).days
                if delta_days <= 14:
                    returned_14d += 1
                    returned_30d += 1
                    break
                elif delta_days <= 30:
                    returned_30d += 1
                    break

        total_unique = len(unique_consumers) or 1
        return_rate_14d = round(returned_14d / total_unique, 3)
        return_rate_30d = round(returned_30d / total_unique, 3)

        # Estimated ROI: (return visits revenue - cost) / cost
        cost = redemption_count * value_per
        return_revenue = (returned_30d * DEFAULT_AVG_TICKET)
        estimated_roi = round((return_revenue - cost) / cost, 2) if cost > 0 else 0.0

        deals.append(
            DealPerformance(
                offer_id=offer_id,
                offer_name=offer_name,
                redemption_count=redemption_count,
                return_rate_14d=return_rate_14d,
                return_rate_30d=return_rate_30d,
                estimated_roi=estimated_roi,
            )
        )

    return DealPerformanceResponse(deals=deals)


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/analytics/ltv
# ---------------------------------------------------------------------------

LTV_BUCKETS = [
    ("$0–10", 0, 10),
    ("$10–30", 10, 30),
    ("$30–60", 30, 60),
    ("$60–100", 60, 100),
    ("$100+", 100, float("inf")),
]


@router.get(
    "/merchants/{merchant_id}/analytics/ltv",
    response_model=LtvResponse,
)
async def get_ltv_distribution(
    merchant_id: str,
    user=Depends(get_current_user),
):
    """LTV distribution histogram.

    Auth: staff_or_above.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()

    # Fetch all visits for this merchant
    visits_query = db.collection(CONSUMER_VISITS).where(
        "merchant_id", "==", merchant_id
    )
    visits = list(visits_query.stream())

    # Count visits per consumer
    consumer_visit_counts: dict[str, int] = {}
    for v in visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        if cid:
            consumer_visit_counts[cid] = consumer_visit_counts.get(cid, 0) + 1

    # Compute LTV per consumer and bucket
    bucket_counts = {label: 0 for label, _, _ in LTV_BUCKETS}

    for cid, count in consumer_visit_counts.items():
        ltv = count * DEFAULT_AVG_TICKET
        for label, low, high in LTV_BUCKETS:
            if low <= ltv < high:
                bucket_counts[label] += 1
                break

    buckets = [
        LtvBucket(bucket_label=label, count=bucket_counts[label])
        for label, _, _ in LTV_BUCKETS
    ]

    return LtvResponse(buckets=buckets)


# ---------------------------------------------------------------------------
# Insights helpers
# ---------------------------------------------------------------------------


def _build_deal_summary(db, merchant_id: str) -> list[dict]:
    """Fetch deal performance data for insight generation."""
    offers_query = db.collection(OFFERS).where("merchant_id", "==", merchant_id)
    offer_docs = list(offers_query.stream())

    visits_query = db.collection(CONSUMER_VISITS).where("merchant_id", "==", merchant_id)
    all_visits = list(visits_query.stream())

    # Build consumer visit lookup
    consumer_all_visits: dict[str, list[datetime]] = {}
    for v in all_visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if cid and ts:
            consumer_all_visits.setdefault(cid, []).append(ts)
    for cid in consumer_all_visits:
        consumer_all_visits[cid].sort()

    # Group visits by offer
    offer_visits: dict[str, list[tuple[str, datetime]]] = {}
    for v in all_visits:
        vdata = v.to_dict()
        oid = vdata.get("offer_id")
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if oid and cid and ts:
            offer_visits.setdefault(oid, []).append((cid, ts))

    deals = []
    for odoc in offer_docs:
        odata = odoc.to_dict()
        offer_id = odoc.id
        visits_for_offer = offer_visits.get(offer_id, [])
        redemption_count = len(visits_for_offer)

        returned_14d = 0
        unique_consumers = set()
        for cid, visit_ts in visits_for_offer:
            if cid in unique_consumers:
                continue
            unique_consumers.add(cid)
            all_ts = consumer_all_visits.get(cid, [])
            for later_ts in all_ts:
                if later_ts <= visit_ts:
                    continue
                if (later_ts - visit_ts).days <= 14:
                    returned_14d += 1
                    break

        total_unique = len(unique_consumers) or 1
        return_rate = round(returned_14d / total_unique, 3)

        deals.append({
            "offer_name": odata.get("name", "Unknown"),
            "redemption_count": redemption_count,
            "return_rate_14d": return_rate,
            "unique_customers": len(unique_consumers),
        })

    return deals


def _build_segment_summary(db, merchant_id: str) -> dict[str, int]:
    """Count customers by visit recency segment."""
    visits_query = db.collection(CONSUMER_VISITS).where("merchant_id", "==", merchant_id)
    all_visits = list(visits_query.stream())

    now = datetime.now(timezone.utc)
    consumer_last_visit: dict[str, datetime] = {}
    consumer_visit_count: dict[str, int] = {}

    for v in all_visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        ts = vdata.get("timestamp")
        if cid and ts:
            consumer_visit_count[cid] = consumer_visit_count.get(cid, 0) + 1
            if cid not in consumer_last_visit or ts > consumer_last_visit[cid]:
                consumer_last_visit[cid] = ts

    segments: dict[str, int] = {"new": 0, "returning": 0, "vip": 0, "at_risk": 0, "lost": 0}
    for cid, last in consumer_last_visit.items():
        days_since = (now - last).days
        count = consumer_visit_count.get(cid, 1)

        if count == 1 and days_since <= 14:
            segments["new"] += 1
        elif days_since > 30:
            segments["lost"] += 1
        elif days_since > 14:
            segments["at_risk"] += 1
        elif count >= 5:
            segments["vip"] += 1
        else:
            segments["returning"] += 1

    return segments


def _generate_rule_based_insights(deals: list[dict], segments: dict[str, int]) -> list[str]:
    """Generate 1-2 plain-language insights using simple rules (no AI)."""
    insights: list[str] = []

    # Insight 1: Best vs worst deal by return rate
    if len(deals) >= 2:
        sorted_deals = sorted(deals, key=lambda d: d["return_rate_14d"], reverse=True)
        best = sorted_deals[0]
        worst = sorted_deals[-1]

        if best["return_rate_14d"] > worst["return_rate_14d"]:
            diff_pct = round((best["return_rate_14d"] - worst["return_rate_14d"]) * 100)
            insights.append(
                f'"{best["offer_name"]}" has a {round(best["return_rate_14d"] * 100)}% '
                f"14-day return rate — {diff_pct}pp higher than "
                f'"{worst["offer_name"]}" ({round(worst["return_rate_14d"] * 100)}%). '
                f"Consider increasing the daily cap on your top performer."
            )
    elif len(deals) == 1:
        d = deals[0]
        rate = round(d["return_rate_14d"] * 100)
        insights.append(
            f'"{d["offer_name"]}" is bringing back {rate}% of customers within 14 days. '
            f"Try adding a second deal to compare performance."
        )

    # Insight 2: Segment trend (at-risk / lost flag)
    total_customers = sum(segments.values())
    if total_customers > 0:
        at_risk = segments.get("at_risk", 0)
        lost = segments.get("lost", 0)
        at_risk_pct = round((at_risk + lost) / total_customers * 100)
        if at_risk_pct >= 30:
            insights.append(
                f"{at_risk + lost} customers ({at_risk_pct}% of your base) are at-risk or lost. "
                f"Consider sending a re-engagement offer to win them back."
            )
        elif segments.get("vip", 0) > 0:
            vip_count = segments["vip"]
            insights.append(
                f"You have {vip_count} VIP customer{'s' if vip_count != 1 else ''} "
                f"(5+ visits). Reward them with an exclusive deal to keep them coming back."
            )

    return insights[:2]


async def _generate_ai_insights(deals: list[dict], segments: dict[str, int]) -> list[str]:
    """Generate insights via OpenAI (if key is available)."""
    try:
        import openai

        client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        data_summary = (
            f"Deal performance: {deals}\n"
            f"Customer segments: {segments}"
        )

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Generate 1-2 plain-language insights for a local business owner. "
                        "Be specific with numbers. Suggest an action."
                    ),
                },
                {"role": "user", "content": data_summary},
            ],
            max_tokens=300,
            temperature=0.7,
        )

        text = response.choices[0].message.content or ""
        # Split into individual insights (by newline or numbered list)
        lines = [l.strip().lstrip("0123456789.-) ") for l in text.strip().split("\n") if l.strip()]
        return [l for l in lines if len(l) > 10][:2]

    except Exception as e:
        logger.warning("OpenAI insight generation failed, using fallback: %s", e)
        return _generate_rule_based_insights(deals, segments)


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/insights
# ---------------------------------------------------------------------------


INSIGHT_CACHE_TTL = timedelta(hours=24)


@router.get(
    "/merchants/{merchant_id}/insights",
    response_model=InsightResponse,
)
async def get_merchant_insights(
    merchant_id: str,
    user=Depends(get_current_user),
):
    """AI-generated or rule-based insights for a merchant.

    Caches results in Firestore for 24h.
    Auth: staff_or_above.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()
    now = datetime.now(timezone.utc)

    # Check cache
    cache_ref = db.collection(INSIGHT_CACHE).document(merchant_id)
    cache_doc = cache_ref.get()

    if cache_doc.exists:
        cached = cache_doc.to_dict()
        generated_at = cached.get("generated_at")
        if generated_at and (now - generated_at) < INSIGHT_CACHE_TTL:
            return InsightResponse(
                insights=cached.get("insights", []),
                generated_at=generated_at,
                cached=True,
            )

    # Generate fresh insights
    deals = _build_deal_summary(db, merchant_id)
    segments = _build_segment_summary(db, merchant_id)

    if os.getenv("OPENAI_API_KEY"):
        insights = await _generate_ai_insights(deals, segments)
    else:
        insights = _generate_rule_based_insights(deals, segments)

    # Fallback if no insights generated
    if not insights:
        insights = ["Add more deals and track redemptions to unlock personalized insights."]

    # Cache in Firestore
    cache_data = {
        "insights": insights,
        "generated_at": now,
    }
    cache_ref.set(cache_data)

    return InsightResponse(
        insights=insights,
        generated_at=now,
        cached=False,
    )
