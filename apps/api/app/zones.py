"""Zone / Neighborhood endpoints — all public (no auth required)."""

import math
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from .db import get_db, ZONES, MERCHANTS, OFFERS, REDEMPTIONS
from .models import (
    Zone,
    ZoneCenter,
    ZoneDeal,
    ZoneDetail,
    ZoneMerchantSummary,
    OfferStatus,
)

router = APIRouter(prefix="/zones", tags=["zones"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Return distance in miles between two lat/lng points (Haversine formula)."""
    R = 3958.8  # Earth radius in miles
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_zone_for_location(lat: float, lng: float) -> str | None:
    """Return zone_id if (lat, lng) falls within any zone's radius, else None."""
    db = get_db()
    zones = db.collection(ZONES).where("status", "==", "active").stream()
    for doc in zones:
        data = doc.to_dict()
        center = data.get("center", {})
        radius = data.get("radius_miles", 2.0)
        c_lat = center.get("lat")
        c_lng = center.get("lng")
        if c_lat is None or c_lng is None:
            continue
        if _haversine_miles(lat, lng, c_lat, c_lng) <= radius:
            return doc.id
    return None


def _get_zone_merchants_and_deals(zone_id: str):
    """Fetch merchants in a zone and their active deals with redemption counts.

    Returns (merchants_list, total_merchant_count, total_deal_count).
    """
    db = get_db()

    # Find merchants assigned to this zone
    merchant_docs = list(
        db.collection(MERCHANTS)
        .where("zone_id", "==", zone_id)
        .where("status", "==", "active")
        .stream()
    )

    merchants: list[ZoneMerchantSummary] = []
    total_deals = 0

    for m_doc in merchant_docs:
        m_data = m_doc.to_dict()
        merchant_name = m_data.get("name", "Local Business")

        # Get active offers for this merchant
        offer_docs = list(
            db.collection(OFFERS)
            .where("merchant_id", "==", m_doc.id)
            .where("status", "==", OfferStatus.active.value)
            .stream()
        )

        deals: list[ZoneDeal] = []
        for o_doc in offer_docs:
            o_data = o_doc.to_dict()

            # Count total redemptions for this offer
            redemption_count = len(list(
                db.collection(REDEMPTIONS)
                .where("offer_id", "==", o_doc.id)
                .stream()
            ))

            deals.append(ZoneDeal(
                offer_id=o_doc.id,
                offer_name=o_data.get("name", ""),
                merchant_name=merchant_name,
                discount_text=o_data.get("discount_text", ""),
                redemption_count=redemption_count,
                terms=o_data.get("terms"),
            ))

        total_deals += len(deals)
        merchants.append(ZoneMerchantSummary(
            merchant_id=m_doc.id,
            merchant_name=merchant_name,
            active_deals=deals,
        ))

    return merchants, len(merchant_docs), total_deals


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", response_model=list[Zone])
async def list_zones():
    """List all active zones with merchant and deal counts. Public — no auth."""
    db = get_db()
    docs = db.collection(ZONES).where("status", "==", "active").stream()

    zones: list[Zone] = []
    for doc in docs:
        data = doc.to_dict()
        center = data.get("center", {})

        # Count merchants & deals dynamically
        merchant_docs = list(
            db.collection(MERCHANTS)
            .where("zone_id", "==", doc.id)
            .where("status", "==", "active")
            .stream()
        )
        merchant_count = len(merchant_docs)

        deal_count = 0
        for m_doc in merchant_docs:
            offer_q = (
                db.collection(OFFERS)
                .where("merchant_id", "==", m_doc.id)
                .where("status", "==", OfferStatus.active.value)
            )
            deal_count += len(list(offer_q.stream()))

        zones.append(Zone(
            id=doc.id,
            name=data.get("name", ""),
            slug=data.get("slug", ""),
            city=data.get("city", ""),
            center=ZoneCenter(lat=center.get("lat", 0), lng=center.get("lng", 0)),
            radius_miles=data.get("radius_miles", 2.0),
            status=data.get("status", "active"),
            merchant_count=merchant_count,
            deal_count=deal_count,
        ))

    return zones


@router.get("/{slug}", response_model=ZoneDetail)
async def get_zone_detail(slug: str):
    """Zone detail with merchants and their active deals. Public — no auth."""
    db = get_db()

    # Look up zone by slug
    zone_docs = list(
        db.collection(ZONES).where("slug", "==", slug).limit(1).stream()
    )
    if not zone_docs:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone_doc = zone_docs[0]
    zone_data = zone_doc.to_dict()
    center = zone_data.get("center", {})

    merchants, merchant_count, deal_count = _get_zone_merchants_and_deals(zone_doc.id)

    return ZoneDetail(
        id=zone_doc.id,
        name=zone_data.get("name", ""),
        slug=zone_data.get("slug", ""),
        city=zone_data.get("city", ""),
        center=ZoneCenter(lat=center.get("lat", 0), lng=center.get("lng", 0)),
        radius_miles=zone_data.get("radius_miles", 2.0),
        status=zone_data.get("status", "active"),
        merchant_count=merchant_count,
        deal_count=deal_count,
        merchants=merchants,
    )


@router.get("/{slug}/deals", response_model=list[ZoneDeal])
async def list_zone_deals(slug: str):
    """All active deals in a zone, sorted by popularity (redemption count). Public."""
    db = get_db()

    # Look up zone by slug
    zone_docs = list(
        db.collection(ZONES).where("slug", "==", slug).limit(1).stream()
    )
    if not zone_docs:
        raise HTTPException(status_code=404, detail="Zone not found")

    zone_doc = zone_docs[0]
    merchants, _, _ = _get_zone_merchants_and_deals(zone_doc.id)

    # Flatten all deals and sort by redemption_count descending
    all_deals: list[ZoneDeal] = []
    for m in merchants:
        all_deals.extend(m.active_deals)

    all_deals.sort(key=lambda d: d.redemption_count, reverse=True)
    return all_deals


# ---------------------------------------------------------------------------
# Seed helper (call manually or from a script)
# ---------------------------------------------------------------------------

def seed_default_zones():
    """Seed initial zones into Firestore. Idempotent — skips if slug exists."""
    db = get_db()

    default_zones = [
        {
            "name": "Capitol Hill",
            "slug": "capitol-hill",
            "city": "Seattle",
            "center": {"lat": 47.6253, "lng": -122.3222},
            "radius_miles": 1.5,
            "status": "active",
        },
        {
            "name": "Fremont",
            "slug": "fremont",
            "city": "Seattle",
            "center": {"lat": 47.6510, "lng": -122.3505},
            "radius_miles": 1.0,
            "status": "active",
        },
    ]

    seeded = []
    for zone in default_zones:
        existing = list(
            db.collection(ZONES)
            .where("slug", "==", zone["slug"])
            .limit(1)
            .stream()
        )
        if existing:
            seeded.append(f"{zone['slug']} (already exists)")
            continue

        ref = db.collection(ZONES).document()
        zone["created_at"] = datetime.now(timezone.utc)
        ref.set(zone)
        seeded.append(f"{zone['slug']} (created: {ref.id})")

    return seeded
