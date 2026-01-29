import os

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .deps import get_current_user

load_dotenv()

app = FastAPI(title="Boost API (v0)")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"ok": True}


# ---- Stub endpoints (auth required) ----


@app.get("/offers")
async def list_offers(user=Depends(get_current_user)):
    return {"offers": [], "user": {"uid": user.get("uid")}}


@app.post("/claim")
async def claim_offer(payload: dict, user=Depends(get_current_user)):
    # payload could include offer_id, merchant_id, etc.
    return {"status": "stub", "action": "claim", "payload": payload, "uid": user.get("uid")}


@app.post("/redeem")
async def redeem(payload: dict, user=Depends(get_current_user)):
    return {"status": "stub", "action": "redeem", "payload": payload, "uid": user.get("uid")}


@app.get("/ledger")
async def ledger(user=Depends(get_current_user)):
    return {"ledger": [], "uid": user.get("uid")}
