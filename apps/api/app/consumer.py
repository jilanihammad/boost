"""Consumer registration and profile endpoints."""

import hashlib
import hmac
import os
import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from .db import get_db, CONSUMERS, CONSUMER_CLAIMS, CONSUMER_VISITS, OFFERS, MERCHANTS, REDEMPTIONS
from .deps import get_current_user, get_current_consumer
from .models import (
    ConsumerRegisterRequest,
    ConsumerProfile,
    ConsumerTier,
    ConsumerClaimResponse,
    ConsumerWalletResponse,
    ActiveClaim,
    VisitHistoryItem,
    OfferStatus,
)

# HMAC secret for signing personal QR codes
_QR_SECRET = os.getenv("BOOST_QR_SECRET", "boost-dev-secret-change-me").encode()

router = APIRouter(prefix="/consumer", tags=["consumer"])

# Characters for referral codes (unambiguous alphanumeric)
_REFERRAL_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def _generate_referral_code(length: int = 8) -> str:
    """Generate an 8-char alphanumeric referral code."""
    return "".join(random.choices(_REFERRAL_CHARS, k=length))


def _unique_referral_code(db) -> str:
    """Generate a referral code that doesn't already exist in Firestore."""
    for _ in range(10):
        code = _generate_referral_code()
        existing = list(
            db.collection(CONSUMERS)
            .where("referral_code", "==", code)
            .limit(1)
            .stream()
        )
        if not existing:
            return code
    # Extremely unlikely to reach here; fall back to longer code
    return _generate_referral_code(length=12)


@router.post("/register", response_model=ConsumerProfile)
async def register_consumer(
    data: ConsumerRegisterRequest,
    user=Depends(get_current_user),
):
    """Register a consumer profile after Firebase Auth signup.

    Creates a consumer document in Firestore. Idempotent — if the consumer
    already exists, returns the existing profile.
    """
    db = get_db()
    uid = user.get("uid")
    email = user.get("email", "")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    # Check if consumer already exists (idempotent)
    existing_doc = db.collection(CONSUMERS).document(uid).get()
    if existing_doc.exists:
        return ConsumerProfile(uid=uid, **existing_doc.to_dict())

    # Validate referral code if provided
    referred_by = None
    if data.referred_by:
        referrer_query = list(
            db.collection(CONSUMERS)
            .where("referral_code", "==", data.referred_by.upper())
            .limit(1)
            .stream()
        )
        if referrer_query:
            referred_by = data.referred_by.upper()
        # Silently ignore invalid referral codes (don't block registration)

    now = datetime.now(timezone.utc)
    referral_code = _unique_referral_code(db)

    # Determine if location was verified (lat/lng provided = browser geolocation)
    location_verified_at = now if (data.lat is not None and data.lng is not None) else None

    consumer_data = {
        "email": email,
        "phone": None,
        "display_name": data.display_name,
        "home_zone_id": None,
        "location_verified_at": location_verified_at,
        "zip_code": data.zip_code,
        "lat": data.lat,
        "lng": data.lng,
        "tier": ConsumerTier.free.value,
        "global_points": 0,
        "referral_code": referral_code,
        "referred_by": referred_by,
        "created_at": now,
    }

    db.collection(CONSUMERS).document(uid).set(consumer_data)

    return ConsumerProfile(uid=uid, **consumer_data)


@router.get("/profile", response_model=ConsumerProfile)
async def get_consumer_profile(user=Depends(get_current_consumer)):
    """Get the current consumer's profile."""
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    doc = db.collection(CONSUMERS).document(uid).get()
    if not doc.exists:
        raise HTTPException(
            status_code=404,
            detail="Consumer profile not found. Please register first.",
        )

    return ConsumerProfile(uid=uid, **doc.to_dict())


# ---------------------------------------------------------------------------
# Personal QR — HMAC helpers
# ---------------------------------------------------------------------------


