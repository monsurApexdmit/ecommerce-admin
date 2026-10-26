"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Banknote, Download, Eye, Package, Plus, Printer, Search, X } from "lucide-react"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
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

type Tab = "all" | "draft" | "ordered" | "partial" | "received" | "cancelled"

const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Ordered", partial: "Partly received", received: "Received", cancelled: "Cancelled" }
const STATUS_STYLE: Record<string, string> = {
  draft: "bg-dash-neutral-soft text-dash-neutral-fg",
  sent: "bg-dash-accent-soft text-dash-accent-fg",
  partial: "bg-dash-warn-soft text-dash-warn-fg",
  received: "bg-dash-success-soft text-dash-success-fg",
  cancelled: "bg-dash-danger-soft text-dash-danger-fg",
}
const DOT: Record<string, string> = {
  draft: "bg-dash-muted", ordered: "bg-dash-accent", partial: "bg-dash-warn", received: "bg-dash-success", cancelled: "bg-dash-danger",
}
const PAY_STYLE: Record<string, string> = {
  paid: "bg-dash-success-soft text-dash-success-fg",
  partially_paid: "bg-dash-warn-soft text-dash-warn-fg",
  pending: "bg-dash-danger-soft text-dash-danger-fg",
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

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const primaryBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const filterSelect = "h-11 rounded-[10px] border-dash-border bg-dash-card text-[13px] font-semibold"

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}{children}
      {hint && <span className="text-xs font-normal text-dash-muted">{hint}</span>}
    </label>
  )
}

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Purchase orders</h1>
          <p className="mt-1 text-sm text-dash-muted">Order stock from suppliers, receive it into inventory, and track what you owe.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleExport} disabled={exporting} className={outlineBtn}><Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export"}</button>
          <button type="button" onClick={openForm} className={primaryBtn}><Plus className="size-4" aria-hidden /> New purchase order</button>
        </div>
      </div>

      {/* Reorder banner */}
      {stats && stats.reorderCount > 0 && (
        <div className="flex flex-wrap items-center gap-3.5 rounded-xl bg-dash-accent-soft px-[18px] py-3.5 text-dash-accent-fg">
          <Package className="size-[22px] shrink-0" aria-hidden />
          <span className="min-w-[260px] flex-1 text-sm">
            <strong>{stats.reorderCount} product{stats.reorderCount === 1 ? " is" : "s are"} at or below their reorder point.</strong>{" "}
            Review suggested quantities and create the order in one go.
          </span>
          <button type="button" onClick={() => { openForm(); setLines(lowProducts.map((p) => mkLine(p, suggestQty(p)))) }}
            className="h-10 rounded-[10px] bg-dash-accent-fg px-3.5 text-[13px] font-semibold text-dash-accent-soft">
            Create from suggestions
          </button>
        </div>
      )}

      {/* Pipeline */}
      <section aria-label="Pipeline" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {pipe.map((p) => (
          <button key={p.key} type="button" onClick={() => changeTab(p.key)} aria-pressed={tab === p.key}
            className={cn("flex flex-col gap-1 rounded-[14px] border bg-dash-card px-4 py-3.5 text-left transition-colors hover:bg-dash-neutral-soft", tab === p.key ? "border-dash-accent" : "border-dash-border")}>
            <span className="flex items-center gap-2 text-[13px] text-dash-muted"><span className={cn("size-2 rounded-full", DOT[p.key])} />{p.label}</span>
            <span className="font-dash-display text-2xl font-bold tabular-nums">{by ? by[p.key as keyof typeof by].count : "–"}</span>
            <span className="text-xs text-dash-muted tabular-nums">{formatCurrency(by ? by[p.key as keyof typeof by].amount : 0)}</span>
          </button>
        ))}
      </section>

      {/* Table card */}
      <section className="rounded-[14px] border border-dash-border bg-dash-card">
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

        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden />
            <span className="sr-only">Search purchase orders</span>
            <input type="search" placeholder="Search PO number, supplier or product…" value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <Select value={fSup} onValueChange={(v) => { setFSup(v); setPage(1) }}>
            <SelectTrigger aria-label="Supplier" className={cn(filterSelect, "w-[170px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Supplier: All</SelectItem>
              {vendors.map((v) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fPay} onValueChange={(v) => { setFPay(v); setPage(1) }}>
            <SelectTrigger aria-label="Payment" className={cn(filterSelect, "w-[140px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Payment: All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fLoc} onValueChange={(v) => { setFLoc(v); setPage(1) }}>
            <SelectTrigger aria-label="Location" className={cn(filterSelect, "w-[160px]")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Location: All</SelectItem>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <button type="button" onClick={() => { setSearch(""); setFSup("all"); setFPay("all"); setFLoc("all"); setTab("all"); setPage(1) }}
              className="inline-flex h-11 items-center gap-1 px-2 text-[13px] font-semibold text-dash-muted hover:text-dash-ink">
              <X className="size-4" aria-hidden /> Clear
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th scope="col" className="py-3 pl-4 pr-2 font-semibold">Purchase order</th>
                <th scope="col" className="px-2 py-3 font-semibold">Supplier</th>
                <th scope="col" className="px-2 py-3 font-semibold">Items</th>
                <th scope="col" className="px-2 py-3 font-semibold">Status</th>
                <th scope="col" className="px-2 py-3 font-semibold">Received</th>
                <th scope="col" className="px-2 py-3 font-semibold">Expected</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Total</th>
                <th scope="col" className="px-2 py-3 text-right font-semibold">Paid</th>
                <th scope="col" className="px-2 py-3 font-semibold">Payment</th>
                <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Next step</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={10} className="px-4 py-3"><Skeleton className="h-10 rounded" /></td></tr>)
              ) : pos.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center">
                    <Package className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                    <p className="font-semibold">No purchase orders found</p>
                    <p className="text-sm text-dash-muted">{hasFilters ? "Try clearing the filters." : "Create your first purchase order with New purchase order."}</p>
                  </td>
                </tr>
              ) : (
                pos.map((p) => {
                  const ordered = p.unitsOrdered ?? p.items.reduce((a, i) => a + i.quantityOrdered, 0)
                  const received = p.unitsReceived ?? p.items.reduce((a, i) => a + i.quantityReceived, 0)
                  const pct = ordered > 0 ? Math.round((received / ordered) * 100) : 0
                  const note = expNote(p)
                  return (
                    <tr key={p.id}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <button type="button" onClick={() => openView(p)} className="text-left font-bold hover:underline">{p.poNumber}</button>
                        <div className="text-xs text-dash-muted">Created {fmtDate(p.createdAt)} · {p.locationName ?? "—"}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 font-semibold">{p.vendorName}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="max-w-[200px] truncate">{p.itemsSummary || `${p.items.length} item${p.items.length === 1 ? "" : "s"}`}</div>
                        <div className="text-xs text-dash-muted">{ordered} units</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS_STYLE[p.status])}>{STATUS_LABEL[p.status] ?? p.status}</span>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div className="text-[13px] tabular-nums">{received} / {ordered}</div>
                        <div className="mt-1 h-1.5 w-[110px] overflow-hidden rounded-full bg-dash-neutral-soft">
                          <div className="h-full rounded-full bg-dash-success" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <div>{fmtDate(p.expectedDate)}</div>
                        {note && <div className={cn("text-xs", p.isOverdue ? "font-semibold text-dash-danger-fg" : "text-dash-muted")}>{note}</div>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums">
                        {formatCurrency(p.totalAmount)}
                        {p.dueAmount > 0 && p.status !== "cancelled" && <div className="text-xs font-medium text-dash-danger-fg">Due {formatCurrency(p.dueAmount)}</div>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-right tabular-nums">{formatCurrency(p.paidAmount)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-md px-2.5 py-[3px] text-xs font-bold", PAY_STYLE[p.paymentStatus] ?? PAY_STYLE.pending)}>{PAY_LABEL[p.paymentStatus] ?? p.paymentStatus}</span>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {p.status === "draft" && (
                            <button type="button" className="mr-1 text-[13px] font-semibold text-dash-accent hover:underline"
                              onClick={() => act2(p, () => purchaseOrderApi.updateStatus(p.id, "sent"), "Marked as ordered")}>Mark ordered</button>
                          )}
                          {canReceive(p) && (
                            <button type="button" className="mr-1 text-[13px] font-semibold text-dash-accent hover:underline" onClick={() => (p.status === "partial" ? receiveRest(p) : openView(p))}>{p.status === "partial" ? "Receive rest" : "Receive stock"}</button>
                          )}
                          <button type="button" aria-label={`View ${p.poNumber}`} className={iconBtn} onClick={() => openView(p)}><Eye className="size-4" /></button>
                          <button type="button" aria-label={`Print ${p.poNumber}`} className={iconBtn} onClick={() => printPo(p)}><Printer className="size-4" /></button>
                          {p.dueAmount > 0 && p.status !== "cancelled" && (
                            <button type="button" aria-label={`Record payment for ${p.poNumber}`} className={iconBtn} onClick={() => openView(p)}><Banknote className="size-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {!loading && pos.length > 0 && (
          <div className="border-t border-dash-border-soft p-4 pt-3">
            <PaginationControl
              currentPage={page}
              totalPages={Math.max(1, Math.ceil(total / perPage))}
              itemsPerPage={perPage}
              totalItems={total}
              onPageChange={setPage}
              onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
            />
          </div>
        )}
        <div className="border-t border-dash-border-soft px-4 py-3 text-xs text-dash-muted tabular-nums">
          Showing {total} purchase order{total === 1 ? "" : "s"}
          {` · ${formatCurrency(filteredDue)} still to pay`}
        </div>
      </section>

      {/* ---------------- New purchase order ---------------- */}
      <Dialog open={formOpen} onOpenChange={(o) => { if (!o) setFormOpen(false) }}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[1040px]">
          <div className="border-b border-dash-border-soft px-6 py-4">
            <DialogTitle className="font-dash-display text-xl font-bold">New purchase order</DialogTitle>
            <DialogDescription className="text-[13px]">Number assigned when saved · {fmtDate(today())}</DialogDescription>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="flex min-w-0 flex-col gap-5">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">1 · Supplier &amp; delivery</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Supplier *">
                    <select className={input} value={supId} onChange={(e) => { setSupId(e.target.value); setExpTouched(false) }}>
                      <option value="">Select supplier</option>
                      {vendors.filter((v) => v.status === "Active" || String(v.id) === supId).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Receive at">
                    <select className={input} value={locId} onChange={(e) => setLocId(e.target.value)}>
                      <option value="">Select location</option>
                      {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Expected delivery" hint={expTouched ? undefined : `Based on ${supplier?.leadTimeDays && supplier.leadTimeDays > 0 ? `${supplier.leadTimeDays}-day lead time` : "a 7-day default"}`}>
                    <input type="date" className={input} min={today()} value={expDate} onChange={(e) => { setExpDate(e.target.value); setExpTouched(true) }} />
                  </Field>
                </div>
                {supplier && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-[10px] bg-dash-neutral-soft px-3.5 py-2.5 text-[13px]">
                    <span><span className="text-dash-muted">Terms</span> <strong>{supplier.paymentTerms || "Not set"}</strong></span>
                    <span><span className="text-dash-muted">Lead time</span> <strong>{supplier.leadTimeDays ? `${supplier.leadTimeDays} days` : "—"}</strong></span>
                    <span><span className="text-dash-muted">You already owe</span> <strong>{formatCurrency(supplier.owed)}</strong></span>
                    <span><span className="text-dash-muted">Phone</span> <strong>{supplier.phone || "—"}</strong></span>
                  </div>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">2 · Items</legend>
                {missingLow > 0 && (
                  <div><button type="button" onClick={addLow} className="h-9 rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft">+ Add {missingLow} low-stock item{missingLow === 1 ? "" : "s"}</button></div>
                )}
                <div className="overflow-hidden rounded-xl border border-dash-border">
                  <div className="hidden grid-cols-[1fr_70px_130px_110px_100px_32px] gap-2 bg-dash-bg px-3 py-2 text-xs font-semibold text-dash-muted sm:grid">
                    <span>Product</span><span>In stock</span><span>Qty</span><span>Unit cost</span><span className="text-right">Line total</span><span />
                  </div>
                  {lines.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[13px] text-dash-muted">No items yet — search a product below to add it.</div>
                  ) : lines.map((l) => (
                    <div key={l.key} className="grid grid-cols-2 items-center gap-2 border-t border-dash-border-soft px-3 py-2.5 sm:grid-cols-[1fr_70px_130px_110px_100px_32px]">
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <div className="truncate text-sm font-semibold">{l.name}</div>
                        <div className="text-xs text-dash-muted">{l.sku || "—"} · last cost {formatCurrency(l.lastCost)}</div>
                        {l.variants.length > 0 && (
                          <select aria-label="Variant" className="mt-1 h-8 rounded-lg border border-dash-border bg-dash-card px-2 text-xs" value={l.variantId} onChange={(e) => patchLine(l.key, { variantId: e.target.value })}>
                            <option value="">Any variant</option>
                            {l.variants.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        )}
                      </div>
                      <span className="text-sm tabular-nums">{l.stock}</span>
                      <div className="flex items-center">
                        <button type="button" aria-label="Decrease" onClick={() => patchLine(l.key, { qty: Math.max(1, l.qty - 1) })} className="h-9 w-8 rounded-l-lg border border-dash-border">−</button>
                        <input type="number" min={1} aria-label="Quantity" value={l.qty} onChange={(e) => patchLine(l.key, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                          className="h-9 w-[52px] border-y border-dash-border bg-dash-card text-center text-sm outline-none" />
                        <button type="button" aria-label="Increase" onClick={() => patchLine(l.key, { qty: l.qty + 1 })} className="h-9 w-8 rounded-r-lg border border-dash-border">+</button>
                      </div>
                      <input type="number" min={0} step="0.01" aria-label="Unit cost" value={l.cost} onChange={(e) => patchLine(l.key, { cost: Number(e.target.value) || 0 })}
                        className="h-9 w-full rounded-lg border border-dash-border bg-dash-card px-2 text-sm outline-none focus-visible:border-dash-accent" />
                      <span className="text-right text-sm font-bold tabular-nums">{formatCurrency(l.qty * l.cost)}</span>
                      <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} className="text-lg text-dash-muted hover:text-dash-danger-fg">×</button>
                    </div>
                  ))}
                </div>
                <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                  <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search product</span>
                  <input type="search" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search product to add…"
                    className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
                </label>
                {results.length > 0 && (
                  <div className="flex flex-col overflow-hidden rounded-xl border border-dash-border">
                    {results.map((p) => (
                      <button key={p.id} type="button" onClick={() => addProduct(p)} className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-3 py-2 text-left last:border-0 hover:bg-dash-neutral-soft">
                        <span className="text-sm font-semibold">{p.name} <span className="text-xs font-normal text-dash-muted">{p.sku}</span></span>
                        <span className="text-xs text-dash-muted">{p.stock} in stock · cost {formatCurrency(Number(p.costPrice ?? p.cost_price ?? 0))}</span>
                      </button>
                    ))}
                  </div>
                )}
              </fieldset>

              <Field label="Note to supplier">
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Deliver before 12 pm, pack in cartons of 12" className={cn(input, "h-auto py-2.5")} />
              </Field>
            </div>

            <aside aria-label="Totals and payment" className="flex flex-col gap-3 rounded-xl border border-dash-border-soft bg-dash-bg p-4 lg:self-start">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">3 · Totals</span>
              <div className="flex flex-col gap-2 text-[13px]">
                <div className="flex justify-between"><span className="text-dash-muted">Subtotal · {units} unit{units === 1 ? "" : "s"}</span><span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span></div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-dash-muted">Discount</span>
                  <span className="flex gap-1">
                    <select aria-label="Discount type" value={discType} onChange={(e) => setDiscType(e.target.value as "flat" | "percent")} className="h-8 rounded-lg border border-dash-border bg-dash-card px-1.5 text-xs">
                      <option value="flat">Flat</option><option value="percent">%</option>
                    </select>
                    <input type="number" min={0} step="any" aria-label="Discount" value={discVal} onChange={(e) => setDiscVal(e.target.value)} placeholder="0" className="h-8 w-20 rounded-lg border border-dash-border bg-dash-card px-2 text-right text-sm outline-none" />
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-dash-muted">Tax / VAT (%)</span>
                  <input type="number" min={0} max={100} step="any" aria-label="Tax rate" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} placeholder="0" className="h-8 w-24 rounded-lg border border-dash-border bg-dash-card px-2 text-right text-sm outline-none" />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-dash-muted">Shipping / freight</span>
                  <input type="number" min={0} step="any" aria-label="Shipping cost" value={shipCost} onChange={(e) => setShipCost(e.target.value)} placeholder="0" className="h-8 w-24 rounded-lg border border-dash-border bg-dash-card px-2 text-right text-sm outline-none" />
                </div>
                {(discount > 0 || tax > 0 || shipping > 0) && (
                  <div className="text-xs text-dash-muted">{[discount > 0 && `−${formatCurrency(discount)} discount`, tax > 0 && `+${formatCurrency(tax)} tax`, shipping > 0 && `+${formatCurrency(shipping)} shipping`].filter(Boolean).join(" · ")}</div>
                )}
                <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2">
                  <span className="font-bold">Total</span>
                  <span className="font-dash-display text-2xl font-bold tabular-nums">{formatCurrency(grand)}</span>
                </div>
              </div>

              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">4 · Payment to supplier</span>
              <div role="radiogroup" aria-label="Amount paid" className="grid grid-cols-3 gap-1.5">
                {([["none", "Pay later"], ["full", "Pay in full"], ["partial", "Advance"]] as const).map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={paidMode === id} onClick={() => setPaidMode(id)}
                    className={cn("h-10 rounded-lg border-2 text-xs font-semibold", paidMode === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                    {label}
                  </button>
                ))}
              </div>
              {paidMode === "partial" && (
                <Field label="Advance paid now"><input type="number" min={0} max={grand || undefined} className={input} value={partial} onChange={(e) => setPartial(e.target.value)} /></Field>
              )}
              {paidNow > 0 && (
                <div className="flex flex-col gap-2.5">
                  <Field label="Method"><select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
                  <Field label="Payment date"><input type="date" className={input} max={today()} value={payDate} onChange={(e) => setPayDate(e.target.value)} /></Field>
                  <Field label="Reference"><input className={input} value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Cheque / transaction no. (optional)" /></Field>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[10px] bg-dash-card px-3 py-2"><div className="text-[11px] text-dash-muted">Paid now</div><div className="font-bold tabular-nums">{formatCurrency(paidNow)}</div></div>
                <div className="rounded-[10px] bg-dash-card px-3 py-2"><div className="text-[11px] text-dash-muted">Due {supplier?.paymentTerms ? `(${supplier.paymentTerms})` : "later"}</div><div className="font-bold tabular-nums">{formatCurrency(dueNow)}</div></div>
              </div>
            </aside>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-dash-border-soft px-6 py-4">
            <span className="text-xs text-dash-muted">Stock is added only when you receive the goods.</span>
            {formError && <span role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{formError}</span>}
            <div className="ml-auto flex flex-wrap gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className={outlineBtn}>Cancel</button>
              <button type="button" disabled={saving} onClick={() => submit("draft")} className={outlineBtn}>Save draft</button>
              <button type="button" disabled={saving} onClick={() => submit("received")} className={outlineBtn}>Create &amp; receive now</button>
              <button type="button" disabled={saving} onClick={() => submit("sent")} className={primaryBtn}>{saving ? "Saving…" : "Create & send to supplier"}</button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------------- Detail ---------------- */}
      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-3xl">
          {view && (() => {
            const canPay = view.dueAmount > 0 && view.status !== "cancelled"
            const receivedUnits = view.items.reduce((a, i) => a + i.quantityReceived, 0)
            const hasAdj = (view.discountAmount ?? 0) > 0 || (view.taxAmount ?? 0) > 0 || (view.shippingCost ?? 0) > 0
            return (
              <>
                <div className="flex flex-wrap items-center gap-3 border-b border-dash-border-soft px-6 py-4">
                  <div className="min-w-0 flex-1">
                    <DialogTitle className="font-dash-display text-xl font-bold">{view.poNumber}</DialogTitle>
                    <DialogDescription className="text-[13px]">{view.vendorName} · {view.locationName ?? "—"} · Created {fmtDate(view.createdAt)}</DialogDescription>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS_STYLE[view.status])}>{STATUS_LABEL[view.status] ?? view.status}</span>
                </div>

                <div className="flex flex-col gap-4 p-6">
                  <div className="overflow-x-auto rounded-xl border border-dash-border">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead className="bg-dash-bg text-left text-xs text-dash-muted">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Product</th>
                          <th className="px-3 py-2 text-center font-semibold">Ordered</th>
                          <th className="px-3 py-2 text-center font-semibold">Received</th>
                          <th className="px-3 py-2 text-center font-semibold">{canReceive(view) ? "Receive now" : ""}</th>
                          <th className="px-3 py-2 text-right font-semibold">Unit cost</th>
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.items.map((i) => {
                          const remain = i.quantityOrdered - i.quantityReceived
                          return (
                            <tr key={i.id} className="border-t border-dash-border-soft">
                              <td className="px-3 py-2">{i.productName}{i.variantName && <span className="ml-1 text-xs text-dash-muted">· {i.variantName}</span>}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{i.quantityOrdered}</td>
                              <td className="px-3 py-2 text-center tabular-nums">{i.quantityReceived}</td>
                              <td className="px-3 py-2 text-center">
                                {canReceive(view) && remain > 0 ? (
                                  <input type="number" min={0} max={remain} aria-label={`Receive ${i.productName}`} value={rcvQty[i.id] ?? ""}
                                    onChange={(e) => setRcvQty((q) => ({ ...q, [i.id]: e.target.value }))}
                                    className="h-8 w-16 rounded-lg border border-dash-border bg-dash-card text-center text-sm outline-none focus-visible:border-dash-accent" />
                                ) : <span className="text-dash-muted">—</span>}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(i.unitCost)}</td>
                              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(i.subtotal)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {hasAdj && (
                    <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-[10px] bg-dash-neutral-soft px-3.5 py-2.5 text-[13px]">
                      <span><span className="text-dash-muted">Subtotal</span> <strong>{formatCurrency(view.subtotal ?? 0)}</strong></span>
                      {(view.discountAmount ?? 0) > 0 && <span><span className="text-dash-muted">Discount</span> <strong>−{formatCurrency(view.discountAmount ?? 0)}</strong></span>}
                      {(view.taxAmount ?? 0) > 0 && <span><span className="text-dash-muted">Tax {view.taxRate}%</span> <strong>+{formatCurrency(view.taxAmount ?? 0)}</strong></span>}
                      {(view.shippingCost ?? 0) > 0 && <span><span className="text-dash-muted">Shipping</span> <strong>+{formatCurrency(view.shippingCost ?? 0)}</strong></span>}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[10px] bg-dash-neutral-soft px-3 py-2"><div className="text-[11px] text-dash-muted">Total</div><div className="font-dash-display text-lg font-bold tabular-nums">{formatCurrency(view.totalAmount)}</div></div>
                    <div className="rounded-[10px] bg-dash-success-soft px-3 py-2 text-dash-success-fg"><div className="text-[11px]">Paid</div><div className="font-dash-display text-lg font-bold tabular-nums">{formatCurrency(view.paidAmount)}</div></div>
                    <div className={cn("rounded-[10px] px-3 py-2", view.dueAmount > 0 ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-neutral-soft")}><div className="text-[11px]">Due</div><div className="font-dash-display text-lg font-bold tabular-nums">{formatCurrency(view.dueAmount)}</div></div>
                  </div>

                  <div className="text-[13px] text-dash-muted">
                    Expected: <strong className="text-dash-ink">{fmtDate(view.expectedDate)}</strong>{expNote(view) ? ` (${expNote(view)})` : ""} · Payment:{" "}
                    <strong className="text-dash-ink">{PAY_LABEL[view.paymentStatus] ?? view.paymentStatus}</strong>
                  </div>
                  {view.notes && <div className="rounded-[10px] bg-dash-neutral-soft px-3.5 py-2.5 text-[13px]">Note: {view.notes}</div>}

                  {(view.receipts?.length ?? 0) > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Receiving history</div>
                      {view.receipts!.map((g) => (
                        <div key={g.id} className="flex justify-between gap-3 border-b border-dash-border-soft py-2 text-[13px] last:border-0">
                          <span>{fmtDate(g.date)} · {g.locationName ?? "—"}</span>
                          <span className="text-dash-muted">{g.itemsSummary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {view.payments.length > 0 && (
                    <div>
                      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Payments</div>
                      {view.payments.map((y) => (
                        <div key={y.id} className="flex justify-between gap-3 border-b border-dash-border-soft py-2 text-[13px] last:border-0">
                          <span>{fmtDate(y.date ?? y.paymentDate)} · {y.method ?? y.paymentMethod}{y.reference && <span className="ml-1 text-dash-muted">{y.reference}</span>}</span>
                          <span className="font-bold tabular-nums">{formatCurrency(y.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {canPay && (
                    <div className="grid gap-2.5 rounded-xl border border-dash-border bg-dash-bg p-3.5 sm:grid-cols-2">
                      <Field label="Payment amount"><input type="number" min={0} className={input} value={dPayAmt} onChange={(e) => setDPayAmt(e.target.value)} placeholder="0.00" /></Field>
                      <Field label="Method"><select className={input} value={dPayMethod} onChange={(e) => setDPayMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
                      <Field label="Date"><input type="date" className={input} max={today()} value={dPayDate} onChange={(e) => setDPayDate(e.target.value)} /></Field>
                      <Field label="Reference"><input className={input} value={dPayRef} onChange={(e) => setDPayRef(e.target.value)} placeholder="Cheque / txn no." /></Field>
                      <div className="sm:col-span-2"><button type="button" disabled={busy} onClick={recordPay} className={primaryBtn}>Record payment</button></div>
                    </div>
                  )}

                  {canReceive(view) && (
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold sm:max-w-xs">
                      Receive at
                      <select className={input} value={rcvLoc} onChange={(e) => setRcvLoc(e.target.value)}>
                        <option value="">Select location</option>
                        {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                      </select>
                    </label>
                  )}

                  {dErr && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{dErr}</p>}

                  <div className="flex flex-wrap justify-end gap-2 border-t border-dash-border-soft pt-4">
                    {view.status === "draft" && (
                      <button type="button" disabled={busy} className={primaryBtn} onClick={() => act(() => purchaseOrderApi.updateStatus(view.id, "sent"), "Marked as ordered")}>Mark ordered</button>
                    )}
                    {canReceive(view) && (
                      <button type="button" disabled={busy} className={primaryBtn} onClick={receiveNow}>
                        {view.status === "partial" ? "Receive remaining" : "Receive stock"}
                      </button>
                    )}
                    <button type="button" className={outlineBtn} onClick={() => printPo(view)}><Printer className="size-4" aria-hidden /> Print</button>
                    {(view.status === "draft" || view.status === "sent" || view.status === "partial") && (
                      <button type="button" disabled={busy} className={cn(outlineBtn, "text-dash-danger-fg")}
                        onClick={() => {
                          if (receivedUnits > 0) { setDErr(`Stock has already been received against ${view.poNumber}. Use a supplier return instead of cancelling.`); return }
                          if (window.confirm(`Cancel ${view.poNumber}? This cannot be undone.`)) act(() => purchaseOrderApi.updateStatus(view.id, "cancelled"), "Purchase order cancelled")
                        }}>Cancel PO</button>
                    )}
                    {(view.status === "draft" || view.status === "cancelled") && (
                      <button type="button" disabled={busy} className={cn(outlineBtn, "text-dash-danger-fg")}
                        onClick={() => {
                          if (receivedUnits > 0) { setDErr(`Stock has been received against ${view.poNumber}, so it cannot be deleted.`); return }
                          if (view.payments.length > 0) { setDErr(`${view.poNumber} has payments recorded and cannot be deleted.`); return }
                          if (window.confirm(`Delete ${view.poNumber} permanently?`)) act(() => purchaseOrderApi.delete(view.id), "Purchase order deleted", true)
                        }}>Delete</button>
                    )}
                  </div>
                </div>
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
