"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ConsumerNav } from "@/components/consumer-nav"
import { DealCard } from "@/components/deal-card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  getZoneBySlug,
  getDealsByZone,
  categories,
  type DealCategory,
  type ConsumerDeal,
} from "@/lib/consumer-mock-data"
import { MapPin, ArrowLeft, SlidersHorizontal } from "lucide-react"

type SortOption = "popular" | "newest" | "expiring"

function sortDeals(deals: ConsumerDeal[], sort: SortOption): ConsumerDeal[] {
  const copy = [...deals]
  switch (sort) {
    case "popular":
      return copy.sort((a, b) => b.redemption_count - a.redemption_count)
    case "newest":
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    case "expiring":
      return copy.sort(
        (a, b) =>
          new Date(a.valid_until).getTime() - new Date(b.valid_until).getTime()
      )
    default:
      return copy
  }
}

export default function ZoneDealsPage() {
  const params = useParams()
  const slug = params.slug as string

  const [category, setCategory] = useState<DealCategory>("All")
  const [sort, setSort] = useState<SortOption>("popular")

  const zone = getZoneBySlug(slug)
  const allDeals = getDealsByZone(slug)

  const filteredDeals = useMemo(() => {
    let deals = allDeals
    if (category !== "All") {
      deals = deals.filter((d) => d.merchant_category === category)
    }
    return sortDeals(deals, sort)
  }, [allDeals, category, sort])

  if (!zone) {
    return (
      <div className="min-h-screen bg-background">
        <ConsumerNav />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Zone not found</h1>
          <p className="mt-2 text-muted-foreground">
            The zone you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <ConsumerNav />

      {/* Zone header */}
      <section className="border-b border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All Zones
          </Link>
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">{zone.name}</h1>
          </div>
          <p className="mt-2 text-muted-foreground">
            {allDeals.length} {allDeals.length === 1 ? "deal" : "deals"} from{" "}
            {zone.merchant_count} local{" "}
            {zone.merchant_count === 1 ? "business" : "businesses"}
          </p>
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-14 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <SlidersHorizontal className="hidden h-4 w-4 text-muted-foreground sm:block" />

          {/* Category filter */}
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as DealCategory)}
          >
            <SelectTrigger className="h-9 w-[150px] text-sm">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as SortOption)}
          >
            <SelectTrigger className="h-9 w-[140px] text-sm">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="popular">Popular</SelectItem>
              <SelectItem value="newest">Newest</SelectItem>
              <SelectItem value="expiring">Expiring Soon</SelectItem>
            </SelectContent>
          </Select>

          {/* Result count */}
          <span className="ml-auto text-xs text-muted-foreground">
            {filteredDeals.length}{" "}
            {filteredDeals.length === 1 ? "deal" : "deals"}
          </span>
        </div>
      </section>

      {/* Deal cards grid */}
      <section className="mx-auto max-w-5xl px-4 py-8">
        {filteredDeals.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} variant="full" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">
              No deals match your filters.{" "}
              <button
                onClick={() => {
                  setCategory("All")
                  setSort("popular")
                }}
                className="text-primary hover:underline"
              >
                Clear filters
              </button>
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              © 2025 Boost. All rights reserved.
            </p>
            <div className="flex gap-4">
              <Link
                href="/login"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sign In
              </Link>
              <Link
                href="/join"
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                For Business
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
