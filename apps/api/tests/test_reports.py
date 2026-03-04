"""Tests for the weekly reports endpoints."""

from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from apps.api.app.deps import get_current_user
from apps.api.app.main import app

from .conftest import (
    STAFF_USER,
    MERCHANT_ADMIN_USER,
    OWNER_USER,
    FakeDocSnapshot,
    FakeDocRef,
    FakeCollection,
    FakeQuery,
    build_mock_db,
)

MERCHANT_ID = "merchant-001"


def _ts(days_ago: int = 0, weeks_ago: int = 0) -> datetime:
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


def _merchant(mid: str = MERCHANT_ID, name: str = "Test Cafe", email: str = "cafe@test.com") -> FakeDocSnapshot:
    return FakeDocSnapshot(
        doc_id=mid,
        data={
            "name": name,
            "email": email,
            "status": "active",
            "locations": [],
            "created_at": _ts(days_ago=90),
        },
    )


def _offer(offer_id: str, name: str, merchant_id: str = MERCHANT_ID) -> FakeDocSnapshot:
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
            "status": "active",
            "value_per_redemption": 2.0,
            "created_at": now,
            "updated_at": now,
        },
    )


def _report(report_id: str, merchant_id: str = MERCHANT_ID, week_start: str = "2025-01-06") -> FakeDocSnapshot:
    return FakeDocSnapshot(
        doc_id=report_id,
        data={
            "merchant_id": merchant_id,
            "week_start": week_start,
            "week_end": "2025-01-13",
            "new_customers": 5,
            "returning_customers": 8,
            "total_visits": 20,
            "top_deal": "Latte Deal",
            "return_rate": 0.615,
            "return_rate_trend": "up",
            "rewards_earned": 2,
            "estimated_revenue": 240.0,
            "insights": ["Great week!"],
            "html_body": "<html><body>Report</body></html>",
            "generated_at": datetime.now(timezone.utc),
        },
    )


# ---------------------------------------------------------------------------
# POST /api/v1/reports/weekly
# ---------------------------------------------------------------------------


