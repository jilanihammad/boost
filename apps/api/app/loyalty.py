"""Loyalty program endpoints: config management and reward redemption."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from .auth import require_merchant_admin, require_staff_or_above
from .db import get_db, LOYALTY_CONFIGS, LOYALTY_PROGRESS, REWARDS
from .deps import get_current_user
from .models import LoyaltyConfig, LoyaltyConfigCreate, RewardResponse, RewardStatus

router = APIRouter(tags=["loyalty"])


# ---------------------------------------------------------------------------
# GET  /merchants/{merchant_id}/loyalty  — read config
# ---------------------------------------------------------------------------


@router.get("/merchants/{merchant_id}/loyalty", response_model=LoyaltyConfig)
async def get_loyalty_config(merchant_id: str, user=Depends(get_current_user)):
    """Get the loyalty stamp-card config for a merchant.

    Auth: merchant_admin or staff for this merchant (or owner).
    """
    require_staff_or_above(user, merchant_id)

    db = get_db()
    doc = db.collection(LOYALTY_CONFIGS).document(merchant_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Loyalty program not configured for this merchant")

    data = doc.to_dict()
    return LoyaltyConfig(merchant_id=merchant_id, **data)


# ---------------------------------------------------------------------------
# PUT  /merchants/{merchant_id}/loyalty  — create / update config
# ---------------------------------------------------------------------------


@router.put("/merchants/{merchant_id}/loyalty", response_model=LoyaltyConfig)
async def upsert_loyalty_config(
    merchant_id: str,
    body: LoyaltyConfigCreate,
    user=Depends(get_current_user),
):
    """Create or update the loyalty config for a merchant.

    Auth: merchant_admin (or owner).
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    doc_ref = db.collection(LOYALTY_CONFIGS).document(merchant_id)

    config_data = {
        "program_type": "stamps",
        "stamps_required": body.stamps_required,
        "reward_description": body.reward_description,
        "reward_value": body.reward_value,
        "reset_on_reward": body.reset_on_reward,
        "double_stamp_days": body.double_stamp_days,
        "birthday_reward": body.birthday_reward,
    }
    doc_ref.set(config_data, merge=True)

    return LoyaltyConfig(merchant_id=merchant_id, **config_data)


# ---------------------------------------------------------------------------
# POST /rewards/{reward_id}/redeem  — staff redeems an earned reward
# ---------------------------------------------------------------------------


@router.post("/rewards/{reward_id}/redeem", response_model=RewardResponse)
async def redeem_reward(reward_id: str, user=Depends(get_current_user)):
    """Redeem an earned reward at the register.

    Auth: staff_or_above for the reward's merchant.
    Checks that the reward status is "earned", then marks it "redeemed".
    """
    db = get_db()

    reward_doc = db.collection(REWARDS).document(reward_id).get()
    if not reward_doc.exists:
        raise HTTPException(status_code=404, detail="Reward not found")

    reward_data = reward_doc.to_dict()

    # Auth: staff must belong to the reward's merchant
    require_staff_or_above(user, reward_data["merchant_id"])

    if reward_data.get("status") != RewardStatus.earned.value:
        raise HTTPException(
            status_code=400,
            detail=f"Reward cannot be redeemed (current status: {reward_data.get('status')})",
        )

    now = datetime.now(timezone.utc)
    reward_doc.reference.update({
        "status": RewardStatus.redeemed.value,
        "redeemed_at": now,
    })

    # Update loyalty_progress: increment rewards_redeemed
    consumer_id = reward_data["consumer_id"]
    merchant_id = reward_data["merchant_id"]
    progress_id = f"{consumer_id}_{merchant_id}"
    progress_ref = db.collection(LOYALTY_PROGRESS).document(progress_id)
    progress_doc = progress_ref.get()
    if progress_doc.exists:
        progress_data = progress_doc.to_dict()
        progress_ref.update({
            "rewards_redeemed": progress_data.get("rewards_redeemed", 0) + 1,
        })

    return RewardResponse(
        id=reward_id,
        consumer_id=consumer_id,
        merchant_id=merchant_id,
        description=reward_data.get("description", ""),
        status=RewardStatus.redeemed,
        earned_at=reward_data["earned_at"],
        redeemed_at=now,
        expires_at=reward_data.get("expires_at"),
    )
