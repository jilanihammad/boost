"use client"

import { useState, useMemo } from "react"
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
import { zones, getFeaturedDeals, type Zone } from "@/lib/consumer-mock-data"
import { MapPin, ArrowRight, Zap, Store, Sparkles } from "lucide-react"

export default function HomePage() {
  const [selectedZone, setSelectedZone] = useState<string>(zones[0].slug)

  const featuredDeals = useMemo(
    () => getFeaturedDeals(selectedZone, 6),
    [selectedZone]
  )

  const currentZone = zones.find((z) => z.slug === selectedZone) ?? zones[0]

  return (
    <div className="min-h-screen bg-background">
      <ConsumerNav />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            {/* Pill badge */}
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Local deals, real savings
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Discover local deals{" "}
              <span className="text-primary">near you</span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Browse exclusive offers from businesses in your neighbourhood.
              Show up, show your code, save money.
            </p>

            {/* Zone selector */}
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3 sm:flex-row">
              <div className="relative w-full sm:flex-1">
                <Select
                  value={selectedZone}
                  onValueChange={setSelectedZone}
                >
                  <SelectTrigger className="h-12 w-full bg-card text-base pl-10">
                    <MapPin className="absolute left-3 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Choose your zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone.slug} value={zone.slug}>
                        {zone.name} · {zone.deal_count} deals
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Link href={`/zones/${selectedZone}`}>
                <Button size="lg" className="h-12 w-full sm:w-auto">
                  Browse Deals
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Deals */}
      <section className="mx-auto max-w-5xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              Popular in {currentZone.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Top deals people are claiming right now
            </p>
          </div>
          <Link
            href={`/zones/${selectedZone}`}
            className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:flex"
          >
            See all deals
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featuredDeals.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} variant="compact" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">
              No deals in this zone yet. Check back soon!
            </p>
          </div>
        )}

        {/* Mobile "see all" link */}
        <div className="mt-6 text-center sm:hidden">
          <Link href={`/zones/${selectedZone}`}>
            <Button variant="outline" className="w-full">
              See all deals in {currentZone.name}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-card/50">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
            How it works
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Browse deals",
                desc: "Find offers from local businesses in your neighbourhood.",
                icon: "🔍",
              },
              {
                step: "2",
                title: "Visit the store",
                desc: "Head to the business and show your personal QR code.",
                icon: "🏪",
              },
              {
                step: "3",
                title: "Save instantly",
                desc: "The merchant scans your code and you get the deal. Easy.",
                icon: "✨",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl">
                  {item.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Merchant CTA */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-8 sm:p-12">
            <div className="relative z-10 mx-auto max-w-lg text-center">
              <div className="mb-4 inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
                <Store className="h-6 w-6 text-primary" />
              </div>
              <h2 className="mb-3 text-2xl font-bold text-foreground sm:text-3xl">
                Are you a local business?
              </h2>
              <p className="mb-6 text-muted-foreground">
                Join Boost to create deals, attract new customers, and build
                loyalty — all in one simple platform.
              </p>
              <Link href="/join">
                <Button size="lg">
                  <Zap className="mr-1.5 h-4 w-4" />
                  Get Started Free
                </Button>
              </Link>
            </div>
          </div>
        </div>
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
