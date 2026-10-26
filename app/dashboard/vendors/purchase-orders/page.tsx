"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Download, Eye, Package, Plus, Printer, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { ButtonGroup } from "@/components/ui/button-group"
import { Item, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatTile } from "@/components/common/StatTile"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Toolbar } from "@/components/common/Toolbar"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import purchaseOrderApi, { type PurchaseOrder, type PurchaseStats } from "@/lib/purchaseOrderApi"
import vendorApi, { type VendorOverviewRow } from "@/lib/vendorApi"
import productApi from "@/lib/productApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { WithTooltip } from "@/components/common/WithTooltip"

type Tab = "all" | "draft" | "ordered" | "partial" | "received" | "cancelled"

const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Ordered", partial: "Partly received", received: "Received", cancelled: "Cancelled" }
const STATUS_VARIANT: Record<string, StatusVariant> = {
  draft: "outline",
  sent: "secondary",
  partial: "secondary",
  received: "default",
  cancelled: "destructive",
}
const DOT: Record<string, string> = {
  draft: "bg-muted-foreground", ordered: "bg-blue-500", partial: "bg-amber-500", received: "bg-emerald-600", cancelled: "bg-destructive",
}
const PAY_VARIANT: Record<string, StatusVariant> = {
  paid: "default",
  partially_paid: "secondary",
  pending: "destructive",
}
const PAY_LABEL: Record<string, string> = { paid: "Paid", partially_paid: "Partial", pending: "Unpaid" }
const PAY_METHODS = [
  { value: "cash", label: "Cash" }, { value: "bank", label: "Bank transfer" }, { value: "bkash", label: "bKash" },
  { value: "nagad", label: "Nagad" }, { value: "cheque", label: "Cheque" }, { value: "card", label: "Card" }, { value: "other", label: "Other" },
]

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
const today = () => isoLocal(new Date())
const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d) }
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const r2 = (v: number) => Math.round(v * 100) / 100



interface Line {
  key: string
  productId: number
  variantId: string
  name: string
  sku: string
  stock: number
  lastCost: number
  qty: number
  cost: number
  variants: { id: number; name: string }[]
}

