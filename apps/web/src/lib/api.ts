/**
 * API client for Boost backend.
 *
 * Uses the auth context to get the ID token for authenticated requests.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// --- Types (matching backend models) ---

export type OfferStatus = "active" | "paused" | "expired";
export type RedemptionMethod = "scan" | "manual";

export type MerchantStatus = "active" | "deleted";
export type UserRole = "owner" | "merchant_admin" | "staff";
export type UserStatus = "active" | "deleted" | "orphaned";

export interface Merchant {
  id: string;
  name: string;
  email: string;
  locations: string[];
  status: MerchantStatus;
  created_at: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface User {
  uid: string;
  email: string;
  role: UserRole;
  merchant_id?: string;
  is_primary: boolean;
  status: UserStatus;
  created_at: string;
  created_by?: string;
}

export interface PendingRole {
  id: string;
  email: string;
  role: UserRole;
  merchant_id?: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  claimed: boolean;
}

export interface ClaimRoleResponse {
  success: boolean;
  message: string;
  role?: UserRole;
  merchant_id?: string;
}

export interface UserResponse {
  email: string;
  status: "claimed" | "pending";
  user_id?: string;
  pending_id?: string;
}

export interface Offer {
  id: string;
  merchant_id: string;
  name: string;
  discount_text: string;
  terms?: string;
  cap_daily: number;
  active_hours?: string;
  status: OfferStatus;
  value_per_redemption: number;
  created_at: string;
  updated_at: string;
  today_redemptions: number;
  cap_remaining: number;
}

export interface Token {
  id: string;
  offer_id: string;
  short_code: string;
  qr_data: string;
  status: "active" | "redeemed" | "expired";
  expires_at: string;
  redeemed_at?: string;
  redeemed_by_location?: string;
  created_at: string;
  is_universal?: boolean;
  last_redeemed_at?: string;
  last_redeemed_by_location?: string;
}

export interface Redemption {
  id: string;
  token_id: string;
  offer_id: string;
  merchant_id: string;
  method: RedemptionMethod;
  location: string;
  value: number;
  timestamp: string;
}

export interface LedgerSummary {
  merchant_id: string;
  total_owed: number;
  redemption_count: number;
  entries: Array<{
    id: string;
    merchant_id: string;
    redemption_id: string;
    offer_id: string;
    amount: number;
    created_at: string;
  }>;
}

export interface RedeemResponse {
  success: boolean;
  message: string;
  offer_name?: string;
  discount_text?: string;
  redemption_id?: string;
}

// --- API Error ---

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

// --- Fetch helper ---

async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    let detail = "An error occurred";
    try {
      const data = await response.json();
      detail = data.detail || detail;
    } catch {
      // ignore parse error
    }
    throw new ApiError(response.status, detail);
  }

  return response.json();
}

// --- API functions ---

// Merchants

export async function createMerchant(
  token: string,
  data: { name: string; email: string; locations: string[] },
): Promise<Merchant> {
  return apiFetch("/merchants", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function listMerchants(token: string): Promise<{ merchants: Merchant[] }> {
  return apiFetch("/merchants", { token });
}

export async function getMerchant(token: string, merchantId: string): Promise<Merchant> {
  return apiFetch(`/merchants/${merchantId}`, { token });
}

// Offers

export async function createOffer(
  token: string,
  data: {
    merchant_id: string;
    name: string;
    discount_text: string;
    terms?: string;
    cap_daily?: number;
    active_hours?: string;
    value_per_redemption?: number;
  },
): Promise<Offer> {
  return apiFetch("/offers", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function listOffers(
  token: string,
  merchantId?: string,
): Promise<{ offers: Offer[] }> {
  const params = merchantId ? `?merchant_id=${merchantId}` : "";
  return apiFetch(`/offers${params}`, { token });
}

export async function getOffer(token: string, offerId: string): Promise<Offer> {
  return apiFetch(`/offers/${offerId}`, { token });
}

export async function updateOffer(
  token: string,
  offerId: string,
  data: Partial<{
    name: string;
    discount_text: string;
    terms: string;
    cap_daily: number;
    active_hours: string;
    status: OfferStatus;
    value_per_redemption: number;
  }>,
): Promise<Offer> {
  return apiFetch(`/offers/${offerId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteOffer(
  token: string,
  offerId: string,
): Promise<{ deleted: boolean; id: string }> {
  return apiFetch(`/offers/${offerId}`, {
    method: "DELETE",
    token,
  });
}

// Tokens

export async function generateTokens(
  token: string,
  offerId: string,
  count: number = 100,
  expiresDays: number = 30,
): Promise<{ offer_id: string; count: number; tokens: Token[] }> {
  return apiFetch(`/offers/${offerId}/tokens`, {
    method: "POST",
    body: JSON.stringify({ count, expires_days: expiresDays }),
    token,
  });
}

export async function listTokens(
  token: string,
  offerId: string,
  status?: "active" | "redeemed" | "expired",
): Promise<{ offer_id: string; tokens: Token[] }> {
  const params = status ? `?status=${status}` : "";
  return apiFetch(`/offers/${offerId}/tokens${params}`, { token });
}

export function getTokenQrUrl(tokenId: string): string {
  return `${API_BASE}/tokens/${tokenId}/qr`;
}

// Redemptions

export async function redeemToken(
  token: string,
  data: {
    token: string;
    location: string;
    method: RedemptionMethod;
  },
): Promise<RedeemResponse> {
  return apiFetch("/redeem", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function listRedemptions(
  token: string,
  options?: {
    merchantId?: string;
    offerId?: string;
    limit?: number;
  },
): Promise<{ redemptions: Redemption[] }> {
  const params = new URLSearchParams();
  if (options?.merchantId) params.set("merchant_id", options.merchantId);
  if (options?.offerId) params.set("offer_id", options.offerId);
  if (options?.limit) params.set("limit", String(options.limit));

  const queryString = params.toString();
  return apiFetch(`/redemptions${queryString ? `?${queryString}` : ""}`, { token });
}

// Ledger

export async function getLedger(
  token: string,
  merchantId?: string,
): Promise<LedgerSummary> {
  const params = merchantId ? `?merchant_id=${merchantId}` : "";
  return apiFetch(`/ledger${params}`, { token });
}

// User Management

export async function createUser(
  token: string,
  data: { email: string; role: UserRole; merchant_id?: string },
): Promise<UserResponse> {
  return apiFetch("/admin/users", {
    method: "POST",
    body: JSON.stringify(data),
    token,
  });
}

export async function claimRole(
  token: string,
): Promise<ClaimRoleResponse> {
  return apiFetch("/auth/claim-role", {
    method: "POST",
    token,
  });
}

export async function listUsers(
  token: string,
  merchantId?: string,
): Promise<{ users: User[]; pending: PendingRole[] }> {
  const params = merchantId ? `?merchant_id=${merchantId}` : "";
  return apiFetch(`/admin/users${params}`, { token });
}

export async function deleteUser(
  token: string,
  uid: string,
): Promise<{ deleted: boolean; uid: string }> {
  return apiFetch(`/admin/users/${uid}`, {
    method: "DELETE",
    token,
  });
}

// Merchant Management

export async function deleteMerchant(
  token: string,
  merchantId: string,
): Promise<{ deleted: boolean; id: string; orphaned_users: number }> {
  return apiFetch(`/merchants/${merchantId}`, {
    method: "DELETE",
    token,
  });
}

export async function restoreMerchant(
  token: string,
  merchantId: string,
): Promise<Merchant> {
  return apiFetch(`/merchants/${merchantId}/restore`, {
    method: "PATCH",
    token,
  });
}
