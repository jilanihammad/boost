"""Automations router: manage re-engagement message configs and run daily jobs."""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from .auth import require_merchant_admin
from .db import (
    get_db,
    AUTOMATED_MESSAGES,
    CONSUMERS,
    CONSUMER_VISITS,
    LOYALTY_CONFIGS,
    LOYALTY_PROGRESS,
    MERCHANTS,
)
from .deps import get_current_user
from .models import (
    AutomationConfigResponse,
    AutomationConfigUpdate,
    AutomationRule,
    AutomationTrigger,
)

logger = logging.getLogger("boost")

router = APIRouter(tags=["automations"])

# ---------------------------------------------------------------------------
# Default templates
# ---------------------------------------------------------------------------

DEFAULT_TEMPLATES = {
    AutomationTrigger.first_visit: (
        "Thanks for visiting {merchant_name}! You earned your first stamp. "
        "{stamps_remaining} more visits → {reward_description} 🎉"
    ),
    AutomationTrigger.at_risk: (
        "We miss you at {merchant_name}! Here's a deal waiting for you. "
        "Your stamp card: {current_stamps}/{stamps_required} — so close!"
    ),
    AutomationTrigger.reward_earned: (
        "🎉 You earned {reward_description} at {merchant_name}! "
        "Show this at the register. Valid for 30 days."
    ),
}


def _default_rules() -> list[dict]:
    """Return default automation rules (all disabled)."""
    return [
        {
            "trigger": t.value,
            "enabled": False,
            "message_template": DEFAULT_TEMPLATES[t],
            "at_risk_days": 14,
        }
        for t in AutomationTrigger
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _compute_send_at(now: datetime) -> datetime:
    """Compute send_at respecting quiet hours (9 AM – 9 PM UTC).

    If now is within quiet hours, returns now.
    Otherwise schedules for 9 AM next day (UTC).
    """
    if 9 <= now.hour < 21:
        return now
    # Schedule for 9 AM next day
    next_day = now + timedelta(days=1)
    return next_day.replace(hour=9, minute=0, second=0, microsecond=0)


def create_automated_message(
    db,
    merchant_id: str,
    consumer_id: str,
    trigger: str,
    message_body: str,
    consumer_phone: str | None = None,
) -> str | None:
    """Create an automated message record. Returns doc ID or None if skipped.

    Logs the message instead of actually sending SMS.
    Skips consumers without a phone number.
    Respects quiet hours.
    """
    if not consumer_phone:
        logger.info(
            "Skipping automated message for consumer %s (no phone number)", consumer_id
        )
        return None

    now = datetime.now(timezone.utc)
    send_at = _compute_send_at(now)

    doc_ref = db.collection(AUTOMATED_MESSAGES).document()
    doc_ref.set({
        "merchant_id": merchant_id,
        "consumer_id": consumer_id,
        "trigger": trigger,
        "channel": "sms",
        "message_body": message_body,
        "sent_at": send_at,
        "resulted_in_visit": False,
    })

    logger.info(
        'Would send SMS to %s: "%s" (trigger=%s, merchant=%s, scheduled=%s)',
        consumer_phone,
        message_body[:80],
        trigger,
        merchant_id,
        send_at.isoformat(),
    )

    return doc_ref.id


# ---------------------------------------------------------------------------
# GET /merchants/{merchant_id}/automations
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/automations",
    response_model=AutomationConfigResponse,
)
async def get_automations(merchant_id: str, user=Depends(get_current_user)):
    """Get automation config for a merchant.

    Auth: merchant_admin or owner.
    Returns default (all disabled) if not yet configured.
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    doc = db.collection(LOYALTY_CONFIGS).document(merchant_id).get()

    if doc.exists:
        data = doc.to_dict()
        rules_raw = data.get("automations", None)
        if rules_raw:
            rules = [AutomationRule(**r) for r in rules_raw]
        else:
            rules = [AutomationRule(**r) for r in _default_rules()]
    else:
        rules = [AutomationRule(**r) for r in _default_rules()]

    return AutomationConfigResponse(merchant_id=merchant_id, rules=rules)


# ---------------------------------------------------------------------------
# PUT /merchants/{merchant_id}/automations
# ---------------------------------------------------------------------------


@router.put(
    "/merchants/{merchant_id}/automations",
    response_model=AutomationConfigResponse,
)
async def update_automations(
    merchant_id: str,
    body: AutomationConfigUpdate,
    user=Depends(get_current_user),
):
    """Update automation config for a merchant.

    Auth: merchant_admin or owner.
    Stores rules in loyalty_configs.automations field.
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    doc_ref = db.collection(LOYALTY_CONFIGS).document(merchant_id)

    rules_data = [r.model_dump() for r in body.rules]
    doc_ref.set({"automations": rules_data}, merge=True)

    return AutomationConfigResponse(merchant_id=merchant_id, rules=body.rules)


