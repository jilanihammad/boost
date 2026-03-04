"""Customer list & segmentation endpoints (merchant-facing CRM)."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import require_staff_or_above
from .db import (
    get_db,
    CONSUMER_VISITS,
    CONSUMERS,
    LOYALTY_CONFIGS,
    LOYALTY_PROGRESS,
    OFFERS,
)
from .deps import get_current_user
from .models import (
    CustomerDetail,
    CustomerListResponse,
    CustomerSegment,
    CustomerSummary,
    LoyaltyStamps,
    VisitTimelineItem,
)

router = APIRouter(tags=["customers"])

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

DEFAULT_AVG_TICKET = 12.0


def _mask_name(display_name: str | None) -> str:
    """Mask a display name as 'First L.' for privacy."""
    if not display_name:
        return "Unknown"
    parts = display_name.strip().split()
    if len(parts) == 0:
        return "Unknown"
    first = parts[0]
    if len(parts) >= 2:
        return f"{first} {parts[-1][0].upper()}."
    return first


def _compute_segment(
    visit_count: int,
    last_visit: datetime | None,
    is_top_10_ltv: bool = False,
) -> CustomerSegment:
    """Compute customer segment from visit count and recency."""
    now = datetime.now(timezone.utc)

    if last_visit is None:
        return CustomerSegment.lost

    days_since = (now - last_visit).days

    # Lost: no visit in 30+ days
    if days_since >= 30:
        return CustomerSegment.lost

    # At-risk: was returning/VIP (2+ visits) but no visit in 14+ days
    if visit_count >= 2 and days_since >= 14:
        return CustomerSegment.at_risk

    # VIP: 5+ visits OR top 10% LTV
    if visit_count >= 5 or is_top_10_ltv:
        return CustomerSegment.vip

    # Returning: 2-4 visits
    if 2 <= visit_count <= 4:
        return CustomerSegment.returning

    # New: 1 visit AND within 14 days
    if visit_count == 1 and days_since < 14:
        return CustomerSegment.new

    # Fallback (shouldn't happen, but safe)
    return CustomerSegment.new


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/customers
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/customers",
    response_model=CustomerListResponse,
)
async def list_customers(
    merchant_id: str,
    segment: Optional[str] = Query(None, description="Filter by segment"),
    search: Optional[str] = Query(None, description="Search by name substring"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List customers for a merchant with segmentation.

    Auth: staff_or_above for the merchant.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()

    # 1. Fetch all visits for this merchant
    visits_query = db.collection(CONSUMER_VISITS).where(
        "merchant_id", "==", merchant_id
    )
    visits = list(visits_query.stream())

    # 2. Group by consumer_id
    consumer_visits: dict[str, list[dict]] = {}
    for v in visits:
        vdata = v.to_dict()
        cid = vdata.get("consumer_id")
        if cid:
            consumer_visits.setdefault(cid, []).append(vdata)

    # 3. For each consumer, compute metrics
    summaries: list[dict] = []
    ltvs: list[float] = []

    for cid, vlist in consumer_visits.items():
        visit_count = len(vlist)
        timestamps = [
            v["timestamp"]
            for v in vlist
            if v.get("timestamp") is not None
        ]
        last_visit = max(timestamps) if timestamps else None
        estimated_ltv = visit_count * DEFAULT_AVG_TICKET
        ltvs.append(estimated_ltv)

        summaries.append({
            "consumer_id": cid,
            "visit_count": visit_count,
            "last_visit": last_visit,
            "estimated_ltv": estimated_ltv,
        })

    # 4. Determine top-10% LTV threshold for VIP
    if ltvs:
        sorted_ltvs = sorted(ltvs, reverse=True)
        top10_index = max(0, len(sorted_ltvs) // 10 - 1)
        top10_threshold = sorted_ltvs[top10_index]
    else:
        top10_threshold = float("inf")

    # 5. Compute segments & lookup consumer names
    consumer_ids = [s["consumer_id"] for s in summaries]

    # Batch lookup consumer display names
    name_map: dict[str, str] = {}
    for cid in consumer_ids:
        cdoc = db.collection(CONSUMERS).document(cid).get()
        if cdoc.exists:
            name_map[cid] = cdoc.to_dict().get("display_name", "")

    # Lookup loyalty progress
    loyalty_map: dict[str, LoyaltyStamps] = {}
    loyalty_config_doc = db.collection(LOYALTY_CONFIGS).document(merchant_id).get()
    stamps_required = 0
    if loyalty_config_doc.exists:
        stamps_required = loyalty_config_doc.to_dict().get("stamps_required", 10)
        for cid in consumer_ids:
            progress_id = f"{cid}_{merchant_id}"
            pdoc = db.collection(LOYALTY_PROGRESS).document(progress_id).get()
            if pdoc.exists:
                pdata = pdoc.to_dict()
                loyalty_map[cid] = LoyaltyStamps(
                    current=pdata.get("current_stamps", 0),
                    required=stamps_required,
                )

    # Build CustomerSummary list with segments
    results: list[CustomerSummary] = []
    segment_counts: dict[str, int] = {seg.value: 0 for seg in CustomerSegment}

    for s in summaries:
        cid = s["consumer_id"]
        is_top10 = s["estimated_ltv"] >= top10_threshold
        seg = _compute_segment(s["visit_count"], s["last_visit"], is_top10)
        segment_counts[seg.value] += 1

        masked = _mask_name(name_map.get(cid))

        # Apply filters
        if segment and seg.value != segment:
            continue
        if search and search.lower() not in masked.lower():
            continue

        results.append(
            CustomerSummary(
                consumer_id=cid,
                display_name=masked,
                visit_count=s["visit_count"],
                last_visit=s["last_visit"],
                segment=seg,
                estimated_ltv=s["estimated_ltv"],
                loyalty_stamps=loyalty_map.get(cid),
            )
        )

    # Sort by last_visit desc (most recent first)
    results.sort(key=lambda c: c.last_visit or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

    total = len(results)
    paged = results[offset : offset + limit]

    return CustomerListResponse(
        customers=paged,
        total=total,
        segment_counts=segment_counts,
    )


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/customers/{consumer_id}
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/customers/{consumer_id}",
    response_model=CustomerDetail,
)
async def get_customer_detail(
    merchant_id: str,
    consumer_id: str,
    user=Depends(get_current_user),
):
    """Get full customer profile for a specific consumer at this merchant.

    Auth: staff_or_above for the merchant.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()

    # Fetch visits for this consumer at this merchant
    visits_query = (
        db.collection(CONSUMER_VISITS)
        .where("merchant_id", "==", merchant_id)
        .where("consumer_id", "==", consumer_id)
    )
    visits = list(visits_query.stream())

    if not visits:
        raise HTTPException(status_code=404, detail="Customer not found for this merchant")

    # Build timeline & compute metrics
    visit_count = len(visits)
    timestamps = []
    timeline: list[VisitTimelineItem] = []

    # Fetch offer names for timeline
    offer_cache: dict[str, str] = {}

    for v in visits:
        vdata = v.to_dict()
        ts = vdata.get("timestamp")
        if ts:
            timestamps.append(ts)

        offer_id = vdata.get("offer_id", "")
        if offer_id and offer_id not in offer_cache:
            odoc = db.collection(OFFERS).document(offer_id).get()
            if odoc.exists:
                offer_cache[offer_id] = odoc.to_dict().get("name", "Unknown Offer")
            else:
                offer_cache[offer_id] = "Unknown Offer"

        timeline.append(
            VisitTimelineItem(
                timestamp=ts or datetime.now(timezone.utc),
                offer_name=offer_cache.get(offer_id, "Unknown Offer"),
                points_earned=vdata.get("points_earned", 0),
                stamp_earned=vdata.get("stamp_earned", False),
            )
        )

    # Sort timeline by timestamp descending
    timeline.sort(key=lambda t: t.timestamp, reverse=True)

    last_visit = max(timestamps) if timestamps else None
    first_visit = min(timestamps) if timestamps else None
    estimated_ltv = visit_count * DEFAULT_AVG_TICKET

    # Consumer display name
    consumer_doc = db.collection(CONSUMERS).document(consumer_id).get()
    raw_name = ""
    if consumer_doc.exists:
        raw_name = consumer_doc.to_dict().get("display_name", "")
    masked = _mask_name(raw_name)

    # Segment (simplified — not computing top 10% for single customer)
    seg = _compute_segment(visit_count, last_visit, visit_count >= 5)

    # Loyalty progress
    loyalty_stamps = None
    loyalty_config_doc = db.collection(LOYALTY_CONFIGS).document(merchant_id).get()
    if loyalty_config_doc.exists:
        stamps_required = loyalty_config_doc.to_dict().get("stamps_required", 10)
        progress_id = f"{consumer_id}_{merchant_id}"
        pdoc = db.collection(LOYALTY_PROGRESS).document(progress_id).get()
        if pdoc.exists:
            pdata = pdoc.to_dict()
            loyalty_stamps = LoyaltyStamps(
                current=pdata.get("current_stamps", 0),
                required=stamps_required,
            )

    return CustomerDetail(
        consumer_id=consumer_id,
        display_name=masked,
        visit_count=visit_count,
        last_visit=last_visit,
        first_visit=first_visit,
        segment=seg,
        estimated_ltv=estimated_ltv,
        loyalty_stamps=loyalty_stamps,
        visit_timeline=timeline,
    )
