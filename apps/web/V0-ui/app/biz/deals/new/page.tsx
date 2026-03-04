"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/lib/auth-context"
import {
  ArrowLeft,
  DollarSign,
  Gift,
  Copy,
  Clock,
  UserPlus,
  Wand2,
  Sparkles,
  Loader2,
  Eye,
  Tag,
  ChevronRight,
  Check,
} from "lucide-react"

// --- Types ---

type TemplateType = "dollar_off" | "free_item" | "bogo" | "happy_hour" | "first_time" | "custom"

interface TemplateOption {
  type: TemplateType
  name: string
  icon: React.ReactNode
  bestFor: string
  color: string
}

interface AiSuggestion {
  headline: string
  description: string
  recommended_terms: string
}

type TargetAudience = "everyone" | "new_only" | "returning_only" | "referred_only"

interface DealFormData {
  headline: string
  discount_text: string
  applies_to: string
  terms: string
  cap_daily: number
  active_hours_start: string
  active_hours_end: string
  active_days: boolean[]
  start_date: string
  end_date: string
  target_audience: TargetAudience
  value_per_redemption: number
}

// --- Constants ---

const TEMPLATES: TemplateOption[] = [
  {
    type: "dollar_off",
    name: "Dollar Off",
    icon: <DollarSign className="h-6 w-6" />,
    bestFor: "Driving first visits",
    color: "text-green-400",
  },
  {
    type: "free_item",
    name: "Free Item",
    icon: <Gift className="h-6 w-6" />,
    bestFor: "Upselling add-ons",
    color: "text-purple-400",
  },
  {
    type: "bogo",
    name: "BOGO",
    icon: <Copy className="h-6 w-6" />,
    bestFor: "Group visits",
    color: "text-blue-400",
  },
  {
    type: "happy_hour",
    name: "Happy Hour",
    icon: <Clock className="h-6 w-6" />,
    bestFor: "Off-peak traffic",
    color: "text-amber-400",
  },
  {
    type: "first_time",
    name: "First-Time",
    icon: <UserPlus className="h-6 w-6" />,
    bestFor: "New customer acquisition",
    color: "text-pink-400",
  },
  {
    type: "custom",
    name: "Custom",
    icon: <Wand2 className="h-6 w-6" />,
    bestFor: "Anything you want",
    color: "text-cyan-400",
  },
]

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

const TARGET_AUDIENCE_OPTIONS: { value: TargetAudience; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "new_only", label: "New customers only" },
  { value: "returning_only", label: "Returning customers only" },
  { value: "referred_only", label: "Referred customers only" },
]

const MOCK_MERCHANT_ID = "merchant-001"

const DEFAULT_FORM: DealFormData = {
  headline: "",
  discount_text: "",
  applies_to: "",
  terms: "",
  cap_daily: 50,
  active_hours_start: "09:00",
  active_hours_end: "21:00",
  active_days: [true, true, true, true, true, true, true],
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
  target_audience: "everyone",
  value_per_redemption: 2.0,
}

// --- Component ---

