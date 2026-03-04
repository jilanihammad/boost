// Mock data for the retention-first dashboard

// --- Retention KPI data ---

export interface RetentionKpi {
  label: string
  value: string
  delta: number // positive = good, negative = bad
  deltaLabel: string
  prefix?: string
  suffix?: string
}

export const retentionKpis: RetentionKpi[] = [
  {
    label: "New Customers",
    value: "47",
    delta: 12,
    deltaLabel: "vs last week",
  },
  {
    label: "Returning Customers",
    value: "83",
    delta: 8,
    deltaLabel: "vs last week",
  },
  {
    label: "Return Rate",
    value: "63.8",
    delta: 4.2,
    deltaLabel: "vs last week",
    suffix: "%",
  },
  {
    label: "Est. LTV / Customer",
    value: "48",
    delta: -2,
    deltaLabel: "vs last week",
    prefix: "$",
  },
]

// --- Cohort retention heatmap data ---

export interface CohortRow {
  week_start: string
  new_customers: number
  retention_rates: number[] // week 1..5, values 0.0 - 1.0
}

export const cohortData: CohortRow[] = [
  {
    week_start: "2025-05-05",
    new_customers: 34,
    retention_rates: [0.56, 0.38, 0.29, 0.21, 0.18],
  },
  {
    week_start: "2025-05-12",
    new_customers: 41,
    retention_rates: [0.61, 0.45, 0.32, 0.24],
  },
  {
    week_start: "2025-05-19",
    new_customers: 38,
    retention_rates: [0.53, 0.39, 0.27],
  },
  {
    week_start: "2025-05-26",
    new_customers: 29,
    retention_rates: [0.48, 0.31],
  },
  {
    week_start: "2025-06-02",
    new_customers: 52,
    retention_rates: [0.65],
  },
  {
    week_start: "2025-06-09",
    new_customers: 47,
    retention_rates: [],
  },
]

// --- Deal performance data ---

export interface DealPerf {
  offer_id: string
  offer_name: string
  redemption_count: number
  return_rate_14d: number
  return_rate_30d: number
  estimated_roi: number
}

export const dealPerformance: DealPerf[] = [
  {
    offer_id: "offer-1",
    offer_name: "$2 off any coffee",
    redemption_count: 245,
    return_rate_14d: 0.68,
    return_rate_30d: 0.82,
    estimated_roi: 3.4,
  },
  {
    offer_id: "offer-2",
    offer_name: "Free pastry with purchase",
    redemption_count: 128,
    return_rate_14d: 0.42,
    return_rate_30d: 0.55,
    estimated_roi: 1.8,
  },
  {
    offer_id: "offer-3",
    offer_name: "10% off breakfast",
    redemption_count: 189,
    return_rate_14d: 0.51,
    return_rate_30d: 0.64,
    estimated_roi: 2.1,
  },
  {
    offer_id: "offer-4",
    offer_name: "Happy Hour BOGO",
    redemption_count: 97,
    return_rate_14d: 0.31,
    return_rate_30d: 0.43,
    estimated_roi: 0.9,
  },
]

// --- LTV distribution ---

export interface LtvBucketData {
  bucket_label: string
  count: number
}

export const ltvDistribution: LtvBucketData[] = [
  { bucket_label: "$0–10", count: 42 },
  { bucket_label: "$10–30", count: 78 },
  { bucket_label: "$30–60", count: 63 },
  { bucket_label: "$60–100", count: 31 },
  { bucket_label: "$100+", count: 16 },
]

// --- Recent activity feed ---

export type CustomerType = "NEW" | "Returning"

export interface ActivityItem {
  id: string
  time: string
  customer_name: string // masked: "First L."
  offer_name: string
  visit_number: number
  customer_type: CustomerType
}

export const recentActivity: ActivityItem[] = [
  {
    id: "a1",
    time: "2:34 PM",
    customer_name: "Sarah M.",
    offer_name: "$2 off any coffee",
    visit_number: 5,
    customer_type: "Returning",
  },
  {
    id: "a2",
    time: "2:21 PM",
    customer_name: "James L.",
    offer_name: "10% off breakfast",
    visit_number: 1,
    customer_type: "NEW",
  },
  {
    id: "a3",
    time: "2:15 PM",
    customer_name: "Maria G.",
    offer_name: "$2 off any coffee",
    visit_number: 3,
    customer_type: "Returning",
  },
  {
    id: "a4",
    time: "1:58 PM",
    customer_name: "Kevin T.",
    offer_name: "Free pastry with purchase",
    visit_number: 1,
    customer_type: "NEW",
  },
  {
    id: "a5",
    time: "1:42 PM",
    customer_name: "Ashley R.",
    offer_name: "$2 off any coffee",
    visit_number: 8,
    customer_type: "Returning",
  },
  {
    id: "a6",
    time: "1:30 PM",
    customer_name: "David K.",
    offer_name: "Happy Hour BOGO",
    visit_number: 2,
    customer_type: "Returning",
  },
  {
    id: "a7",
    time: "1:15 PM",
    customer_name: "Lisa W.",
    offer_name: "10% off breakfast",
    visit_number: 1,
    customer_type: "NEW",
  },
  {
    id: "a8",
    time: "12:48 PM",
    customer_name: "Chris H.",
    offer_name: "$2 off any coffee",
    visit_number: 4,
    customer_type: "Returning",
  },
  {
    id: "a9",
    time: "12:30 PM",
    customer_name: "Emma P.",
    offer_name: "Free pastry with purchase",
    visit_number: 6,
    customer_type: "Returning",
  },
  {
    id: "a10",
    time: "12:12 PM",
    customer_name: "Ryan B.",
    offer_name: "10% off breakfast",
    visit_number: 1,
    customer_type: "NEW",
  },
]

// --- Billing data (preserved from original dashboard) ---

export interface BillingMetrics {
  today_redemptions: number
  wtd_redemptions: number
  amount_owed_wtd: number
}

export const billingMetrics: BillingMetrics = {
  today_redemptions: 62,
  wtd_redemptions: 287,
  amount_owed_wtd: 574.0,
}
