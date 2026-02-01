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
