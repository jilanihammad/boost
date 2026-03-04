"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import {
  Clock,
  Gift,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from "lucide-react"

interface ClaimData {
  qr_data: string
  short_code: string
  expires_at: string
  offer_name: string
  merchant_name: string
  points_preview: number
}

export default function ClaimPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const offerId = params.id as string

  const [claim, setClaim] = useState<ClaimData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [timeLeft, setTimeLeft] = useState("")

  // Mock claim for the V0 prototype (will be replaced with real API call)
  const fetchClaim = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // TODO: Replace with real API call:
      // const res = await fetch(`/api/v1/consumer/claim/${offerId}`, {
      //   method: "POST",
      //   headers: { Authorization: `Bearer ${token}` },
      // })
      // const data = await res.json()

      // Mock data for V0 prototype
      const mockClaim: ClaimData = {
        qr_data: `boost://claim/user-1/${offerId}/${Math.floor(Date.now() / 1000)}/abc123`,
        short_code: "K7M2XP",
        expires_at: new Date(
          new Date().setHours(23, 59, 59, 999)
        ).toISOString(),
        offer_name: "$2 off any coffee",
        merchant_name: "Test Coffee",
        points_preview: 50,
      }

      // Simulate network delay
      await new Promise((r) => setTimeout(r, 800))
      setClaim(mockClaim)
    } catch (err) {
      setError("Failed to claim this offer. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [offerId])

  useEffect(() => {
    fetchClaim()
  }, [fetchClaim])

  // Countdown timer
  useEffect(() => {
    if (!claim?.expires_at) return

    const tick = () => {
      const now = new Date().getTime()
      const expiry = new Date(claim.expires_at).getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setTimeLeft("Expired")
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`)
      } else {
        setTimeLeft(`${seconds}s`)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [claim?.expires_at])

  const handleCopyCode = async () => {
    if (!claim) return
    try {
      await navigator.clipboard.writeText(claim.short_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      setCopied(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground">
          Generating your personal QR code...
        </p>
      </div>
    )
  }

  // Error state
  if (error || !claim) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center border-b border-border px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="mr-2 h-8 w-8"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <BoostLogo />
        </header>
        <main className="flex flex-1 flex-col items-center justify-center p-4">
          <Card className="w-full max-w-sm border-destructive/30 bg-destructive/10">
            <CardContent className="py-8 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
              <h2 className="mt-4 text-lg font-semibold text-foreground">
                Couldn&apos;t Claim Offer
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {error || "Something went wrong. Please try again."}
              </p>
              <Button
                className="mt-6 w-full"
                onClick={fetchClaim}
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  const isExpired = timeLeft === "Expired"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center border-b border-border px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="mr-2 h-8 w-8"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <BoostLogo />
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border bg-card">
          <CardHeader className="pb-2 text-center">
            <p className="text-sm font-medium text-primary">
              {claim.merchant_name}
            </p>
            <h1 className="text-xl font-bold text-card-foreground">
              {claim.offer_name}
            </h1>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* QR Code */}
            <div className="flex justify-center">
              <div
                className={`rounded-xl bg-white p-4 ${
                  isExpired ? "opacity-40" : ""
                }`}
              >
                <QRCodeSVG
                  value={claim.qr_data}
                  size={220}
                  level="M"
                  includeMargin={false}
                />
              </div>
            </div>

            {/* Short code fallback */}
            <div className="flex items-center justify-center gap-2">
              <code className="rounded bg-secondary px-3 py-1.5 font-mono text-lg font-bold tracking-widest text-secondary-foreground">
                {claim.short_code}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleCopyCode}
              >
                {copied ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Copy className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </div>

            {/* Countdown timer */}
            <div
              className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
                isExpired
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Clock className="h-4 w-4" />
              {isExpired ? (
                <span>QR code expired — claim a new one</span>
              ) : (
                <span>Expires in {timeLeft}</span>
              )}
            </div>

            {/* Points preview */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Gift className="h-4 w-4 text-primary" />
              <span>
                You&apos;ll earn{" "}
                <strong className="text-foreground">
                  {claim.points_preview} points
                </strong>
              </span>
            </div>

            {/* Instructions */}
            <p className="text-center text-xs text-muted-foreground">
              Show this QR code to the cashier to redeem your offer
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
