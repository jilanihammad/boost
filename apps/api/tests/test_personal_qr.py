"""Tests for personal QR codes — claim flow, HMAC signing, and personal redemption."""

import time
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.consumer import sign_personal_qr, verify_personal_qr, parse_personal_qr
from apps.api.app.deps import get_current_user, get_current_consumer
from apps.api.app.main import app

from .conftest import (
    OWNER_USER,
    STAFF_USER,
    FakeCollection,
    FakeDocRef,
    FakeDocSnapshot,
    FakeQuery,
    build_mock_db,
)

NOW = datetime.now(timezone.utc)

CONSUMER_USER = {
    "uid": "consumer-uid-001",
    "email": "shopper@test.com",
    "role": "consumer",
}

CONSUMER_PROFILE = {
    "email": "shopper@test.com",
    "phone": None,
    "display_name": "Test Shopper",
    "home_zone_id": None,
    "location_verified_at": None,
    "zip_code": "90210",
    "lat": None,
    "lng": None,
    "tier": "free",
    "global_points": 0,
    "referral_code": "ABCD1234",
    "referred_by": None,
    "created_at": NOW,
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

MERCHANT_DATA = {
    "name": "Test Coffee",
    "email": "coffee@test.com",
    "locations": ["Main St"],
    "status": "active",
    "created_at": NOW,
    "deleted_at": None,
    "deleted_by": None,
}


@pytest.fixture(autouse=True)
def _cleanup_overrides():
    # Reset rate limiter to avoid cross-test 429s
    from apps.api.app.main import limiter
    limiter.reset()
    yield
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_current_consumer, None)


def _set_consumer():
    app.dependency_overrides[get_current_user] = lambda: CONSUMER_USER
    app.dependency_overrides[get_current_consumer] = lambda: CONSUMER_USER


def _set_staff():
    app.dependency_overrides[get_current_user] = lambda: STAFF_USER


def _client():
    return TestClient(app, raise_server_exceptions=False)


# =====================================================================
# HMAC Signing
# =====================================================================


