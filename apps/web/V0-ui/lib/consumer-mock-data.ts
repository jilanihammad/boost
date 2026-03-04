// ============================================================
// Mock data for consumer browse pages
// ============================================================

export interface Zone {
  id: string
  slug: string
  name: string
  merchant_count: number
  deal_count: number
}

export interface ConsumerMerchant {
  id: string
  name: string
  category: string
  zone_slug: string
  zone_name: string
  logo_url: string | null
}

export interface ConsumerDeal {
  id: string
  merchant_id: string
  merchant_name: string
  merchant_category: string
  merchant_logo_url: string | null
  zone_slug: string
  zone_name: string
  headline: string
  description: string
  discount_text: string
  discount_value: string
  terms: string
  daily_cap: number
  remaining_today: number
  active_hours: string
  valid_from: string
  valid_until: string
  redemption_count: number
  created_at: string
  status: "active" | "expiring_soon" | "sold_out"
}

// --- Zones ---

export const zones: Zone[] = [
  {
    id: "zone-1",
    slug: "gastown",
    name: "Gastown",
    merchant_count: 12,
    deal_count: 18,
  },
  {
    id: "zone-2",
    slug: "kitsilano",
    name: "Kitsilano",
    merchant_count: 9,
    deal_count: 14,
  },
  {
    id: "zone-3",
    slug: "mount-pleasant",
    name: "Mount Pleasant",
    merchant_count: 15,
    deal_count: 22,
  },
  {
    id: "zone-4",
    slug: "commercial-drive",
    name: "Commercial Drive",
    merchant_count: 11,
    deal_count: 16,
  },
  {
    id: "zone-5",
    slug: "main-street",
    name: "Main Street",
    merchant_count: 8,
    deal_count: 11,
  },
  {
    id: "zone-6",
    slug: "yaletown",
    name: "Yaletown",
    merchant_count: 7,
    deal_count: 9,
  },
]

// --- Merchants ---

export const consumerMerchants: ConsumerMerchant[] = [
  {
    id: "m-1",
    name: "Urban Bites Cafe",
    category: "Food & Drink",
    zone_slug: "gastown",
    zone_name: "Gastown",
    logo_url: null,
  },
  {
    id: "m-2",
    name: "The Roasted Bean",
    category: "Food & Drink",
    zone_slug: "gastown",
    zone_name: "Gastown",
    logo_url: null,
  },
  {
    id: "m-3",
    name: "Fresh & Local Market",
    category: "Retail",
    zone_slug: "kitsilano",
    zone_name: "Kitsilano",
    logo_url: null,
  },
  {
    id: "m-4",
    name: "Zen Yoga Studio",
    category: "Fitness",
    zone_slug: "kitsilano",
    zone_name: "Kitsilano",
    logo_url: null,
  },
  {
    id: "m-5",
    name: "Pixel Perfect Prints",
    category: "Services",
    zone_slug: "mount-pleasant",
    zone_name: "Mount Pleasant",
    logo_url: null,
  },
  {
    id: "m-6",
    name: "Sunrise Bakery",
    category: "Food & Drink",
    zone_slug: "mount-pleasant",
    zone_name: "Mount Pleasant",
    logo_url: null,
  },
  {
    id: "m-7",
    name: "Vinyl Revival Records",
    category: "Retail",
    zone_slug: "commercial-drive",
    zone_name: "Commercial Drive",
    logo_url: null,
  },
  {
    id: "m-8",
    name: "Bella Cucina",
    category: "Food & Drink",
    zone_slug: "commercial-drive",
    zone_name: "Commercial Drive",
    logo_url: null,
  },
  {
    id: "m-9",
    name: "Green Thumb Garden Centre",
    category: "Retail",
    zone_slug: "main-street",
    zone_name: "Main Street",
    logo_url: null,
  },
  {
    id: "m-10",
    name: "Quick Clip Barbers",
    category: "Services",
    zone_slug: "main-street",
    zone_name: "Main Street",
    logo_url: null,
  },
  {
    id: "m-11",
    name: "Coast & Co. Bar",
    category: "Food & Drink",
    zone_slug: "yaletown",
    zone_name: "Yaletown",
    logo_url: null,
  },
  {
    id: "m-12",
    name: "Glow Skin Studio",
    category: "Beauty",
    zone_slug: "yaletown",
    zone_name: "Yaletown",
    logo_url: null,
  },
]

// --- Deals ---

