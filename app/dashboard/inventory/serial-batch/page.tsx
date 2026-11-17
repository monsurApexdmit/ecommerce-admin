"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { AlertTriangle, Download, Hash, Layers, Pencil, Search, Trash2, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { serialBatchApi, type ProductBatch, type ProductSerial, type SerialBatchStats } from "@/lib/serialBatchApi"
import { productApi } from "@/lib/productApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { Toolbar } from "@/components/common/Toolbar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"

type Tab = "batch" | "serial"

type BadgeVariant = "default" | "secondary" | "destructive" | "outline"

const SERIAL_VARIANT: Record<string, BadgeVariant> = {
  available: "default",
  sold: "secondary",
  returned: "outline",
  damaged: "destructive",
}

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

/** Serial status code → label key (codes stay as data). */
const SERIAL_KEY: Record<string, K> = {
  available: "inventory:stock.serial.status.available",
  sold: "inventory:stock.serial.status.sold",
  returned: "common:orderStatus.returned",
  damaged: "inventory:stock.reason.damaged",
}

const today = () => new Date().toISOString().slice(0, 10)

/** Expiry state of a batch: kind + days, shown via inventory:stock.serial.expiry.* */
function expiryInfo(b: ProductBatch): { kind: "ok" | "expired" | "soon"; days: number; variant: BadgeVariant } {
  if (!b.expiryDate) return { kind: "ok", days: 0, variant: "default" }
  const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 864e5)
  if (b.isExpired || days < 0) return { kind: "expired", days: Math.abs(days), variant: "destructive" }
  if (b.isExpiringSoon || days <= 30) return { kind: "soon", days, variant: "secondary" }
  return { kind: "ok", days, variant: "default" }
}

