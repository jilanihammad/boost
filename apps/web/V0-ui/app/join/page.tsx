"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/lib/auth-context"
import {
  MapPin,
  User,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Gift,
} from "lucide-react"

type JoinStep = "auth" | "location" | "profile" | "complete"

export default function JoinPage() {
  const [step, setStep] = useState<JoinStep>("auth")
  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [locationCoords, setLocationCoords] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [locationMethod, setLocationMethod] = useState<"gps" | "zip" | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)

  const { login } = useAuth()
  const router = useRouter()

  // Step 1: Auth — mock Google sign-in
  const handleGoogleSignIn = () => {
    setIsLoading(true)
    // Mock: simulate Firebase Google OAuth
    setTimeout(() => {
      setEmail("consumer@gmail.com")
      setIsLoading(false)
      setStep("location")
    }, 800)
  }

  // Step 1: Auth — mock email magic link
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setIsLoading(true)
    // Mock: simulate sending magic link then auto-confirm
    setTimeout(() => {
      setIsLoading(false)
      setStep("location")
    }, 1000)
  }

  // Step 2: Location — use browser geolocation
  const handleUseLocation = () => {
    setIsLoading(true)
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser")
      setIsLoading(false)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationMethod("gps")
        setIsLoading(false)
        setStep("profile")
      },
      () => {
        setGeoError("Location access denied. Enter your ZIP code instead.")
        setIsLoading(false)
      },
      { enableHighAccuracy: false, timeout: 10000 }
    )
  }

  // Step 2: Location — use ZIP code
  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!zipCode) return
    setLocationMethod("zip")
    setStep("profile")
  }

  // Step 3: Profile — submit registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!displayName.trim()) return

    setIsLoading(true)

    // Build the registration payload
    const payload: Record<string, unknown> = {
      display_name: displayName.trim(),
    }
    if (locationMethod === "gps" && locationCoords) {
      payload.lat = locationCoords.lat
      payload.lng = locationCoords.lng
    }
    if (locationMethod === "zip" && zipCode) {
      payload.zip_code = zipCode
    }
    if (referralCode.trim()) {
      payload.referred_by = referralCode.trim()
    }

    // TODO: Replace with real API call when backend is wired
    // const res = await fetch("/api/v1/consumer/register", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     Authorization: `Bearer ${firebaseToken}`,
    //   },
    //   body: JSON.stringify(payload),
    // })

    // Mock success
    setTimeout(() => {
      login(email, { name: displayName, role: "consumer" })
      setIsLoading(false)
      setStep("complete")
    }, 1000)
  }

  // Step 4: Complete — redirect to wallet
  const handleGoToWallet = () => {
    router.push("/wallet")
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <BoostLogo />
        </div>

        {/* Step indicators */}
        {step !== "complete" && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {(["auth", "location", "profile"] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : (["auth", "location", "profile"] as const).indexOf(step) > i
                        ? "bg-primary/30 text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && (
                  <div className="h-px w-8 bg-border" />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Step 1: Authentication */}
        {step === "auth" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Join Boost
              </h1>
              <CardDescription className="text-muted-foreground">
                Discover deals from local businesses near you
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg
                    className="mr-2 h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                )}
                Continue with Google
              </Button>

              <Button
                variant="outline"
                className="w-full border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                disabled={isLoading}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending link...
                    </>
                  ) : (
                    "Send sign-in link"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Location */}
        {step === "location" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Your location
              </h1>
              <CardDescription className="text-muted-foreground">
                We&apos;ll show you deals nearby
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <Button
                variant="outline"
                className="w-full border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
                onClick={handleUseLocation}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="mr-2 h-4 w-4" />
                )}
                Use my current location
              </Button>

              {geoError && (
                <p className="text-center text-sm text-destructive">{geoError}</p>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <form onSubmit={handleZipSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zip" className="text-foreground">
                    ZIP Code
                  </Label>
                  <Input
                    id="zip"
                    type="text"
                    placeholder="90210"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    className="border-border bg-input text-foreground placeholder:text-muted-foreground"
                    maxLength={10}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Profile */}
        {step === "profile" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Almost there!
              </h1>
              <CardDescription className="text-muted-foreground">
                Tell us what to call you
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-foreground">
                    Display Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="displayName"
                      type="text"
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                      maxLength={100}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referral" className="text-foreground">
                    Referral Code{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="referral"
                      type="text"
                      placeholder="e.g. BOOST123"
                      value={referralCode}
                      onChange={(e) =>
                        setReferralCode(e.target.value.toUpperCase())
                      }
                      className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground uppercase"
                      maxLength={20}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    "Create my account"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === "complete" && (
          <Card className="border-border bg-card">
            <CardContent className="space-y-6 pt-8 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
              <div>
                <h1 className="text-xl font-semibold text-card-foreground">
                  Welcome to Boost!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your account is ready. Start discovering deals near you.
                </p>
              </div>
              <Button
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleGoToWallet}
              >
                Go to my wallet
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have a merchant account?{" "}
          <a href="/login" className="text-primary hover:underline">
            Sign in here
          </a>
        </p>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          By joining, you agree to our{" "}
          <a href="#" className="text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </div>
    </main>
  )
}
