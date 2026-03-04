"""Tests for the AI insights endpoint."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app

from .conftest import (
    STAFF_USER,
    OWNER_USER,
    FakeDocSnapshot,
    FakeCollection,
    FakeDocRef,
    build_mock_db,
)

MERCHANT_ID = "merchant-001"


def _ts(days_ago: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days_ago)


def _visit(consumer_id: str, offer_id: str, ts: datetime) -> FakeDocSnapshot:
    return FakeDocSnapshot(
        doc_id=f"v-{consumer_id}-{ts.isoformat()}",
        data={
            "consumer_id": consumer_id,
            "merchant_id": MERCHANT_ID,
            "offer_id": offer_id,
            "timestamp": ts,
            "visit_number": 1,
            "points_earned": 50,
            "stamp_earned": False,
        },
    )


def _offer(offer_id: str, name: str) -> FakeDocSnapshot:
    now = datetime.now(timezone.utc)
    return FakeDocSnapshot(
        doc_id=offer_id,
        data={
            "merchant_id": MERCHANT_ID,
            "name": name,
            "discount_text": "$2 off",
            "terms": None,
            "cap_daily": 50,
            "active_hours": None,
            "status": "active",
            "value_per_redemption": 2.0,
            "created_at": now,
            "updated_at": now,
        },
    )


def _cache_doc(insights: list[str], hours_ago: int = 0) -> FakeDocSnapshot:
    """Build a cache document snapshot."""
    generated_at = datetime.now(timezone.utc) - timedelta(hours=hours_ago)
    return FakeDocSnapshot(
        doc_id=MERCHANT_ID,
        data={
            "insights": insights,
            "generated_at": generated_at,
        },
    )


class TestInsightsEndpoint:
    """Tests for GET /api/v1/merchants/{merchant_id}/insights."""

    def _make_client(self, offers_list, visits, cache_doc=None, user=STAFF_USER):
        # Build insight_cache collection with the cache_doc if provided
        cache_docs = [cache_doc] if cache_doc else []
        cache_collection = FakeCollection(docs=cache_docs)
        # The cache_collection.document(merchant_id).get() needs to work:
        # Our FakeCollection.document() matches by doc_id in docs list

        collections = {
            "offers": FakeCollection(docs=offers_list),
            "consumer_visits": FakeCollection(docs=visits),
            "insight_cache": cache_collection,
        }
        db = build_mock_db(collections)
        app.dependency_overrides[get_current_user] = lambda: user

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.analytics.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client

        app.dependency_overrides.pop(get_current_user, None)

    def test_empty_data_returns_fallback(self):
        """With no deals and no visits, should return a generic fallback insight."""
        for client in self._make_client([], []):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["insights"]) >= 1
            assert data["cached"] is False
            assert "generated_at" in data

    def test_rule_based_with_two_deals(self):
        """With two deals, should generate a comparison insight."""
        offers_list = [
            _offer("o1", "Coffee Deal"),
            _offer("o2", "Pastry Deal"),
        ]
        visits = [
            # Coffee Deal: c1 visits and returns -> 100% return rate
            _visit("c1", "o1", _ts(days_ago=20)),
            _visit("c1", "o1", _ts(days_ago=10)),
            # Pastry Deal: c2 visits but doesn't return -> 0% return rate
            _visit("c2", "o2", _ts(days_ago=20)),
        ]
        for client in self._make_client(offers_list, visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["insights"]) >= 1
            # Should mention the better deal
            insight_text = " ".join(data["insights"])
            assert "Coffee Deal" in insight_text or "return rate" in insight_text.lower()

    def test_single_deal_insight(self):
        """With one deal, should suggest adding a second deal."""
        offers_list = [_offer("o1", "Coffee Deal")]
        visits = [
            _visit("c1", "o1", _ts(days_ago=10)),
            _visit("c1", "o1", _ts(days_ago=5)),
        ]
        for client in self._make_client(offers_list, visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["insights"]) >= 1
            assert "second deal" in " ".join(data["insights"]).lower() or "Coffee Deal" in " ".join(data["insights"])

    def test_cached_insights_returned(self):
        """If cache exists and is fresh (<24h), return cached."""
        cached = _cache_doc(["Cached insight 1", "Cached insight 2"], hours_ago=2)
        for client in self._make_client([], [], cache_doc=cached):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert data["cached"] is True
            assert data["insights"] == ["Cached insight 1", "Cached insight 2"]

    def test_stale_cache_regenerates(self):
        """If cache is >24h old, should regenerate."""
        stale = _cache_doc(["Old insight"], hours_ago=25)
        for client in self._make_client([], [], cache_doc=stale):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert data["cached"] is False

    def test_auth_required(self):
        """Staff from another merchant should get 403."""
        other_staff = {**STAFF_USER, "merchant_id": "other-merchant"}
        for client in self._make_client([], [], user=other_staff):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 403

    def test_owner_can_access(self):
        """Owner should be able to access any merchant's insights."""
        for client in self._make_client([], [], user=OWNER_USER):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200

    def test_at_risk_segment_insight(self):
        """With many at-risk/lost customers, should flag the segment."""
        offers_list = [_offer("o1", "Coffee Deal")]
        # Create customers who visited >30 days ago (lost)
        visits = [
            _visit("c1", "o1", _ts(days_ago=40)),
            _visit("c2", "o1", _ts(days_ago=35)),
            _visit("c3", "o1", _ts(days_ago=45)),
        ]
        for client in self._make_client(offers_list, visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            insight_text = " ".join(data["insights"]).lower()
            # Should mention at-risk or re-engagement
            assert "at-risk" in insight_text or "lost" in insight_text or "re-engagement" in insight_text

    def test_response_schema(self):
        """Verify response matches InsightResponse schema."""
        for client in self._make_client([], []):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/insights")
            assert resp.status_code == 200
            data = resp.json()
            assert isinstance(data["insights"], list)
            assert isinstance(data["cached"], bool)
            assert "generated_at" in data
            # Max 2 insights
            assert len(data["insights"]) <= 2
