"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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

type Tab = "all" | "Active" | "owe" | "Inactive" | "Blocked"
type Sort = "purchased" | "owed" | "name" | "recent"
type Panel = "profile" | "form"

const SORTS: { value: Sort; label: string }[] = [
  { value: "purchased", label: "Sort: Most purchased" },
  { value: "owed", label: "Sort: Most owed" },
  { value: "name", label: "Sort: Name A–Z" },
  { value: "recent", label: "Sort: Recently added" },
]

const TERMS = ["Pay on delivery", "Net 7 days", "Net 15 days", "Net 30 days", "Advance"]
const PAY_TO = ["Bank transfer", "bKash merchant", "Nagad", "Cash"]
const DISTRICTS = ["Dhaka", "Narayanganj", "Gazipur", "Chattogram"]
const COUNTRIES = ["Bangladesh", "India", "China", "Other"]
const PAY_METHODS = ["Cash", "Bank transfer", "bKash", "Nagad"]

const PO_STATUS: Record<string, string> = { draft: "Draft", sent: "Ordered", partial: "Partly received", received: "Received", cancelled: "Cancelled" }
const PAY_LABEL: Record<string, string> = { paid: "paid", partial: "partly paid", pending: "unpaid", unpaid: "unpaid" }

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
    if (!form.name.trim()) { setFormError("Supplier name is required."); return }
    const dupe = rows.find((r) => r.id !== editingId && r.name.trim().toLowerCase() === form.name.trim().toLowerCase())
    if (dupe) { setFormError(`A supplier named "${dupe.name}" already exists.`); return }
    if (form.leadTimeDays !== "" && (!Number.isInteger(Number(form.leadTimeDays)) || Number(form.leadTimeDays) < 0)) { setFormError("Lead time must be a whole number of days, zero or more."); return }
    if (form.openingBalance !== "" && !(Number(form.openingBalance) >= 0)) { setFormError("Opening balance cannot be negative."); return }
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setFormError("Enter a valid email address."); return }
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
        toast({ title: "Supplier updated", description: body.name })
        await refresh(editingId)
        setPanel("profile")
      } else {
        const res = await vendorApi.create(body)
        toast({ title: "Supplier added", description: body.name })
        await load()
        select(res.data.id)
      }
    } catch (e: any) {
      setFormError(e?.response?.data?.message || "Could not save the supplier.")
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
      toast({ variant: "destructive", title: "Could not change status", description: e?.response?.data?.message })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await vendorApi.delete(deleteTarget.id)
      toast({ title: "Supplier deleted", description: deleteTarget.name })
      const wasSelected = deleteTarget.id === selectedId
      setDeleteTarget(null)
      if (wasSelected) { setSelectedId(null); setProfile(null) }
      await load()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not delete", description: e?.response?.data?.message })
      setDeleteTarget(null)
    }
  }

  const savePayment = async () => {
    if (!selectedId || !profile) return
    const amount = Number(payAmount)
    if (!(amount > 0)) { setPayError("Enter an amount above zero."); return }
    if (amount > profile.owed + 0.005) { setPayError(`You only owe ${formatCurrency(profile.owed)} to this supplier.`); return }
    setPaying(true); setPayError("")
    try {
      setProfile(await vendorApi.recordPayment(selectedId, { amount, method: payMethod, note: payNote.trim() || undefined }))
      await load()
      toast({ title: "Payment recorded", description: formatCurrency(amount) })
      setPayOpen(false); setPayAmount(""); setPayNote("")
    } catch (e: any) {
      setPayError(e?.response?.data?.message || "Could not record the payment.")
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
    toast({ title: `Exported ${data.length} suppliers` })
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
            title: `Imported ${created} supplier${created === 1 ? "" : "s"}`,
            description: [skipped && `${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`, failed && `${failed} row${failed === 1 ? "" : "s"} rejected`].filter(Boolean).join(", ") || undefined,
          })
          load()
        } catch {
          toast({ variant: "destructive", title: "Could not read the CSV file" })
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
        title="Suppliers"
        description="Who you buy from, what you owe them, and what is on order."
        actions={<>
          <Button type="button" variant="outline" onClick={handleImport}><Upload className="size-4" aria-hidden /> Import</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          <Button asChild variant="outline"><Link href={poHref()}>New purchase order</Link></Button>
          <Button type="button" onClick={openNew}>
            <Plus className="size-4" aria-hidden /> Add supplier
          </Button>
        </>}
      />

      {/* Owe banner */}
      {stats && stats.totalOwed > 0 && (
        <Alert variant="destructive">
          <Clock aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3.5">
            <span className="min-w-[260px] flex-1">
              <strong>You owe {owedSuppliers === 1 ? (rows.find((r) => r.owed > 0.005)?.name ?? "1 supplier") : `${owedSuppliers} suppliers`} {formatCurrency(stats.totalOwed)}.</strong>
              {stats.oldestOverdue
                ? ` ${stats.oldestOverdue.poNumber} was expected on ${new Date(stats.oldestOverdue.expectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} and is still unpaid.`
                : " No purchase order is past its expected date."}
            </span>
            <Button asChild variant="destructive" size="sm">
              <Link href="/dashboard/vendors/purchase-orders">Open purchase order</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPIs */}
      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-[118px]" />)}
        </div>
      ) : (
        <StatsCards stats={[
          { label: "Suppliers", value: stats.total, icon: <Truck className="size-4" />, color: "blue", hint: `${stats.active} active · ${stats.blocked} blocked` },
          { label: "You owe suppliers", value: formatCurrency(stats.totalOwed), icon: <Clock className="size-4" />, color: "red",
            hint: `${stats.owedSuppliers} supplier${stats.owedSuppliers === 1 ? "" : "s"} · ${stats.overdueSuppliers} overdue`,
            onClick: () => { setTab("owe"); setPage(1) }, active: tab === "owe" },
          { label: "Total purchased", value: formatCurrency(stats.totalPurchased), icon: <Banknote className="size-4" />, color: "green",
            hint: `${stats.poCount} purchase order${stats.poCount === 1 ? "" : "s"} · ${stats.openPos} open` },
          { label: "Paid to suppliers", value: formatCurrency(stats.totalPaid), icon: <Wallet className="size-4" />, color: "green",
            hint: `${stats.paymentCount} payment${stats.paymentCount === 1 ? "" : "s"}` },
          { label: "Open purchase orders", value: stats.openPos, icon: <ClipboardList className="size-4" />, color: "yellow",
            hint: `${stats.draftPos} draft · ${stats.orderedPos} ordered` },
          { label: "Avg lead time", value: stats.avgLeadDays ? `${Math.round(stats.avgLeadDays)} days` : "—", icon: <Truck className="size-4" />, color: "purple",
            hint: "Order to delivery" },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        {/* List */}
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs
              value={tab}
              onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={[
                { value: "all", label: "All", count: counts.all },
                { value: "Active", label: "Active", count: counts.Active },
                { value: "owe", label: "You owe", count: counts.owe },
                { value: "Inactive", label: "Inactive", count: counts.Inactive },
                { value: "Blocked", label: "Blocked", count: counts.Blocked },
              ]}
            />
          </div>
          <Toolbar className="gap-2.5 p-4">
            <InputGroup className="min-w-[220px] flex-1">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput
                type="search"
                aria-label="Search suppliers"
                placeholder="Search supplier, contact, phone, TIN/BIN or description…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              />
            </InputGroup>
            <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
              <SelectTrigger aria-label="Sort" className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>{SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Toolbar>

          <div className="overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">Supplier</TableHead>
                  <TableHead scope="col">Contact</TableHead>
                  <TableHead scope="col">Supplies</TableHead>
                  <TableHead scope="col" className="text-right">Purchased</TableHead>
                  <TableHead scope="col" className="text-right">You owe</TableHead>
                  <TableHead scope="col">Terms</TableHead>
                  <TableHead scope="col">Active</TableHead>
                  <TableHead scope="col" className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>)
                ) : pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <EmptyState icon={Truck} title="No suppliers found" description={search || tab !== "all" ? "Try clearing the search or tab." : "Add your first supplier to start buying stock."} className="p-4 md:p-6" />
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
                                {r.status !== "Active" && <StatusBadge status={r.status} className="ml-1.5" />}
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
                          <div className="text-xs text-muted-foreground">Lead time {r.leadTimeDays ? `${r.leadTimeDays} days` : "—"}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(r.purchased)}
                          <div className="text-xs font-normal text-muted-foreground">{r.poCount} PO{r.poCount === 1 ? "" : "s"}</div>
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", r.owed > 0.005 ? "text-destructive" : "text-muted-foreground")}>
                          {formatCurrency(r.owed)}
                        </TableCell>
                        <TableCell>
                          {r.paymentTerms ? <Badge variant="secondary">{r.paymentTerms}</Badge> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={r.status === "Active"} aria-label={`${r.name} active`}
                            onCheckedChange={() => toggleActive(r)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="link" size="sm" className="mr-1"><Link href={poHref(r.id)}>New PO</Link></Button>
                            <Button type="button" variant="outline" size="icon" aria-label={`Record payment to ${r.name}`}
                              onClick={() => { select(r.id); setPayOpen(true) }}><Banknote className="size-4" /></Button>
                            <Button type="button" variant="outline" size="icon" aria-label={`Edit ${r.name}`} onClick={() => openEdit(r)}><Pencil className="size-4" /></Button>
                            <Button type="button" variant="outline" size="icon" aria-label={`Delete ${r.name}`} onClick={() => setDeleteTarget(r)}><Trash2 className="size-4" /></Button>
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
          <div className="px-4 py-3 text-xs text-muted-foreground">Showing {visible.length} supplier{visible.length === 1 ? "" : "s"}</div>
        </Card>

        {/* Side panel */}
        <aside aria-label="Supplier" className="w-full shrink-0 xl:w-[400px]">
          <Card className="gap-4 p-4">
          <Tabs value={panel} onValueChange={() => { /* handled per trigger below */ }}>
            <TabsList aria-label="Panel" className="w-full">
              {([["profile", "Supplier details"], ["form", editingId ? "Edit supplier" : "+ New supplier"]] as const).map(([id, label]) => (
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
              <EmptyState title={rows.length ? "Pick a supplier to see their details." : "No suppliers yet. Add one with the New supplier tab."} className="p-4 md:p-6" />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <UserAvatar name={profile.vendor.name} shape="square" className="size-12" />
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight">
                      {profile.vendor.name}{" "}
                      <StatusBadge status={profile.vendor.status} className="align-middle" />
                    </h2>
                    <span className="text-sm text-muted-foreground">{place(profile.vendor) || "—"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["Purchased", formatCurrency(profile.purchased), false],
                    ["Open POs", String(profile.openPos), false],
                    ["You owe", formatCurrency(profile.owed), profile.owed > 0.005],
                    ["Total paid", formatCurrency(profile.totalPaid), false],
                    ["Products", String(profile.productCount), false],
                    ["Stock value", formatCurrency(profile.stockValue), false],
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
                  <Button asChild className="flex-1"><Link href={poHref(profile.vendor.id)}>New purchase order</Link></Button>
                  <Button type="button" variant="outline" onClick={() => { setPayOpen((v) => !v); setPayError("") }} className="flex-1">Pay supplier</Button>
                </div>

                {payOpen && (
                  <Card className="gap-2.5 p-3.5">
                    <CardTitle className="text-sm">Record payment to {profile.vendor.name}</CardTitle>
                    {payError && <Alert variant="destructive"><AlertDescription>{payError}</AlertDescription></Alert>}
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label="Amount" htmlFor="sup-pay-amount"><Input id="sup-pay-amount" type="number" min="0" step="any" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" /></FormField>
                      <FormField label="Method" htmlFor="sup-pay-method">
                        <Select value={payMethod} onValueChange={(v) => setPayMethod(v)}>
                          <SelectTrigger id="sup-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                    </div>
                    <FormField label="Note" htmlFor="sup-pay-note"><Input id="sup-pay-note" type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Optional" /></FormField>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
                      <Button type="button" disabled={paying} onClick={savePayment}>{paying ? "Saving…" : "Save payment"}</Button>
                    </div>
                  </Card>
                )}

                <Separator />
                <InfoList>
                  {([
                    ["Supplies", selectedRow.itemsSummary],
                    ["Contact", profile.vendor.contactPerson],
                    ["Phone", profile.vendor.phone],
                    ["Email", profile.vendor.email],
                    ["Address", [profile.vendor.address, place(profile.vendor)].filter(Boolean).join(", ")],
                    ["Payment terms", profile.vendor.paymentTerms || "Not set"],
                    ["Pay to", [profile.vendor.payTo, profile.vendor.accountNumber].filter(Boolean).join(" · ")],
                    ["TIN / BIN", profile.vendor.tin],
                    ["Opening balance", profile.vendor.openingBalance ? formatCurrency(profile.vendor.openingBalance) : ""],
                    ["Description", profile.vendor.description],
                    ["Supplier since", (profile.vendor.createdAt || profile.vendor.created_at) ? new Date((profile.vendor.createdAt || profile.vendor.created_at) as string).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : ""],
                  ] as [string, string | null | undefined][]).map(([k, v]) => (
                    <InfoRow key={k} label={k} value={v || "—"} />
                  ))}
                </InfoList>

                <Separator />
                <section>
                  <SectionTitle className="mb-2">Recent purchase orders</SectionTitle>
                  {profile.recentPurchaseOrders.length === 0 ? <p className="text-sm text-muted-foreground">No purchase orders yet.</p> : (
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
                                  {PO_STATUS[o.status] ?? o.status} · {o.isOverdue ? "overdue" : PAY_LABEL[o.paymentStatus] ?? o.paymentStatus}
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
                  <SectionTitle className="mb-2">Products supplied</SectionTitle>
                  {profile.products.length === 0 ? <p className="text-sm text-muted-foreground">No products ordered from this supplier yet.</p> : (
                    <ItemGroup>
                      {profile.products.map((g, i) => (
                        <Fragment key={g.productId}>
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-1">
                            <ItemContent className="min-w-0">
                              <ItemTitle className="truncate">{g.name}</ItemTitle>
                              <ItemDescription className="text-xs">Last cost {formatCurrency(g.lastCost)}</ItemDescription>
                            </ItemContent>
                            <ItemActions className="flex-col items-end gap-0">
                              <span className="text-sm font-medium tabular-nums">{g.stock} in stock</span>
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
                  <SectionTitle className="mb-2">Payments made</SectionTitle>
                  {profile.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments recorded yet.</p> : (
                    <ItemGroup>
                      {profile.payments.map((y, i) => (
                        <Fragment key={y.id}>
                          {i > 0 && <ItemSeparator />}
                          <Item size="sm" className="px-1">
                            <ItemContent>
                              <ItemTitle>{new Date(y.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</ItemTitle>
                              <ItemDescription className="text-xs">{[y.method, y.poNumber, y.note].filter(Boolean).join(" · ")}</ItemDescription>
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
                <h2 className="text-lg font-semibold">{editingId ? "Edit supplier" : "New supplier"}</h2>
                <p className="text-sm text-muted-foreground">Only the name is required.</p>
                {formError && <Alert variant="destructive" className="mt-2"><AlertDescription>{formError}</AlertDescription></Alert>}
              </div>
              <FormField label="Supplier / company name *" htmlFor="sup-name"><Input id="sup-name" value={form.name} onChange={set("name")} placeholder="e.g. Dhaka Textiles Ltd." /></FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Contact person" htmlFor="sup-contact"><Input id="sup-contact" value={form.contactPerson} onChange={set("contactPerson")} placeholder="e.g. Md. Rafiq" /></FormField>
                <FormField label="Phone" htmlFor="sup-phone">
                  <InputGroup>
                    <InputGroupAddon><InputGroupText>+880</InputGroupText></InputGroupAddon>
                    <InputGroupInput id="sup-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="17XX-XXXXXX" />
                  </InputGroup>
                </FormField>
              </div>
              <FormField label="Email" htmlFor="sup-email"><Input id="sup-email" type="email" value={form.email} onChange={set("email")} placeholder="supplier@example.com" /></FormField>
              <FormField label="Address" htmlFor="sup-address"><Input id="sup-address" value={form.address} onChange={set("address")} placeholder="Street, area" /></FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="District" htmlFor="sup-district">
                  <Select value={toSel(form.district)} onValueChange={setSel("district")}>
                    <SelectTrigger id="sup-district" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem>{DISTRICTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
                <FormField label="Country" htmlFor="sup-country">
                  <Select value={toSel(form.country)} onValueChange={setSel("country")}>
                    <SelectTrigger id="sup-country" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem>{COUNTRIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <Card className="gap-0 py-0">
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="ghost" className="group w-full justify-between">
                      Payment &amp; terms
                      <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="flex flex-col gap-3 px-3.5 pt-1 pb-3.5">
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label="Payment terms" htmlFor="sup-terms">
                        <Select value={toSel(form.paymentTerms)} onValueChange={setSel("paymentTerms")}>
                          <SelectTrigger id="sup-terms" className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value={NONE}>Not set</SelectItem>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </FormField>
                      <FormField label="Lead time (days)" htmlFor="sup-lead"><Input id="sup-lead" type="number" min="0" step="1" value={form.leadTimeDays} onChange={set("leadTimeDays")} placeholder="e.g. 5" /></FormField>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <FormField label="Opening balance (৳ you owe)" htmlFor="sup-opening"><Input id="sup-opening" type="number" min="0" value={form.openingBalance} onChange={set("openingBalance")} placeholder="0.00" /></FormField>
                      <FormField label="TIN / BIN" htmlFor="sup-tin"><Input id="sup-tin" value={form.tin} onChange={set("tin")} placeholder="Optional" /></FormField>
                    </div>
                    <FormField label="Pay to" htmlFor="sup-payto">
                      <Select value={toSel(form.payTo)} onValueChange={setSel("payTo")}>
                        <SelectTrigger id="sup-payto" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>—</SelectItem>{PAY_TO.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Account / wallet number" htmlFor="sup-account"><Input id="sup-account" value={form.accountNumber} onChange={set("accountNumber")} placeholder="e.g. 01XXXXXXXXX" /></FormField>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
              <FormField label="Description" htmlFor="sup-desc"><Input id="sup-desc" value={form.description} onChange={set("description")} placeholder="What they supply, in a line" /></FormField>
              <FormField label="Notes" htmlFor="sup-notes">
                <Textarea id="sup-notes" rows={2} value={form.notes} onChange={set("notes")} placeholder="Minimum order, delivery days…" />
              </FormField>
              <FormField label="Status" htmlFor="sup-status" description="Only active suppliers can be picked on new purchase orders.">
                <Select value={form.status} onValueChange={setSel("status")}>
                  <SelectTrigger id="sup-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Blocked">Blocked</SelectItem></SelectContent>
                </Select>
              </FormField>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setPanel("profile")}>Cancel</Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : editingId ? "Save changes" : "Add supplier"}
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
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The supplier is removed from your list. Past purchase orders stay on record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
