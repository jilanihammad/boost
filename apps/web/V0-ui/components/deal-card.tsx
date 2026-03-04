"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { type ConsumerDeal, getMerchantInitials } from "@/lib/consumer-mock-data"
import { Clock, MapPin, Users, Store } from "lucide-react"

interface DealCardProps {
  deal: ConsumerDeal
  /** compact = home page featured grid, full = zone page */
  variant?: "compact" | "full"
}

export function DealCard({ deal, variant = "full" }: DealCardProps) {
  const initials = getMerchantInitials(deal.merchant_name)

  return (
    <Link href={`/deals/${deal.id}`} className="group block">
      <Card className="h-full overflow-hidden border-border bg-card transition-all duration-200 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Discount badge ribbon */}
        <div className="relative flex items-center gap-3 border-b border-border/50 p-4">
          {/* Merchant avatar */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {deal.merchant_name}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{deal.merchant_category}</span>
              {variant === "full" && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-3 w-3" />
                    {deal.zone_name}
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Discount value badge */}
          <Badge className="shrink-0 bg-primary/15 text-primary hover:bg-primary/20 border-0 text-sm font-bold">
            {deal.discount_value}
          </Badge>
        </div>

        <CardContent className="p-4">
          {/* Headline */}
          <h3 className="mb-2 text-base font-semibold leading-tight text-foreground group-hover:text-primary transition-colors">
            {deal.headline}
          </h3>

          {/* Terms preview */}
          {variant === "full" && (
            <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
              {deal.terms}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {/* Social proof */}
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {deal.redemption_count.toLocaleString()} claimed
            </span>

            {/* Active hours */}
            {variant === "full" && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {deal.active_hours}
              </span>
            )}

            {/* Status badges */}
            {deal.remaining_today <= 3 && deal.remaining_today > 0 && (
              <Badge variant="outline" className="border-warning/50 text-warning text-xs px-1.5 py-0">
                Only {deal.remaining_today} left today
              </Badge>
            )}
            {deal.status === "expiring_soon" && (
              <Badge variant="outline" className="border-destructive/50 text-destructive text-xs px-1.5 py-0">
                Expiring soon
              </Badge>
            )}
          </div>

          {/* CTA */}
          {variant === "full" && (
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground"
              >
                <Store className="mr-1.5 h-4 w-4" />
                View Deal
              </Button>
            </div>
          )}

          {variant === "compact" && (
            <div className="mt-3">
              <span className="text-xs font-medium text-primary group-hover:underline">
                Visit to Redeem →
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