# ---------------------------------------------------------------------------
# POST /automations/run-daily  — called by Cloud Scheduler
# ---------------------------------------------------------------------------


@router.post("/automations/run-daily")
async def run_daily_automations():
    """Run daily automation jobs (at_risk re-engagement messages).

    No auth (intended for Cloud Scheduler with a simple API key — for now, open).
    Idempotent: won't send duplicate messages if run twice in the same day.
    """
    db = get_db()
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    messages_queued = 0

    # Find all loyalty configs that have automations
    configs = list(db.collection(LOYALTY_CONFIGS).stream())

    for config_doc in configs:
        config_data = config_doc.to_dict()
        merchant_id = config_doc.id
        automations_raw = config_data.get("automations", [])

        if not automations_raw:
            continue

        # Find the at_risk rule
        at_risk_rule = None
        for rule in automations_raw:
            if rule.get("trigger") == "at_risk" and rule.get("enabled"):
                at_risk_rule = rule
                break

        if not at_risk_rule:
            continue

        at_risk_days = at_risk_rule.get("at_risk_days", 14)
        template = at_risk_rule.get("message_template", DEFAULT_TEMPLATES[AutomationTrigger.at_risk])

        # Get merchant name
        merchant_doc = db.collection(MERCHANTS).document(merchant_id).get()
        if not merchant_doc.exists:
            continue
        merchant_name = merchant_doc.to_dict().get("name", "Local Business")

        # Get stamps config for template placeholders
        stamps_required = config_data.get("stamps_required", 10)
        reward_description = config_data.get("reward_description", "a reward")

        # Find all visits for this merchant
        visits = list(
            db.collection(CONSUMER_VISITS)
            .where("merchant_id", "==", merchant_id)
            .stream()
        )

        # Group visits by consumer
        consumer_visits: dict[str, list[dict]] = {}
        for v in visits:
            vdata = v.to_dict()
            cid = vdata.get("consumer_id")
            if cid:
                consumer_visits.setdefault(cid, []).append(vdata)

        # Cutoff: last visit must be older than at_risk_days ago
        cutoff = now - timedelta(days=at_risk_days)
        # Don't re-send within 30 days
        thirty_days_ago = now - timedelta(days=30)

        for consumer_id, vlist in consumer_visits.items():
            # Must have 2+ visits
            if len(vlist) < 2:
                continue

            # Check last visit is older than cutoff
            timestamps = [
                v["timestamp"]
                for v in vlist
                if v.get("timestamp") is not None
            ]
            if not timestamps:
                continue

            last_visit = max(timestamps)
            if last_visit > cutoff:
                continue  # Still active, not at risk

            # Check: no at_risk message in the last 30 days
            recent_messages = list(
                db.collection(AUTOMATED_MESSAGES)
                .where("merchant_id", "==", merchant_id)
                .where("consumer_id", "==", consumer_id)
                .where("trigger", "==", "at_risk")
                .where("sent_at", ">=", thirty_days_ago)
                .stream()
            )
            if recent_messages:
                continue  # Already messaged recently

            # Also check: no message today (idempotency)
            today_messages = list(
                db.collection(AUTOMATED_MESSAGES)
                .where("merchant_id", "==", merchant_id)
                .where("consumer_id", "==", consumer_id)
                .where("trigger", "==", "at_risk")
                .where("sent_at", ">=", today_start)
                .stream()
            )
            if today_messages:
                continue  # Already created today

            # Get consumer phone
            consumer_doc = db.collection(CONSUMERS).document(consumer_id).get()
            if not consumer_doc.exists:
                continue
            consumer_data = consumer_doc.to_dict()
            phone = consumer_data.get("phone")

            if not phone:
                continue  # Skip consumers without phone

            # Get loyalty progress for template
            progress_id = f"{consumer_id}_{merchant_id}"
            progress_doc = db.collection(LOYALTY_PROGRESS).document(progress_id).get()
            current_stamps = 0
            if progress_doc.exists:
                current_stamps = progress_doc.to_dict().get("current_stamps", 0)

            # Fill template
            message_body = template.format(
                merchant_name=merchant_name,
                customer_name=consumer_data.get("display_name", "there"),
                reward_description=reward_description,
                current_stamps=current_stamps,
                stamps_required=stamps_required,
                stamps_remaining=max(0, stamps_required - current_stamps),
            )

            msg_id = create_automated_message(
                db=db,
                merchant_id=merchant_id,
                consumer_id=consumer_id,
                trigger="at_risk",
                message_body=message_body,
                consumer_phone=phone,
            )

            if msg_id:
                messages_queued += 1

    return {"messages_queued": messages_queued}
