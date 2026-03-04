"""Analytics endpoints: retention cohorts, deal performance, LTV distribution."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import require_staff_or_above
from .db import get_db, CONSUMER_VISITS, OFFERS, REDEMPTIONS
from .deps import get_current_user
from .models import (
    DealPerformance,
    LtvBucket,
    RetentionCohort,
    RetentionResponse,
    DealPerformanceResponse,
    LtvResponse,
)

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
