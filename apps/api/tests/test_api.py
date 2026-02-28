"""Boost API tests — auth, merchants, offers, tokens, redemption, ledger, health."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app

from .conftest import (
    MERCHANT_ADMIN_USER,
    OWNER_USER,
    STAFF_USER,
    FakeCollection,
    FakeDocRef,
    FakeDocSnapshot,
    FakeQuery,
    build_mock_db,
)


# =====================================================================
# Helpers
# =====================================================================

NOW = datetime.now(timezone.utc)
MERCHANT_DATA = {
    "name": "Test Coffee",
    "email": "coffee@test.com",
    "locations": ["Main St"],
    "status": "active",
    "created_at": NOW,
    "deleted_at": None,
    "deleted_by": None,
}

OFFER_DATA = {
    "merchant_id": "merchant-001",
    "name": "Free Latte",
    "discount_text": "$2 off any coffee",
    "terms": "One per customer",
    "cap_daily": 50,
    "active_hours": "9am-5pm",
    "value_per_redemption": 2.0,
    "status": "active",
    "created_at": NOW,
    "updated_at": NOW,
}

TOKEN_DATA = {
    "offer_id": "offer-001",
    "short_code": "ABC123",
    "qr_data": "https://boost.test/r/token-001",
    "status": "active",
    "expires_at": NOW + timedelta(days=30),
    "redeemed_at": None,
    "redeemed_by_location": None,
    "created_at": NOW,
    "is_universal": True,
    "last_redeemed_at": None,
    "last_redeemed_by_location": None,
}


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    """Clean up dependency overrides after every test."""
    yield
    app.dependency_overrides.pop(get_current_user, None)


def _set_user(user_dict):
    """Override the auth dependency to return the given user."""
    app.dependency_overrides[get_current_user] = lambda: user_dict


def _client():
    return TestClient(app, raise_server_exceptions=False)


# =====================================================================
# Auth
# =====================================================================


class TestAuth:
    """Requests without / with invalid bearer token must get 401."""

    def test_no_token_returns_401(self, unauth_client: TestClient):
        resp = unauth_client.get("/merchants")
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, unauth_client: TestClient):
        resp = unauth_client.get(
            "/merchants",
            headers={"Authorization": "Bearer totally-bogus"},
        )
        assert resp.status_code == 401

    def test_malformed_header_returns_401(self, unauth_client: TestClient):
        resp = unauth_client.get(
            "/merchants",
            headers={"Authorization": "NotBearer xyz"},
        )
        assert resp.status_code == 401


# =====================================================================
# Health Check
# =====================================================================


class TestHealthCheck:

    def test_health_ok(self):
        fake_db = MagicMock()
        fake_db.collections.return_value = []
        with patch("apps.api.app.main.get_db", return_value=fake_db):
            resp = _client().get("/health")
            assert resp.status_code == 200
            body = resp.json()
            assert body["ok"] is True

    def test_health_error(self):
        fake_db = MagicMock()
        fake_db.collections.side_effect = Exception("boom")
        with patch("apps.api.app.main.get_db", return_value=fake_db):
            resp = _client().get("/health")
            body = resp.json()
            assert body["ok"] is False
            assert "boom" in body.get("error", "")


# =====================================================================
# Merchants
# =====================================================================


class TestMerchants:

    def test_create_merchant_owner(self):
        """Owner can create a merchant."""
        _set_user(OWNER_USER)
        doc_ref = FakeDocRef("new-merchant-id")
        mock_col = MagicMock()
        mock_col.document.return_value = doc_ref
        db = MagicMock()
        db.collection.return_value = mock_col

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/merchants", json={
                "name": "Test Coffee",
                "email": "coffee@test.com",
                "locations": ["Main St"],
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["name"] == "Test Coffee"
            assert body["id"] == "new-merchant-id"

    def test_create_merchant_staff_forbidden(self):
        """Staff cannot create a merchant (owner only)."""
        _set_user(STAFF_USER)
        db = build_mock_db()
        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/merchants", json={
                "name": "Nope",
                "email": "nope@test.com",
            })
            assert resp.status_code == 403

    def test_list_merchants_owner(self):
        """Owner sees all merchants."""
        _set_user(OWNER_USER)
        merchant_snap = FakeDocSnapshot("m-1", MERCHANT_DATA)
        cols = {"merchants": FakeCollection(docs=[merchant_snap])}
        db = build_mock_db(cols)

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/merchants")
            assert resp.status_code == 200
            body = resp.json()
            assert len(body["merchants"]) == 1
            assert body["merchants"][0]["id"] == "m-1"

    def test_get_merchant(self):
        """Owner can get a specific merchant."""
        _set_user(OWNER_USER)
        merchant_snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)
        cols = {"merchants": FakeCollection(docs=[merchant_snap])}
        db = build_mock_db(cols)

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/merchants/merchant-001")
            assert resp.status_code == 200
            assert resp.json()["name"] == "Test Coffee"

    def test_update_merchant(self):
        """Owner can update a merchant."""
        _set_user(OWNER_USER)
        snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)
        updated_data = {**MERCHANT_DATA, "name": "Updated Coffee"}
        updated_snap = FakeDocSnapshot("merchant-001", updated_data)

        doc_ref = FakeDocRef("merchant-001", snap)
        doc_ref.get = MagicMock(side_effect=[snap, updated_snap])

        col = MagicMock()
        col.document.return_value = doc_ref
        db = build_mock_db({"merchants": col})

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().patch("/merchants/merchant-001", json={"name": "Updated Coffee"})
            assert resp.status_code == 200
            assert resp.json()["name"] == "Updated Coffee"

    def test_delete_merchant_owner(self):
        """Owner can soft-delete a merchant."""
        _set_user(OWNER_USER)
        snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)
        doc_ref = FakeDocRef("merchant-001", snap)

        col = MagicMock()
        col.document.return_value = doc_ref

        # For cascading queries (users, offers, tokens, pending_roles)
        empty_query = MagicMock()
        empty_query.where = MagicMock(return_value=empty_query)
        empty_query.stream = MagicMock(return_value=iter([]))

        def _collection(name):
            if name == "merchants":
                return col
            return empty_query

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.clear_user_claims"):
            resp = _client().delete("/merchants/merchant-001")
            assert resp.status_code == 200
            body = resp.json()
            assert body["deleted"] is True

    def test_delete_merchant_admin_forbidden(self):
        """Merchant admin cannot delete a merchant (owner only)."""
        _set_user(MERCHANT_ADMIN_USER)
        snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)
        doc_ref = FakeDocRef("merchant-001", snap)
        col = MagicMock()
        col.document.return_value = doc_ref
        db = build_mock_db({"merchants": col})

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().delete("/merchants/merchant-001")
            assert resp.status_code == 403


# =====================================================================
# Offers
# =====================================================================


class TestOffers:

    def _make_db_with_merchant_and_offers(self, offer_snaps=None):
        """Build a mock DB containing a merchant and optional offers."""
        merchant_snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)
        offer_snaps = offer_snaps or []

        # Redemptions collection (empty by default for count queries)
        redemptions_col = FakeCollection(docs=[])

        def _collection(name):
            if name == "merchants":
                return FakeCollection(docs=[merchant_snap])
            if name == "offers":
                return FakeCollection(docs=offer_snaps, doc_ref=FakeDocRef("new-offer-id"))
            if name == "redemptions":
                return redemptions_col
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection
        return db

    def test_create_offer(self):
        _set_user(OWNER_USER)
        db = self._make_db_with_merchant_and_offers()
        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/offers", json={
                "merchant_id": "merchant-001",
                "name": "Free Latte",
                "discount_text": "$2 off any coffee",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["name"] == "Free Latte"
            assert body["status"] == "active"

    def test_list_offers_with_pagination(self):
        _set_user(OWNER_USER)
        snaps = [
            FakeDocSnapshot(f"offer-{i}", {**OFFER_DATA, "name": f"Offer {i}"})
            for i in range(3)
        ]
        db = self._make_db_with_merchant_and_offers(snaps)
        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/offers?limit=2&offset=0")
            assert resp.status_code == 200
            body = resp.json()
            assert "offers" in body
            assert body["limit"] == 2

    def test_get_single_offer(self):
        _set_user(OWNER_USER)
        snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        db = self._make_db_with_merchant_and_offers([snap])
        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/offers/offer-001")
            assert resp.status_code == 200
            assert resp.json()["name"] == "Free Latte"


# =====================================================================
# Tokens
# =====================================================================


class TestTokens:

    def test_generate_tokens(self):
        _set_user(OWNER_USER)
        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        merchant_snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "merchants":
                return FakeCollection(docs=[merchant_snap])
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        fake_tokens = [{
            "id": "token-abc",
            "offer_id": "offer-001",
            "short_code": "XYZ789",
            "status": "active",
        }]

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.create_tokens", return_value=fake_tokens):
            resp = _client().post("/offers/offer-001/tokens", json={
                "count": 1,
                "expires_days": 30,
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["offer_id"] == "offer-001"
            assert len(body["tokens"]) == 1

    def test_list_tokens(self):
        _set_user(OWNER_USER)
        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        token_snap = FakeDocSnapshot("token-001", TOKEN_DATA)

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "redemption_tokens":
                return FakeCollection(docs=[token_snap])
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/offers/offer-001/tokens")
            assert resp.status_code == 200
            body = resp.json()
            assert body["offer_id"] == "offer-001"
            assert "tokens" in body


# =====================================================================
# Redemption
# =====================================================================


class TestRedemption:

    def _make_redeem_db(self, token_data=None, offer_data=None, today_redemptions=0):
        """Build a mock DB wired for the /redeem flow."""
        token_data = token_data or TOKEN_DATA
        offer_data = offer_data or OFFER_DATA

        offer_snap = FakeDocSnapshot("offer-001", offer_data)
        token_snap = FakeDocSnapshot("token-001", token_data)

        # Redemption docs for daily cap checking
        redemption_snaps = [
            FakeDocSnapshot(f"r-{i}", {"offer_id": "offer-001", "timestamp": NOW})
            for i in range(today_redemptions)
        ]

        redemption_ref = FakeDocRef("redemption-new")
        ledger_ref = FakeDocRef("ledger-new")

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "redemption_tokens":
                return FakeCollection(docs=[token_snap])
            if name == "redemptions":
                return FakeCollection(docs=redemption_snaps, doc_ref=redemption_ref)
            if name == "ledger_entries":
                return FakeCollection(docs=[], doc_ref=ledger_ref)
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection
        return db

    def test_redeem_token_success(self):
        _set_user(OWNER_USER)
        db = self._make_redeem_db()
        fake_result = ("token-001", TOKEN_DATA)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=fake_result), \
             patch("apps.api.app.main.mark_token_redeemed"):
            resp = _client().post("/redeem", json={
                "token": "ABC123",
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            assert "Redemption successful" in body["message"]

    def test_daily_cap_enforcement(self):
        """When daily cap is reached, redemption should fail."""
        _set_user(OWNER_USER)
        offer_at_cap = {**OFFER_DATA, "cap_daily": 2}
        db = self._make_redeem_db(offer_data=offer_at_cap, today_redemptions=2)
        fake_result = ("token-001", TOKEN_DATA)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=fake_result), \
             patch("apps.api.app.main.mark_token_redeemed"):
            resp = _client().post("/redeem", json={
                "token": "ABC123",
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "limit" in body["message"].lower() or "cap" in body["message"].lower()

    def test_expired_token_rejected(self):
        """Expired tokens should be rejected."""
        _set_user(OWNER_USER)
        expired_token = {**TOKEN_DATA, "status": "expired"}
        db = self._make_redeem_db(token_data=expired_token)
        fake_result = ("token-001", expired_token)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=fake_result), \
             patch("apps.api.app.main.mark_token_redeemed"):
            resp = _client().post("/redeem", json={
                "token": "EXPIRED1",
                "location": "Main St",
                "method": "manual",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "expired" in body["message"].lower()

    def test_token_not_found(self):
        """Unknown token returns 404."""
        _set_user(OWNER_USER)
        db = self._make_redeem_db()
        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=None):
            resp = _client().post("/redeem", json={
                "token": "NONEXISTENT",
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 404


# =====================================================================
# Ledger CSV Export
# =====================================================================


class TestLedgerExport:

    def test_csv_export_content_type(self):
        """GET /ledger/export should return text/csv."""
        _set_user(OWNER_USER)
        ledger_snap = FakeDocSnapshot("le-1", {
            "merchant_id": "merchant-001",
            "redemption_id": "r-1",
            "offer_id": "offer-001",
            "amount": 2.0,
            "created_at": NOW,
        })

        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        redemption_snap = FakeDocSnapshot("r-1", {
            "location": "Main St",
            "offer_id": "offer-001",
            "timestamp": NOW,
        })

        def _collection(name):
            if name == "ledger_entries":
                return FakeCollection(docs=[ledger_snap])
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "redemptions":
                return FakeCollection(docs=[redemption_snap])
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/ledger/export?merchant_id=merchant-001")
            assert resp.status_code == 200
            assert "text/csv" in resp.headers.get("content-type", "")
            # Verify CSV has header row
            assert "date" in resp.text
            assert "offer_name" in resp.text

    def test_csv_export_access_denied_for_wrong_merchant(self):
        """Merchant admin cannot export another merchant's ledger."""
        _set_user(MERCHANT_ADMIN_USER)
        db = build_mock_db()

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().get("/ledger/export?merchant_id=other-merchant")
            assert resp.status_code == 403
