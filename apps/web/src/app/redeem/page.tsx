"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BoostLogo } from "@/components/boost-logo"
// Role is derived from Firebase claims; the toggle is display-only.
import { RoleToggle } from "@/components/role-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth"
import { redeemToken, type RedeemResponse } from "@/lib/api"
import {
  QrCode,
  Camera,
  Keyboard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  LayoutDashboard,
  LogOut,
} from "lucide-react"
import { BrowserQRCodeReader } from "@zxing/browser"

type RedemptionResult = "idle" | "scanning" | "success" | "already_redeemed" | "expired"

// Placeholder locations until we fetch from merchant profile
const LOCATIONS = ["Main", "Downtown", "Uptown"]

export default function RedeemPage() {
  const { user, loading, role, signOut, idToken } = useAuth()
  const router = useRouter()
  const [manualCode, setManualCode] = useState("")
  const [result, setResult] = useState<RedemptionResult>("idle")
  const [location, setLocation] = useState(LOCATIONS[0])
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)
  const [lastRedemption, setLastRedemption] = useState<RedeemResponse | null>(null)
  const [todayCount, setTodayCount] = useState(0)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const qrReaderRef = useRef<BrowserQRCodeReader | null>(null)
  const stopScanRef = useRef<(() => void) | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)

  // All roles (staff, merchant_admin, owner) can access dashboard
  const canViewDashboard = role !== null

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login")
    }
  }, [user, loading, router])

  // Block rendering until auth is confirmed
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <p>{loading ? "Loading..." : "Redirecting to login..."}</p>
      </div>
    )
  }

  // Process redemption via API
  const processRedemption = async (tokenCode: string, method: "scan" | "manual") => {
    if (!idToken) return

    try {
      const response = await redeemToken(idToken, {
        token: tokenCode,
        location,
        method,
      })

      setLastRedemption(response)

      if (response.success) {
        setResult("success")
        setTodayCount((c) => c + 1)
      } else if (response.message.includes("already")) {
        setResult("already_redeemed")
      } else if (response.message.includes("expired") || response.message.includes("invalid")) {
        setResult("expired")
      } else {
        // Other failures (like cap reached, offer paused)
        setResult("expired")
      }
    } catch (err: any) {
      console.error("Redemption error:", err)
      setScanError(err.message || "Redemption failed")
      setResult("expired")
    }
  }

  const handleStartScanner = async () => {
    setScanError(null)
    setResult("scanning")

    // NOTE: iOS Safari requires HTTPS for camera access when not on localhost.
    // If you run this on a phone via LAN IP (http://192.168...), camera may be blocked.

    try {
      if (!videoRef.current) throw new Error("Camera element not ready")

      // Clean any previous session
      stopScanRef.current?.()
      stopScanRef.current = null

      const reader = new BrowserQRCodeReader()
      qrReaderRef.current = reader

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (qrResult, err) => {
          if (qrResult) {
            stopScanRef.current?.()
            // Extract token from QR data (format: https://boost.app/r/{token_id})
            const qrText = qrResult.getText()
            const tokenMatch = qrText.match(/\/r\/([^/?]+)/)
            const tokenCode = tokenMatch ? tokenMatch[1] : qrText
            await processRedemption(tokenCode, "scan")
          }

          // Ignore decode errors (they happen constantly while scanning)
          void err
        },
      )

      stopScanRef.current = () => {
        try {
          controls.stop()
        } catch {
          // ignore
        }
      }
    } catch (e: any) {
      setScanError(e?.message || "Unable to start camera")
      setResult("idle")
    }
  }

  const handleManualRedeem = async () => {
    if (manualCode.length < 4) return
    setIsManualDialogOpen(false)
    const code = manualCode
    setManualCode("")
    await processRedemption(code, "manual")
  }

  const resetResult = () => {
    stopScanRef.current?.()
    setResult("idle")
  }

  useEffect(() => {
    return () => {
      stopScanRef.current?.()
    }
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <BoostLogo />
          <Select value={location} onValueChange={setLocation}>
            <SelectTrigger className="h-8 w-[140px] border-border bg-secondary text-xs text-secondary-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCATIONS.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {canViewDashboard && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            </Button>
          )}
          <RoleToggle />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={async () => {
              await signOut()
            }}
            asChild
          >
            <Link href="/login">
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Sign out</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        {result === "idle" && (
          <Card className="w-full max-w-sm border-border bg-card">
            <CardHeader className="text-center">
              <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <QrCode className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-xl text-card-foreground">
                Scan Customer QR
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Scan the customer{"'"}s QR code to redeem their offer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                size="lg"
                onClick={handleStartScanner}
              >
                <Camera className="h-5 w-5" />
                Start Scanner
              </Button>

              <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-border bg-transparent text-foreground hover:bg-secondary"
                  >
                    <Keyboard className="h-4 w-4" />
                    Enter code manually
                  </Button>
                </DialogTrigger>
                <DialogContent className="border-border bg-card sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-card-foreground">
                      Enter Redemption Code
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                      Enter the 6-8 character code shown on the customer{"'"}s phone
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Input
                      placeholder="e.g., ABCD1234"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="border-border bg-input text-center text-lg font-mono tracking-wider text-foreground placeholder:text-muted-foreground"
                      maxLength={8}
                      autoFocus
                    />
                  </div>
                  <DialogFooter className="gap-2 sm:gap-0">
                    <DialogClose asChild>
                      <Button
                        variant="outline"
                        className="border-border bg-transparent text-foreground"
                      >
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      onClick={handleManualRedeem}
                      disabled={manualCode.length < 6}
                      className="bg-primary text-primary-foreground"
                    >
                      Redeem
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {result === "scanning" && (
          <Card className="w-full max-w-sm border-border bg-card">
            <CardContent className="py-8">
              <div className="relative mx-auto aspect-square max-w-[280px] overflow-hidden rounded-xl border-2 border-dashed border-primary/50 bg-black">
                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-cover"
                  muted
                  playsInline
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/60 p-3">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4 text-white" />
                    <p className="text-xs text-white/90">Point camera at QR code</p>
                  </div>
                  {scanError && <p className="mt-1 text-xs text-red-300">{scanError}</p>}
                </div>
                {/* Scanning animation line */}
                <div className="absolute left-0 right-0 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-primary" />
              </div>
              <Button
                variant="outline"
                className="mt-6 w-full border-border bg-transparent text-foreground"
                onClick={resetResult}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        )}

        {result === "success" && (
          <Card className="w-full max-w-sm border-success/30 bg-success/10">
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/20">
                <CheckCircle2 className="h-10 w-10 text-success" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Redemption Successful
              </h2>
              <p className="mt-2 text-muted-foreground">
                {lastRedemption?.discount_text || "Discount applied"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {lastRedemption?.offer_name || ""}
              </p>
              <Button
                className="mt-6 w-full bg-success text-success-foreground hover:bg-success/90"
                onClick={resetResult}
              >
                Scan Next Customer
              </Button>
            </CardContent>
          </Card>
        )}

        {result === "already_redeemed" && (
          <Card className="w-full max-w-sm border-warning/30 bg-warning/10">
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-warning/20">
                <AlertTriangle className="h-10 w-10 text-warning" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Already Redeemed
              </h2>
              <p className="mt-2 text-muted-foreground">
                {lastRedemption?.message || "This offer was already used"}
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full border-border bg-transparent text-foreground"
                onClick={resetResult}
              >
                Try Another Code
              </Button>
            </CardContent>
          </Card>
        )}

        {result === "expired" && (
          <Card className="w-full max-w-sm border-destructive/30 bg-destructive/10">
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-destructive/20">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-semibold text-foreground">
                Invalid or Expired
              </h2>
              <p className="mt-2 text-muted-foreground">
                This code is no longer valid
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Ask customer to refresh their offer
              </p>
              <Button
                variant="outline"
                className="mt-6 w-full border-border bg-transparent text-foreground"
                onClick={resetResult}
              >
                Try Another Code
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer for staff - quick stats */}
      <footer className="border-t border-border px-4 py-3">
        <div className="flex items-center justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">{todayCount}</p>
            <p className="text-xs text-muted-foreground">This session</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
