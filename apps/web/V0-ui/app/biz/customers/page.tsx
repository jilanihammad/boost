"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Users,
  Search,
  Download,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  UserX,
  UserCheck,
  Crown,
  UserPlus,
  RefreshCw,
} from "lucide-react"

// --- Types ---

type Segment = "new" | "returning" | "vip" | "at_risk" | "lost"

interface Customer {
  consumer_id: string
  display_name: string
  visit_count: number
  last_visit: string
  segment: Segment
  estimated_ltv: number
  loyalty_stamps?: { current: number; required: number }
}

// --- Segment config ---

const segmentConfig: Record<Segment, { label: string; color: string; icon: typeof Users }> = {
  new: { label: "New", color: "bg-blue-500/20 text-blue-400 border-blue-500/30", icon: UserPlus },
  returning: { label: "Returning", color: "bg-green-500/20 text-green-400 border-green-500/30", icon: RefreshCw },
  vip: { label: "VIP", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", icon: Crown },
  at_risk: { label: "At-risk", color: "bg-orange-500/20 text-orange-400 border-orange-500/30", icon: AlertTriangle },
  lost: { label: "Lost", color: "bg-red-500/20 text-red-400 border-red-500/30", icon: UserX },
}

const allSegments: (Segment | "all")[] = ["all", "new", "returning", "vip", "at_risk", "lost"]

// --- Mock data ---

const mockCustomers: Customer[] = [
  { consumer_id: "c1", display_name: "Sarah M.", visit_count: 12, last_visit: "2025-01-18T14:30:00Z", segment: "vip", estimated_ltv: 144, loyalty_stamps: { current: 7, required: 10 } },
  { consumer_id: "c2", display_name: "James K.", visit_count: 6, last_visit: "2025-01-17T10:15:00Z", segment: "vip", estimated_ltv: 72, loyalty_stamps: { current: 1, required: 10 } },
  { consumer_id: "c3", display_name: "Emily R.", visit_count: 3, last_visit: "2025-01-16T09:00:00Z", segment: "returning", estimated_ltv: 36, loyalty_stamps: { current: 3, required: 10 } },
  { consumer_id: "c4", display_name: "Michael T.", visit_count: 4, last_visit: "2025-01-15T16:45:00Z", segment: "returning", estimated_ltv: 48, loyalty_stamps: { current: 4, required: 10 } },
  { consumer_id: "c5", display_name: "Lisa P.", visit_count: 1, last_visit: "2025-01-14T11:20:00Z", segment: "new", estimated_ltv: 12 },
  { consumer_id: "c6", display_name: "David W.", visit_count: 8, last_visit: "2024-12-28T13:00:00Z", segment: "at_risk", estimated_ltv: 96, loyalty_stamps: { current: 3, required: 10 } },
  { consumer_id: "c7", display_name: "Amanda B.", visit_count: 3, last_visit: "2024-12-20T08:30:00Z", segment: "at_risk", estimated_ltv: 36, loyalty_stamps: { current: 3, required: 10 } },
  { consumer_id: "c8", display_name: "Chris N.", visit_count: 5, last_visit: "2024-12-01T15:00:00Z", segment: "lost", estimated_ltv: 60, loyalty_stamps: { current: 0, required: 10 } },
  { consumer_id: "c9", display_name: "Rachel G.", visit_count: 2, last_visit: "2024-11-15T12:00:00Z", segment: "lost", estimated_ltv: 24 },
  { consumer_id: "c10", display_name: "Tom H.", visit_count: 1, last_visit: "2025-01-18T09:00:00Z", segment: "new", estimated_ltv: 12 },
  { consumer_id: "c11", display_name: "Nina S.", visit_count: 2, last_visit: "2025-01-12T14:00:00Z", segment: "returning", estimated_ltv: 24, loyalty_stamps: { current: 2, required: 10 } },
  { consumer_id: "c12", display_name: "Oscar L.", visit_count: 7, last_visit: "2025-01-17T17:30:00Z", segment: "vip", estimated_ltv: 84, loyalty_stamps: { current: 2, required: 10 } },
]

const mockSegmentCounts: Record<string, number> = {
  new: 2,
  returning: 3,
  vip: 3,
  at_risk: 2,
  lost: 2,
}

// --- Sort helpers ---

type SortKey = "display_name" | "visit_count" | "last_visit" | "estimated_ltv"
type SortDir = "asc" | "desc"

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function SegmentBadge({ segment }: { segment: Segment }) {
  const config = segmentConfig[segment]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${config.color}`}>
      <config.icon className="h-3 w-3" />
      {config.label}
    </span>
  )
}

function exportCsv(customers: Customer[]) {
  const header = "Name,Visits,Last Visit,Segment,Estimated LTV\n"
  const rows = customers.map((c) =>
    `"${c.display_name}",${c.visit_count},"${c.last_visit}","${c.segment}",${c.estimated_ltv.toFixed(2)}`
  ).join("\n")
  const blob = new Blob([header + rows], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "customers.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function CustomersPage() {
  const [search, setSearch] = useState("")
  const [activeSegment, setActiveSegment] = useState<Segment | "all">("all")
  const [sortKey, setSortKey] = useState<SortKey>("last_visit")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const filtered = useMemo(() => {
    let list = mockCustomers

    // Segment filter
    if (activeSegment !== "all") {
      list = list.filter((c) => c.segment === activeSegment)
    }

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.display_name.toLowerCase().includes(q))
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "display_name":
          cmp = a.display_name.localeCompare(b.display_name)
          break
        case "visit_count":
          cmp = a.visit_count - b.visit_count
          break
        case "last_visit":
          cmp = new Date(a.last_visit).getTime() - new Date(b.last_visit).getTime()
          break
        case "estimated_ltv":
          cmp = a.estimated_ltv - b.estimated_ltv
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })

    return list
  }, [search, activeSegment, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null
    return sortDir === "asc" ? (
      <ChevronUp className="inline h-3 w-3" />
    ) : (
      <ChevronDown className="inline h-3 w-3" />
    )
  }

  const totalCustomers = mockCustomers.length
  const activeCount = mockCustomers.filter((c) => {
    const diff = (Date.now() - new Date(c.last_visit).getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 30
  }).length
  const atRiskCount = mockSegmentCounts.at_risk
  const lostCount = mockSegmentCounts.lost

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <BoostLogo />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          Customers
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4 lg:p-6">
        {/* Summary Bar */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-card-foreground">{totalCustomers}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Active (30d)</p>
              <p className="text-2xl font-bold text-green-400">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">At-risk</p>
              <p className="text-2xl font-bold text-orange-400">{atRiskCount}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Lost</p>
              <p className="text-2xl font-bold text-red-400">{lostCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search + Export */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-border bg-secondary pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-border"
            onClick={() => exportCsv(filtered)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Segment Tabs */}
        <div className="mb-4 flex flex-wrap gap-2">
          {allSegments.map((seg) => {
            const isActive = activeSegment === seg
            const count = seg === "all" ? totalCustomers : (mockSegmentCounts[seg] || 0)
            return (
              <button
                key={seg}
                onClick={() => setActiveSegment(seg)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:bg-muted"
                }`}
              >
                {seg === "all" ? "All" : segmentConfig[seg as Segment].label}{" "}
                <span className="ml-1 opacity-70">{count}</span>
              </button>
            )
          })}
        </div>

        {/* Customer Table */}
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer text-xs text-muted-foreground"
                      onClick={() => toggleSort("display_name")}
                    >
                      Customer <SortIcon col="display_name" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-center text-xs text-muted-foreground"
                      onClick={() => toggleSort("visit_count")}
                    >
                      Visits <SortIcon col="visit_count" />
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-xs text-muted-foreground"
                      onClick={() => toggleSort("last_visit")}
                    >
                      Last Visit <SortIcon col="last_visit" />
                    </TableHead>
                    <TableHead className="text-xs text-muted-foreground">Segment</TableHead>
                    <TableHead
                      className="cursor-pointer text-right text-xs text-muted-foreground"
                      onClick={() => toggleSort("estimated_ltv")}
                    >
                      LTV <SortIcon col="estimated_ltv" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        No customers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow
                        key={c.consumer_id}
                        className="cursor-pointer border-border hover:bg-muted/50"
                        onClick={() => window.location.href = `/biz/customers/${c.consumer_id}`}
                      >
                        <TableCell className="font-medium text-foreground">
                          {c.display_name}
                          {c.loyalty_stamps && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              🎟️ {c.loyalty_stamps.current}/{c.loyalty_stamps.required}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm text-foreground">
                          {c.visit_count}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(c.last_visit)}
                        </TableCell>
                        <TableCell>
                          <SegmentBadge segment={c.segment} />
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium text-foreground">
                          ${c.estimated_ltv.toFixed(0)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <p className="mt-3 text-center text-xs text-muted-foreground">
          Showing {filtered.length} of {totalCustomers} customers
        </p>
      </main>
    </div>
  )
}
