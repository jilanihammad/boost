// ============================================================
// Mock data for the Boost merchant dashboard
// ============================================================

export type OfferStatus = "running" | "paused" | "cap_hit" | "expired"

export interface Merchant {
  id: string
  name: string
  locations: string[]
}

export interface Offer {
  id: string
  name: string
  status: OfferStatus
  cap_total_daily: number
  cap_remaining_today: number
  hours: string
  discount_text: string
  terms: string
  today_redemptions: number
}

export interface Metrics {
  today_redemptions: number
  wtd_redemptions: number
  amount_owed_wtd: number
}

export interface Redemption {
  id: string
  timestamp: string
  offer_name: string
  method: "scan" | "manual"
  discount_text: string
  status: "success" | "failed"
}

// --- Retention / Analytics types ---

export interface RetentionKPI {
  newCustomers: number
  newCustomersDelta: number // week-over-week change
  returningCustomers: number
  returningCustomersDelta: number
  returnRate: number // 0-100
  returnRateDelta: number
  estLtv: number
  estLtvDelta: number
}

export interface RetentionCohort {
  weekStart: string
  newCustomers: number
  retentionRates: number[] // weeks 1-5, -1 = N/A
}

export interface DealPerformance {
  offerId: string
  offerName: string
  redemptionCount: number
  returnRate14d: number // 0-1
  returnRate30d: number
  estimatedRoi: number
}

export interface RecentActivity {
  id: string
  time: string
  customerName: string // masked: "Sarah L."
  offerName: string
  visitNumber: number
  isNew: boolean
}

// --- Existing merchant / offer data (kept for backward compat) ---

export const merchant: Merchant = {
  id: "merchant-1",
  name: "Urban Bites Cafe",
  locations: ["Downtown", "Midtown", "Uptown"],
}

export const offers: Offer[] = [
  {
    id: "offer-1",
    name: "$2 off any coffee",
    status: "running",
    cap_total_daily: 50,
    cap_remaining_today: 18,
    hours: "7AM - 3PM",
    discount_text: "$2 off",
    terms: "Valid on any coffee drink. One per customer per day.",
    today_redemptions: 32,
  },
  {
    id: "offer-2",
    name: "Free pastry with purchase",
    status: "paused",
    cap_total_daily: 25,
    cap_remaining_today: 25,
    hours: "All day",
    discount_text: "Free item",
    terms: "Free pastry with any purchase over $5.",
    today_redemptions: 0,
  },
  {
    id: "offer-3",
    name: "10% off breakfast",
    status: "cap_hit",
    cap_total_daily: 30,
    cap_remaining_today: 0,
    hours: "7AM - 11AM",
    discount_text: "10% off",
    terms: "10% off breakfast menu items.",
    today_redemptions: 30,
  },
  {
    id: "offer-4",
    name: "Happy Hour BOGO",
    status: "expired",
    cap_total_daily: 40,
    cap_remaining_today: 0,
    hours: "4PM - 6PM",
    discount_text: "BOGO",
    terms: "Buy one get one free on select drinks.",
    today_redemptions: 0,
  },
]

export const metrics: Metrics = {
  today_redemptions: 62,
  wtd_redemptions: 287,
  amount_owed_wtd: 574.0,
}

export const redemptions: Redemption[] = [
  {
    id: "r1",
    timestamp: "2:34 PM",
    offer_name: "$2 off any coffee",
    method: "scan",
    discount_text: "$2 off",
    status: "success",
  },
  {
    id: "r2",
    timestamp: "2:21 PM",
    offer_name: "$2 off any coffee",
    method: "manual",
    discount_text: "$2 off",
    status: "success",
  },
  {
    id: "r3",
    timestamp: "2:15 PM",
    offer_name: "10% off breakfast",
    method: "scan",
    discount_text: "10% off",
    status: "failed",
  },
  {
    id: "r4",
    timestamp: "1:58 PM",
    offer_name: "$2 off any coffee",
    method: "scan",
    discount_text: "$2 off",
    status: "success",
  },
  {
    id: "r5",
    timestamp: "1:42 PM",
    offer_name: "$2 off any coffee",
    method: "scan",
    discount_text: "$2 off",
    status: "success",
  },
  {
    id: "r6",
    timestamp: "1:30 PM",
    offer_name: "$2 off any coffee",
    method: "manual",
    discount_text: "$2 off",
    status: "success",
  },
  {
    id: "r7",
    timestamp: "1:15 PM",
    offer_name: "10% off breakfast",
    method: "scan",
    discount_text: "10% off",
    status: "success",
  },
  {
    id: "r8",
    timestamp: "12:48 PM",
    offer_name: "$2 off any coffee",
    method: "scan",
    discount_text: "$2 off",
    status: "success",
  },
]