def sign_personal_qr(consumer_uid: str, offer_id: str, timestamp: int) -> str:
    """Generate HMAC-SHA256 hex digest for a personal QR payload."""
    message = f"{consumer_uid}:{offer_id}:{timestamp}".encode()
    return hmac.new(_QR_SECRET, message, hashlib.sha256).hexdigest()[:16]


def verify_personal_qr(consumer_uid: str, offer_id: str, timestamp: int, hmac_hex: str) -> bool:
    """Verify HMAC on a personal QR payload."""
    expected = sign_personal_qr(consumer_uid, offer_id, timestamp)
    return hmac.compare_digest(expected, hmac_hex)


def parse_personal_qr(qr_data: str) -> dict | None:
    """Parse a personal QR string and verify its HMAC.

    Expected format: boost://claim/{consumer_uid}/{offer_id}/{timestamp}/{hmac_hex}
    Returns dict with consumer_uid, offer_id, timestamp or None if invalid.
    """
    if not qr_data.startswith("boost://claim/"):
        return None

    parts = qr_data.replace("boost://claim/", "").split("/")
    if len(parts) != 4:
        return None

    consumer_uid, offer_id, ts_str, hmac_hex = parts
    try:
        timestamp = int(ts_str)
    except ValueError:
        return None

    if not verify_personal_qr(consumer_uid, offer_id, timestamp, hmac_hex):
        return None

    return {
        "consumer_uid": consumer_uid,
        "offer_id": offer_id,
        "timestamp": timestamp,
    }


# ---------------------------------------------------------------------------
# Claim endpoint
# ---------------------------------------------------------------------------


@router.post("/claim/{offer_id}", response_model=ConsumerClaimResponse)
async def claim_offer(offer_id: str, user=Depends(get_current_consumer)):
    """Claim an offer — generates a personal, HMAC-signed QR code.

    Rate limited to 1 claim per consumer per offer per day.
    The claim is a "reservation"; redemption happens when staff scans.
    """
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    # Verify consumer profile exists
    consumer_doc = db.collection(CONSUMERS).document(uid).get()
    if not consumer_doc.exists:
        raise HTTPException(
            status_code=404,
            detail="Consumer profile not found. Please register first.",
        )

    # Verify offer exists and is active
    offer_doc = db.collection(OFFERS).document(offer_id).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()
    if offer_data.get("status") != OfferStatus.active.value:
        raise HTTPException(status_code=410, detail="This offer is no longer active")

    # Check daily cap on the offer
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    redemptions_query = (
        db.collection(REDEMPTIONS)
        .where("offer_id", "==", offer_id)
        .where("timestamp", ">=", today_start)
    )
    today_count = len(list(redemptions_query.stream()))
    if today_count >= offer_data.get("cap_daily", 50):
        raise HTTPException(status_code=429, detail="Daily cap reached for this offer")

    # Check 1-per-consumer-per-offer-per-day rate limit
    existing_claims = list(
        db.collection(CONSUMER_CLAIMS)
        .where("consumer_uid", "==", uid)
        .where("offer_id", "==", offer_id)
        .where("claimed_at", ">=", today_start)
        .limit(1)
        .stream()
    )
    if existing_claims:
        # Return the existing claim instead of creating a new one
        claim_data = existing_claims[0].to_dict()
        return ConsumerClaimResponse(
            qr_data=claim_data["qr_data"],
            short_code=claim_data["short_code"],
            expires_at=claim_data["expires_at"],
            offer_name=claim_data["offer_name"],
            merchant_name=claim_data["merchant_name"],
            points_preview=claim_data.get("points_preview", 50),
        )

    # Get merchant name
    merchant_doc = db.collection(MERCHANTS).document(offer_data["merchant_id"]).get()
    merchant_name = (
        merchant_doc.to_dict().get("name", "Local Business") if merchant_doc.exists else "Local Business"
    )

    # Generate personal QR
    now = datetime.now(timezone.utc)
    ts = int(now.timestamp())
    hmac_hex = sign_personal_qr(uid, offer_id, ts)
    qr_data = f"boost://claim/{uid}/{offer_id}/{ts}/{hmac_hex}"

    # 6-char short code for manual fallback
    short_code = _generate_referral_code(length=6)

    # Expires at end of day (UTC)
    expires_at = today_start.replace(hour=23, minute=59, second=59)

    # Store claim
    claim_ref = db.collection(CONSUMER_CLAIMS).document()
    claim_doc = {
        "consumer_uid": uid,
        "offer_id": offer_id,
        "merchant_id": offer_data["merchant_id"],
        "qr_data": qr_data,
        "short_code": short_code,
        "expires_at": expires_at,
        "offer_name": offer_data["name"],
        "merchant_name": merchant_name,
        "points_preview": 50,
        "claimed_at": now,
        "redeemed": False,
    }
    claim_ref.set(claim_doc)

    return ConsumerClaimResponse(
        qr_data=qr_data,
        short_code=short_code,
        expires_at=expires_at,
        offer_name=offer_data["name"],
        merchant_name=merchant_name,
        points_preview=50,
    )


