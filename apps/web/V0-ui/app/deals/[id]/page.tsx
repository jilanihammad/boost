"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ConsumerNav } from "@/components/consumer-nav"
import { DealCard } from "@/components/deal-card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import {
  getDealById,
  getDealsByMerchant,
  getDealsByZone,
  getMerchantInitials,
  type ConsumerDeal,
} from "@/lib/consumer-mock-data"
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  Shield,
  QrCode,
  Store,
  Search,
  Smartphone,
  ScanLine,
  CheckCircle2,
  LogIn,
  ArrowRight,
} from "lucide-react"

export default function DealDetailPage() {
  const params = useParams()
  const dealId = params.id as string
  const { isAuthenticated } = useAuth()

  const deal = getDealById(dealId)

  if (!deal) {
    return (
      <div className="min-h-screen bg-background">
        <ConsumerNav />
        <div className="mx-auto max-w-5xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Deal not found</h1>
          <p className="mt-2 text-muted-foreground">
            This deal may have ended or doesn&apos;t exist.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button variant="outline">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Browse Deals
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const initials = getMerchantInitials(deal.merchant_name)

  // More deals from same merchant (excluding current)
  const merchantDeals = getDealsByMerchant(deal.merchant_id).filter(
    (d) => d.id !== deal.id
  )

  // More deals in same zone (excluding current and same merchant)
  const zoneDeals = getDealsByZone(deal.zone_slug)
    .filter((d) => d.id !== deal.id && d.merchant_id !== deal.merchant_id)
    .slice(0, 3)

  const validFrom = new Date(deal.valid_from).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  const validUntil = new Date(deal.valid_until).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="min-h-screen bg-background">
      <ConsumerNav />

      <main className="mx-auto max-w-3xl px-4 py-6">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/zones/${deal.zone_slug}`}
            className="hover:text-foreground transition-colors"
          >
            {deal.zone_name}
          </Link>
          <span>/</span>
          <span className="text-foreground truncate">{deal.headline}</span>
        </div>

        {/* Merchant header */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
            {initials}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {deal.merchant_name}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{deal.merchant_category}</span>
              <span>·</span>
              <span className="flex items-center gap-0.5">
                <MapPin className="h-3.5 w-3.5" />
                {deal.zone_name}
              </span>
            </div>
          </div>
        </div>

        {/* Deal card */}
        <Card className="mb-6 overflow-hidden border-border bg-card">
          {/* Discount banner */}
          <div className="flex items-center justify-between border-b border-border/50 bg-primary/5 px-6 py-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {deal.headline}
              </h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {deal.redemption_count.toLocaleString()} claimed
                </span>
                {deal.remaining_today <= 5 && deal.remaining_today > 0 && (
                  <Badge
                    variant="outline"
                    className="border-warning/50 text-warning text-xs"
                  >
                    Only {deal.remaining_today} left today
                  </Badge>
                )}
                {deal.status === "expiring_soon" && (
                  <Badge
                    variant="outline"
                    className="border-destructive/50 text-destructive text-xs"
                  >
                    Expiring soon
                  </Badge>
                )}
              </div>
            </div>
            <Badge className="shrink-0 bg-primary text-primary-foreground text-lg font-bold px-4 py-1.5">
              {deal.discount_value}
            </Badge>
          </div>

          <CardContent className="space-y-6 p-6">
            {/* Description */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                About this deal
              </h3>
              <p className="text-foreground leading-relaxed">
                {deal.description}
              </p>
            </div>

            {/* Details grid */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Active Hours
                  </p>
                  <p className="text-sm text-foreground">
                    {deal.active_hours}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Valid
                  </p>
                  <p className="text-sm text-foreground">
                    {validFrom} – {validUntil}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Daily Limit
                  </p>
                  <p className="text-sm text-foreground">
                    {deal.daily_cap} per day · {deal.remaining_today} remaining
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    Total Claimed
                  </p>
                  <p className="text-sm text-foreground">
                    {deal.redemption_count.toLocaleString()} redemptions
                  </p>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Terms & Conditions
                </h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {deal.terms}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* How to redeem */}
        <Card className="mb-6 border-border bg-card">
          <CardContent className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              How to redeem
            </h3>
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  icon: Search,
                  title: "Find the deal",
                  desc: "Browse and pick a deal you like (you're here!).",
                },
                {
                  step: 2,
                  icon: Smartphone,
                  title: "Sign in or create an account",
                  desc: "You need a free Boost account to generate your personal QR code.",
                },
                {
                  step: 3,
                  icon: Store,
                  title: "Visit the business",
                  desc: `Head to ${deal.merchant_name} during their active hours.`,
                },
                {
                  step: 4,
                  icon: ScanLine,
                  title: "Show your QR code",
                  desc: "The merchant scans your personal code at checkout.",
                },
                {
                  step: 5,
                  icon: CheckCircle2,
                  title: "Enjoy your discount!",
                  desc: "The deal is applied instantly. You also earn loyalty points.",
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {item.step}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {item.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* CTA section: auth-aware */}
        <Card className="mb-8 border-primary/30 bg-primary/5">
          <CardContent className="p-6 text-center">
            {isAuthenticated ? (
              <>
                <QrCode className="mx-auto mb-3 h-10 w-10 text-primary" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Ready to redeem?
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Get your personal QR code and visit {deal.merchant_name} to
                  claim this deal.
                </p>
                <Link href={`/deals/claim/${deal.id}`}>
                  <Button size="lg">
                    <QrCode className="mr-1.5 h-4 w-4" />
                    Get My QR Code
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <LogIn className="mx-auto mb-3 h-10 w-10 text-primary" />
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                  Sign in to claim this deal
                </h3>
                <p className="mb-4 text-sm text-muted-foreground">
                  Create a free Boost account to get your personal QR code and
                  start saving at local businesses.
                </p>
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link href="/login">
                    <Button size="lg">
                      <LogIn className="mr-1.5 h-4 w-4" />
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/join">
                    <Button variant="outline" size="lg">
                      Create Account
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* More deals from same merchant */}
        {merchantDeals.length > 0 && (
          <section className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">
              More from {deal.merchant_name}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {merchantDeals.map((d) => (
                <DealCard key={d.id} deal={d} variant="compact" />
              ))}
            </div>
          </section>
        )}

        {/* More deals in zone */}
        {zoneDeals.length > 0 && (
          <section className="mb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                More deals in {deal.zone_name}
              </h3>
              <Link
                href={`/zones/${deal.zone_slug}`}
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                View all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {zoneDeals.map((d) => (
                <DealCard key={d.id} deal={d} variant="compact" />
              ))}
            </div>
          </section>
        )}
      </main>

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
