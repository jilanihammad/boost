"""AI Deal Copy Generation service.

Provides an endpoint for merchants to generate deal headlines,
descriptions, and terms using OpenAI (or hardcoded mocks when no API key).
"""

import logging
import os
from enum import Enum
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth import require_merchant_admin
from .db import get_db, MERCHANTS, OFFERS
from .deps import get_current_user

logger = logging.getLogger("boost.ai")

router = APIRouter(tags=["ai"])


# --- Models ---


class TemplateType(str, Enum):
    dollar_off = "dollar_off"
    free_item = "free_item"
    bogo = "bogo"
    happy_hour = "happy_hour"
    first_time = "first_time"
    custom = "custom"


class GenerateCopyRequest(BaseModel):
    merchant_id: str
    template_type: TemplateType


class DealSuggestion(BaseModel):
    headline: str
    description: str
    recommended_terms: str


class GenerateCopyResponse(BaseModel):
    suggestions: list[DealSuggestion]
    source: str = Field(description="'openai' or 'mock'")


# --- Mock suggestions by template type ---

MOCK_SUGGESTIONS: dict[str, list[dict]] = {
    "dollar_off": [
        {
            "headline": "$5 Off Your Next Order",
            "description": "Save $5 on any purchase of $15 or more. A great way to try something new!",
            "recommended_terms": "Minimum purchase $15. One per customer per day. Cannot be combined with other offers.",
        },
        {
            "headline": "Take $3 Off Any Item",
            "description": "Enjoy $3 off anything on the menu. No minimum purchase required!",
            "recommended_terms": "One per customer per visit. Valid during business hours only.",
        },
        {
            "headline": "$10 Off Your First Visit",
            "description": "Welcome! Get $10 off when you spend $25 or more on your first visit.",
            "recommended_terms": "First-time customers only. Minimum spend $25. Valid for 30 days.",
        },
    ],
    "free_item": [
        {
            "headline": "Free Coffee With Any Purchase",
            "description": "Get a complimentary regular coffee when you buy any food item.",
            "recommended_terms": "One per customer per day. Regular size only. While supplies last.",
        },
        {
            "headline": "Free Appetizer on Us",
            "description": "Enjoy a free appetizer with any entrée purchase. Perfect for sharing!",
            "recommended_terms": "Select appetizers only. One per table. Dine-in only.",
        },
        {
            "headline": "Free Dessert With Your Meal",
            "description": "End your meal on a sweet note — dessert is on the house!",
            "recommended_terms": "With purchase of entrée. Select desserts. One per customer.",
        },
    ],
    "bogo": [
        {
            "headline": "Buy One, Get One Free",
            "description": "Bring a friend! Buy any item and get a second one free.",
            "recommended_terms": "Equal or lesser value. One per customer per day. Cannot be combined with other offers.",
        },
        {
            "headline": "BOGO 50% Off",
            "description": "Buy one at full price, get the second at half off. Great for sharing!",
            "recommended_terms": "Second item equal or lesser value at 50% off. One per visit.",
        },
        {
            "headline": "Buy 2, Get 1 Free",
            "description": "Stock up! Buy any two items and get a third one on the house.",
            "recommended_terms": "Free item is lowest priced. One per customer. In-store only.",
        },
    ],
    "happy_hour": [
        {
            "headline": "Happy Hour: 30% Off Everything",
            "description": "Join us for happy hour! Everything on the menu is 30% off.",
            "recommended_terms": "Valid 3 PM – 6 PM only. Dine-in only. Cannot be combined with other offers.",
        },
        {
            "headline": "Half-Price Drinks After 4 PM",
            "description": "Wind down with 50% off all beverages during happy hour.",
            "recommended_terms": "Valid 4 PM – 7 PM. Dine-in only. Select beverages.",
        },
        {
            "headline": "$2 Off Happy Hour Specials",
            "description": "Enjoy $2 off our curated happy hour menu every weekday.",
            "recommended_terms": "Monday – Friday, 3 PM – 6 PM. Select items only.",
        },
    ],
    "first_time": [
        {
            "headline": "Welcome! 20% Off Your First Visit",
            "description": "New here? Enjoy 20% off your entire first order as our thank you!",
            "recommended_terms": "First-time customers only. One per person. Valid for 30 days.",
        },
        {
            "headline": "First Visit: Free Upgrade",
            "description": "Get a complimentary upgrade on your first purchase. Go big on us!",
            "recommended_terms": "New customers only. One free upgrade per person. Subject to availability.",
        },
        {
            "headline": "New Customer Special: $10 Off",
            "description": "First time? Save $10 on any order of $20 or more. Welcome to the family!",
            "recommended_terms": "First-time customers only. Minimum purchase $20. Cannot combine with other offers.",
        },
    ],
    "custom": [
        {
            "headline": "This Week's Special Deal",
            "description": "Don't miss our limited-time offer! Available this week only.",
            "recommended_terms": "While supplies last. One per customer per day. See store for details.",
        },
        {
            "headline": "Exclusive Member Offer",
            "description": "A special deal just for our loyal customers. Thank you for your support!",
            "recommended_terms": "Must be a registered member. One per customer. Valid for 7 days.",
        },
        {
            "headline": "Flash Deal — Today Only",
            "description": "Grab this deal before it's gone! Available today only.",
            "recommended_terms": "Valid today only. One per customer. In-store and online.",
        },
    ],
}


