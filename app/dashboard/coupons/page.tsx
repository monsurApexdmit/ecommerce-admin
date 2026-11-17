"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
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
import { WithTooltip } from "@/components/common/WithTooltip"
import { localeTag } from "@/lib/i18n"

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

type T = TFunction<["commerce", "common"]>

const PHASE = {
  active: { label: "common:status.active", variant: "default" },
  scheduled: { label: "commerce:coupons.phase.scheduled", variant: "secondary" },
  expired: { label: "commerce:coupons.phase.expired", variant: "outline" },
  used_up: { label: "commerce:coupons.phase.usedUp", variant: "destructive" },
  disabled: { label: "common:status.disabled", variant: "outline" },
} as const satisfies Record<Phase, { label: string; variant: StatusVariant }>

const TYPES = [
  { value: "percentage", label: "commerce:coupons.type.percentage" },
  { value: "fixed", label: "commerce:coupons.type.fixed" },
  { value: "free_shipping", label: "commerce:coupons.type.freeShipping" },
] as const satisfies readonly { value: CType; label: string }[]

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

function timeNote(t: T, c: CouponResponse, phase: Phase): { text: string; cls: string } {
  const now = Date.now()
  const end = endMs(c)
  const start = startMs(c)
  if (phase === "disabled") return { text: t("commerce:coupons.note.switchedOff"), cls: "text-muted-foreground" }
  if (phase === "used_up") return { text: t("commerce:coupons.note.limitReached"), cls: "text-destructive" }
  if (phase === "expired" && end) return { text: t("commerce:coupons.note.ended", { count: Math.max(0, Math.floor((now - end) / DAY)) }), cls: "text-muted-foreground" }
  if (phase === "scheduled" && start) return { text: t("commerce:coupons.note.startsIn", { count: Math.max(1, Math.ceil((start - now) / DAY)) }), cls: "text-foreground" }
  if (end) return { text: t("commerce:coupons.note.daysLeft", { count: Math.max(1, Math.ceil((end - now) / DAY)) }), cls: "text-foreground" }
  return { text: t("commerce:coupons.note.noEnd"), cls: "text-foreground" }
}

