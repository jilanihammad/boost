"use client"

import { useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
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
import { useAuth } from "@/lib/auth-context"
import { merchant } from "@/lib/mock-data"
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

type RedemptionResult = "idle" | "scanning" | "success" | "already_redeemed" | "expired"

export default function RedeemPage() {
  const { role, logout } = useAuth()
  const [manualCode, setManualCode] = useState("")
  const [result, setResult] = useState<RedemptionResult>("idle")
  const [location, setLocation] = useState(merchant.locations[0])
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false)

  const isAdmin = role === "merchant_admin"

  const handleStartScanner = () => {
    setResult("scanning")
    // Simulate scanner detecting a code after 2 seconds
    setTimeout(() => {
      // Randomly pick a result for demo
      const results: RedemptionResult[] = ["success", "already_redeemed", "expired"]
      const randomResult = results[Math.floor(Math.random() * results.length)]
      setResult(randomResult)
    }, 2000)
  }

  const handleManualRedeem = () => {
    if (manualCode.length < 6) return
    setIsManualDialogOpen(false)
    setManualCode("")
    // Simulate redemption
    const results: RedemptionResult[] = ["success", "already_redeemed", "expired"]
    const randomResult = results[Math.floor(Math.random() * results.length)]
    setResult(randomResult)
  }

  const resetResult = () => {
    setResult("idle")
  }

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
              {merchant.locations.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
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
            onClick={logout}
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
              <div className="relative mx-auto aspect-square max-w-[280px] overflow-hidden rounded-xl border-2 border-dashed border-primary/50 bg-muted/50">
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Camera className="h-12 w-12 animate-pulse text-primary" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Point camera at QR code
                  </p>
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
                $2 off any coffee applied
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Code: BOOST-7K3M
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
                This offer was already used today
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Redeemed at 11:34 AM
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
            <p className="text-2xl font-semibold text-foreground">32</p>
            <p className="text-xs text-muted-foreground">Today</p>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <p className="text-2xl font-semibold text-foreground">18</p>
            <p className="text-xs text-muted-foreground">Remaining</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
