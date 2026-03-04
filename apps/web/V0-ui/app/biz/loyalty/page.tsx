"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BoostLogo } from "@/components/boost-logo"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/lib/auth-context"
import { ArrowLeft, Stamp, Save, Loader2 } from "lucide-react"

// Day labels (0=Monday .. 6=Sunday)
const DAYS = [
  { value: 0, label: "Mon" },
  { value: 1, label: "Tue" },
  { value: 2, label: "Wed" },
  { value: 3, label: "Thu" },
  { value: 4, label: "Fri" },
  { value: 5, label: "Sat" },
  { value: 6, label: "Sun" },
]

// Mock merchant ID for dev
const MOCK_MERCHANT_ID = "merchant-001"

// Mock initial config (simulates GET /api/v1/merchants/{id}/loyalty returning 404 → empty)
const MOCK_INITIAL_CONFIG = null // set to an object to simulate existing config

interface LoyaltyFormData {
  stamps_required: number
  reward_description: string
  reward_value: number
  reset_on_reward: boolean
  double_stamp_days: number[]
  birthday_reward: boolean
}

const DEFAULT_FORM: LoyaltyFormData = {
  stamps_required: 10,
  reward_description: "Free coffee on us!",
  reward_value: 5.0,
  reset_on_reward: true,
  double_stamp_days: [],
  birthday_reward: false,
}

export default function LoyaltyConfigPage() {
  const { role } = useAuth()
  const isAdmin = role === "merchant_admin"

  const [form, setForm] = useState<LoyaltyFormData>(DEFAULT_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load existing config on mount (mock)
  useEffect(() => {
    // Simulate fetching GET /api/v1/merchants/{merchant_id}/loyalty
    const timer = setTimeout(() => {
      if (MOCK_INITIAL_CONFIG) {
        setForm(MOCK_INITIAL_CONFIG as LoyaltyFormData)
      }
      setLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)

    // TODO: Replace with real API call
    // await fetch(`/api/v1/merchants/${MOCK_MERCHANT_ID}/loyalty`, {
    //   method: "PUT",
    //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    //   body: JSON.stringify(form),
    // })

    // Mock save
    await new Promise((r) => setTimeout(r, 600))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const toggleDoubleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      double_stamp_days: prev.double_stamp_days.includes(day)
        ? prev.double_stamp_days.filter((d) => d !== day)
        : [...prev.double_stamp_days, day],
    }))
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

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
          <Stamp className="h-4 w-4" />
          Loyalty Program
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-lg p-4 lg:p-6">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-card-foreground">
              <Stamp className="h-5 w-5" />
              Stamp Card Settings
            </CardTitle>
            <CardDescription>
              Configure your loyalty stamp program. Customers earn stamps on each visit and get
              rewarded when they fill their card.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Stamps Required */}
            <div className="space-y-2">
              <Label htmlFor="stamps_required">Stamps to earn reward</Label>
              <Input
                id="stamps_required"
                type="number"
                min={1}
                max={100}
                value={form.stamps_required}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    stamps_required: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="border-border bg-secondary"
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Number of visits before the customer earns a reward
              </p>
            </div>

            {/* Reward Description */}
            <div className="space-y-2">
              <Label htmlFor="reward_description">Reward description</Label>
              <Input
                id="reward_description"
                type="text"
                placeholder="e.g. Free coffee on us!"
                value={form.reward_description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reward_description: e.target.value }))
                }
                className="border-border bg-secondary"
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">
                What the customer gets when they fill the stamp card
              </p>
            </div>

            {/* Reward Value */}
            <div className="space-y-2">
              <Label htmlFor="reward_value">Reward value ($)</Label>
              <Input
                id="reward_value"
                type="number"
                min={0}
                step={0.5}
                value={form.reward_value}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    reward_value: Math.max(0, parseFloat(e.target.value) || 0),
                  }))
                }
                className="border-border bg-secondary"
                disabled={!isAdmin}
              />
              <p className="text-xs text-muted-foreground">
                Dollar value of the reward (for your tracking)
              </p>
            </div>

            {/* Reset on Reward */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="reset_on_reward" className="text-sm font-medium">
                  Reset stamps after reward
                </Label>
                <p className="text-xs text-muted-foreground">
                  Start a new stamp card after each reward
                </p>
              </div>
              <Switch
                id="reset_on_reward"
                checked={form.reset_on_reward}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, reset_on_reward: checked }))
                }
                disabled={!isAdmin}
              />
            </div>

            {/* Double Stamp Days */}
            <div className="space-y-3">
              <Label>Double stamp days</Label>
              <p className="text-xs text-muted-foreground">
                Customers earn 2 stamps per visit on these days
              </p>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((day) => {
                  const isChecked = form.double_stamp_days.includes(day.value)
                  return (
                    <label
                      key={day.value}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        isChecked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:bg-muted"
                      } ${!isAdmin ? "pointer-events-none opacity-60" : ""}`}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => toggleDoubleDay(day.value)}
                        disabled={!isAdmin}
                        className="sr-only"
                      />
                      {day.label}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Birthday Reward */}
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <Label htmlFor="birthday_reward" className="text-sm font-medium">
                  Birthday reward
                </Label>
                <p className="text-xs text-muted-foreground">
                  Give a bonus reward on the customer&apos;s birthday
                </p>
              </div>
              <Switch
                id="birthday_reward"
                checked={form.birthday_reward}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, birthday_reward: checked }))
                }
                disabled={!isAdmin}
              />
            </div>

            {/* Save Button */}
            {isAdmin && (
              <Button
                className="w-full gap-2"
                onClick={handleSave}
                disabled={saving || !form.reward_description.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : saved ? (
                  <>
                    <Save className="h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Configuration
                  </>
                )}
              </Button>
            )}

            {!isAdmin && (
              <p className="text-center text-sm text-muted-foreground">
                Only merchant admins can edit loyalty settings.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Preview Card */}
        <Card className="mt-6 border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm text-card-foreground">Preview</CardTitle>
            <CardDescription>How customers see your stamp card</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Your Stamps</span>
                <span className="text-xs text-muted-foreground">
                  0 / {form.stamps_required}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: form.stamps_required }).map((_, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
                  >
                    <Stamp className="h-4 w-4" />
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                🎁 Reward: {form.reward_description || "—"}
              </p>
              {form.double_stamp_days.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ⚡ 2x stamps on{" "}
                  {form.double_stamp_days
                    .sort((a, b) => a - b)
                    .map((d) => DAYS.find((day) => day.value === d)?.label)
                    .join(", ")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
