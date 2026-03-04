"""Weekly merchant email reports: generation, storage, and retrieval."""

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from .auth import require_merchant_admin
from .db import (
    get_db,
    MERCHANTS,
    OFFERS,
    CONSUMER_VISITS,
    REWARDS,
    WEEKLY_REPORTS,
)
from .deps import get_current_user
from .models import WeeklyReportSummary, WeeklyReportList
from .analytics import (
    _build_deal_summary,
    _build_segment_summary,
    _generate_rule_based_insights,
)

logger = logging.getLogger("boost")

router = APIRouter(tags=["reports"])

DEFAULT_AVG_TICKET = 12.0
REPORT_API_KEY = os.getenv("REPORT_API_KEY", "")


def _week_start(dt: datetime) -> datetime:
    """Return Monday 00:00 UTC of the week containing *dt*."""
    d = dt.replace(hour=0, minute=0, second=0, microsecond=0)
    d -= timedelta(days=d.weekday())
    return d


def _render_html_report(
    merchant_name: str,
    week_start: str,
    week_end: str,
    new_customers: int,
    returning_customers: int,
    total_visits: int,
    top_deal: Optional[str],
    return_rate: float,
    return_rate_trend: Optional[str],
    rewards_earned: int,
    estimated_revenue: float,
    insights: list[str],
) -> str:
    """Build a self-contained HTML email report with inline CSS."""

    trend_arrow = ""
    trend_color = "#888"
    if return_rate_trend == "up":
        trend_arrow = "&#9650;"  # ▲
        trend_color = "#22c55e"
    elif return_rate_trend == "down":
        trend_arrow = "&#9660;"  # ▼
        trend_color = "#ef4444"
    elif return_rate_trend == "flat":
        trend_arrow = "&#8212;"  # —
        trend_color = "#888"

    insights_html = ""
    for insight in insights:
        insights_html += f'<li style="margin-bottom:8px;color:#d1d5db;">{insight}</li>'

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#111827;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    <!-- Header -->
    <div style="text-align:center;padding:24px 0;border-bottom:1px solid #374151;">
      <h1 style="margin:0;color:#f9fafb;font-size:24px;">📊 Weekly Report</h1>
      <p style="margin:8px 0 0;color:#9ca3af;font-size:14px;">{merchant_name}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">{week_start} — {week_end}</p>
    </div>

    <!-- KPI Grid -->
    <div style="padding:24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:12px;background:#1f2937;border-radius:8px;text-align:center;width:33%;">
            <div style="color:#60a5fa;font-size:28px;font-weight:700;">{total_visits}</div>
            <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Total Visits</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#1f2937;border-radius:8px;text-align:center;width:33%;">
            <div style="color:#34d399;font-size:28px;font-weight:700;">{new_customers}</div>
            <div style="color:#9ca3af;font-size:12px;margin-top:4px;">New Customers</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:12px;background:#1f2937;border-radius:8px;text-align:center;width:33%;">
            <div style="color:#a78bfa;font-size:28px;font-weight:700;">{returning_customers}</div>
            <div style="color:#9ca3af;font-size:12px;margin-top:4px;">Returning</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Metrics -->
    <div style="background:#1f2937;border-radius:8px;padding:16px;margin-bottom:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:8px 0;color:#d1d5db;font-size:14px;">Return Rate</td>
          <td style="padding:8px 0;text-align:right;color:#f9fafb;font-size:14px;font-weight:600;">
            {round(return_rate * 100)}%
            <span style="color:{trend_color};margin-left:4px;">{trend_arrow}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#d1d5db;font-size:14px;border-top:1px solid #374151;">Top Deal</td>
          <td style="padding:8px 0;text-align:right;color:#f9fafb;font-size:14px;font-weight:600;border-top:1px solid #374151;">
            {top_deal or "—"}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#d1d5db;font-size:14px;border-top:1px solid #374151;">Rewards Earned</td>
          <td style="padding:8px 0;text-align:right;color:#fbbf24;font-size:14px;font-weight:600;border-top:1px solid #374151;">
            {rewards_earned}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#d1d5db;font-size:14px;border-top:1px solid #374151;">Est. Revenue</td>
          <td style="padding:8px 0;text-align:right;color:#34d399;font-size:14px;font-weight:600;border-top:1px solid #374151;">
            ${estimated_revenue:,.2f}
          </td>
        </tr>
      </table>
    </div>

    <!-- Insights -->
    {"" if not insights else f'''
    <div style="background:#1f2937;border-radius:8px;padding:16px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;color:#f9fafb;font-size:16px;">💡 Insights</h3>
      <ul style="margin:0;padding:0 0 0 20px;">
        {insights_html}
      </ul>
    </div>
    '''}

    <!-- Footer -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid #374151;">
      <p style="margin:0;color:#6b7280;font-size:12px;">
        Powered by Boost — helping local businesses thrive
      </p>
    </div>
  </div>
