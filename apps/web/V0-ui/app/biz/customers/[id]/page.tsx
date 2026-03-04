"use client"

import { use } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Activity,
  Crown,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  UserX,
  Stamp,
  Gift,
} from "lucide-react"

// --- Types ---

type Segment = "new" | "returning" | "vip" | "at_risk" | "lost"

interface VisitItem {
  timestamp: string
  offer_name: string
  points_earned: number
  stamp_earned: boolean
}

interface CustomerDetail {
  consumer_id: string
  display_name: string
  visit_count: number
  last_visit: string
  first_visit: string
  segment: Segment
  estimated_ltv: number
  loyalty_stamps?: { current: number; required: number }
  visit_timeline: VisitItem[]
}

// --- Segment config ---

const segmentConfig: Record<Segment, { label: string; color: string; bg: string; icon: typeof Crown }> = {
  new: { label: "New", color: "text-blue-400", bg: "bg-blue-500/20 border-blue-500/30", icon: UserPlus },
  returning: { label: "Returning", color: "text-green-400", bg: "bg-green-500/20 border-green-500/30", icon: RefreshCw },
  vip: { label: "VIP", color: "text-yellow-400", bg: "bg-yellow-500/20 border-yellow-500/30", icon: Crown },
  at_risk: { label: "At-risk", color: "text-orange-400", bg: "bg-orange-500/20 border-orange-500/30", icon: AlertTriangle },
  lost: { label: "Lost", color: "text-red-400", bg: "bg-red-500/20 border-red-500/30", icon: UserX },
}

// --- Mock data ---

const mockCustomers: Record<string, CustomerDetail> = {
  c1: {
    consumer_id: "c1",
    display_name: "Sarah M.",
    visit_count: 12,
    last_visit: "2025-01-18T14:30:00Z",
    first_visit: "2024-09-05T10:00:00Z",
    segment: "vip",
    estimated_ltv: 144,
    loyalty_stamps: { current: 7, required: 10 },
    visit_timeline: [
      { timestamp: "2025-01-18T14:30:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
      { timestamp: "2025-01-15T11:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2025-01-10T09:30:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2025-01-05T16:00:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-12-28T10:45:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-12-20T14:00:00Z", offer_name: "Free Cookie Friday", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-12-12T09:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-11-30T11:30:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-11-15T15:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-10-28T10:00:00Z", offer_name: "Free Cookie Friday", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-10-10T09:45:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-09-05T10:00:00Z", offer_name: "Grand Opening Special", points_earned: 50, stamp_earned: true },
    ],
  },
  c6: {
    consumer_id: "c6",
    display_name: "David W.",
    visit_count: 8,
    last_visit: "2024-12-28T13:00:00Z",
    first_visit: "2024-08-15T09:00:00Z",
    segment: "at_risk",
    estimated_ltv: 96,
    loyalty_stamps: { current: 3, required: 10 },
    visit_timeline: [
      { timestamp: "2024-12-28T13:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-12-15T10:00:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-11-30T14:30:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-11-10T09:00:00Z", offer_name: "Free Cookie Friday", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-10-20T11:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-09-28T16:00:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-09-10T10:30:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
      { timestamp: "2024-08-15T09:00:00Z", offer_name: "Grand Opening Special", points_earned: 50, stamp_earned: true },
    ],
  },
}

// Default for unknown IDs
const defaultCustomer: CustomerDetail = {
  consumer_id: "unknown",
  display_name: "Unknown C.",
  visit_count: 3,
  last_visit: "2025-01-10T12:00:00Z",
  first_visit: "2024-11-01T10:00:00Z",
  segment: "returning",
  estimated_ltv: 36,
  loyalty_stamps: { current: 3, required: 10 },
  visit_timeline: [
    { timestamp: "2025-01-10T12:00:00Z", offer_name: "$2 Off Any Coffee", points_earned: 50, stamp_earned: true },
    { timestamp: "2024-12-15T14:00:00Z", offer_name: "Happy Hour 2-for-1", points_earned: 50, stamp_earned: true },
    { timestamp: "2024-11-01T10:00:00Z", offer_name: "Grand Opening Special", points_earned: 50, stamp_earned: true },
  ],
}

function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const customer = mockCustomers[resolvedParams.id] || { ...defaultCustomer, consumer_id: resolvedParams.id }
  const seg = segmentConfig[customer.segment]
  const SegIcon = seg.icon

  const memberDays = daysBetween(customer.first_visit, new Date().toISOString())
  const avgFrequency = customer.visit_count > 1
    ? Math.round(memberDays / customer.visit_count)
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/biz/customers">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to customers</span>
            </Link>
          </Button>
          <BoostLogo />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          Customer Detail
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 lg:p-6">
        {/* Customer Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{customer.display_name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${seg.bg} ${seg.color}`}>
                <SegIcon className="h-3 w-3" />
                {seg.label}
              </span>
              <span className="text-xs text-muted-foreground">
                Member since {new Date(customer.first_visit).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs">Visits</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">{customer.visit_count}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span className="text-xs">Est. Spent</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">${customer.estimated_ltv}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Avg Freq</span>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {avgFrequency > 0 ? `${avgFrequency}d` : "—"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Loyalty Progress */}
        {customer.loyalty_stamps && (
          <Card className="mb-6 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-card-foreground">
                <Stamp className="h-4 w-4" />
                Loyalty Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {customer.loyalty_stamps.current} / {customer.loyalty_stamps.required} stamps
                </span>
                <span className="text-xs text-muted-foreground">
                  {customer.loyalty_stamps.required - customer.loyalty_stamps.current} to go
                </span>
              </div>
              <Progress
                value={(customer.loyalty_stamps.current / customer.loyalty_stamps.required) * 100}
                className="h-3"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from({ length: customer.loyalty_stamps.required }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-xs ${
                      i < customer.loyalty_stamps!.current
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < customer.loyalty_stamps!.current ? (
                      <Stamp className="h-4 w-4" />
                    ) : (
                      <span>{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Visit Timeline */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm text-card-foreground">
              Visit Timeline ({customer.visit_timeline.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {customer.visit_timeline.map((visit, idx) => (
                <div key={idx} className="flex items-center gap-4 px-6 py-3">
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center">
                    <div className={`h-2.5 w-2.5 rounded-full ${idx === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  </div>

                  {/* Visit info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {visit.offer_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFullDate(visit.timestamp)} at {formatTime(visit.timestamp)}
                    </p>
                  </div>

                  {/* Points + stamp */}
                  <div className="flex items-center gap-2 text-right shrink-0">
                    <span className="text-xs font-medium text-primary">+{visit.points_earned} pts</span>
                    {visit.stamp_earned && (
                      <Stamp className="h-3.5 w-3.5 text-yellow-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