// Chart data for the last 14 days
export const redemptionsByDay = [
  { day: "Jan 16", count: 42 },
  { day: "Jan 17", count: 38 },
  { day: "Jan 18", count: 55 },
  { day: "Jan 19", count: 48 },
  { day: "Jan 20", count: 31 },
  { day: "Jan 21", count: 27 },
  { day: "Jan 22", count: 44 },
  { day: "Jan 23", count: 52 },
  { day: "Jan 24", count: 61 },
  { day: "Jan 25", count: 58 },
  { day: "Jan 26", count: 45 },
  { day: "Jan 27", count: 39 },
  { day: "Jan 28", count: 51 },
  { day: "Jan 29", count: 62 },
]

export const methodSplit = [
  { name: "Scan", value: 78, fill: "oklch(0.72 0.15 195)" },
  { name: "Manual", value: 22, fill: "oklch(0.7 0.15 85)" },
]

// ============================================================
// Retention-first dashboard mock data
// ============================================================

export const retentionKPI: RetentionKPI = {
  newCustomers: 47,
  newCustomersDelta: 12, // +12 vs last week
  returningCustomers: 83,
  returningCustomersDelta: 7,
  returnRate: 64,
  returnRateDelta: 3, // +3 percentage points
  estLtv: 38.5,
  estLtvDelta: 2.1,
}

export const retentionCohorts: RetentionCohort[] = [
  {
    weekStart: "2025-05-26",
    newCustomers: 38,
    retentionRates: [0.55, 0.42, 0.31, 0.26, 0.22],
  },
  {
    weekStart: "2025-06-02",
    newCustomers: 42,
    retentionRates: [0.52, 0.38, 0.29, 0.24, -1],
  },
  {
    weekStart: "2025-06-09",
    newCustomers: 35,
    retentionRates: [0.60, 0.45, 0.33, -1, -1],
  },
  {
    weekStart: "2025-06-16",
    newCustomers: 51,
    retentionRates: [0.47, 0.35, -1, -1, -1],
  },
  {
    weekStart: "2025-06-23",
    newCustomers: 44,
    retentionRates: [0.57, -1, -1, -1, -1],
  },
  {
    weekStart: "2025-06-30",
    newCustomers: 47,
    retentionRates: [-1, -1, -1, -1, -1],
  },
]

export const dealPerformance: DealPerformance[] = [
  {
    offerId: "offer-1",
    offerName: "$2 off any coffee",
    redemptionCount: 284,
    returnRate14d: 0.62,
    returnRate30d: 0.71,
    estimatedRoi: 3.8,
  },
  {
    offerId: "offer-3",
    offerName: "10% off breakfast",
    redemptionCount: 156,
    returnRate14d: 0.45,
    returnRate30d: 0.58,
    estimatedRoi: 2.4,
  },
  {
    offerId: "offer-2",
    offerName: "Free pastry with purchase",
    redemptionCount: 89,
    returnRate14d: 0.38,
    returnRate30d: 0.52,
    estimatedRoi: 1.9,
  },
  {
    offerId: "offer-4",
    offerName: "Happy Hour BOGO",
    redemptionCount: 67,
    returnRate14d: 0.21,
    returnRate30d: 0.34,
    estimatedRoi: 1.2,
  },
]

export const recentActivity: RecentActivity[] = [
  { id: "a1", time: "2:34 PM", customerName: "Sarah L.", offerName: "$2 off any coffee", visitNumber: 4, isNew: false },
  { id: "a2", time: "2:21 PM", customerName: "Mike T.", offerName: "$2 off any coffee", visitNumber: 1, isNew: true },
  { id: "a3", time: "2:15 PM", customerName: "Aisha K.", offerName: "10% off breakfast", visitNumber: 7, isNew: false },
  { id: "a4", time: "1:58 PM", customerName: "Jordan P.", offerName: "$2 off any coffee", visitNumber: 2, isNew: false },
  { id: "a5", time: "1:42 PM", customerName: "Emily C.", offerName: "Free pastry with purchase", visitNumber: 1, isNew: true },
  { id: "a6", time: "1:30 PM", customerName: "Raj M.", offerName: "$2 off any coffee", visitNumber: 5, isNew: false },
  { id: "a7", time: "1:15 PM", customerName: "Chen W.", offerName: "10% off breakfast", visitNumber: 3, isNew: false },
  { id: "a8", time: "12:48 PM", customerName: "Lisa B.", offerName: "$2 off any coffee", visitNumber: 1, isNew: true },
  { id: "a9", time: "12:30 PM", customerName: "Tom R.", offerName: "Happy Hour BOGO", visitNumber: 2, isNew: false },
  { id: "a10", time: "12:15 PM", customerName: "Nina S.", offerName: "$2 off any coffee", visitNumber: 6, isNew: false },
]
