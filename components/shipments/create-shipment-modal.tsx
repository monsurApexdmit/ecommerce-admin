"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { sellsApi } from "@/lib/sellsApi"
import { shipmentsApi, type ReadyOrder, type ShipmentResponse } from "@/lib/shipmentsApi"
import { shippingMethodApi, type ShippingMethod } from "@/lib/shippingMethodApi"
import { printShippingLabel } from "@/lib/shipping-label"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

export const COURIERS: { name: string; ini: string; color: string; sub: string }[] = [
  { name: "Pathao", ini: "PT", color: "#B42318", sub: "Courier" },
  { name: "Steadfast", ini: "SF", color: "#0F766E", sub: "Courier" },
  { name: "RedX", ini: "RX", color: "#C2410C", sub: "Courier" },
  { name: "Paperfly", ini: "PF", color: "#1A2F99", sub: "Courier" },
  { name: "Own rider", ini: "OR", color: "#3B4458", sub: "Your riders" },
  { name: "Other", ini: "··", color: "#5B6478", sub: "Enter manually" },
]

export function courierStyle(name?: string | null) {
  const found = COURIERS.find((c) => c.name.toLowerCase() === (name ?? "").toLowerCase())
  if (found) return found
  const label = (name || "Courier").trim()
  return { name: label, ini: label.slice(0, 2).toUpperCase(), color: "#5B6478", sub: "Courier" }
}

const PACKS = [
  { id: "pouch", label: "Small pouch", weight: 0.5, dims: "25×20×3" },
  { id: "box-m", label: "Medium box", weight: 1.5, dims: "30×20×15" },
  { id: "box-l", label: "Large box", weight: 4, dims: "45×35×25" },
  { id: "custom", label: "Custom", weight: 1, dims: "" },
]

const sectionTitle = "text-[13px] font-bold uppercase tracking-[0.06em] text-dash-muted"
const field =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

const r2 = (n: number) => Math.round(n * 100) / 100

const isoDay = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  /** Pre-select an order (from the Orders page) */
  preselectOrderId?: number | null
  onCreated: () => void
}

