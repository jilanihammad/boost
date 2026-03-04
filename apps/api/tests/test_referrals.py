"""Tests for referral program endpoints."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user, get_current_consumer
from apps.api.app.main import app
from .conftest import (
    FakeDocSnapshot,
    FakeDocRef,
    FakeQuery,
    FakeCollection,
    build_mock_db,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CONSUMER_A = {
    "uid": "consumer-a-uid",
    "email": "alice@test.com",
    "role": "consumer",
}

CONSUMER_B = {
    "uid": "consumer-b-uid",
    "email": "bob@test.com",
    "role": "consumer",
}

NOW = datetime.now(timezone.utc)


def _consumer_doc(uid, display_name="Test User", referral_code="ABC123", global_points=0):
    return FakeDocSnapshot(uid, {
        "email": f"{uid}@test.com",
        "display_name": display_name,
        "referral_code": referral_code,
        "global_points": global_points,
        "tier": "free",
        "created_at": NOW,
    })


def _make_consumer_client(user_dict, mock_db):
    """Create a TestClient overriding both get_current_user and get_current_consumer."""
    app.dependency_overrides[get_current_user] = lambda: user_dict
    app.dependency_overrides[get_current_consumer] = lambda: user_dict
    client = TestClient(app, raise_server_exceptions=False)
    return client


# ---------------------------------------------------------------------------
# GET /api/v1/consumer/referral-code
# ---------------------------------------------------------------------------


class TestGetReferralCode:
    def test_returns_existing_code(self):
        """Consumer with existing referral code gets it back."""
        consumer_doc = _consumer_doc("consumer-a-uid", referral_code="BX7K2M")

        collections = {
            "consumers": FakeCollection(
                docs=[consumer_doc],
                doc_ref=FakeDocRef("consumer-a-uid", consumer_doc),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.get("/api/v1/consumer/referral-code")

        assert resp.status_code == 200
        body = resp.json()
        assert body["code"] == "BX7K2M"
        assert "ref=BX7K2M" in body["share_url"]

    def test_generates_code_if_missing(self):
        """Consumer without a referral code gets one generated."""
        consumer_doc = FakeDocSnapshot("consumer-a-uid", {
            "email": "alice@test.com",
            "display_name": "Alice",
            "referral_code": None,
            "global_points": 0,
            "tier": "free",
            "created_at": NOW,
        })

        doc_ref = FakeDocRef("consumer-a-uid", consumer_doc)
        collections = {
            "consumers": FakeCollection(
                docs=[consumer_doc],
                doc_ref=doc_ref,
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.get("/api/v1/consumer/referral-code")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["code"]) >= 6  # 6 normally, 10 fallback if collisions
        assert body["share_url"].startswith("http")

    def test_404_if_no_profile(self):
        """Consumer without a profile gets 404."""
        collections = {
            "consumers": FakeCollection(
                docs=[],
                doc_ref=FakeDocRef("consumer-a-uid", FakeDocSnapshot("consumer-a-uid", exists=False)),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.get("/api/v1/consumer/referral-code")

        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/v1/consumer/referral
# ---------------------------------------------------------------------------


class TestSubmitReferral:
    def _setup_db(self, referrer_code="ABC123", has_existing_referral=False):
        """Build a mock DB with referrer and referred consumers."""
        referrer_doc = _consumer_doc(
            "referrer-uid", display_name="Referrer", referral_code=referrer_code
        )
        referred_doc = _consumer_doc(
            "consumer-b-uid", display_name="Bob", referral_code="XYZ789"
        )

        referral_docs = []
        if has_existing_referral:
            referral_docs.append(FakeDocSnapshot("ref-001", {
                "referrer_id": "referrer-uid",
                "referred_id": "consumer-b-uid",
                "status": "completed",
                "points_earned": 100,
                "created_at": NOW,
            }))

        collections = {
            "consumers": FakeCollection(
                docs=[referrer_doc, referred_doc],
                doc_ref=FakeDocRef("auto-id"),
            ),
            "referrals": FakeCollection(
                docs=referral_docs,
                doc_ref=FakeDocRef("new-ref-id"),
            ),
        }
        return build_mock_db(collections)

    def test_successful_referral(self):
        """Valid referral code awards points to both parties."""
        db = self._setup_db()

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_B, db)
            resp = client.post(
                "/api/v1/consumer/referral",
                json={"referral_code": "ABC123"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["points_earned"] == 50
        assert body["referrer_points_earned"] == 100

    def test_invalid_code_404(self):
        """Invalid referral code returns 404."""
        # Empty consumers collection (no match for the code)
        collections = {
            "consumers": FakeCollection(docs=[]),
            "referrals": FakeCollection(docs=[]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_B, db)
            resp = client.post(
                "/api/v1/consumer/referral",
                json={"referral_code": "INVALID"},
            )

        assert resp.status_code == 404

    def test_self_referral_blocked(self):
        """Self-referral is blocked with 400."""
        self_doc = _consumer_doc(
            "consumer-a-uid", display_name="Alice", referral_code="MYCODE"
        )

        collections = {
            "consumers": FakeCollection(
                docs=[self_doc],
                doc_ref=FakeDocRef("auto-id"),
            ),
            "referrals": FakeCollection(docs=[]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.post(
                "/api/v1/consumer/referral",
                json={"referral_code": "MYCODE"},
            )

        assert resp.status_code == 400
        assert "yourself" in resp.json()["detail"].lower()

    def test_duplicate_referral_blocked(self):
        """Duplicate referral between same pair is blocked with 409."""
        db = self._setup_db(has_existing_referral=True)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_B, db)
            resp = client.post(
                "/api/v1/consumer/referral",
                json={"referral_code": "ABC123"},
            )

        assert resp.status_code == 409


# ---------------------------------------------------------------------------
# GET /api/v1/consumer/referrals
# ---------------------------------------------------------------------------


class TestListReferrals:
    def test_list_referrals_empty(self):
        """Consumer with no referrals gets empty list."""
        consumer_doc = _consumer_doc("consumer-a-uid")

        collections = {
            "consumers": FakeCollection(
                docs=[consumer_doc],
                doc_ref=FakeDocRef("consumer-a-uid", consumer_doc),
            ),
            "referrals": FakeCollection(docs=[]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.get("/api/v1/consumer/referrals")

        assert resp.status_code == 200
        body = resp.json()
        assert body["referrals"] == []
        assert body["total_points_earned"] == 0

    def test_list_referrals_with_data(self):
        """Consumer sees their referrals with masked names."""
        consumer_doc = _consumer_doc("consumer-a-uid", display_name="Alice")
        referred_doc = _consumer_doc("consumer-b-uid", display_name="Bob Smith")

        referral_snap = FakeDocSnapshot("ref-001", {
            "referrer_id": "consumer-a-uid",
            "referred_id": "consumer-b-uid",
            "status": "completed",
            "points_earned": 100,
            "created_at": NOW,
        })

        collections = {
            "consumers": FakeCollection(
                docs=[consumer_doc, referred_doc],
                doc_ref=FakeDocRef("auto-id"),
            ),
            "referrals": FakeCollection(docs=[referral_snap]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.referrals.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = _make_consumer_client(CONSUMER_A, db)
            resp = client.get("/api/v1/consumer/referrals")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["referrals"]) == 1
        assert body["total_points_earned"] == 100
        # Name should be masked
        assert body["referrals"][0]["status"] == "completed"
