"use client"

import { useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Mail,
  BarChart3,
  Users,
  DollarSign,
  Star,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Calendar,
  Award,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Mock report data (matches WeeklyReportSummary from backend)
// ---------------------------------------------------------------------------

interface WeeklyReport {
  id: string
  merchant_id: string
  week_start: string
  week_end: string
  new_customers: number
  returning_customers: number
  total_visits: number
  top_deal: string | null
  return_rate: number
  return_rate_trend: "up" | "down" | "flat" | null
  rewards_earned: number
  estimated_revenue: number
  insights: string[]
  generated_at: string
}

const MOCK_REPORTS: WeeklyReport[] = [
  {
    id: "rpt-001",
    merchant_id: "merchant-001",
    week_start: "2025-02-24",
    week_end: "2025-03-02",
    new_customers: 34,
    returning_customers: 67,
    total_visits: 142,
    top_deal: "Buy 1 Get 1 Espresso",
    return_rate: 0.47,
    return_rate_trend: "up",
    rewards_earned: 12,
    estimated_revenue: 1704.0,
    insights: [
      "Your BOGO Espresso deal drove 38% of all visits this week — consider extending it.",
      "Returning customers are up 12% week-over-week. Your loyalty program is working!",
      "Tuesday and Thursday saw the most traffic. Consider a mid-week deal to maintain momentum.",
    ],
    generated_at: "2025-03-03T08:00:00Z",
  },
  {
    id: "rpt-002",
    merchant_id: "merchant-001",
    week_start: "2025-02-17",
    week_end: "2025-02-23",
    new_customers: 28,
    returning_customers: 59,
    total_visits: 118,
    top_deal: "Free Cookie Friday",
    return_rate: 0.42,
    return_rate_trend: "flat",
    rewards_earned: 9,
    estimated_revenue: 1416.0,
    insights: [
      "Free Cookie Friday brought in 22 new customers — highest single-day acquisition this month.",
      "At-risk customers responded well to SMS nudges. 8 returned after receiving messages.",
    ],
    generated_at: "2025-02-24T08:00:00Z",
  },
  {
    id: "rpt-003",
    merchant_id: "merchant-001",
    week_start: "2025-02-10",
    week_end: "2025-02-16",
    new_customers: 21,
    returning_customers: 52,
    total_visits: 96,
    top_deal: "20% Off Pastries",
    return_rate: 0.38,
    return_rate_trend: "down",
    rewards_earned: 6,
    estimated_revenue: 1152.0,
    insights: [
      "Foot traffic dipped midweek. Consider a Wednesday-only flash deal.",
      "Your 20% Off Pastries deal has the lowest ROI — try reducing the discount or bundling.",
    ],
    generated_at: "2025-02-17T08:00:00Z",
  },
  {
    id: "rpt-004",
    merchant_id: "merchant-001",
    week_start: "2025-02-03",
    week_end: "2025-02-09",
    new_customers: 25,
    returning_customers: 55,
    total_visits: 108,
    top_deal: "Buy 1 Get 1 Espresso",
    return_rate: 0.41,
    return_rate_trend: "up",
    rewards_earned: 8,
    estimated_revenue: 1296.0,
    insights: [
      "BOGO Espresso continues to be your top performer with 3.2x ROI.",
      "New customer acquisition is steady. Try a referral incentive to accelerate growth.",
    ],
    generated_at: "2025-02-10T08:00:00Z",
  },
]

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (trend === "up") return <TrendingUp className="h-4 w-4 text-emerald-500" />
  if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-muted-foreground" />
}

