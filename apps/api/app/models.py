"""Pydantic models for request/response validation."""

from datetime import datetime
from enum import Enum
from typing import Annotated, Optional

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

class OfferCreate(BaseModel):
    merchant_id: str
    name: str = Field(..., min_length=1, max_length=100)
    discount_text: str = Field(..., min_length=1, max_length=100)  # e.g., "$2 off any coffee"
    terms: Optional[str] = Field(None, max_length=500)
    cap_daily: int = Field(50, ge=1, le=10000)  # Max redemptions per day
    active_hours: Optional[str] = None  # e.g., "9am-5pm" (display only for v0)
    value_per_redemption: float = Field(2.0, ge=0.01)  # Amount merchant owes per redemption


class OfferUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    discount_text: Optional[str] = Field(None, min_length=1, max_length=100)
    terms: Optional[str] = Field(None, max_length=500)
    cap_daily: Optional[int] = Field(None, ge=1, le=10000)
    active_hours: Optional[str] = None
    status: Optional[OfferStatus] = None
    value_per_redemption: Optional[float] = Field(None, ge=0.01)


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
