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


def create_tokens(offer_id: str, count: int, expires_days: int = 30) -> list[dict]:
    """Generate multiple tokens for an offer.

    Args:
        offer_id: The offer these tokens are for
        count: Number of tokens to generate
        expires_days: Days until tokens expire

    Returns:
        List of created token dictionaries
    """
    db = get_db()

    # Verify offer exists
    offer_doc = db.collection(OFFERS).document(offer_id).get()
    if not offer_doc.exists:
        raise ValueError(f"Offer {offer_id} not found")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=expires_days)

    tokens = []
    batch = db.batch()

    for _ in range(count):
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
        }

        doc_ref = db.collection(TOKENS).document(token_id)
        batch.set(doc_ref, token_doc)

        tokens.append({
            "id": token_id,
            **token_doc,
        })

    batch.commit()
    return tokens


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
    """Mark a token as redeemed."""
    db = get_db()
    doc_ref = db.collection(TOKENS).document(token_id)
    doc_ref.update({
        "status": TokenStatus.redeemed.value,
        "redeemed_at": datetime.now(timezone.utc),
        "redeemed_by_location": location,
    })
