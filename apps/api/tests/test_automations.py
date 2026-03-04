"""Tests for the automations (re-engagement messages) feature."""

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


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_loyalty_config_with_automations(automations=None, **kwargs):
    """Build a loyalty_configs document dict with optional automations."""
    base = {
        "program_type": "stamps",
        "stamps_required": 10,
        "reward_description": "Free coffee",
        "reward_value": 5.0,
        "reset_on_reward": True,
        "double_stamp_days": [],
        "birthday_reward": False,
    }
    base.update(kwargs)
    if automations is not None:
        base["automations"] = automations
    return base


def _make_automation_rules(first_visit=False, at_risk=False, reward_earned=False, at_risk_days=14):
    """Build a list of automation rule dicts."""
    return [
        {
            "trigger": "first_visit",
            "enabled": first_visit,
            "message_template": "Welcome to {merchant_name}!",
            "at_risk_days": 14,
        },
        {
            "trigger": "at_risk",
            "enabled": at_risk,
            "message_template": "We miss you at {merchant_name}!",
            "at_risk_days": at_risk_days,
        },
        {
            "trigger": "reward_earned",
            "enabled": reward_earned,
            "message_template": "You earned {reward_description}!",
            "at_risk_days": 14,
        },
    ]


# ---------------------------------------------------------------------------
# GET /api/v1/merchants/{merchant_id}/automations
# ---------------------------------------------------------------------------


