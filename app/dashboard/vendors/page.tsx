"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Banknote, ChevronDown, ClipboardList, Clock, Download, Pencil, Plus, Search, Trash2, Truck, Upload, Wallet } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionTitle } from "@/components/common/SectionTitle"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Toolbar } from "@/components/common/Toolbar"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { UserAvatar } from "@/components/common/UserAvatar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import vendorApi, {
  type VendorOverviewRow, type VendorOverviewStats, type VendorProfile, type CreateVendorData,
} from "@/lib/vendorApi"
import { exportToCSV, parseCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"
import { localeTag } from "@/lib/i18n"

type Tab = "all" | "Active" | "owe" | "Inactive" | "Blocked"
type Sort = "purchased" | "owed" | "name" | "recent"
type Panel = "profile" | "form"

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

const SORTS: { value: Sort; label: K }[] = [
  { value: "purchased", label: "inventory:suppliers.sort.purchased" },
  { value: "owed", label: "inventory:suppliers.sort.owed" },
  { value: "name", label: "inventory:suppliers.sort.name" },
  { value: "recent", label: "inventory:suppliers.sort.recent" },
]

// Option values are saved as-is on the supplier; only the shown label is translated
const TERMS = ["Pay on delivery", "Net 7 days", "Net 15 days", "Net 30 days", "Advance"]
const PAY_TO = ["Bank transfer", "bKash merchant", "Nagad", "Cash"]
const DISTRICTS = ["Dhaka", "Narayanganj", "Gazipur", "Chattogram"]
const COUNTRIES = ["Bangladesh", "India", "China", "Other"]
const PAY_METHODS = ["Cash", "Bank transfer", "bKash", "Nagad"]

/** Stored option / status value → label key (unknown values are shown as-is). */
const OPTION_KEY: Record<string, K> = {
  "Pay on delivery": "inventory:suppliers.terms.payOnDelivery",
  "Net 7 days": "inventory:suppliers.terms.net7",
  "Net 15 days": "inventory:suppliers.terms.net15",
  "Net 30 days": "inventory:suppliers.terms.net30",
  Advance: "inventory:suppliers.terms.advance",
  "Bank transfer": "inventory:suppliers.payMethod.bankTransfer",
  "bKash merchant": "inventory:suppliers.payMethod.bkashMerchant",
  bKash: "inventory:suppliers.payMethod.bkash",
  Nagad: "inventory:suppliers.payMethod.nagad",
  Cash: "common:payment.cash",
  Dhaka: "inventory:suppliers.district.dhaka",
  Narayanganj: "inventory:suppliers.district.narayanganj",
  Gazipur: "inventory:suppliers.district.gazipur",
  Chattogram: "inventory:suppliers.district.chattogram",
  Bangladesh: "inventory:suppliers.country.bangladesh",
  India: "inventory:suppliers.country.india",
  China: "inventory:suppliers.country.china",
  Other: "common:extra.other",
}

const SUPPLIER_STATUS_KEY: Record<string, K> = {
  Active: "common:status.active",
  Inactive: "common:status.inactive",
  Blocked: "inventory:suppliers.status.blocked",
}

const PO_STATUS: Record<string, K> = {
  draft: "inventory:purchases.status.draft",
  sent: "inventory:purchases.status.sent",
  partial: "inventory:purchases.status.partial",
  received: "inventory:purchases.status.received",
  cancelled: "inventory:purchases.status.cancelled",
}
const PAY_LABEL: Record<string, K> = {
  paid: "inventory:suppliers.payState.paid",
  partial: "inventory:suppliers.payState.partial",
  pending: "inventory:suppliers.payState.unpaid",
  unpaid: "inventory:suppliers.payState.unpaid",
}

interface FormState {
  name: string; contactPerson: string; phone: string; email: string; address: string
  district: string; country: string; paymentTerms: string; leadTimeDays: string
  openingBalance: string; tin: string; payTo: string; accountNumber: string
  description: string; notes: string; status: string
}
const EMPTY_FORM: FormState = {
  name: "", contactPerson: "", phone: "", email: "", address: "", district: "", country: "",
  paymentTerms: "", leadTimeDays: "", openingBalance: "", tin: "", payTo: "", accountNumber: "",
  description: "", notes: "", status: "Active",
}

const NONE = "__none"
const toSel = (v: string) => v || NONE
const fromSel = (v: string) => (v === NONE ? "" : v)

export default function SuppliersPage() {
  const { t, i18n } = useTranslation(NS)
  const tag = localeTag(i18n.language)
  const opt = (v?: string | null) => (v && OPTION_KEY[v] ? t(OPTION_KEY[v]) : v ?? "")
  const statusLabel = (v: string) => (SUPPLIER_STATUS_KEY[v] ? t(SUPPLIER_STATUS_KEY[v]) : v)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const blocked = useModuleGuard("Vendors")

  const [rows, setRows] = useState<VendorOverviewRow[]>([])
  const [stats, setStats] = useState<VendorOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<Sort>("purchased")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [profile, setProfile] = useState<VendorProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [panel, setPanel] = useState<Panel>("profile")

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payNote, setPayNote] = useState("")
  const [payError, setPayError] = useState("")
  const [paying, setPaying] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<VendorOverviewRow | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await vendorApi.getOverview({ limit: 500, sort: "recent" })
      setRows(res.data)
      setStats(res.stats)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const loadProfile = useCallback(async (id: number) => {
    setProfileLoading(true)
    try {
      setProfile(await vendorApi.getProfile(id))
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const select = (id: number) => {
    setSelectedId(id)
    setPanel("profile")
    setPayOpen(false)
    loadProfile(id)
  }

  // First supplier opens in the panel by default; ?supplier=ID deep-links to one
  useEffect(() => {
    if (selectedId !== null || rows.length === 0) return
    const fromUrl = Number(searchParams.get("supplier"))
    const target = rows.find((r) => r.id === fromUrl) ?? rows[0]
    select(target.id)
  }, [rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async (id = selectedId) => {
    await load()
    if (id) await loadProfile(id)
  }

  const counts = {
    all: rows.length,
    Active: rows.filter((r) => r.status === "Active").length,
    owe: rows.filter((r) => r.owed > 0.005).length,
    Inactive: rows.filter((r) => r.status === "Inactive").length,
    Blocked: rows.filter((r) => r.status === "Blocked").length,
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = rows.filter((r) => {
      if (tab === "owe") { if (r.owed <= 0.005) return false }
      else if (tab !== "all" && r.status !== tab) return false
      if (!q) return true
      return [r.name, r.contactPerson, r.phone, r.email, r.description, r.tin].some((v) => (v ?? "").toLowerCase().includes(q))
    })
    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name)
      if (sort === "owed") return b.owed - a.owed
      if (sort === "recent") return b.id - a.id
      return b.purchased - a.purchased || a.name.localeCompare(b.name)
    })
    return list
  }, [rows, tab, search, sort])

  const pageRows = visible.slice((page - 1) * perPage, page * perPage)

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setFormError(""); setPanel("form") }
  const openEdit = (r: VendorOverviewRow) => {
    setForm({
      name: r.name ?? "", contactPerson: r.contactPerson ?? "", phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", district: r.district ?? "", country: r.country ?? "",
      paymentTerms: r.paymentTerms ?? "", leadTimeDays: r.leadTimeDays ? String(r.leadTimeDays) : "",
      openingBalance: r.openingBalance ? String(r.openingBalance) : "", tin: r.tin ?? "", payTo: r.payTo ?? "",
      accountNumber: r.accountNumber ?? "", description: r.description ?? "", notes: r.notes ?? "", status: r.status || "Active",
    })
    setEditingId(r.id); setFormError(""); setPanel("form")
  }
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))
  const setSel = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: fromSel(v) }))

  const save = async () => {
    if (!form.name.trim()) { setFormError(t("inventory:suppliers.validation.nameRequired")); return }
    const dupe = rows.find((r) => r.id !== editingId && r.name.trim().toLowerCase() === form.name.trim().toLowerCase())
    if (dupe) { setFormError(t("inventory:suppliers.validation.duplicate", { name: dupe.name })); return }
    if (form.leadTimeDays !== "" && (!Number.isInteger(Number(form.leadTimeDays)) || Number(form.leadTimeDays) < 0)) { setFormError(t("inventory:suppliers.validation.leadTime")); return }
    if (form.openingBalance !== "" && !(Number(form.openingBalance) >= 0)) { setFormError(t("inventory:suppliers.validation.openingBalance")); return }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError(t("inventory:suppliers.validation.email")); return }
    const body: CreateVendorData = {
      name: form.name.trim(),
      contactPerson: form.contactPerson.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      district: form.district,
      country: form.country,
      paymentTerms: form.paymentTerms,
      leadTimeDays: form.leadTimeDays === "" ? undefined : Number(form.leadTimeDays),
      openingBalance: form.openingBalance === "" ? 0 : Number(form.openingBalance),
      tin: form.tin.trim(),
      payTo: form.payTo,
      accountNumber: form.accountNumber.trim(),
      description: form.description.trim(),
      notes: form.notes.trim(),
      status: form.status,
    }
    setSaving(true)
    setFormError("")
    try {
      if (editingId) {
        await vendorApi.update(editingId, body)
        toast({ title: t("inventory:suppliers.toast.updated"), description: body.name })
        await refresh(editingId)
        setPanel("profile")
      } else {
        const res = await vendorApi.create(body)
        toast({ title: t("inventory:suppliers.toast.added"), description: body.name })
        await load()
        select(res.data.id)
      }
    } catch (e: any) {
      setFormError(e?.response?.data?.message || t("inventory:suppliers.validation.couldNotSave"))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (r: VendorOverviewRow) => {
    // Active -> Inactive; Inactive or Blocked -> Active
    const next = r.status === "Active" ? "Inactive" : "Active"
    try {
      await vendorApi.update(r.id, { status: next })
      await refresh(r.id === selectedId ? r.id : selectedId)
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inventory:suppliers.toast.statusFailed"), description: e?.response?.data?.message })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await vendorApi.delete(deleteTarget.id)
      toast({ title: t("inventory:suppliers.toast.deleted"), description: deleteTarget.name })
      const wasSelected = deleteTarget.id === selectedId
      setDeleteTarget(null)
      if (wasSelected) { setSelectedId(null); setProfile(null) }
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inventory:suppliers.toast.deleteFailed"), description: e?.response?.data?.message })
      setDeleteTarget(null)
    }
  }

  const savePayment = async () => {
    if (!selectedId || !profile) return
    const amount = Number(payAmount)
    if (!(amount > 0)) { setPayError(t("inventory:suppliers.pay.invalidAmount")); return }
    if (amount > profile.owed + 0.005) { setPayError(t("inventory:suppliers.pay.tooMuch", { amount: formatCurrency(profile.owed) })); return }
    setPaying(true); setPayError("")
    try {
      setProfile(await vendorApi.recordPayment(selectedId, { amount, method: payMethod, note: payNote.trim() || undefined }))
      await load()
      toast({ title: t("inventory:suppliers.pay.recorded"), description: formatCurrency(amount) })
      setPayOpen(false); setPayAmount(""); setPayNote("")
    } catch (e: any) {
      setPayError(e?.response?.data?.message || t("inventory:suppliers.pay.failed"))
    } finally {
      setPaying(false)
    }
  }

  const CSV_COLS = ["name", "contactPerson", "phone", "email", "address", "district", "country", "paymentTerms", "leadTimeDays", "openingBalance", "tin", "payTo", "accountNumber", "description", "notes", "status", "purchased", "owed"]

  const handleExport = () => {
    const data = visible.map((r) => ({
      name: r.name, contactPerson: r.contactPerson ?? "", phone: r.phone ?? "", email: r.email ?? "",
      address: r.address ?? "", district: r.district ?? "", country: r.country ?? "", paymentTerms: r.paymentTerms ?? "",
      leadTimeDays: r.leadTimeDays ?? "", openingBalance: r.openingBalance ?? 0, tin: r.tin ?? "", payTo: r.payTo ?? "",
      accountNumber: r.accountNumber ?? "", description: r.description ?? "", notes: r.notes ?? "", status: r.status,
      purchased: r.purchased, owed: r.owed,
    }))
    exportToCSV(data, "suppliers", CSV_COLS)
    toast({ title: t("inventory:suppliers.toast.exported", { count: data.length }) })
  }

  const handleImport = () => {
    const el = document.createElement("input")
    el.type = "file"
    el.accept = ".csv"
    el.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (ev) => {
        try {
          const parsed = parseCSV(ev.target?.result as string)
          const seen = new Set(rows.map((r) => r.name.trim().toLowerCase()))
          let created = 0, skipped = 0, failed = 0
          for (const row of parsed) {
            const name = row.name?.trim()
            if (!name) continue
            if (seen.has(name.toLowerCase())) { skipped++; continue }
            const lead = row.leadTimeDays?.trim()
            const open = row.openingBalance?.trim()
            if ((lead && !(Number(lead) >= 0)) || (open && !(Number(open) >= 0))) { failed++; continue }
            const st = ["Active", "Inactive", "Blocked"].find((x) => x.toLowerCase() === (row.status ?? "").trim().toLowerCase())
            try {
              await vendorApi.create({
                name, contactPerson: row.contactPerson, phone: row.phone, email: row.email, address: row.address,
                district: row.district, country: row.country, paymentTerms: row.paymentTerms,
                leadTimeDays: lead ? Math.round(Number(lead)) : undefined, openingBalance: open ? Number(open) : 0,
                tin: row.tin, payTo: row.payTo, accountNumber: row.accountNumber,
                description: row.description, notes: row.notes, status: st ?? "Active",
              })
              seen.add(name.toLowerCase())
              created++
            } catch { failed++ }
          }
          toast({
            title: t("inventory:suppliers.toast.imported", { count: created }),
            description: [skipped && t("inventory:suppliers.toast.skipped", { count: skipped }), failed && t("inventory:suppliers.toast.rejected", { count: failed })].filter(Boolean).join(", ") || undefined,
          })
          load()
        } catch {
          toast({ variant: "destructive", title: t("inventory:suppliers.toast.csvFailed") })
        }
      }
      reader.readAsText(file)
    }
    el.click()
  }

  if (blocked) return blocked

  const poHref = (id?: number) => `/dashboard/vendors/purchase-orders?new=1${id ? `&vendorId=${id}` : ""}`
  const owedSuppliers = stats?.owedSuppliers ?? 0
  const selectedRow = rows.find((r) => r.id === selectedId)
  const place = (r: { district?: string | null; country?: string | null }) => [r.district, r.country].filter(Boolean).join(", ")

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      {/* Header */}
      <PageHeader
        title={t("inventory:suppliers.title")}
        description={t("inventory:suppliers.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={handleImport}><Upload className="size-4" aria-hidden /> {t("common:actions.import")}</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>
          <Button asChild variant="outline"><Link href={poHref()}>{t("inventory:suppliers.newPo")}</Link></Button>
          <Button type="button" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> {t("inventory:suppliers.addSupplier")}
          </Button>
        </>}
      />

      {/* Owe banner */}
      {stats && stats.totalOwed > 0 && (
        <Alert variant="destructive">
          <Clock aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3.5">
            <span className="min-w-[260px] flex-1">
              <strong>
                {owedSuppliers === 1 && rows.find((r) => r.owed > 0.005)
                  ? t("inventory:suppliers.banner.oweOne", { name: rows.find((r) => r.owed > 0.005)?.name, amount: formatCurrency(stats.totalOwed) })
                  : t("inventory:suppliers.banner.oweMany", { count: owedSuppliers, amount: formatCurrency(stats.totalOwed) })}
              </strong>{" "}
              {stats.oldestOverdue
                ? t("inventory:suppliers.banner.overdue", { po: stats.oldestOverdue.poNumber, date: new Date(stats.oldestOverdue.expectedDate).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" }) })
                : t("inventory:suppliers.banner.noOverdue")}
            </span>
            <Button asChild variant="destructive" size="sm">
              <Link href="/dashboard/vendors/purchase-orders">{t("inventory:suppliers.banner.openPo")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: t("inventory:suppliers.kpi.suppliers"), value: stats.total, icon: <Truck className="size-4" />, color: "blue", hint: t("inventory:suppliers.kpi.suppliersHint", { active: stats.active, blocked: stats.blocked }) },
          { label: t("inventory:suppliers.kpi.youOwe"), value: formatCurrency(stats.totalOwed), icon: <Clock className="size-4" />, color: "red",
            hint: t("inventory:suppliers.kpi.youOweHint", { count: stats.owedSuppliers, overdue: stats.overdueSuppliers }),
            onClick: () => { setTab("owe"); setPage(1) }, active: tab === "owe" },
          { label: t("inventory:suppliers.kpi.totalPurchased"), value: formatCurrency(stats.totalPurchased), icon: <Banknote className="size-4" />, color: "green",
            hint: t("inventory:suppliers.kpi.totalPurchasedHint", { count: stats.poCount, open: stats.openPos }) },
          { label: t("inventory:suppliers.kpi.paid"), value: formatCurrency(stats.totalPaid), icon: <Wallet className="size-4" />, color: "green",
            hint: t("inventory:suppliers.kpi.paidHint", { count: stats.paymentCount }) },
          { label: t("inventory:suppliers.kpi.openPos"), value: stats.openPos, icon: <ClipboardList className="size-4" />, color: "yellow",
            hint: t("inventory:suppliers.kpi.openPosHint", { draft: stats.draftPos, ordered: stats.orderedPos }) },
          { label: t("inventory:suppliers.kpi.avgLead"), value: stats.avgLeadDays ? t("inventory:suppliers.days", { count: Math.round(stats.avgLeadDays) }) : "—", icon: <Truck className="size-4" />, color: "purple",
            hint: t("inventory:suppliers.kpi.avgLeadHint") },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        {/* List */}
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(v) => { setTab(v as Tab); setPage(1) }}
              tabs={[
                { value: "all", label: t("common:status.all"), count: counts.all },
                { value: "Active", label: t("common:status.active"), count: counts.Active },
                { value: "owe", label: t("inventory:suppliers.youOwe"), count: counts.owe },
                { value: "Inactive", label: t("common:status.inactive"), count: counts.Inactive },
                { value: "Blocked", label: t("inventory:suppliers.status.blocked"), count: counts.Blocked },
              ]}
            />
          </div>
          <Toolbar className="gap-2.5 p-4">
            <InputGroup className="min-w-[220px] flex-1">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label={t("inventory:suppliers.searchLabel")}
                placeholder={t("inventory:suppliers.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </InputGroup>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label={t("inventory:suppliers.sort.label")} className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.label)}</SelectItem>)}</SelectContent>
            </Select>
          </Toolbar>

          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t("common:extra.supplier")}</TableHead>
                  <TableHead scope="col">{t("inventory:suppliers.col.contact")}</TableHead>
                  <TableHead scope="col">{t("inventory:suppliers.col.supplies")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("inventory:suppliers.col.purchased")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("inventory:suppliers.youOwe")}</TableHead>
                  <TableHead scope="col">{t("inventory:suppliers.col.terms")}</TableHead>
                  <TableHead scope="col">{t("common:status.active")}</TableHead>
                  <TableHead scope="col" className="text-right">{t("common:fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>)
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState icon={Truck} title={t("inventory:suppliers.empty.title")} description={search || tab !== "all" ? t("inventory:suppliers.empty.filtered") : t("inventory:suppliers.empty.first")} className="p-4 md:p-6" />
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => {
                    const sel = r.id === selectedId
                    return (
                      <TableRow key={r.id} data-state={sel ? "selected" : undefined}>
                        <TableCell>
                          <Button type="button" variant="ghost" onClick={() => select(r.id)} className="h-auto justify-start gap-2.5 text-left">
                            <UserAvatar name={r.name} shape="square" className="size-9" />
                            <span className="flex flex-col">
                              <span className="font-medium">
                                {r.name}
                                {r.status !== "Active" && <StatusBadge status={r.status} label={statusLabel(r.status)} className="ml-1.5" />}
                              </span>
                              <span className="text-xs font-normal text-muted-foreground">{place(r) || "—"}</span>
                            </span>
                          </Button>
                        </TableCell>
                        <TableCell>
                          <div>{r.contactPerson || "—"}</div>
                          <div className="text-xs text-muted-foreground">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px] truncate">{r.itemsSummary || "—"}</div>
                          <div className="text-xs text-muted-foreground">{t("inventory:suppliers.leadTime", { value: r.leadTimeDays ? t("inventory:suppliers.days", { count: r.leadTimeDays }) : "—" })}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.purchased)}
                          <div className="text-xs font-normal text-muted-foreground">{t("inventory:suppliers.poCount", { count: r.poCount })}</div>
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", r.owed > 0.005 ? "text-destructive" : "text-muted-foreground")}>
                          {formatCurrency(r.owed)}
                        </TableCell>
                        <TableCell>
                          {r.paymentTerms ? <Badge variant="secondary">{opt(r.paymentTerms)}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={r.status === "Active"} aria-label={t("inventory:suppliers.activeToggle", { name: r.name })}
                            onCheckedChange={() => toggleActive(r)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="link" size="sm" className="mr-1"><Link href={poHref(r.id)}>{t("inventory:suppliers.newPoShort")}</Link></Button>
                            <WithTooltip content={t("inventory:suppliers.pay.title", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.pay.title", { name: r.name })}
                              onClick={() => { select(r.id); setPayOpen(true) }}><Banknote className="size-4" /></Button></WithTooltip>
                            <WithTooltip content={t("inventory:suppliers.editName", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.editName", { name: r.name })} onClick={() => openEdit(r)}><Pencil className="size-4" /></Button></WithTooltip>
                            <WithTooltip content={t("inventory:suppliers.deleteName", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.deleteName", { name: r.name })} onClick={() => setDeleteTarget(r)}><Trash2 className="size-4" /></Button></WithTooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && visible.length > 0 && (
            <>
              <Separator />
              <div className="p-4 pt-3">
                <PaginationControl
                  currentPage={page}
                  totalPages={Math.max(1, Math.ceil(visible.length / perPage))}
                  itemsPerPage={perPage}
                  totalItems={visible.length}
                  onPageChange={setPage}
                  onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
                />
              </div>
            </>
          )}
          <Separator />
          <div className="px-4 py-3 text-xs text-muted-foreground">{t("inventory:suppliers.showing", { count: visible.length })}</div>
        </Card>

        {/* Side panel */}
        <aside aria-label={t("common:extra.supplier")} className="w-full shrink-0 xl:w-[400px]">
          <Card className="gap-4 p-4">
          <Tabs value={panel} onValueChange={() => { /* handled per trigger below */ }}>
            <TabsList aria-label={t("inventory:suppliers.panel.label")} className="w-full">
              {([["profile", t("inventory:suppliers.panel.details")], ["form", editingId ? t("inventory:suppliers.panel.edit") : t("inventory:suppliers.panel.newTab")]] as const).map(([id, label]) => (
                <TabsTrigger
                  key={id} value={id}
                  onClick={() => (id === "form" && panel !== "form" ? openNew() : setPanel("profile"))}
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {panel === "profile" ? (
            profileLoading && !profile ? (
              <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : !profile || !selectedRow ? (
              <EmptyState title={rows.length ? t("inventory:suppliers.panel.pick") : t("inventory:suppliers.panel.none")} className="p-4 md:p-6" />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <UserAvatar name={profile.vendor.name} shape="square" className="size-12" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight">
                      {profile.vendor.name}{" "}
                      <StatusBadge status={profile.vendor.status} label={statusLabel(profile.vendor.status)} className="align-middle" />
                    </h2>
                    <span className="text-sm text-muted-foreground">{place(profile.vendor) || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    [t("inventory:suppliers.col.purchased"), formatCurrency(profile.purchased), false],
                    [t("inventory:suppliers.profile.openPos"), String(profile.openPos), false],
                    [t("inventory:suppliers.youOwe"), formatCurrency(profile.owed), profile.owed > 0.005],
                    [t("inventory:suppliers.profile.totalPaid"), formatCurrency(profile.totalPaid), false],
                    [t("common:fields.products"), String(profile.productCount), false],
                    [t("inventory:suppliers.profile.stockValue"), formatCurrency(profile.stockValue), false],
                  ] as [string, string, boolean][]).map(([l, v, warn]) => (
                    <Item key={l} variant="muted" size="sm" className={cn("px-2.5 py-2", warn && "text-destructive")}>
                      <ItemContent className="gap-0">
                        <ItemDescription className={cn("text-xs", warn && "text-destructive")}>{l}</ItemDescription>
                        <ItemTitle className="tabular-nums">{v}</ItemTitle>
                      </ItemContent>
                    </Item>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button asChild className="flex-1"><Link href={poHref(profile.vendor.id)}>{t("inventory:suppliers.newPo")}</Link></Button>
                  <Button type="button" variant="outline" onClick={() => { setPayOpen((v) => !v); setPayError("") }} className="flex-1">{t("inventory:suppliers.profile.paySupplier")}</Button>
                </div>

                {payOpen && (
                  <Card className="gap-2.5 p-3.5">
                    <CardTitle className="text-sm">{t("inventory:suppliers.pay.title", { name: profile.vendor.name })}</CardTitle>
                    {payError && <Alert variant="destructive"><AlertDescription>{payError}</AlertDescription></Alert>}
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label={t("common:money.amount")} htmlFor="sup-pay-amount"><Input id="sup-pay-amount" type="number" min="0" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" /></FormField>
                      <FormField label={t("inventory:suppliers.pay.method")} htmlFor="sup-pay-method">
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v)}>
                          <SelectTrigger id="sup-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{opt(m)}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                    </div>
                    <FormField label={t("common:fields.note")} htmlFor="sup-pay-note"><Input id="sup-pay-note" type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>{t("common:actions.cancel")}</Button>
                      <Button type="button" disabled={paying} onClick={savePayment}>{paying ? t("common:actions.saving") : t("inventory:suppliers.pay.save")}</Button>
                    </div>
                  </Card>
                )}

                <Separator />
                <InfoList>
                  {([
                    [t("inventory:suppliers.col.supplies"), selectedRow.itemsSummary],
                    [t("inventory:suppliers.col.contact"), profile.vendor.contactPerson],
                    [t("common:fields.phone"), profile.vendor.phone],
                    [t("common:fields.email"), profile.vendor.email],
                    [t("common:fields.address"), [profile.vendor.address, place(profile.vendor)].filter(Boolean).join(", ")],
                    [t("inventory:suppliers.form.paymentTerms"), profile.vendor.paymentTerms ? opt(profile.vendor.paymentTerms) : t("common:extra.notSet")],
                    [t("inventory:suppliers.form.payTo"), [opt(profile.vendor.payTo), profile.vendor.accountNumber].filter(Boolean).join(" · ")],
                    [t("inventory:suppliers.form.tin"), profile.vendor.tin],
                    [t("inventory:suppliers.profile.openingBalance"), profile.vendor.openingBalance ? formatCurrency(profile.vendor.openingBalance) : ""],
                    [t("common:fields.description"), profile.vendor.description],
                    [t("inventory:suppliers.profile.since"), (profile.vendor.createdAt || profile.vendor.created_at) ? new Date((profile.vendor.createdAt || profile.vendor.created_at) as string).toLocaleDateString(tag, { month: "short", year: "numeric" }) : ""],
                  ] as [string, string | null | undefined][]).map(([k, v]) => (
                    <InfoRow key={k} label={k} value={v || "—"} />
                  ))}
                </InfoList>

                <Separator />
                <section>
                  <SectionTitle className="mb-2">{t("inventory:suppliers.profile.recentPos")}</SectionTitle>
                  {profile.recentPurchaseOrders.length === 0 ? <p className="text-sm text-muted-foreground">{t("inventory:suppliers.profile.noPos")}</p> : (
                    <ItemGroup>
                      {profile.recentPurchaseOrders.map((o, i) => (
                        <Fragment key={o.id}>
                          {i > 0 && <ItemSeparator />}
                          <Item asChild size="sm" className="px-1">
                            <Link href="/dashboard/vendors/purchase-orders">
                              <ItemContent className="min-w-0">
                                <ItemTitle>{o.poNumber}</ItemTitle>
                                <ItemDescription className="truncate text-xs">{o.itemsSummary || "—"}</ItemDescription>
                              </ItemContent>
                              <ItemActions className="flex-col items-end gap-0">
                                <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</span>
                                <span className={cn("text-xs font-medium", o.isOverdue ? "text-destructive" : o.paymentStatus === "paid" ? "text-emerald-600" : "text-muted-foreground")}>
                                  {PO_STATUS[o.status] ? t(PO_STATUS[o.status]) : o.status} · {o.isOverdue ? t("inventory:suppliers.payState.overdue") : PAY_LABEL[o.paymentStatus] ? t(PAY_LABEL[o.paymentStatus]) : o.paymentStatus}
                                </span>
                              </ItemActions>
                            </Link>
                          </Item>
                        </Fragment>
                      ))}
                    </ItemGroup>
                  )}
                </section>

                <Separator />
                <section>
                  <SectionTitle className="mb-2">{t("inventory:suppliers.profile.productsSupplied")}</SectionTitle>
                  {profile.products.length === 0 ? <p className="text-sm text-muted-foreground">{t("inventory:suppliers.profile.noProducts")}</p> : (
                    <ItemGroup>
                      {profile.products.map((g, i) => (
                        <Fragment key={g.productId}>
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-1">
                            <ItemContent className="min-w-0">
                              <ItemTitle className="truncate">{g.name}</ItemTitle>
                              <ItemDescription className="text-xs">{t("inventory:suppliers.profile.lastCost", { amount: formatCurrency(g.lastCost) })}</ItemDescription>
                            </ItemContent>
                            <ItemActions className="flex-col items-end gap-0">
                              <span className="text-sm font-medium tabular-nums">{t("inventory:suppliers.profile.inStock", { count: g.stock })}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{formatCurrency(g.stockValue)}</span>
                            </ItemActions>
                          </Item>
                        </Fragment>
                      ))}
                    </ItemGroup>
                  )}
                </section>

                <Separator />
                <section>
                  <SectionTitle className="mb-2">{t("inventory:suppliers.profile.payments")}</SectionTitle>
                  {profile.payments.length === 0 ? <p className="text-sm text-muted-foreground">{t("inventory:suppliers.profile.noPayments")}</p> : (
                    <ItemGroup>
                      {profile.payments.map((y, i) => (
                        <Fragment key={y.id}>
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-1">
                            <ItemContent>
                              <ItemTitle>{new Date(y.date).toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric" })}</ItemTitle>
                              <ItemDescription className="text-xs">{[opt(y.method), y.poNumber, y.note].filter(Boolean).join(" · ")}</ItemDescription>
                            </ItemContent>
                            <ItemActions><span className="text-sm font-semibold tabular-nums">{formatCurrency(y.amount)}</span></ItemActions>
                          </Item>
                        </Fragment>
                      ))}
                    </ItemGroup>
                  )}
                </section>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold">{editingId ? t("inventory:suppliers.panel.edit") : t("inventory:suppliers.panel.new")}</h2>
                <p className="text-sm text-muted-foreground">{t("inventory:suppliers.form.onlyName")}</p>
                {formError && <Alert variant="destructive" className="mt-2"><AlertDescription>{formError}</AlertDescription></Alert>}
              </div>
              <FormField label={t("inventory:suppliers.form.name")} htmlFor="sup-name"><Input id="sup-name" value={form.name} onChange={set("name")} placeholder={t("inventory:suppliers.form.namePh")} /></FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:suppliers.form.contactPerson")} htmlFor="sup-contact"><Input id="sup-contact" value={form.contactPerson} onChange={set("contactPerson")} placeholder={t("inventory:suppliers.form.contactPh")} /></FormField>
                <FormField label={t("common:fields.phone")} htmlFor="sup-phone">
                  <InputGroup>
                    <InputGroupAddon><InputGroupText>+880</InputGroupText></InputGroupAddon>
                    <InputGroupInput id="sup-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="17XX-XXXXXX" />
                  </InputGroup>
                </FormField>
              </div>
              <FormField label={t("common:fields.email")} htmlFor="sup-email"><Input id="sup-email" type="email" value={form.email} onChange={set("email")} placeholder="supplier@example.com" /></FormField>
              <FormField label={t("common:fields.address")} htmlFor="sup-address"><Input id="sup-address" value={form.address} onChange={set("address")} placeholder={t("inventory:suppliers.form.addressPh")} /></FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:suppliers.form.district")} htmlFor="sup-district">
                  <Select value={toSel(form.district)} onValueChange={setSel("district")}>
                    <SelectTrigger id="sup-district" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem>{DISTRICTS.map((d) => <SelectItem key={d} value={d}>{opt(d)}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label={t("inventory:suppliers.form.country")} htmlFor="sup-country">
                  <Select value={toSel(form.country)} onValueChange={setSel("country")}>
                    <SelectTrigger id="sup-country" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{opt(c)}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <Card className="gap-0 py-0">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="group w-full justify-between">
                      {t("inventory:suppliers.form.paymentSection")}
                      <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label={t("inventory:suppliers.form.paymentTerms")} htmlFor="sup-terms">
                        <Select value={toSel(form.paymentTerms)} onValueChange={setSel("paymentTerms")}>
                          <SelectTrigger id="sup-terms" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value={NONE}>{t("common:extra.notSet")}</SelectItem>{TERMS.map((v) => <SelectItem key={v} value={v}>{opt(v)}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                      <FormField label={t("inventory:suppliers.form.leadTime")} htmlFor="sup-lead"><Input id="sup-lead" type="number" min="0" step="1" value={form.leadTimeDays} onChange={set("leadTimeDays")} placeholder={t("inventory:suppliers.form.leadTimePh")} /></FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label={t("inventory:suppliers.form.openingBalance")} htmlFor="sup-opening"><Input id="sup-opening" type="number" min="0" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" /></FormField>
                      <FormField label={t("inventory:suppliers.form.tin")} htmlFor="sup-tin"><Input id="sup-tin" value={form.tin} onChange={set("tin")} placeholder={t("common:status.optional")} /></FormField>
                    </div>
                    <FormField label={t("inventory:suppliers.form.payTo")} htmlFor="sup-payto">
                      <Select value={toSel(form.payTo)} onValueChange={setSel("payTo")}>
                        <SelectTrigger id="sup-payto" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>—</SelectItem>{PAY_TO.map((p) => <SelectItem key={p} value={p}>{opt(p)}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("inventory:suppliers.form.account")} htmlFor="sup-account"><Input id="sup-account" value={form.accountNumber} onChange={set("accountNumber")} placeholder={t("inventory:suppliers.form.accountPh")} /></FormField>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
              <FormField label={t("common:fields.description")} htmlFor="sup-desc"><Input id="sup-desc" value={form.description} onChange={set("description")} placeholder={t("inventory:suppliers.form.descriptionPh")} /></FormField>
              <FormField label={t("common:fields.notes")} htmlFor="sup-notes">
                <Textarea id="sup-notes" rows={2} value={form.notes} onChange={set("notes")} placeholder={t("inventory:suppliers.form.notesPh")} />
              </FormField>
              <FormField label={t("common:fields.status")} htmlFor="sup-status" description={t("inventory:suppliers.form.statusHelp")}>
                <Select value={form.status} onValueChange={setSel("status")}>
                  <SelectTrigger id="sup-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Active">{t("common:status.active")}</SelectItem><SelectItem value="Inactive">{t("common:status.inactive")}</SelectItem><SelectItem value="Blocked">{t("inventory:suppliers.status.blocked")}</SelectItem></SelectContent>
                </Select>
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPanel("profile")}>{t("common:actions.cancel")}</Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? t("common:actions.saving") : editingId ? t("common:actions.saveChanges") : t("inventory:suppliers.addSupplier")}
                </Button>
              </div>
            </div>
          )}
          </Card>
        </aside>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common:confirm.deleteTitle", { name: deleteTarget?.name })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("inventory:suppliers.deleteBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>{t("common:actions.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
