"""Pydantic models for request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


# --- Enums ---

class OfferStatus(str, Enum):
    active = "active"
    paused = "paused"
    expired = "expired"


class TokenStatus(str, Enum):
    active = "active"
    redeemed = "redeemed"
    expired = "expired"


class RedemptionMethod(str, Enum):
    scan = "scan"
    manual = "manual"


class UserRole(str, Enum):
    owner = "owner"
    merchant_admin = "merchant_admin"
    staff = "staff"
    consumer = "consumer"


class ConsumerTier(str, Enum):
    free = "free"
    boost_plus = "boost_plus"


class UserStatus(str, Enum):
    active = "active"
    deleted = "deleted"
    orphaned = "orphaned"


class MerchantStatus(str, Enum):
    active = "active"
    deleted = "deleted"


# --- Merchant ---

class MerchantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    locations: list[Annotated[str, Field(max_length=200)]] = Field(default_factory=list, max_length=50)


class MerchantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    locations: Optional[list[Annotated[str, Field(max_length=200)]]] = Field(None, max_length=50)


class Merchant(BaseModel):
    id: str
    name: str
    email: str
    locations: list[str]
    status: MerchantStatus = MerchantStatus.active
    created_at: datetime
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None  # UID of owner who deleted


# --- Offer ---

class TargetAudience(str, Enum):
    everyone = "everyone"
    new_only = "new_only"
    returning_only = "returning_only"
    referred_only = "referred_only"


class OfferCreate(BaseModel):
    merchant_id: str
    name: str = Field(..., min_length=1, max_length=100)
    discount_text: str = Field(..., min_length=1, max_length=100)  # e.g., "$2 off any coffee"
    terms: Optional[str] = Field(None, max_length=500)
    cap_daily: int = Field(50, ge=1, le=10000)  # Max redemptions per day
    active_hours: Optional[str] = None  # e.g., "9am-5pm" (display only for v0)
    value_per_redemption: float = Field(2.0, ge=0.01)  # Amount merchant owes per redemption
    target_audience: TargetAudience = TargetAudience.everyone  # Customer targeting (filtering logic in future bead)


class OfferUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    discount_text: Optional[str] = Field(None, min_length=1, max_length=100)
    terms: Optional[str] = Field(None, max_length=500)
    cap_daily: Optional[int] = Field(None, ge=1, le=10000)
    active_hours: Optional[str] = None
    status: Optional[OfferStatus] = None
    value_per_redemption: Optional[float] = Field(None, ge=0.01)
    target_audience: Optional[TargetAudience] = None  # Customer targeting (filtering logic in future bead)


class Offer(BaseModel):
    id: str
    merchant_id: str
    name: str
    discount_text: str
    terms: Optional[str]
    cap_daily: int
    active_hours: Optional[str]
    status: OfferStatus
    value_per_redemption: float
    created_at: datetime
    updated_at: datetime

    # Computed fields (not stored, calculated at runtime)
    today_redemptions: int = 0
    cap_remaining: int = 0


# --- Token ---

class TokenCreate(BaseModel):
    count: int = Field(100, ge=1, le=10000)  # How many tokens to generate
    expires_days: int = Field(30, ge=1, le=365)  # Days until expiry


class Token(BaseModel):
    id: str
    offer_id: str
    short_code: str  # Human-readable 6-char code (e.g., "ABC123")
    qr_data: str  # Full QR payload (URL or boost:// URI)
    status: TokenStatus
    expires_at: datetime
    redeemed_at: Optional[datetime] = None
    redeemed_by_location: Optional[str] = None
    created_at: datetime
    is_universal: bool = False  # True for reusable tokens (one per offer)
    last_redeemed_at: Optional[datetime] = None  # Track last use for universal tokens
    last_redeemed_by_location: Optional[str] = None


# --- Redemption ---

class RedeemRequest(BaseModel):
    token: str = Field(..., min_length=4, max_length=100)  # Token ID or short_code
    location: str = Field(..., min_length=1, max_length=100)
    method: RedemptionMethod


class RedeemResponse(BaseModel):
    success: bool
    message: str
    offer_name: Optional[str] = None
    discount_text: Optional[str] = None
    redemption_id: Optional[str] = None
    consumer_name: Optional[str] = None
    visit_number: Optional[int] = None
    stamp_progress: Optional[str] = None  # e.g. "3/5"
    reward_earned: Optional[bool] = None
    reward_description: Optional[str] = None


class Redemption(BaseModel):
    id: str
    token_id: str
    offer_id: str
    merchant_id: str
    method: RedemptionMethod
    location: str
    value: float  # Amount merchant owes for this redemption
    timestamp: datetime


# --- Ledger ---

class LedgerEntry(BaseModel):
    id: str
    merchant_id: str
    redemption_id: str
    offer_id: str
    amount: float
    created_at: datetime


class LedgerSummary(BaseModel):
    merchant_id: str
    total_owed: float
    redemption_count: int
    period_start: datetime
    period_end: datetime
    entries: list[LedgerEntry]


# --- User & Role Management ---


class UserCreate(BaseModel):
    """Request to create/invite a user with a role."""
    email: EmailStr
    role: UserRole
    merchant_id: Optional[str] = None  # Required for merchant_admin and staff


class User(BaseModel):
    """User record stored in Firestore."""
    uid: str
    email: str
    role: UserRole
    merchant_id: Optional[str] = None
    is_primary: bool = False  # True only for primary owner
    status: UserStatus = UserStatus.active
    created_at: datetime
    created_by: Optional[str] = None  # UID of user who created/invited


class PendingRole(BaseModel):
    """Pending role assignment for invited user who hasn't signed up yet."""
    id: str
    email: str
    role: UserRole
    merchant_id: Optional[str] = None
    created_by: str  # UID of inviter
    created_at: datetime
    expires_at: datetime  # 7 days after created_at
    claimed: bool = False