export function CreateShipmentModal({ open, onOpenChange, preselectOrderId, onCreated }: Props) {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()

  const [orders, setOrders] = useState<ReadyOrder[]>([])
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [picked, setPicked] = useState<ReadyOrder | null>(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [orderSearch, setOrderSearch] = useState("")
  const [orderId, setOrderId] = useState<number | null>(null)

  const [courier, setCourier] = useState("Steadfast")
  const [customCarrier, setCustomCarrier] = useState("")
  const [rider, setRider] = useState("")
  const [tracking, setTracking] = useState("")
  const [pack, setPack] = useState("pouch")
  const [weight, setWeight] = useState("0.5")
  const [dims, setDims] = useState("25×20×3")
  const [pickup, setPickup] = useState(isoDay(0))
  const [note, setNote] = useState("")
  const [printLabel, setPrintLabel] = useState(true)
  const [markPicked, setMarkPicked] = useState(true)
  const [saving, setSaving] = useState(false)

  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [speed, setSpeed] = useState<"regular" | "express">("regular")
  const [feeOv, setFeeOv] = useState<string | null>(null)
  const [codOv, setCodOv] = useState<string | null>(null)
  const [payer, setPayer] = useState<"customer" | "us">("customer")
  const [addrOv, setAddrOv] = useState<string | null>(null)

  // Server-side search (debounced), no row cap
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingOrders(true)
    const t = setTimeout(() => {
      shipmentsApi
        .getReadyToShip({ search: orderSearch.trim().replace(/^#/, "") || undefined, per_page: 50 })
        .then((r) => { if (!cancelled) { setOrders(r.orders); setOrdersTotal(r.total) } })
        .catch(() => { if (!cancelled) { setOrders([]); setOrdersTotal(0) } })
        .finally(() => { if (!cancelled) setLoadingOrders(false) })
    }, orderSearch ? 300 : 0)
    return () => { cancelled = true; clearTimeout(t) }
  }, [open, orderSearch])

  // Pre-selected order (from the Orders page)
  useEffect(() => {
    if (!open || !preselectOrderId) return
    sellsApi.getById(preselectOrderId).then((r) => {
      const o = r.data
      const due = Number(o.dueAmount ?? 0)
      const ro: ReadyOrder = {
        id: o.id, sellId: o.id, invoiceNo: o.invoiceNo, customerName: o.customerName, customerPhone: o.shippingPhone,
        address: [o.shippingAddressLine1, o.shippingState, o.shippingCity].filter(Boolean).join(", "),
        amount: Number(o.amount), dueAmount: due, shippingCost: Number(o.shippingCost) || 0,
        paymentMethod: o.method, paymentLabel: due <= 0 ? "Paid" : o.method === "COD" ? "COD" : "Unpaid",
        isCod: o.method === "COD", itemCount: o.items?.reduce((n, i) => n + (i.quantity ?? 1), 0) ?? 0,
        shippingMethod: o.shippingMethodName,
      }
      setPicked(ro); setOrderId(ro.id)
    }).catch(() => {})
  }, [open, preselectOrderId])

  useEffect(() => {
    if (!open || methods.length > 0) return
    shippingMethodApi.getAll().then(setMethods).catch(() => {})
  }, [open, methods.length])

  const order = orders.find((o) => o.id === orderId) ?? (picked?.id === orderId ? picked : null)
  const due = order && order.paymentLabel !== "Paid" ? Number(order.dueAmount) || 0 : 0
  // The courier name is never overwritten by the rider field
  const carrierName = courier === "Other" ? customCarrier.trim() || "Other" : courier
  const riderName = rider.trim()

  // Speed options come from the order's shipping method (regular price, express rate, days)
  const method = order ? methods.find((m) => m.name === order.shippingMethod) : undefined
  const ownRider = courier === "Own rider"
  const baseFee = ownRider ? 0 : Number(order?.shippingCost) || Number(method?.price) || 0
  const expressFee = Number(method?.expressRate) || 0
  const speeds = [
    { id: "regular" as const, label: "Regular", sub: method?.estimatedDays || "Standard delivery", fee: baseFee },
    ...(expressFee > 0 ? [{ id: "express" as const, label: "Express", sub: "Next day", fee: ownRider ? 0 : expressFee }] : []),
  ]
  const activeSpeed = speeds.find((s) => s.id === speed) ?? speeds[0]
  const fee = Math.max(0, feeOv !== null ? Number(feeOv) || 0 : activeSpeed.fee)
  const autoCod = r2(due + (payer === "customer" && due > 0 ? fee : 0))
  const cod = Math.max(0, codOv !== null ? Number(codOv) || 0 : autoCod)
  const codFee = r2(cod * 0.01)
  const net = r2(cod - fee - codFee)

  const [minDays, maxDays] = useMemo(() => {
    if (activeSpeed.id === "express") return [1, 1]
    const nums = (method?.estimatedDays ?? "").match(/\d+/g)?.map(Number) ?? []
    return nums.length >= 2 ? [nums[0], nums[1]] : nums.length === 1 ? [nums[0], nums[0]] : [2, 2]
  }, [activeSpeed.id, method?.estimatedDays])
  const addDays = (n: number) => {
    const d = new Date(`${pickup}T00:00:00`)
    if (Number.isNaN(d.getTime())) return null
    d.setDate(d.getDate() + n)
    return d
  }
  const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—")
  const etaTxt = minDays === maxDays ? fmtDay(addDays(minDays)) : `${fmtDay(addDays(minDays))} – ${fmtDay(addDays(maxDays))}`

  const addrDefault = order?.address ?? ""
  const addr = addrOv !== null ? addrOv : addrDefault

  const pickPack = (id: string) => {
    setPack(id)
    const p = PACKS.find((x) => x.id === id)!
    if (id !== "custom") { setWeight(String(p.weight)); setDims(p.dims) }
  }

  const reset = () => {
    setOrderId(null); setOrderSearch(""); setCourier("Steadfast"); setCustomCarrier(""); setRider(""); setTracking(""); setPicked(null)
    pickPack("pouch"); setNote(""); setPrintLabel(true); setMarkPicked(true)
    setSpeed("regular"); setFeeOv(null); setCodOv(null); setPayer("customer"); setPickup(isoDay(0)); setAddrOv(null)
  }

  const submit = async () => {
    if (!order) return
    if (!addr.trim()) {
      toast({ variant: "destructive", title: "Delivery address required", description: "Enter where this parcel is going" })
      return
    }
    setSaving(true)
    try {
      // Keep the sale's address in step with what the courier will be given
      if (addrOv !== null && addrOv.trim() !== addrDefault) {
        await sellsApi.update(order.sellId, { shippingAddressLine1: addrOv.trim() } as any).catch(() => {})
      }
      const end = addDays(maxDays)
      const res = await shipmentsApi.create({
        sellId: order.sellId,
        trackingNumber: tracking.trim() || undefined,
        carrier: carrierName,
        rider: riderName || undefined,
        package: pack,
        shippingMethod: order.shippingMethod || undefined,
        status: "pending",
        markShipped: markPicked,
        // Backend expects RFC 3339
        estimatedDelivery: end ? `${new Date(end.getTime() - end.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00:00Z` : undefined,
        shippingCost: fee,
        codAmount: cod,
        deliveryPayer: payer,
        deliverySpeed: activeSpeed.id,
        pickupDate: pickup || undefined,
        weight: Number(weight) || undefined,
        dimensions: dims.trim() || undefined,
        notes: note.trim() || undefined,
      })
      toast({ title: "Shipment created", description: `#${order.invoiceNo} · ${carrierName}` })
      if (printLabel && res?.data) {
        printShippingLabel(res.data as ShipmentResponse, {
          cod, formatCurrency,
          order: { customerName: order.customerName, shippingFullName: order.customerName, shippingPhone: order.customerPhone ?? undefined,
            shippingAddressLine1: addr.trim() } as any,
        })
      }
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Could not create shipment", description: err?.response?.data?.message || "Please try again" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[1040px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[1040px]"
      >
        <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
          <DialogTitle className="font-dash-display text-[22px] font-bold">Create shipment</DialogTitle>
          <DialogDescription className="text-[13px] text-dash-muted">Pick an order, choose a courier, and we’ll fill in the rest.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-wrap items-stretch overflow-y-auto">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] px-6 py-5">
            {/* 1 · Order */}
            <fieldset className="flex flex-col gap-2.5">
              <legend className={cn(sectionTitle, "mb-2.5")}>1 · Order</legend>
              {!order ? (
                <>
                  <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                    <Search className="size-[18px]" aria-hidden />
                    <span className="sr-only">Search orders</span>
                    <input type="search" placeholder="Search by invoice number, customer or phone…" value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
                  </label>
                  <div role="listbox" aria-label="Orders ready to ship" className="max-h-[260px] overflow-y-auto rounded-xl border border-dash-border">
                    <div className="bg-dash-bg px-3 py-2 text-xs font-semibold text-dash-muted">
                      {loadingOrders ? "Loading orders…" : `Ready to ship · ${ordersTotal} order${ordersTotal === 1 ? "" : "s"}${ordersTotal > orders.length ? ` (showing ${orders.length}, search to narrow)` : ""}`}
                    </div>
                    {orders.map((o) => {
                      return (
                        <button key={o.id} type="button" role="option" aria-selected={false} onClick={() => { setPicked(o); setOrderId(o.id); setAddrOv(null); setFeeOv(null); setCodOv(null) }}
                          className="flex min-h-14 w-full items-center gap-3 border-t border-dash-border-soft bg-dash-card px-3 py-2 text-left hover:bg-dash-neutral-soft">
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-semibold">#{o.invoiceNo}</span>
                            <span className="text-xs text-dash-muted">
                              {o.customerName} · {o.address || "Address missing"}
                            </span>
                          </span>
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-bold",
                            o.paymentLabel === "Paid" ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-warn-soft text-dash-warn-fg")}>
                            {o.paymentLabel === "Paid" ? "Paid" : o.isCod ? "COD" : "Unpaid"}
                          </span>
                          <span className="w-[90px] text-right font-bold tabular-nums">{formatCurrency(Number(o.amount))}</span>
                        </button>
                      )
                    })}
                    {!loadingOrders && orders.length === 0 && (
                      <p className="border-t border-dash-border-soft p-4 text-sm text-dash-muted">{orderSearch ? "No matching orders are waiting for a shipment." : "No orders are waiting for a shipment."}</p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-4 rounded-xl border-2 border-dash-accent bg-dash-accent-soft/50 px-4 py-3.5">
                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                    <span className="text-[15px] font-bold">#{order.invoiceNo}</span>
                    <span className="text-[13px]">
                      {order.itemCount} items · {formatCurrency(Number(order.amount))} ·{" "}
                      <span className="font-bold">{order.paymentLabel === "Paid" ? "Paid" : order.isCod ? "Cash on delivery" : "Unpaid"}</span>
                    </span>
                  </div>
                  <div className="flex min-w-[260px] flex-1 flex-col gap-1 text-[13px]">
                    <span className="font-bold">{order.customerName}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</span>
                    <label className="flex flex-col gap-1 text-xs font-semibold text-dash-muted">Delivery address *
                      <input className={cn(field, "h-10 font-normal")} placeholder="House, road, area, city" value={addr}
                        onChange={(e) => setAddrOv(e.target.value)} />
                    </label>
                  </div>
                  <button type="button" onClick={() => setOrderId(null)}
                    className="h-9 self-start rounded-lg border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                    Change
                  </button>
                </div>
              )}
            </fieldset>

            {/* 2 · Courier */}
            <fieldset className="flex flex-col gap-2.5">
              <legend className={cn(sectionTitle, "mb-2.5")}>2 · Courier</legend>
              <div role="radiogroup" aria-label="Courier" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                {COURIERS.map((c) => {
                  const on = courier === c.name
                  return (
                    <button key={c.name} type="button" role="radio" aria-checked={on} onClick={() => { setCourier(c.name); setFeeOv(null); setCodOv(null) }}
                      className={cn("flex min-h-16 items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-left",
                        on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] text-xs font-bold text-white" style={{ background: c.color }}>{c.ini}</span>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">{c.name}</span>
                        <span className="text-xs text-dash-muted">{c.sub}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {courier !== "Own rider" && courier !== "Other" && (
                <div className="flex items-start gap-2 rounded-xl bg-dash-success-soft px-3.5 py-2.5 text-[13px] text-dash-success-fg">
                  <span aria-hidden>✓</span>
                  <span>Live {courier} booking is not connected. Enter its tracking number below, or leave it blank to generate a reference.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Tracking number
                  <input className={field} placeholder="Leave blank to auto-generate" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </label>
                {courier === "Other" && (
                  <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Courier name
                    <input className={field} placeholder="e.g. Sundarban" value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
                  </label>
                )}
                <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Rider (optional)
                  <input className={field} placeholder="e.g. Sumon" value={rider} onChange={(e) => setRider(e.target.value)} />
                </label>
              </div>
              <div role="radiogroup" aria-label="Delivery speed" className="grid grid-cols-2 gap-2.5">
                {speeds.map((s) => {
                  const on = activeSpeed.id === s.id
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={on} onClick={() => { setSpeed(s.id); setFeeOv(null); setCodOv(null) }}
                      className={cn("flex items-center justify-between gap-3 rounded-xl border-2 px-3.5 py-2.5 text-left",
                        on ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                      <span className="flex flex-col">
                        <span className="text-sm font-semibold">{s.label}</span>
                        <span className="text-xs text-dash-muted">{s.sub}</span>
                      </span>
                      <span className="text-base font-bold tabular-nums">{formatCurrency(s.fee)}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            {/* 3 · Package */}
            <fieldset className="flex flex-col gap-2.5">
              <legend className={cn(sectionTitle, "mb-2.5")}>3 · Package</legend>
              <div role="radiogroup" aria-label="Package size" className="flex flex-wrap gap-2">
                {PACKS.map((p) => {
                  const on = pack === p.id
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => pickPack(p.id)}
                      className={cn("h-10 rounded-full border px-3.5 text-[13px] font-semibold",
                        on ? "border-dash-ink bg-dash-ink text-dash-bg" : "border-dash-border bg-dash-card text-dash-ink")}>
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Weight (kg)
                  <input className={field} type="number" step="0.1" min={0} value={weight} onChange={(e) => { setWeight(e.target.value); setPack("custom") }} />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Size (L×W×H cm)
                  <input className={field} value={dims} onChange={(e) => { setDims(e.target.value); setPack("custom") }} />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Pickup date
                  <input className={field} type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} />
                </label>
                <label className="col-span-3 flex flex-col gap-1.5 text-[13px] font-semibold">Note for rider
                  <textarea rows={2} placeholder="e.g. Fragile, call before delivery" value={note} onChange={(e) => setNote(e.target.value)}
                    className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none placeholder:text-dash-muted focus-visible:border-dash-accent" />
                </label>
              </div>
            </fieldset>
          </div>

          <aside aria-label="Charges" className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 border-l border-dash-border bg-dash-bg px-6 py-5">
            <span className={sectionTitle}>4 · Cash on delivery</span>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Amount to collect
              <input className={cn(field, "h-12 text-lg font-bold tabular-nums")} type="number" min={0} step="0.01" disabled={!order}
                value={codOv !== null ? codOv : String(autoCod)} onChange={(e) => setCodOv(e.target.value)} />
              <span className="text-xs font-normal text-dash-muted">
                {!order ? "Select an order first" : due === 0 ? "Order is already paid — nothing to collect"
                  : `Order due ${formatCurrency(due)}${payer === "customer" ? ` + delivery ${formatCurrency(fee)}` : ""}`}
              </span>
            </label>
            <div role="radiogroup" aria-label="Who pays delivery" className="grid grid-cols-2 gap-1 rounded-[10px] bg-dash-neutral-soft p-1">
              {([["customer", "Customer pays delivery"], ["us", "We pay delivery"]] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={payer === id} onClick={() => { setPayer(id); setCodOv(null) }}
                  className={cn("min-h-9 rounded-lg px-2 text-[13px] font-semibold", payer === id ? "bg-dash-card shadow-sm" : "text-dash-muted")}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 rounded-xl border border-dash-border bg-dash-card p-3.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-dash-muted">Delivery charge</span>
                <input type="number" min={0} step="0.01" aria-label="Delivery charge" value={feeOv !== null ? feeOv : String(activeSpeed.fee)}
                  onChange={(e) => { setFeeOv(e.target.value); setCodOv(null) }}
                  className="h-9 w-[110px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-right text-sm tabular-nums outline-none focus-visible:border-dash-accent" />
              </div>
              <div className="flex justify-between"><span className="text-dash-muted">COD fee (1%)</span><span className="font-semibold tabular-nums">−{formatCurrency(codFee)}</span></div>
              <div className="flex justify-between"><span className="text-dash-muted">Customer pays</span><span className="font-semibold tabular-nums">{formatCurrency(cod)}</span></div>
              <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2.5">
                <span className="font-bold">You receive</span>
                <span className="font-dash-display text-[26px] font-bold tabular-nums">{formatCurrency(net)}</span>
              </div>
              <span className="text-xs text-dash-muted">Paid out by {carrierName} after delivery</span>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-dash-border bg-dash-card px-3.5 py-3 text-[13px]">
              <span className="font-bold">Estimated delivery</span>
              <span className="text-dash-neutral-fg">{etaTxt}</span>
            </div>
            <label className="flex min-h-8 items-center gap-2.5 text-sm">
              <input type="checkbox" checked={printLabel} onChange={(e) => setPrintLabel(e.target.checked)} className="size-[18px] accent-[var(--dash-accent)]" />
              Print shipping label
            </label>
            <label className="flex min-h-8 items-center gap-2.5 text-sm">
              <input type="checkbox" checked={markPicked} onChange={(e) => setMarkPicked(e.target.checked)} className="size-[18px] accent-[var(--dash-accent)]" />
              Mark order as Shipped
            </label>
          </aside>
        </div>

        <DialogFooter className="flex flex-row flex-wrap items-center gap-2.5 border-t border-dash-border bg-dash-card px-6 py-4 sm:justify-between">
          <span className="text-[13px] text-dash-muted">{order ? `Shipping #${order.invoiceNo} with ${carrierName}` : "Select an order to continue"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="h-12 rounded-xl border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">Cancel</button>
            <button type="button" onClick={submit} disabled={!order || saving}
              className="h-12 rounded-xl bg-dash-accent px-[22px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? "Creating…" : "Create shipment"}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