class TestGenerateWeeklyReports:
    """Tests for POST /api/v1/reports/weekly."""

    def test_generate_reports_no_merchants(self):
        """Returns 0 reports when there are no active merchants."""
        db = build_mock_db({
            "merchants": FakeCollection(docs=[]),
            "weekly_reports": FakeCollection(docs=[]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            # No auth needed for this endpoint
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/reports/weekly")

        assert resp.status_code == 200
        body = resp.json()
        assert body["reports_generated"] == 0

    def test_generate_reports_with_merchants(self):
        """Generates reports for active merchants."""
        merchant_doc = _merchant()
        offer_doc = _offer("offer-1", "Latte Deal")
        visit1 = _visit("c1", "offer-1", _ts(days_ago=1))
        visit2 = _visit("c2", "offer-1", _ts(days_ago=2))

        # Need to return empty for idempotency check (no existing reports)
        empty_reports = FakeCollection(docs=[])
        merchants_col = FakeCollection(docs=[merchant_doc])

        # Build mock DB with dynamic behavior
        db = MagicMock()

        def _collection(name):
            if name == "merchants":
                return merchants_col
            elif name == "weekly_reports":
                return empty_reports
            elif name == "consumer_visits":
                return FakeCollection(docs=[visit1, visit2])
            elif name == "offers":
                return FakeCollection(docs=[offer_doc])
            elif name == "rewards":
                return FakeCollection(docs=[])
            elif name == "insight_cache":
                return FakeCollection(docs=[])
            return FakeCollection(docs=[])

        db.collection.side_effect = _collection

        with patch("apps.api.app.reports.get_db", return_value=db), \
             patch("apps.api.app.analytics.get_db", return_value=db):
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/reports/weekly")

        assert resp.status_code == 200
        body = resp.json()
        assert body["reports_generated"] == 1
        assert "week_start" in body

    def test_generate_reports_idempotent(self):
        """Does not generate duplicate reports for the same week."""
        merchant_doc = _merchant()

        # There's already a report for this week
        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=now.weekday())
        week_start_str = week_start.strftime("%Y-%m-%d")
        existing_report = _report("r-existing", week_start=week_start_str)

        db = MagicMock()

        def _collection(name):
            if name == "merchants":
                return FakeCollection(docs=[merchant_doc])
            elif name == "weekly_reports":
                return FakeCollection(docs=[existing_report])
            return FakeCollection(docs=[])

        db.collection.side_effect = _collection

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/reports/weekly")

        assert resp.status_code == 200
        body = resp.json()
        assert body["reports_generated"] == 0

    def test_generate_reports_api_key_rejected(self):
        """Rejects request with invalid API key when key is configured."""
        with patch("apps.api.app.reports.REPORT_API_KEY", "secret-key"):
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/reports/weekly?api_key=wrong")

        assert resp.status_code == 403

    def test_generate_reports_api_key_accepted(self):
        """Accepts request with valid API key."""
        db = build_mock_db({
            "merchants": FakeCollection(docs=[]),
            "weekly_reports": FakeCollection(docs=[]),
        })

        with patch("apps.api.app.reports.REPORT_API_KEY", "secret-key"), \
             patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides.pop(get_current_user, None)
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.post("/api/v1/reports/weekly?api_key=secret-key")

        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/v1/merchants/{merchant_id}/reports
# ---------------------------------------------------------------------------


class TestListMerchantReports:
    """Tests for GET /merchants/{merchant_id}/reports."""

    def test_list_reports_as_admin(self):
        """Merchant admin can list their reports."""
        r1 = _report("r-1", week_start="2025-01-13")
        r2 = _report("r-2", week_start="2025-01-06")

        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[r1, r2]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports")

        assert resp.status_code == 200
        body = resp.json()
        assert len(body["reports"]) == 2
        # HTML body should be omitted in list view
        assert body["reports"][0].get("html_body") is None

    def test_list_reports_as_owner(self):
        """Owner can list any merchant's reports."""
        r1 = _report("r-1")

        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[r1]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: OWNER_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports")

        assert resp.status_code == 200
        assert len(resp.json()["reports"]) == 1

    def test_list_reports_wrong_merchant(self):
        """Merchant admin can't list another merchant's reports."""
        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get("/api/v1/merchants/other-merchant/reports")

        assert resp.status_code == 403

    def test_list_reports_empty(self):
        """Returns empty list when no reports exist."""
        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports")

        assert resp.status_code == 200
        assert resp.json()["reports"] == []


# ---------------------------------------------------------------------------
# GET /api/v1/merchants/{merchant_id}/reports/{report_id}
# ---------------------------------------------------------------------------


class TestGetMerchantReport:
    """Tests for GET /merchants/{merchant_id}/reports/{report_id}."""

    def test_get_report_detail(self):
        """Admin can view full report detail with HTML."""
        report = _report("r-detail")

        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[report]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports/r-detail")

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == "r-detail"
        assert body["html_body"] is not None
        assert "Report" in body["html_body"]
        assert body["new_customers"] == 5
        assert body["returning_customers"] == 8

    def test_get_report_not_found(self):
        """Returns 404 for non-existent report."""
        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports/nonexistent")

        assert resp.status_code == 404

    def test_get_report_wrong_merchant(self):
        """Returns 404 when report belongs to different merchant."""
        report = FakeDocSnapshot(
            doc_id="r-other",
            data={
                "merchant_id": "other-merchant",
                "week_start": "2025-01-06",
                "week_end": "2025-01-13",
                "new_customers": 3,
                "returning_customers": 2,
                "total_visits": 10,
                "top_deal": None,
                "return_rate": 0.4,
                "return_rate_trend": "flat",
                "rewards_earned": 0,
                "estimated_revenue": 120.0,
                "insights": [],
                "html_body": "<html>Other</html>",
                "generated_at": datetime.now(timezone.utc),
            },
        )

        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[report]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: MERCHANT_ADMIN_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports/r-other")

        assert resp.status_code == 404

    def test_get_report_unauthorized(self):
        """Staff cannot access reports (merchant_admin required)."""
        report = _report("r-1")

        db = build_mock_db({
            "weekly_reports": FakeCollection(docs=[report]),
        })

        with patch("apps.api.app.reports.get_db", return_value=db):
            app.dependency_overrides[get_current_user] = lambda: STAFF_USER
            client = TestClient(app, raise_server_exceptions=False)
            resp = client.get(f"/api/v1/merchants/{MERCHANT_ID}/reports/r-1")

        # Staff doesn't have merchant_admin access
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# HTML Rendering
# ---------------------------------------------------------------------------


class TestHtmlRendering:
    """Test the HTML email template rendering."""

    def test_render_contains_key_elements(self):
        from apps.api.app.reports import _render_html_report

        html = _render_html_report(
            merchant_name="Test Cafe",
            week_start="2025-01-06",
            week_end="2025-01-13",
            new_customers=5,
            returning_customers=8,
            total_visits=20,
            top_deal="Latte Deal",
            return_rate=0.62,
            return_rate_trend="up",
            rewards_earned=3,
            estimated_revenue=240.0,
            insights=["Great week!", "Consider raising caps."],
        )

        assert "Test Cafe" in html
        assert "2025-01-06" in html
        assert "2025-01-13" in html
        assert "20" in html  # total visits
        assert "5" in html  # new customers
        assert "8" in html  # returning
        assert "Latte Deal" in html
        assert "62%" in html  # return rate
        assert "&#9650;" in html  # up arrow
        assert "$240.00" in html
        assert "Great week!" in html
        assert "style=" in html  # inline CSS via style attributes

    def test_render_down_trend(self):
        from apps.api.app.reports import _render_html_report

        html = _render_html_report(
            merchant_name="Shop",
            week_start="2025-01-06",
            week_end="2025-01-13",
            new_customers=1,
            returning_customers=2,
            total_visits=5,
            top_deal=None,
            return_rate=0.3,
            return_rate_trend="down",
            rewards_earned=0,
            estimated_revenue=60.0,
            insights=[],
        )

        assert "&#9660;" in html  # down arrow
        assert "—" in html  # no top deal

    def test_render_no_insights(self):
        from apps.api.app.reports import _render_html_report

        html = _render_html_report(
            merchant_name="Shop",
            week_start="2025-01-06",
            week_end="2025-01-13",
            new_customers=0,
            returning_customers=0,
            total_visits=0,
            top_deal=None,
            return_rate=0.0,
            return_rate_trend="flat",
            rewards_earned=0,
            estimated_revenue=0.0,
            insights=[],
        )

        # Should still render without errors
        assert "Shop" in html
        assert "Weekly Report" in html