function fmtDate(s: string | null | undefined, tag: string, noEnd: string) {
  if (!s) return noEnd
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(tag, { day: "numeric", month: "short", year: "numeric" })
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
  const { t, i18n } = useTranslation(["commerce", "common"])
  const tag = localeTag(i18n.language)
  const noEnd = t("commerce:coupons.note.noEnd")
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

  const changeTab = (v: string) => { setTab(v as Tab); setCurrentPage(1); setChecked(new Set()) }
  const hasFilters = !!(search || tab !== "all")

  const allChecked = currentItems.length > 0 && currentItems.every((c) => checked.has(c.id))
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(currentItems.map((c) => c.id)))
  const toggleOne = (id: number) =>
    setChecked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selected = coupons.filter((c) => checked.has(c.id))

  const discountText = (c: CouponResponse) =>
    c.type === "free_shipping" ? t("commerce:coupons.type.freeShipping") : c.type === "percentage" ? t("commerce:coupons.text.percentOff", { value: c.discount }) : t("commerce:coupons.text.amountOff", { amount: formatCurrency(Number(c.discount) || 0) })
  const condText = (c: CouponResponse) => {
    const parts: string[] = []
    if (Number(c.minOrderAmount) > 0) parts.push(t("commerce:coupons.text.min", { amount: formatCurrency(Number(c.minOrderAmount)) }))
    if (c.type === "percentage" && Number(c.maxDiscount) > 0) parts.push(t("commerce:coupons.text.max", { amount: formatCurrency(Number(c.maxDiscount)) }))
    if (c.usageLimitPerUser === 1) parts.push(t("commerce:coupons.text.onePerCustomer"))
    return parts.length ? parts.join(" · ") : t("commerce:coupons.text.noMinimum")
  }

  const scopeText = (c: CouponResponse) => {
    if (c.appliesTo === "categories") return t("commerce:coupons.text.categories", { count: (c.categoryIds ?? []).length })
    if (c.appliesTo === "products") return t("common:count.products", { count: (c.productIds ?? []).length })
    return t("commerce:coupons.text.allProducts")
  }
  const channelText = (c: CouponResponse) =>
    c.channelPos !== false && c.channelOnline !== false ? t("commerce:coupons.text.posAndOnline") : c.channelPos !== false ? t("commerce:coupons.text.posOnly") : c.channelOnline !== false ? t("commerce:coupons.text.onlineOnly") : t("commerce:coupons.text.noChannel")
  const scopeNames = (c: CouponResponse) => {
    if (c.appliesTo === "categories") return (c.categoryIds ?? []).map((id) => flatCategories.find((x) => String(x.id) === String(id))?.category_name ?? `#${id}`).join("; ")
    if (c.appliesTo === "products") return (c.productIds ?? []).map((id) => allProducts.find((x) => String(x.id) === String(id))?.name ?? `#${id}`).join("; ")
    return t("commerce:coupons.text.allProducts")
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
    if (form.campaign_name.trim().length < 3) return bad(t("commerce:coupons.validation.nameTitle"), t("commerce:coupons.validation.nameDesc"))
    if (code.length < 3 || !/^[A-Z0-9_-]+$/.test(code)) return bad(t("commerce:coupons.validation.codeTitle"), t("commerce:coupons.validation.codeDesc"))
    if (coupons.some((x) => x.id !== editing?.id && (x.code ?? "").toUpperCase() === code)) return bad(t("commerce:coupons.validation.codeUsedTitle"), t("commerce:coupons.validation.codeUsedDesc", { code }))
    if (form.type !== "free_shipping") {
      const d = parseFloat(form.discount)
      if (!(d > 0)) return bad(t("commerce:coupons.validation.discountTitle"), t("commerce:coupons.validation.discountDesc"))
      if (form.type === "percentage" && d > 100) return bad(t("commerce:coupons.validation.percentTitle"), t("commerce:coupons.validation.percentDesc"))
    }
    if (form.usage_limit.trim() !== "") {
      const u = Number(form.usage_limit)
      if (!Number.isInteger(u) || u < 1) return bad(t("commerce:coupons.validation.usesTitle"), t("commerce:coupons.validation.usesDesc"))
      if (editing && u < (editing.timesUsed ?? 0)) return bad(t("commerce:coupons.validation.usesTitle"), t("commerce:coupons.validation.usesBelowUsed", { used: editing.timesUsed }))
    }
    if (!form.start_date) return bad(t("commerce:coupons.validation.startTitle"), t("commerce:coupons.validation.startDesc"))
    if (form.end_date && form.end_date < form.start_date) return bad(t("commerce:coupons.validation.datesTitle"), t("commerce:coupons.validation.datesDesc"))

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
    if (form.appliesTo === "categories" && form.categoryIds.length === 0) return toast({ variant: "destructive", title: t("commerce:coupons.validation.categoriesTitle"), description: t("commerce:coupons.validation.categoriesDesc") })
    if (form.appliesTo === "products" && form.productIds.length === 0) return toast({ variant: "destructive", title: t("commerce:coupons.validation.productsTitle"), description: t("commerce:coupons.validation.productsDesc") })
    if (!form.channelPos && !form.channelOnline) return toast({ variant: "destructive", title: t("commerce:coupons.validation.channelTitle"), description: t("commerce:coupons.validation.channelDesc") })
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
        toast({ title: t("commerce:coupons.toast.updated"), description: code })
      } else {
        if (form.image) {
          const created = await couponApi.createWithImage({ ...payload, image: form.image })
          const newId = (created as any)?.data?.id
          if (newId) await couponApi.update(newId, extra)
        } else await couponApi.create({ ...payload, ...extra })
        toast({ title: t("commerce:coupons.toast.created"), description: code })
      }
      setFormOpen(false)
      refresh()
    } catch (err: any) {
      toast({ variant: "destructive", title: t("commerce:coupons.toast.saveFailed"), description: err?.response?.data?.message || err?.message || t("common:extra.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  const setStatus = async (targets: CouponResponse[], status: boolean) => {
    setToggling((p) => new Set([...p, ...targets.map((x) => x.id)]))
    const results = await Promise.allSettled(targets.map((c) => couponApi.update(c.id, { status })))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("commerce:coupons.toast.someUpdatesFailed"), description: t("commerce:coupons.toast.notChanged", { failed, total: targets.length }) })
    else toast({ title: status ? t("common:status.enabled") : t("common:status.disabled"), description: t("commerce:coupons.toast.updatedCount", { count: targets.length }) })
    setChecked(new Set())
    await refresh()
    setToggling(new Set())
  }

  const confirmDelete = async () => {
    setDeleting(true)
    const results = await Promise.allSettled(deleteTargets.map((c) => couponApi.delete(c.id)))
    const failed = results.filter((r) => r.status === "rejected").length
    if (failed) toast({ variant: "destructive", title: t("commerce:coupons.toast.someDeletesFailed"), description: t("commerce:coupons.toast.notDeleted", { failed, total: deleteTargets.length }) })
    else toast({ title: t("common:status.deleted"), description: t("commerce:coupons.toast.removedCount", { count: deleteTargets.length }) })
    setDeleting(false)
    setDeleteTargets([])
    setChecked(new Set())
    refresh()
  }

  const copyCode = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast({ title: t("commerce:coupons.toast.copied"), description: code }) }
    catch { toast({ variant: "destructive", title: t("commerce:coupons.toast.copyFailed"), description: code }) }
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
        status: t(PHASE[phaseOf(c)].label), start_date: fmtDate(c.startDate, tag, noEnd), end_date: fmtDate(c.endDate, tag, noEnd),
      })),
      "coupons",
      ["ID", "Campaign Name", "Code", "Discount", "Applies To", "Channels", "Min Order", "Max Discount", "Per Customer", "Used", "Limit", "Sales", "Status", "Start Date", "End Date"],
    )
  }

  // Live preview values
  const pvDisc = form.type === "free_shipping" ? t("commerce:coupons.type.freeShipping") : form.type === "percentage" ? t("commerce:coupons.text.percentOff", { value: form.discount || 0 }) : t("commerce:coupons.text.amountOff", { amount: formatCurrency(Number(form.discount) || 0) })
  const pvCond = Number(form.min_order_amount) > 0 ? t("commerce:coupons.text.min", { amount: formatCurrency(Number(form.min_order_amount)) }) : t("commerce:coupons.text.noMinimum")

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title={t("commerce:coupons.title")}
        description={t("commerce:coupons.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport}>
            <Download className="size-4" aria-hidden /> {t("common:actions.export")}
          </Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus className="size-4" aria-hidden /> {t("commerce:coupons.add")}
          </Button>
        </>}
      />

      <Card className="min-w-0 gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: t("common:status.all"), count: counts.all },
              { value: "active", label: t("common:status.active"), count: counts.active },
              { value: "scheduled", label: t("commerce:coupons.phase.scheduled"), count: counts.scheduled },
              { value: "used_up", label: t("commerce:coupons.phase.usedUp"), count: counts.used_up },
              { value: "expired", label: t("commerce:coupons.phase.expired"), count: counts.expired },
              { value: "disabled", label: t("common:status.disabled"), count: counts.disabled },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Label htmlFor="coupon-search" className="sr-only">{t("commerce:coupons.list.searchLabel")}</Label>
            <Input id="coupon-search" type="search" placeholder={t("commerce:coupons.list.searchPlaceholder")} value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1) }}
              className="pl-8" />
          </div>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); changeTab("all") }}>
              <X className="size-4" aria-hidden /> {t("common:actions.clear")}
            </Button>
          )}
        </div>

        <BulkBar count={checked.size} onClear={() => setChecked(new Set())} className="mx-4 mb-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selected, true)}>{t("commerce:coupons.list.enable")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setStatus(selected, false)}>{t("commerce:coupons.list.disable")}</Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>{t("commerce:coupons.list.exportSelected")}</Button>
            <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteTargets(selected)}>{t("common:actions.delete")}</Button>
        </BulkBar>

          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="w-5"><Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label={t("commerce:coupons.list.selectPage")} /></TableHead>
                <TableHead scope="col">{t("commerce:coupons.list.colCoupon")}</TableHead>
                <TableHead scope="col">{t("common:money.discount")}</TableHead>
                <TableHead scope="col">{t("commerce:coupons.list.colWhere")}</TableHead>
                <TableHead scope="col">{t("commerce:coupons.list.colUsed")}</TableHead>
                <TableHead scope="col">{t("commerce:coupons.list.colValid")}</TableHead>
                <TableHead scope="col">{t("common:fields.status")}</TableHead>
                <TableHead scope="col" className="text-right">{t("common:fields.actions")}</TableHead>
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
                      title={t("commerce:coupons.list.emptyTitle")}
                      description={hasFilters ? t("commerce:coupons.list.emptyFiltered") : t("commerce:coupons.list.emptyFirst")}
                      className="p-4 md:p-6"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                currentItems.map((c) => {
                  const phase = phaseOf(c)
                  const note = timeNote(t, c, phase)
                  const used = c.timesUsed ?? 0
                  const limit = c.usageLimit ?? 0
                  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
                  return (
                    <TableRow key={c.id} data-state={checked.has(c.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox checked={checked.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label={t("common:extra.selectRow", { name: c.code })} />
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
                          ? <div className="text-xs text-muted-foreground tabular-nums">{t("commerce:coupons.text.inSales", { amount: formatCurrency(c.revenue ?? 0) })}</div>
                          : <div className="text-xs text-muted-foreground">{phase === "scheduled" ? t("commerce:coupons.text.notStarted") : t("commerce:coupons.text.noSalesYet")}</div>}
                        {limit > 0 && (
                          <Progress value={pct} aria-label={t("commerce:coupons.text.usage")} className="mt-1 h-1.5 w-24" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="tabular-nums">{fmtDate(c.startDate, tag, noEnd)} – {fmtDate(c.endDate, tag, noEnd)}</div>
                        <div className={cn("text-xs font-semibold", note.cls)}>{note.text}</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={phase} variant={PHASE[phase].variant} label={t(PHASE[phase].label)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Switch checked={!!c.status} disabled={toggling.has(c.id)} onCheckedChange={(v) => setStatus([c], v)}
                            aria-label={c.status ? t("commerce:coupons.list.disableCode", { code: c.code }) : t("commerce:coupons.list.enableCode", { code: c.code })} className="mr-1 self-center" />
                          <WithTooltip content={t("commerce:coupons.list.copyCode", { code: c.code })}><Button type="button" variant="outline" size="icon" aria-label={t("commerce:coupons.list.copyCode", { code: c.code })} onClick={() => copyCode(c.code)}><Copy className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={t("commerce:coupons.list.editCode", { code: c.code })}><Button type="button" variant="outline" size="icon" aria-label={t("commerce:coupons.list.editCode", { code: c.code })} onClick={() => openForm(c)}><Pencil className="size-4" /></Button></WithTooltip>
                          <DropdownMenu>
                            <WithTooltip content={t("commerce:coupons.list.moreFor", { code: c.code })}><DropdownMenuTrigger asChild>
                              <Button type="button" variant="outline" size="icon" aria-label={t("commerce:coupons.list.moreFor", { code: c.code })}><MoreHorizontal className="size-4" /></Button>
                            </DropdownMenuTrigger></WithTooltip>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setStatus([c], !c.status)}>{c.status ? t("commerce:coupons.list.disable") : t("commerce:coupons.list.enable")}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTargets([c])}>{t("commerce:coupons.list.deleteCoupon")}</DropdownMenuItem>
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
            <DialogTitle>{editing ? t("commerce:coupons.form.editTitle") : t("commerce:coupons.form.newTitle")}</DialogTitle>
            <DialogDescription>{t("commerce:coupons.form.description")}</DialogDescription>
          </DialogHeader>
          <Separator />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <Card className="gap-2 px-4 py-3.5" aria-label={t("commerce:coupons.form.preview")}>
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-base font-semibold">{form.campaign_name || t("commerce:coupons.form.campaignPlaceholder")}</span>
                <span className="text-lg font-bold tabular-nums">{pvDisc}</span>
                <span className="text-xs text-muted-foreground">{pvCond}</span>
              </div>
              <Separator />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t("commerce:coupons.form.codeTag")}</span>
                <span className="font-mono text-sm font-bold tracking-widest">{form.code.toUpperCase() || "—"}</span>
              </div>
            </Card>

            <FormField label={t("commerce:coupons.form.campaignLabel")} htmlFor="coupon-campaign" className="min-w-0">
              <Input id="coupon-campaign" placeholder={t("commerce:coupons.form.campaignExample")} value={form.campaign_name} onChange={(e) => set("campaign_name", e.target.value)} autoFocus />
            </FormField>

            <FormField label={t("commerce:coupons.form.codeLabel")} htmlFor="coupon-code" className="min-w-0">
              <span className="flex gap-2">
                <Input id="coupon-code" className="font-mono uppercase tracking-wide" placeholder="EID25" value={form.code}
                  onChange={(e) => set("code", e.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase())} />
                <Button type="button" variant="outline" onClick={() => set("code", genCode())} className="shrink-0">{t("commerce:coupons.form.generate")}</Button>
              </span>
            </FormField>

            <FormField label={t("commerce:coupons.form.typeLabel")}>
              <SegmentedControl
                aria-label={t("commerce:coupons.form.typeLabel")}
                size="default"
                className="w-full"
                value={form.type}
                onValueChange={(v) => set("type", v as CType)}
                options={TYPES.map((o) => ({ value: o.value, label: t(o.label) }))}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-2.5">
              {form.type !== "free_shipping" && (
                <FormField label={form.type === "percentage" ? t("commerce:coupons.form.percentLabel") : t("commerce:coupons.form.amountLabel")} htmlFor="coupon-discount" className="min-w-0">
                  <Input id="coupon-discount" type="number" min={0} max={form.type === "percentage" ? 100 : undefined} step="0.01" value={form.discount} onChange={(e) => set("discount", e.target.value)} />
                </FormField>
              )}
              <FormField label={t("commerce:coupons.form.minOrder")} htmlFor="coupon-min" className="min-w-0">
                <Input id="coupon-min" type="number" min={0} step="0.01" placeholder={t("commerce:coupons.form.minPlaceholder")} value={form.min_order_amount} onChange={(e) => set("min_order_amount", e.target.value)} />
              </FormField>
              {form.type === "percentage" && (
                <FormField label={t("commerce:coupons.form.maxDiscount")} htmlFor="coupon-max" className="min-w-0">
                  <Input id="coupon-max" type="number" min={0} step="0.01" placeholder={t("commerce:coupons.form.noCap")} value={form.max_discount} onChange={(e) => set("max_discount", e.target.value)} />
                </FormField>
              )}
              <FormField label={t("commerce:coupons.form.totalUses")} htmlFor="coupon-uses" className="min-w-0">
                <Input id="coupon-uses" type="number" min={editing?.timesUsed || 1} step="1" placeholder={t("commerce:coupons.form.unlimited")} value={form.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <FormField label={t("commerce:coupons.form.starts")} htmlFor="coupon-start" className="min-w-0">
                <Input id="coupon-start" type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
              </FormField>
              <FormField
                label={t("commerce:coupons.form.ends")} htmlFor="coupon-end" className="min-w-0"
                description={form.end_date ? t("commerce:coupons.form.endsHelp") : t("commerce:coupons.form.noEndHelp")}
              >
                <Input id="coupon-end" type="date" min={form.start_date || undefined} value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />
              </FormField>
            </div>

            <FormField label={t("commerce:coupons.form.appliesTo")}>
              <SegmentedControl
                aria-label={t("commerce:coupons.form.appliesTo")}
                size="default"
                className="w-full"
                value={form.appliesTo}
                onValueChange={(v) => { const id = v as FormState["appliesTo"]; setForm((f) => ({ ...f, appliesTo: id, categoryIds: [], productIds: [] })); setPickQ("") }}
                options={[{ value: "all", label: t("commerce:coupons.form.everything") }, { value: "categories", label: t("commerce:coupons.form.categories") }, { value: "products", label: t("commerce:coupons.form.products") }]}
              />
              {form.appliesTo !== "all" && (
                <div className="flex items-center gap-2">
                  <Input type="search" aria-label={form.appliesTo === "categories" ? t("commerce:coupons.form.filterCategories") : t("commerce:coupons.form.filterProducts")} placeholder={form.appliesTo === "categories" ? t("commerce:coupons.form.filterCategories") : t("commerce:coupons.form.filterProducts")} value={pickQ} onChange={(e) => setPickQ(e.target.value)}
                    className="min-w-0 flex-1" />
                  <Badge variant="secondary" className="shrink-0">
                    {t("common:table.selected", { count: (form.appliesTo === "categories" ? form.categoryIds : form.productIds).length })}
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
                <FieldLabel htmlFor="coupon-ch-pos">{t("commerce:coupons.form.worksPos")}</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-ch-online" checked={form.channelOnline} onCheckedChange={(v) => set("channelOnline", v === true)} />
                <FieldLabel htmlFor="coupon-ch-online">{t("commerce:coupons.form.worksOnline")}</FieldLabel>
              </Field>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-active" checked={form.status} onCheckedChange={(v) => set("status", v === true)} />
                <FieldLabel htmlFor="coupon-active">{t("common:status.active")}</FieldLabel>
              </Field>
              <Field orientation="horizontal" className="w-auto">
                <Checkbox id="coupon-once" checked={form.oncePerCustomer} onCheckedChange={(v) => set("oncePerCustomer", v === true)} />
                <FieldLabel htmlFor="coupon-once">{t("commerce:coupons.form.onePerCustomer")}</FieldLabel>
              </Field>
            </div>

            <FormField label={t("commerce:coupons.form.image")} htmlFor="coupon-image">
              <div className="flex items-center gap-3">
                {imagePreview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt={t("commerce:coupons.form.preview")} className="size-14 rounded-lg border object-cover" />
                )}
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImagePlus className="size-4" aria-hidden /> {imagePreview ? t("commerce:coupons.form.changeImage") : t("commerce:coupons.form.uploadImage")}
                </Button>
                <Input id="coupon-image" ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </FormField>
          </div>

          <Separator />
          <DialogFooter className="flex flex-row flex-wrap justify-end gap-2 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("commerce:coupons.form.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteTargets.length > 0} onOpenChange={(o) => !o && setDeleteTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTargets.length === 1 ? deleteTargets[0].code : t("commerce:coupons.remove.many", { count: deleteTargets.length }) })}</AlertDialogTitle>
            <AlertDialogDescription>{t("commerce:coupons.remove.desc", { count: deleteTargets.length })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting} className={buttonVariants({ variant: "destructive" })}>
              {deleting ? t("commerce:coupons.remove.deleting") : t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