export default function PurchaseOrdersPage() {
  const { formatCurrency } = useCompanySettings()
  const { warehouses, defaultWarehouse } = useWarehouse()
  const searchParams = useSearchParams()
  const blocked = useModuleGuard("Vendors")

  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<PurchaseStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [search, setSearch] = useState("")
  const [fSup, setFSup] = useState("all")
  const [fPay, setFPay] = useState("all")
  const [fLoc, setFLoc] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [vendors, setVendors] = useState<VendorOverviewRow[]>([])
  const [products, setProducts] = useState<any[]>([])

  // ---- create form
  const [formOpen, setFormOpen] = useState(false)
  const [supId, setSupId] = useState("")
  const [locId, setLocId] = useState("")
  const [expDate, setExpDate] = useState("")
  const [expTouched, setExpTouched] = useState(false)
  const [note, setNote] = useState("")
  const [lines, setLines] = useState<Line[]>([])
  const [pq, setPq] = useState("")
  const [discType, setDiscType] = useState<"flat" | "percent">("flat")
  const [discVal, setDiscVal] = useState("")
  const [taxRate, setTaxRate] = useState("")
  const [shipCost, setShipCost] = useState("")
  const [paidMode, setPaidMode] = useState<"none" | "full" | "partial">("none")
  const [partial, setPartial] = useState("")
  const [method, setMethod] = useState("cash")
  const [payDate, setPayDate] = useState(today())
  const [payRef, setPayRef] = useState("")
  const [formError, setFormError] = useState("")
  const [saving, setSaving] = useState(false)

  // ---- detail dialog
  const [view, setView] = useState<PurchaseOrder | null>(null)
  const [rcvQty, setRcvQty] = useState<Record<number, string>>({})
  const [rcvLoc, setRcvLoc] = useState("")
  const [dueTotal, setDueTotal] = useState<number | null>(null)
  const [dPayAmt, setDPayAmt] = useState("")
  const [dPayMethod, setDPayMethod] = useState("cash")
  const [dPayDate, setDPayDate] = useState(today())
  const [dPayRef, setDPayRef] = useState("")
  const [dErr, setDErr] = useState("")
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: perPage }
      if (search) params.search = search
      if (tab !== "all") params.status = tab
      if (fSup !== "all") params.vendor_id = fSup
      if (fPay !== "all") params.payment = fPay
      if (fLoc !== "all") params.location_id = fLoc
      const res = await purchaseOrderApi.getAll(params)
      const d = res.data?.data
      setPos(d?.data ?? [])
      setTotal(d?.total ?? 0)
      setDueTotal(typeof d?.due_total === "number" ? d.due_total : null)
    } catch {
      setPos([])
      toast.error("Failed to load purchase orders")
    } finally {
      setLoading(false)
    }
  }, [page, perPage, search, tab, fSup, fPay, fLoc])

  const loadStats = useCallback(() => {
    purchaseOrderApi.getStats().then((r) => setStats(r.data?.data ?? null)).catch(() => {})
  }, [])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    loadStats()
    vendorApi.getOverview({ limit: 500, sort: "name" }).then((r) => setVendors(r.data)).catch(() => {})
    productApi.getAll({ limit: 500 }).then((r: any) => setProducts(r.data ?? [])).catch(() => {})
  }, [loadStats])

  const refresh = () => { loadList(); loadStats() }

  // ---- helpers over products
  const reorderOf = (p: any) => Number(p.reorderPoint ?? p.reorder_point ?? 0)
  const lowProducts = useMemo(() => products.filter((p) => Number(p.stock) <= reorderOf(p)), [products])
  const mkLine = (p: any, qty = 1): Line => ({
    key: `${p.id}-${Math.random().toString(36).slice(2, 7)}`,
    productId: Number(p.id),
    variantId: "",
    name: p.name ?? "",
    sku: p.sku ?? "",
    stock: Number(p.stock) || 0,
    lastCost: Number(p.costPrice ?? p.cost_price ?? 0),
    qty,
    cost: Number(p.costPrice ?? p.cost_price ?? 0),
    variants: (p.variants ?? []).map((v: any) => ({ id: Number(v.id), name: v.name })),
  })
  const suggestQty = (p: any) => Math.max(1, Math.round(reorderOf(p) * 3 - Number(p.stock)))

  const resetForm = () => {
    setSupId(""); setLocId(""); setExpDate(""); setExpTouched(false); setNote(""); setLines([]); setPq("")
    setDiscType("flat"); setDiscVal(""); setTaxRate(""); setShipCost("")
    setPaidMode("none"); setPartial(""); setMethod("cash"); setPayDate(today()); setPayRef(""); setFormError("")
  }
  const openForm = () => {
    resetForm()
    setLocId(defaultWarehouse ? String(defaultWarehouse.id) : "")
    setFormOpen(true)
  }

  // Prefill from ?new=1&vendorId=..&items=productId:qty,... (dashboard reorder links)
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !searchParams.has("new") || searchParams.get("new") === "0") return
    const wanted = (searchParams.get("items") ?? "").split(",").map((x) => x.split(":")).filter(([id, q]) => id && Number(q) > 0)
    if (wanted.length > 0 && products.length === 0) return
    prefilled.current = true
    resetForm()
    setLocId(defaultWarehouse ? String(defaultWarehouse.id) : "")
    const v = searchParams.get("vendorId") ?? searchParams.get("supplier")
    if (v) setSupId(v)
    setLines(wanted.flatMap(([id, q]) => {
      const p = products.find((x) => String(x.id) === id)
      return p ? [mkLine(p, Number(q))] : []
    }))
    setFormOpen(true)
  }, [searchParams, products, warehouses, defaultWarehouse]) // eslint-disable-line react-hooks/exhaustive-deps

  const supplier = vendors.find((v) => String(v.id) === supId)
  const leadDays = supplier?.leadTimeDays && supplier.leadTimeDays > 0 ? supplier.leadTimeDays : 7
  useEffect(() => {
    if (formOpen && !expTouched) setExpDate(addDays(leadDays))
  }, [formOpen, expTouched, leadDays])
  // Default receiving location once warehouses are known
  useEffect(() => {
    if (formOpen && !locId && defaultWarehouse) setLocId(String(defaultWarehouse.id))
  }, [formOpen, locId, defaultWarehouse])
  const subtotal = r2(lines.reduce((a, l) => a + l.qty * l.cost, 0))
  const units = lines.reduce((a, l) => a + l.qty, 0)
  const dv = Number(discVal) || 0
  const discount = Math.min(r2(discType === "percent" ? (subtotal * dv) / 100 : dv), subtotal)
  const taxable = Math.max(0, subtotal - discount)
  const tax = r2((taxable * (Number(taxRate) || 0)) / 100)
  const shipping = Number(shipCost) || 0
  const grand = r2(taxable + tax + shipping)
  const paidNow = paidMode === "none" ? 0 : paidMode === "full" ? grand : Math.min(Number(partial) || 0, grand)
  const dueNow = r2(grand - paidNow)

  const addProduct = (p: any) => {
    setLines((ls) => {
      const existing = ls.find((l) => l.productId === Number(p.id) && !l.variants.length)
      if (existing) return ls.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, mkLine(p)]
    })
    setPq("")
  }
  const addLow = () => {
    setLines((ls) => {
      const have = new Set(ls.map((l) => l.productId))
      return [...ls, ...lowProducts.filter((p) => !have.has(Number(p.id))).map((p) => mkLine(p, suggestQty(p)))]
    })
  }
  const patchLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const results = pq.trim()
    ? products.filter((p) => `${p.name} ${p.sku}`.toLowerCase().includes(pq.trim().toLowerCase())).slice(0, 6)
    : []
  const missingLow = lowProducts.filter((p) => !lines.some((l) => l.productId === Number(p.id))).length

  const submit = async (status: "draft" | "sent" | "received") => {
    if (!supId) { setFormError("Choose a supplier."); return }
    if (lines.length === 0) { setFormError("Add at least one item."); return }
    if (lines.some((l) => l.qty < 1)) { setFormError("Every item needs a quantity of at least 1."); return }
    if (lines.some((l) => !(l.cost >= 0))) { setFormError("Unit cost cannot be negative."); return }
    if (status === "received" && !locId) { setFormError("Choose where to receive the stock."); return }
    if (supplier && supplier.status && supplier.status !== "Active") { setFormError(`${supplier.name} is ${supplier.status.toLowerCase()}. Reactivate the supplier before ordering.`); return }
    if (expDate && expDate < today()) { setFormError("Expected delivery cannot be in the past."); return }
    if (discVal !== "" && !(dv >= 0)) { setFormError("Discount cannot be negative."); return }
    if (discType === "percent" && dv > 100) { setFormError("Discount cannot be more than 100%."); return }
    if (discType === "flat" && dv > subtotal + 0.005) { setFormError("Discount is more than the subtotal."); return }
    if (taxRate !== "" && !(Number(taxRate) >= 0 && Number(taxRate) <= 100)) { setFormError("Tax rate must be between 0 and 100%."); return }
    if (shipCost !== "" && !(Number(shipCost) >= 0)) { setFormError("Shipping cost cannot be negative."); return }
    if (paidMode === "partial" && !(Number(partial) > 0)) { setFormError("Enter the advance amount you are paying now."); return }
    if (paidMode === "partial" && Number(partial) > grand + 0.005) { setFormError("Advance is more than the PO total."); return }
    if (paidNow > 0 && payDate && payDate > today()) { setFormError("Payment date cannot be in the future."); return }
    setSaving(true); setFormError("")
    try {
      await purchaseOrderApi.create({
        status,
        vendorId: Number(supId),
        locationId: locId ? Number(locId) : undefined,
        expectedDate: expDate || undefined,
        notes: note || undefined,
        discountType: discType,
        discountValue: dv,
        taxRate: Number(taxRate) || 0,
        shippingCost: shipping,
        ...(paidNow > 0 ? { paidAmount: paidNow, paymentMethod: method, paymentDate: payDate, reference: payRef || undefined } : {}),
        items: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId ? Number(l.variantId) : undefined,
          quantityOrdered: l.qty,
          unitCost: l.cost,
        })),
      })
      toast.success(status === "draft" ? "Draft saved" : status === "received" ? "Purchase order created and stock received" : "Purchase order sent")
      setFormOpen(false)
      resetForm()
      refresh()
    } catch (e: any) {
      setFormError(e?.response?.data?.message ?? "Could not save the purchase order.")
    } finally {
      setSaving(false)
    }
  }

  // ---- detail
  const openView = async (po: PurchaseOrder) => {
    setView(po); setDErr(""); setRcvQty({}); setRcvLoc(po.locationId ? String(po.locationId) : defaultWarehouse ? String(defaultWarehouse.id) : ""); setDPayAmt(String(po.dueAmount || "")); setDPayMethod("cash"); setDPayDate(today()); setDPayRef("")
    try {
      const res = await purchaseOrderApi.getById(po.id)
      const full: PurchaseOrder = res.data?.data ?? po
      setView(full)
      setRcvQty(Object.fromEntries(full.items.map((i) => [i.id, String(Math.max(0, i.quantityOrdered - i.quantityReceived))])))
    } catch { /* keep list row */ }
  }

  const reloadView = async (id: number) => {
    try { setView((await purchaseOrderApi.getById(id)).data?.data) } catch { /* ignore */ }
  }

  const act = async (fn: () => Promise<any>, ok: string, closeAfter = false) => {
    setBusy(true); setDErr("")
    try {
      await fn()
      toast.success(ok)
      refresh()
      if (closeAfter) setView(null)
      else if (view) await reloadView(view.id)
    } catch (e: any) {
      setDErr(e?.response?.data?.message ?? "That did not work.")
    } finally {
      setBusy(false)
    }
  }

  const receiveNow = () => {
    if (!view) return
    const items = view.items
      .map((i) => ({ itemId: i.id, quantityReceiving: Math.min(Number(rcvQty[i.id]) || 0, i.quantityOrdered - i.quantityReceived) }))
      .filter((i) => i.quantityReceiving > 0)
    if (items.length === 0) { setDErr("Enter a quantity to receive."); return }
    if (!rcvLoc) { setDErr("Choose where to receive the stock."); return }
    const units = items.reduce((a, i) => a + i.quantityReceiving, 0)
    const where = warehouses.find((w) => String(w.id) === rcvLoc)?.name ?? "the selected location"
    if (!window.confirm(`Receive ${units} unit${units === 1 ? "" : "s"} of ${view.poNumber} into ${where}?`)) return
    act(() => purchaseOrderApi.receive(view.id, { locationId: Number(rcvLoc), items }), "Stock received and inventory updated")
  }

  // Row shortcut: receive everything still outstanding at the PO's location
  const receiveRest = async (p: PurchaseOrder) => {
    const items = p.items.map((i) => ({ itemId: i.id, quantityReceiving: i.quantityOrdered - i.quantityReceived })).filter((i) => i.quantityReceiving > 0)
    if (items.length === 0) return
    const locationId = p.locationId ?? defaultWarehouse?.id
    if (!locationId) { toast.error("Choose a receiving location first (open the order)."); return }
    const units = items.reduce((a, i) => a + i.quantityReceiving, 0)
    const where = p.locationName ?? warehouses.find((w) => w.id === locationId)?.name ?? "the default location"
    if (!window.confirm(`Receive ${units} unit${units === 1 ? "" : "s"} of ${p.poNumber} into ${where}?`)) return
    await act2(p, () => purchaseOrderApi.receive(p.id, { locationId, items }), "Stock received")
  }

  const recordPay = () => {
    if (!view) return
    const amount = Number(dPayAmt)
    if (!(amount > 0)) { setDErr("Enter a payment amount."); return }
    if (amount > view.dueAmount + 0.005) { setDErr("The amount is more than what is due."); return }
    act(
      () => purchaseOrderApi.recordPayment(view.id, { amount, paymentMethod: dPayMethod, paymentDate: dPayDate, reference: dPayRef || undefined }),
      "Payment recorded",
    )
  }

  const printPo = (po: PurchaseOrder) => {
    const w = window.open("", "_blank", "width=820,height=900")
    if (!w) return
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string))
    const phone = vendors.find((v) => v.id === po.vendorId)?.phone
    const rows = po.items.map((i) =>
      `<tr><td>${esc(i.productName)}${i.variantName ? ` · ${esc(i.variantName)}` : ""}</td><td class="r">${i.quantityOrdered}</td><td class="r">${formatCurrency(i.unitCost)}</td><td class="r">${formatCurrency(i.subtotal)}</td></tr>`).join("")
    w.document.write(`<!doctype html><title>${esc(po.poNumber)}</title><style>
      body{font:14px system-ui;margin:32px;color:#0E1525}h1{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:18px}
      th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.r{text-align:right}.m{color:#5B6478}.t{margin-top:16px;text-align:right}
    </style><h1>Purchase order ${esc(po.poNumber)}</h1>
    <div class="m">Date ${fmtDate(po.createdAt)} · Status ${esc(STATUS_LABEL[po.status] ?? po.status)} · Payment ${esc(PAY_LABEL[po.paymentStatus] ?? po.paymentStatus)}</div>
    <div class="m">${esc(po.vendorName)}${phone ? ` · ${esc(phone)}` : ""} · Deliver to ${esc(po.locationName ?? "—")} · Expected ${fmtDate(po.expectedDate)}</div>
    <table><thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Unit cost</th><th class="r">Total</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="t">Subtotal ${formatCurrency(po.subtotal ?? po.totalAmount)}<br>${po.discountAmount ? `Discount −${formatCurrency(po.discountAmount)}<br>` : ""}${po.taxAmount ? `Tax +${formatCurrency(po.taxAmount)}<br>` : ""}${po.shippingCost ? `Shipping +${formatCurrency(po.shippingCost)}<br>` : ""}<strong>Total ${formatCurrency(po.totalAmount)}</strong><br>Paid ${formatCurrency(po.paidAmount)}<br><strong>Due ${formatCurrency(po.dueAmount)}</strong></div>
    ${po.notes ? `<p class="m">Note: ${esc(po.notes)}</p>` : ""}`)
    w.document.close(); w.focus(); w.print()
  }

  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const params: Record<string, any> = { limit: 100 }
      if (search) params.search = search
      if (tab !== "all") params.status = tab
      if (fSup !== "all") params.vendor_id = fSup
      if (fPay !== "all") params.payment = fPay
      if (fLoc !== "all") params.location_id = fLoc
      const all: PurchaseOrder[] = []
      for (let pg = 1; pg <= 200; pg++) {
        const d = (await purchaseOrderApi.getAll({ ...params, page: pg })).data?.data
        all.push(...(d?.data ?? []))
        if (pg >= (d?.last_page ?? 1)) break
      }
      if (all.length === 0) { toast.error("Nothing to export."); return }
      exportToCSV(
        all.map((p) => ({
          po: p.poNumber, supplier: p.vendorName, location: p.locationName ?? "", status: STATUS_LABEL[p.status] ?? p.status,
          created: p.createdAt ? p.createdAt.slice(0, 10) : "", expected: p.expectedDate ?? "", items: String(p.items.length),
          units: String(p.unitsOrdered ?? p.items.reduce((a, i) => a + i.quantityOrdered, 0)),
          received_units: String(p.unitsReceived ?? p.items.reduce((a, i) => a + i.quantityReceived, 0)),
          subtotal: String(p.subtotal ?? p.totalAmount), discount: String(p.discountAmount ?? 0), tax: String(p.taxAmount ?? 0),
          shipping: String(p.shippingCost ?? 0), total: String(p.totalAmount), paid: String(p.paidAmount), due: String(p.dueAmount), note: p.notes ?? "",
        })),
        "purchase-orders",
        ["PO", "Supplier", "Location", "Status", "Created", "Expected", "Items", "Units", "Received units", "Subtotal", "Discount", "Tax", "Shipping", "Total", "Paid", "Due", "Note"],
      )
    } catch {
      toast.error("Could not export purchase orders.")
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return blocked

  const by = stats?.byStatus
  const pipe: { key: Exclude<Tab, "all">; label: string }[] = [
    { key: "draft", label: "Draft" }, { key: "ordered", label: "Ordered" }, { key: "partial", label: "Partly received" },
    { key: "received", label: "Received" }, { key: "cancelled", label: "Cancelled" },
  ]
  const changeTab = (t: string) => { setTab(t as Tab); setPage(1) }
  const hasFilters = !!(search || fSup !== "all" || fPay !== "all" || fLoc !== "all" || tab !== "all")
  const filteredDue = dueTotal ?? pos.reduce((a, p) => a + (p.status === "cancelled" ? 0 : p.dueAmount || 0), 0)

  const expNote = (p: PurchaseOrder) => {
    if (!p.expectedDate || p.status === "received" || p.status === "cancelled") return ""
    const days = Math.ceil((new Date(p.expectedDate).getTime() - Date.now()) / 864e5)
    return days < 0 ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late` : days === 0 ? "due today" : `in ${days} day${days === 1 ? "" : "s"}`
  }

  const canReceive = (p: PurchaseOrder) => p.status === "sent" || p.status === "partial"

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      {/* Header */}
      <PageHeader
        title="Purchase orders"
        description="Order stock from suppliers, receive it into inventory, and track what you owe."
        actions={<>
          <Button type="button" variant="outline" onClick={handleExport} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}</Button>
          <Button type="button" onClick={openForm}><Plus className="size-4" aria-hidden /> New purchase order</Button>
        </>}
      />

      {/* Reorder banner */}
      {stats && stats.reorderCount > 0 && (
        <Alert>
          <Package aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3.5 text-foreground">
            <span className="min-w-[260px] flex-1">
              <strong>{stats.reorderCount} product{stats.reorderCount === 1 ? " is" : "s are"} at or below their reorder point.</strong>{" "}
              Review suggested quantities and create the order in one go.
            </span>
            <Button type="button" onClick={() => { openForm(); setLines(lowProducts.map((p) => mkLine(p, suggestQty(p)))) }}>
              Create from suggestions
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pipeline */}
      <section aria-label="Pipeline" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {pipe.map((p) => (
          <StatTile
            key={p.key}
            className="p-4"
            onClick={() => changeTab(p.key)}
            active={tab === p.key}
            label={<span className="flex items-center gap-2"><span className={cn("size-2 rounded-full", DOT[p.key])} />{p.label}</span>}
            value={by ? by[p.key as keyof typeof by].count : "–"}
            hint={<span className="tabular-nums">{formatCurrency(by ? by[p.key as keyof typeof by].amount : 0)}</span>}
          />
        ))}
      </section>

      {/* Table card */}
      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs
            value={tab}
            onChange={changeTab}
            tabs={[
              { value: "all", label: "All", count: stats?.total },
              ...pipe.map((p) => ({ value: p.key, label: p.label, count: by ? by[p.key as keyof typeof by].count : undefined })),
            ]}
          />
        </div>

        <Toolbar className="gap-2.5 p-4">
          <Label className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <span className="sr-only">Search purchase orders</span>
            <Input type="search" placeholder="Search PO number, supplier or product…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="pl-9" />
          </Label>
          <Select value={fSup} onValueChange={(v) => { setFSup(v); setPage(1) }}>
            <SelectTrigger aria-label="Supplier" className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Supplier: All</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fPay} onValueChange={(v) => { setFPay(v); setPage(1) }}>
            <SelectTrigger aria-label="Payment" className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Payment: All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fLoc} onValueChange={(v) => { setFLoc(v); setPage(1) }}>
            <SelectTrigger aria-label="Location" className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Location: All</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={() => { setSearch(""); setFSup("all"); setFPay("all"); setFLoc("all"); setTab("all"); setPage(1) }}>
              <X className="size-4" aria-hidden /> Clear
            </Button>
          )}
        </Toolbar>

        <div className="overflow-x-auto">
          <Table className="min-w-[1080px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Purchase order</TableHead>
                <TableHead scope="col">Supplier</TableHead>
                <TableHead scope="col">Items</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Received</TableHead>
                <TableHead scope="col">Expected</TableHead>
                <TableHead scope="col" className="text-right">Total</TableHead>
                <TableHead scope="col" className="text-right">Paid</TableHead>
                <TableHead scope="col">Payment</TableHead>
                <TableHead scope="col" className="text-right">Next step</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={10}><Skeleton className="h-10" /></TableCell></TableRow>)
              ) : pos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10}>
                    <EmptyState icon={Package} title="No purchase orders found" description={hasFilters ? "Try clearing the filters." : "Create your first purchase order with New purchase order."} className="p-4 md:p-6" />
                  </TableCell>
                </TableRow>
              ) : (
                pos.map((p) => {
                  const ordered = p.unitsOrdered ?? p.items.reduce((a, i) => a + i.quantityOrdered, 0)
                  const received = p.unitsReceived ?? p.items.reduce((a, i) => a + i.quantityReceived, 0)
                  const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                  const note = expNote(p)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <Button type="button" variant="link" onClick={() => openView(p)} className="h-auto p-0">{p.poNumber}</Button>
                        <div className="text-xs text-muted-foreground">Created {fmtDate(p.createdAt)} · {p.locationName ?? "—"}</div>
                      </TableCell>
                      <TableCell className="font-medium">{p.vendorName}</TableCell>
                      <TableCell>
                        <div className="max-w-[200px] truncate">{p.itemsSummary || `${p.items.length} item${p.items.length === 1 ? "" : "s"}`}</div>
                        <div className="text-xs text-muted-foreground">{ordered} units</div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} variant={STATUS_VARIANT[p.status]} label={STATUS_LABEL[p.status] ?? p.status} />
                      </TableCell>
                      <TableCell>
                        <div className="text-sm tabular-nums">{received} / {ordered}</div>
                        <Progress value={pct} aria-label={`${pct}% received`} className="mt-1 h-1.5 w-[110px]" />
                      </TableCell>
                      <TableCell>
                        <div>{fmtDate(p.expectedDate)}</div>
                        {note && <div className={cn("text-xs", p.isOverdue ? "font-medium text-destructive" : "text-muted-foreground")}>{note}</div>}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(p.totalAmount)}
                        {p.dueAmount > 0 && p.status !== "cancelled" && <div className="text-xs font-medium text-destructive">Due {formatCurrency(p.dueAmount)}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.paidAmount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.paymentStatus} variant={PAY_VARIANT[p.paymentStatus] ?? PAY_VARIANT.pending} label={PAY_LABEL[p.paymentStatus] ?? p.paymentStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "draft" && (
                            <Button type="button" variant="link" size="sm" className="mr-1"
                              onClick={() => act2(p, () => purchaseOrderApi.updateStatus(p.id, "sent"), "Marked as ordered")}>Mark ordered</Button>
                          )}
                          {canReceive(p) && (
                            <Button type="button" variant="link" size="sm" className="mr-1" onClick={() => (p.status === "partial" ? receiveRest(p) : openView(p))}>{p.status === "partial" ? "Receive rest" : "Receive stock"}</Button>
                          )}
                          <WithTooltip content={`View ${p.poNumber}`}><Button type="button" variant="outline" size="icon" aria-label={`View ${p.poNumber}`} onClick={() => openView(p)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={`Print ${p.poNumber}`}><Button type="button" variant="outline" size="icon" aria-label={`Print ${p.poNumber}`} onClick={() => printPo(p)}><Printer className="size-4" /></Button></WithTooltip>
                          {p.dueAmount > 0 && p.status !== "cancelled" && (
                            <WithTooltip content={`Record payment for ${p.poNumber}`}><Button type="button" variant="outline" size="icon" aria-label={`Record payment for ${p.poNumber}`} onClick={() => openView(p)}><Banknote className="size-4" /></Button></WithTooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!loading && pos.length > 0 && (
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
        <Separator />
        <div className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
          Showing {total} purchase order{total === 1 ? "" : "s"}
          {` · ${formatCurrency(filteredDue)} still to pay`}
        </div>
      </Card>

      {/* ---------------- New purchase order ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false) }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[1040px]">
          <DialogHeader>
            <DialogTitle>New purchase order</DialogTitle>
            <DialogDescription>Number assigned when saved · {fmtDate(today())}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">1 · Supplier &amp; delivery</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Supplier *" htmlFor="po-supplier">
                    <Select value={supId || "__none"} onValueChange={(v) => { setSupId(v === "__none" ? "" : v); setExpTouched(false) }}>
                      <SelectTrigger id="po-supplier" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Select supplier</SelectItem>
                        {vendors.filter((v) => v.status === "Active" || String(v.id) === supId).map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Receive at" htmlFor="po-location">
                    <Select value={locId || "__none"} onValueChange={(v) => setLocId(v === "__none" ? "" : v)}>
                      <SelectTrigger id="po-location" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">Select location</SelectItem>
                        {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Expected delivery" htmlFor="po-expected" description={expTouched ? undefined : `Based on ${supplier?.leadTimeDays && supplier.leadTimeDays > 0 ? `${supplier.leadTimeDays}-day lead time` : "a 7-day default"}`}>
                    <Input id="po-expected" type="date" min={today()} value={expDate} onChange={(e) => { setExpDate(e.target.value); setExpTouched(true) }} />
                  </FormField>
                </div>
                {supplier && (
                  <Item variant="muted" size="sm" className="gap-x-6 gap-y-1">
                    <span><span className="text-muted-foreground">Terms</span> <strong>{supplier.paymentTerms || "Not set"}</strong></span>
                    <span><span className="text-muted-foreground">Lead time</span> <strong>{supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "—"}</strong></span>
                    <span><span className="text-muted-foreground">You already owe</span> <strong>{formatCurrency(supplier.owed)}</strong></span>
                    <span><span className="text-muted-foreground">Phone</span> <strong>{supplier.phone || "—"}</strong></span>
                  </Item>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <SectionTitle as="legend" className="mb-2">2 · Items</SectionTitle>
                {missingLow > 0 && (
                  <div><Button type="button" variant="outline" size="sm" onClick={addLow}>+ Add {missingLow} low-stock item{missingLow === 1 ? "" : "s"}</Button></div>
                )}
                <Card className="gap-0 overflow-hidden py-0">
                  <div className="hidden grid-cols-[1fr_70px_130px_110px_100px_32px] gap-2 bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
                    <span>Product</span><span>In stock</span><span>Qty</span><span>Unit cost</span><span className="text-right">Line total</span><span />
                  </div>
                  {lines.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-muted-foreground">No items yet — search a product below to add it.</div>
                  ) : lines.map((l) => (
                    <Fragment key={l.key}>
                      <Separator />
                      <div className="grid grid-cols-2 items-center gap-2 px-3 py-2.5 sm:grid-cols-[1fr_70px_130px_110px_100px_32px]">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <div className="truncate text-sm font-medium">{l.name}</div>
                          <div className="text-xs text-muted-foreground">{l.sku || "—"} · last cost {formatCurrency(l.lastCost)}</div>
                          {l.variants.length > 0 && (
                            <Select value={l.variantId || "__any"} onValueChange={(v) => patchLine(l.key, { variantId: v === "__any" ? "" : v })}>
                              <SelectTrigger aria-label="Variant" size="sm" className="mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__any">Any variant</SelectItem>
                                {l.variants.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <span className="text-sm tabular-nums">{l.stock}</span>
                        <ButtonGroup>
                          <WithTooltip content="Decrease"><Button type="button" variant="outline" size="icon" aria-label="Decrease" onClick={() => patchLine(l.key, { qty: Math.max(1, l.qty - 1) })}>−</Button></WithTooltip>
                          <Input type="number" min={1} aria-label="Quantity" value={l.qty} onChange={(e) => patchLine(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                            className="w-[52px] text-center tabular-nums" />
                          <WithTooltip content="Increase"><Button type="button" variant="outline" size="icon" aria-label="Increase" onClick={() => patchLine(l.key, { qty: l.qty + 1 })}>+</Button></WithTooltip>
                        </ButtonGroup>
                        <Input type="number" min={0} step="0.01" aria-label="Unit cost" value={l.cost} onChange={(e) => patchLine(l.key, { cost: Number(e.target.value) || 0 })}
                          className="w-full tabular-nums" />
                        <span className="text-right text-sm font-semibold tabular-nums">{formatCurrency(l.qty * l.cost)}</span>
                        <WithTooltip content="Remove line"><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</Button></WithTooltip>
                      </div>
                    </Fragment>
                  ))}
                </Card>
                <Label className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><span className="sr-only">Search product</span>
                  <Input type="search" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search product to add…"
                    className="pl-9" />
                </Label>
                {results.length > 0 && (
                  <Card className="gap-0 overflow-hidden py-0">
                    {results.map((p, i) => (
                      <Fragment key={p.id}>
                        {i > 0 && <Separator />}
                        <Button type="button" variant="ghost" onClick={() => addProduct(p)} className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none text-left">
                          <span className="text-sm font-medium">{p.name} <span className="text-xs font-normal text-muted-foreground">{p.sku}</span></span>
                          <span className="text-xs font-normal text-muted-foreground">{p.stock} in stock · cost {formatCurrency(Number(p.costPrice ?? p.cost_price ?? 0))}</span>
                        </Button>
                      </Fragment>
                    ))}
                  </Card>
                )}
              </fieldset>

              <FormField label="Note to supplier" htmlFor="po-note">
                <Textarea id="po-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Deliver before 12 pm, pack in cartons of 12" />
              </FormField>
            </div>

            <aside aria-label="Totals and payment" className="lg:self-start">
              <Card className="gap-3 p-4">
                <SectionTitle>3 · Totals</SectionTitle>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal · {units} unit{units === 1 ? "" : "s"}</span><span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span></div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Discount</span>
                    <ButtonGroup>
                      <Select value={discType} onValueChange={(v) => setDiscType(v as "flat" | "percent")}>
                        <SelectTrigger aria-label="Discount type" size="sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem><SelectItem value="percent">%</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" min={0} step="any" aria-label="Discount" value={discVal} onChange={(e) => setDiscVal(e.target.value)} placeholder="0" className="h-8 w-20 text-right tabular-nums" />
                    </ButtonGroup>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Tax / VAT (%)</span>
                    <Input type="number" min={0} max={100} step="any" aria-label="Tax rate" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" className="w-24 text-right tabular-nums" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Shipping / freight</span>
                    <Input type="number" min={0} step="any" aria-label="Shipping cost" value={shipCost} onChange={(e) => setShipCost(e.target.value)} placeholder="0" className="w-24 text-right tabular-nums" />
                  </div>
                  {(discount > 0 || tax > 0 || shipping > 0) && (
                    <div className="text-xs text-muted-foreground">{[discount > 0 && `−${formatCurrency(discount)} discount`, tax > 0 && `+${formatCurrency(tax)} tax`, shipping > 0 && `+${formatCurrency(shipping)} shipping`].filter(Boolean).join(" · ")}</div>
                  )}
                  <Separator />
                  <div className="flex items-baseline justify-between">
                    <span className="font-semibold">Total</span>
                    <span className="text-2xl font-semibold tabular-nums">{formatCurrency(grand)}</span>
                  </div>
                </div>

                <SectionTitle className="mt-1">4 · Payment to supplier</SectionTitle>
                <div role="radiogroup" aria-label="Amount paid" className="grid grid-cols-3 gap-1.5">
                  {([["none", "Pay later"], ["full", "Pay in full"], ["partial", "Advance"]] as const).map(([id, label]) => (
                    <Button key={id} type="button" role="radio" aria-checked={paidMode === id} onClick={() => setPaidMode(id)}
                      variant={paidMode === id ? "default" : "outline"} size="sm">
                      {label}
                    </Button>
                  ))}
                </div>
                {paidMode === "partial" && (
                  <FormField label="Advance paid now" htmlFor="po-advance"><Input id="po-advance" type="number" min={0} max={grand || undefined} value={partial} onChange={(e) => setPartial(e.target.value)} /></FormField>
                )}
                {paidNow > 0 && (
                  <div className="flex flex-col gap-2.5">
                    <FormField label="Method" htmlFor="po-pay-method"><Select value={method} onValueChange={(v) => setMethod(v)}><SelectTrigger id="po-pay-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormField>
                    <FormField label="Payment date" htmlFor="po-pay-date"><Input id="po-pay-date" type="date" max={today()} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></FormField>
                    <FormField label="Reference" htmlFor="po-pay-ref"><Input id="po-pay-ref" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Cheque / transaction no. (optional)" /></FormField>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Item variant="outline" size="sm" className="px-3 py-2">
                    <ItemContent className="gap-0"><ItemDescription className="text-xs">Paid now</ItemDescription><ItemTitle className="tabular-nums">{formatCurrency(paidNow)}</ItemTitle></ItemContent>
                  </Item>
                  <Item variant="outline" size="sm" className="px-3 py-2">
                    <ItemContent className="gap-0"><ItemDescription className="text-xs">Due {supplier?.paymentTerms ? `(${supplier.paymentTerms})` : "later"}</ItemDescription><ItemTitle className="tabular-nums">{formatCurrency(dueNow)}</ItemTitle></ItemContent>
                  </Item>
                </div>
              </Card>
            </aside>
          </div>

          <DialogFooter className="flex-wrap items-center sm:justify-start">
            <span className="text-xs text-muted-foreground">Stock is added only when you receive the goods.</span>
            {formError && <span role="alert" className="text-sm font-medium text-destructive">{formError}</span>}
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => submit("draft")}>Save draft</Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => submit("received")}>Create &amp; receive now</Button>
              <Button type="button" disabled={saving} onClick={() => submit("sent")}>{saving ? "Saving…" : "Create & send to supplier"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {view && (() => {
            const canPay = view.dueAmount > 0 && view.status !== "cancelled"
            const receivedUnits = view.items.reduce((a, i) => a + i.quantityReceived, 0)
            const hasAdj = (view.discountAmount ?? 0) > 0 || (view.taxAmount ?? 0) > 0 || (view.shippingCost ?? 0) > 0
            return (
              <>
                <DialogHeader className="flex-row flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <DialogTitle>{view.poNumber}</DialogTitle>
                    <DialogDescription>{view.vendorName} · {view.locationName ?? "—"} · Created {fmtDate(view.createdAt)}</DialogDescription>
                  </div>
                  <StatusBadge status={view.status} variant={STATUS_VARIANT[view.status]} label={STATUS_LABEL[view.status] ?? view.status} />
                </DialogHeader>

                <div className="flex flex-col gap-4">
                  <Card className="gap-0 overflow-x-auto py-0">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-center">Ordered</TableHead>
                          <TableHead className="text-center">Received</TableHead>
                          <TableHead className="text-center">{canReceive(view) ? "Receive now" : ""}</TableHead>
                          <TableHead className="text-right">Unit cost</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {view.items.map((i) => {
                          const remain = i.quantityOrdered - i.quantityReceived
                          return (
                            <TableRow key={i.id}>
                              <TableCell>{i.productName}{i.variantName && <span className="ml-1 text-xs text-muted-foreground">· {i.variantName}</span>}</TableCell>
                              <TableCell className="text-center tabular-nums">{i.quantityOrdered}</TableCell>
                              <TableCell className="text-center tabular-nums">{i.quantityReceived}</TableCell>
                              <TableCell className="text-center">
                                {canReceive(view) && remain > 0 ? (
                                  <Input type="number" min={0} max={remain} aria-label={`Receive ${i.productName}`} value={rcvQty[i.id] ?? ""}
                                    onChange={(e) => setRcvQty((q) => ({ ...q, [i.id]: e.target.value }))}
                                    className="mx-auto w-16 text-center tabular-nums" />
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{formatCurrency(i.unitCost)}</TableCell>
                              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(i.subtotal)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </Card>

                  {hasAdj && (
                    <Item variant="muted" size="sm" className="gap-x-6 gap-y-1">
                      <span><span className="text-muted-foreground">Subtotal</span> <strong>{formatCurrency(view.subtotal ?? 0)}</strong></span>
                      {(view.discountAmount ?? 0) > 0 && <span><span className="text-muted-foreground">Discount</span> <strong>−{formatCurrency(view.discountAmount ?? 0)}</strong></span>}
                      {(view.taxAmount ?? 0) > 0 && <span><span className="text-muted-foreground">Tax {view.taxRate}%</span> <strong>+{formatCurrency(view.taxAmount ?? 0)}</strong></span>}
                      {(view.shippingCost ?? 0) > 0 && <span><span className="text-muted-foreground">Shipping</span> <strong>+{formatCurrency(view.shippingCost ?? 0)}</strong></span>}
                    </Item>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["Total", view.totalAmount, ""],
                      ["Paid", view.paidAmount, "text-emerald-600"],
                      ["Due", view.dueAmount, view.dueAmount > 0 ? "text-destructive" : ""],
                    ] as [string, number, string][]).map(([l, v, tone]) => (
                      <Item key={l} variant="muted" size="sm" className="px-3 py-2">
                        <ItemContent className="gap-0">
                          <ItemDescription className="text-xs">{l}</ItemDescription>
                          <ItemTitle className={cn("text-lg tabular-nums", tone)}>{formatCurrency(v)}</ItemTitle>
                        </ItemContent>
                      </Item>
                    ))}
                  </div>

                  <InfoList>
                    <InfoRow label="Expected" value={<>{fmtDate(view.expectedDate)}{expNote(view) ? ` (${expNote(view)})` : ""}</>} />
                    <InfoRow label="Payment" value={PAY_LABEL[view.paymentStatus] ?? view.paymentStatus} />
                  </InfoList>
                  {view.notes && <Item variant="muted" size="sm">Note: {view.notes}</Item>}

                  {(view.receipts?.length ?? 0) > 0 && (
                    <div>
                      <SectionTitle className="mb-1.5">Receiving history</SectionTitle>
                      <ItemGroup>
                        {view.receipts!.map((g, i) => (
                          <Fragment key={g.id}>
                            {i > 0 && <ItemSeparator />}
                            <Item size="sm" className="justify-between px-0">
                              <span>{fmtDate(g.date)} · {g.locationName ?? "—"}</span>
                              <span className="text-muted-foreground">{g.itemsSummary}</span>
                            </Item>
                          </Fragment>
                        ))}
                      </ItemGroup>
                    </div>
                  )}

                  {view.payments.length > 0 && (
                    <div>
                      <SectionTitle className="mb-1.5">Payments</SectionTitle>
                      <ItemGroup>
                        {view.payments.map((y, i) => (
                          <Fragment key={y.id}>
                            {i > 0 && <ItemSeparator />}
                            <Item size="sm" className="justify-between px-0">
                              <span>{fmtDate(y.date ?? y.paymentDate)} · {y.method ?? y.paymentMethod}{y.reference && <span className="ml-1 text-muted-foreground">{y.reference}</span>}</span>
                              <span className="font-semibold tabular-nums">{formatCurrency(y.amount)}</span>
                            </Item>
                          </Fragment>
                        ))}
                      </ItemGroup>
                    </div>
                  )}

                  {canPay && (
                    <Card className="grid gap-2.5 p-3.5 sm:grid-cols-2">
                      <FormField label="Payment amount" htmlFor="po-d-amount"><Input id="po-d-amount" type="number" min={0} value={dPayAmt} onChange={(e) => setDPayAmt(e.target.value)} placeholder="0.00" /></FormField>
                      <FormField label="Method" htmlFor="po-d-method"><Select value={dPayMethod} onValueChange={(v) => setDPayMethod(v)}><SelectTrigger id="po-d-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select></FormField>
                      <FormField label="Date" htmlFor="po-d-date"><Input id="po-d-date" type="date" max={today()} value={dPayDate} onChange={(e) => setDPayDate(e.target.value)} /></FormField>
                      <FormField label="Reference" htmlFor="po-d-ref"><Input id="po-d-ref" value={dPayRef} onChange={(e) => setDPayRef(e.target.value)} placeholder="Cheque / txn no." /></FormField>
                      <div className="sm:col-span-2"><Button type="button" disabled={busy} onClick={recordPay}>Record payment</Button></div>
                    </Card>
                  )}

                  {canReceive(view) && (
                    <FormField label="Receive at" htmlFor="po-receive-at" className="sm:max-w-xs">
                      <Select value={rcvLoc || "__none"} onValueChange={(v) => setRcvLoc(v === "__none" ? "" : v)}>
                        <SelectTrigger id="po-receive-at" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">Select location</SelectItem>
                          {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}

                  {dErr && <Alert variant="destructive"><AlertDescription>{dErr}</AlertDescription></Alert>}
                </div>

                <DialogFooter className="flex-wrap">
                  {view.status === "draft" && (
                    <Button type="button" disabled={busy} onClick={() => act(() => purchaseOrderApi.updateStatus(view.id, "sent"), "Marked as ordered")}>Mark ordered</Button>
                  )}
                  {canReceive(view) && (
                    <Button type="button" disabled={busy} onClick={receiveNow}>
                      {view.status === "partial" ? "Receive remaining" : "Receive stock"}
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => printPo(view)}><Printer className="size-4" aria-hidden /> Print</Button>
                  {(view.status === "draft" || view.status === "sent" || view.status === "partial") && (
                    <Button type="button" variant="destructive" disabled={busy}
                      onClick={() => {
                        if (receivedUnits > 0) { setDErr(`Stock has already been received against ${view.poNumber}. Use a supplier return instead of cancelling.`); return }
                        if (window.confirm(`Cancel ${view.poNumber}? This cannot be undone.`)) act(() => purchaseOrderApi.updateStatus(view.id, "cancelled"), "Purchase order cancelled")
                      }}>Cancel PO</Button>
                  )}
                  {(view.status === "draft" || view.status === "cancelled") && (
                    <Button type="button" variant="destructive" disabled={busy}
                      onClick={() => {
                        if (receivedUnits > 0) { setDErr(`Stock has been received against ${view.poNumber}, so it cannot be deleted.`); return }
                        if (view.payments.length > 0) { setDErr(`${view.poNumber} has payments recorded and cannot be deleted.`); return }
                        if (window.confirm(`Delete ${view.poNumber} permanently?`)) act(() => purchaseOrderApi.delete(view.id), "Purchase order deleted", true)
                      }}>Delete</Button>
                  )}
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )

  // Quick action straight from a table row
  async function act2(po: PurchaseOrder, fn: () => Promise<any>, ok: string) {
    try {
      await fn()
      toast.success(`${po.poNumber}: ${ok}`)
      refresh()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "That did not work.")
    }
  }
}
