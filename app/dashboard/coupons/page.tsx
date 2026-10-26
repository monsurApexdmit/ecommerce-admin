"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, ImagePlus, MoreHorizontal, Pencil, Plus, Search, Ticket, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Switch } from "@/components/ui/switch"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { Field, FieldLabel } from "@/components/ui/field"
import { PageHeader } from "@/components/common/PageHeader"
import { BulkBar } from "@/components/common/BulkBar"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { exportToCSV } from "@/lib/export-import-utils"
import { usePagination } from "@/hooks/use-pagination"
import { couponApi, type CouponResponse } from "@/lib/couponApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useCategory } from "@/contexts/category-context"
import { useProduct } from "@/contexts/product-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

type CType = "percentage" | "fixed" | "free_shipping"
type Phase = "active" | "scheduled" | "used_up" | "expired" | "disabled"
type Tab = "all" | Phase

type FormState = {
  campaign_name: string
  code: string
  type: CType
  discount: string
  min_order_amount: string
  max_discount: string
  usage_limit: string
  oncePerCustomer: boolean
  start_date: string
  end_date: string
  status: boolean
  image: File | null
  appliesTo: "all" | "categories" | "products"
  categoryIds: string[]
  productIds: string[]
  channelPos: boolean
  channelOnline: boolean
}

const emptyForm: FormState = {
  campaign_name: "", code: "", type: "percentage", discount: "", min_order_amount: "", max_discount: "",
  usage_limit: "", oncePerCustomer: false, start_date: "", end_date: "", status: true, image: null,
  appliesTo: "all", categoryIds: [], productIds: [], channelPos: true, channelOnline: true,
}