class ClaimRoleResponse(BaseModel):
    """Response after claiming a pending role."""
    success: bool
    message: str
    role: Optional[UserRole] = None
    merchant_id: Optional[str] = None


class UserResponse(BaseModel):
    """Response when creating/inviting a user."""
    email: str
    status: str  # "claimed" if user exists, "pending" if invite sent
    user_id: Optional[str] = None
    pending_id: Optional[str] = None


# --- Consumer ---


class ConsumerClaimResponse(BaseModel):
    """Response after a consumer claims an offer — contains their personal QR."""
    qr_data: str
    short_code: str
    expires_at: datetime
    offer_name: str
    merchant_name: str
    points_preview: int = 50


class ActiveClaim(BaseModel):
    """A claimed but not-yet-redeemed deal in the consumer wallet."""
    qr_data: str
    short_code: str
    expires_at: datetime
    offer_name: str
    merchant_name: str


class VisitHistoryItem(BaseModel):
    """A past visit entry for the consumer wallet."""
    merchant_name: str
    offer_name: str
    timestamp: datetime
    visit_number: int
    points_earned: int
    stamp_earned: bool = False


class WalletReward(BaseModel):
    """A reward available in the consumer wallet."""
    id: str
    description: str
    status: str
    merchant_name: str
    is_universal: bool = False
    earned_at: datetime
    expires_at: Optional[datetime] = None


class MerchantLoyaltyProgress(BaseModel):
    """Loyalty stamp progress for a consumer at a specific merchant."""
    merchant_id: str
    merchant_name: str
    current_stamps: int
    stamps_required: int
    reward_description: str
    visits_until_reward: int


class ConsumerWalletResponse(BaseModel):
    """Full wallet payload returned to the consumer."""
    active_claims: list[ActiveClaim] = []
    visit_history: list[VisitHistoryItem] = []
    total_points: int = 0
    rewards: list[WalletReward] = []
    merchant_loyalty: list[MerchantLoyaltyProgress] = []


# --- Loyalty ---


class RewardStatus(str, Enum):
    earned = "earned"
    redeemed = "redeemed"
    expired = "expired"


class LoyaltyConfigCreate(BaseModel):
    """Request to create/update a loyalty stamp program for a merchant."""
    stamps_required: int = Field(..., ge=1, le=100)
    reward_description: str = Field(..., min_length=1, max_length=200)
    reward_value: float = Field(..., ge=0)
    reset_on_reward: bool = True
    double_stamp_days: list[int] = Field(default_factory=list)  # 0=Mon .. 6=Sun
    birthday_reward: bool = False


class LoyaltyConfig(BaseModel):
    """Loyalty config stored in Firestore (keyed by merchant_id)."""
    merchant_id: str
    program_type: str = "stamps"
    stamps_required: int
    reward_description: str
    reward_value: float
    reset_on_reward: bool = True
    double_stamp_days: list[int] = Field(default_factory=list)
    birthday_reward: bool = False


