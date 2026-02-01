"""Firestore database client."""

from functools import lru_cache

from firebase_admin import firestore

from .auth import _init_firebase_admin


@lru_cache(maxsize=1)
def get_db() -> firestore.client:
    """Get Firestore client (singleton).

    Reuses Firebase Admin initialization from auth module.
    """
    _init_firebase_admin()
    return firestore.client()


# Collection names
MERCHANTS = "merchants"
OFFERS = "offers"
TOKENS = "redemption_tokens"
REDEMPTIONS = "redemptions"
LEDGER = "ledger_entries"
USERS = "users"
PENDING_ROLES = "pending_roles"
