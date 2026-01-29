from typing import Any, Dict

from fastapi import Header, HTTPException

from .auth import verify_bearer_token


async def get_current_user(authorization: str | None = Header(default=None)) -> Dict[str, Any]:
    try:
        return verify_bearer_token(authorization)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
