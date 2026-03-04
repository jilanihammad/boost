"""Tests for loyalty program: config CRUD, stamp tracking, reward redemption."""

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app
from .conftest import (
    OWNER_USER,
    MERCHANT_ADMIN_USER,
    STAFF_USER,
    FakeDocSnapshot,
    FakeDocRef,
    FakeQuery,
    FakeCollection,
    build_mock_db,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

CONSUMER_USER = {
    "uid": "consumer-uid-001",
    "email": "consumer@test.com",
    "role": "consumer",
}

NOW = datetime.now(timezone.utc)


def _loyalty_config_data():
    return {
        "program_type": "stamps",
        "stamps_required": 10,
        "reward_description": "Free coffee",
        "reward_value": 5.0,
        "reset_on_reward": True,
        "double_stamp_days": [2],  # Wednesday
        "birthday_reward": False,
    }


def _make_client(user_dict, mock_db):
    app.dependency_overrides[get_current_user] = lambda: user_dict
    client = TestClient(app, raise_server_exceptions=False)
    return client


# ---------------------------------------------------------------------------
# Tests: GET /api/v1/merchants/{merchant_id}/loyalty
# ---------------------------------------------------------------------------


class TestGetLoyaltyConfig:
    def test_get_config_success(self):
        """Admin can read loyalty config for their merchant."""
        config = _loyalty_config_data()
        config_snap = FakeDocSnapshot("merchant-001", config)

        collections = {
            "loyalty_configs": FakeCollection(
                docs=[config_snap],
                doc_ref=FakeDocRef("merchant-001", config_snap),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(MERCHANT_ADMIN_USER, db)
            resp = client.get("/api/v1/merchants/merchant-001/loyalty")

        assert resp.status_code == 200
        body = resp.json()
        assert body["merchant_id"] == "merchant-001"
        assert body["stamps_required"] == 10
        assert body["program_type"] == "stamps"
        app.dependency_overrides.pop(get_current_user, None)

    def test_get_config_not_found(self):
        """Returns 404 when no loyalty config exists."""
        not_found_snap = FakeDocSnapshot("merchant-001", exists=False)
        collections = {
            "loyalty_configs": FakeCollection(
                doc_ref=FakeDocRef("merchant-001", not_found_snap),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(MERCHANT_ADMIN_USER, db)
            resp = client.get("/api/v1/merchants/merchant-001/loyalty")

        assert resp.status_code == 404
        app.dependency_overrides.pop(get_current_user, None)

    def test_get_config_wrong_merchant_forbidden(self):
        """Staff for merchant-001 can't read merchant-999's config."""
        db = build_mock_db()
        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)  # merchant_id=merchant-001
            resp = client.get("/api/v1/merchants/merchant-999/loyalty")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Tests: PUT /api/v1/merchants/{merchant_id}/loyalty
# ---------------------------------------------------------------------------


class TestPutLoyaltyConfig:
    def test_create_config(self):
        """Merchant admin can create loyalty config."""
        doc_ref = FakeDocRef("merchant-001")
        collections = {
            "loyalty_configs": FakeCollection(doc_ref=doc_ref),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(MERCHANT_ADMIN_USER, db)
            resp = client.put(
                "/api/v1/merchants/merchant-001/loyalty",
                json={
                    "stamps_required": 8,
                    "reward_description": "Free pastry",
                    "reward_value": 4.0,
                    "reset_on_reward": True,
                    "double_stamp_days": [4, 5],
                    "birthday_reward": True,
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["stamps_required"] == 8
        assert body["reward_description"] == "Free pastry"
        assert body["double_stamp_days"] == [4, 5]
        assert body["birthday_reward"] is True
        # Verify Firestore set was called
        doc_ref.set.assert_called_once()
        app.dependency_overrides.pop(get_current_user, None)

    def test_staff_cannot_create_config(self):
        """Staff users can't create/update loyalty config (admin only)."""
        db = build_mock_db()
        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)
            resp = client.put(
                "/api/v1/merchants/merchant-001/loyalty",
                json={
                    "stamps_required": 5,
                    "reward_description": "test",
                    "reward_value": 1.0,
                },
            )

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# Tests: POST /api/v1/rewards/{reward_id}/redeem
# ---------------------------------------------------------------------------


class TestRedeemReward:
    def test_redeem_earned_reward(self):
        """Staff can redeem an earned reward."""
        reward_data = {
            "consumer_id": "consumer-uid-001",
            "merchant_id": "merchant-001",
            "description": "Free coffee",
            "value": 5.0,
            "status": "earned",
            "earned_at": NOW,
            "redeemed_at": None,
            "expires_at": NOW + timedelta(days=30),
        }
        reward_snap = FakeDocSnapshot("reward-001", reward_data)

        progress_data = {
            "consumer_id": "consumer-uid-001",
            "merchant_id": "merchant-001",
            "current_stamps": 0,
            "total_stamps": 10,
            "rewards_earned": 1,
            "rewards_redeemed": 0,
            "last_visit": NOW,
        }
        progress_snap = FakeDocSnapshot("consumer-uid-001_merchant-001", progress_data)
        progress_ref = FakeDocRef("consumer-uid-001_merchant-001", progress_snap)

        # Use a custom FakeCollection for loyalty_progress that returns the correct ref
        class ProgressCollection(FakeCollection):
            def document(self, doc_id=None):
                if doc_id == "consumer-uid-001_merchant-001":
                    return progress_ref
                return super().document(doc_id)

        collections = {
            "rewards": FakeCollection(
                docs=[reward_snap],
                doc_ref=FakeDocRef("reward-001", reward_snap),
            ),
            "loyalty_progress": ProgressCollection(
                docs=[progress_snap],
                doc_ref=progress_ref,
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)
            resp = client.post("/api/v1/rewards/reward-001/redeem")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "redeemed"
        assert body["redeemed_at"] is not None
        # Verify Firestore was updated
        reward_snap.reference.update.assert_called_once()
        progress_ref.update.assert_called_once()
        app.dependency_overrides.pop(get_current_user, None)

    def test_redeem_already_redeemed_fails(self):
        """Can't redeem a reward that's already redeemed."""
        reward_data = {
            "consumer_id": "consumer-uid-001",
            "merchant_id": "merchant-001",
            "description": "Free coffee",
            "status": "redeemed",
            "earned_at": NOW,
            "redeemed_at": NOW,
        }
        reward_snap = FakeDocSnapshot("reward-001", reward_data)

        collections = {
            "rewards": FakeCollection(
                docs=[reward_snap],
                doc_ref=FakeDocRef("reward-001", reward_snap),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)
            resp = client.post("/api/v1/rewards/reward-001/redeem")

        assert resp.status_code == 400
        app.dependency_overrides.pop(get_current_user, None)

    def test_redeem_reward_not_found(self):
        """Returns 404 for non-existent reward."""
        not_found = FakeDocSnapshot("reward-999", exists=False)
        collections = {
            "rewards": FakeCollection(doc_ref=FakeDocRef("reward-999", not_found)),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)
            resp = client.post("/api/v1/rewards/reward-999/redeem")

        assert resp.status_code == 404
        app.dependency_overrides.pop(get_current_user, None)

    def test_redeem_wrong_merchant_forbidden(self):
        """Staff from another merchant can't redeem."""
        reward_data = {
            "consumer_id": "consumer-uid-001",
            "merchant_id": "merchant-999",  # different merchant
            "description": "Free item",
            "status": "earned",
            "earned_at": NOW,
        }
        reward_snap = FakeDocSnapshot("reward-001", reward_data)
        collections = {
            "rewards": FakeCollection(
                docs=[reward_snap],
                doc_ref=FakeDocRef("reward-001", reward_snap),
            ),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.loyalty.get_db", return_value=db):
            client = _make_client(STAFF_USER, db)  # merchant-001
            resp = client.post("/api/v1/rewards/reward-001/redeem")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)
