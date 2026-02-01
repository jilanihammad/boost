"""Firebase authentication utilities and role management."""

import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

import firebase_admin
from fastapi import HTTPException
from firebase_admin import auth, credentials


@lru_cache(maxsize=1)
def _init_firebase_admin() -> None:
    """Initialize firebase_admin once (idempotent).

    Uses either GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.
    """

    if firebase_admin._apps:  # type: ignore[attr-defined]
        return

    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        data = json.loads(sa_json)
        cred = credentials.Certificate(data)
        firebase_admin.initialize_app(cred)
        return

    # Falls back to default credential discovery (GOOGLE_APPLICATION_CREDENTIALS).
    firebase_admin.initialize_app()


def verify_bearer_token(authorization: Optional[str]) -> Dict[str, Any]:
    """Verify Firebase ID token from Authorization header.

    Expects: Authorization: Bearer <token>
    Returns decoded claims.
    """

    _init_firebase_admin()

    if not authorization:
        raise ValueError("Missing Authorization header")

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise ValueError("Invalid Authorization header format")

    token = parts[1]
    decoded = auth.verify_id_token(token)
    return decoded


# --- Role Management ---


def set_user_claims(
    uid: str,
    role: str,
    merchant_id: Optional[str] = None,
    is_primary: bool = False,
) -> None:
    """Set Firebase custom claims for a user.

    Args:
        uid: Firebase user ID
        role: "owner" | "merchant_admin" | "staff"
        merchant_id: Required for merchant_admin and staff
        is_primary: True only for the primary owner (cannot be deleted)
    """
    _init_firebase_admin()

    claims: Dict[str, Any] = {"role": role}
    if merchant_id:
        claims["merchant_id"] = merchant_id
    if is_primary:
        claims["is_primary"] = True

    auth.set_custom_user_claims(uid, claims)


def clear_user_claims(uid: str) -> None:
    """Clear all custom claims for a user (used when orphaning)."""
    _init_firebase_admin()
    auth.set_custom_user_claims(uid, {})


def get_user_by_email(email: str) -> Optional[auth.UserRecord]:
    """Get Firebase user by email, or None if not found."""
    _init_firebase_admin()
    try:
        return auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        return None


# --- Role Check Helpers ---


def require_owner(user: Dict[str, Any]) -> None:
    """Raise 403 if user is not an owner."""
    if user.get("role") != "owner":
        raise HTTPException(status_code=403, detail="Owner access required")


def require_merchant_admin(user: Dict[str, Any], merchant_id: str) -> None:
    """Raise 403 if user cannot admin this merchant.

    Owners can admin any merchant.
    Merchant admins can only admin their own merchant.
    """
    role = user.get("role")
    if role == "owner":
        return
    if role == "merchant_admin" and user.get("merchant_id") == merchant_id:
        return
    raise HTTPException(status_code=403, detail="Merchant admin access required")


def require_staff_or_above(user: Dict[str, Any], merchant_id: str) -> None:
    """Raise 403 if user is not staff/merchant_admin for this merchant.

    Owners can access any merchant.
    Merchant admins and staff can only access their own merchant.
    """
    role = user.get("role")
    if role == "owner":
        return
    if role in ("merchant_admin", "staff") and user.get("merchant_id") == merchant_id:
        return
    raise HTTPException(status_code=403, detail="Access denied")


def can_delete_user(deleter: Dict[str, Any], target_uid: str, target_claims: Dict[str, Any]) -> bool:
    """Check if deleter can delete the target user.

    Rules:
    - Primary owner cannot be deleted by anyone
    - Owners can delete any non-primary user
    - Merchant admins can delete staff for their merchant only
    """
    # Primary owner is protected
    if target_claims.get("is_primary"):
        return False

    deleter_role = deleter.get("role")

    # Owners can delete anyone (except primary)
    if deleter_role == "owner":
        return True

    # Merchant admins can delete their own staff
    if deleter_role == "merchant_admin":
        target_role = target_claims.get("role")
        if target_role == "staff" and target_claims.get("merchant_id") == deleter.get("merchant_id"):
            return True

    return False
