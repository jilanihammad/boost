import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional

import firebase_admin
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
