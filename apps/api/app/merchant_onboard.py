"""Merchant onboarding / invite flow.

Public endpoint for merchants to request an invite.
Admin endpoints to list, approve, and reject invites.
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from .db import get_db, MERCHANT_INVITES, MERCHANTS, USERS
from .deps import get_current_user
from .models import (
    MerchantInviteRequest,
    MerchantInvite,
    InviteListResponse,
    InviteRejectBody,
    InviteStatus,
    MerchantStatus,
    UserStatus,
)

logger = logging.getLogger("boost")

router = APIRouter(tags=["merchant-onboard"])

# Platform admin UID — hardcoded fallback, override via env var
ADMIN_UID = os.getenv("ADMIN_UID", "owner-uid-001")


def _require_platform_admin(user: dict) -> None:
    """Raise 403 unless the user is the platform admin (owner role + known UID)."""
    if user.get("role") == "owner":
        return
    if user.get("uid") == ADMIN_UID:
        return
    raise HTTPException(status_code=403, detail="Platform admin access required")


# ---------------------------------------------------------------------------
# Public
# ---------------------------------------------------------------------------


@router.post("/merchants/request-invite")
async def request_invite(data: MerchantInviteRequest):
    """Submit a merchant invite request. Public — no auth required."""
    db = get_db()
    now = datetime.now(timezone.utc)

    doc_ref = db.collection(MERCHANT_INVITES).document()
    invite_data = {
        "business_name": data.business_name,
        "owner_name": data.owner_name,
        "email": data.email,
        "phone": data.phone,
        "category": data.category,
        "zone_slug": data.zone_slug,
        "status": InviteStatus.pending.value,
        "created_at": now,
        "reviewed_at": None,
        "reject_reason": None,
    }
    doc_ref.set(invite_data)

    logger.info("Merchant invite request created: %s (%s)", data.business_name, doc_ref.id)

    return {
        "message": "Your invite request has been submitted. We'll review it and get back to you within 24 hours.",
        "request_id": doc_ref.id,
    }


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------


@router.get("/admin/invites", response_model=InviteListResponse)
async def list_invites(
    status: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List merchant invite requests. Platform admin only."""
    _require_platform_admin(user)

    db = get_db()
    query = db.collection(MERCHANT_INVITES)

    if status:
        query = query.where("status", "==", status)

    docs = list(query.stream())

    invites = []
    pending_count = 0
    for doc in docs:
        d = doc.to_dict()
        invite = MerchantInvite(id=doc.id, **d)
        invites.append(invite)
        if d.get("status") == InviteStatus.pending.value:
            pending_count += 1

    return InviteListResponse(invites=invites, pending_count=pending_count)


@router.post("/admin/invites/{invite_id}/approve")
async def approve_invite(invite_id: str, user: dict = Depends(get_current_user)):
    """Approve a merchant invite — creates merchant + user records. Platform admin only."""
    _require_platform_admin(user)

    db = get_db()
    now = datetime.now(timezone.utc)

    # Fetch the invite
    invite_ref = db.collection(MERCHANT_INVITES).document(invite_id)
    invite_doc = invite_ref.get()

    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invite not found")

    invite_data = invite_doc.to_dict()

    if invite_data.get("status") != InviteStatus.pending.value:
        raise HTTPException(
            status_code=400,
            detail=f"Invite is already {invite_data.get('status')}",
        )

    # Create the merchant
    merchant_ref = db.collection(MERCHANTS).document()
    merchant_record = {
        "name": invite_data["business_name"],
        "email": invite_data["email"],
        "category": invite_data.get("category"),
        "zone_slug": invite_data.get("zone_slug"),
        "locations": [],
        "status": MerchantStatus.active.value,
        "created_at": now,
        "deleted_at": None,
        "deleted_by": None,
    }
    merchant_ref.set(merchant_record)

    # Try to find or create Firebase auth user for the merchant owner
    from .auth import get_user_by_email, set_user_claims, _init_firebase_admin

    firebase_uid = None
    try:
        existing_user = get_user_by_email(invite_data["email"])
        if existing_user:
            firebase_uid = existing_user.uid
        else:
            # Create a new Firebase auth user
            from firebase_admin import auth as fb_auth

            _init_firebase_admin()
            new_user = fb_auth.create_user(
                email=invite_data["email"],
                display_name=invite_data["owner_name"],
            )
            firebase_uid = new_user.uid
    except Exception as e:
        logger.warning("Firebase user creation skipped: %s", e)

    # Set merchant role
    if firebase_uid:
        try:
            set_user_claims(
                uid=firebase_uid,
                role="merchant_admin",
                merchant_id=merchant_ref.id,
            )

            # Create user record in Firestore
            user_ref = db.collection(USERS).document(firebase_uid)
            user_ref.set({
                "email": invite_data["email"],
                "role": "merchant_admin",
                "merchant_id": merchant_ref.id,
                "is_primary": True,
                "status": UserStatus.active.value,
                "created_at": now,
                "created_by": user.get("uid"),
            })
        except Exception as e:
            logger.warning("Setting merchant claims failed: %s", e)

    # Update invite status
    invite_ref.update({
        "status": InviteStatus.approved.value,
        "reviewed_at": now,
    })

    logger.info(
        "Invite %s approved → merchant %s created",
        invite_id,
        merchant_ref.id,
    )

    return {
        "message": "Invite approved. Merchant created.",
        "merchant_id": merchant_ref.id,
        "firebase_uid": firebase_uid,
    }


@router.post("/admin/invites/{invite_id}/reject")
async def reject_invite(
    invite_id: str,
    body: InviteRejectBody = InviteRejectBody(),
    user: dict = Depends(get_current_user),
):
    """Reject a merchant invite with optional reason. Platform admin only."""
    _require_platform_admin(user)

    db = get_db()
    now = datetime.now(timezone.utc)

    invite_ref = db.collection(MERCHANT_INVITES).document(invite_id)
    invite_doc = invite_ref.get()

    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invite not found")

    invite_data = invite_doc.to_dict()

    if invite_data.get("status") != InviteStatus.pending.value:
        raise HTTPException(
            status_code=400,
            detail=f"Invite is already {invite_data.get('status')}",
        )

    invite_ref.update({
        "status": InviteStatus.rejected.value,
        "reviewed_at": now,
        "reject_reason": body.reason,
    })

    logger.info("Invite %s rejected", invite_id)

    return {
        "message": "Invite rejected.",
        "invite_id": invite_id,
    }
