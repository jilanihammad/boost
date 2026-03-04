"""Tests for Zone / Neighborhood endpoints."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.main import app
from apps.api.app.zones import _haversine_miles, find_zone_for_location
from .conftest import (
    FakeDocSnapshot,
    FakeDocRef,
    FakeQuery,
    FakeCollection,
    build_mock_db,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

NOW = datetime(2025, 7, 1, 12, 0, 0, tzinfo=timezone.utc)

ZONE_CAPITOL_HILL = FakeDocSnapshot("zone-001", {
    "name": "Capitol Hill",
    "slug": "capitol-hill",
    "city": "Seattle",
    "center": {"lat": 47.6253, "lng": -122.3222},
    "radius_miles": 1.5,
    "status": "active",
    "created_at": NOW,
})

ZONE_FREMONT = FakeDocSnapshot("zone-002", {
    "name": "Fremont",
    "slug": "fremont",
    "city": "Seattle",
    "center": {"lat": 47.6510, "lng": -122.3505},
    "radius_miles": 1.0,
    "status": "active",
    "created_at": NOW,
})

MERCHANT_IN_ZONE = FakeDocSnapshot("merchant-z1", {
    "name": "Zone Coffee",
    "email": "zone@test.com",
    "locations": ["123 Pine St"],
    "status": "active",
    "zone_id": "zone-001",
    "created_at": NOW,
})

OFFER_IN_ZONE = FakeDocSnapshot("offer-z1", {
    "merchant_id": "merchant-z1",
    "name": "Half-off Latte",
    "discount_text": "50% off any latte",
    "terms": "One per customer",
    "status": "active",
    "cap_daily": 50,
    "value_per_redemption": 2.0,
    "created_at": NOW,
    "updated_at": NOW,
})


def _zone_collection(zone_docs):
    """Build a FakeCollection for zones with slug-based where filtering."""

    class ZoneCollection(FakeCollection):
        def where(self, field, op, value):
            if field == "slug":
                matching = [d for d in self._docs if d.to_dict().get("slug") == value]
                return FakeQuery(matching)
            if field == "status":
                matching = [d for d in self._docs if d.to_dict().get("status") == value]
                return FakeQuery(matching)
            return FakeQuery(self._docs)

    return ZoneCollection(zone_docs)


def _merchant_collection(merchant_docs):
    """Build a FakeCollection for merchants with zone_id filtering."""

    class MerchantCollection(FakeCollection):
        def __init__(self, docs):
            super().__init__(docs)
            self._filter_zone = None
            self._filter_status = None

        def where(self, field, op, value):
            clone = MerchantCollection(self._docs)
            if field == "zone_id":
                clone._filter_zone = value
            elif field == "status":
                clone._filter_status = value
            # Carry forward existing filters
            if self._filter_zone and field != "zone_id":
                clone._filter_zone = self._filter_zone
            if self._filter_status and field != "status":
                clone._filter_status = self._filter_status
            return clone

        def stream(self):
            result = self._docs
            if self._filter_zone:
                result = [d for d in result if d.to_dict().get("zone_id") == self._filter_zone]
            if self._filter_status:
                result = [d for d in result if d.to_dict().get("status") == self._filter_status]
            return iter(result)

        def limit(self, n):
            return self

        def offset(self, n):
            return self

    return MerchantCollection(merchant_docs)


def _offer_collection(offer_docs):
    """Build a FakeCollection for offers with merchant_id/status filtering."""

    class OfferCollection(FakeCollection):
        def __init__(self, docs):
            super().__init__(docs)
            self._filter_merchant = None
            self._filter_status = None

        def where(self, field, op, value):
            clone = OfferCollection(self._docs)
            if field == "merchant_id":
                clone._filter_merchant = value
            elif field == "status":
                clone._filter_status = value
            if self._filter_merchant and field != "merchant_id":
                clone._filter_merchant = self._filter_merchant
            if self._filter_status and field != "status":
                clone._filter_status = self._filter_status
            return clone

        def stream(self):
            result = self._docs
            if self._filter_merchant:
                result = [d for d in result if d.to_dict().get("merchant_id") == self._filter_merchant]
            if self._filter_status:
                result = [d for d in result if d.to_dict().get("status") == self._filter_status]
            return iter(result)

    return OfferCollection(offer_docs)


@pytest.fixture()
def zone_client():
    """TestClient with mocked DB containing zones, merchants, offers."""
    db = build_mock_db({
        "zones": _zone_collection([ZONE_CAPITOL_HILL, ZONE_FREMONT]),
        "merchants": _merchant_collection([MERCHANT_IN_ZONE]),
        "offers": _offer_collection([OFFER_IN_ZONE]),
        "redemptions": FakeCollection([]),
    })

    with patch("apps.api.app.zones.get_db", return_value=db), \
         patch("apps.api.app.main.get_db", return_value=db):
        yield TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Haversine unit tests
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_same_point_is_zero(self):
        assert _haversine_miles(47.6, -122.3, 47.6, -122.3) == 0.0

    def test_known_distance(self):
        # Capitol Hill to Fremont ~2.3 miles
        dist = _haversine_miles(47.6253, -122.3222, 47.6510, -122.3505)
        assert 1.5 < dist < 3.0  # rough sanity check

    def test_symmetry(self):
        d1 = _haversine_miles(47.6, -122.3, 47.7, -122.4)
        d2 = _haversine_miles(47.7, -122.4, 47.6, -122.3)
        assert abs(d1 - d2) < 0.001


# ---------------------------------------------------------------------------
# find_zone_for_location
# ---------------------------------------------------------------------------

class TestFindZone:
    def test_inside_zone(self):
        db = build_mock_db({
            "zones": _zone_collection([ZONE_CAPITOL_HILL]),
        })
        with patch("apps.api.app.zones.get_db", return_value=db):
            result = find_zone_for_location(47.6253, -122.3222)
            assert result == "zone-001"

    def test_outside_all_zones(self):
        db = build_mock_db({
            "zones": _zone_collection([ZONE_CAPITOL_HILL]),
        })
        with patch("apps.api.app.zones.get_db", return_value=db):
            # Somewhere far away
            result = find_zone_for_location(40.0, -74.0)
            assert result is None


# ---------------------------------------------------------------------------
# GET /api/v1/zones
# ---------------------------------------------------------------------------

class TestListZones:
    def test_returns_active_zones(self, zone_client):
        resp = zone_client.get("/api/v1/zones")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        slugs = {z["slug"] for z in data}
        assert "capitol-hill" in slugs
        assert "fremont" in slugs

    def test_zone_has_expected_fields(self, zone_client):
        resp = zone_client.get("/api/v1/zones")
        zone = resp.json()[0]
        assert "id" in zone
        assert "name" in zone
        assert "slug" in zone
        assert "city" in zone
        assert "center" in zone
        assert "lat" in zone["center"]
        assert "lng" in zone["center"]
        assert "merchant_count" in zone
        assert "deal_count" in zone


# ---------------------------------------------------------------------------
# GET /api/v1/zones/{slug}
# ---------------------------------------------------------------------------

class TestZoneDetail:
    def test_zone_detail_found(self, zone_client):
        resp = zone_client.get("/api/v1/zones/capitol-hill")
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Capitol Hill"
        assert data["slug"] == "capitol-hill"
        assert "merchants" in data

    def test_zone_detail_not_found(self, zone_client):
        resp = zone_client.get("/api/v1/zones/nonexistent")
        assert resp.status_code == 404

    def test_zone_detail_includes_merchants(self, zone_client):
        resp = zone_client.get("/api/v1/zones/capitol-hill")
        data = resp.json()
        # merchant-z1 is in zone-001 (capitol-hill)
        assert len(data["merchants"]) == 1
        m = data["merchants"][0]
        assert m["merchant_name"] == "Zone Coffee"
        assert len(m["active_deals"]) == 1
        assert m["active_deals"][0]["offer_name"] == "Half-off Latte"


# ---------------------------------------------------------------------------
# GET /api/v1/zones/{slug}/deals
# ---------------------------------------------------------------------------

class TestZoneDeals:
    def test_deals_list(self, zone_client):
        resp = zone_client.get("/api/v1/zones/capitol-hill/deals")
        assert resp.status_code == 200
        deals = resp.json()
        assert len(deals) == 1
        assert deals[0]["offer_name"] == "Half-off Latte"
        assert deals[0]["merchant_name"] == "Zone Coffee"

    def test_deals_not_found_zone(self, zone_client):
        resp = zone_client.get("/api/v1/zones/nonexistent/deals")
        assert resp.status_code == 404

    def test_empty_zone_returns_empty_deals(self, zone_client):
        # Fremont has no merchants with zone_id="zone-002"
        resp = zone_client.get("/api/v1/zones/fremont/deals")
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# Consumer zone assignment during registration
# ---------------------------------------------------------------------------

class TestConsumerZoneAssignment:
    def test_zone_assigned_on_register(self):
        """Consumer with lat/lng inside a zone gets home_zone_id set."""
        from apps.api.app.deps import get_current_user

        consumer_uid = "consumer-zone-test"
        user_dict = {"uid": consumer_uid, "email": "ztest@test.com", "role": "consumer"}
        app.dependency_overrides[get_current_user] = lambda: user_dict

        # Build mock DB
        consumer_snap = FakeDocSnapshot(consumer_uid, exists=False)
        consumer_ref = FakeDocRef(consumer_uid, consumer_snap)
        consumer_col = FakeCollection([], consumer_ref)

        db = build_mock_db({
            "consumers": consumer_col,
            "zones": _zone_collection([ZONE_CAPITOL_HILL]),
        })

        with patch("apps.api.app.consumer.get_db", return_value=db), \
             patch("apps.api.app.zones.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/consumer/register", json={
                "display_name": "Zone Tester",
                "lat": 47.6253,
                "lng": -122.3222,
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["home_zone_id"] == "zone-001"

        app.dependency_overrides.pop(get_current_user, None)

    def test_no_zone_when_outside(self):
        """Consumer far from any zone gets home_zone_id=null."""
        from apps.api.app.deps import get_current_user

        consumer_uid = "consumer-no-zone"
        user_dict = {"uid": consumer_uid, "email": "nz@test.com", "role": "consumer"}
        app.dependency_overrides[get_current_user] = lambda: user_dict

        consumer_snap = FakeDocSnapshot(consumer_uid, exists=False)
        consumer_ref = FakeDocRef(consumer_uid, consumer_snap)
        consumer_col = FakeCollection([], consumer_ref)

        db = build_mock_db({
            "consumers": consumer_col,
            "zones": _zone_collection([ZONE_CAPITOL_HILL]),
        })

        with patch("apps.api.app.consumer.get_db", return_value=db), \
             patch("apps.api.app.zones.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/consumer/register", json={
                "display_name": "Far Away",
                "lat": 40.0,
                "lng": -74.0,
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["home_zone_id"] is None

        app.dependency_overrides.pop(get_current_user, None)

    def test_no_zone_when_no_location(self):
        """Consumer without lat/lng gets home_zone_id=null."""
        from apps.api.app.deps import get_current_user

        consumer_uid = "consumer-no-loc"
        user_dict = {"uid": consumer_uid, "email": "nl@test.com", "role": "consumer"}
        app.dependency_overrides[get_current_user] = lambda: user_dict

        consumer_snap = FakeDocSnapshot(consumer_uid, exists=False)
        consumer_ref = FakeDocRef(consumer_uid, consumer_snap)
        consumer_col = FakeCollection([], consumer_ref)

        db = build_mock_db({
            "consumers": consumer_col,
        })

        with patch("apps.api.app.consumer.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/consumer/register", json={
                "display_name": "No Location",
            })
            assert resp.status_code == 200
            data = resp.json()
            assert data["home_zone_id"] is None

        app.dependency_overrides.pop(get_current_user, None)