export const consumerDeals: ConsumerDeal[] = [
  {
    id: "deal-1",
    merchant_id: "m-1",
    merchant_name: "Urban Bites Cafe",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "gastown",
    zone_name: "Gastown",
    headline: "$2 Off Any Coffee",
    description:
      "Start your morning right with $2 off any coffee drink at Urban Bites. Choose from our signature espresso, cold brew, or seasonal specials. Valid every day during morning hours.",
    discount_text: "$2 off",
    discount_value: "$2",
    terms: "Valid on any coffee drink. One per customer per day. Cannot be combined with other offers.",
    daily_cap: 50,
    remaining_today: 18,
    active_hours: "7:00 AM – 3:00 PM",
    valid_from: "2025-06-01",
    valid_until: "2025-08-31",
    redemption_count: 284,
    created_at: "2025-06-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-2",
    merchant_id: "m-1",
    merchant_name: "Urban Bites Cafe",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "gastown",
    zone_name: "Gastown",
    headline: "Free Pastry with Purchase",
    description:
      "Enjoy a complimentary pastry when you spend $5 or more at Urban Bites. Choose from croissants, muffins, or our famous cinnamon rolls.",
    discount_text: "Free item",
    discount_value: "FREE",
    terms: "Free pastry with any purchase over $5. One per customer per day.",
    daily_cap: 25,
    remaining_today: 12,
    active_hours: "All day",
    valid_from: "2025-06-15",
    valid_until: "2025-09-15",
    redemption_count: 156,
    created_at: "2025-06-15T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-3",
    merchant_id: "m-2",
    merchant_name: "The Roasted Bean",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "gastown",
    zone_name: "Gastown",
    headline: "Buy One Get One Free Lattes",
    description:
      "Bring a friend and enjoy two lattes for the price of one. Perfect for catch-ups over coffee at our cozy Gastown location.",
    discount_text: "BOGO",
    discount_value: "BOGO",
    terms: "Buy one latte, get second free. Same size or smaller. Dine-in only.",
    daily_cap: 30,
    remaining_today: 8,
    active_hours: "2:00 PM – 6:00 PM",
    valid_from: "2025-07-01",
    valid_until: "2025-09-30",
    redemption_count: 203,
    created_at: "2025-07-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-4",
    merchant_id: "m-3",
    merchant_name: "Fresh & Local Market",
    merchant_category: "Retail",
    merchant_logo_url: null,
    zone_slug: "kitsilano",
    zone_name: "Kitsilano",
    headline: "15% Off Organic Produce",
    description:
      "Get 15% off all organic fruits and vegetables. Support local farmers and eat fresh with this weekly deal.",
    discount_text: "15% off",
    discount_value: "15%",
    terms: "Valid on organic produce only. Cannot combine with loyalty rewards.",
    daily_cap: 40,
    remaining_today: 22,
    active_hours: "8:00 AM – 8:00 PM",
    valid_from: "2025-06-01",
    valid_until: "2025-12-31",
    redemption_count: 412,
    created_at: "2025-06-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-5",
    merchant_id: "m-4",
    merchant_name: "Zen Yoga Studio",
    merchant_category: "Fitness",
    merchant_logo_url: null,
    zone_slug: "kitsilano",
    zone_name: "Kitsilano",
    headline: "First Class Free",
    description:
      "Try any yoga class absolutely free — no commitment, no strings attached. Choose from Vinyasa, Hatha, or Restorative sessions.",
    discount_text: "Free class",
    discount_value: "FREE",
    terms: "New students only. One free class per person. Must book in advance.",
    daily_cap: 10,
    remaining_today: 3,
    active_hours: "6:00 AM – 9:00 PM",
    valid_from: "2025-05-01",
    valid_until: "2025-12-31",
    redemption_count: 189,
    created_at: "2025-05-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-6",
    merchant_id: "m-5",
    merchant_name: "Pixel Perfect Prints",
    merchant_category: "Services",
    merchant_logo_url: null,
    zone_slug: "mount-pleasant",
    zone_name: "Mount Pleasant",
    headline: "50% Off First Print Order",
    description:
      "Half price on your first custom print order. Business cards, posters, flyers — whatever you need to make an impression.",
    discount_text: "50% off",
    discount_value: "50%",
    terms: "First order only. Max discount $50. Standard turnaround time.",
    daily_cap: 5,
    remaining_today: 2,
    active_hours: "9:00 AM – 5:00 PM",
    valid_from: "2025-07-01",
    valid_until: "2025-10-31",
    redemption_count: 67,
    created_at: "2025-07-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-7",
    merchant_id: "m-6",
    merchant_name: "Sunrise Bakery",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "mount-pleasant",
    zone_name: "Mount Pleasant",
    headline: "$5 Off Birthday Cakes",
    description:
      "Celebrating a birthday? Get $5 off any cake order from our award-winning bakery. Custom designs available with 48-hour notice.",
    discount_text: "$5 off",
    discount_value: "$5",
    terms: "Valid on cake orders $25+. One per customer. Order 48 hours in advance for custom designs.",
    daily_cap: 8,
    remaining_today: 5,
    active_hours: "7:00 AM – 6:00 PM",
    valid_from: "2025-06-01",
    valid_until: "2025-12-31",
    redemption_count: 143,
    created_at: "2025-06-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-8",
    merchant_id: "m-7",
    merchant_name: "Vinyl Revival Records",
    merchant_category: "Retail",
    merchant_logo_url: null,
    zone_slug: "commercial-drive",
    zone_name: "Commercial Drive",
    headline: "Buy 2 Get 1 Free on Used Vinyl",
    description:
      "Dig through our crates and score an extra record free. With 10,000+ titles spanning jazz, rock, hip-hop, and more, there's something for everyone.",
    discount_text: "Buy 2 Get 1",
    discount_value: "B2G1",
    terms: "Used vinyl only. Free record must be equal or lesser value.",
    daily_cap: 20,
    remaining_today: 14,
    active_hours: "11:00 AM – 8:00 PM",
    valid_from: "2025-06-15",
    valid_until: "2025-09-30",
    redemption_count: 98,
    created_at: "2025-06-15T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-9",
    merchant_id: "m-8",
    merchant_name: "Bella Cucina",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "commercial-drive",
    zone_name: "Commercial Drive",
    headline: "20% Off Dinner for Two",
    description:
      "Enjoy an authentic Italian dinner with 20% off when dining as a couple. Includes our handmade pasta, fresh seafood, and signature tiramisu.",
    discount_text: "20% off",
    discount_value: "20%",
    terms: "Valid for parties of 2. Dine-in only. Excludes drinks and specials menu.",
    daily_cap: 15,
    remaining_today: 15,
    active_hours: "5:00 PM – 10:00 PM",
    valid_from: "2025-07-01",
    valid_until: "2025-10-31",
    redemption_count: 176,
    created_at: "2025-07-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-10",
    merchant_id: "m-9",
    merchant_name: "Green Thumb Garden Centre",
    merchant_category: "Retail",
    merchant_logo_url: null,
    zone_slug: "main-street",
    zone_name: "Main Street",
    headline: "Free Succulent with $20 Purchase",
    description:
      "Take home a beautiful succulent absolutely free when you spend $20 or more. Perfect for brightening up your desk or windowsill.",
    discount_text: "Free gift",
    discount_value: "FREE",
    terms: "While supplies last. One per customer. Spend $20+ before tax.",
    daily_cap: 15,
    remaining_today: 9,
    active_hours: "9:00 AM – 6:00 PM",
    valid_from: "2025-06-01",
    valid_until: "2025-09-30",
    redemption_count: 231,
    created_at: "2025-06-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-11",
    merchant_id: "m-10",
    merchant_name: "Quick Clip Barbers",
    merchant_category: "Services",
    merchant_logo_url: null,
    zone_slug: "main-street",
    zone_name: "Main Street",
    headline: "$5 Off Your First Haircut",
    description:
      "New to Quick Clip? Get $5 off your first haircut or beard trim. Walk-ins welcome, appointments preferred.",
    discount_text: "$5 off",
    discount_value: "$5",
    terms: "New customers only. One per person. Valid on haircuts and beard trims.",
    daily_cap: 10,
    remaining_today: 6,
    active_hours: "9:00 AM – 7:00 PM",
    valid_from: "2025-05-15",
    valid_until: "2025-12-31",
    redemption_count: 312,
    created_at: "2025-05-15T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-12",
    merchant_id: "m-11",
    merchant_name: "Coast & Co. Bar",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "yaletown",
    zone_name: "Yaletown",
    headline: "Happy Hour: $3 Off Cocktails",
    description:
      "Kick off your evening with $3 off any cocktail during happy hour. Try our famous Yaletown Mule or seasonal specials.",
    discount_text: "$3 off",
    discount_value: "$3",
    terms: "Happy hour only (4-6 PM). One per customer per visit. Must be 19+.",
    daily_cap: 30,
    remaining_today: 30,
    active_hours: "4:00 PM – 6:00 PM",
    valid_from: "2025-06-01",
    valid_until: "2025-10-31",
    redemption_count: 387,
    created_at: "2025-06-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-13",
    merchant_id: "m-12",
    merchant_name: "Glow Skin Studio",
    merchant_category: "Beauty",
    merchant_logo_url: null,
    zone_slug: "yaletown",
    zone_name: "Yaletown",
    headline: "30% Off First Facial",
    description:
      "Treat yourself to a professional facial at 30% off. Our licensed estheticians customize every treatment to your skin type.",
    discount_text: "30% off",
    discount_value: "30%",
    terms: "New clients only. Book online or by phone. 24-hour cancellation policy.",
    daily_cap: 4,
    remaining_today: 1,
    active_hours: "10:00 AM – 7:00 PM",
    valid_from: "2025-07-01",
    valid_until: "2025-12-31",
    redemption_count: 89,
    created_at: "2025-07-01T00:00:00Z",
    status: "expiring_soon",
  },
  {
    id: "deal-14",
    merchant_id: "m-6",
    merchant_name: "Sunrise Bakery",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "mount-pleasant",
    zone_name: "Mount Pleasant",
    headline: "Free Coffee with Any Pastry",
    description:
      "Enjoy a free drip coffee with any pastry purchase. Freshly brewed every hour — the perfect pairing for our house-made croissants.",
    discount_text: "Free coffee",
    discount_value: "FREE",
    terms: "Drip coffee only. One per customer per day. Cannot combine with other offers.",
    daily_cap: 20,
    remaining_today: 11,
    active_hours: "7:00 AM – 11:00 AM",
    valid_from: "2025-07-01",
    valid_until: "2025-09-30",
    redemption_count: 198,
    created_at: "2025-07-01T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-15",
    merchant_id: "m-8",
    merchant_name: "Bella Cucina",
    merchant_category: "Food & Drink",
    merchant_logo_url: null,
    zone_slug: "commercial-drive",
    zone_name: "Commercial Drive",
    headline: "Free Dessert with Lunch",
    description:
      "Order any lunch entrée and enjoy a free dessert from our Italian dessert menu. Choose tiramisu, panna cotta, or gelato.",
    discount_text: "Free dessert",
    discount_value: "FREE",
    terms: "Lunch hours only. Dine-in. One per customer per visit.",
    daily_cap: 12,
    remaining_today: 7,
    active_hours: "11:30 AM – 2:30 PM",
    valid_from: "2025-07-15",
    valid_until: "2025-10-15",
    redemption_count: 124,
    created_at: "2025-07-15T00:00:00Z",
    status: "active",
  },
  {
    id: "deal-16",
    merchant_id: "m-3",
    merchant_name: "Fresh & Local Market",
    merchant_category: "Retail",
    merchant_logo_url: null,
    zone_slug: "kitsilano",
    zone_name: "Kitsilano",
    headline: "Free Reusable Bag with $30 Spend",
    description:
      "Shop sustainably! Get a free branded reusable tote bag when you spend $30 or more. Limited edition summer designs available.",
    discount_text: "Free gift",
    discount_value: "FREE",
    terms: "While supplies last. $30 minimum before tax. One per customer.",
    daily_cap: 20,
    remaining_today: 13,
    active_hours: "8:00 AM – 8:00 PM",
    valid_from: "2025-07-01",
    valid_until: "2025-08-31",
    redemption_count: 87,
    created_at: "2025-07-01T00:00:00Z",
    status: "expiring_soon",
  },
]

// --- Helper functions ---

export const categories = [
  "All",
  "Food & Drink",
  "Retail",
  "Services",
  "Fitness",
  "Beauty",
] as const

export type DealCategory = (typeof categories)[number]

export function getDealsByZone(zoneSlug: string): ConsumerDeal[] {
  return consumerDeals
    .filter((d) => d.zone_slug === zoneSlug)
    .sort((a, b) => b.redemption_count - a.redemption_count)
}

export function getFeaturedDeals(zoneSlug: string, limit = 6): ConsumerDeal[] {
  return getDealsByZone(zoneSlug).slice(0, limit)
}

export function getDealById(id: string): ConsumerDeal | undefined {
  return consumerDeals.find((d) => d.id === id)
}

export function getDealsByMerchant(merchantId: string): ConsumerDeal[] {
  return consumerDeals.filter((d) => d.merchant_id === merchantId)
}

export function getZoneBySlug(slug: string): Zone | undefined {
  return zones.find((z) => z.slug === slug)
}

export function getMerchantById(id: string): ConsumerMerchant | undefined {
  return consumerMerchants.find((m) => m.id === id)
}

/** Get the first letter(s) for a merchant avatar placeholder */
export function getMerchantInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