def _get_mock_suggestions(template_type: str, merchant_name: str) -> list[DealSuggestion]:
    """Return hardcoded mock suggestions, personalized with merchant name."""
    raw = MOCK_SUGGESTIONS.get(template_type, MOCK_SUGGESTIONS["custom"])
    suggestions = []
    for item in raw:
        suggestions.append(
            DealSuggestion(
                headline=item["headline"],
                description=item["description"].replace(
                    "our", f"{merchant_name}'s" if merchant_name else "our"
                ),
                recommended_terms=item["recommended_terms"],
            )
        )
    return suggestions


async def _generate_with_openai(
    api_key: str,
    merchant_name: str,
    merchant_category: Optional[str],
    template_type: str,
    existing_deals: list[str],
) -> list[DealSuggestion]:
    """Call OpenAI API to generate deal copy suggestions."""
    try:
        import openai

        client = openai.OpenAI(api_key=api_key)

        existing_str = ", ".join(existing_deals[:5]) if existing_deals else "none yet"

        prompt = f"""You are a marketing copywriter for local businesses. Generate 3 deal copy options for a {template_type.replace('_', ' ')} promotion.

Business: {merchant_name}
Category: {merchant_category or 'local business'}
Existing deals: {existing_str}

For each option, provide:
1. A catchy headline (max 60 chars)
2. A compelling description (1-2 sentences, max 150 chars)
3. Recommended terms and conditions (1-2 sentences)

Respond in this exact JSON format:
[
  {{"headline": "...", "description": "...", "recommended_terms": "..."}},
  {{"headline": "...", "description": "...", "recommended_terms": "..."}},
  {{"headline": "...", "description": "...", "recommended_terms": "..."}}
]

Only output the JSON array, nothing else."""

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.8,
            max_tokens=600,
        )

        import json

        content = response.choices[0].message.content.strip()
        parsed = json.loads(content)

        suggestions = []
        for item in parsed[:3]:
            suggestions.append(
                DealSuggestion(
                    headline=item.get("headline", "Special Deal"),
                    description=item.get("description", "A great deal for you!"),
                    recommended_terms=item.get("recommended_terms", "See store for details."),
                )
            )

        return suggestions

    except Exception as e:
        logger.warning("OpenAI call failed, falling back to mock: %s", e)
        return _get_mock_suggestions(template_type, merchant_name)


# --- Router ---


@router.post("/deals/generate-copy", response_model=GenerateCopyResponse)
async def generate_deal_copy(
    data: GenerateCopyRequest,
    user=Depends(get_current_user),
):
    """Generate AI-powered deal copy suggestions.

    Auth: merchant_admin (or owner).
    Returns 3 headline + description + terms suggestions.
    Falls back to mock suggestions if no OpenAI key is configured.
    """
    require_merchant_admin(user, data.merchant_id)

    db = get_db()

    # Fetch merchant profile
    merchant_doc = db.collection(MERCHANTS).document(data.merchant_id).get()
    if not merchant_doc.exists:
        raise HTTPException(status_code=404, detail="Merchant not found")

    merchant_data = merchant_doc.to_dict()
    merchant_name = merchant_data.get("name", "Local Business")
    merchant_category = merchant_data.get("category")  # may not exist yet

    # Fetch existing deal names for context
    existing_deals: list[str] = []
    try:
        offers_query = (
            db.collection(OFFERS)
            .where("merchant_id", "==", data.merchant_id)
            .limit(10)
        )
        for doc in offers_query.stream():
            offer_data = doc.to_dict()
            existing_deals.append(offer_data.get("name", ""))
    except Exception:
        pass  # non-critical

    # Check for OpenAI API key
    api_key = os.getenv("OPENAI_API_KEY")

    if api_key:
        suggestions = await _generate_with_openai(
            api_key=api_key,
            merchant_name=merchant_name,
            merchant_category=merchant_category,
            template_type=data.template_type.value,
            existing_deals=existing_deals,
        )
        source = "openai"
    else:
        suggestions = _get_mock_suggestions(data.template_type.value, merchant_name)
        source = "mock"

    return GenerateCopyResponse(suggestions=suggestions, source=source)