const PHASE: Record<Phase, { label: string; variant: StatusVariant }> = {
  active: { label: "Active", variant: "default" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  expired: { label: "Expired", variant: "outline" },
  used_up: { label: "Used up", variant: "destructive" },
  disabled: { label: "Disabled", variant: "outline" },
}

const TYPES: { value: CType; label: string }[] = [
  { value: "percentage", label: "% off" },
  { value: "fixed", label: "Amount off" },
  { value: "free_shipping", label: "Free delivery" },
]

const DAY = 86_400_000

const ymd = (s?: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "")

/** Coupon stays usable through the whole last day. */
function endMs(c: CouponResponse): number | null {
  const d = ymd(c.endDate)
  if (d) return new Date(`${d}T23:59:59.999`).getTime()
  if (!c.endDate) return null
  const t = new Date(c.endDate).getTime()
  return isNaN(t) ? null : t
}

function startMs(c: CouponResponse): number | null {
  const d = ymd(c.startDate)
  if (d) return new Date(`${d}T00:00:00`).getTime()
  return null
}

// Disabled -> Used up -> Scheduled -> Expired -> Active
function phaseOf(c: CouponResponse): Phase {
  const now = Date.now()
  if (!c.status) return "disabled"
  if (c.usageLimit && (c.timesUsed ?? 0) >= c.usageLimit) return "used_up"
  const start = startMs(c)
  if (start !== null && start > now) return "scheduled"
  const end = endMs(c)
  if (end !== null && end < now) return "expired"
  return "active"
}

function timeNote(c: CouponResponse, phase: Phase): { text: string; cls: string } {
  const now = Date.now()
  const end = endMs(c)
  const start = startMs(c)
  if (phase === "disabled") return { text: "Switched off", cls: "text-muted-foreground" }
  if (phase === "used_up") return { text: "Limit reached", cls: "text-destructive" }
  if (phase === "expired" && end) return { text: `Ended ${Math.max(0, Math.floor((now - end) / DAY))} days ago`, cls: "text-muted-foreground" }
  if (phase === "scheduled" && start) return { text: `Starts in ${Math.max(1, Math.ceil((start - now) / DAY))} days`, cls: "text-foreground" }
  if (end) return { text: `${Math.max(1, Math.ceil((end - now) / DAY))} days left`, cls: "text-foreground" }
  return { text: "No end", cls: "text-foreground" }
}

function fmtDate(s?: string | null) {
  if (!s) return "No end"
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function toInputDate(s?: string | null) {
  if (!s) return ""
  const d = ymd(s)
  if (d) return d
  const t = new Date(s)
  return isNaN(t.getTime()) ? "" : t.toISOString().split("T")[0]
}

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

export default function CouponsPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const { getAllCategoriesFlat } = useCategory()
  const { products: allProducts } = useProduct()
  const flatCategories = getAllCategoriesFlat()

  const [coupons, setCoupons] = useState<CouponResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CouponResponse | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pickQ, setPickQ] = useState("")
  const [toggling, setToggling] = useState<Set<number>>(new Set())
  const fileRef = useRef<HTMLInputElement>(null)

  const [deleteTargets, setDeleteTargets] = useState<CouponResponse[]>([])
  const [deleting, setDeleting] = useState(false)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      const res = await couponApi.getAll({ per_page: 500 })
      setCoupons(res.data ?? [])
    } catch (err) {
      console.error("Error fetching coupons:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { all: coupons.length, active: 0, scheduled: 0, used_up: 0, expired: 0, disabled: 0 }
    coupons.forEach((x) => { c[phaseOf(x)]++ })
    return c
  }, [coupons])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return coupons.filter(
      (c) =>
        (tab === "all" || phaseOf(c) === tab) &&
        (!q || (c.campaignName ?? "").toLowerCase().includes(q) || (c.code ?? "").toLowerCase().includes(q)),
    )
  }, [coupons, tab, search])

  const { currentItems, currentPage, totalPages, itemsPerPage, setCurrentPage, handleItemsPerPageChange } = usePagination(filtered, 10)

  const blocked = useModuleGuard("Coupons")
  if (blocked) return blocked

  const changeTab = (t: string) => { setTab(t as Tab); setCurrentPage(1); setChecked(new Set()) }
  const hasFilters = !!(search || tab !== "all")

  const allChecked = currentItems.length > 0 && currentItems.every((c) => checked.has(c.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(currentItems.map((c) => c.id)))
  const toggleOne = (id: number) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selected = coupons.filter((c) => checked.has(c.id))

  const discountText = (c: CouponResponse) =>
    c.type === "free_shipping" ? "Free delivery" : c.type === "percentage" ? `${c.discount}% off` : `${formatCurrency(Number(c.discount) || 0)} off`
  const condText = (c: CouponResponse) => {
    const parts: string[] = []
    if (Number(c.minOrderAmount) > 0) parts.push(`Min ${formatCurrency(Number(c.minOrderAmount))}`)
    if (c.type === "percentage" && Number(c.maxDiscount) > 0) parts.push(`max ${formatCurrency(Number(c.maxDiscount))}`)
    if (c.usageLimitPerUser === 1) parts.push("1 per customer")
    return parts.length ? parts.join(" · ") : "No minimum"
  }

  const scopeText = (c: CouponResponse) => {
    if (c.appliesTo === "categories") { const k = (c.categoryIds ?? []).length; return `${k} ${k === 1 ? "category" : "categories"}` }
    if (c.appliesTo === "products") { const k = (c.productIds ?? []).length; return `${k} ${k === 1 ? "product" : "products"}` }
    return "All products"
  }
  const channelText = (c: CouponResponse) =>
    c.channelPos !== false && c.channelOnline !== false ? "POS + Online" : c.channelPos !== false ? "POS only" : c.channelOnline !== false ? "Online only" : "No channel"
  const scopeNames = (c: CouponResponse) => {
    if (c.appliesTo === "categories") return (c.categoryIds ?? []).map((id) => flatCategories.find((x) => String(x.id) === String(id))?.category_name ?? `#${id}`).join("; ")
    if (c.appliesTo === "products") return (c.productIds ?? []).map((id) => allProducts.find((x) => String(x.id) === String(id))?.name ?? `#${id}`).join("; ")
    return "All products"
  }

  const openForm = (c?: CouponResponse | null) => {
    setEditing(c ?? null)
    if (c) {
      setForm({
        campaign_name: c.campaignName ?? "", code: c.code ?? "", type: c.type ?? "percentage",
        discount: c.type === "free_shipping" ? "" : String(c.discount ?? ""),
        min_order_amount: Number(c.minOrderAmount) > 0 ? String(c.minOrderAmount) : "",
        max_discount: Number(c.maxDiscount) > 0 ? String(c.maxDiscount) : "",
        usage_limit: c.usageLimit ? String(c.usageLimit) : "",
        oncePerCustomer: c.oncePerCustomer ?? c.usageLimitPerUser === 1,
        appliesTo: c.appliesTo ?? "all", categoryIds: (c.categoryIds ?? []).map(String), productIds: (c.productIds ?? []).map(String),
        channelPos: c.channelPos ?? true, channelOnline: c.channelOnline ?? true,
        start_date: toInputDate(c.startDate), end_date: toInputDate(c.endDate), status: c.status ?? true, image: null,
      })
      setImagePreview(c.image ? `http://localhost:8005/storage/${c.image}` : null)
    } else {
      setForm(emptyForm)
      setImagePreview(null)
    }
    setPickQ("")
    setFormOpen(true)
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    set("image", file)
    setImagePreview(URL.createObjectURL(file))
  }

  const save = async () => {
    const code = form.code.trim().toUpperCase()
    const bad = (title: string, description: string) => toast({ variant: "destructive", title, description })
    if (form.campaign_name.trim().length < 3) return bad("Campaign name needed", "Use at least 3 characters")
    if (code.length < 3 || !/^[A-Z0-9_-]+$/.test(code)) return bad("Check the code", "Letters, numbers, dashes and underscores only, at least 3 characters")
    if (coupons.some((x) => x.id !== editing?.id && (x.code ?? "").toUpperCase() === code)) return bad("Code already used", `A coupon with ${code} already exists`)
    if (form.type !== "free_shipping") {
      const d = parseFloat(form.discount)
      if (!(d > 0)) return bad("Discount needed", "Enter a discount greater than 0")
      if (form.type === "percentage" && d > 100) return bad("Check the discount", "A percentage discount cannot be more than 100%")
    }
    if (form.usage_limit.trim() !== "") {
      const u = Number(form.usage_limit)
      if (!Number.isInteger(u) || u < 1) return bad("Check total uses", "Use a whole number of 1 or more, or leave it empty for unlimited")
      if (editing && u < (editing.timesUsed ?? 0)) return bad("Check total uses", `${editing.timesUsed} already redeemed, so the limit can't be lower`)
    }
    if (!form.start_date) return bad("Start date needed", "Choose when the coupon starts")
    if (form.end_date && form.end_date < form.start_date) return bad("Check the dates", "End date can't be before the start date")

    const num = (s: string) => (s.trim() !== "" && !isNaN(Number(s)) ? Number(s) : undefined)
    const payload: any = {
      campaign_name: form.campaign_name.trim(),
      code,
      type: form.type,
      // The API requires a positive discount; free delivery ignores the value.
      discount: form.type === "free_shipping" ? 0.01 : parseFloat(form.discount),
      status: form.status,
      start_date: form.start_date,
    }
    if (form.end_date) payload.end_date = form.end_date
    const min = num(form.min_order_amount); if (min !== undefined) payload.min_order_amount = min
    const max = form.type === "percentage" ? num(form.max_discount) : undefined; if (max !== undefined) payload.max_discount = max
    const lim = num(form.usage_limit); if (lim !== undefined) payload.usage_limit = Math.floor(lim)
    if (form.oncePerCustomer) payload.usage_limit_per_user = 1
    if (form.appliesTo === "categories" && form.categoryIds.length === 0) return toast({ variant: "destructive", title: "Pick categories", description: "Choose at least one category, or apply to everything" })
    if (form.appliesTo === "products" && form.productIds.length === 0) return toast({ variant: "destructive", title: "Pick products", description: "Choose at least one product, or apply to everything" })
    if (!form.channelPos && !form.channelOnline) return toast({ variant: "destructive", title: "Pick a channel", description: "Enable the coupon for POS, online, or both" })
    // The with-image endpoints only read the old snake_case keys, so the newer fields go through the JSON update.
    const clears: any = editing
      ? {
          end_date: form.end_date || null,
          usage_limit: lim !== undefined ? Math.floor(lim) : null,
          max_discount: form.type === "percentage" ? (max ?? null) : null,
          ...(editing.usageLimitPerUser === 1 && !form.oncePerCustomer ? { usage_limit_per_user: null } : {}),
        }
      : {}
    const extra = {
      ...clears,
      appliesTo: form.appliesTo,
      categoryIds: form.appliesTo === "categories" ? form.categoryIds.map(Number) : [],
      productIds: form.appliesTo === "products" ? form.productIds.map(Number) : [],
      channelPos: form.channelPos,
      channelOnline: form.channelOnline,
      oncePerCustomer: form.oncePerCustomer,
    }

    setSaving(true)
    try {
      if (editing) {
        if (form.image) {
          await couponApi.updateWithImage(editing.id, { ...payload, image: form.image })
          await couponApi.update(editing.id, extra)
        } else await couponApi.update(editing.id, { ...payload, ...extra })
        toast({ title: "Coupon updated", description: code })
      } else {
        if (form.image) {
          const created = await couponApi.createWithImage({ ...payload, image: form.image })
          const newId = (created as any)?.data?.id
          if (newId) await couponApi.update(newId, extra)
        } else await couponApi.create({ ...payload, ...extra })
        toast({ title: "Coupon created", description: code })
      }
      setFormOpen(false)
      refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not save", description: err?.response?.data?.message || err?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (targets: CouponResponse[], status: boolean) => {
    setToggling((p) => new Set([...p, ...targets.map((t) => t.id)]))
    const results = await Promise.allSettled(targets.map((c) => couponApi.update(c.id, { status })))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some updates failed", description: `${failed} of ${targets.length} could not be changed` })
    else toast({ title: status ? "Enabled" : "Disabled", description: `${targets.length} coupon${targets.length === 1 ? "" : "s"} updated` })
    setChecked(new Set())
    await refresh()
    setToggling(new Set())
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((c) => couponApi.delete(c.id)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: "Some deletions failed", description: `${failed} of ${deleteTargets.length} could not be deleted` })
    else toast({ title: "Deleted", description: `${deleteTargets.length} coupon${deleteTargets.length === 1 ? "" : "s"} removed` })
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    refresh()
  }

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast({ title: "Code copied", description: code }) }
    catch { toast({ variant: "destructive", title: "Could not copy", description: code }) }
  }

  const handleExport = () => {
    const source = selected.length ? selected : filtered
    exportToCSV(
      source.map((c) => ({
        id: c.id, campaign_name: c.campaignName, code: c.code, discount: discountText(c),
        applies_to: scopeNames(c), channels: channelText(c),
        min_order: c.minOrderAmount ?? 0, max_discount: c.type === "percentage" && Number(c.maxDiscount) > 0 ? c.maxDiscount : "",
        per_customer: c.oncePerCustomer || c.usageLimitPerUser === 1 ? "1" : c.usageLimitPerUser ?? "",
        used: c.timesUsed ?? 0, limit: c.usageLimit ?? "", sales: c.revenue ?? 0,
        status: PHASE[phaseOf(c)].label, start_date: fmtDate(c.startDate), end_date: fmtDate(c.endDate),
      })),
      "coupons",
      ["ID", "Campaign Name", "Code", "Discount", "Applies To", "Channels", "Min Order", "Max Discount", "Per Customer", "Used", "Limit", "Sales", "Status", "Start Date", "End Date"],
    )
  }

  // Live preview values
  const pvDisc = form.type === "free_shipping" ? "Free delivery" : form.type === "percentage" ? `${form.discount || 0}% off` : `${formatCurrency(Number(form.discount) || 0)} off`
  const pvCond = Number(form.min_order_amount) > 0 ? `Min ${formatCurrency(Number(form.min_order_amount))}` : "No minimum"

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Coupons"
        description="Discount codes customers can use in store and online."
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" aria-hidden /> Export
          </Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> Add coupon
          </Button>
        </>}
      />

      <Card className="min-w-0 gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: counts.all },
              { value: "active", label: "Active", count: counts.active },
              { value: "scheduled", label: "Scheduled", count: counts.scheduled },
              { value: "used_up", label: "Used up", count: counts.used_up },
              { value: "expired", label: "Expired", count: counts.expired },
              { value: "disabled", label: "Disabled", count: counts.disabled },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="coupon-search" className="sr-only">Search coupons</Label>
            <Input id="coupon-search" type="search" placeholder="Search code or campaign…" value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pl-8" />
          </div>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); changeTab("all") }}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </div>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selected, true)}>Enable</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selected, false)}>Disable</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>Export selected</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>Delete</Button>
        </BulkBar>

          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all on this page" /></TableHead>
                <TableHead scope="col">Coupon</TableHead>
                <TableHead scope="col">Discount</TableHead>
                <TableHead scope="col">Where it works</TableHead>
                <TableHead scope="col">Used</TableHead>
                <TableHead scope="col">Valid</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col" className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>)
              ) : currentItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="whitespace-normal">
                    <EmptyState
                      icon={Ticket}
                      title="No coupons found"
                      description={hasFilters ? "Try clearing the filters." : "Create your first discount code to get started."}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((c) => {
                  const phase = phaseOf(c)
                  const note = timeNote(c, phase)
                  const used = c.timesUsed ?? 0
                  const limit = c.usageLimit ?? 0
                  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  return (
                    <TableRow key={c.id} data-state={checked.has(c.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox checked={checked.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.code}`} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          {c.image && (
                            <UserAvatar shape="square" src={`http://localhost:8005/storage/${c.image}`} alt="" className="size-9" fallback={<Ticket className="size-4" aria-hidden />} />
                          )}
                          <div>
                            <div className="font-mono text-[13px] font-bold tracking-wide">{c.code}</div>
                            <div className="text-xs text-muted-foreground">{c.campaignName}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold tabular-nums">{discountText(c)}</div>
                        <div className="text-xs text-muted-foreground">{condText(c)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{scopeText(c)}</div>
                        <div className="text-xs text-muted-foreground">{channelText(c)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="tabular-nums"><strong>{used}</strong> / {limit || "∞"}</div>
                        {(c.revenue ?? 0) > 0
                          ? <div className="text-xs text-muted-foreground tabular-nums">{formatCurrency(c.revenue ?? 0)} in sales</div>
                          : <div className="text-xs text-muted-foreground">{phase === "scheduled" ? "Not started" : "No sales yet"}</div>}
                        {limit > 0 && (
                          <Progress value={pct} aria-label="Usage" className="mt-1 h-1.5 w-24" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="tabular-nums">{fmtDate(c.startDate)} – {c.endDate ? fmtDate(c.endDate) : "No end"}</div>
                        <div className={cn("text-xs font-semibold", note.cls)}>{note.text}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={phase} variant={PHASE[phase].variant} label={PHASE[phase].label} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Switch checked={!!c.status} disabled={toggling.has(c.id)} onCheckedChange={(v) => setStatus([c], v)}
                            aria-label={`${c.status ? "Disable" : "Enable"} ${c.code}`} className="mr-1 self-center" />
                          <Button type="button" variant="outline" size="icon" aria-label={`Copy code ${c.code}`} onClick={() => copyCode(c.code)}><Copy className="size-4" /></Button>
                          <Button type="button" variant="outline" size="icon" aria-label={`Edit ${c.code}`} onClick={() => openForm(c)}><Pencil className="size-4" /></Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={`More actions for ${c.code}`}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setStatus([c], !c.status)}>{c.status ? "Disable" : "Enable"}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([c])}>Delete coupon</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

        {!loading && filtered.length > 0 && (
          <>
          <Separator />
          <div className="p-4 pt-3">
            <PaginationControl
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              itemsPerPage={itemsPerPage}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
          </>
        )}
      </Card>

      {/* Add / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[640px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]">
          <DialogHeader className="px-6 py-4 text-left">
            <DialogTitle>{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
            <DialogDescription>Discount codes for POS and your online store.</DialogDescription>
          </DialogHeader>
          <Separator />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <Card className="gap-2 px-4 py-3.5" aria-label="Coupon preview">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-base font-semibold">{form.campaign_name || "Campaign name"}</span>
                <span className="text-lg font-bold tabular-nums">{pvDisc}</span>
                <span className="text-xs text-muted-foreground">{pvCond}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">CODE</span>
                <span className="font-mono text-sm font-bold tracking-widest">{form.code.toUpperCase() || "—"}</span>
              </div>
            </Card>

            <FormField label="Campaign name *" htmlFor="coupon-campaign" className="min-w-0">
              <Input id="coupon-campaign" placeholder="e.g. Eid Sale 2026" value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} autoFocus />
            </FormField>

            <FormField label="Coupon code *" htmlFor="coupon-code" className="min-w-0">
              <span className="flex gap-2">
                <Input id="coupon-code" className="font-mono uppercase tracking-wide" placeholder="EID25" value={form.code}
                  onChange={(e) => set("code", e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase())} />
                <Button type="button" variant="outline" onClick={() => set("code", genCode())} className="shrink-0">Generate</Button>
              </span>
            </FormField>

            <FormField label="Discount type">
              <SegmentedControl
                aria-label="Discount type"
                size="default"
                className="w-full"
                value={form.type}
                onValueChange={(v) => set("type", v as CType)}
                options={TYPES}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-2.5">
              {form.type !== "free_shipping" && (
                <FormField label={form.type === "percentage" ? "Discount (%) *" : "Discount amount *"} htmlFor="coupon-discount" className="min-w-0">
                  <Input id="coupon-discount" type="number" min={0} max={form.type === "percentage" ? 100 : undefined} step="0.01" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
                </FormField>
              )}
              <FormField label="Minimum order" htmlFor="coupon-min" className="min-w-0">
                <Input id="coupon-min" type="number" min={0} step="0.01" placeholder="0 = none" value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
              </FormField>
              {form.type === "percentage" && (
                <FormField label="Max discount" htmlFor="coupon-max" className="min-w-0">
                  <Input id="coupon-max" type="number" min={0} step="0.01" placeholder="No cap" value={form.max_discount} onChange={(e) => set("max_discount", e.target.value)} />
                </FormField>
              )}
              <FormField label="Total uses" htmlFor="coupon-uses" className="min-w-0">
                <Input id="coupon-uses" type="number" min={editing?.timesUsed || 1} step="1" placeholder="Unlimited" value={form.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <FormField label="Starts *" htmlFor="coupon-start" className="min-w-0">
                <Input id="coupon-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </FormField>
              <FormField
                label="Ends (optional)" htmlFor="coupon-end" className="min-w-0"
                description={form.end_date ? "Works through the end of this day." : "Empty means No end."}
              >
                <Input id="coupon-end" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
              </FormField>
            </div>

            <FormField label="Applies to">
              <SegmentedControl
                aria-label="Applies to"
                size="default"
                className="w-full"
                value={form.appliesTo}
                onValueChange={(v) => { const id = v as FormState["appliesTo"]; setForm((f) => ({ ...f, appliesTo: id, categoryIds: [], productIds: [] })); setPickQ("") }}
                options={[{ value: "all", label: "Everything" }, { value: "categories", label: "Categories" }, { value: "products", label: "Products" }]}
              />
              {form.appliesTo !== "all" && (
                <div className="flex items-center gap-2">
                  <Input type="search" aria-label={`Filter ${form.appliesTo}`} placeholder={`Filter ${form.appliesTo}…`} value={pickQ} onChange={(e) => setPickQ(e.target.value)}
                    className="min-w-0 flex-1" />
                  <Badge variant="secondary" className="shrink-0">
                    {(form.appliesTo === "categories" ? form.categoryIds : form.productIds).length} selected
                  </Badge>
                </div>
              )}
              {form.appliesTo === "categories" && (
                <Card className="max-h-40 gap-1.5 overflow-y-auto p-2.5 shadow-none">
                  {flatCategories.filter((c) => c.status && (!pickQ.trim() || c.category_name.toLowerCase().includes(pickQ.trim().toLowerCase()))).map((c) => (
                    <Label key={c.id} className="font-normal">
                      <Checkbox checked={form.categoryIds.includes(String(c.id))}
                        onCheckedChange={(v) => set("categoryIds", v === true ? [...form.categoryIds, String(c.id)] : form.categoryIds.filter((x) => x !== String(c.id)))} />
                      {c.parent_id ? "└ " : ""}{c.category_name}
                    </Label>
                  ))}
                </Card>
              )}
              {form.appliesTo === "products" && (
                <Card className="max-h-48 gap-1.5 overflow-y-auto p-2.5 shadow-none">
                  {allProducts.filter((p) => !pickQ.trim() || (p.name ?? "").toLowerCase().includes(pickQ.trim().toLowerCase())).map((p) => (
                    <Label key={p.id} className="font-normal">
                      <Checkbox checked={form.productIds.includes(String(p.id))}
                        onCheckedChange={(v) => set("productIds", v === true ? [...form.productIds, String(p.id)] : form.productIds.filter((x) => x !== String(p.id)))} />
                      <span className="truncate">{p.name}</span>
                    </Label>
                  ))}
                </Card>
              )}
            </FormField>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-ch-pos" checked={form.channelPos} onCheckedChange={(v) => set("channelPos", v === true)} />
                <FieldLabel htmlFor="coupon-ch-pos">Works in POS</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-ch-online" checked={form.channelOnline} onCheckedChange={(v) => set("channelOnline", v === true)} />
                <FieldLabel htmlFor="coupon-ch-online">Works online</FieldLabel>
              </Field>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-active" checked={form.status} onCheckedChange={(v) => set("status", v === true)} />
                <FieldLabel htmlFor="coupon-active">Active</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-once" checked={form.oncePerCustomer} onCheckedChange={(v) => set("oncePerCustomer", v === true)} />
                <FieldLabel htmlFor="coupon-once">1 use per customer</FieldLabel>
              </Field>
            </div>

            <FormField label="Image (optional)" htmlFor="coupon-image">
              <div className="flex items-center gap-3">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Coupon preview" className="size-14 rounded-lg border object-cover" />
                )}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden /> {imagePreview ? "Change image" : "Upload image"}
                </Button>
                <Input id="coupon-image" ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </FormField>
          </div>

          <Separator />
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTargets.length === 1 ? deleteTargets[0].code : `${deleteTargets.length} coupons`}?</AlertDialogTitle>
            <AlertDialogDescription>Customers will no longer be able to use {deleteTargets.length === 1 ? "this code" : "these codes"}. This can’t be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