# ---------------------------------------------------------------------------
# Wallet endpoint
# ---------------------------------------------------------------------------


@router.get("/wallet", response_model=ConsumerWalletResponse)
async def get_wallet(user=Depends(get_current_consumer)):
    """Get the consumer's wallet: active claims, visit history, and points.

    Returns all unredeemed/unexpired claims, last 30 visits, and total points.
    """
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    # Get consumer profile for total_points
    consumer_doc = db.collection(CONSUMERS).document(uid).get()
    if not consumer_doc.exists:
        raise HTTPException(
            status_code=404,
            detail="Consumer profile not found. Please register first.",
        )
    consumer_data = consumer_doc.to_dict()
    total_points = consumer_data.get("global_points", 0)

    now = datetime.now(timezone.utc)

    # --- Active claims: unredeemed AND not expired ---
    claims_query = (
        db.collection(CONSUMER_CLAIMS)
        .where("consumer_uid", "==", uid)
        .where("redeemed", "==", False)
    )
    active_claims: list[ActiveClaim] = []
    for doc in claims_query.stream():
        data = doc.to_dict()
        expires_at = data.get("expires_at")
        # Skip expired claims
        if isinstance(expires_at, datetime) and expires_at < now:
            continue
        active_claims.append(
            ActiveClaim(
                qr_data=data.get("qr_data", ""),
                short_code=data.get("short_code", ""),
                expires_at=expires_at,
                offer_name=data.get("offer_name", ""),
                merchant_name=data.get("merchant_name", ""),
            )
        )

    # --- Visit history: last 30, most recent first ---
    visits_query = (
        db.collection(CONSUMER_VISITS)
        .where("consumer_id", "==", uid)
        .order_by("timestamp", direction="DESCENDING")
        .limit(30)
    )

    # Build lookup caches for merchant and offer names
    merchant_cache: dict[str, str] = {}
    offer_cache: dict[str, str] = {}

    visit_history: list[VisitHistoryItem] = []
    for doc in visits_query.stream():
        data = doc.to_dict()

        # Look up merchant name (with cache)
        merchant_id = data.get("merchant_id", "")
        if merchant_id not in merchant_cache:
            m_doc = db.collection(MERCHANTS).document(merchant_id).get()
            merchant_cache[merchant_id] = (
                m_doc.to_dict().get("name", "Local Business") if m_doc.exists else "Local Business"
            )

        # Look up offer name (with cache)
        offer_id = data.get("offer_id", "")
        if offer_id not in offer_cache:
            o_doc = db.collection(OFFERS).document(offer_id).get()
            offer_cache[offer_id] = (
                o_doc.to_dict().get("name", "Deal") if o_doc.exists else "Deal"
            )

        visit_history.append(
            VisitHistoryItem(
                merchant_name=merchant_cache[merchant_id],
                offer_name=offer_cache[offer_id],
                timestamp=data.get("timestamp", now),
                visit_number=data.get("visit_number", 1),
                points_earned=data.get("points_earned", 0),
            )
        )

    return ConsumerWalletResponse(
        active_claims=active_claims,
        visit_history=visit_history,
        total_points=total_points,
    )
