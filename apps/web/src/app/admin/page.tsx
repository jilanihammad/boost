"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RequireAuth } from "@/components/RequireAuth"
import { RequireRole } from "@/components/RequireRole"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createMerchant,
  listMerchants,
  deleteMerchant,
  restoreMerchant,
  createOffer,
  listOffers,
  deleteOffer,
  updateOffer,
  generateTokens,
  listTokens,
  getTokenQrUrl,
  createUser,
  listUsers,
  deleteUser,
  type Merchant,
  type Offer,
  type OfferStatus,
  type Token,
  type User,
  type PendingRole,
  type UserRole,
} from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Building2,
  Tag,
  QrCode,
  Plus,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Eye,
  Trash2,
  RotateCcw,
  Pencil,
} from "lucide-react"

export default function AdminPage() {
  const { idToken, setViewAs } = useAuth()
  const router = useRouter()

  // Merchants state
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [merchantsLoading, setMerchantsLoading] = useState(true)
  const [merchantForm, setMerchantForm] = useState({
    name: "",
    email: "",
    locations: "",
  })
  const [merchantSaving, setMerchantSaving] = useState(false)
  const [merchantMessage, setMerchantMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Offers state
  const [offers, setOffers] = useState<Offer[]>([])
  const [offersLoading, setOffersLoading] = useState(true)
  const [offerForm, setOfferForm] = useState({
    merchant_id: "",
    name: "",
    discount_text: "",
    terms: "",
    cap_daily: "100",
    value_per_redemption: "5",
  })
  const [offerSaving, setOfferSaving] = useState(false)
  const [offerMessage, setOfferMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Edit offer state
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null)
  const [editOfferForm, setEditOfferForm] = useState({
    name: "",
    discount_text: "",
    terms: "",
    cap_daily: "",
    value_per_redemption: "",
    status: "active" as OfferStatus,
  })

  // QR state
  const [selectedOfferForQr, setSelectedOfferForQr] = useState<string>("")
  const [tokenCount, setTokenCount] = useState("10")
  const [expiresDays, setExpiresDays] = useState("30")
  const [tokens, setTokens] = useState<Token[]>([])
  const [tokensLoading, setTokensLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [qrMessage, setQrMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Users state
  const [users, setUsers] = useState<User[]>([])
  const [pendingRoles, setPendingRoles] = useState<PendingRole[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userForm, setUserForm] = useState({
    email: "",
    role: "merchant_admin" as UserRole,
    merchant_id: "",
  })
  const [userSaving, setUserSaving] = useState(false)
  const [userMessage, setUserMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)

  // Load merchants
  useEffect(() => {
    if (!idToken) return
    setMerchantsLoading(true)
    listMerchants(idToken)
      .then((res) => setMerchants(res.merchants))
      .catch((err) => console.error("Failed to load merchants:", err))
      .finally(() => setMerchantsLoading(false))
  }, [idToken])

  // Load offers
  useEffect(() => {
    if (!idToken) return
    setOffersLoading(true)
    listOffers(idToken)
      .then((res) => setOffers(res.offers))
      .catch((err) => console.error("Failed to load offers:", err))
      .finally(() => setOffersLoading(false))
  }, [idToken])

  // Load tokens when offer selected for QR
  useEffect(() => {
    if (!idToken || !selectedOfferForQr) {
      setTokens([])
      return
    }
    setTokensLoading(true)
    listTokens(idToken, selectedOfferForQr)
      .then((res) => setTokens(res.tokens))
      .catch((err) => console.error("Failed to load tokens:", err))
      .finally(() => setTokensLoading(false))
  }, [idToken, selectedOfferForQr])

  // Load users
  useEffect(() => {
    if (!idToken) return
    setUsersLoading(true)
    listUsers(idToken)
      .then((res) => {
        setUsers(res.users)
        setPendingRoles(res.pending)
      })
      .catch((err) => console.error("Failed to load users:", err))
      .finally(() => setUsersLoading(false))
  }, [idToken])

  // Create merchant
  const handleCreateMerchant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idToken) return

    setMerchantSaving(true)
    setMerchantMessage(null)

    try {
      const locations = merchantForm.locations
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean)

      const newMerchant = await createMerchant(idToken, {
        name: merchantForm.name,
        email: merchantForm.email,
        locations: locations.length > 0 ? locations : ["Main"],
      })

      setMerchants((prev) => [...prev, newMerchant])
      setMerchantForm({ name: "", email: "", locations: "" })
      setMerchantMessage({ type: "success", text: `Created merchant: ${newMerchant.name}` })
    } catch (err: any) {
      setMerchantMessage({ type: "error", text: err.message || "Failed to create merchant" })
    } finally {
      setMerchantSaving(false)
    }
  }

  // Create offer
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idToken || !offerForm.merchant_id) return

    setOfferSaving(true)
    setOfferMessage(null)

    try {
      const newOffer = await createOffer(idToken, {
        merchant_id: offerForm.merchant_id,
        name: offerForm.name,
        discount_text: offerForm.discount_text,
        terms: offerForm.terms || undefined,
        cap_daily: parseInt(offerForm.cap_daily) || 100,
        value_per_redemption: parseFloat(offerForm.value_per_redemption) || 5,
      })

      setOffers((prev) => [...prev, newOffer])
      setOfferForm({
        merchant_id: offerForm.merchant_id,
        name: "",
        discount_text: "",
        terms: "",
        cap_daily: "100",
        value_per_redemption: "5",
      })
      setOfferMessage({ type: "success", text: `Created offer: ${newOffer.name}` })
    } catch (err: any) {
      setOfferMessage({ type: "error", text: err.message || "Failed to create offer" })
    } finally {
      setOfferSaving(false)
    }
  }

  // Delete offer
  const handleDeleteOffer = async (offerId: string) => {
    if (!idToken) return
    if (!confirm("Are you sure you want to delete this offer?")) return

    try {
      await deleteOffer(idToken, offerId)
      setOffers((prev) => prev.filter((o) => o.id !== offerId))
      setOfferMessage({ type: "success", text: "Offer deleted" })
    } catch (err: any) {
      setOfferMessage({ type: "error", text: err.message || "Failed to delete offer" })
    }
  }

  // Open edit offer dialog
  const openEditOffer = (offer: Offer) => {
    setEditOfferForm({
      name: offer.name,
      discount_text: offer.discount_text,
      terms: offer.terms || "",
      cap_daily: String(offer.cap_daily),
      value_per_redemption: String(offer.value_per_redemption),
      status: offer.status,
    })
    setEditingOffer(offer)
  }

  // Update offer
  const handleUpdateOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idToken || !editingOffer) return

    setOfferSaving(true)
    setOfferMessage(null)

    try {
      const updated = await updateOffer(idToken, editingOffer.id, {
        name: editOfferForm.name,
        discount_text: editOfferForm.discount_text,
        terms: editOfferForm.terms || undefined,
        cap_daily: parseInt(editOfferForm.cap_daily) || 100,
        value_per_redemption: parseFloat(editOfferForm.value_per_redemption) || 5,
        status: editOfferForm.status,
      })

      setOffers((prev) => prev.map((o) => (o.id === updated.id ? updated : o)))
      setEditingOffer(null)
      setOfferMessage({ type: "success", text: `Updated offer: ${updated.name}` })
    } catch (err: any) {
      setOfferMessage({ type: "error", text: err.message || "Failed to update offer" })
    } finally {
      setOfferSaving(false)
    }
  }

  // Generate tokens
  const handleGenerateTokens = async () => {
    if (!idToken || !selectedOfferForQr) return

    setGenerating(true)
    setQrMessage(null)

    try {
      const count = parseInt(tokenCount) || 10
      const days = parseInt(expiresDays) || 30

      const result = await generateTokens(idToken, selectedOfferForQr, count, days)

      // Refresh tokens list
      const refreshed = await listTokens(idToken, selectedOfferForQr)
      setTokens(refreshed.tokens)

      setQrMessage({
        type: "success",
        text: `Generated ${result.count} tokens for offer`,
      })
    } catch (err: any) {
      setQrMessage({ type: "error", text: err.message || "Failed to generate tokens" })
    } finally {
      setGenerating(false)
    }
  }

  // Download single QR code
  const downloadQrCode = async (token: Token) => {
    if (!idToken) return
    const url = getTokenQrUrl(token.id)
    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch QR: ${response.status}`)
      }
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `qr-${token.short_code}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      console.error("Failed to download QR:", err)
      setQrMessage({ type: "error", text: "Failed to download QR code" })
    }
  }

  // Download all active QR codes as batch
  const downloadAllQrCodes = async () => {
    const activeTokens = tokens.filter((t) => t.status === "active")
    if (activeTokens.length === 0) return

    setQrMessage({ type: "success", text: `Downloading ${activeTokens.length} QR codes...` })

    // Download each one (simple approach; could use JSZip for batch ZIP)
    for (const token of activeTokens) {
      await downloadQrCode(token)
      // Small delay to prevent overwhelming
      await new Promise((r) => setTimeout(r, 200))
    }

    setQrMessage({ type: "success", text: `Downloaded ${activeTokens.length} QR codes` })
  }

  // Create user/invite
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!idToken) return

    setUserSaving(true)
    setUserMessage(null)

    try {
      const result = await createUser(idToken, {
        email: userForm.email,
        role: userForm.role,
        merchant_id: userForm.role !== "owner" ? userForm.merchant_id : undefined,
      })

      // Refresh users list
      const refreshed = await listUsers(idToken)
      setUsers(refreshed.users)
      setPendingRoles(refreshed.pending)

      setUserForm({ email: "", role: "merchant_admin", merchant_id: "" })
      setUserMessage({
        type: "success",
        text: result.status === "claimed"
          ? `User ${result.email} has been assigned the role`
          : `Invite sent to ${result.email}`,
      })
    } catch (err: any) {
      setUserMessage({ type: "error", text: err.message || "Failed to create user" })
    } finally {
      setUserSaving(false)
    }
  }

  // Delete user
  const handleDeleteUser = async (uid: string) => {
    if (!idToken) return
    if (!confirm("Are you sure you want to remove this user?")) return

    try {
      await deleteUser(idToken, uid)
      setUsers((prev) => prev.filter((u) => u.uid !== uid))
    } catch (err: any) {
      setUserMessage({ type: "error", text: err.message || "Failed to delete user" })
    }
  }

  // Delete merchant (soft delete)
  const handleDeleteMerchant = async (merchantId: string) => {
    if (!idToken) return
    if (!confirm("Are you sure you want to delete this merchant? Users will be orphaned.")) return

    try {
      await deleteMerchant(idToken, merchantId)
      // Refresh merchants list
      const refreshed = await listMerchants(idToken)
      setMerchants(refreshed.merchants)
      setMerchantMessage({ type: "success", text: "Merchant deleted" })
    } catch (err: any) {
      setMerchantMessage({ type: "error", text: err.message || "Failed to delete merchant" })
    }
  }

  // Restore merchant
  const handleRestoreMerchant = async (merchantId: string) => {
    if (!idToken) return

    try {
      await restoreMerchant(idToken, merchantId)
      // Refresh merchants list
      const refreshed = await listMerchants(idToken)
      setMerchants(refreshed.merchants)
      setMerchantMessage({ type: "success", text: "Merchant restored" })
    } catch (err: any) {
      setMerchantMessage({ type: "error", text: err.message || "Failed to restore merchant" })
    }
  }

  // Impersonate merchant view
  const handleViewAsMerchant = (merchantId: string) => {
    // Set the viewAs mode to merchant_admin for the selected merchant
    // Store the selected merchant ID in localStorage for the dashboard to use
    localStorage.setItem("boost_impersonate_merchant", merchantId)
    setViewAs("merchant_admin")
    router.push("/dashboard")
  }

  const selectedOffer = offers.find((o) => o.id === selectedOfferForQr)
  const activeTokensCount = tokens.filter((t) => t.status === "active").length

  return (
    <RequireAuth>
      <RequireRole allow={["owner"]}>
        <div className="min-h-screen bg-background p-4 md:p-8">
          <div className="mx-auto max-w-5xl">
            <h1 className="mb-6 text-2xl font-semibold text-foreground">Admin Panel</h1>

            <Tabs defaultValue="merchants" className="space-y-6">
              <TabsList>
                <TabsTrigger value="merchants" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Merchants
                </TabsTrigger>
                <TabsTrigger value="offers" className="gap-2">
                  <Tag className="h-4 w-4" />
                  Offers
                </TabsTrigger>
                <TabsTrigger value="qrcodes" className="gap-2">
                  <QrCode className="h-4 w-4" />
                  QR Codes
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Users
                </TabsTrigger>
              </TabsList>

              {/* Merchants Tab */}
              <TabsContent value="merchants" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Create Merchant Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Create Merchant
                      </CardTitle>
                      <CardDescription>
                        Add a new business to the Boost platform
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateMerchant} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="merchant-name">Business Name</Label>
                          <Input
                            id="merchant-name"
                            placeholder="Acme Coffee Shop"
                            value={merchantForm.name}
                            onChange={(e) =>
                              setMerchantForm((f) => ({ ...f, name: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="merchant-email">Contact Email</Label>
                          <Input
                            id="merchant-email"
                            type="email"
                            placeholder="owner@acmecoffee.com"
                            value={merchantForm.email}
                            onChange={(e) =>
                              setMerchantForm((f) => ({ ...f, email: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="merchant-locations">
                            Locations (comma-separated)
                          </Label>
                          <Input
                            id="merchant-locations"
                            placeholder="Main, Downtown, Airport"
                            value={merchantForm.locations}
                            onChange={(e) =>
                              setMerchantForm((f) => ({ ...f, locations: e.target.value }))
                            }
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty for single location (defaults to &quot;Main&quot;)
                          </p>
                        </div>

                        {merchantMessage && (
                          <div
                            className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                              merchantMessage.type === "success"
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {merchantMessage.type === "success" ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            {merchantMessage.text}
                          </div>
                        )}

                        <Button type="submit" disabled={merchantSaving} className="w-full">
                          {merchantSaving && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create Merchant
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Merchants List */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Existing Merchants</CardTitle>
                      <CardDescription>
                        {merchants.length} merchant{merchants.length !== 1 ? "s" : ""} registered
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {merchantsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : merchants.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No merchants yet. Create your first one!
                        </p>
                      ) : (
                        <div className="max-h-80 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Locations</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {merchants.map((m) => (
                                <TableRow key={m.id} className={m.status === "deleted" ? "opacity-50" : ""}>
                                  <TableCell className="font-medium">{m.name}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        m.status === "active"
                                          ? "bg-success/10 text-success"
                                          : "bg-destructive/10 text-destructive"
                                      }`}
                                    >
                                      {m.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {m.locations.join(", ")}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {m.status === "active" ? (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleViewAsMerchant(m.id)}
                                            title="View as merchant"
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteMerchant(m.id)}
                                            title="Delete merchant"
                                            className="text-destructive hover:text-destructive"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleRestoreMerchant(m.id)}
                                          title="Restore merchant"
                                          className="text-success hover:text-success"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Offers Tab */}
              <TabsContent value="offers" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Create Offer Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Create Offer
                      </CardTitle>
                      <CardDescription>
                        Create a new discount offer for a merchant
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateOffer} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="offer-merchant">Merchant</Label>
                          <Select
                            value={offerForm.merchant_id}
                            onValueChange={(v) =>
                              setOfferForm((f) => ({ ...f, merchant_id: v }))
                            }
                          >
                            <SelectTrigger id="offer-merchant">
                              <SelectValue placeholder="Select a merchant" />
                            </SelectTrigger>
                            <SelectContent>
                              {merchants.map((m) => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="offer-name">Offer Name</Label>
                          <Input
                            id="offer-name"
                            placeholder="Summer Special"
                            value={offerForm.name}
                            onChange={(e) =>
                              setOfferForm((f) => ({ ...f, name: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="offer-discount">Discount Text</Label>
                          <Input
                            id="offer-discount"
                            placeholder="20% off your first order"
                            value={offerForm.discount_text}
                            onChange={(e) =>
                              setOfferForm((f) => ({ ...f, discount_text: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="offer-terms">Terms (optional)</Label>
                          <Textarea
                            id="offer-terms"
                            placeholder="Valid on orders over $10. One per customer."
                            value={offerForm.terms}
                            onChange={(e) =>
                              setOfferForm((f) => ({ ...f, terms: e.target.value }))
                            }
                            rows={2}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="offer-cap">Daily Cap</Label>
                            <Input
                              id="offer-cap"
                              type="number"
                              min="1"
                              placeholder="100"
                              value={offerForm.cap_daily}
                              onChange={(e) =>
                                setOfferForm((f) => ({ ...f, cap_daily: e.target.value }))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="offer-value">Value ($)</Label>
                            <Input
                              id="offer-value"
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="5.00"
                              value={offerForm.value_per_redemption}
                              onChange={(e) =>
                                setOfferForm((f) => ({
                                  ...f,
                                  value_per_redemption: e.target.value,
                                }))
                              }
                            />
                            <p className="text-xs text-muted-foreground">
                              Cost per redemption
                            </p>
                          </div>
                        </div>

                        {offerMessage && (
                          <div
                            className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                              offerMessage.type === "success"
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {offerMessage.type === "success" ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            {offerMessage.text}
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={offerSaving || !offerForm.merchant_id}
                          className="w-full"
                        >
                          {offerSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Create Offer
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Offers List */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Existing Offers</CardTitle>
                      <CardDescription>
                        {offers.length} offer{offers.length !== 1 ? "s" : ""} created
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {offersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : offers.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No offers yet. Create your first one!
                        </p>
                      ) : (
                        <div className="max-h-80 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Merchant</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Discount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {offers.map((o) => {
                                const merchant = merchants.find((m) => m.id === o.merchant_id)
                                return (
                                <TableRow key={o.id}>
                                  <TableCell className="text-muted-foreground">
                                    {merchant?.name || "Unknown"}
                                  </TableCell>
                                  <TableCell className="font-medium">{o.name}</TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {o.discount_text}
                                  </TableCell>
                                  <TableCell>
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                        o.status === "active"
                                          ? "bg-success/10 text-success"
                                          : o.status === "paused"
                                            ? "bg-warning/10 text-warning"
                                            : "bg-muted text-muted-foreground"
                                      }`}
                                    >
                                      {o.status}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditOffer(o)}
                                        title="Edit offer"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedOfferForQr(o.id)}
                                        title="View QR code"
                                      >
                                        <QrCode className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDeleteOffer(o.id)}
                                        title="Delete offer"
                                        className="text-destructive hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* QR Codes Tab */}
              <TabsContent value="qrcodes" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Generate QR Codes */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Generate QR Codes
                      </CardTitle>
                      <CardDescription>
                        Generate redemption tokens and QR codes for social ads
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="qr-offer">Select Offer</Label>
                        <Select
                          value={selectedOfferForQr}
                          onValueChange={setSelectedOfferForQr}
                        >
                          <SelectTrigger id="qr-offer">
                            <SelectValue placeholder="Select an offer" />
                          </SelectTrigger>
                          <SelectContent>
                            {offers
                              .filter((o) => o.status === "active")
                              .map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.name} - {o.discount_text}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedOffer && (
                        <>
                          <div className="rounded-md bg-muted p-3 text-sm">
                            <p className="font-medium">{selectedOffer.name}</p>
                            <p className="text-muted-foreground">
                              {selectedOffer.discount_text}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Daily cap: {selectedOffer.cap_daily} | Value: $
                              {selectedOffer.value_per_redemption}/redemption
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="expires-days">Token Expires In (days)</Label>
                            <Input
                              id="expires-days"
                              type="number"
                              min="1"
                              max="365"
                              value={expiresDays}
                              onChange={(e) => setExpiresDays(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              One universal token per offer - can be redeemed unlimited times within daily cap
                            </p>
                          </div>

                          {qrMessage && (
                            <div
                              className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                                qrMessage.type === "success"
                                  ? "bg-success/10 text-success"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {qrMessage.type === "success" ? (
                                <CheckCircle className="h-4 w-4" />
                              ) : (
                                <AlertCircle className="h-4 w-4" />
                              )}
                              {qrMessage.text}
                            </div>
                          )}

                          <Button
                            onClick={handleGenerateTokens}
                            disabled={generating}
                            className="w-full"
                          >
                            {generating && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {tokens.length > 0 ? "Update Token Expiry" : "Generate Universal Token"}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tokens List */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Universal Token</CardTitle>
                          <CardDescription>
                            {tokens.length > 0 ? "One reusable token for this offer" : "No token generated yet"}
                          </CardDescription>
                        </div>
                        {selectedOfferForQr && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (idToken && selectedOfferForQr) {
                                setTokensLoading(true)
                                listTokens(idToken, selectedOfferForQr)
                                  .then((res) => setTokens(res.tokens))
                                  .finally(() => setTokensLoading(false))
                              }
                            }}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!selectedOfferForQr ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          Select an offer to view its tokens
                        </p>
                      ) : tokensLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : tokens.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No tokens generated yet for this offer
                        </p>
                      ) : (
                        <>
                          <div className="mb-4">
                            <Button
                              variant="outline"
                              onClick={downloadAllQrCodes}
                              disabled={activeTokensCount === 0}
                              className="w-full gap-2"
                            >
                              <Download className="h-4 w-4" />
                              Download All Active QR Codes ({activeTokensCount})
                            </Button>
                          </div>
                          <div className="max-h-64 overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Code</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Expires</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tokens.slice(0, 50).map((t) => (
                                  <TableRow key={t.id}>
                                    <TableCell className="font-mono text-sm">
                                      {t.short_code}
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                          t.status === "active"
                                            ? "bg-success/10 text-success"
                                            : t.status === "redeemed"
                                              ? "bg-primary/10 text-primary"
                                              : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {t.status}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                      {new Date(t.expires_at).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                      {t.status === "active" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => downloadQrCode(t)}
                                        >
                                          <Download className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            {tokens.length > 50 && (
                              <p className="mt-2 text-center text-xs text-muted-foreground">
                                Showing first 50 of {tokens.length} tokens
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users" className="space-y-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  {/* Invite User Form */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5" />
                        Invite User
                      </CardTitle>
                      <CardDescription>
                        Invite a new user or assign a role to an existing user
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleCreateUser} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="user-email">Email Address</Label>
                          <Input
                            id="user-email"
                            type="email"
                            placeholder="user@example.com"
                            value={userForm.email}
                            onChange={(e) =>
                              setUserForm((f) => ({ ...f, email: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="user-role">Role</Label>
                          <Select
                            value={userForm.role}
                            onValueChange={(v) =>
                              setUserForm((f) => ({ ...f, role: v as UserRole }))
                            }
                          >
                            <SelectTrigger id="user-role">
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">Owner (Super Admin)</SelectItem>
                              <SelectItem value="merchant_admin">Merchant Admin</SelectItem>
                              <SelectItem value="staff">Staff</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {userForm.role !== "owner" && (
                          <div className="space-y-2">
                            <Label htmlFor="user-merchant">Merchant</Label>
                            <Select
                              value={userForm.merchant_id}
                              onValueChange={(v) =>
                                setUserForm((f) => ({ ...f, merchant_id: v }))
                              }
                            >
                              <SelectTrigger id="user-merchant">
                                <SelectValue placeholder="Select a merchant" />
                              </SelectTrigger>
                              <SelectContent>
                                {merchants
                                  .filter((m) => m.status === "active")
                                  .map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                      {m.name}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {userMessage && (
                          <div
                            className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                              userMessage.type === "success"
                                ? "bg-success/10 text-success"
                                : "bg-destructive/10 text-destructive"
                            }`}
                          >
                            {userMessage.type === "success" ? (
                              <CheckCircle className="h-4 w-4" />
                            ) : (
                              <AlertCircle className="h-4 w-4" />
                            )}
                            {userMessage.text}
                          </div>
                        )}

                        <Button
                          type="submit"
                          disabled={userSaving || (userForm.role !== "owner" && !userForm.merchant_id)}
                          className="w-full"
                        >
                          {userSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          {userForm.role === "owner" ? "Create Owner" : "Send Invite"}
                        </Button>
                      </form>
                    </CardContent>
                  </Card>

                  {/* Users List */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Users</CardTitle>
                      <CardDescription>
                        {users.length} user{users.length !== 1 ? "s" : ""}, {pendingRoles.length} pending invite{pendingRoles.length !== 1 ? "s" : ""}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {usersLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : users.length === 0 && pendingRoles.length === 0 ? (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                          No users yet. Invite your first one!
                        </p>
                      ) : (
                        <div className="max-h-96 overflow-auto space-y-4">
                          {/* Active Users */}
                          {users.length > 0 && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Role</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {users.map((u) => (
                                  <TableRow key={u.uid}>
                                    <TableCell className="font-medium">
                                      {u.email}
                                      {u.is_primary && (
                                        <span className="ml-2 text-xs text-muted-foreground">(Primary)</span>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="capitalize">
                                        {u.role?.replace("_", " ")}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      <span
                                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                          u.status === "active"
                                            ? "bg-success/10 text-success"
                                            : u.status === "orphaned"
                                              ? "bg-warning/10 text-warning"
                                              : "bg-muted text-muted-foreground"
                                        }`}
                                      >
                                        {u.status}
                                      </span>
                                    </TableCell>
                                    <TableCell>
                                      {!u.is_primary && u.status === "active" && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleDeleteUser(u.uid)}
                                          className="text-destructive hover:text-destructive"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}

                          {/* Pending Invites */}
                          {pendingRoles.length > 0 && (
                            <>
                              <h4 className="text-sm font-medium text-muted-foreground mt-4">Pending Invites</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Expires</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {pendingRoles.map((p) => (
                                    <TableRow key={p.id}>
                                      <TableCell className="font-medium">{p.email}</TableCell>
                                      <TableCell className="capitalize">
                                        {p.role?.replace("_", " ")}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">
                                        {new Date(p.expires_at).toLocaleDateString()}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>

            {/* Edit Offer Dialog */}
            <Dialog open={!!editingOffer} onOpenChange={(open) => !open && setEditingOffer(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Offer</DialogTitle>
                  <DialogDescription>
                    Update the offer details below.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateOffer} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-offer-name">Offer Name</Label>
                    <Input
                      id="edit-offer-name"
                      value={editOfferForm.name}
                      onChange={(e) =>
                        setEditOfferForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-offer-discount">Discount Text</Label>
                    <Input
                      id="edit-offer-discount"
                      value={editOfferForm.discount_text}
                      onChange={(e) =>
                        setEditOfferForm((f) => ({ ...f, discount_text: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-offer-terms">Terms (optional)</Label>
                    <Textarea
                      id="edit-offer-terms"
                      value={editOfferForm.terms}
                      onChange={(e) =>
                        setEditOfferForm((f) => ({ ...f, terms: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-offer-cap">Daily Cap</Label>
                      <Input
                        id="edit-offer-cap"
                        type="number"
                        min="1"
                        value={editOfferForm.cap_daily}
                        onChange={(e) =>
                          setEditOfferForm((f) => ({ ...f, cap_daily: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-offer-value">Value ($)</Label>
                      <Input
                        id="edit-offer-value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editOfferForm.value_per_redemption}
                        onChange={(e) =>
                          setEditOfferForm((f) => ({
                            ...f,
                            value_per_redemption: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-offer-status">Status</Label>
                    <Select
                      value={editOfferForm.status}
                      onValueChange={(v) =>
                        setEditOfferForm((f) => ({ ...f, status: v as OfferStatus }))
                      }
                    >
                      <SelectTrigger id="edit-offer-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingOffer(null)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={offerSaving}>
                      {offerSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </RequireRole>
    </RequireAuth>
  )
}
