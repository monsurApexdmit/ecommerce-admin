"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Copy, Download, ImagePlus, MoreHorizontal, Pencil, Plus, Search, Ticket, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bricolage, instrument } from "@/components/dashboard/fonts"
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

const PHASE: Record<Phase, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-dash-success-soft text-dash-success-fg" },
  scheduled: { label: "Scheduled", cls: "bg-dash-accent-soft text-dash-accent-fg" },
  expired: { label: "Expired", cls: "bg-dash-neutral-soft text-dash-neutral-fg" },
  used_up: { label: "Used up", cls: "bg-dash-warn-soft text-dash-warn-fg" },
  disabled: { label: "Disabled", cls: "bg-dash-neutral-soft text-dash-neutral-fg" },
}

const TYPES: { value: CType; label: string }[] = [
  { value: "percentage", label: "% off" },
  { value: "fixed", label: "Amount off" },
  { value: "free_shipping", label: "Free delivery" },
]

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fieldLabel = "flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold"
const fieldInput =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

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
  if (phase === "disabled") return { text: "Switched off", cls: "text-dash-muted" }
  if (phase === "used_up") return { text: "Limit reached", cls: "text-dash-warn-fg" }
  if (phase === "expired" && end) return { text: `Ended ${Math.max(0, Math.floor((now - end) / DAY))} days ago`, cls: "text-dash-muted" }
  if (phase === "scheduled" && start) return { text: `Starts in ${Math.max(1, Math.ceil((start - now) / DAY))} days`, cls: "text-dash-accent-fg" }
  if (end) return { text: `${Math.max(1, Math.ceil((end - now) / DAY))} days left`, cls: "text-dash-success-fg" }
  return { text: "No end", cls: "text-dash-success-fg" }
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Coupons</h1>
          <p className="mt-1 text-sm text-dash-muted">Discount codes customers can use in store and online.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
            <Download className="size-4" aria-hidden /> Export
          </button>
          <button type="button" onClick={() => openForm(null)}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add coupon
          </button>
        </div>
      </div>

      <section className="min-w-0 rounded-[14px] border border-dash-border bg-dash-card">
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
          <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search coupons</span>
            <input type="search" placeholder="Search code or campaign…" value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          {hasFilters && (
            <button type="button" onClick={() => { setSearch(""); changeTab("all") }} className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
        </div>

        {checked.size > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-2.5 rounded-[10px] bg-dash-ink px-3.5 py-2.5 text-dash-bg">
            <span className="text-sm font-semibold">{checked.size} selected</span>
            <button type="button" onClick={() => setStatus(selected, true)} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Enable</button>
            <button type="button" onClick={() => setStatus(selected, false)} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Disable</button>
            <button type="button" onClick={handleExport} className="h-9 rounded-lg border border-white/25 px-3 text-[13px] font-semibold hover:bg-white/10">Export selected</button>
            <button type="button" onClick={() => setDeleteTargets(selected)} className="h-9 rounded-lg border border-red-400/50 px-3 text-[13px] font-semibold text-red-300 hover:bg-white/10">Delete</button>
            <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 text-[13px] font-semibold opacity-80 hover:opacity-100">Clear</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="w-5 py-3 pl-4 pr-2"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all on this page" /></th>
                <th scope="col" className="px-2 py-3 font-semibold">Coupon</th>
                <th scope="col" className="px-2 py-3 font-semibold">Discount</th>
                <th scope="col" className="px-2 py-3 font-semibold">Where it works</th>
                <th scope="col" className="px-2 py-3 font-semibold">Used</th>
                <th scope="col" className="px-2 py-3 font-semibold">Valid</th>
                <th scope="col" className="px-2 py-3 font-semibold">Status</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center">
                    <Ticket className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No coupons found</p>
                    <p className="text-sm text-dash-muted">{hasFilters ? "Try clearing the filters." : "Create your first discount code to get started."}</p>
                  </td>
                </tr>
              ) : (
                currentItems.map((c) => {
                  const phase = phaseOf(c)
                  const note = timeNote(c, phase)
                  const used = c.timesUsed ?? 0
                  const limit = c.usageLimit ?? 0
                  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  return (
                    <tr key={c.id} className={checked.has(c.id) ? "bg-dash-bg" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <Checkbox checked={checked.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={`Select ${c.code}`} />
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          {c.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`http://localhost:8005/storage/${c.image}`} alt="" className="size-9 rounded-lg border border-dash-border object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                          )}
                          <div>
                            <div className="font-mono text-[13px] font-bold tracking-wide">{c.code}</div>
                            <div className="text-xs text-dash-muted">{c.campaignName}</div>
                          </div>
                        </div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-semibold tabular-nums">{discountText(c)}</div>
                        <div className="text-xs text-dash-muted">{condText(c)}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="font-medium">{scopeText(c)}</div>
                        <div className="text-xs text-dash-muted">{channelText(c)}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="tabular-nums"><strong>{used}</strong> / {limit || "∞"}</div>
                        {(c.revenue ?? 0) > 0
                          ? <div className="text-xs text-dash-muted tabular-nums">{formatCurrency(c.revenue ?? 0)} in sales</div>
                          : <div className="text-xs text-dash-muted">{phase === "scheduled" ? "Not started" : "No sales yet"}</div>}
                        {limit > 0 && (
                          <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-dash-border-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Usage">
                            <div className="h-full rounded-full bg-dash-accent" style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="tabular-nums">{fmtDate(c.startDate)} – {c.endDate ? fmtDate(c.endDate) : "No end"}</div>
                        <div className={cn("text-xs font-semibold", note.cls)}>{note.text}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-md px-2 py-[3px] text-xs font-bold", PHASE[phase].cls)}>{PHASE[phase].label}</span>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex justify-end gap-1">
                          <Switch checked={!!c.status} disabled={toggling.has(c.id)} onCheckedChange={(v) => setStatus([c], v)}
                            aria-label={`${c.status ? "Disable" : "Enable"} ${c.code}`} className="mr-1 self-center" />
                          <button type="button" aria-label={`Copy code ${c.code}`} onClick={() => copyCode(c.code)} className={iconBtn}><Copy className="size-4" /></button>
                          <button type="button" aria-label={`Edit ${c.code}`} onClick={() => openForm(c)} className={iconBtn}><Pencil className="size-4" /></button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`More actions for ${c.code}`} className={iconBtn}><MoreHorizontal className="size-4" /></button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setStatus([c], !c.status)}>{c.status ? "Disable" : "Enable"}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-dash-danger focus:text-dash-danger" onClick={() => setDeleteTargets([c])}>Delete coupon</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && filtered.length > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <PaginationControl
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              itemsPerPage={itemsPerPage}
              totalItems={filtered.length}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          </div>
        )}
      </section>

      {/* Add / edit */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[640px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[640px]">
          <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
            <DialogTitle className="font-dash-display text-[22px] font-bold">{editing ? "Edit coupon" : "New coupon"}</DialogTitle>
            <DialogDescription className="text-[13px] text-dash-muted">Discount codes for POS and your online store.</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <div className="rounded-xl bg-dash-accent px-4 py-3.5 text-white">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-dash-display text-base font-bold">{form.campaign_name || "Campaign name"}</span>
                <span className="text-lg font-bold tabular-nums">{pvDisc}</span>
                <span className="text-xs opacity-80">{pvCond}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 border-t border-dashed border-white/40 pt-2 text-xs">
                <span className="opacity-80">CODE</span>
                <span className="font-mono text-sm font-bold tracking-widest">{form.code.toUpperCase() || "—"}</span>
              </div>
            </div>

            <label className={fieldLabel}>Campaign name *
              <input className={fieldInput} placeholder="e.g. Eid Sale 2026" value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} autoFocus />
            </label>

            <label className={fieldLabel}>Coupon code *
              <span className="flex gap-2">
                <input className={cn(fieldInput, "font-mono uppercase tracking-wide")} placeholder="EID25" value={form.code}
                  onChange={(e) => set("code", e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase())} />
                <button type="button" onClick={() => set("code", genCode())}
                  className="h-[42px] shrink-0 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">Generate</button>
              </span>
            </label>

            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Discount type
              <div role="radiogroup" aria-label="Discount type" className="grid grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const on = form.type === t.value
                  return (
                    <button key={t.value} type="button" role="radio" aria-checked={on} onClick={() => set("type", t.value)}
                      className={cn("h-11 rounded-xl border-2 px-2 text-sm font-semibold",
                        on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {form.type !== "free_shipping" && (
                <label className={fieldLabel}>{form.type === "percentage" ? "Discount (%) *" : "Discount amount *"}
                  <input className={fieldInput} type="number" min={0} max={form.type === "percentage" ? 100 : undefined} step="0.01" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
                </label>
              )}
              <label className={fieldLabel}>Minimum order
                <input className={fieldInput} type="number" min={0} step="0.01" placeholder="0 = none" value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
              </label>
              {form.type === "percentage" && (
                <label className={fieldLabel}>Max discount
                  <input className={fieldInput} type="number" min={0} step="0.01" placeholder="No cap" value={form.max_discount} onChange={(e) => set("max_discount", e.target.value)} />
                </label>
              )}
              <label className={fieldLabel}>Total uses
                <input className={fieldInput} type="number" min={editing?.timesUsed || 1} step="1" placeholder="Unlimited" value={form.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <label className={fieldLabel}>Starts *
                <input className={fieldInput} type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </label>
              <label className={fieldLabel}>Ends (optional)
                <input className={fieldInput} type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
                <span className="text-xs font-normal text-dash-muted">{form.end_date ? "Works through the end of this day." : "Empty means No end."}</span>
              </label>
            </div>

            <div className="flex flex-col gap-2 text-[13px] font-semibold">
              Applies to
              <div role="radiogroup" aria-label="Applies to" className="grid grid-cols-3 gap-2">
                {([["all", "Everything"], ["categories", "Categories"], ["products", "Products"]] as const).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={form.appliesTo === id} onClick={() => { setForm((f) => ({ ...f, appliesTo: id, categoryIds: [], productIds: [] })); setPickQ("") }}
                    className={cn("h-10 rounded-[10px] border-2 text-[13px] font-semibold", form.appliesTo === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{label}</button>
                ))}
              </div>
              {form.appliesTo !== "all" && (
                <div className="flex items-center gap-2 font-normal">
                  <input type="search" aria-label={`Filter ${form.appliesTo}`} placeholder={`Filter ${form.appliesTo}…`} value={pickQ} onChange={(e) => setPickQ(e.target.value)}
                    className="h-10 min-w-0 flex-1 rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none placeholder:text-dash-muted focus-visible:border-dash-accent" />
                  <span className="shrink-0 text-xs font-semibold text-dash-muted">
                    {(form.appliesTo === "categories" ? form.categoryIds : form.productIds).length} selected
                  </span>
                </div>
              )}
              {form.appliesTo === "categories" && (
                <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-xl border border-dash-border p-2.5 font-normal">
                  {flatCategories.filter((c) => c.status && (!pickQ.trim() || c.category_name.toLowerCase().includes(pickQ.trim().toLowerCase()))).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.categoryIds.includes(String(c.id))}
                        onCheckedChange={(v) => set("categoryIds", v === true ? [...form.categoryIds, String(c.id)] : form.categoryIds.filter((x) => x !== String(c.id)))} />
                      {c.parent_id ? "└ " : ""}{c.category_name}
                    </label>
                  ))}
                </div>
              )}
              {form.appliesTo === "products" && (
                <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-xl border border-dash-border p-2.5 font-normal">
                  {allProducts.filter((p) => !pickQ.trim() || (p.name ?? "").toLowerCase().includes(pickQ.trim().toLowerCase())).map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.productIds.includes(String(p.id))}
                        onCheckedChange={(v) => set("productIds", v === true ? [...form.productIds, String(p.id)] : form.productIds.filter((x) => x !== String(p.id)))} />
                      <span className="truncate">{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <label className="flex items-center gap-2">
                <Checkbox checked={form.channelPos} onCheckedChange={(v) => set("channelPos", v === true)} /> Works in POS
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={form.channelOnline} onCheckedChange={(v) => set("channelOnline", v === true)} /> Works online
              </label>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <label className="flex items-center gap-2">
                <Checkbox checked={form.status} onCheckedChange={(v) => set("status", v === true)} /> Active
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={form.oncePerCustomer} onCheckedChange={(v) => set("oncePerCustomer", v === true)} /> 1 use per customer
              </label>
            </div>

            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Image (optional)
              <div className="flex items-center gap-3">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Coupon preview" className="size-14 rounded-lg border border-dash-border object-cover" />
                )}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                  <ImagePlus className="size-4" aria-hidden /> {imagePreview ? "Change image" : "Upload image"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 border-t border-dash-border px-6 py-4">
            <button type="button" onClick={() => setFormOpen(false)}
              className="h-12 rounded-xl border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="h-12 rounded-xl bg-dash-accent px-[22px] text-[15px] font-bold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}
            </button>
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
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