class LoyaltyProgressResponse(BaseModel):
    """Current loyalty progress for a consumer at a merchant."""
    consumer_id: str
    merchant_id: str
    current_stamps: int = 0
    total_stamps: int = 0
    rewards_earned: int = 0
    rewards_redeemed: int = 0
    last_visit: Optional[datetime] = None


class RewardResponse(BaseModel):
    """A reward earned (or redeemed/expired) by a consumer."""
    id: str
    consumer_id: str
    merchant_id: str
    description: str
    status: RewardStatus
    earned_at: datetime
    redeemed_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None


# --- Customer Segmentation (Merchant-facing CRM) ---


class CustomerSegment(str, Enum):
    new = "new"
    returning = "returning"
    vip = "vip"
    at_risk = "at_risk"
    lost = "lost"


class LoyaltyStamps(BaseModel):
    """Current stamp progress for a customer at a merchant."""
    current: int = 0
    required: int = 0


class CustomerSummary(BaseModel):
    """Summary of a customer for the merchant customer list."""
    consumer_id: str
    display_name: str  # masked: "First L."
    visit_count: int
    last_visit: Optional[datetime] = None
    segment: CustomerSegment
    estimated_ltv: float
    loyalty_stamps: Optional[LoyaltyStamps] = None


class CustomerListResponse(BaseModel):
    """Response for the customer list endpoint."""
    customers: list[CustomerSummary]
    total: int
    segment_counts: dict[str, int]


class VisitTimelineItem(BaseModel):
    """A single visit in the customer detail timeline."""
    timestamp: datetime
    offer_name: str
    points_earned: int
    stamp_earned: bool = False


class CustomerDetail(BaseModel):
    """Full customer profile for the merchant detail view."""
    consumer_id: str
    display_name: str  # masked: "First L."
    visit_count: int
    last_visit: Optional[datetime] = None
    first_visit: Optional[datetime] = None
    segment: CustomerSegment
    estimated_ltv: float
    loyalty_stamps: Optional[LoyaltyStamps] = None
    visit_timeline: list[VisitTimelineItem] = []


class ConsumerRegisterRequest(BaseModel):
    """Request to register a consumer profile after Firebase Auth signup."""
    display_name: str = Field(..., min_length=1, max_length=100)
    zip_code: Optional[str] = Field(None, max_length=10)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)
    referred_by: Optional[str] = Field(None, max_length=20)  # Referral code


class ConsumerProfile(BaseModel):
    """Consumer profile stored in Firestore."""
    uid: str
    email: str
    phone: Optional[str] = None
    display_name: str
    home_zone_id: Optional[str] = None
    location_verified_at: Optional[datetime] = None
    zip_code: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    tier: ConsumerTier = ConsumerTier.free
    global_points: int = 0
    referral_code: str
    referred_by: Optional[str] = None
    created_at: datetime


# --- Automated Messages / Re-engagement ---


class AutomationTrigger(str, Enum):
    first_visit = "first_visit"
    at_risk = "at_risk"
    reward_earned = "reward_earned"


class AutomationRule(BaseModel):
    """A single automation rule within a merchant's config."""
    trigger: AutomationTrigger
    enabled: bool = False
    message_template: str = ""
    at_risk_days: int = Field(default=14, ge=1, le=90)  # Only used for at_risk trigger


class AutomationConfigUpdate(BaseModel):
    """Request to update automation config for a merchant."""
    rules: list[AutomationRule]


class AutomationConfigResponse(BaseModel):
    """Automation config returned from the API."""
    merchant_id: str
    rules: list[AutomationRule]


class AutomatedMessageRecord(BaseModel):
    """An automated message record (created when a message would be sent)."""
    id: str
    merchant_id: str
    consumer_id: str
    trigger: AutomationTrigger
    channel: str = "sms"
    message_body: str
    sent_at: datetime
    resulted_in_visit: bool = False


# --- Zones / Neighborhoods ---


class ZoneCenter(BaseModel):
    """Lat/lng center point for a zone."""
    lat: float
    lng: float


class Zone(BaseModel):
    """A geographic zone/neighborhood."""
    id: str
    name: str
    slug: str
    city: str
    center: ZoneCenter
    radius_miles: float = 2.0
    status: str = "active"
    merchant_count: int = 0
    deal_count: int = 0