class TestGetAutomations:
    """Tests for GET /merchants/{merchant_id}/automations."""

    def test_get_automations_defaults_when_no_config(self):
        """Returns default disabled rules when no loyalty config exists."""
        loyalty_doc = FakeDocSnapshot("merchant-001", exists=False)
        collections = {
            "loyalty_configs": FakeCollection(docs=[loyalty_doc]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/merchants/merchant-001/automations")

        assert resp.status_code == 200
        data = resp.json()
        assert data["merchant_id"] == "merchant-001"
        assert len(data["rules"]) == 3
        triggers = {r["trigger"] for r in data["rules"]}
        assert triggers == {"first_visit", "at_risk", "reward_earned"}
        # All should be disabled by default
        for rule in data["rules"]:
            assert rule["enabled"] is False

        app.dependency_overrides.pop(get_current_user, None)

    def test_get_automations_returns_saved_config(self):
        """Returns saved automation rules from loyalty_configs.automations."""
        rules = _make_automation_rules(first_visit=True, at_risk=True)
        config = _make_loyalty_config_with_automations(automations=rules)
        loyalty_doc = FakeDocSnapshot("merchant-001", data=config)
        collections = {
            "loyalty_configs": FakeCollection(docs=[loyalty_doc]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/merchants/merchant-001/automations")

        assert resp.status_code == 200
        data = resp.json()
        by_trigger = {r["trigger"]: r for r in data["rules"]}
        assert by_trigger["first_visit"]["enabled"] is True
        assert by_trigger["at_risk"]["enabled"] is True
        assert by_trigger["reward_earned"]["enabled"] is False

        app.dependency_overrides.pop(get_current_user, None)

    def test_get_automations_forbidden_wrong_merchant(self):
        """Staff from a different merchant gets 403."""
        other_staff = {**STAFF_USER, "merchant_id": "merchant-999"}
        db = build_mock_db()

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: other_staff
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/merchants/merchant-001/automations")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    def test_get_automations_owner_can_access_any(self):
        """Owner can access any merchant's automations."""
        loyalty_doc = FakeDocSnapshot("merchant-001", exists=False)
        collections = {
            "loyalty_configs": FakeCollection(docs=[loyalty_doc]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: OWNER_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/merchants/merchant-001/automations")

        assert resp.status_code == 200
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# PUT /api/v1/merchants/{merchant_id}/automations
# ---------------------------------------------------------------------------


class TestUpdateAutomations:
    """Tests for PUT /merchants/{merchant_id}/automations."""

    def test_update_automations_success(self):
        """Merchant admin can update automation rules."""
        doc_ref = FakeDocRef("merchant-001")
        collections = {
            "loyalty_configs": FakeCollection(doc_ref=doc_ref),
        }
        db = build_mock_db(collections)

        rules_payload = {
            "rules": [
                {
                    "trigger": "first_visit",
                    "enabled": True,
                    "message_template": "Welcome!",
                    "at_risk_days": 14,
                },
                {
                    "trigger": "at_risk",
                    "enabled": True,
                    "message_template": "Come back!",
                    "at_risk_days": 21,
                },
                {
                    "trigger": "reward_earned",
                    "enabled": False,
                    "message_template": "You earned a reward!",
                    "at_risk_days": 14,
                },
            ]
        }

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.put(
                "/api/v1/merchants/merchant-001/automations",
                json=rules_payload,
            )

        assert resp.status_code == 200
        data = resp.json()
        assert data["merchant_id"] == "merchant-001"
        assert len(data["rules"]) == 3

        # Verify Firestore set was called with merge=True
        doc_ref.set.assert_called_once()
        call_args = doc_ref.set.call_args
        assert "automations" in call_args[0][0]
        assert call_args[1].get("merge") is True

        app.dependency_overrides.pop(get_current_user, None)

    def test_update_automations_staff_forbidden(self):
        """Staff cannot update automation rules."""
        db = build_mock_db()

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: STAFF_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.put(
                "/api/v1/merchants/merchant-001/automations",
                json={"rules": []},
            )

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# POST /api/v1/automations/run-daily
# ---------------------------------------------------------------------------


class TestRunDaily:
    """Tests for POST /automations/run-daily."""

    def test_run_daily_no_configs(self):
        """When no loyalty configs exist, returns 0 messages."""
        collections = {
            "loyalty_configs": FakeCollection(docs=[]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            # No auth needed for this endpoint
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/automations/run-daily")

        assert resp.status_code == 200
        assert resp.json()["messages_queued"] == 0

    def test_run_daily_no_at_risk_enabled(self):
        """When at_risk automation is disabled, returns 0."""
        rules = _make_automation_rules(at_risk=False)
        config = _make_loyalty_config_with_automations(automations=rules)
        config_doc = FakeDocSnapshot("merchant-001", data=config)

        collections = {
            "loyalty_configs": FakeCollection(docs=[config_doc]),
        }
        db = build_mock_db(collections)

        with patch("apps.api.app.automations.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/automations/run-daily")

        assert resp.status_code == 200
        assert resp.json()["messages_queued"] == 0


# ---------------------------------------------------------------------------
# Automation helpers
# ---------------------------------------------------------------------------


class TestComputeSendAt:
    """Tests for quiet hours logic."""

    def test_within_business_hours(self):
        """During business hours (9 AM - 9 PM), send_at = now."""
        from apps.api.app.automations import _compute_send_at

        now = datetime(2024, 1, 15, 14, 30, 0, tzinfo=timezone.utc)  # 2:30 PM
        result = _compute_send_at(now)
        assert result == now

    def test_before_business_hours(self):
        """Before 9 AM, schedules for 9 AM next day."""
        from apps.api.app.automations import _compute_send_at

        now = datetime(2024, 1, 15, 7, 0, 0, tzinfo=timezone.utc)  # 7 AM
        result = _compute_send_at(now)
        assert result.hour == 9
        assert result.day == 16

    def test_after_business_hours(self):
        """After 9 PM, schedules for 9 AM next day."""
        from apps.api.app.automations import _compute_send_at

        now = datetime(2024, 1, 15, 22, 0, 0, tzinfo=timezone.utc)  # 10 PM
        result = _compute_send_at(now)
        assert result.hour == 9
        assert result.day == 16

    def test_exactly_9am_is_within_hours(self):
        """9 AM is within business hours."""
        from apps.api.app.automations import _compute_send_at

        now = datetime(2024, 1, 15, 9, 0, 0, tzinfo=timezone.utc)
        result = _compute_send_at(now)
        assert result == now

    def test_exactly_9pm_is_outside_hours(self):
        """9 PM (21:00) is outside business hours."""
        from apps.api.app.automations import _compute_send_at

        now = datetime(2024, 1, 15, 21, 0, 0, tzinfo=timezone.utc)
        result = _compute_send_at(now)
        assert result.hour == 9
        assert result.day == 16


class TestCreateAutomatedMessage:
    """Tests for create_automated_message helper."""

    def test_skip_no_phone(self):
        """Skips consumers without a phone number."""
        from apps.api.app.automations import create_automated_message

        db = MagicMock()
        result = create_automated_message(
            db=db,
            merchant_id="m1",
            consumer_id="c1",
            trigger="first_visit",
            message_body="Hello!",
            consumer_phone=None,
        )
        assert result is None
        db.collection.assert_not_called()

    def test_creates_record_with_phone(self):
        """Creates a message record when consumer has a phone."""
        from apps.api.app.automations import create_automated_message

        mock_doc_ref = MagicMock()
        mock_doc_ref.id = "msg-001"
        mock_collection = MagicMock()
        mock_collection.document.return_value = mock_doc_ref

        db = MagicMock()
        db.collection.return_value = mock_collection

        result = create_automated_message(
            db=db,
            merchant_id="m1",
            consumer_id="c1",
            trigger="first_visit",
            message_body="Hello!",
            consumer_phone="+15551234567",
        )
        assert result == "msg-001"
        mock_doc_ref.set.assert_called_once()
        set_data = mock_doc_ref.set.call_args[0][0]
        assert set_data["merchant_id"] == "m1"
        assert set_data["consumer_id"] == "c1"
        assert set_data["trigger"] == "first_visit"
        assert set_data["channel"] == "sms"
        assert set_data["resulted_in_visit"] is False
