"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { BoostLogo } from "@/components/boost-logo"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Ticket,
  Star,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Gift,
  Stamp,
  Store,
} from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveClaim {
  qr_data: string
  short_code: string
  expires_at: string
  offer_name: string
  merchant_name: string
}

interface VisitHistoryItem {
  merchant_name: string
  offer_name: string
  timestamp: string
  visit_number: number
  points_earned: number
  stamp_earned: boolean
}

interface MerchantLoyaltyProgress {
  merchant_id: string
  merchant_name: string
  current_stamps: number
  stamps_required: number
  reward_description: string
  visits_until_reward: number
}

interface WalletReward {
  id: string
  description: string
  status: string
  merchant_name: string
  is_universal: boolean
  earned_at: string
  expires_at: string | null
}

interface WalletData {
  active_claims: ActiveClaim[]
  visit_history: VisitHistoryItem[]
  total_points: number
  rewards: WalletReward[]
  merchant_loyalty: MerchantLoyaltyProgress[]
}

// ---------------------------------------------------------------------------
// Mock data (mirrors backend shape — will be replaced by API call)
// ---------------------------------------------------------------------------

const MOCK_WALLET: WalletData = {
  active_claims: [
    {
      qr_data: "boost://claim/demo-uid/offer-001/1700000000/abc123",
      short_code: "BX7K2N",
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      offer_name: "$2 Off Any Latte",
      merchant_name: "Blue Bottle Coffee",
    },
    {
      qr_data: "boost://claim/demo-uid/offer-002/1700000000/def456",
      short_code: "MR4P8Q",
      expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
      offer_name: "Free Side with Entrée",
      merchant_name: "The Butcher's Table",
    },
  ],
  visit_history: [
    {
      merchant_name: "Blue Bottle Coffee",
      offer_name: "$2 Off Any Latte",
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      visit_number: 3,
      points_earned: 50,
      stamp_earned: true,
    },
    {
      merchant_name: "Tartine Bakery",
      offer_name: "Free Cookie Friday",
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      visit_number: 1,
      points_earned: 50,
      stamp_earned: true,
    },
    {
      merchant_name: "The Butcher's Table",
      offer_name: "10% Off Dinner",
      timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      visit_number: 2,
      points_earned: 50,
      stamp_earned: false,
    },
  ],
  total_points: 150,
  rewards: [],
  merchant_loyalty: [
    {
      merchant_id: "m-001",
      merchant_name: "Blue Bottle Coffee",
      current_stamps: 3,
      stamps_required: 5,
      reward_description: "Free latte",
      visits_until_reward: 2,
    },
    {
      merchant_id: "m-002",
      merchant_name: "Tartine Bakery",
      current_stamps: 1,
      stamps_required: 8,
      reward_description: "Free pastry",
      visits_until_reward: 7,
    },
    {
      merchant_id: "m-003",
      merchant_name: "The Butcher's Table",
      current_stamps: 7,
      stamps_required: 10,
      reward_description: "Free appetizer",
      visits_until_reward: 3,
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimeRemaining(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return "Expired"

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ---------------------------------------------------------------------------
// Claim Card component
// ---------------------------------------------------------------------------

function ClaimCard({ claim }: { claim: ActiveClaim }) {
  const [expanded, setExpanded] = useState(false)
  const timeLeft = formatTimeRemaining(claim.expires_at)
  const isExpired = timeLeft === "Expired"

  return (
    <Card
      className={`border-border bg-card transition-all ${
        isExpired ? "opacity-50" : "cursor-pointer hover:border-primary/50"
      }`}
      onClick={() => !isExpired && setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
              {claim.merchant_name}
            </p>
            <h3 className="mt-0.5 text-base font-semibold text-card-foreground truncate">
              {claim.offer_name}
            </h3>
            <div className="mt-2 flex items-center gap-2">
              <Badge
                variant={isExpired ? "destructive" : "secondary"}
                className="text-xs"
              >
                <Clock className="mr-1 h-3 w-3" />
                {timeLeft}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">
                {claim.short_code}
              </span>
            </div>
          </div>
          <div className="ml-3 flex items-center">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded QR code */}
        {expanded && (
          <div className="mt-4 flex flex-col items-center gap-3 border-t border-border pt-4">
            <div className="rounded-xl bg-white p-4">
              <QRCodeSVG
                value={claim.qr_data}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Show this to staff to redeem
            </p>
            <p className="font-mono text-lg font-bold tracking-widest text-card-foreground">
              {claim.short_code}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Merchant Loyalty Card (digital punch card)
// ---------------------------------------------------------------------------

function MerchantLoyaltyCard({
  loyalty,
}: {
  loyalty: MerchantLoyaltyProgress
}) {
  const stamps = Array.from({ length: loyalty.stamps_required }, (_, i) => i)
  const progressPercent =
    (loyalty.current_stamps / loyalty.stamps_required) * 100

  return (
    <Card className="border-border bg-card hover:border-primary/30 transition-all">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
              <Store className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-card-foreground truncate">
              {loyalty.merchant_name}
            </h3>
          </div>
          <span className="text-xs font-medium text-muted-foreground shrink-0">
            {loyalty.current_stamps}/{loyalty.stamps_required}
          </span>
        </div>

        {/* Stamp dots */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {stamps.map((i) => (
            <div
              key={i}
              className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                i < loyalty.current_stamps
                  ? "border-primary bg-primary/20"
                  : "border-border bg-secondary/50"
              }`}
            >
              {i < loyalty.current_stamps && (
                <Stamp className="h-3 w-3 text-primary" />
              )}
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-secondary">
          <div
            className="h-1.5 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Reward info */}
        <p className="text-xs text-center text-muted-foreground">
          {loyalty.visits_until_reward === 0 ? (
            <span className="font-medium text-primary">
              🎉 Reward ready: {loyalty.reward_description}!
            </span>
          ) : (
            <>
              <span className="font-medium text-primary">
                {loyalty.visits_until_reward} more
              </span>{" "}
              → {loyalty.reward_description}
            </>
          )}
        </p>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Wallet Page
// ---------------------------------------------------------------------------

export default function WalletPage() {
  const { isAuthenticated, isConsumer } = useAuth()
  const router = useRouter()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Redirect to /join if not logged in as consumer
    if (!isAuthenticated || !isConsumer) {
      router.push("/join")
      return
    }

    // TODO: Replace with real API call:
    // fetch("/api/v1/consumer/wallet", { headers: { Authorization: `Bearer ${token}` } })
    //   .then(r => r.json())
    //   .then(setWallet)
    const timer = setTimeout(() => {
      setWallet(MOCK_WALLET)
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [isAuthenticated, isConsumer, router])

  if (loading || !wallet) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </main>
    )
  }

  const hasActiveClaims = wallet.active_claims.length > 0
  const hasVisits = wallet.visit_history.length > 0
  const hasRewards = wallet.rewards.length > 0
  const hasMerchantLoyalty = wallet.merchant_loyalty.length > 0
  const pointsTowardReward = wallet.total_points % 500
  const pointsRemaining = 500 - pointsTowardReward
  const progressPercent = (pointsTowardReward / 500) * 100

  return (
    <main className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <BoostLogo />
          <span className="text-sm font-medium text-muted-foreground">
            My Wallet
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 py-6 space-y-6">
        {/* Points Card */}
        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Points</p>
                <p className="text-3xl font-bold text-card-foreground">
                  {wallet.total_points.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Progress toward next $5 reward */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {pointsTowardReward}/500 toward next reward
                </span>
                <span className="font-medium text-primary">
                  {pointsRemaining} more → $5 reward at any merchant
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-secondary">
                <div
                  className="h-2 rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Merchant Loyalty — Punch Cards */}
        {hasMerchantLoyalty && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Store className="h-4 w-4" />
              Your Merchants
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {wallet.merchant_loyalty.map((loyalty) => (
                <MerchantLoyaltyCard
                  key={loyalty.merchant_id}
                  loyalty={loyalty}
                />
              ))}
            </div>
          </section>
        )}

        {/* Rewards Available */}
        {hasRewards && (
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              <Gift className="h-4 w-4" />
              Rewards Available
            </h2>
            <div className="space-y-3">
              {wallet.rewards.map((reward) => (
                <Card
                  key={reward.id}
                  className="border-primary/30 bg-gradient-to-r from-primary/5 to-card hover:border-primary/50 transition-all"
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-card-foreground">
                        {reward.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reward.merchant_name}
                        {reward.expires_at &&
                          ` · Expires ${new Date(reward.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Earned
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Active Deals */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Ticket className="h-4 w-4" />
            Active Deals
          </h2>

          {hasActiveClaims ? (
            <div className="space-y-3">
              {wallet.active_claims.map((claim, i) => (
                <ClaimCard key={i} claim={claim} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <Ticket className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No deals yet — browse your neighborhood!
                </p>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Visit History */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Star className="h-4 w-4" />
            Visit History
          </h2>

          {hasVisits ? (
            <div className="space-y-2">
              {wallet.visit_history.map((visit, i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {visit.merchant_name}
                        </p>
                        {visit.stamp_earned && (
                          <Stamp className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {visit.offer_name} · Visit #{visit.visit_number}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-primary">
                        +{visit.points_earned}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(visit.timestamp)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed border-border bg-card">
              <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
                <Star className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No visits yet
                </p>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  )
}
