"""Referral program endpoints for consumers."""

import os
import random
import string
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from google.cloud.firestore_v1 import Increment as _Increment

from .db import get_db, CONSUMERS, REFERRALS
from .deps import get_current_consumer
from .models import (
    ReferralCodeResponse,
    ReferralListItem,
    ReferralListResponse,
    ReferralSubmit,
)

router = APIRouter(prefix="/consumer", tags=["referrals"])

# Characters for referral codes (unambiguous alphanumeric, 6-char)
_REFERRAL_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"

_FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

REFERRER_POINTS = 100
REFERRED_POINTS = 50


def _generate_code(length: int = 6) -> str:
    """Generate a random referral code."""
    return "".join(random.choices(_REFERRAL_CHARS, k=length))


def _unique_code(db, length: int = 6) -> str:
    """Generate a referral code that doesn't collide with any existing consumer."""
    for _ in range(20):
        code = _generate_code(length)
        existing = list(
            db.collection(CONSUMERS)
            .where("referral_code", "==", code)
            .limit(1)
            .stream()
        )
        if not existing:
            return code
    # Extremely unlikely fallback
    return _generate_code(length=10)


def _mask_name(display_name: str) -> str:
    """Mask a display name: 'Jane Doe' -> 'Jane D.'"""
    if not display_name:
        return "User"
    parts = display_name.strip().split()
    if len(parts) == 1:
        return parts[0][:1] + "***"
    return f"{parts[0]} {parts[-1][:1]}."


# ---------------------------------------------------------------------------
# GET /consumer/referral-code — get or generate referral code
# ---------------------------------------------------------------------------


@router.get("/referral-code", response_model=ReferralCodeResponse)
async def get_referral_code(user=Depends(get_current_consumer)):
    """Return the consumer's unique referral code, generating one if needed."""
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    consumer_doc = db.collection(CONSUMERS).document(uid).get()
    if not consumer_doc.exists:
        raise HTTPException(
            status_code=404,
            detail="Consumer profile not found. Please register first.",
        )

    consumer_data = consumer_doc.to_dict()
    code = consumer_data.get("referral_code")

    # Generate if missing (shouldn't happen for new registrations, but safety net)
    if not code:
        code = _unique_code(db)
        db.collection(CONSUMERS).document(uid).update({"referral_code": code})

    share_url = f"{_FRONTEND_URL}/join?ref={code}"

    return ReferralCodeResponse(code=code, share_url=share_url)


# ---------------------------------------------------------------------------
# POST /consumer/referral — submit a referral code
# ---------------------------------------------------------------------------


@router.post("/referral")
async def submit_referral(data: ReferralSubmit, user=Depends(get_current_consumer)):
    """Submit a referral code. Awards points to both referrer and referred."""
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    code = data.referral_code.strip().upper()

    # Look up the referrer by code
    referrer_docs = list(
        db.collection(CONSUMERS)
        .where("referral_code", "==", code)
        .limit(1)
        .stream()
    )
    if not referrer_docs:
        raise HTTPException(status_code=404, detail="Invalid referral code")

    referrer_doc = referrer_docs[0]
    referrer_id = referrer_doc.id

    # Prevent self-referral
    if referrer_id == uid:
        raise HTTPException(status_code=400, detail="You cannot refer yourself")

    # Prevent duplicate referral between this pair
    existing = list(
        db.collection(REFERRALS)
        .where("referrer_id", "==", referrer_id)
        .where("referred_id", "==", uid)
        .limit(1)
        .stream()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="You have already used this referral code"
        )

    # Also check reverse direction (prevent gaming)
    existing_reverse = list(
        db.collection(REFERRALS)
        .where("referrer_id", "==", uid)
        .where("referred_id", "==", referrer_id)
        .limit(1)
        .stream()
    )
    if existing_reverse:
        raise HTTPException(
            status_code=409, detail="A referral already exists between you and this user"
        )

    now = datetime.now(timezone.utc)

    # Create referral record
    ref_doc = db.collection(REFERRALS).document()
    ref_doc.set({
        "referrer_id": referrer_id,
        "referred_id": uid,
        "status": "completed",
        "points_earned": REFERRER_POINTS,
        "created_at": now,
    })

    # Award points to referrer
    db.collection(CONSUMERS).document(referrer_id).update({
        "global_points": _Increment(REFERRER_POINTS),
    })

    # Award points to referred (current user)
    db.collection(CONSUMERS).document(uid).update({
        "global_points": _Increment(REFERRED_POINTS),
    })

    return {
        "success": True,
        "message": f"Referral applied! You earned {REFERRED_POINTS} points, and your friend earned {REFERRER_POINTS} points.",
        "points_earned": REFERRED_POINTS,
        "referrer_points_earned": REFERRER_POINTS,
    }


# ---------------------------------------------------------------------------
# GET /consumer/referrals — list referrals made by this consumer
# ---------------------------------------------------------------------------


@router.get("/referrals", response_model=ReferralListResponse)
async def list_referrals(user=Depends(get_current_consumer)):
    """List people this consumer has referred."""
    db = get_db()
    uid = user.get("uid")

    if not uid:
        raise HTTPException(status_code=400, detail="User UID not found in token")

    referral_docs = list(
        db.collection(REFERRALS)
        .where("referrer_id", "==", uid)
        .order_by("created_at", direction="DESCENDING")
        .stream()
    )

    referrals: list[ReferralListItem] = []
    total_points = 0

    for rdoc in referral_docs:
        rdata = rdoc.to_dict()
        referred_id = rdata.get("referred_id", "")
        points = rdata.get("points_earned", 0)
        total_points += points

        # Look up referred consumer name (masked)
        referred_name = "User"
        referred_consumer = db.collection(CONSUMERS).document(referred_id).get()
        if referred_consumer.exists:
            referred_name = _mask_name(
                referred_consumer.to_dict().get("display_name", "User")
            )

        referrals.append(
            ReferralListItem(
                referred_name=referred_name,
                status=rdata.get("status", "completed"),
                points_earned=points,
                created_at=rdata.get("created_at", datetime.now(timezone.utc)),
            )
        )

    return ReferralListResponse(
        referrals=referrals,
        total_points_earned=total_points,
    )