export default function SerialBatchPage() {
  const { t, i18n } = useTranslation(NS)
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "—")
  const expiryText = (b: ProductBatch) => {
    const e = expiryInfo(b)
    return e.kind === "expired" ? t("inventory:stock.serial.expiry.expired", { count: e.days }) : e.kind === "soon" ? t("inventory:stock.serial.expiry.soon", { count: e.days }) : t("inventory:stock.serial.expiry.ok")
  }
  const serialLabel = (s: string) => (SERIAL_KEY[s] ? t(SERIAL_KEY[s]) : s)
  const { warehouses } = useWarehouse()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [tab, setTab] = useState<Tab>("batch")
  const [stats, setStats] = useState<SerialBatchStats | null>(null)
  const [products, setProducts] = useState<any[]>([])

  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [serials, setSerials] = useState<ProductSerial[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qDebounced, setQDebounced] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // form
  const [editing, setEditing] = useState<{ type: Tab; id: number } | null>(null)
  const [fProduct, setFProduct] = useState("")
  const [fVariant, setFVariant] = useState("")
  const [fCode, setFCode] = useState("")
  const [fQty, setFQty] = useState("")
  const [fMfg, setFMfg] = useState("")
  const [fExpiry, setFExpiry] = useState("")
  const [fPo, setFPo] = useState("")
  const [fLoc, setFLoc] = useState("")
  const [fNotes, setFNotes] = useState("")
  const [serialText, setSerialText] = useState("")
  const [fReceived, setFReceived] = useState(today())
  const [fStatus, setFStatus] = useState("available")
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const id = setTimeout(() => setQDebounced(q.trim()), 250); return () => clearTimeout(id) }, [q])

  useEffect(() => {
    productApi.getAll({ limit: 500 }).then((r: any) => setProducts(r.data ?? [])).catch(() => {})
  }, [])
  useEffect(() => { setFLoc((l) => l || (warehouses[0] ? String(warehouses[0].id) : "")) }, [warehouses])

  const loadStats = useCallback(() => { serialBatchApi.getStats().then(setStats).catch(() => {}) }, [])
  useEffect(() => { loadStats() }, [loadStats])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, per_page: perPage }
      if (qDebounced) params.search = qDebounced
      if (statusF !== "all") params.status = statusF
      if (tab === "batch") {
        const r = await serialBatchApi.getBatches(params)
        setBatches(r.data); setTotal(r.total)
      } else {
        const r = await serialBatchApi.getSerials(params)
        setSerials(r.data); setTotal(r.total)
      }
    } catch {
      setBatches([]); setSerials([]); setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [tab, page, perPage, qDebounced, statusF])
  useEffect(() => { load() }, [load])

  const batchCount = stats?.batchCount ?? stats?.batches.total ?? 0
  const serialCount = stats?.serialCount ?? stats?.serials.total ?? 0
  const noRecords = !!stats && batchCount === 0 && serialCount === 0

  const changeTab = (v: string) => { setTab(v as Tab); setPage(1); setStatusF("all"); clearForm(); setQ("") }

  function clearForm() {
    setEditing(null); setFProduct(""); setFVariant(""); setFCode(""); setFQty(""); setFMfg(""); setFExpiry(""); setFPo("")
    setFNotes(""); setSerialText(""); setFReceived(today()); setFStatus("available"); setErr("")
  }

  const product = products.find((p) => String(p.id) === fProduct)
  const variants: any[] = product?.variants ?? []
  const serialLines = useMemo(() => Array.from(new Set(serialText.split("\n").map((s) => s.trim()).filter(Boolean))), [serialText])

  const editBatch = (b: ProductBatch) => {
    setTab("batch")
    setEditing({ type: "batch", id: b.id })
    setFProduct(String(b.productId)); setFVariant(b.variantId ? String(b.variantId) : "")
    setFCode(b.batchNumber); setFQty(String(b.quantityRemaining)); setFMfg(b.manufactureDate?.slice(0, 10) ?? "")
    setFExpiry(b.expiryDate?.slice(0, 10) ?? ""); setFPo(b.purchaseOrderNumber ?? ""); setFLoc(b.locationId ? String(b.locationId) : fLoc)
    setFNotes(b.notes ?? ""); setErr("")
  }
  const editSerial = (s: ProductSerial) => {
    setTab("serial")
    setEditing({ type: "serial", id: s.id })
    setFProduct(String(s.productId)); setFVariant(s.variantId ? String(s.variantId) : "")
    setSerialText(s.serialNumber); setFReceived(s.receivedDate?.slice(0, 10) ?? today()); setFPo(s.purchaseOrderNumber ?? "")
    setFLoc(s.locationId ? String(s.locationId) : fLoc); setFStatus(s.status); setFNotes(s.notes ?? ""); setErr("")
  }

  const save = async () => {
    if (!fProduct) { setErr(t("inventory:stock.serial.validation.product")); return }
    if (variants.length > 0 && !fVariant) { setErr(t("inventory:stock.serial.validation.variant")); return }
    setSaving(true); setErr("")
    try {
      if (tab === "batch") {
        if (!fCode.trim()) { setErr(t("inventory:stock.serial.validation.batchNo")); setSaving(false); return }
        const qty = Number(fQty)
        if (!Number.isInteger(qty) || fQty.trim() === "" || qty < (editing ? 0 : 1)) { setErr(editing ? t("inventory:stock.validation.wholeNumber") : t("inventory:stock.serial.validation.aboveZero")); setSaving(false); return }
        if (fMfg && fExpiry && fExpiry < fMfg) { setErr(t("inventory:stock.serial.validation.expiry")); setSaving(false); return }
        const body = {
          productId: Number(fProduct), variantId: fVariant ? Number(fVariant) : undefined, locationId: fLoc ? Number(fLoc) : undefined,
          batchNumber: fCode.trim(), manufactureDate: fMfg || undefined, expiryDate: fExpiry || undefined,
          purchaseOrderNumber: fPo.trim() || undefined, notes: fNotes.trim() || undefined,
        }
        if (editing) await serialBatchApi.updateBatch(editing.id, {
          ...body, variantId: fVariant ? Number(fVariant) : null, quantityRemaining: qty,
          manufactureDate: fMfg || null, expiryDate: fExpiry || null, purchaseOrderNumber: fPo.trim() || null, notes: fNotes.trim() || null,
        } as any)
        else await serialBatchApi.createBatch({ ...body, quantityReceived: qty, receivedDate: today() })
        toast({ title: editing ? t("inventory:stock.serial.toast.batchUpdated") : t("inventory:stock.serial.toast.batchAdded"), description: fCode.trim() })
      } else {
        if (editing) {
          await serialBatchApi.updateSerial(editing.id, {
            serialNumber: serialLines[0], status: fStatus as any, purchaseOrderNumber: fPo.trim() || undefined,
            receivedDate: fReceived || undefined, notes: fNotes.trim() || undefined, locationId: fLoc ? Number(fLoc) : undefined,
          })
          toast({ title: t("inventory:stock.serial.toast.serialUpdated") })
        } else {
          if (serialLines.length === 0) { setErr(t("inventory:stock.serial.validation.serial")); setSaving(false); return }
          const res: any = await serialBatchApi.createSerials({
            productId: Number(fProduct), variantId: fVariant ? Number(fVariant) : undefined, locationId: fLoc ? Number(fLoc) : undefined,
            serials: serialLines.map((serialNumber) => ({
              serialNumber, purchaseOrderNumber: fPo.trim() || undefined, receivedDate: fReceived || undefined, notes: fNotes.trim() || undefined,
              ...(fStatus !== "available" ? { status: fStatus } : {}),
            })),
          } as any)
          const created = Array.isArray(res) ? res.length : res?.created?.length ?? 0
          const skipped = Array.isArray(res) ? 0 : res?.skipped?.length ?? 0
          toast({ title: t("inventory:stock.serial.toast.serialsAdded", { count: created }), description: skipped ? t("inventory:suppliers.toast.skipped", { count: skipped }) : undefined })
        }
      }
      clearForm()
      load(); loadStats()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("common:extra.couldNotSave"))
    } finally {
      setSaving(false)
    }
  }

  const remove = async (type: Tab, id: number, label: string) => {
    if (!window.confirm(t("common:confirm.deleteTitle", { name: label }))) return
    try {
      if (type === "batch") await serialBatchApi.deleteBatch(id)
      else await serialBatchApi.deleteSerial(id)
      toast({ title: t("common:status.deleted"), description: label })
      load(); loadStats()
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inventory:suppliers.toast.deleteFailed"), description: e?.response?.data?.message })
    }
  }

  const handleExport = async () => {
    try {
      const base: Record<string, any> = { page: 1, per_page: 500 }
      if (qDebounced) base.search = qDebounced
      const [bs, ss] = await Promise.all([
        serialBatchApi.getBatches({ ...base, ...(tab === "batch" && statusF !== "all" ? { status: statusF } : {}) }),
        serialBatchApi.getSerials({ ...base, ...(tab === "serial" && statusF !== "all" ? { status: statusF } : {}) }),
      ])
      const rows = [
        ...(bs.data as ProductBatch[]).map((b) => ({
          type: t("inventory:stock.serial.batch"), code: b.batchNumber, product: b.productName + (b.variantName ? ` · ${b.variantName}` : ""), qty: b.quantityRemaining,
          manufactured: b.manufactureDate?.slice(0, 10) ?? "", expiry: b.expiryDate?.slice(0, 10) ?? "", status: expiryText(b),
          warehouse: b.locationName ?? "", po: b.purchaseOrderNumber ?? "", received: b.receivedDate?.slice(0, 10) ?? "", sellOrder: b.sellOrderLabel ?? "", notes: b.notes ?? "",
        })),
        ...(ss.data as ProductSerial[]).map((s) => ({
          type: t("inventory:stock.serial.serial"), code: s.serialNumber, product: s.productName + (s.variantName ? ` · ${s.variantName}` : ""), qty: 1,
          manufactured: "", expiry: "", status: serialLabel(s.status), warehouse: s.locationName ?? "", po: s.purchaseOrderNumber ?? "",
          received: s.receivedDate?.slice(0, 10) ?? "", sellOrder: "", notes: s.notes ?? "",
        })),
      ]
      if (rows.length === 0) { toast({ title: t("common:extra.nothingToExport") }); return }
      exportToCSV(rows, "serial-batch", ["type", "code", "product", "qty", "manufactured", "expiry", "status", "warehouse", "po", "received", "sellOrder", "notes"])
    } catch {
      toast({ variant: "destructive", title: t("inventory:stock.serial.toast.exportFailed") })
    }
  }

  if (blocked) return blocked

  const rows = tab === "batch" ? batches : serials
  const formTitle = editing ? (tab === "batch" ? t("inventory:stock.serial.form.editBatch") : t("inventory:stock.serial.form.editSerial")) : tab === "batch" ? t("inventory:stock.serial.form.addBatchTitle") : t("inventory:stock.serial.form.addSerialsTitle")

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("inventory:stock.serial.title")}
        description={t("inventory:stock.serial.description")}
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>}
      />

      {!stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[118px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("inventory:stock.serial.kpi.batches"), value: batchCount, icon: <Layers className="size-4" />, color: "blue", hint: t("inventory:stock.serial.kpi.batchProducts", { count: stats.batchProducts ?? 0 }) },
          { label: t("inventory:stock.serial.kpi.expiring"), value: stats.expiringSoonCount ?? stats.batches.expiringSoon, icon: <AlertTriangle className="size-4" />, color: "yellow",
            hint: stats.firstExpiring ? t("inventory:stock.serial.kpi.left", { batch: stats.firstExpiring.batchNumber, count: stats.firstExpiring.quantity }) : t("inventory:stock.serial.kpi.nothingExpiring") },
          { label: t("inventory:stock.serial.kpi.expired"), value: stats.expiredCount ?? stats.batches.expired, icon: <X className="size-4" />, color: "red",
            hint: stats.firstExpired ? ((stats.expiredCount ?? 0) > 1 ? t("inventory:stock.serial.kpi.expiredMore", { batch: stats.firstExpired.batchNumber, count: (stats.expiredCount ?? 1) - 1 }) : stats.firstExpired.batchNumber) : t("inventory:stock.serial.kpi.noneExpired") },
          { label: t("inventory:stock.serial.kpi.serials"), value: serialCount, icon: <Hash className="size-4" />, color: "purple",
            hint: t("inventory:stock.serial.kpi.serialsHint", { available: stats.serialAvailable ?? stats.serials.available, sold: stats.serialSold ?? stats.serials.sold }) },
        ]} />
      )}

      {noRecords && (
        <Alert role="status">
          <AlertDescription className="flex flex-wrap items-center gap-3.5">
            <span className="min-w-[260px] flex-1">
              <Trans t={t} i18nKey="inventory:stock.serial.noRecords" components={{ b: <strong className="text-foreground" /> }} />
            </span>
            <Button asChild><Link href="/dashboard/products">{t("inventory:stock.serial.setupProduct")}</Link></Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={changeTab} tabs={[
              { value: "batch", label: t("inventory:stock.serial.tabs.batch"), count: batchCount },
              { value: "serial", label: t("inventory:stock.serial.kpi.serials"), count: serialCount },
            ]} />
          </div>
          <Toolbar className="p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Label htmlFor="sb-search" className="sr-only">{t("common:actions.search")}</Label>
              <Input id="sb-search" type="search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} placeholder={t("inventory:stock.serial.searchPh")}
                className="pl-9" />
            </div>
            <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(1) }}>
              <SelectTrigger aria-label={t("common:fields.status")} className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventory:transfers.statusAll")}</SelectItem>
                {tab === "batch" ? (
                  <>
                    <SelectItem value="ok">{t("inventory:stock.serial.expiry.ok")}</SelectItem><SelectItem value="soon">{t("inventory:stock.serial.kpi.expiring")}</SelectItem><SelectItem value="expired">{t("inventory:stock.serial.kpi.expired")}</SelectItem>
                  </>
                ) : (
                  <>
                    {Object.keys(SERIAL_KEY).map((s) => <SelectItem key={s} value={s}>{serialLabel(s)}</SelectItem>)}
                  </>
                )}
              </SelectContent>
            </Select>
          </Toolbar>

          <div>
            {tab === "batch" ? (
              <Table className="min-w-[780px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t("inventory:stock.serial.batch")}</TableHead><TableHead>{t("common:fields.product")}</TableHead>
                    <TableHead className="text-right">{t("inventory:stock.serial.col.qtyLeft")}</TableHead><TableHead>{t("inventory:stock.serial.col.expiry")}</TableHead>
                    <TableHead>{t("inventory:stock.serial.col.received")}</TableHead><TableHead>{t("inventory:stock.serial.col.sellOrder")}</TableHead>
                    <TableHead className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                    batches.map((b) => {
                      const e = expiryInfo(b)
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="pl-4 font-bold">{b.batchNumber}</TableCell>
                          <TableCell>
                            <div className="font-semibold">{b.productName}{b.variantName ? ` · ${b.variantName}` : ""}</div>
                            <div className="text-xs text-muted-foreground">{[b.locationName, b.notes].filter(Boolean).join(" · ") || "—"}</div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            <div className="font-bold">{b.quantityRemaining}</div>
                            <div className="text-xs text-muted-foreground">{t("inventory:stock.serial.ofReceived", { count: Math.max(b.quantityReceived, b.quantityRemaining) })}</div>
                          </TableCell>
                          <TableCell>
                            <div>{fmt(b.expiryDate)}</div>
                            <Badge variant={e.variant}>{expiryText(b)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div>{fmt(b.receivedDate)}</div>
                            <div className="text-xs text-muted-foreground">{b.purchaseOrderNumber || "—"}</div>
                          </TableCell>
                          <TableCell className="tabular-nums">{b.sellOrderLabel ?? "—"}</TableCell>
                          <TableCell className="pr-4">
                            <div className="flex justify-end gap-1">
                              <WithTooltip content={t("inventory:suppliers.editName", { name: b.batchNumber })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.editName", { name: b.batchNumber })} onClick={() => editBatch(b)}><Pencil className="size-4" /></Button></WithTooltip>
                              <WithTooltip content={t("inventory:suppliers.deleteName", { name: b.batchNumber })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.deleteName", { name: b.batchNumber })} onClick={() => remove("batch", b.id, b.batchNumber)}><Trash2 className="size-4" /></Button></WithTooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            ) : (
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">{t("inventory:stock.serial.col.serialNo")}</TableHead><TableHead>{t("common:fields.product")}</TableHead>
                    <TableHead>{t("common:fields.warehouse")}</TableHead><TableHead>{t("common:fields.status")}</TableHead>
                    <TableHead>{t("inventory:stock.serial.col.received")}</TableHead><TableHead className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-10" /></TableCell></TableRow>) :
                    serials.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="pl-4 font-bold">{s.serialNumber}</TableCell>
                        <TableCell className="font-semibold">{s.productName}{s.variantName ? ` · ${s.variantName}` : ""}</TableCell>
                        <TableCell>{s.locationName ?? "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={s.status} variant={SERIAL_VARIANT[s.status] ?? SERIAL_VARIANT.sold} label={serialLabel(s.status)} className="capitalize" />
                        </TableCell>
                        <TableCell>
                          <div>{fmt(s.receivedDate)}</div>
                          <div className="text-xs text-muted-foreground">{s.purchaseOrderNumber || "—"}</div>
                        </TableCell>
                        <TableCell className="pr-4">
                          <div className="flex justify-end gap-1">
                            <WithTooltip content={t("inventory:suppliers.editName", { name: s.serialNumber })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.editName", { name: s.serialNumber })} onClick={() => editSerial(s)}><Pencil className="size-4" /></Button></WithTooltip>
                            <WithTooltip content={t("inventory:suppliers.deleteName", { name: s.serialNumber })}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:suppliers.deleteName", { name: s.serialNumber })} onClick={() => remove("serial", s.id, s.serialNumber)}><Trash2 className="size-4" /></Button></WithTooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>

          {!loading && rows.length === 0 && (
            <EmptyState
              icon={tab === "batch" ? Layers : Hash}
              title={q || statusF !== "all" ? t("inventory:stock.serial.empty.noMatch") : tab === "batch" ? t("inventory:stock.serial.empty.noBatches") : t("inventory:stock.serial.empty.noSerials")}
              description={q || statusF !== "all" ? t("inventory:stock.serial.empty.filtered") : t("inventory:stock.serial.empty.first")}
            />
          )}

          {!loading && total > 0 && (
            <>
            <Separator />
            <div className="p-4 pt-3">
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / perPage))}
                itemsPerPage={perPage}
                totalItems={total}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
            </>
          )}
        </Card>

        <aside aria-label={t("common:actions.add")} className="w-full shrink-0 xl:w-[380px]">
        <SectionCard title={formTitle} contentClassName="flex flex-col gap-3.5">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <FormField label={t("inventory:stock.serial.form.product")} htmlFor="sb-f-product">
            <Select value={fProduct || "__none"} onValueChange={(v) => { setFProduct(v === "__none" ? "" : v); setFVariant("") }} disabled={editing?.type === "serial"}>
              <SelectTrigger id="sb-f-product" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("inventory:stock.adjust.selectProduct")}</SelectItem>
                {products.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.sku ? ` (${p.sku})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          {variants.length > 0 && (
            <FormField label={t("inventory:stock.serial.form.variant")} htmlFor="sb-f-variant">
              <Select value={fVariant || "__none"} onValueChange={(v) => setFVariant(v === "__none" ? "" : v)} disabled={editing?.type === "serial"}>
                <SelectTrigger id="sb-f-variant" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("inventory:stock.serial.form.selectVariant")}</SelectItem>
                  {variants.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FormField>
          )}

          {tab === "batch" ? (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:stock.serial.form.batchNo")} htmlFor="sb-f-code"><Input id="sb-f-code" className="w-full" value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder={t("inventory:stock.serial.form.batchNoPh")} /></FormField>
                <FormField label={editing ? t("inventory:stock.serial.form.qtyLeft") : t("inventory:stock.serial.form.quantity")} htmlFor="sb-f-qty"><Input id="sb-f-qty" type="number" min={editing ? 0 : 1} step={1} className="w-full" value={fQty} onChange={(e) => setFQty(e.target.value)} placeholder="0" /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:stock.serial.form.manufactured")} htmlFor="sb-f-mfg"><Input id="sb-f-mfg" type="date" className="w-full" value={fMfg} onChange={(e) => setFMfg(e.target.value)} /></FormField>
                <FormField label={t("inventory:stock.serial.form.expires")} htmlFor="sb-f-expiry"><Input id="sb-f-expiry" type="date" className="w-full" value={fExpiry} onChange={(e) => setFExpiry(e.target.value)} /></FormField>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:stock.serial.form.poNumber")} htmlFor="sb-f-po"><Input id="sb-f-po" className="w-full" value={fPo} onChange={(e) => setFPo(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
                <FormField label={t("common:fields.warehouse")} htmlFor="sb-f-loc">
                  <Select value={fLoc || undefined} onValueChange={setFLoc}>
                    <SelectTrigger id="sb-f-loc" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
                </FormField>
              </div>
              <FormField label={t("common:fields.notes")} htmlFor="sb-f-notes"><Input id="sb-f-notes" className="w-full" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
            </>
          ) : (
            <>
              <FormField label={editing ? t("inventory:stock.serial.form.serialNumber") : t("inventory:stock.serial.form.serialNumbers")} htmlFor="sb-f-serials" description={editing ? undefined : t("inventory:stock.serial.form.serialsHint", { count: serialLines.length })}>
                <Textarea id="sb-f-serials" rows={editing ? 1 : 5} className="w-full" value={serialText} onChange={(e) => setSerialText(e.target.value)} placeholder={t("inventory:stock.serial.form.serialsPh")} />
              </FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:stock.serial.col.received")} htmlFor="sb-f-received"><Input id="sb-f-received" type="date" className="w-full" value={fReceived} onChange={(e) => setFReceived(e.target.value)} /></FormField>
                <FormField label={t("inventory:stock.serial.form.poNumber")} htmlFor="sb-f-po"><Input id="sb-f-po" className="w-full" value={fPo} onChange={(e) => setFPo(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
              </div>
              <FormField label={t("common:fields.warehouse")} htmlFor="sb-f-loc">
                <Select value={fLoc || undefined} onValueChange={setFLoc}>
                    <SelectTrigger id="sb-f-loc" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}</SelectContent>
                  </Select>
              </FormField>
              <FormField label={t("common:fields.status")} htmlFor="sb-f-status">
                <Select value={fStatus} onValueChange={setFStatus}>
                  <SelectTrigger id="sb-f-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(SERIAL_KEY).map((s) => <SelectItem key={s} value={s}>{serialLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("common:fields.notes")} htmlFor="sb-f-notes"><Input id="sb-f-notes" className="w-full" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={clearForm}>{t("common:actions.clear")}</Button>
            <Button type="button" disabled={saving} onClick={save}>
              {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : tab === "batch" ? t("inventory:stock.serial.form.addBatch") : serialLines.length ? t("inventory:stock.serial.form.addSerials", { count: serialLines.length }) : t("inventory:stock.serial.form.addSerialsNone")}
            </Button>
          </div>
        </SectionCard>
        </aside>
      </div>
    </div>
  )
}