export default function NewDealPage() {
  const { role } = useAuth()

  const [step, setStep] = useState<"template" | "form">("template")
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | null>(null)
  const [form, setForm] = useState<DealFormData>(DEFAULT_FORM)

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([])
  const [showAiPanel, setShowAiPanel] = useState(false)

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Select template and move to form
  const selectTemplate = (type: TemplateType) => {
    setSelectedTemplate(type)
    setStep("form")
    setAiSuggestions([])
    setShowAiPanel(false)
  }

  // Go back to template picker
  const goBack = () => {
    setStep("template")
    setSelectedTemplate(null)
    setForm(DEFAULT_FORM)
    setAiSuggestions([])
    setShowAiPanel(false)
    setSubmitted(false)
    setSubmitError(null)
  }

  // Generate AI copy
  const generateAiCopy = async () => {
    if (!selectedTemplate) return

    setAiLoading(true)
    setShowAiPanel(true)
    setAiSuggestions([])

    try {
      // TODO: Replace with real API call when auth is wired up
      // const res = await fetch("/api/v1/deals/generate-copy", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({ merchant_id: MOCK_MERCHANT_ID, template_type: selectedTemplate }),
      // })
      // const data = await res.json()
      // setAiSuggestions(data.suggestions)

      // Mock API response for now
      await new Promise((r) => setTimeout(r, 1200))

      const mockSuggestions: Record<TemplateType, AiSuggestion[]> = {
        dollar_off: [
          { headline: "$5 Off Your Next Order", description: "Save $5 on any purchase of $15 or more.", recommended_terms: "Min purchase $15. One per customer per day." },
          { headline: "Take $3 Off Any Item", description: "Enjoy $3 off anything on the menu.", recommended_terms: "One per customer per visit." },
          { headline: "$10 Off Your First Visit", description: "Get $10 off when you spend $25 or more.", recommended_terms: "First-time customers only. Min spend $25." },
        ],
        free_item: [
          { headline: "Free Coffee With Any Purchase", description: "Get a complimentary coffee with any food item.", recommended_terms: "Regular size only. One per customer per day." },
          { headline: "Free Appetizer on Us", description: "Enjoy a free appetizer with any entrée.", recommended_terms: "Select appetizers only. Dine-in only." },
          { headline: "Free Dessert With Your Meal", description: "Dessert is on the house with any entrée.", recommended_terms: "Select desserts. One per customer." },
        ],
        bogo: [
          { headline: "Buy One, Get One Free", description: "Bring a friend — second item is free!", recommended_terms: "Equal or lesser value. One per customer per day." },
          { headline: "BOGO 50% Off", description: "Buy one, get the second at half price.", recommended_terms: "Second item equal or lesser value." },
          { headline: "Buy 2, Get 1 Free", description: "Stock up and save — third item is on us.", recommended_terms: "Free item is lowest priced." },
        ],
        happy_hour: [
          { headline: "Happy Hour: 30% Off Everything", description: "Everything is 30% off during happy hour!", recommended_terms: "Valid 3–6 PM. Dine-in only." },
          { headline: "Half-Price Drinks After 4 PM", description: "All beverages 50% off during happy hour.", recommended_terms: "Valid 4–7 PM. Select beverages." },
          { headline: "$2 Off Happy Hour Specials", description: "$2 off our happy hour menu every weekday.", recommended_terms: "Mon–Fri, 3–6 PM only." },
        ],
        first_time: [
          { headline: "Welcome! 20% Off First Visit", description: "New here? 20% off your entire first order.", recommended_terms: "First-time customers only. Valid 30 days." },
          { headline: "First Visit: Free Upgrade", description: "Get a free upgrade on your first purchase.", recommended_terms: "New customers only. Subject to availability." },
          { headline: "New Customer: $10 Off", description: "Save $10 on orders of $20+ on your first visit.", recommended_terms: "First-time only. Min purchase $20." },
        ],
        custom: [
          { headline: "This Week's Special Deal", description: "Don't miss our limited-time weekly offer!", recommended_terms: "While supplies last. One per customer." },
          { headline: "Exclusive Member Offer", description: "A special deal for our loyal customers.", recommended_terms: "Must be registered. Valid 7 days." },
          { headline: "Flash Deal — Today Only", description: "Grab this deal before it's gone!", recommended_terms: "Today only. One per customer." },
        ],
      }

      setAiSuggestions(mockSuggestions[selectedTemplate] || mockSuggestions.custom)
    } catch (err) {
      console.error("AI generation failed:", err)
    } finally {
      setAiLoading(false)
    }
  }

  // Pick an AI suggestion
  const pickSuggestion = (suggestion: AiSuggestion) => {
    setForm((prev) => ({
      ...prev,
      headline: suggestion.headline,
      discount_text: suggestion.headline,
      terms: suggestion.recommended_terms,
    }))
    setShowAiPanel(false)
  }

  // Toggle active day
  const toggleDay = (index: number) => {
    setForm((prev) => ({
      ...prev,
      active_days: prev.active_days.map((d, i) => (i === index ? !d : d)),
    }))
  }

  // Submit deal
  const handleSubmit = async () => {
    if (!form.headline.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    try {
      // Build active hours string
      const activeDaysStr = form.active_days
        .map((active, i) => (active ? DAYS_OF_WEEK[i] : null))
        .filter(Boolean)
        .join(", ")
      const activeHours = `${form.active_hours_start}-${form.active_hours_end} ${activeDaysStr}`

      // TODO: Replace with real API call when auth is wired up
      // const res = await fetch("/offers", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      //   body: JSON.stringify({
      //     merchant_id: MOCK_MERCHANT_ID,
      //     name: form.headline,
      //     discount_text: form.discount_text || form.headline,
      //     terms: form.terms || null,
      //     cap_daily: form.cap_daily,
      //     active_hours: activeHours,
      //     value_per_redemption: form.value_per_redemption,
      //     target_audience: form.target_audience,
      //   }),
      // })

      // Mock submit
      await new Promise((r) => setTimeout(r, 800))
      setSubmitted(true)
    } catch (err) {
      setSubmitError("Failed to create deal. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // --- Render: Template Picker ---
  if (step === "template") {
    return (
      <div className="min-h-screen bg-background">
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
            <Tag className="h-4 w-4" />
            Create Deal
          </div>
        </header>

        <main className="mx-auto max-w-2xl p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Choose a Template</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a deal type to get started. You can customize everything after.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.type}
                onClick={() => selectTemplate(template.type)}
                className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-5 text-center transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
              >
                <div className={`rounded-lg bg-muted p-3 ${template.color} transition-transform group-hover:scale-110`}>
                  {template.icon}
                </div>
                <span className="text-sm font-semibold text-card-foreground">{template.name}</span>
                <span className="text-xs text-muted-foreground">{template.bestFor}</span>
              </button>
            ))}
          </div>
        </main>
      </div>
    )
  }

  // --- Render: Success ---
  if (submitted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-3">
            <BoostLogo />
          </div>
        </header>

        <main className="mx-auto flex max-w-lg flex-col items-center p-8 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Deal Created!</h1>
          <p className="mt-2 text-muted-foreground">
            Your deal &ldquo;{form.headline}&rdquo; is now live. Customers can start redeeming right away.
          </p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={goBack}>
              Create Another
            </Button>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // --- Render: Form + Preview ---
  const selectedTemplateMeta = TEMPLATES.find((t) => t.type === selectedTemplate)

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to templates</span>
          </Button>
          <BoostLogo />
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {selectedTemplateMeta && (
            <>
              <span className={selectedTemplateMeta.color}>{selectedTemplateMeta.icon}</span>
              {selectedTemplateMeta.name}
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-4 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
          {/* --- Left: Config Form --- */}
          <div className="space-y-6">
            {/* Headline + AI */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Headline & Description</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="headline">Deal Headline</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-purple-400 hover:text-purple-300"
                      onClick={generateAiCopy}
                      disabled={aiLoading}
                    >
                      {aiLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate with AI
                    </Button>
                  </div>
                  <Input
                    id="headline"
                    placeholder="e.g. $5 Off Your Next Coffee"
                    value={form.headline}
                    onChange={(e) => setForm((prev) => ({ ...prev, headline: e.target.value }))}
                    className="border-border bg-secondary"
                    maxLength={100}
                  />
                </div>

                {/* AI Suggestions Panel */}
                {showAiPanel && (
                  <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-purple-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Suggestions
                    </div>
                    {aiLoading ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-purple-400" />
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {aiSuggestions.map((s, i) => (
                          <button
                            key={i}
                            onClick={() => pickSuggestion(s)}
                            className="w-full rounded-md border border-border bg-card/50 p-3 text-left transition-colors hover:border-purple-500/30 hover:bg-card"
                          >
                            <p className="text-sm font-medium text-foreground">{s.headline}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="discount_text">Discount Display Text</Label>
                  <Input
                    id="discount_text"
                    placeholder="e.g. $5 off any coffee drink"
                    value={form.discount_text}
                    onChange={(e) => setForm((prev) => ({ ...prev, discount_text: e.target.value }))}
                    className="border-border bg-secondary"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Short text shown on the deal card (e.g. &ldquo;$5 off&rdquo;, &ldquo;Free coffee&rdquo;)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Terms & Conditions</Label>
                  <Textarea
                    id="terms"
                    placeholder="e.g. One per customer per day. Cannot combine with other offers."
                    value={form.terms}
                    onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))}
                    className="border-border bg-secondary"
                    rows={2}
                    maxLength={500}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Limits & Schedule */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Limits & Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cap_daily">Daily Cap</Label>
                    <Input
                      id="cap_daily"
                      type="number"
                      min={1}
                      max={10000}
                      value={form.cap_daily}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          cap_daily: Math.max(1, parseInt(e.target.value) || 1),
                        }))
                      }
                      className="border-border bg-secondary"
                    />
                    <p className="text-xs text-muted-foreground">Max redemptions per day</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="value">Redemption Value ($)</Label>
                    <Input
                      id="value"
                      type="number"
                      min={0.01}
                      step={0.5}
                      value={form.value_per_redemption}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          value_per_redemption: Math.max(0.01, parseFloat(e.target.value) || 0.01),
                        }))
                      }
                      className="border-border bg-secondary"
                    />
                    <p className="text-xs text-muted-foreground">Cost per redemption</p>
                  </div>
                </div>

                {/* Active Hours */}
                <div className="space-y-2">
                  <Label>Active Hours</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={form.active_hours_start}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, active_hours_start: e.target.value }))
                      }
                      className="border-border bg-secondary"
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      value={form.active_hours_end}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, active_hours_end: e.target.value }))
                      }
                      className="border-border bg-secondary"
                    />
                  </div>
                </div>

                {/* Active Days */}
                <div className="space-y-2">
                  <Label>Active Days</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day, i) => {
                      const isActive = form.active_days[i]
                      return (
                        <label
                          key={day}
                          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <Checkbox
                            checked={isActive}
                            onCheckedChange={() => toggleDay(i)}
                            className="sr-only"
                          />
                          {day}
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
                      className="border-border bg-secondary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date (optional)</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))}
                      className="border-border bg-secondary"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Targeting */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-card-foreground">Targeting</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="target_audience">Target Audience</Label>
                  <select
                    id="target_audience"
                    value={form.target_audience}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        target_audience: e.target.value as TargetAudience,
                      }))
                    }
                    className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {TARGET_AUDIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Who can see and redeem this deal
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}
            <Button
              className="w-full gap-2"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting || !form.headline.trim()}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Deal…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Create Deal
                </>
              )}
            </Button>
          </div>

          {/* --- Right: Live Preview --- */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-card-foreground">
                  <Eye className="h-4 w-4" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-xs">How consumers see your deal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-muted/50 to-background">
                  {/* Deal Card Preview */}
                  <div className="p-4">
                    {/* Merchant info */}
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                        B
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">Your Business</p>
                        <p className="text-[10px] text-muted-foreground">Local Business</p>
                      </div>
                    </div>

                    {/* Headline */}
                    <h3 className="text-lg font-bold text-foreground leading-tight">
                      {form.headline || "Your Deal Headline"}
                    </h3>

                    {/* Discount text */}
                    {(form.discount_text || form.headline) && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                        <Tag className="h-3 w-3" />
                        {form.discount_text || form.headline}
                      </div>
                    )}

                    {/* Terms */}
                    {form.terms && (
                      <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
                        {form.terms}
                      </p>
                    )}

                    {/* Active hours */}
                    <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {form.active_hours_start}–{form.active_hours_end}
                      </span>
                      <span>
                        {form.active_days.filter(Boolean).length === 7
                          ? "Every day"
                          : form.active_days
                              .map((active, i) => (active ? DAYS_OF_WEEK[i] : null))
                              .filter(Boolean)
                              .join(", ")}
                      </span>
                    </div>

                    {/* Target badge */}
                    {form.target_audience !== "everyone" && (
                      <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                        <UserPlus className="h-2.5 w-2.5" />
                        {TARGET_AUDIENCE_OPTIONS.find((o) => o.value === form.target_audience)?.label}
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <div className="border-t border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">Claim this deal</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Stats preview */}
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg border border-border bg-muted/30 p-2">
                    <p className="text-lg font-bold text-foreground">{form.cap_daily}</p>
                    <p className="text-[10px] text-muted-foreground">Daily cap</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-2">
                    <p className="text-lg font-bold text-foreground">${form.value_per_redemption.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Per redemption</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