class TestHMACSigning:
    """Test HMAC generation and verification for personal QR codes."""

    def test_sign_and_verify(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        assert isinstance(sig, str)
        assert len(sig) == 16  # truncated hex
        assert verify_personal_qr("uid-1", "offer-1", ts, sig)

    def test_wrong_uid_fails(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        assert not verify_personal_qr("uid-2", "offer-1", ts, sig)

    def test_wrong_offer_fails(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        assert not verify_personal_qr("uid-1", "offer-2", ts, sig)

    def test_wrong_timestamp_fails(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        assert not verify_personal_qr("uid-1", "offer-1", ts + 1, sig)

    def test_tampered_signature_fails(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        assert not verify_personal_qr("uid-1", "offer-1", ts, "0000000000000000")


class TestParsePersonalQR:
    """Test parsing of the boost://claim/... URI format."""

    def test_valid_qr(self):
        ts = int(time.time())
        sig = sign_personal_qr("uid-1", "offer-1", ts)
        qr = f"boost://claim/uid-1/offer-1/{ts}/{sig}"
        result = parse_personal_qr(qr)
        assert result is not None
        assert result["consumer_uid"] == "uid-1"
        assert result["offer_id"] == "offer-1"
        assert result["timestamp"] == ts

    def test_non_personal_qr_returns_none(self):
        assert parse_personal_qr("https://boost.app/r/some-token-id") is None

    def test_bad_format_returns_none(self):
        assert parse_personal_qr("boost://claim/only-two-parts/missing") is None

    def test_tampered_hmac_returns_none(self):
        ts = int(time.time())
        qr = f"boost://claim/uid-1/offer-1/{ts}/badhmacsignature"
        assert parse_personal_qr(qr) is None

    def test_non_numeric_timestamp_returns_none(self):
        qr = "boost://claim/uid-1/offer-1/notanumber/abcdef1234567890"
        assert parse_personal_qr(qr) is None


# =====================================================================
# Consumer Claim Endpoint
# =====================================================================


class TestConsumerClaim:
    """POST /api/v1/consumer/claim/{offer_id}"""

    def _make_claim_db(self, existing_claims=None, today_redemptions=0):
        """Build a mock DB for the claim endpoint."""
        consumer_snap = FakeDocSnapshot("consumer-uid-001", CONSUMER_PROFILE)
        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        merchant_snap = FakeDocSnapshot("merchant-001", MERCHANT_DATA)

        redemption_snaps = [
            FakeDocSnapshot(f"r-{i}", {"offer_id": "offer-001", "timestamp": NOW})
            for i in range(today_redemptions)
        ]
        claim_snaps = existing_claims or []

        claim_ref = FakeDocRef("claim-new")

        def _collection(name):
            if name == "consumers":
                return FakeCollection(docs=[consumer_snap])
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "merchants":
                return FakeCollection(docs=[merchant_snap])
            if name == "redemptions":
                return FakeCollection(docs=redemption_snaps)
            if name == "consumer_claims":
                return FakeCollection(docs=claim_snaps, doc_ref=claim_ref)
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection
        return db

    def test_claim_success(self):
        _set_consumer()
        db = self._make_claim_db()

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/offer-001")
            assert resp.status_code == 200
            body = resp.json()
            assert "qr_data" in body
            assert body["qr_data"].startswith("boost://claim/")
            assert len(body["short_code"]) == 6
            assert body["offer_name"] == "Free Latte"
            assert body["merchant_name"] == "Test Coffee"
            assert body["points_preview"] == 50
            assert "expires_at" in body

    def test_claim_offer_not_found(self):
        _set_consumer()
        consumer_snap = FakeDocSnapshot("consumer-uid-001", CONSUMER_PROFILE)

        def _collection(name):
            if name == "consumers":
                return FakeCollection(docs=[consumer_snap])
            if name == "offers":
                return FakeCollection(docs=[])  # no offers
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/nonexistent")
            assert resp.status_code == 404

    def test_claim_inactive_offer(self):
        _set_consumer()
        consumer_snap = FakeDocSnapshot("consumer-uid-001", CONSUMER_PROFILE)
        inactive_offer = {**OFFER_DATA, "status": "paused"}
        offer_snap = FakeDocSnapshot("offer-001", inactive_offer)

        def _collection(name):
            if name == "consumers":
                return FakeCollection(docs=[consumer_snap])
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/offer-001")
            assert resp.status_code == 410

    def test_claim_daily_cap_reached(self):
        _set_consumer()
        db = self._make_claim_db(today_redemptions=50)  # cap_daily is 50

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/offer-001")
            assert resp.status_code == 429

    def test_claim_idempotent_returns_existing(self):
        """Second claim same day returns the existing claim."""
        _set_consumer()
        existing_claim = FakeDocSnapshot("claim-existing", {
            "consumer_uid": "consumer-uid-001",
            "offer_id": "offer-001",
            "qr_data": "boost://claim/consumer-uid-001/offer-001/12345/abc",
            "short_code": "EXIST1",
            "expires_at": NOW.replace(hour=23, minute=59, second=59),
            "offer_name": "Free Latte",
            "merchant_name": "Test Coffee",
            "points_preview": 50,
            "claimed_at": NOW,
            "redeemed": False,
        })
        db = self._make_claim_db(existing_claims=[existing_claim])

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/offer-001")
            assert resp.status_code == 200
            body = resp.json()
            assert body["short_code"] == "EXIST1"

    def test_claim_no_consumer_profile(self):
        """Consumer without profile gets 404."""
        _set_consumer()

        def _collection(name):
            if name == "consumers":
                return FakeCollection(docs=[])  # no consumer profile
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.consumer.get_db", return_value=db):
            resp = _client().post("/api/v1/consumer/claim/offer-001")
            assert resp.status_code == 404
            assert "profile" in resp.json()["detail"].lower()


# =====================================================================
# Personal QR Redemption
# =====================================================================


class TestPersonalQRRedemption:
    """POST /redeem with personal QR data (boost://claim/...)."""

    def _make_personal_redeem_db(self, today_redemptions=0, existing_consumer_redemptions=0, visits=0):
        """Build a mock DB for personal QR redemption flow."""
        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        consumer_snap = FakeDocSnapshot("consumer-uid-001", CONSUMER_PROFILE)

        redemption_snaps = [
            FakeDocSnapshot(f"r-{i}", {"offer_id": "offer-001", "timestamp": NOW})
            for i in range(today_redemptions)
        ]

        consumer_redemption_snaps = [
            FakeDocSnapshot(f"cr-{i}", {
                "consumer_id": "consumer-uid-001",
                "offer_id": "offer-001",
                "timestamp": NOW,
            })
            for i in range(existing_consumer_redemptions)
        ]

        visit_snaps = [
            FakeDocSnapshot(f"v-{i}", {
                "consumer_id": "consumer-uid-001",
                "merchant_id": "merchant-001",
            })
            for i in range(visits)
        ]

        visit_ref = FakeDocRef("visit-new")
        redemption_ref = FakeDocRef("redemption-new")
        ledger_ref = FakeDocRef("ledger-new")
        claim_snap = FakeDocSnapshot("claim-1", {
            "consumer_uid": "consumer-uid-001",
            "offer_id": "offer-001",
            "claimed_at": NOW,
            "redeemed": False,
        })
        claim_snap.reference = MagicMock()

        # Track which where-chain invocation we're on
        redemption_where_call = {"n": 0}

        class SmartRedemptionCollection:
            """Mimics redemptions collection with two different query paths."""

            def document(self, doc_id=None):
                return redemption_ref

            def where(self, field, *args, **kwargs):
                redemption_where_call["n"] += 1
                if field == "consumer_id":
                    # Consumer-specific query
                    return FakeQuery(consumer_redemption_snaps)
                else:
                    # Daily cap query (offer_id)
                    return FakeQuery(redemption_snaps)

            def stream(self):
                return iter(redemption_snaps)

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "consumers":
                return FakeCollection(docs=[consumer_snap])
            if name == "redemptions":
                return SmartRedemptionCollection()
            if name == "consumer_visits":
                return FakeCollection(docs=visit_snaps, doc_ref=visit_ref)
            if name == "consumer_claims":
                return FakeCollection(docs=[claim_snap])
            if name == "ledger_entries":
                return FakeCollection(docs=[], doc_ref=ledger_ref)
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection
        return db

    def _make_qr(self, consumer_uid="consumer-uid-001", offer_id="offer-001", ts=None):
        """Generate a valid personal QR string."""
        ts = ts or int(NOW.timestamp())
        sig = sign_personal_qr(consumer_uid, offer_id, ts)
        return f"boost://claim/{consumer_uid}/{offer_id}/{ts}/{sig}"

    def test_personal_qr_redeem_success(self):
        _set_staff()
        db = self._make_personal_redeem_db()
        qr = self._make_qr()

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            assert body["consumer_name"] == "Test Shopper"
            assert body["visit_number"] == 1
            assert body["offer_name"] == "Free Latte"

    def test_personal_qr_visit_number_increments(self):
        """Visit number should be previous_visits + 1."""
        _set_staff()
        db = self._make_personal_redeem_db(visits=3)
        qr = self._make_qr()

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            assert resp.json()["visit_number"] == 4

    def test_personal_qr_already_redeemed_today(self):
        """Same consumer, same offer, same day — should reject."""
        _set_staff()
        db = self._make_personal_redeem_db(existing_consumer_redemptions=1)
        qr = self._make_qr()

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "already been redeemed" in body["message"].lower()

    def test_personal_qr_daily_cap_reached(self):
        _set_staff()
        db = self._make_personal_redeem_db(today_redemptions=50)
        qr = self._make_qr()

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "limit" in body["message"].lower() or "cap" in body["message"].lower()

    def test_personal_qr_expired(self):
        """A personal QR from yesterday should be rejected."""
        _set_staff()
        yesterday_ts = int((NOW - timedelta(days=2)).timestamp())
        qr = self._make_qr(ts=yesterday_ts)

        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.main.get_db", return_value=db):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "expired" in body["message"].lower()

    def test_tampered_qr_rejected(self):
        """Tampered HMAC should fail."""
        _set_staff()
        ts = int(NOW.timestamp())
        qr = f"boost://claim/consumer-uid-001/offer-001/{ts}/0000000000000000"

        # parse_personal_qr returns None for bad HMAC, so it falls through
        # to universal token lookup which won't find it
        with patch("apps.api.app.main.get_db") as mock_db, \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=None):
            resp = _client().post("/redeem", json={
                "token": qr,
                "location": "Main St",
                "method": "scan",
            })
            assert resp.status_code == 404

    def test_universal_token_still_works(self):
        """Universal tokens should still work alongside personal QR."""
        from .conftest import OWNER_USER
        app.dependency_overrides[get_current_user] = lambda: OWNER_USER

        token_data = {
            "offer_id": "offer-001",
            "short_code": "ABC123",
            "qr_data": "https://boost.test/r/token-001",
            "status": "active",
            "expires_at": NOW + timedelta(days=30),
            "is_universal": True,
            "last_redeemed_at": None,
            "last_redeemed_by_location": None,
        }

        offer_snap = FakeDocSnapshot("offer-001", OFFER_DATA)
        redemption_ref = FakeDocRef("redemption-new")
        ledger_ref = FakeDocRef("ledger-new")

        def _collection(name):
            if name == "offers":
                return FakeCollection(docs=[offer_snap])
            if name == "redemptions":
                return FakeCollection(docs=[], doc_ref=redemption_ref)
            if name == "ledger_entries":
                return FakeCollection(docs=[], doc_ref=ledger_ref)
            return FakeCollection()

        db = MagicMock()
        db.collection.side_effect = _collection

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.main.get_token_by_id_or_code", return_value=("token-001", token_data)), \
             patch("apps.api.app.main.mark_token_redeemed"):
            resp = _client().post("/redeem", json={
                "token": "ABC123",
                "location": "Main St",
                "method": "manual",
            })
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is True
            # Universal tokens don't have consumer context
            assert body.get("consumer_name") is None
            assert body.get("visit_number") is None