class ZoneDeal(BaseModel):
    """An active deal within a zone, used in zone detail and deal list views."""
    offer_id: str
    offer_name: str
    merchant_name: str
    discount_text: str
    redemption_count: int = 0
    terms: Optional[str] = None


class ZoneMerchantSummary(BaseModel):
    """A merchant within a zone, with their active deals."""
    merchant_id: str
    merchant_name: str
    active_deals: list[ZoneDeal] = []


class ZoneDetail(Zone):
    """Zone detail: zone info plus merchants and their active deals."""
    merchants: list[ZoneMerchantSummary] = []


# --- Analytics (Retention Dashboard) ---


class RetentionCohort(BaseModel):
    """Weekly cohort retention data for the heatmap."""
    week_start: str  # ISO date string, e.g. "2025-01-06"
    new_customers: int
    retention_rates: list[float]  # Rates for weeks 1..5 (0.0-1.0)


class RetentionResponse(BaseModel):
    cohorts: list[RetentionCohort]


class DealPerformance(BaseModel):
    """Per-deal performance metrics."""
    offer_id: str
    offer_name: str
    redemption_count: int
    return_rate_14d: float  # 0.0-1.0
    return_rate_30d: float  # 0.0-1.0
    estimated_roi: float


class DealPerformanceResponse(BaseModel):
    deals: list[DealPerformance]


class LtvBucket(BaseModel):
    """LTV histogram bucket."""
    bucket_label: str
    count: int


class LtvResponse(BaseModel):
    buckets: list[LtvBucket]


class InsightResponse(BaseModel):
    """AI-generated or rule-based insights for a merchant."""
    insights: list[str]
    generated_at: datetime
    cached: bool


# --- Weekly Reports ---


# --- Merchant Invite / Onboarding ---


class InviteStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class MerchantInviteRequest(BaseModel):
    """Public request to join Boost as a merchant."""
    business_name: str = Field(..., min_length=1, max_length=100)
    owner_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: str = Field(..., min_length=7, max_length=20)
    category: str = Field(..., min_length=1, max_length=50)
    zone_slug: Optional[str] = Field(None, max_length=50)


class MerchantInvite(BaseModel):
    """Stored invite record."""
    id: str
    business_name: str
    owner_name: str
    email: str
    phone: str
    category: str
    zone_slug: Optional[str] = None
    status: InviteStatus = InviteStatus.pending
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None


class InviteListResponse(BaseModel):
    """Admin view of pending invites."""
    invites: list[MerchantInvite]
    pending_count: int


class InviteRejectBody(BaseModel):
    """Optional reason when rejecting an invite."""
    reason: Optional[str] = Field(None, max_length=500)


class WeeklyReportSummary(BaseModel):
    """Summary of a weekly merchant report."""
    id: str
    merchant_id: str
    week_start: str  # ISO date string
    week_end: str  # ISO date string
    new_customers: int = 0
    returning_customers: int = 0
    total_visits: int = 0
    top_deal: Optional[str] = None
    return_rate: float = 0.0  # 0.0-1.0
    return_rate_trend: Optional[str] = None  # "up", "down", "flat"
    rewards_earned: int = 0
    estimated_revenue: float = 0.0
    insights: list[str] = []
    generated_at: datetime
    html_body: Optional[str] = None  # Full rendered HTML (only in detail)


class WeeklyReportList(BaseModel):
    """List of weekly report summaries."""
    reports: list[WeeklyReportSummary]


# --- Referrals ---


class ReferralSubmit(BaseModel):
    """Request body to submit a referral code."""
    referral_code: str = Field(..., min_length=1, max_length=20)


class ReferralRecord(BaseModel):
    """A referral record stored in Firestore."""
    id: str
    referrer_id: str
    referred_id: str
    status: str  # "pending" | "completed"
    points_earned: int
    created_at: datetime


class ReferralCodeResponse(BaseModel):
    """Response containing the consumer's referral code."""
    code: str
    share_url: str


class ReferralListItem(BaseModel):
    """A single referral in the list response."""
    referred_name: str  # masked, e.g. "Jane D."
    status: str
    points_earned: int
    created_at: datetime


class ReferralListResponse(BaseModel):
    """List of referrals made by this consumer."""
    referrals: list[ReferralListItem]
    total_points_earned: int