</body>
</html>"""


def _compute_weekly_report(db, merchant_id: str, merchant_data: dict, week_start_dt: datetime, week_end_dt: datetime) -> dict:
    """Compute weekly metrics for a single merchant.

    Returns a dict ready to be stored in Firestore.
    """
    now = datetime.now(timezone.utc)
    merchant_name = merchant_data.get("name", "Business")
    merchant_email = merchant_data.get("email", "")

    # Fetch visits in this week
    visits_query = (
        db.collection(CONSUMER_VISITS)
        .where("merchant_id", "==", merchant_id)
        .where("timestamp", ">=", week_start_dt)
        .where("timestamp", "<", week_end_dt)
    )
    week_visits = list(visits_query.stream())

    # Fetch visits from last week for trend comparison
    prev_week_start = week_start_dt - timedelta(weeks=1)
    prev_visits_query = (
        db.collection(CONSUMER_VISITS)
        .where("merchant_id", "==", merchant_id)
        .where("timestamp", ">=", prev_week_start)
        .where("timestamp", "<", week_start_dt)
    )
    prev_week_visits = list(prev_visits_query.stream())

    # Count unique consumers and categorise new vs returning
    # A "new" customer this week = their first ever visit at this merchant was this week
    all_visits_query = (
        db.collection(CONSUMER_VISITS)
        .where("merchant_id", "==", merchant_id)
        .where("timestamp", "<", week_start_dt)
    )
    prior_visitors = set()
    for v in all_visits_query.stream():
        vd = v.to_dict()
        cid = vd.get("consumer_id")
        if cid:
            prior_visitors.add(cid)

    week_consumers: dict[str, int] = {}
    for v in week_visits:
        vd = v.to_dict()
        cid = vd.get("consumer_id")
        if cid:
            week_consumers[cid] = week_consumers.get(cid, 0) + 1

    new_customers = sum(1 for c in week_consumers if c not in prior_visitors)
    returning_customers = sum(1 for c in week_consumers if c in prior_visitors)
    total_visits = len(week_visits)

    # Top deal by redemptions this week
    offer_counts: dict[str, int] = {}
    for v in week_visits:
        vd = v.to_dict()
        oid = vd.get("offer_id")
        if oid:
            offer_counts[oid] = offer_counts.get(oid, 0) + 1

    top_deal_name = None
    if offer_counts:
        top_offer_id = max(offer_counts, key=offer_counts.get)  # type: ignore[arg-type]
        offer_doc = db.collection(OFFERS).document(top_offer_id).get()
        if offer_doc.exists:
            top_deal_name = offer_doc.to_dict().get("name", "Unknown Deal")

    # Return rate: of this week's consumers, how many had prior visits?
    return_rate = returning_customers / max(len(week_consumers), 1)

    # Previous week return rate for trend
    prev_consumers: dict[str, int] = {}
    for v in prev_week_visits:
        vd = v.to_dict()
        cid = vd.get("consumer_id")
        if cid:
            prev_consumers[cid] = prev_consumers.get(cid, 0) + 1

    # Visitors before the previous week
    before_prev_visitors = set()
    before_prev_query = (
        db.collection(CONSUMER_VISITS)
        .where("merchant_id", "==", merchant_id)
        .where("timestamp", "<", prev_week_start)
    )
    for v in before_prev_query.stream():
        vd = v.to_dict()
        cid = vd.get("consumer_id")
        if cid:
            before_prev_visitors.add(cid)

    prev_returning = sum(1 for c in prev_consumers if c in before_prev_visitors)
    prev_return_rate = prev_returning / max(len(prev_consumers), 1)

    if return_rate > prev_return_rate + 0.02:
        return_rate_trend = "up"
    elif return_rate < prev_return_rate - 0.02:
        return_rate_trend = "down"
    else:
        return_rate_trend = "flat"

    # Rewards earned this week
    rewards_query = (
        db.collection(REWARDS)
        .where("merchant_id", "==", merchant_id)
        .where("earned_at", ">=", week_start_dt)
        .where("earned_at", "<", week_end_dt)
    )
    rewards_earned = len(list(rewards_query.stream()))

    # Estimated revenue
    estimated_revenue = round(total_visits * DEFAULT_AVG_TICKET, 2)

    # Generate insights
    deals = _build_deal_summary(db, merchant_id)
    segments = _build_segment_summary(db, merchant_id)
    insights = _generate_rule_based_insights(deals, segments)

    if not insights:
        insights = ["Keep growing — more data means better insights next week!"]

    # Render HTML
    week_start_str = week_start_dt.strftime("%Y-%m-%d")
    week_end_str = week_end_dt.strftime("%Y-%m-%d")

    html_body = _render_html_report(
        merchant_name=merchant_name,
        week_start=week_start_str,
        week_end=week_end_str,
        new_customers=new_customers,
        returning_customers=returning_customers,
        total_visits=total_visits,
        top_deal=top_deal_name,
        return_rate=return_rate,
        return_rate_trend=return_rate_trend,
        rewards_earned=rewards_earned,
        estimated_revenue=estimated_revenue,
        insights=insights,
    )

    # Log email intent
    logger.info(
        'Would send weekly report email to %s (%s) for week %s',
        merchant_email,
        merchant_name,
        week_start_str,
    )

    return {
        "merchant_id": merchant_id,
        "week_start": week_start_str,
        "week_end": week_end_str,
        "new_customers": new_customers,
        "returning_customers": returning_customers,
        "total_visits": total_visits,
        "top_deal": top_deal_name,
        "return_rate": round(return_rate, 3),
        "return_rate_trend": return_rate_trend,
        "rewards_earned": rewards_earned,
        "estimated_revenue": estimated_revenue,
        "insights": insights,
        "html_body": html_body,
        "generated_at": now,
    }


# ---------------------------------------------------------------------------
# POST /api/v1/reports/weekly
# ---------------------------------------------------------------------------


@router.post("/reports/weekly")
async def generate_weekly_reports(
    api_key: Optional[str] = Query(None),
):
    """Generate weekly reports for all active merchants.

    Called by Cloud Scheduler (no auth) or with a simple API key.
    Idempotent: skips merchants that already have a report for this week.
    """
    # Simple API key check (optional)
    if REPORT_API_KEY and api_key != REPORT_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")

    db = get_db()
    now = datetime.now(timezone.utc)
    week_start_dt = _week_start(now)
    week_end_dt = week_start_dt + timedelta(weeks=1)
    week_start_str = week_start_dt.strftime("%Y-%m-%d")

    # Get all active merchants
    merchants_query = db.collection(MERCHANTS).where("status", "==", "active")
    merchant_docs = list(merchants_query.stream())

    reports_generated = 0

    for mdoc in merchant_docs:
        merchant_id = mdoc.id
        merchant_data = mdoc.to_dict()

        # Idempotency check: skip if report already exists for this week
        existing = list(
            db.collection(WEEKLY_REPORTS)
            .where("merchant_id", "==", merchant_id)
            .where("week_start", "==", week_start_str)
            .limit(1)
            .stream()
        )
        if existing:
            logger.info("Skipping duplicate report for merchant %s week %s", merchant_id, week_start_str)
            continue

        report_data = _compute_weekly_report(db, merchant_id, merchant_data, week_start_dt, week_end_dt)

        # Store in Firestore
        doc_ref = db.collection(WEEKLY_REPORTS).document()
        doc_ref.set(report_data)

        reports_generated += 1

    return {"reports_generated": reports_generated, "week_start": week_start_str}


# ---------------------------------------------------------------------------
# GET /api/v1/merchants/{merchant_id}/reports
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/reports",
    response_model=WeeklyReportList,
)
async def list_merchant_reports(
    merchant_id: str,
    limit: int = Query(12, ge=1, le=52),
    user=Depends(get_current_user),
):
    """List past weekly reports for a merchant (last N weeks).

    Auth: merchant_admin or owner.
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    query = (
        db.collection(WEEKLY_REPORTS)
        .where("merchant_id", "==", merchant_id)
        .order_by("week_start", direction="DESCENDING")
        .limit(limit)
    )

    docs = list(query.stream())

    reports = []
    for doc in docs:
        data = doc.to_dict()
        reports.append(
            WeeklyReportSummary(
                id=doc.id,
                merchant_id=data["merchant_id"],
                week_start=data["week_start"],
                week_end=data["week_end"],
                new_customers=data.get("new_customers", 0),
                returning_customers=data.get("returning_customers", 0),
                total_visits=data.get("total_visits", 0),
                top_deal=data.get("top_deal"),
                return_rate=data.get("return_rate", 0.0),
                return_rate_trend=data.get("return_rate_trend"),
                rewards_earned=data.get("rewards_earned", 0),
                estimated_revenue=data.get("estimated_revenue", 0.0),
                insights=data.get("insights", []),
                generated_at=data.get("generated_at", datetime.now(timezone.utc)),
                html_body=None,  # Omit HTML from list view
            )
        )

    return WeeklyReportList(reports=reports)


