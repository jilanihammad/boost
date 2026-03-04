"""Tests for the analytics endpoints (retention, deals, LTV)."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app

from .conftest import (
    STAFF_USER,
    MERCHANT_ADMIN_USER,
    OWNER_USER,
    FakeDocSnapshot,
    FakeCollection,
    FakeQuery,
    build_mock_db,
)

MERCHANT_ID = "merchant-001"


def _ts(days_ago: int = 0, weeks_ago: int = 0) -> datetime:
    """Return a UTC datetime offset from now."""
    return datetime.now(timezone.utc) - timedelta(days=days_ago, weeks=weeks_ago)


def _visit(consumer_id: str, offer_id: str, ts: datetime, merchant_id: str = MERCHANT_ID) -> FakeDocSnapshot:
    return FakeDocSnapshot(
        doc_id=f"v-{consumer_id}-{ts.isoformat()}",
        data={
            "consumer_id": consumer_id,
            "merchant_id": merchant_id,
            "offer_id": offer_id,
            "timestamp": ts,
            "visit_number": 1,
            "points_earned": 50,
            "stamp_earned": False,
        },
    )


def _offer(offer_id: str, name: str, merchant_id: str = MERCHANT_ID, status: str = "active") -> FakeDocSnapshot:
    now = datetime.now(timezone.utc)
    return FakeDocSnapshot(
        doc_id=offer_id,
        data={
            "merchant_id": merchant_id,
            "name": name,
            "discount_text": "$2 off",
            "terms": None,
            "cap_daily": 50,
            "active_hours": None,
            "status": status,
            "value_per_redemption": 2.0,
            "created_at": now,
            "updated_at": now,
        },
    )


# ---------------------------------------------------------------------------
# Test: Retention cohorts
# ---------------------------------------------------------------------------


class TestRetentionEndpoint:
    def _make_client(self, visits, user=STAFF_USER):
        collections = {
            "consumer_visits": FakeCollection(docs=visits),
        }
        db = build_mock_db(collections)
        app.dependency_overrides[get_current_user] = lambda: user

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.analytics.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client

        app.dependency_overrides.pop(get_current_user, None)

    def test_empty_visits(self):
        for client in self._make_client([]):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/retention")
            assert resp.status_code == 200
            data = resp.json()
            assert data["cohorts"] == []

    def test_single_cohort(self):
        visits = [
            _visit("c1", "o1", _ts(days_ago=14)),
            _visit("c1", "o1", _ts(days_ago=7)),  # return in week 1
            _visit("c2", "o1", _ts(days_ago=14)),  # no return
        ]
        for client in self._make_client(visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/retention")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["cohorts"]) >= 1

    def test_auth_required(self):
        other_merchant_staff = {
            **STAFF_USER,
            "merchant_id": "other-merchant",
        }
        for client in self._make_client([], user=other_merchant_staff):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/retention")
            assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Test: Deal performance
# ---------------------------------------------------------------------------


class TestDealPerformanceEndpoint:
    def _make_client(self, offers_list, visits, user=STAFF_USER):
        collections = {
            "offers": FakeCollection(docs=offers_list),
            "consumer_visits": FakeCollection(docs=visits),
        }
        db = build_mock_db(collections)
        app.dependency_overrides[get_current_user] = lambda: user

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.analytics.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client

        app.dependency_overrides.pop(get_current_user, None)

    def test_empty(self):
        for client in self._make_client([], []):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/deals")
            assert resp.status_code == 200
            data = resp.json()
            assert data["deals"] == []

    def test_with_data(self):
        offer = _offer("o1", "Coffee Deal")
        visits = [
            _visit("c1", "o1", _ts(days_ago=20)),
            _visit("c1", "o1", _ts(days_ago=10)),  # return within 14d
            _visit("c2", "o1", _ts(days_ago=20)),  # no return
        ]
        for client in self._make_client([offer], visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/deals")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["deals"]) == 1
            deal = data["deals"][0]
            assert deal["offer_name"] == "Coffee Deal"
            assert deal["redemption_count"] == 3  # 3 visits for this offer


# ---------------------------------------------------------------------------
# Test: LTV distribution
# ---------------------------------------------------------------------------


class TestLtvEndpoint:
    def _make_client(self, visits, user=STAFF_USER):
        collections = {
            "consumer_visits": FakeCollection(docs=visits),
        }
        db = build_mock_db(collections)
        app.dependency_overrides[get_current_user] = lambda: user

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.analytics.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client

        app.dependency_overrides.pop(get_current_user, None)

    def test_empty(self):
        for client in self._make_client([]):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/ltv")
            assert resp.status_code == 200
            data = resp.json()
            assert len(data["buckets"]) == 5
            assert all(b["count"] == 0 for b in data["buckets"])

    def test_single_visit_consumer(self):
        visits = [_visit("c1", "o1", _ts(days_ago=5))]
        for client in self._make_client(visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/ltv")
            assert resp.status_code == 200
            data = resp.json()
            # 1 visit * $12 = $12 -> $10-30 bucket
            buckets_map = {b["bucket_label"]: b["count"] for b in data["buckets"]}
            assert buckets_map["$10–30"] == 1

    def test_multiple_consumers(self):
        visits = [
            _visit("c1", "o1", _ts(days_ago=5)),
            _visit("c1", "o1", _ts(days_ago=4)),
            _visit("c1", "o1", _ts(days_ago=3)),  # c1: 3 visits * $12 = $36 -> $30-60
            _visit("c2", "o1", _ts(days_ago=5)),  # c2: 1 visit * $12 = $12 -> $10-30
        ]
        for client in self._make_client(visits):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/analytics/ltv")
            assert resp.status_code == 200
            data = resp.json()
            buckets_map = {b["bucket_label"]: b["count"] for b in data["buckets"]}
            assert buckets_map["$30–60"] == 1
            assert buckets_map["$10–30"] == 1
