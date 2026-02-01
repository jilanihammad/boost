"""Token generation and QR code utilities."""

import io
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

import qrcode
from qrcode.image.pure import PyPNGImage

from .db import get_db, TOKENS, OFFERS
from .models import TokenStatus


def generate_short_code(length: int = 6) -> str:
    """Generate a human-readable short code (uppercase letters + digits, no ambiguous chars)."""
    # Exclude ambiguous characters: 0, O, I, L, 1
    chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(random.choices(chars, k=length))


def generate_token_id() -> str:
    """Generate a unique token ID."""
    return str(uuid.uuid4())


def create_qr_data(token_id: str, base_url: str = "https://boost-dev-3fabf.web.app") -> str:
    """Create QR code data payload.

    Format: URL that can be scanned directly.
    """
    return f"{base_url}/r/{token_id}"


def generate_qr_image(data: str) -> bytes:
    """Generate QR code image as PNG bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(image_factory=PyPNGImage)

    buffer = io.BytesIO()
    img.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def create_tokens(offer_id: str, count: int = 1, expires_days: int = 30) -> list[dict]:
    """Generate or update the universal token for an offer.

    Creates a single reusable token per offer. If a token already exists,
    updates its expiry date instead of creating a new one.

    Args:
        offer_id: The offer this token is for
        count: Ignored (kept for API compatibility) - always creates 1 token
        expires_days: Days until token expires

    Returns:
        List containing the single universal token
    """
    db = get_db()

    # Verify offer exists
    offer_doc = db.collection(OFFERS).document(offer_id).get()
    if not offer_doc.exists:
        raise ValueError(f"Offer {offer_id} not found")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    # Check if universal token already exists for this offer
    existing_query = db.collection(TOKENS).where("offer_id", "==", offer_id).limit(1)
    existing_tokens = list(existing_query.stream())

    if existing_tokens:
        # Update existing token's expiry
        existing_doc = existing_tokens[0]
        existing_doc.reference.update({
            "expires_at": expires_at,
            "status": TokenStatus.active.value,  # Ensure it's active
            "is_universal": True,
        })

        token_data = existing_doc.to_dict()
        token_data["expires_at"] = expires_at
        token_data["status"] = TokenStatus.active.value
        token_data["is_universal"] = True

        return [{
            "id": existing_doc.id,
            **token_data,
        }]

    # Create new universal token
    token_id = generate_token_id()
    short_code = generate_short_code()
    qr_data = create_qr_data(token_id)

    token_doc = {
        "offer_id": offer_id,
        "short_code": short_code,
        "qr_data": qr_data,
        "status": TokenStatus.active.value,
        "expires_at": expires_at,
        "redeemed_at": None,
        "redeemed_by_location": None,
        "created_at": now,
        "is_universal": True,
        "last_redeemed_at": None,
        "last_redeemed_by_location": None,
    }

    doc_ref = db.collection(TOKENS).document(token_id)
    doc_ref.set(token_doc)

    return [{
        "id": token_id,
        **token_doc,
    }]


def get_token_by_id_or_code(token_input: str) -> tuple[str, dict] | None:
    """Look up token by ID or short code.

    Args:
        token_input: Either a full token ID (UUID) or short code

    Returns:
        Tuple of (token_id, token_data) or None if not found
    """
    db = get_db()

    # Try as direct ID first (UUIDs are 36 chars with hyphens)
    if len(token_input) == 36 and "-" in token_input:
        doc = db.collection(TOKENS).document(token_input).get()
        if doc.exists:
            return doc.id, doc.to_dict()

    # Try as short code
    query = db.collection(TOKENS).where("short_code", "==", token_input.upper()).limit(1)
    docs = list(query.stream())
    if docs:
        return docs[0].id, docs[0].to_dict()

    return None


def mark_token_redeemed(token_id: str, location: str) -> None:
    """Mark a token as redeemed (or track last use for universal tokens)."""
    db = get_db()
    doc_ref = db.collection(TOKENS).document(token_id)
    doc = doc_ref.get()

    if not doc.exists:
        return

    token_data = doc.to_dict()
    now = datetime.now(timezone.utc)

    # Universal tokens stay active - only track last redemption
    if token_data.get("is_universal", False):
        doc_ref.update({
            "last_redeemed_at": now,
            "last_redeemed_by_location": location,
        })
    else:
        # Legacy single-use tokens
        doc_ref.update({
            "status": TokenStatus.redeemed.value,
            "redeemed_at": now,
            "redeemed_by_location": location,
        })