# ---------------------------------------------------------------------------
# GET /api/v1/merchants/{merchant_id}/reports/{report_id}
# ---------------------------------------------------------------------------


@router.get(
    "/merchants/{merchant_id}/reports/{report_id}",
    response_model=WeeklyReportSummary,
)
async def get_merchant_report(
    merchant_id: str,
    report_id: str,
    user=Depends(get_current_user),
):
    """Get full detail of a specific weekly report, including rendered HTML.

    Auth: merchant_admin or owner.
    """
    require_merchant_admin(user, merchant_id)

    db = get_db()
    doc = db.collection(WEEKLY_REPORTS).document(report_id).get()

    if not doc.exists:
        raise HTTPException(status_code=404, detail="Report not found")

    data = doc.to_dict()

    if data.get("merchant_id") != merchant_id:
        raise HTTPException(status_code=404, detail="Report not found")

    return WeeklyReportSummary(
        id=doc.id,
        merchant_id=data["merchant_id"],
        week_start=data["week_start"],
        week_end=data["week_end"],
        new_customers=data.get("new_customers", 0),
        returning_customers=data.get("returning_customers", 0),
        total_visits=data.get("total_visits", 0),
        top_deal=data.get("top_deal"),
        return_rate=data.get("return_rate", 0.0),
        return_rate_trend=data.get("return_rate_trend"),
        rewards_earned=data.get("rewards_earned", 0),
        estimated_revenue=data.get("estimated_revenue", 0.0),
        insights=data.get("insights", []),
        generated_at=data.get("generated_at", datetime.now(timezone.utc)),
        html_body=data.get("html_body"),
    )