function TrendBadge({ trend }: { trend: "up" | "down" | "flat" | null }) {
  if (trend === "up") {
    return (
      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30 text-xs">
        <TrendingUp className="mr-1 h-3 w-3" />
        Trending Up
      </Badge>
    )
  }
  if (trend === "down") {
    return (
      <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-xs">
        <TrendingDown className="mr-1 h-3 w-3" />
        Trending Down
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="text-xs">
      <Minus className="mr-1 h-3 w-3" />
      Stable
    </Badge>
  )
}

function formatWeekRange(start: string, end: string) {
  const s = new Date(start + "T00:00:00")
  const e = new Date(end + "T00:00:00")
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", opts)}`
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Dashboard</span>
            </Link>
          </Button>
          <BoostLogo />
          <span className="text-sm font-medium text-foreground">Weekly Reports</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
            <Link href="/dashboard">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto max-w-3xl">
          {/* Email notice */}
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
            <Mail className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Reports are sent to your email weekly
              </p>
              <p className="text-xs text-muted-foreground">
                Every Monday morning you&apos;ll receive a summary of last week&apos;s performance.
              </p>
            </div>
          </div>

          {/* Reports list */}
          <div className="space-y-4">
            {MOCK_REPORTS.map((report) => {
              const isExpanded = expandedId === report.id
              return (
                <Card
                  key={report.id}
                  className="border-border bg-card transition-colors hover:border-border/80"
                >
                  {/* Card header — always visible */}
                  <button
                    onClick={() => toggle(report.id)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <CardTitle className="text-sm font-semibold text-card-foreground">
                              {formatWeekRange(report.week_start, report.week_end)}
                            </CardTitle>
                          </div>
                          <CardDescription className="text-xs">
                            {report.total_visits} visits · {report.new_customers} new · {report.returning_customers} returning
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                          <TrendBadge trend={report.return_rate_trend} />
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {/* Quick metric row */}
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Return Rate
                          </p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-lg font-bold text-foreground">
                              {Math.round(report.return_rate * 100)}%
                            </p>
                            <TrendIcon trend={report.return_rate_trend} />
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Revenue
                          </p>
                          <p className="text-lg font-bold text-foreground">
                            ${report.estimated_revenue.toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-md bg-muted/50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            Rewards
                          </p>
                          <p className="text-lg font-bold text-foreground">
                            {report.rewards_earned}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <CardContent className="border-t border-border/50 pt-4">
                      {/* KPI grid */}
                      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                          <Users className="h-4 w-4 text-blue-400" />
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">New</p>
                            <p className="text-sm font-semibold text-foreground">{report.new_customers}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                          <Users className="h-4 w-4 text-emerald-400" />
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Returning</p>
                            <p className="text-sm font-semibold text-foreground">{report.returning_customers}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                          <BarChart3 className="h-4 w-4 text-purple-400" />
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Total Visits</p>
                            <p className="text-sm font-semibold text-foreground">{report.total_visits}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
                          <DollarSign className="h-4 w-4 text-yellow-400" />
                          <div>
                            <p className="text-[10px] uppercase text-muted-foreground">Revenue</p>
                            <p className="text-sm font-semibold text-foreground">${report.estimated_revenue.toLocaleString()}</p>
                          </div>
                        </div>
                      </div>

                      {/* Top deal */}
                      {report.top_deal && (
                        <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3">
                          <Star className="h-4 w-4 shrink-0 text-emerald-400" />
                          <div>
                            <p className="text-xs text-muted-foreground">Top Deal This Week</p>
                            <p className="text-sm font-semibold text-foreground">{report.top_deal}</p>
                          </div>
                        </div>
                      )}

                      {/* Rewards earned */}
                      <div className="mb-4 flex items-center gap-2 rounded-lg bg-purple-500/10 px-4 py-3">
                        <Award className="h-4 w-4 shrink-0 text-purple-400" />
                        <div>
                          <p className="text-xs text-muted-foreground">Loyalty Rewards Earned</p>
                          <p className="text-sm font-semibold text-foreground">
                            {report.rewards_earned} customers earned a reward this week
                          </p>
                        </div>
                      </div>

                      {/* Insights */}
                      {report.insights.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            AI Insights
                          </p>
                          {report.insights.map((insight, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 rounded-lg bg-muted/50 p-3"
                            >
                              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                              <p className="text-xs text-muted-foreground">{insight}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Generated timestamp */}
                      <p className="mt-4 text-[10px] text-muted-foreground/60">
                        Generated {new Date(report.generated_at).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
