"""Boost API - Main application."""

import csv
import io
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

import sentry_sdk
from dotenv import load_dotenv

# --- Sentry Error Monitoring ---
_sentry_dsn = os.getenv("SENTRY_DSN")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
    )
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from .auth import (
    require_owner,
    require_merchant_admin,
    require_staff_or_above,
    set_user_claims,
    clear_user_claims,
    get_user_by_email,
    can_delete_user,
)
from .db import get_db, MERCHANTS, OFFERS, TOKENS, REDEMPTIONS, LEDGER, USERS, PENDING_ROLES
from .deps import get_current_user
from .models import (
    MerchantCreate,
    MerchantUpdate,
    Merchant,
    MerchantStatus,
    OfferCreate,
    OfferUpdate,
    Offer,
    OfferStatus,
    TokenCreate,
    Token,
    TokenStatus,
    RedeemRequest,
    RedeemResponse,
    UserCreate,
    User,
    UserRole,
    UserStatus,
    PendingRole,
    ClaimRoleResponse,
    UserResponse,
)
from .tokens import create_tokens, get_token_by_id_or_code, mark_token_redeemed, generate_qr_image

load_dotenv()

app = FastAPI(title="Boost API")

# CORS: In production, CORS_ORIGINS must be set explicitly.
# In dev (default), fall back to localhost.
_env = os.getenv("ENVIRONMENT", "development").lower()
_cors_raw = os.getenv("CORS_ORIGINS")

if _env == "production" and not _cors_raw:
    raise RuntimeError(
        "CORS_ORIGINS env var must be set in production. "
        "Example: CORS_ORIGINS=https://yourdomain.com,https://app.yourdomain.com"
    )

