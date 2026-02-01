#!/usr/bin/env python3
"""Bootstrap first owner account (primary owner).

This script sets up the primary owner who cannot be deleted by other owners.
Run this once after initial deployment:

    GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json python scripts/bootstrap_owner.py

Or with the service account JSON inline:

    FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}' python scripts/bootstrap_owner.py
"""

import os
import sys
from datetime import datetime, timezone

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import _init_firebase_admin, set_user_claims, get_user_by_email
from app.db import get_db, USERS

# Primary owner email - this account cannot be deleted
OWNER_EMAIL = "jilanihammad@gmail.com"


def bootstrap():
    """Set up the primary owner account."""
    print(f"Bootstrapping primary owner: {OWNER_EMAIL}")

    # Initialize Firebase
    _init_firebase_admin()

    # Get Firebase user
    firebase_user = get_user_by_email(OWNER_EMAIL)
    if not firebase_user:
        print(f"ERROR: User {OWNER_EMAIL} not found in Firebase Auth.")
        print("Please sign up first, then run this script.")
        sys.exit(1)

    # Set custom claims (primary owner) - this is the critical part
    from firebase_admin import auth
    auth.set_custom_user_claims(firebase_user.uid, {
        "role": "owner",
        "is_primary": True,
    })

    print(f"SUCCESS: Set PRIMARY owner role for {OWNER_EMAIL}")
    print(f"  UID: {firebase_user.uid}")
    print("  This user cannot be deleted by other owners.")

    # Create/update user record in Firestore (optional, can fail if Firestore API not ready)
    try:
        db = get_db()
        user_ref = db.collection(USERS).document(firebase_user.uid)
        user_data = {
            "email": OWNER_EMAIL,
            "role": "owner",
            "merchant_id": None,
            "is_primary": True,
            "status": "active",
            "created_at": datetime.now(timezone.utc),
            "created_by": None,  # Self-bootstrapped
        }
        user_ref.set(user_data, merge=True)
        print("  User record created in Firestore.")
    except Exception as e:
        print(f"  WARNING: Could not create Firestore record: {e}")
        print("  The Firebase claims were set successfully. Firestore record will be created on first API call.")


if __name__ == "__main__":
    bootstrap()
