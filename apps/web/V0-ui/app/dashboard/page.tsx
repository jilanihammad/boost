"use client"

import { useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { RoleToggle } from "@/components/role-toggle"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useAuth } from "@/lib/auth-context"
import {
  merchant,
  offers,
  metrics,
  redemptions,
  redemptionsByDay,
  methodSplit,
  type Offer,
} from "@/lib/mock-data"
import {
  QrCode,
  LogOut,
  Plus,
  Pause,
  Edit,
  TrendingUp,
  DollarSign,
  Activity,
  Calendar,
  Menu,
  ChevronRight,
  Scan,
  Keyboard,
  CheckCircle,
  XCircle,
  Upload,
  Sparkles,
  Settings,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

export default function DashboardPage() {
  const { role } = useAuth()
  const [selectedOffer, setSelectedOffer] = useState<Offer>(offers[0])
  const [dateRange, setDateRange] = useState("7d")
  const [location, setLocation] = useState("all")
  const [offerFilter, setOfferFilter] = useState("all")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isAdmin = role === "merchant_admin"

  const activeOffer = offers.find((o) => o.status === "running")

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

  const OffersList = () => (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border p-4">
        <h2 className="text-sm font-semibold text-sidebar-foreground">Offers</h2>
      </div>
      {/* Scroll up button */}
      <button
        type="button"
        onClick={() => scrollOffers("up")}
        className="flex h-8 shrink-0 items-center justify-center border-b border-sidebar-border bg-sidebar-accent/50 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        aria-label="Scroll up"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <div
        ref={(el) => {
          offersListRef.current = el
        }}
        className="flex-1 overflow-y-auto p-2"
      >
        {offers.map((offer) => (
          <button
            key={offer.id}
            onClick={() => {
              setSelectedOffer(offer)
              setSidebarOpen(false)
            }}
            className={`mb-1 w-full rounded-lg p-3 text-left transition-colors ${
              selectedOffer.id === offer.id
                ? "bg-sidebar-accent"
                : "hover:bg-sidebar-accent/50"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-medium text-sidebar-foreground">
                {offer.name}
              </span>
              <StatusBadge status={offer.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Today: {offer.today_redemptions}
            </p>
          </button>
        ))}
      </div>
      {/* Scroll down button */}
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
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0 border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Offer settings</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="end"
              className="w-48 border-border bg-popover p-2"
            >
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm text-popover-foreground hover:bg-accent"
                >
                  <Upload className="h-4 w-4" />
                  Upload Menu
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start gap-2 text-sm text-popover-foreground hover:bg-accent"
                >
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 lg:hidden"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="lg:hidden">
              <BoostLogo />
            </div>
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {merchant.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href="/redeem">
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">Redeem</span>
              </Link>
            </Button>
            <RoleToggle />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link href="/login">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Link>
            </Button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {/* KPI Tiles */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Today{"'"}s Redemptions
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-card-foreground">
                  {metrics.today_redemptions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  +12% from yesterday
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Week-to-Date
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-card-foreground">
                  {metrics.wtd_redemptions}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  +8% from last week
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Amount Owed (WTD)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-card-foreground">
                  ${metrics.amount_owed_wtd.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Based on verified redemptions
                </p>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Offer Status
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {activeOffer ? (
                  <>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={activeOffer.status} />
                    </div>
                    <p className="mt-2 text-sm font-medium text-card-foreground">
                      {activeOffer.cap_remaining_today} of {activeOffer.cap_total_daily}{" "}
                      left today
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No active offers</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Filter Row */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="h-9 w-[120px] border-border bg-secondary text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Select value={location} onValueChange={setLocation}>
              <SelectTrigger className="h-9 w-[140px] border-border bg-secondary text-sm">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {merchant.locations.map((loc) => (
                  <SelectItem key={loc} value={loc.toLowerCase()}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={offerFilter} onValueChange={setOfferFilter}>
              <SelectTrigger className="h-9 w-[160px] border-border bg-secondary text-sm">
                <SelectValue placeholder="Offer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All offers</SelectItem>
                {offers.map((offer) => (
                  <SelectItem key={offer.id} value={offer.id}>
                    {offer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Offer Details */}
          <Card className="mb-6 border-border bg-card">
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg text-card-foreground">
                      {selectedOffer.name}
                    </CardTitle>
                    <StatusBadge status={selectedOffer.status} />
                  </div>
                  <CardDescription className="mt-1">
                    {selectedOffer.terms}
                  </CardDescription>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-border bg-transparent text-sm"
                    >
                      <Pause className="h-4 w-4" />
                      Pause
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-border bg-transparent text-sm"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Daily Cap</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {selectedOffer.cap_remaining_today} / {selectedOffer.cap_total_daily}
                  </p>
                  <p className="text-xs text-muted-foreground">remaining today</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Active Hours</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {selectedOffer.hours}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Discount Value</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {selectedOffer.discount_text}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Charts */}
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            {/* Redemptions by Day Chart */}
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-card-foreground">
                  Redemptions by Day
                </CardTitle>
                <CardDescription>Last 14 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={redemptionsByDay}>
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                        labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                      />
                      <Bar
                        dataKey="count"
                        fill="oklch(0.72 0.15 195)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Method Split Chart */}
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-card-foreground">
                  Redemption Method
                </CardTitle>
                <CardDescription>Scan vs Manual</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[200px] items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={methodSplit}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {methodSplit.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--popover-foreground))",
                        }}
                        formatter={(value: number) => [`${value}%`, "Percentage"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex justify-center gap-6">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "oklch(0.72 0.15 195)" }}
                    />
                    <span className="text-xs text-muted-foreground">Scan (78%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: "oklch(0.7 0.15 85)" }}
                    />
                    <span className="text-xs text-muted-foreground">Manual (22%)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Redemptions Table */}
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-card-foreground">
                Recent Redemptions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-xs text-muted-foreground">
                        Time
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">
                        Offer
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">
                        Method
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">
                        Value
                      </TableHead>
                      <TableHead className="text-xs text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((redemption) => (
                      <TableRow
                        key={redemption.id}
                        className="border-border hover:bg-muted/50"
                      >
                        <TableCell className="text-sm text-foreground">
                          {redemption.timestamp}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {redemption.offer_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            {redemption.method === "scan" ? (
                              <>
                                <Scan className="h-3.5 w-3.5" />
                                <span>Scan</span>
                              </>
                            ) : (
                              <>
                                <Keyboard className="h-3.5 w-3.5" />
                                <span>Manual</span>
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-foreground">
                          {redemption.discount_text}
                        </TableCell>
                        <TableCell>
                          {redemption.status === "success" ? (
                            <div className="flex items-center gap-1 text-success">
                              <CheckCircle className="h-3.5 w-3.5" />
                              <span className="text-xs">Success</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-destructive">
                              <XCircle className="h-3.5 w-3.5" />
                              <span className="text-xs">Failed</span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-center border-t border-border p-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-xs text-muted-foreground"
                    >
                      View all redemptions
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[80vh] max-w-4xl overflow-hidden border-border bg-card">
                    <DialogHeader>
                      <DialogTitle className="text-card-foreground">
                        All Redemptions
                      </DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border hover:bg-transparent">
                            <TableHead className="text-xs text-muted-foreground">
                              Time
                            </TableHead>
                            <TableHead className="text-xs text-muted-foreground">
                              Offer
                            </TableHead>
                            <TableHead className="text-xs text-muted-foreground">
                              Method
                            </TableHead>
                            <TableHead className="text-xs text-muted-foreground">
                              Value
                            </TableHead>
                            <TableHead className="text-xs text-muted-foreground">
                              Status
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {redemptions.map((redemption) => (
                            <TableRow
                              key={redemption.id}
                              className="border-border hover:bg-muted/50"
                            >
                              <TableCell className="text-sm text-foreground">
                                {redemption.timestamp}
                              </TableCell>
                              <TableCell className="text-sm text-foreground">
                                {redemption.offer_name}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                  {redemption.method === "scan" ? (
                                    <>
                                      <Scan className="h-3.5 w-3.5" />
                                      <span>Scan</span>
                                    </>
                                  ) : (
                                    <>
                                      <Keyboard className="h-3.5 w-3.5" />
                                      <span>Manual</span>
                                    </>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-sm text-foreground">
                                {redemption.discount_text}
                              </TableCell>
                              <TableCell>
                                {redemption.status === "success" ? (
                                  <div className="flex items-center gap-1 text-success">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Success</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 text-destructive">
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="text-xs">Failed</span>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