origins = [o.strip() for o in (_cors_raw or "http://localhost:3000").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Rate Limiting (SlowAPI) ---
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# --- Structured Logging ---
_json_log_handler = logging.StreamHandler()
_json_log_handler.setFormatter(
    logging.Formatter(
        '{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","message":"%(message)s"}'
    )
)
logger = logging.getLogger("boost")
logger.setLevel(logging.INFO)
logger.addHandler(_json_log_handler)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log method, path, status_code, duration_ms for every request."""

    async def dispatch(self, request: Request, call_next):
        start = time.time()
        response = await call_next(request)
        duration_ms = round((time.time() - start) * 1000, 2)
        logger.info(
            '{"method":"%s","path":"%s","status_code":%d,"duration_ms":%.2f}',
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        return response


app.add_middleware(RequestLoggingMiddleware)


def get_merchant_id_from_user(user: dict) -> Optional[str]:
    """Get merchant_id from user claims (for merchant_admin/staff roles)."""
    return user.get("merchant_id")


# --- Health ---

@app.get("/health")
async def health():
    """Health check — verifies Firestore connectivity."""
    try:
        db = get_db()
        # Attempt to list a single collection to verify connectivity
        _cols = list(db.collections())  # noqa: F841
        return {"ok": True}
    except Exception as e:
        logger.error("Health check failed: %s", str(e))
        return {"ok": False, "error": str(e)}


# --- Public Consumer Endpoints (no auth required) ---

@app.get("/public/offers/{token_id_or_code}")
async def get_public_offer_by_token(token_id_or_code: str):
    """Public endpoint: resolve a token/code to offer details for the consumer claim page.
    No auth required — this is what consumers see when they scan a QR code.
    """
    from .tokens import get_token_by_id_or_code

    result = get_token_by_id_or_code(token_id_or_code)
    if not result:
        raise HTTPException(status_code=404, detail="Offer not found or expired")

    token_id, token_data = result

    # Check token is still valid
    if token_data["status"] == "expired":
        raise HTTPException(status_code=410, detail="This offer has expired")

    expires_at = token_data["expires_at"]
    if isinstance(expires_at, datetime) and expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="This offer has expired")

    # Get offer details
    db = get_db()
    offer_doc = db.collection(OFFERS).document(token_data["offer_id"]).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()

    if offer_data["status"] != OfferStatus.active.value:
        raise HTTPException(status_code=410, detail="This offer is no longer active")

    # Get merchant name
    merchant_doc = db.collection(MERCHANTS).document(offer_data["merchant_id"]).get()
    merchant_name = merchant_doc.to_dict().get("name", "Local Business") if merchant_doc.exists else "Local Business"

    # Check daily cap
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    redemptions_query = (
        db.collection(REDEMPTIONS)
        .where("offer_id", "==", token_data["offer_id"])
        .where("timestamp", ">=", today_start)
    )
    today_count = len(list(redemptions_query.stream()))
    cap_remaining = max(0, offer_data["cap_daily"] - today_count)

    return {
        "token_id": token_id,
        "short_code": token_data.get("short_code", ""),
        "offer_name": offer_data["name"],
        "discount_text": offer_data["discount_text"],
        "terms": offer_data.get("terms"),
        "merchant_name": merchant_name,
        "active_hours": offer_data.get("active_hours"),
        "cap_remaining": cap_remaining,
        "qr_data": token_data.get("qr_data", ""),
    }


# --- Merchants ---

@app.post("/merchants", response_model=Merchant)
async def create_merchant(data: MerchantCreate, user=Depends(get_current_user)):
    """Create a new merchant (owner only)."""
    require_owner(user)

    db = get_db()
    now = datetime.now(timezone.utc)

    doc_ref = db.collection(MERCHANTS).document()
    merchant_data = {
        "name": data.name,
        "email": data.email,
        "locations": data.locations,
        "status": MerchantStatus.active.value,
        "created_at": now,
        "deleted_at": None,
        "deleted_by": None,
    }
    doc_ref.set(merchant_data)

    return Merchant(id=doc_ref.id, **merchant_data)


@app.get("/merchants")
async def list_merchants(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List merchants.

    Owner: sees all merchants (including soft-deleted).
    Merchant admin/staff: sees only their merchant.
    """
    db = get_db()
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    if role == "owner":
        # Owner sees all merchants
        query = db.collection(MERCHANTS).offset(offset).limit(limit)
        docs = query.stream()
        merchants = [Merchant(id=doc.id, **doc.to_dict()) for doc in docs]
    elif user_merchant_id:
        # Merchant admin/staff sees only their merchant
        doc = db.collection(MERCHANTS).document(user_merchant_id).get()
        if doc.exists:
            merchants = [Merchant(id=doc.id, **doc.to_dict())]
        else:
            merchants = []
    else:
        merchants = []

    return {"merchants": merchants, "limit": limit, "offset": offset}


@app.get("/merchants/{merchant_id}", response_model=Merchant)
async def get_merchant(merchant_id: str, user=Depends(get_current_user)):
    """Get merchant by ID.

    Owner: can view any merchant.
    Merchant admin/staff: can only view their own merchant.
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()
    doc = db.collection(MERCHANTS).document(merchant_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")

    return Merchant(id=doc.id, **doc.to_dict())


@app.patch("/merchants/{merchant_id}", response_model=Merchant)
async def update_merchant(merchant_id: str, data: MerchantUpdate, user=Depends(get_current_user)):
    """Update merchant.

    Owner: can update any merchant.
    Merchant admin: can update their own merchant.
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    doc_ref = db.collection(MERCHANTS).document(merchant_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")

    update_data = data.model_dump(exclude_unset=True)
    if update_data:
        doc_ref.update(update_data)

    updated = doc_ref.get()
    return Merchant(id=updated.id, **updated.to_dict())


# --- Offers ---

@app.post("/offers", response_model=Offer)
async def create_offer(data: OfferCreate, user=Depends(get_current_user)):
    """Create a new offer.

    Owner: can create for any merchant.
    Merchant admin: can create for their own merchant.
    """
    require_merchant_admin(user, data.merchant_id)

    db = get_db()

    # Verify merchant exists and is active
    merchant_doc = db.collection(MERCHANTS).document(data.merchant_id).get()
    if not merchant_doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")
    merchant_data = merchant_doc.to_dict()
    if merchant_data.get("status") == MerchantStatus.deleted.value:
        raise HTTPException(status_code=400, detail="Cannot create offers for deleted merchant")

    now = datetime.now(timezone.utc)

    doc_ref = db.collection(OFFERS).document()
    offer_data = {
        "merchant_id": data.merchant_id,
        "name": data.name,
        "discount_text": data.discount_text,
        "terms": data.terms,
        "cap_daily": data.cap_daily,
        "active_hours": data.active_hours,
        "value_per_redemption": data.value_per_redemption,
        "status": OfferStatus.active.value,
        "created_at": now,
        "updated_at": now,
    }
    doc_ref.set(offer_data)

    return Offer(
        id=doc_ref.id,
        merchant_id=data.merchant_id,
        name=data.name,
        discount_text=data.discount_text,
        terms=data.terms,
        cap_daily=data.cap_daily,
        active_hours=data.active_hours,
        value_per_redemption=data.value_per_redemption,
        status=OfferStatus.active,
        created_at=now,
        updated_at=now,
        today_redemptions=0,
        cap_remaining=data.cap_daily,
    )


def _batch_daily_redemption_counts(db, offer_ids: list[str], today_start: datetime) -> dict[str, int]:
    """Batch-fetch today's redemption counts for multiple offers.

    Caches results per-call to avoid repeated full scans (#8: bo-poh).
    Groups offers into batches of 30 (Firestore 'in' query limit).
    """
    counts: dict[str, int] = {}
    if not offer_ids:
        return counts

    # Firestore 'in' queries support up to 30 values
    batch_size = 30
    for i in range(0, len(offer_ids), batch_size):
        batch = offer_ids[i : i + batch_size]
        redemptions_query = (
            db.collection(REDEMPTIONS)
            .where("offer_id", "in", batch)
            .where("timestamp", ">=", today_start)
        )
        for rdoc in redemptions_query.stream():
            oid = rdoc.to_dict().get("offer_id")
            if oid:
                counts[oid] = counts.get(oid, 0) + 1

    # Ensure all requested offer_ids have an entry
    for oid in offer_ids:
        counts.setdefault(oid, 0)

    return counts


@app.get("/offers")
async def list_offers(
    merchant_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List offers.

    Owner: sees all offers, can filter by merchant_id.
    Merchant admin/staff: sees only their merchant's offers.
    """
    db = get_db()
    query = db.collection(OFFERS)

    # Filter by merchant based on role
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    if role == "owner":
        if merchant_id:
            query = query.where("merchant_id", "==", merchant_id)
    elif user_merchant_id:
        query = query.where("merchant_id", "==", user_merchant_id)
    else:
        return {"offers": [], "limit": limit, "offset": offset}

    query = query.offset(offset).limit(limit)
    docs = list(query.stream())

    # Batch-fetch today's redemption counts (#8: bo-poh)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    offer_ids = [doc.id for doc in docs]
    daily_counts = _batch_daily_redemption_counts(db, offer_ids, today_start)

    offers = []
    for doc in docs:
        data = doc.to_dict()
        offer_id = doc.id
        today_count = daily_counts.get(offer_id, 0)

        offers.append(
            Offer(
                id=offer_id,
                merchant_id=data["merchant_id"],
                name=data["name"],
                discount_text=data["discount_text"],
                terms=data.get("terms"),
                cap_daily=data["cap_daily"],
                active_hours=data.get("active_hours"),
                status=OfferStatus(data["status"]),
                value_per_redemption=data.get("value_per_redemption", 2.0),
                created_at=data["created_at"],
                updated_at=data["updated_at"],
                today_redemptions=today_count,
                cap_remaining=max(0, data["cap_daily"] - today_count),
            )
        )

    return {"offers": offers, "limit": limit, "offset": offset}


@app.get("/offers/{offer_id}", response_model=Offer)
async def get_offer(offer_id: str, user=Depends(get_current_user)):
    """Get offer by ID.

    Owner: can view any offer.
    Merchant admin/staff: can only view their merchant's offers.
    """
    db = get_db()
    doc = db.collection(OFFERS).document(offer_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    data = doc.to_dict()

    # Check access using role hierarchy
    require_staff_or_above(user, data["merchant_id"])

    # Count today's redemptions
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    redemptions_query = (
        db.collection(REDEMPTIONS)
        .where("offer_id", "==", offer_id)
        .where("timestamp", ">=", today_start)
    )
    today_count = len(list(redemptions_query.stream()))

    return Offer(
        id=doc.id,
        merchant_id=data["merchant_id"],
        name=data["name"],
        discount_text=data["discount_text"],
        terms=data.get("terms"),
        cap_daily=data["cap_daily"],
        active_hours=data.get("active_hours"),
        status=OfferStatus(data["status"]),
        value_per_redemption=data.get("value_per_redemption", 2.0),
        created_at=data["created_at"],
        updated_at=data["updated_at"],
        today_redemptions=today_count,
        cap_remaining=max(0, data["cap_daily"] - today_count),
    )


@app.patch("/offers/{offer_id}", response_model=Offer)
async def update_offer(offer_id: str, data: OfferUpdate, user=Depends(get_current_user)):
    """Update offer (pause/resume/edit).

    Owner: can update any offer.
    Merchant admin: can update their merchant's offers.
    """
    db = get_db()
    doc_ref = db.collection(OFFERS).document(offer_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = doc.to_dict()
    require_merchant_admin(user, offer_data["merchant_id"])

    update_data = data.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = update_data["status"].value

    update_data["updated_at"] = datetime.now(timezone.utc)

    if update_data:
        doc_ref.update(update_data)

    return await get_offer(offer_id, user)


@app.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str, user=Depends(get_current_user)):
    """Delete offer.

    Owner: can delete any offer.
    Merchant admin: can delete their merchant's offers.
    """
    db = get_db()
    doc_ref = db.collection(OFFERS).document(offer_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = doc.to_dict()
    require_merchant_admin(user, offer_data["merchant_id"])

    doc_ref.delete()
    return {"deleted": True, "id": offer_id}


# --- Tokens ---

@app.post("/offers/{offer_id}/tokens")
async def generate_tokens(offer_id: str, data: TokenCreate, user=Depends(get_current_user)):
    """Generate redemption tokens for an offer.

    Owner: can generate for any offer.
    Merchant admin: can generate for their merchant's offers.
    """
    db = get_db()
    offer_doc = db.collection(OFFERS).document(offer_id).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()
    require_merchant_admin(user, offer_data["merchant_id"])

    try:
        tokens = create_tokens(offer_id, data.count, data.expires_days)
        return {
            "offer_id": offer_id,
            "count": len(tokens),
            "tokens": tokens,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/offers/{offer_id}/tokens")
async def list_tokens(
    offer_id: str,
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=1000),
    user=Depends(get_current_user),
):
    """List tokens for an offer.

    Owner: can list tokens for any offer.
    Merchant admin: can list tokens for their merchant's offers.
    """
    db = get_db()

    # Check offer exists and user has access
    offer_doc = db.collection(OFFERS).document(offer_id).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()
    require_merchant_admin(user, offer_data["merchant_id"])

    query = db.collection(TOKENS).where("offer_id", "==", offer_id)

    if status:
        query = query.where("status", "==", status)

    query = query.limit(limit)
    docs = query.stream()

    tokens = []
    for doc in docs:
        data = doc.to_dict()
        tokens.append({
            "id": doc.id,
            **data,
        })

    return {"offer_id": offer_id, "tokens": tokens}


@app.get("/tokens/{token_id}/qr")
async def get_token_qr(token_id: str, user=Depends(get_current_user)):
    """Get QR code image for a token.

    Owner: can get QR for any token.
    Merchant admin: can get QR for their merchant's tokens.
    """
    db = get_db()
    doc = db.collection(TOKENS).document(token_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Token not found")

    token_data = doc.to_dict()

    # Get offer to check merchant access
    offer_doc = db.collection(OFFERS).document(token_data["offer_id"]).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()
    require_merchant_admin(user, offer_data["merchant_id"])

    qr_bytes = generate_qr_image(token_data["qr_data"])

    return Response(
        content=qr_bytes,
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename={token_id}.png"},
    )


# --- Redemptions ---

@app.post("/redeem", response_model=RedeemResponse)
@limiter.limit("10/minute")
async def redeem_token(request: Request, data: RedeemRequest, user=Depends(get_current_user)):
    """Redeem a token (scan QR or enter code).

    Owner: can redeem any token.
    Merchant admin/staff: can redeem tokens for their merchant.
    """
    db = get_db()

    # Note: We check merchant access after looking up the token,
    # since we need the offer to know which merchant it belongs to.

    # Look up token
    result = get_token_by_id_or_code(data.token)
    if not result:
        raise HTTPException(status_code=404, detail="Token not found")

    token_id, token_data = result

    # Check if this is a universal (reusable) token
    is_universal = token_data.get("is_universal", False)

    # Check token status - universal tokens can be reused, so skip "redeemed" check
    if not is_universal and token_data["status"] == TokenStatus.redeemed.value:
        return RedeemResponse(
            success=False,
            message="This code has already been redeemed",
        )

    if token_data["status"] == TokenStatus.expired.value:
        return RedeemResponse(
            success=False,
            message="This code has expired",
        )

    # Check expiry
    expires_at = token_data["expires_at"]
    if isinstance(expires_at, datetime):
        if expires_at < datetime.now(timezone.utc):
            return RedeemResponse(
                success=False,
                message="This code has expired",
            )

    # Get offer details
    offer_doc = db.collection(OFFERS).document(token_data["offer_id"]).get()
    if not offer_doc.exists:
        raise HTTPException(status_code=404, detail="Offer not found")

    offer_data = offer_doc.to_dict()

    # Check user has permission to redeem for this merchant
    require_staff_or_above(user, offer_data["merchant_id"])

    # Check offer status
    if offer_data["status"] != OfferStatus.active.value:
        return RedeemResponse(
            success=False,
            message="This offer is no longer active",
        )

    # Check daily cap
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    redemptions_query = (
        db.collection(REDEMPTIONS)
        .where("offer_id", "==", token_data["offer_id"])
        .where("timestamp", ">=", today_start)
    )
    today_count = len(list(redemptions_query.stream()))

    if today_count >= offer_data["cap_daily"]:
        return RedeemResponse(
            success=False,
            message="Daily redemption limit reached for this offer",
        )

    # All checks passed - process redemption
    now = datetime.now(timezone.utc)
    value = offer_data.get("value_per_redemption", 2.0)

    # Mark token as redeemed
    mark_token_redeemed(token_id, data.location)

    # Create redemption record
    redemption_ref = db.collection(REDEMPTIONS).document()
    redemption_data = {
        "token_id": token_id,
        "offer_id": token_data["offer_id"],
        "merchant_id": offer_data["merchant_id"],
        "method": data.method.value,
        "location": data.location,
        "value": value,
        "timestamp": now,
    }
    redemption_ref.set(redemption_data)

    # Create ledger entry
    ledger_ref = db.collection(LEDGER).document()
    ledger_data = {
        "merchant_id": offer_data["merchant_id"],
        "redemption_id": redemption_ref.id,
        "offer_id": token_data["offer_id"],
        "amount": value,
        "created_at": now,
    }
    ledger_ref.set(ledger_data)

    return RedeemResponse(
        success=True,
        message="Redemption successful!",
        offer_name=offer_data["name"],
        discount_text=offer_data["discount_text"],
        redemption_id=redemption_ref.id,
    )


# --- Redemptions List ---

@app.get("/redemptions")
async def list_redemptions(
    merchant_id: Optional[str] = Query(None),
    offer_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List redemptions.

    Owner: sees all redemptions, can filter by merchant_id.
    Merchant admin/staff: sees only their merchant's redemptions.
    """
    db = get_db()
    query = db.collection(REDEMPTIONS)

    # Filter by merchant based on role
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    if role == "owner":
        if merchant_id:
            query = query.where("merchant_id", "==", merchant_id)
    elif user_merchant_id:
        query = query.where("merchant_id", "==", user_merchant_id)
    else:
        return {"redemptions": [], "limit": limit, "offset": offset}

    if offer_id:
        query = query.where("offer_id", "==", offer_id)

    query = query.order_by("timestamp", direction="DESCENDING").offset(offset).limit(limit)

    docs = query.stream()

    redemptions = []
    for doc in docs:
        data = doc.to_dict()
        redemptions.append({
            "id": doc.id,
            **data,
        })

    return {"redemptions": redemptions, "limit": limit, "offset": offset}


# --- Ledger (placeholder - will be expanded in Step 6) ---

@app.get("/ledger")
async def get_ledger(
    merchant_id: Optional[str] = Query(None),
    user=Depends(get_current_user),
):
    """Get ledger summary for a merchant.

    Owner: can view any merchant's ledger.
    Merchant admin/staff: can view their merchant's ledger.
    """
    db = get_db()

    # Determine which merchant to query
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    if role == "owner":
        target_merchant_id = merchant_id
    else:
        target_merchant_id = user_merchant_id

    if not target_merchant_id:
        return {"total_owed": 0, "redemption_count": 0, "entries": []}

    # Get all ledger entries for this merchant
    query = db.collection(LEDGER).where("merchant_id", "==", target_merchant_id)
    docs = query.stream()

    entries = []
    total = 0.0
    for doc in docs:
        data = doc.to_dict()
        entries.append({"id": doc.id, **data})
        total += data.get("amount", 0)

    return {
        "merchant_id": target_merchant_id,
        "total_owed": round(total, 2),
        "redemption_count": len(entries),
        "entries": entries,
    }


@app.get("/ledger/export")
async def export_ledger_csv(
    merchant_id: str = Query(...),
    user=Depends(get_current_user),
):
    """Export ledger as CSV for a merchant.

    Columns: date, offer_name, redemption_id, amount, location.
    """
    db = get_db()
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    # Access check
    if role == "owner":
        target_merchant_id = merchant_id
    elif user_merchant_id == merchant_id:
        target_merchant_id = merchant_id
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    # Fetch ledger entries
    query = db.collection(LEDGER).where("merchant_id", "==", target_merchant_id)
    ledger_docs = list(query.stream())

    # Build lookup for offer names and redemption locations
    offer_names: dict[str, str] = {}
    redemption_locations: dict[str, str] = {}

    for ldoc in ledger_docs:
        ld = ldoc.to_dict()
        oid = ld.get("offer_id")
        rid = ld.get("redemption_id")
        if oid and oid not in offer_names:
            offer_doc = db.collection(OFFERS).document(oid).get()
            if offer_doc.exists:
                offer_names[oid] = offer_doc.to_dict().get("name", "Unknown")
            else:
                offer_names[oid] = "Deleted Offer"
        if rid and rid not in redemption_locations:
            r_doc = db.collection(REDEMPTIONS).document(rid).get()
            if r_doc.exists:
                redemption_locations[rid] = r_doc.to_dict().get("location", "")
            else:
                redemption_locations[rid] = ""

    # Write CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "offer_name", "redemption_id", "amount", "location"])

    for ldoc in ledger_docs:
        ld = ldoc.to_dict()
        created_at = ld.get("created_at", "")
        if isinstance(created_at, datetime):
            created_at = created_at.strftime("%Y-%m-%d %H:%M:%S")
        writer.writerow([
            created_at,
            offer_names.get(ld.get("offer_id", ""), ""),
            ld.get("redemption_id", ""),
            ld.get("amount", 0),
            redemption_locations.get(ld.get("redemption_id", ""), ""),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=ledger_{target_merchant_id}.csv"},
    )


# --- User Management ---


@app.post("/admin/users", response_model=UserResponse)
async def create_user(data: UserCreate, user=Depends(get_current_user)):
    """Create or invite a user with a role.

    Owner only. If user exists in Firebase, claims are set immediately.
    If user doesn't exist, a pending role is created.
    """
    require_owner(user)

    db = get_db()
    now = datetime.now(timezone.utc)

    # Validate merchant_id required for non-owner roles
    if data.role != UserRole.owner and not data.merchant_id:
        raise HTTPException(
            status_code=400,
            detail="merchant_id is required for merchant_admin and staff roles",
        )

    # Verify merchant exists if provided
    if data.merchant_id:
        merchant_doc = db.collection(MERCHANTS).document(data.merchant_id).get()
        if not merchant_doc.exists:
            raise HTTPException(status_code=404, detail="Merchant not found")
        merchant_data = merchant_doc.to_dict()
        if merchant_data.get("status") == MerchantStatus.deleted.value:
            raise HTTPException(status_code=400, detail="Cannot assign users to deleted merchant")

    # Check if user already exists in Firebase
    firebase_user = get_user_by_email(data.email)

    if firebase_user:
        # User exists - set claims immediately
        set_user_claims(
            uid=firebase_user.uid,
            role=data.role.value,
            merchant_id=data.merchant_id,
        )

        # Create/update user record in Firestore
        user_ref = db.collection(USERS).document(firebase_user.uid)
        user_data = {
            "email": data.email,
            "role": data.role.value,
            "merchant_id": data.merchant_id,
            "is_primary": False,
            "status": UserStatus.active.value,
            "created_at": now,
            "created_by": user.get("uid"),
        }
        user_ref.set(user_data, merge=True)

        return UserResponse(
            email=data.email,
            status="claimed",
            user_id=firebase_user.uid,
        )
    else:
        # User doesn't exist - create pending role
        pending_ref = db.collection(PENDING_ROLES).document()
        pending_data = {
            "email": data.email,
            "role": data.role.value,
            "merchant_id": data.merchant_id,
            "created_by": user.get("uid"),
            "created_at": now,
            "expires_at": now + timedelta(days=7),
            "claimed": False,
        }
        pending_ref.set(pending_data)

        return UserResponse(
            email=data.email,
            status="pending",
            pending_id=pending_ref.id,
        )


@app.post("/auth/claim-role", response_model=ClaimRoleResponse)
async def claim_role(user=Depends(get_current_user)):
    """Claim a pending role for the authenticated user.

    Checks for pending roles matching the user's email and applies them.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    user_email = user.get("email")
    user_uid = user.get("uid")

    if not user_email:
        raise HTTPException(status_code=400, detail="User email not found")

    # Look for pending role for this email
    pending_query = (
        db.collection(PENDING_ROLES)
        .where("email", "==", user_email)
        .where("claimed", "==", False)
        .limit(1)
    )
    pending_docs = list(pending_query.stream())

    if not pending_docs:
        return ClaimRoleResponse(
            success=False,
            message="No pending role found for your email",
        )

    pending_doc = pending_docs[0]
    pending_data = pending_doc.to_dict()

    # Check if expired
    expires_at = pending_data["expires_at"]
    if isinstance(expires_at, datetime) and expires_at < now:
        return ClaimRoleResponse(
            success=False,
            message="Invite has expired",
        )

    # Apply claims
    role = pending_data["role"]
    merchant_id = pending_data.get("merchant_id")

    set_user_claims(
        uid=user_uid,
        role=role,
        merchant_id=merchant_id,
    )

    # Create user record in Firestore
    user_ref = db.collection(USERS).document(user_uid)
    user_data = {
        "email": user_email,
        "role": role,
        "merchant_id": merchant_id,
        "is_primary": False,
        "status": UserStatus.active.value,
        "created_at": now,
        "created_by": pending_data["created_by"],
    }
    user_ref.set(user_data)

    # Mark pending role as claimed
    pending_doc.reference.update({"claimed": True})

    return ClaimRoleResponse(
        success=True,
        message="Role claimed successfully",
        role=UserRole(role),
        merchant_id=merchant_id,
    )


@app.get("/admin/users")
async def list_users(
    merchant_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
):
    """List users.

    Owner: sees all users, can filter by merchant_id.
    Merchant admin: sees users for their merchant only.
    """
    db = get_db()
    role = user.get("role")
    user_merchant_id = get_merchant_id_from_user(user)

    if role == "owner":
        query = db.collection(USERS)
        if merchant_id:
            query = query.where("merchant_id", "==", merchant_id)
    elif role == "merchant_admin" and user_merchant_id:
        query = db.collection(USERS).where("merchant_id", "==", user_merchant_id)
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    query = query.offset(offset).limit(limit)
    docs = query.stream()
    users = []
    for doc in docs:
        data = doc.to_dict()
        users.append({"uid": doc.id, **data})

    # Also get pending roles
    pending_query = db.collection(PENDING_ROLES).where("claimed", "==", False)
    if role == "owner" and merchant_id:
        pending_query = pending_query.where("merchant_id", "==", merchant_id)
    elif role == "merchant_admin" and user_merchant_id:
        pending_query = pending_query.where("merchant_id", "==", user_merchant_id)

    pending_docs = pending_query.stream()
    pending = []
    for doc in pending_docs:
        data = doc.to_dict()
        pending.append({"id": doc.id, **data})

    return {"users": users, "pending": pending, "limit": limit, "offset": offset}


@app.delete("/admin/users/{uid}")
async def delete_user(uid: str, user=Depends(get_current_user)):
    """Delete (soft delete) a user.

    Owner: can delete any user except primary owner.
    Merchant admin: can delete staff for their merchant only.
    """
    db = get_db()

    # Get target user's current claims from Firestore
    target_doc = db.collection(USERS).document(uid).get()
    if not target_doc.exists:
        raise HTTPException(status_code=404, detail="User not found")

    target_data = target_doc.to_dict()

    # Check permission
    if not can_delete_user(user, uid, target_data):
        raise HTTPException(status_code=403, detail="Cannot delete this user")

    # Clear Firebase claims
    clear_user_claims(uid)

    # Mark user as deleted in Firestore
    target_doc.reference.update({
        "status": UserStatus.deleted.value,
        "role": None,
        "merchant_id": None,
    })

    return {"deleted": True, "uid": uid}


# --- Merchant Restore ---


@app.patch("/merchants/{merchant_id}/restore", response_model=Merchant)
async def restore_merchant(merchant_id: str, user=Depends(get_current_user)):
    """Restore a soft-deleted merchant.

    Owner only. Note: Does not restore orphaned users - they must be re-invited.
    """
    require_owner(user)

    db = get_db()
    doc_ref = db.collection(MERCHANTS).document(merchant_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")

    merchant_data = doc.to_dict()
    if merchant_data.get("status") != MerchantStatus.deleted.value:
        raise HTTPException(status_code=400, detail="Merchant is not deleted")

    doc_ref.update({
        "status": MerchantStatus.active.value,
        "deleted_at": None,
        "deleted_by": None,
    })

    updated = doc_ref.get()
    return Merchant(id=updated.id, **updated.to_dict())


@app.delete("/merchants/{merchant_id}")
async def delete_merchant(merchant_id: str, user=Depends(get_current_user)):
    """Soft delete a merchant.

    Owner only. Orphans all users associated with the merchant.
    """
    require_owner(user)

    db = get_db()
    now = datetime.now(timezone.utc)
    user_uid = user.get("uid")

    doc_ref = db.collection(MERCHANTS).document(merchant_id)
    doc = doc_ref.get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")

    merchant_data = doc.to_dict()
    if merchant_data.get("status") == MerchantStatus.deleted.value:
        raise HTTPException(status_code=400, detail="Merchant is already deleted")

    # Soft delete the merchant
    doc_ref.update({
        "status": MerchantStatus.deleted.value,
        "deleted_at": now,
        "deleted_by": user_uid,
    })

    # Orphan all users associated with this merchant
    orphaned_count = 0
    users_query = db.collection(USERS).where("merchant_id", "==", merchant_id)
    for user_doc in users_query.stream():
        user_data = user_doc.to_dict()

        # Clear their Firebase claims
        clear_user_claims(user_doc.id)

        # Mark as orphaned in Firestore
        user_doc.reference.update({
            "status": UserStatus.orphaned.value,
        })
        orphaned_count += 1

    # Pause all active offers for this merchant
    paused_offers = 0
    offers_query = db.collection(OFFERS).where("merchant_id", "==", merchant_id).where("status", "==", OfferStatus.active.value)
    for offer_doc in offers_query.stream():
        offer_doc.reference.update({
            "status": OfferStatus.paused.value,
            "updated_at": now,
        })
        paused_offers += 1

    # Expire all active tokens for this merchant's offers
    expired_tokens = 0
    all_offers_query = db.collection(OFFERS).where("merchant_id", "==", merchant_id)
    for offer_doc in all_offers_query.stream():
        tokens_query = db.collection(TOKENS).where("offer_id", "==", offer_doc.id).where("status", "==", TokenStatus.active.value)
        for token_doc in tokens_query.stream():
            token_doc.reference.update({
                "status": TokenStatus.expired.value,
            })
            expired_tokens += 1

    # Cancel pending_roles for this merchant (#9: bo-24h cascade)
    cancelled_pending = 0
    pending_query = db.collection(PENDING_ROLES).where("merchant_id", "==", merchant_id).where("claimed", "==", False)
    for pending_doc in pending_query.stream():
        pending_doc.reference.update({"claimed": True})
        cancelled_pending += 1

    return {
        "deleted": True,
        "id": merchant_id,
        "orphaned_users": orphaned_count,
        "paused_offers": paused_offers,
        "expired_tokens": expired_tokens,
        "cancelled_pending_roles": cancelled_pending,
    }
