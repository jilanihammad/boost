from typing import Any, Dict

from fastapi import Header, HTTPException

from .auth import verify_bearer_token


async def get_current_user(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    """Get the current authenticated user from the Authorization header.

    Works for both merchant users (with custom claims) and consumer users
    (who may not have custom claims set yet).
    """
    try:
        decoded = verify_bearer_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    # If no role claim exists, treat as consumer.
    # Consumer tokens from Firebase Auth won't have custom claims initially.
    if "role" not in decoded:
        decoded["role"] = "consumer"

    return decoded


async def get_current_consumer(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    """Get the current authenticated consumer user.

    Raises 403 if the user is not a consumer.
    """
    user = await get_current_user(authorization)
    if user.get("role") != "consumer":
        raise HTTPException(status_code=403, detail="Consumer access required")
    return user
