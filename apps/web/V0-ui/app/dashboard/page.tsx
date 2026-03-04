"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { RoleToggle } from "@/components/role-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { StatusBadge } from "@/components/status-badge"
import { useAuth } from "@/lib/auth-context"
import {
  merchant,
  offers,
  type Offer,
} from "@/lib/mock-data"
import {
  retentionKpis,
  cohortData,
  dealPerformance,
  recentActivity,
  billingMetrics,
  type DealPerf,
} from "@/lib/retention-mock-data"
import {
  QrCode,
  LogOut,
  Plus,
  Menu,
  Settings,
  ChevronUp,
  ChevronDown,
  Users,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Calendar,
  Activity,
  Upload,
  Sparkles,
  Heart,
  Lightbulb,
  Loader2,
} from "lucide-react"

// --- Heatmap cell color helper ---
function retentionColor(rate: number): string {
  if (rate >= 0.4) return "bg-emerald-600/80 text-white"
  if (rate >= 0.2) return "bg-yellow-600/70 text-white"
  return "bg-red-600/60 text-white"
}

// --- Sort key type for deals table ---
type DealSortKey = "offer_name" | "redemption_count" | "return_rate_14d" | "estimated_roi"

export default function DashboardPage() {
  const { role } = useAuth()
  const [selectedOffer, setSelectedOffer] = useState<Offer>(offers[0])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dealSort, setDealSort] = useState<{ key: DealSortKey; asc: boolean }>({
    key: "return_rate_14d",
    asc: false,
  })

  // --- AI Insights state ---
  const [insights, setInsights] = useState<string[]>([])
  const [insightsUpdatedAt, setInsightsUpdatedAt] = useState<string | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(true)

  useEffect(() => {
    async function fetchInsights() {
      try {
        // Use merchant-001 as default merchant ID (matches mock data)
        const merchantId = "merchant-001"
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/merchants/${merchantId}/insights`,
          {
            headers: { Authorization: `Bearer placeholder` },
          }
        )
        if (res.ok) {
          const data = await res.json()
          setInsights(data.insights || [])
          if (data.generated_at) {
            const genDate = new Date(data.generated_at)
            const hoursAgo = Math.max(
              0,
              Math.round((Date.now() - genDate.getTime()) / (1000 * 60 * 60))
            )
            setInsightsUpdatedAt(
              hoursAgo === 0 ? "Just now" : `${hoursAgo}h ago`
            )
          }
        }
      } catch {
        // Silently fail — fallback UI will show
      } finally {
        setInsightsLoading(false)
      }
    }
    fetchInsights()
  }, [])

  const isAdmin = role === "merchant_admin"

  const offersListRef = { current: null as HTMLDivElement | null }

  const scrollOffers = (direction: "up" | "down") => {
    if (offersListRef.current) {
      const scrollAmount = 150
      offersListRef.current.scrollBy({
        top: direction === "up" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      })
    }
  }

  // Sort deals
  const sortedDeals = [...dealPerformance].sort((a, b) => {
    const va = a[dealSort.key]
    const vb = b[dealSort.key]
    if (typeof va === "string" && typeof vb === "string") {
      return dealSort.asc ? va.localeCompare(vb) : vb.localeCompare(va)
    }
    return dealSort.asc
      ? (va as number) - (vb as number)
      : (vb as number) - (va as number)
  })

  const bestDeal = sortedDeals.reduce<DealPerf | null>((best, d) =>
    !best || d.return_rate_14d > best.return_rate_14d ? d : best, null)
  const worstDeal = sortedDeals.reduce<DealPerf | null>((worst, d) =>
    !worst || d.return_rate_14d < worst.return_rate_14d ? d : worst, null)

  const toggleSort = (key: DealSortKey) => {
    setDealSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: false }
    )
  }

  const OffersList = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border p-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Offers</h2>
      </div>
      <button
        type="button"
        onClick={() => scrollOffers("up")}
        className="flex h-8 shrink-0 items-center justify-center border-b border-sidebar-border bg-sidebar-accent/50 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label="Scroll up"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div
        ref={(el) => { offersListRef.current = el }}
        className="flex-1 overflow-y-auto p-2"
      >
        {offers.map((offer) => (
          <button
            key={offer.id}
            onClick={() => { setSelectedOffer(offer); setSidebarOpen(false) }}
            className={`mb-1 w-full rounded-lg p-3 text-left transition-colors ${
              selectedOffer.id === offer.id ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-sidebar-foreground">{offer.name}</span>
              <StatusBadge status={offer.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Today: {offer.today_redemptions}</p>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => scrollOffers("down")}
        className="flex h-8 shrink-0 items-center justify-center border-t border-sidebar-border bg-sidebar-accent/50 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label="Scroll down"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {isAdmin && (
        <div className="flex items-center gap-2 border-t border-sidebar-border p-3">
          <Button className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            Create Offer
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent">
                <Settings className="h-4 w-4" />
                <span className="sr-only">Offer settings</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-48 border-border bg-popover p-2">
              <div className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-popover-foreground hover:bg-accent">
                  <Upload className="h-4 w-4" />
                  Upload Menu
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-popover-foreground hover:bg-accent">
                  <Sparkles className="h-4 w-4" />
                  Suggest Offer
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <BoostLogo />
        </div>
        <div className="h-[calc(100vh-3.5rem)]">
          <OffersList />
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <div className="flex h-14 items-center border-b border-sidebar-border px-4">
            <BoostLogo />
          </div>
          <div className="h-[calc(100vh-3.5rem)]">
            <OffersList />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="lg:hidden"><BoostLogo /></div>
            <span className="hidden text-sm text-muted-foreground lg:inline">{merchant.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/biz/customers">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Customers</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/biz/reports">
                <Calendar className="h-4 w-4" />
                <span className="hidden sm:inline">Reports</span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <Link href="/redeem">
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">Redeem</span>
              </Link>
            </Button>
            <RoleToggle />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
              <Link href="/login">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">

          {/* ===================== RETENTION KPI CARDS ===================== */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {retentionKpis.map((kpi) => {
              const isPositive = kpi.delta >= 0
              return (
                <Card key={kpi.label} className="border-border bg-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {kpi.label}
                    </CardTitle>
                    {isPositive ? (
                      <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold text-card-foreground">
                      {kpi.prefix ?? ""}{kpi.value}{kpi.suffix ?? ""}
                    </p>
                    <p className={`mt-1 text-xs ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
                      {isPositive ? "+" : ""}{kpi.delta}{kpi.suffix === "%" ? "pp" : ""} {kpi.deltaLabel}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* ===================== RETENTION HEATMAP ===================== */}
          <Card className="mb-6 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">
                Cohort Retention Heatmap
              </CardTitle>
              <CardDescription>
                Are your customers coming back? Rows = weekly cohorts, columns = return week.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                        Cohort Week
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                        New
                      </th>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <th key={w} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
                          Wk {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohortData.map((row) => (
                      <tr key={row.week_start} className="border-b border-border/50">
                        <td className="px-4 py-2 text-xs text-foreground font-medium">
                          {row.week_start}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-muted-foreground">
                          {row.new_customers}
                        </td>
                        {[0, 1, 2, 3, 4].map((i) => (
                          <td key={i} className="px-2 py-2 text-center">
                            {row.retention_rates[i] !== undefined ? (
                              <span
                                className={`inline-block rounded px-2 py-1 text-xs font-semibold ${retentionColor(row.retention_rates[i])}`}
                              >
                                {Math.round(row.retention_rates[i] * 100)}%
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 border-t border-border/50 px-4 py-2">
                <span className="text-xs text-muted-foreground">Legend:</span>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-emerald-600/80" />
                  <span className="text-xs text-muted-foreground">&gt;40%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-yellow-600/70" />
                  <span className="text-xs text-muted-foreground">20–40%</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-red-600/60" />
                  <span className="text-xs text-muted-foreground">&lt;20%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===================== DEALS PERFORMANCE TABLE ===================== */}
          <Card className="mb-6 border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">
                Active Deals Performance
              </CardTitle>
              <CardDescription>
                Compare which deals bring customers back.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead
                        className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort("offer_name")}
                      >
                        Deal {dealSort.key === "offer_name" ? (dealSort.asc ? "↑" : "↓") : ""}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort("redemption_count")}
                      >
                        Redemptions {dealSort.key === "redemption_count" ? (dealSort.asc ? "↑" : "↓") : ""}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort("return_rate_14d")}
                      >
                        Return % (14d) {dealSort.key === "return_rate_14d" ? (dealSort.asc ? "↑" : "↓") : ""}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer text-center text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => toggleSort("estimated_roi")}
                      >
                        ROI {dealSort.key === "estimated_roi" ? (dealSort.asc ? "↑" : "↓") : ""}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedDeals.map((deal) => {
                      const isBest = bestDeal && deal.offer_id === bestDeal.offer_id
                      return (
                        <TableRow
                          key={deal.offer_id}
                          className={`border-border hover:bg-muted/50 ${isBest ? "bg-emerald-500/10" : ""}`}
                        >
                          <TableCell className="text-sm text-foreground">
                            <div className="flex items-center gap-2">
                              {deal.offer_name}
                              {isBest && (
                                <Badge variant="default" className="bg-emerald-600 text-xs">
                                  Best
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm text-foreground">
                            {deal.redemption_count}
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={deal.return_rate_14d >= 0.5 ? "text-emerald-500" : "text-yellow-500"}>
                              {Math.round(deal.return_rate_14d * 100)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-sm">
                            <span className={deal.estimated_roi >= 2 ? "text-emerald-500" : deal.estimated_roi >= 1 ? "text-yellow-500" : "text-red-500"}>
                              {deal.estimated_roi.toFixed(1)}x
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
              {/* AI Insights */}
              <div className="border-t border-border/50 px-4 py-3">
                {insightsLoading ? (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Generating insights…</p>
                  </div>
                ) : insights.length > 0 ? (
                  <div className="space-y-2">
                    {insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                        <div className="flex-1">
                          <p className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">AI Insight:</span>{" "}
                            {insight}
                          </p>
                        </div>
                      </div>
                    ))}
                    {insightsUpdatedAt && (
                      <p className="text-[10px] text-muted-foreground/60 pl-6">
                        Last updated: {insightsUpdatedAt}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500/60" />
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">Tip:</span>{" "}
                      Add more deals and track redemptions to unlock personalized AI insights about your business.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ===================== RECENT ACTIVITY + QUICK ACTIONS ===================== */}
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {/* Recent Activity Feed */}
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-card-foreground">
                  Recent Activity
                </CardTitle>
                <CardDescription>Last 10 redemptions</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs text-muted-foreground">Time</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Customer</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Offer</TableHead>
                        <TableHead className="text-center text-xs text-muted-foreground">Visit #</TableHead>
                        <TableHead className="text-xs text-muted-foreground">Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentActivity.map((item) => (
                        <TableRow key={item.id} className="border-border hover:bg-muted/50">
                          <TableCell className="text-sm text-foreground">{item.time}</TableCell>
                          <TableCell className="text-sm text-foreground">{item.customer_name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{item.offer_name}</TableCell>
                          <TableCell className="text-center text-sm text-foreground">{item.visit_number}</TableCell>
                          <TableCell>
                            {item.customer_type === "NEW" ? (
                              <Badge className="bg-blue-600 text-xs">NEW</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Returning</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-card-foreground">
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start gap-2" variant="outline" asChild>
                  <Link href="/dashboard">
                    <Plus className="h-4 w-4" />
                    Create Deal
                  </Link>
                </Button>
                <Button className="w-full justify-start gap-2" variant="outline" asChild>
                  <Link href="/biz/customers">
                    <Users className="h-4 w-4" />
                    View Customers
                  </Link>
                </Button>
                <Button className="w-full justify-start gap-2" variant="outline" asChild>
                  <Link href="/biz/loyalty">
                    <Heart className="h-4 w-4" />
                    Configure Loyalty
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* ===================== BILLING SECTION (preserved) ===================== */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">
                Billing & Financials
              </CardTitle>
              <CardDescription>Redemption costs and amounts owed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Today{"'"}s Redemptions</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {billingMetrics.today_redemptions}
                  </p>
                  <p className="text-xs text-muted-foreground">+12% from yesterday</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Week-to-Date</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {billingMetrics.wtd_redemptions}
                  </p>
                  <p className="text-xs text-muted-foreground">+8% from last week</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Amount Owed (WTD)</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    ${billingMetrics.amount_owed_wtd.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">Based on verified redemptions</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </main>
      </div>
    </div>
  )
}
