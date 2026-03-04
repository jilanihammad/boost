"""Tests for merchant invite / onboarding flow."""

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app
from tests.conftest import (
    OWNER_USER,
    MERCHANT_ADMIN_USER,
    STAFF_USER,
    FakeDocSnapshot,
    FakeDocRef,
    FakeCollection,
    FakeQuery,
    build_mock_db,
    _make_client_with_user,
)

NOW = datetime(2025, 6, 15, 12, 0, 0, tzinfo=timezone.utc)

INVITE_REQUEST_BODY = {
    "business_name": "Sunny Side Café",
    "owner_name": "Jane Smith",
    "email": "jane@sunnyside.com",
    "phone": "(206) 555-1234",
    "category": "Coffee & Tea",
    "zone_slug": "capitol-hill",
}

PENDING_INVITE_DATA = {
    "business_name": "Sunny Side Café",
    "owner_name": "Jane Smith",
    "email": "jane@sunnyside.com",
    "phone": "(206) 555-1234",
    "category": "Coffee & Tea",
    "zone_slug": "capitol-hill",
    "status": "pending",
    "created_at": NOW,
    "reviewed_at": None,
    "reject_reason": None,
}


def _make_onboard_db(invite_docs=None, merchant_docs=None):
    """Build a mock DB with merchant_invites and merchants collections."""
    collections = {
        "merchant_invites": FakeCollection(
            docs=invite_docs or [],
            doc_ref=FakeDocRef("new-invite-id"),
        ),
        "merchants": FakeCollection(
            docs=merchant_docs or [],
            doc_ref=FakeDocRef("new-merchant-id"),
        ),
        "users": FakeCollection(
            docs=[],
            doc_ref=FakeDocRef("new-user-id"),
        ),
    }
    return build_mock_db(collections)


# ---------------------------------------------------------------------------
# POST /api/v1/merchants/request-invite (public)
# ---------------------------------------------------------------------------


class TestRequestInvite:
    """Public invite request endpoint."""

    def test_submit_invite_success(self):
        db = _make_onboard_db()
        # No auth override — this is a public endpoint, but get_current_user
        # is not called on this route, so we need to ensure the app doesn't
        # require auth. We override with a dummy anyway to avoid 401.
        app.dependency_overrides.pop(get_current_user, None)

        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/merchants/request-invite",
                json=INVITE_REQUEST_BODY,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert "request_id" in body
        assert "review" in body["message"].lower() or "submitted" in body["message"].lower()
        # Verify doc was written
        db.collection("merchant_invites").document().set.assert_called_once()

    def test_submit_invite_missing_fields(self):
        db = _make_onboard_db()
        app.dependency_overrides.pop(get_current_user, None)

        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/merchants/request-invite",
                json={"business_name": "Test"},
            )

        assert resp.status_code == 422  # Pydantic validation error

    def test_submit_invite_no_zone(self):
        """zone_slug is optional."""
        db = _make_onboard_db()
        app.dependency_overrides.pop(get_current_user, None)

        body = {**INVITE_REQUEST_BODY}
        del body["zone_slug"]

        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/merchants/request-invite", json=body)

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/v1/admin/invites (admin only)
# ---------------------------------------------------------------------------


class TestListInvites:
    """Admin invite listing endpoint."""

    def test_list_invites_as_owner(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/admin/invites")

        assert resp.status_code == 200
        body = resp.json()
        assert body["pending_count"] == 1
        assert len(body["invites"]) == 1
        assert body["invites"][0]["business_name"] == "Sunny Side Café"
        app.dependency_overrides.pop(get_current_user, None)

    def test_list_invites_as_staff_denied(self):
        db = _make_onboard_db()

        app.dependency_overrides[get_current_user] = lambda: STAFF_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/admin/invites")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)

    def test_list_invites_as_merchant_admin_denied(self):
        db = _make_onboard_db()

        app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/admin/invites")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# POST /api/v1/admin/invites/{invite_id}/approve
# ---------------------------------------------------------------------------


class TestApproveInvite:
    """Admin approve endpoint."""

    def test_approve_pending_invite(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db), \
             patch("apps.api.app.auth.get_user_by_email", return_value=None), \
             patch("apps.api.app.auth.set_user_claims"), \
             patch("apps.api.app.auth._init_firebase_admin"), \
             patch("firebase_admin.auth.create_user") as mock_create_user:
            # Mock Firebase user creation
            mock_new_user = MagicMock()
            mock_new_user.uid = "new-firebase-uid"
            mock_create_user.return_value = mock_new_user

            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/approve")

        assert resp.status_code == 200
        body = resp.json()
        assert "merchant_id" in body
        assert body["firebase_uid"] == "new-firebase-uid"
        app.dependency_overrides.pop(get_current_user, None)

    def test_approve_already_approved_invite(self):
        approved_data = {**PENDING_INVITE_DATA, "status": "approved"}
        invite_doc = FakeDocSnapshot("inv-001", approved_data)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/approve")

        assert resp.status_code == 400
        assert "already" in resp.json()["detail"].lower()
        app.dependency_overrides.pop(get_current_user, None)

    def test_approve_nonexistent_invite(self):
        db = _make_onboard_db()

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/nonexistent/approve")

        assert resp.status_code == 404
        app.dependency_overrides.pop(get_current_user, None)

    def test_approve_as_staff_denied(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: STAFF_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/approve")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)


# ---------------------------------------------------------------------------
# POST /api/v1/admin/invites/{invite_id}/reject
# ---------------------------------------------------------------------------


class TestRejectInvite:
    """Admin reject endpoint."""

    def test_reject_pending_invite(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post(
                "/api/v1/admin/invites/inv-001/reject",
                json={"reason": "Not a real business"},
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["invite_id"] == "inv-001"
        app.dependency_overrides.pop(get_current_user, None)

    def test_reject_without_reason(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/reject")

        assert resp.status_code == 200
        app.dependency_overrides.pop(get_current_user, None)

    def test_reject_already_rejected(self):
        rejected_data = {**PENDING_INVITE_DATA, "status": "rejected"}
        invite_doc = FakeDocSnapshot("inv-001", rejected_data)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: OWNER_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/reject")

        assert resp.status_code == 400
        app.dependency_overrides.pop(get_current_user, None)

    def test_reject_as_merchant_admin_denied(self):
        invite_doc = FakeDocSnapshot("inv-001", PENDING_INVITE_DATA)
        db = _make_onboard_db(invite_docs=[invite_doc])

        app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
        with patch("apps.api.app.merchant_onboard.get_db", return_value=db), \
             patch("apps.api.app.main.get_db", return_value=db):
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/admin/invites/inv-001/reject")

        assert resp.status_code == 403
        app.dependency_overrides.pop(get_current_user, None)
