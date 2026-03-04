"""Tests for the customer list & segmentation endpoints."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from .conftest import (
    OWNER_USER,
    MERCHANT_ADMIN_USER,
    STAFF_USER,
    FakeDocSnapshot,
    FakeCollection,
    FakeQuery,
    build_mock_db,
)
from apps.api.app.deps import get_current_user
from apps.api.app.main import app
from fastapi.testclient import TestClient

MERCHANT_ID = "merchant-001"
NOW = datetime.now(timezone.utc)


def _visit_snap(consumer_id: str, merchant_id: str, offer_id: str, ts: datetime, visit_num: int = 1):
    return FakeDocSnapshot(
        f"visit-{consumer_id}-{visit_num}",
        {
            "consumer_id": consumer_id,
            "merchant_id": merchant_id,
            "offer_id": offer_id,
            "visit_number": visit_num,
            "points_earned": 50,
            "stamp_earned": True,
            "timestamp": ts,
        },
    )


def _consumer_snap(uid: str, name: str):
    return FakeDocSnapshot(uid, {"display_name": name, "email": f"{uid}@test.com", "global_points": 100})


# ---- Helpers to build collections with query filtering support ----


class FilterableCollection:
    """A collection that supports basic where-clause filtering for tests."""

    def __init__(self, docs: list[FakeDocSnapshot]):
        self._docs = docs
        self._filters: list[tuple] = []

    def document(self, doc_id: str | None = None):
        from .conftest import FakeDocRef

        if doc_id:
            for d in self._docs:
                if d.id == doc_id:
                    return FakeDocRef(doc_id, d)
        return FakeDocRef(doc_id or "auto", FakeDocSnapshot("none", exists=False))

    def where(self, field, op, value):
        new = FilterableCollection(self._docs)
        new._filters = self._filters + [(field, op, value)]
        return new

    def offset(self, n):
        return self

    def limit(self, n):
        return self

    def order_by(self, field, **kwargs):
        return self

    def stream(self):
        results = []
        for doc in self._docs:
            data = doc.to_dict()
            match = True
            for field, op, value in self._filters:
                v = data.get(field)
                if op == "==" and v != value:
                    match = False
                    break
            if match:
                results.append(doc)
        return iter(results)


def _build_db_with_visits(visits, consumers, loyalty_config=None, loyalty_progress=None):
    """Build a mock DB with visit + consumer data."""
    from unittest.mock import MagicMock

    db = MagicMock()
    _collections = {
        "consumer_visits": FilterableCollection(visits),
        "consumers": FakeCollection(consumers),
        "loyalty_configs": FakeCollection([loyalty_config] if loyalty_config else []),
        "loyalty_progress": FakeCollection(loyalty_progress or []),
        "offers": FakeCollection([
            FakeDocSnapshot("offer-1", {"name": "Coffee Deal", "merchant_id": MERCHANT_ID}),
        ]),
    }

    db.collection.side_effect = lambda name: _collections.get(name, FakeCollection())
    db.collections.return_value = []
    return db


# ---- Test: list customers ----


class TestListCustomers:
    def _client(self, user_dict, mock_db):
        app.dependency_overrides[get_current_user] = lambda: user_dict
        with patch("apps.api.app.customers.get_db", return_value=mock_db), \
             patch("apps.api.app.main.get_db", return_value=mock_db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client
        app.dependency_overrides.pop(get_current_user, None)

    def test_list_customers_empty(self):
        db = _build_db_with_visits([], [])
        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers")
            assert resp.status_code == 200
            data = resp.json()
            assert data["customers"] == []
            assert data["total"] == 0

    def test_list_customers_with_visits(self):
        visits = [
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=1), 1),
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=3), 2),
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=5), 3),
            _visit_snap("c2", MERCHANT_ID, "offer-1", NOW - timedelta(days=2), 1),
        ]
        consumers = [
            _consumer_snap("c1", "Sarah Miller"),
            _consumer_snap("c2", "James Kim"),
        ]
        db = _build_db_with_visits(visits, consumers)

        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers")
            assert resp.status_code == 200
            data = resp.json()
            assert data["total"] == 2

            # Check that names are masked
            names = [c["display_name"] for c in data["customers"]]
            assert "Sarah M." in names
            assert "James K." in names

            # Check segment counts exist
            assert "segment_counts" in data

    def test_list_customers_segment_filter(self):
        # c1: 6 visits = VIP, c2: 1 visit = new
        visits = [
            *[_visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=i), i + 1) for i in range(6)],
            _visit_snap("c2", MERCHANT_ID, "offer-1", NOW - timedelta(days=1), 1),
        ]
        consumers = [
            _consumer_snap("c1", "Sarah Miller"),
            _consumer_snap("c2", "James Kim"),
        ]
        db = _build_db_with_visits(visits, consumers)

        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers?segment=vip")
            assert resp.status_code == 200
            data = resp.json()
            # Only VIP customers
            for c in data["customers"]:
                assert c["segment"] == "vip"

    def test_list_customers_search(self):
        visits = [
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=1), 1),
            _visit_snap("c2", MERCHANT_ID, "offer-1", NOW - timedelta(days=2), 1),
        ]
        consumers = [
            _consumer_snap("c1", "Sarah Miller"),
            _consumer_snap("c2", "James Kim"),
        ]
        db = _build_db_with_visits(visits, consumers)

        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers?search=sarah")
            assert resp.status_code == 200
            data = resp.json()
            assert data["total"] == 1
            assert data["customers"][0]["display_name"] == "Sarah M."

    def test_list_customers_forbidden_wrong_merchant(self):
        db = _build_db_with_visits([], [])
        wrong_user = {**STAFF_USER, "merchant_id": "other-merchant"}
        for client in self._client(wrong_user, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers")
            assert resp.status_code == 403

    def test_list_customers_owner_any_merchant(self):
        visits = [
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=1), 1),
        ]
        consumers = [_consumer_snap("c1", "Sarah Miller")]
        db = _build_db_with_visits(visits, consumers)

        for client in self._client(OWNER_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers")
            assert resp.status_code == 200
            assert resp.json()["total"] == 1


# ---- Test: customer detail ----


class TestCustomerDetail:
    def _client(self, user_dict, mock_db):
        app.dependency_overrides[get_current_user] = lambda: user_dict
        with patch("apps.api.app.customers.get_db", return_value=mock_db), \
             patch("apps.api.app.main.get_db", return_value=mock_db):
            client = TestClient(app, raise_server_exceptions=False)
            yield client
        app.dependency_overrides.pop(get_current_user, None)

    def test_customer_detail_success(self):
        visits = [
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=1), 1),
            _visit_snap("c1", MERCHANT_ID, "offer-1", NOW - timedelta(days=5), 2),
        ]
        consumers = [_consumer_snap("c1", "Sarah Miller")]
        db = _build_db_with_visits(visits, consumers)

        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers/c1")
            assert resp.status_code == 200
            data = resp.json()
            assert data["display_name"] == "Sarah M."
            assert data["visit_count"] == 2
            assert data["estimated_ltv"] == 24.0
            assert len(data["visit_timeline"]) == 2

    def test_customer_detail_not_found(self):
        db = _build_db_with_visits([], [])
        for client in self._client(STAFF_USER, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers/nonexistent")
            assert resp.status_code == 404

    def test_customer_detail_forbidden(self):
        visits = [_visit_snap("c1", MERCHANT_ID, "offer-1", NOW, 1)]
        consumers = [_consumer_snap("c1", "Sarah Miller")]
        db = _build_db_with_visits(visits, consumers)
        wrong_user = {**STAFF_USER, "merchant_id": "other-merchant"}

        for client in self._client(wrong_user, db):
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/customers/c1")
            assert resp.status_code == 403


# ---- Test: name masking ----


class TestNameMasking:
    def test_mask_full_name(self):
        from apps.api.app.customers import _mask_name
        assert _mask_name("Sarah Miller") == "Sarah M."

    def test_mask_single_name(self):
        from apps.api.app.customers import _mask_name
        assert _mask_name("Sarah") == "Sarah"

    def test_mask_empty(self):
        from apps.api.app.customers import _mask_name
        assert _mask_name("") == "Unknown"
        assert _mask_name(None) == "Unknown"

    def test_mask_three_names(self):
        from apps.api.app.customers import _mask_name
        assert _mask_name("Sarah Jane Miller") == "Sarah M."


# ---- Test: segmentation logic ----


class TestSegmentation:
    def test_new_customer(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(1, NOW - timedelta(days=3))
        assert seg == CustomerSegment.new

    def test_returning_customer(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(3, NOW - timedelta(days=2))
        assert seg == CustomerSegment.returning

    def test_vip_by_visits(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(5, NOW - timedelta(days=1))
        assert seg == CustomerSegment.vip

    def test_vip_by_ltv(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(2, NOW - timedelta(days=1), is_top_10_ltv=True)
        assert seg == CustomerSegment.vip

    def test_at_risk_customer(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(3, NOW - timedelta(days=20))
        assert seg == CustomerSegment.at_risk

    def test_lost_customer(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(5, NOW - timedelta(days=35))
        assert seg == CustomerSegment.lost

    def test_no_last_visit(self):
        from apps.api.app.customers import _compute_segment, CustomerSegment
        seg = _compute_segment(0, None)
        assert seg == CustomerSegment.lost
