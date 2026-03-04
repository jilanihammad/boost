"use client"

import React, { useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Store,
  User,
  Phone,
  Mail,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  Building2,
  MapPin,
} from "lucide-react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

const CATEGORIES = [
  "Coffee & Tea",
  "Restaurant",
  "Bar & Nightlife",
  "Bakery",
  "Retail",
  "Health & Wellness",
  "Fitness",
  "Beauty & Salon",
  "Services",
  "Other",
]

const ZONES = [
  { slug: "capitol-hill", name: "Capitol Hill" },
  { slug: "fremont", name: "Fremont" },
  { slug: "ballard", name: "Ballard" },
  { slug: "downtown", name: "Downtown" },
  { slug: "wallingford", name: "Wallingford" },
]

type Step = "business" | "contact" | "review" | "submitted"

export default function MerchantSignupPage() {
  const [step, setStep] = useState<Step>("business")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState<string | null>(null)

  // Form fields
  const [businessName, setBusinessName] = useState("")
  const [category, setCategory] = useState("")
  const [zoneSlug, setZoneSlug] = useState("")
  const [ownerName, setOwnerName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")

  const stepIndex = (["business", "contact", "review"] as const).indexOf(
    step as "business" | "contact" | "review"
  )

  const canAdvanceToBusiness = businessName.trim() && category
  const canAdvanceToContact = ownerName.trim() && email.trim() && phone.trim()

  const handleSubmit = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/merchants/request-invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            business_name: businessName.trim(),
            owner_name: ownerName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            category,
            zone_slug: zoneSlug || null,
          }),
        }
      )

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail ?? "Something went wrong. Please try again.")
      }

      const data = await res.json()
      setRequestId(data.request_id)
      setStep("submitted")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <BoostLogo />
        </div>

        {/* Step indicator */}
        {step !== "submitted" && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {(["business", "contact", "review"] as const).map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    step === s
                      ? "bg-primary text-primary-foreground"
                      : stepIndex > i
                        ? "bg-primary/30 text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                {i < 2 && <div className="h-px w-8 bg-border" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Step 1: Business Info */}
        {step === "business" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Tell us about your business
              </h1>
              <CardDescription className="text-muted-foreground">
                We&apos;ll use this to set up your Boost profile
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-foreground">
                  Business Name
                </Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="e.g. Sunny Side Café"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="border-border bg-input text-foreground">
                    <Store className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">
                  Neighbourhood{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Select value={zoneSlug} onValueChange={setZoneSlug}>
                  <SelectTrigger className="border-border bg-input text-foreground">
                    <MapPin className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Select your area" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZONES.map((z) => (
                      <SelectItem key={z.slug} value={z.slug}>
                        {z.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="w-full"
                disabled={!canAdvanceToBusiness}
                onClick={() => setStep("contact")}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Contact Info */}
        {step === "contact" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Your contact details
              </h1>
              <CardDescription className="text-muted-foreground">
                So we can reach you about your application
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ownerName" className="text-foreground">
                  Your Name
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="ownerName"
                    type="text"
                    placeholder="Jane Smith"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                    maxLength={100}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="jane@sunnyside.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-foreground">
                  Phone
                </Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(206) 555-1234"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="border-border bg-input pl-10 text-foreground placeholder:text-muted-foreground"
                    maxLength={20}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("business")}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={!canAdvanceToContact}
                  onClick={() => setStep("review")}
                >
                  Continue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Review & Submit */}
        {step === "review" && (
          <Card className="border-border bg-card">
            <CardHeader className="space-y-1 pb-4 text-center">
              <h1 className="text-xl font-semibold text-card-foreground">
                Review your application
              </h1>
              <CardDescription className="text-muted-foreground">
                Make sure everything looks good
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-3 rounded-lg border border-border bg-secondary/50 p-4">
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Business
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {businessName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {category}
                    {zoneSlug && ` · ${ZONES.find((z) => z.slug === zoneSlug)?.name}`}
                  </p>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Contact
                  </p>
                  <p className="text-sm font-medium text-foreground">
                    {ownerName}
                  </p>
                  <p className="text-xs text-muted-foreground">{email}</p>
                  <p className="text-xs text-muted-foreground">{phone}</p>
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">
                  {error}
                </p>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("contact")}
                  disabled={isLoading}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Button
                  className="flex-1"
                  disabled={isLoading}
                  onClick={handleSubmit}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Application"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Submitted confirmation */}
        {step === "submitted" && (
          <Card className="border-border bg-card">
            <CardContent className="space-y-6 pt-8 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
              <div>
                <h1 className="text-xl font-semibold text-card-foreground">
                  Application submitted!
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  We&apos;ll review your application and get back to you within
                  24 hours. Keep an eye on your email at{" "}
                  <span className="font-medium text-foreground">{email}</span>.
                </p>
              </div>

              {requestId && (
                <p className="text-xs text-muted-foreground">
                  Reference: {requestId}
                </p>
              )}

              <Link href="/">
                <Button variant="outline" className="w-full">
                  Back to Boost
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have a merchant account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </main>
  )
}
