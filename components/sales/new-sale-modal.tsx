"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trash2 } from "lucide-react"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { customerApi } from "@/lib/customerApi"
import { inventoryApi } from "@/lib/inventoryApi"
import { useWarehouse } from "@/contexts/warehouse-context"
import { getPaymentMethods, sellMethodForSlug } from "@/lib/settingsApi"
import { shippingMethodApi, type ShippingMethod } from "@/lib/shippingMethodApi"
import { printSaleInvoice } from "@/lib/invoice-print"
import { useProduct } from "@/contexts/product-context"
import { useCustomer } from "@/contexts/customer-context"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { CustomerCombobox } from "@/components/pos/customer-combobox"
import { cn } from "@/lib/utils"

interface Row { productId: string; productName: string; quantity: number; price: number; discount: number; /** price follows the quantity (wholesale tiers) until edited by hand */ auto?: boolean }
const emptyRow = (): Row => ({ productId: "", productName: "", quantity: 1, price: 0, discount: 0 })

type PaidMode = "full" | "partial" | "none"
type PayMethod = "Cash" | "Card" | "bKash" | "Nagad" | "Bank" | "Online" | "COD"
type SaleStatus = "Pending" | "Processing" | "Packed" | "Shipped" | "Delivered"
const TX_METHODS: PayMethod[] = ["Online", "bKash", "Nagad", "Bank"]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,17}$/
const digits = (v: string) => v.replace(/\D/g, "")

/** Values accepted by the sells API (COD = collected on delivery). */
const METHODS: { value: PayMethod; label: string }[] = [
  { value: "Cash", label: "Cash" },
  { value: "Card", label: "Card" },
  { value: "bKash", label: "bKash" },
  { value: "Nagad", label: "Nagad" },
  { value: "Bank", label: "Bank" },
  { value: "Online", label: "Online" },
  { value: "COD", label: "COD" },
]

const STORE_PICKUP = "pickup"
const COURIERS = ["Own delivery", "Pathao", "Steadfast", "RedX", "Paperfly"]
const emptyShip = { name: "", phone: "", line1: "", city: "", state: "", zip: "", country: "" }

const sectionTitle = "text-[13px] font-bold uppercase tracking-[0.06em] text-dash-muted"
const field =
  "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

export function NewSaleModal({ open, onOpenChange, onCreated, initialCustomerId }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
  /** Pre-select a customer (e.g. from the Customers page) */
  initialCustomerId?: string
}) {
  const { products } = useProduct()
  const { customers, refreshCustomers, getCustomerById } = useCustomer()
  const { warehouses, defaultWarehouse } = useWarehouse()
  const { taxRate, formatCurrency, formatTaxLabel, settings } = useCompanySettings()
  const { toast } = useToast()

  const [customerId, setCustomerId] = useState("")
  const [customerName, setCustomerName] = useState("Walk-in Customer")
  const [rows, setRows] = useState<Row[]>([emptyRow()])
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([])
  const [delivery, setDelivery] = useState<string>(STORE_PICKUP)
  const [ship, setShip] = useState(emptyShip)
  const [deliveryNote, setDeliveryNote] = useState("")
  const [courier, setCourier] = useState(COURIERS[0])
  const [discount, setDiscount] = useState("")
  const [discType, setDiscType] = useState<"flat" | "percent">("flat")
  const [shipOverride, setShipOverride] = useState<string | null>(null)
  const [method, setMethod] = useState<PayMethod>("Cash")
  const [methodList, setMethodList] = useState(METHODS)
  const [defMethod, setDefMethod] = useState<PayMethod>("Cash")
  const [paidMode, setPaidMode] = useState<PaidMode>("full")
  const [partialAmount, setPartialAmount] = useState("")
  const [txId, setTxId] = useState("")
  const [status, setStatus] = useState<SaleStatus>("Pending")
  const [locationId, setLocationId] = useState("")
  const [stockMap, setStockMap] = useState<Record<string, Record<number, number>> | null>(null)
  const [tried, setTried] = useState(false)
  const [custErr, setCustErr] = useState("")
  const [note, setNote] = useState("")
  const [printAfter, setPrintAfter] = useState(true)
  const [saving, setSaving] = useState(false)

  // Quick add-customer
  const [addCustOpen, setAddCustOpen] = useState(false)
  const [newCust, setNewCust] = useState({ name: "", phone: "", email: "" })
  const [addingCust, setAddingCust] = useState(false)

  // Pre-select a customer handed in from another page
  useEffect(() => {
    if (!open || !initialCustomerId) return
    const c = getCustomerById(initialCustomerId)
    if (c) onCustomerChange(initialCustomerId, c.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCustomerId, customers.length])

  // payment methods enabled in settings; empty/unconfigured keeps the built-in list
  useEffect(() => {
    if (!open) return
    getPaymentMethods().then((pm) => {
      const vals = pm.posMethods.map((s) => sellMethodForSlug(s))
      const list = METHODS.filter((m) => vals.includes(m.value))
      if (list.length === 0) return
      const d = pm.posDefault ? (sellMethodForSlug(pm.posDefault) as PayMethod | undefined) : undefined
      const first = d && list.some((m) => m.value === d) ? d : list[0].value
      setMethodList(list); setDefMethod(first)
      setMethod((cur) => (list.some((m) => m.value === cur) ? cur : first))
    }).catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open || shippingMethods.length > 0) return
    shippingMethodApi.getAll().then((m) => setShippingMethods(m.filter((x) => x.isActive))).catch(() => {})
  }, [open, shippingMethods.length])

  useEffect(() => {
    if (locationId || !defaultWarehouse) return
    setLocationId(String(defaultWarehouse.id))
  }, [locationId, defaultWarehouse])

  // Per-location stock for every product (falls back to the product's total when unavailable)
  useEffect(() => {
    if (!open) return
    inventoryApi.getOverview({ per_page: 1000 }).then((ov) => {
      const m: Record<string, Record<number, number>> = {}
      ov.items.forEach((row) => {
        const per: Record<number, number> = {}
        row.locations.forEach((l) => { per[l.locationId] = (per[l.locationId] ?? 0) + Number(l.quantity || 0) })
        m[String(row.productId)] = per
      })
      setStockMap(m)
    }).catch(() => setStockMap(null))
  }, [open])

  const locationName = warehouses.find((w) => String(w.id) === locationId)?.name ?? ""

  const selectedShipping = shippingMethods.find((m) => String(m.id) === delivery)
  const zoneCost = selectedShipping ? Number(selectedShipping.price) || 0 : 0
  const shippingCost = delivery !== STORE_PICKUP && shipOverride !== null ? Math.max(0, Number(shipOverride) || 0) : zoneCost
  const needsAddress = delivery !== STORE_PICKUP

  const subtotal = useMemo(() => rows.reduce((s, r) => s + Math.max(0, r.price * r.quantity - r.discount), 0), [rows])
  const discRaw = Math.max(0, Number(discount) || 0)
  const discountNum = Math.min(discType === "percent" ? subtotal * Math.min(discRaw, 100) / 100 : discRaw, subtotal)
  const taxable = Math.max(0, subtotal - discountNum)
  const tax = taxable * (taxRate / 100)
  const total = taxable + tax + shippingCost
  const itemCount = rows.filter((r) => r.productId).reduce((n, r) => n + r.quantity, 0)

  // COD is collected on delivery (never paid up front); walk-in sales must be paid in full
  const isCod = method === "COD"
  const walkIn = !customerId
  const effectivePaidMode: PaidMode = isCod ? "none" : walkIn ? "full" : paidMode
  const paidNow =
    effectivePaidMode === "full" ? total : effectivePaidMode === "partial" ? Math.min(Math.max(0, Number(partialAmount) || 0), total) : 0
  const dueNow = Math.max(0, total - paidNow)

  const stockOf = (productId: string) => {
    const p = products.find((x) => String(x.id) === productId)
    if (!p) return null
    if (stockMap && locationId) return stockMap[productId]?.[Number(locationId)] ?? 0
    return Number(p.stock ?? 0)
  }
  const overStock = rows.some((r) => {
    const s = r.productId ? stockOf(r.productId) : null
    return s !== null && r.quantity > s
  })

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  // Normal/offer price from the backend (expired offers already priced at normal); wholesale from the minimum quantity
  const unitFor = (pid: string, qty: number) => {
    const p: any = products.find((x) => String(x.id) === pid)
    if (!p) return { price: 0, wholesale: false }
    const normal = Number(p.currentPrice ?? (p.salePrice || p.price) ?? 0)
    const w = Number(p.wholesalePrice ?? p.wholesale_price ?? 0)
    const min = Number(p.minWholesaleQty ?? p.min_wholesale_qty ?? 0)
    const on = w > 0 && min > 0 && qty >= min && w < normal
    return { price: on ? w : normal, wholesale: on }
  }
  const setQty = (i: number, qty: number) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, quantity: qty, ...(r.auto ? { price: unitFor(r.productId, qty).price } : {}) } : r)))

  const pickProduct = (i: number, pid: string) => {
    const p = products.find((x) => String(x.id) === pid)
    // The same product never gets two lines: add to the existing one instead
    const existing = rows.findIndex((r, idx) => idx !== i && r.productId === pid)
    if (existing >= 0) {
      const carry = rows[i]?.productId ? rows[i].quantity : 1
      setRows((prev) => {
        const next = prev.map((r, idx) => (idx === existing ? { ...r, quantity: r.quantity + carry, ...(r.auto ? { price: unitFor(r.productId, r.quantity + carry).price } : {}) } : r))
        const trimmed = next.filter((_, idx) => idx !== i)
        return trimmed.length > 0 ? trimmed : [emptyRow()]
      })
      toast({ title: "Already in this sale", description: `${p?.name ?? "Product"} quantity increased` })
      return
    }
    setRow(i, { productId: pid, productName: p?.name ?? "", price: unitFor(pid, rows[i]?.quantity ?? 1).price, discount: 0, auto: true })
  }

  const onCustomerChange = (id: string, name: string) => {
    setCustomerId(id)
    setCustomerName(name)
    const c = id ? getCustomerById(id) : undefined
    if (c) {
      // Prefill delivery details from the customer, without overwriting anything already typed
      setShip((s) => ({
        name: s.name || c.name || "",
        phone: s.phone || c.phone || "",
        line1: s.line1 || c.address || "",
        city: s.city || c.city || "",
        state: s.state || c.state || "",
        zip: s.zip || c.zipCode || "",
        country: s.country || c.country || "",
      }))
    }
  }

  const quickAddCustomer = async () => {
    setCustErr("")
    if (!newCust.name.trim() || !newCust.phone.trim()) {
      setCustErr("Name and phone are required.")
      return
    }
    if (!PHONE_RE.test(newCust.phone.trim())) { setCustErr("Enter a valid phone number."); return }
    if (newCust.email.trim() && !EMAIL_RE.test(newCust.email.trim())) { setCustErr("Enter a valid email address."); return }
    const dup = customers.find((c) => digits(c.phone || "") !== "" && digits(c.phone || "") === digits(newCust.phone))
    if (dup) { setCustErr(`${dup.name} already uses this phone number.`); return }
    setAddingCust(true)
    try {
      const res = await customerApi.create({
        name: newCust.name.trim(),
        email: newCust.email.trim() || undefined,
        phone: newCust.phone.trim(),
        address: "", city: "", state: "", zipCode: "", country: "",
        customerType: "retail", status: "active", notes: "", storeCredit: 0,
      } as any)
      await refreshCustomers()
      // Select the new customer by id (names are not unique)
      setCustomerId(String(res.data.id))
      setCustomerName(res.data.name || newCust.name.trim())
      setShip((sh) => ({ ...sh, name: sh.name || newCust.name.trim(), phone: sh.phone || newCust.phone.trim() }))
      toast({ title: "Customer added", description: newCust.name })
      setNewCust({ name: "", phone: "", email: "" })
      setCustErr("")
      setAddCustOpen(false)
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.message || "Could not add customer" })
    } finally {
      setAddingCust(false)
    }
  }

  const reset = () => {
    setCustomerId(""); setCustomerName("Walk-in Customer"); setRows([emptyRow()]); setTried(false)
    setDelivery(STORE_PICKUP); setShip(emptyShip); setDeliveryNote(""); setCourier(COURIERS[0]); setDiscount(""); setDiscType("flat"); setShipOverride(null)
    setMethod(defMethod); setPaidMode("full"); setPartialAmount(""); setTxId("")
    setStatus("Pending"); setNote("")
  }

  // Validation (discount messages show live, the rest after the first save attempt)
  const discountErr =
    discType === "percent" && discRaw > 100 ? "Percent discount cannot exceed 100%."
    : discType === "flat" && discRaw > subtotal + 0.005 ? "Discount cannot be more than the subtotal." : ""
  const lineErr = (r: Row) =>
    !r.productId ? ""
    : !(r.price > 0) ? "Unit price is required."
    : r.discount < 0 || r.discount > r.price * r.quantity + 0.005 ? "Line discount must be between 0 and the line total." : ""
  const chargeErr = needsAddress && shipOverride !== null && (Number(shipOverride) < 0 || shipOverride.trim() === "") ? "Delivery charge must be 0 or more." : ""
  const addressErr = needsAddress && !ship.line1.trim() ? "Delivery address is required." : ""
  const phoneErr = needsAddress && ship.phone.trim() && !PHONE_RE.test(ship.phone.trim()) ? "Enter a valid receiver phone number." : ""
  const codErr = isCod && walkIn ? "Cash on delivery needs a customer. Pick one above." : ""
  const partialErr =
    effectivePaidMode === "partial" && !(paidNow > 0 && paidNow < total) ? "Partial amount must be more than 0 and less than the total." : ""

  const submit = async () => {
    setTried(true)
    const items = rows.filter((r) => r.productId && r.quantity > 0)
    if (items.length === 0) { toast({ variant: "destructive", title: "Error", description: "Add at least one product" }); return }
    const firstErr = discountErr || rows.map(lineErr).find(Boolean) || chargeErr || addressErr || phoneErr || codErr || partialErr
    if (firstErr) { toast({ variant: "destructive", title: "Check the form", description: firstErr }); return }
    const seen = new Set<string>()
    const dup = items.find((r) => (seen.has(r.productId) ? true : (seen.add(r.productId), false)))
    if (dup) { toast({ variant: "destructive", title: "Product listed twice", description: `${dup.productName || "A product"} is on more than one line. Merge them into one.` }); return }
    if (overStock) { toast({ variant: "destructive", title: "Not enough stock", description: "Reduce the quantity of the highlighted product" }); return }
    setSaving(true)
    try {
      const notes = note.trim()
      const res = await sellsApi.create({
        customerId: customerId ? Number(customerId) : undefined,
        customerName: customerName || "Walk-in Customer",
        ...(needsAddress ? {
          shippingFullName: ship.name || undefined,
          shippingPhone: ship.phone || undefined,
          shippingAddressLine1: ship.line1 || undefined,
          shippingCity: ship.city || undefined,
          shippingState: ship.state || undefined,
          shippingPostalCode: ship.zip || undefined,
          shippingCountry: ship.country || undefined,
        } : {}),
        method,
        source: "manual",
        amount: total,
        paidAmount: paidNow,
        locationId: locationId ? Number(locationId) : undefined,
        courier: needsAddress ? courier : undefined,
        deliveryNote: needsAddress && deliveryNote.trim() ? deliveryNote.trim() : undefined,
        zoneName: needsAddress && selectedShipping?.name ? String(selectedShipping.name) : undefined,
        taxRate: tax > 0 ? taxRate : undefined,
        taxAmount: tax > 0 ? Math.round(tax * 100) / 100 : undefined,
        paymentTransactionId: TX_METHODS.includes(method) && txId.trim() ? txId.trim() : undefined,
        discount: discountNum > 0 ? discountNum : undefined,
        shippingCost: shippingCost > 0 ? shippingCost : undefined,
        shippingMethod: selectedShipping ? String(selectedShipping.id) : undefined,
        notes: notes || undefined,
        status,
        items: items.map((r) => ({
          productId: Number(r.productId),
          productName: r.productName,
          quantity: r.quantity,
          price: r.price,
          unitPrice: r.price,
          unit_price: r.price,
          discount: r.discount > 0 ? r.discount : undefined,
        })),
      })
      toast({ title: "Sale created", description: `${formatCurrency(total)} · ${items.length} item(s)` })
      if (printAfter && res?.data) {
        printSaleInvoice(res.data as SellResponse, { formatCurrency, taxId: settings?.taxId })
      }
      reset()
      onOpenChange(false)
      onCreated()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Failed", description: err?.response?.data?.message || "Could not create sale" })
    } finally {
      setSaving(false)
    }
  }

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  const paidOptions: [PaidMode, string][] = [["full", "Paid in full"], ["partial", "Partial"], ["none", "Unpaid"]]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[1080px] flex-col gap-0 overflow-hidden rounded-[18px] border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[1080px]"
      >
        <DialogHeader className="border-b border-dash-border px-6 py-[18px] text-left">
          <DialogTitle className="font-dash-display text-[22px] font-bold">New sale</DialogTitle>
          <DialogDescription className="text-[13px] text-dash-muted">{today}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-wrap items-stretch overflow-y-auto">
          {/* Left column */}
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] px-6 py-5">
            {/* 1 · Customer */}
            <fieldset className="flex flex-col gap-2.5">
              <legend className={cn(sectionTitle, "mb-2.5")}>1 · Customer</legend>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <CustomerCombobox value={customerId} onValueChange={onCustomerChange} />
                </div>
                <button type="button" onClick={() => setAddCustOpen(true)}
                  className="h-[52px] shrink-0 rounded-xl border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                  + New customer
                </button>
              </div>
              {customerId && (() => {
                const c = getCustomerById(customerId)
                const limit = Number((c as any)?.creditLimit ?? 0)
                return c ? (
                  <p className="text-xs text-dash-muted">
                    {[
                      c.phone,
                      c.totalOrders !== undefined ? `${c.totalOrders} past orders` : "",
                      `Due ${formatCurrency(Number(c.dueAmount) || 0)}`,
                      limit > 0 ? `Credit limit ${formatCurrency(limit)}` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null
              })()}
              {!customerId && <p className="text-xs text-dash-muted">Walk-in sales must be paid in full.</p>}
            </fieldset>

            {/* 2 · Products */}
            <fieldset className="flex flex-col gap-2">
              <legend className={cn(sectionTitle, "mb-2.5")}>2 · Products</legend>
              <label className="flex items-center gap-2 text-[13px] font-semibold">Stock location
                <select aria-label="Stock location" value={locationId} onChange={(e) => setLocationId(e.target.value)}
                  className="h-9 min-w-[180px] rounded-lg border border-dash-border bg-dash-card px-2 text-[13px] font-normal outline-none focus-visible:border-dash-accent">
                  {warehouses.length === 0 && <option value="">Default</option>}
                  {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.name}</option>)}
                </select>
              </label>
              <div className="overflow-x-auto">
                <div className="flex min-w-[640px] flex-col gap-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px_100px_40px] gap-2 px-0.5 text-xs font-semibold text-dash-muted">
                    <span>Product</span><span>Qty</span><span className="text-right">Unit price</span><span className="text-right">Discount</span><span className="text-right">Line total</span><span />
                  </div>
                  {rows.map((r, i) => {
                    const stock = r.productId ? stockOf(r.productId) : null
                    const over = stock !== null && r.quantity > stock
                    const lErr = tried ? lineErr(r) : ""
                    return (
                      <div key={i} className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px_100px_40px] items-center gap-2 rounded-xl border border-dash-border p-2">
                        <div className="flex min-w-0 flex-col gap-1">
                          <SearchableSelect
                            value={r.productId}
                            onChange={(v) => pickProduct(i, v)}
                            placeholder="Select product…"
                            searchPlaceholder="Search product or SKU…"
                            options={products.map((p) => {
                              const q = stockOf(String(p.id)) ?? 0
                              return {
                                value: String(p.id),
                                disabled: q <= 0,
                                label: `${p.name}${p.sku ? ` · ${p.sku}` : ""} — ${q <= 0 ? `out of stock${locationName ? ` at ${locationName}` : ""}` : `${q} in stock${locationName ? ` at ${locationName}` : ""}`}${rows.some((x, xi) => xi !== i && x.productId === String(p.id)) ? " (already added)" : ""}`,
                              }
                            })}
                          />
                          <span className={cn("text-xs", over ? "text-dash-danger" : "text-dash-muted")}>
                            {r.auto && r.productId && unitFor(r.productId, r.quantity).wholesale ? "Wholesale price applied · " : ""}{stock === null ? "Choose a product" : over ? `Only ${stock} in stock${locationName ? ` at ${locationName}` : ""}` : `${stock} in stock${locationName ? ` at ${locationName}` : ""}`}
                          </span>
                          {lErr && <span className="text-xs text-dash-danger">{lErr}</span>}
                        </div>
                        <div className="flex h-10 items-center rounded-lg border border-dash-border">
                          <button type="button" aria-label="Decrease quantity" className="h-[38px] w-9 text-lg hover:bg-dash-neutral-soft"
                            onClick={() => setQty(i, Math.max(1, r.quantity - 1))}>−</button>
                          <span className="flex-1 text-center font-bold tabular-nums">{r.quantity}</span>
                          <button type="button" aria-label="Increase quantity" className="h-[38px] w-9 text-lg hover:bg-dash-neutral-soft"
                            onClick={() => setQty(i, r.quantity + 1)}>+</button>
                        </div>
                        <input
                          type="number" min={0} step="0.01" aria-label="Unit price" value={r.price}
                          onChange={(e) => setRow(i, { price: Number(e.target.value) || 0, auto: false })}
                          className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-2 text-right text-sm tabular-nums outline-none focus-visible:border-dash-accent"
                        />
                        <input
                          type="number" min={0} step="0.01" aria-label="Line discount" value={r.discount || ""} placeholder="0"
                          onChange={(e) => setRow(i, { discount: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-2 text-right text-sm tabular-nums outline-none focus-visible:border-dash-accent"
                        />
                        <span className="text-right text-sm font-bold tabular-nums">{formatCurrency(Math.max(0, r.price * r.quantity - r.discount))}</span>
                        <button type="button" aria-label="Remove line" disabled={rows.length === 1}
                          onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                          className="flex size-9 items-center justify-center rounded-lg text-dash-danger-fg hover:bg-dash-danger-soft disabled:opacity-30">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
              <button type="button" onClick={() => setRows((p) => [...p, emptyRow()])}
                className="h-10 self-start rounded-[10px] border border-dashed border-dash-neutral bg-dash-bg px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                + Add product
              </button>
            </fieldset>

            {/* 3 · Delivery */}
            <fieldset className="flex flex-col gap-3">
              <legend className={cn(sectionTitle, "mb-2.5")}>3 · Delivery</legend>
              <div role="radiogroup" aria-label="Delivery type" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
                {[{ id: STORE_PICKUP, label: "Store pickup", sub: "No delivery charge" },
                  ...shippingMethods.map((m) => ({
                    id: String(m.id), label: m.name,
                    sub: `${formatCurrency(Number(m.price) || 0)}${m.estimatedDays ? ` · ${m.estimatedDays}` : ""}`,
                  }))].map((z) => {
                  const on = delivery === z.id
                  return (
                    <button key={z.id} type="button" role="radio" aria-checked={on} onClick={() => { setDelivery(z.id); setShipOverride(null) }}
                      className={cn("flex min-h-14 flex-col gap-0.5 rounded-xl border-2 px-3 py-2 text-left",
                        on ? "border-dash-accent bg-dash-accent-soft" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                      <span className="text-sm font-semibold">{z.label}</span>
                      <span className="text-xs text-dash-muted">{z.sub}</span>
                    </button>
                  )
                })}
              </div>
              {needsAddress && (
                <div className="grid grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Receiver name
                    <input className={field} value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Phone
                    <input className={field} type="tel" value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
                    {(tried || ship.phone.trim() !== "") && phoneErr && <span className="text-xs font-normal text-dash-danger">{phoneErr}</span>}
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5 text-[13px] font-semibold">Address
                    <input className={field} placeholder="House, road, area" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} />
                    {tried && addressErr && <span className="text-xs font-normal text-dash-danger">{addressErr}</span>}
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">City / District
                    <input className={field} placeholder="e.g. Dhaka" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">State / Area
                    <input className={field} placeholder="e.g. Mirpur" value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Postal code
                    <input className={field} value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Country
                    <input className={field} value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value })} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Courier
                    <select className={field} value={courier} onChange={(e) => setCourier(e.target.value)}>
                      {COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="col-span-2 flex flex-col gap-1.5 text-[13px] font-semibold">Delivery note
                    <input className={field} placeholder="e.g. Call before delivery" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
                  </label>
                </div>
              )}
            </fieldset>
          </div>

          {/* Right column: summary & payment */}
          <aside aria-label="Summary and payment" className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px] border-l border-dash-border bg-dash-bg px-6 py-5">
            <div className="flex flex-col gap-2 text-sm">
              <span className={cn(sectionTitle, "mb-1")}>4 · Summary</span>
              <div className="flex justify-between"><span className="text-dash-muted">Subtotal · {itemCount} items</span><span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span></div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="ns-disc" className="text-dash-muted">Discount</label>
                <select aria-label="Discount type" value={discType} onChange={(e) => setDiscType(e.target.value as "flat" | "percent")}
                  className="h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-[13px] outline-none focus-visible:border-dash-accent">
                  <option value="flat">Flat</option><option value="percent">Percent %</option>
                </select>
                <input id="ns-disc" type="number" min={0} step="0.01" value={discount} placeholder="0"
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-9 w-[110px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-right text-sm tabular-nums outline-none focus-visible:border-dash-accent" />
              </div>
              {discountErr && <p className="text-right text-xs text-dash-danger">{discountErr}</p>}
              <div className="flex justify-between"><span className="text-dash-muted">VAT ({taxRate}%) · after discount</span><span className="font-semibold tabular-nums">{formatCurrency(tax)}</span></div>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="ns-ship" className="text-dash-muted">Delivery charge</label>
                <input id="ns-ship" type="number" min={0} step="0.01" value={needsAddress && shipOverride !== null ? shipOverride : String(zoneCost)} disabled={!needsAddress}
                  onChange={(e) => setShipOverride(e.target.value)}
                  className="h-9 w-[110px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-right text-sm tabular-nums outline-none focus-visible:border-dash-accent disabled:opacity-60" />
              </div>
              {chargeErr && <p className="text-right text-xs text-dash-danger">{chargeErr}</p>}
              <div className="flex items-baseline justify-between border-t border-dashed border-dash-border pt-2.5">
                <span className="font-bold">Total</span>
                <span className="font-dash-display text-[30px] font-bold tracking-tight tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className={sectionTitle}>5 · Payment</span>
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-1.5">
                {methodList.map((m) => {
                  const on = method === m.value
                  return (
                    <button key={m.value} type="button" role="radio" aria-checked={on}
                      onClick={() => { setMethod(m.value); if (m.value === "COD") setPaidMode("none") }}
                      className={cn("h-[42px] rounded-[10px] border-2 text-[13px] font-bold",
                        on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>
                      {m.label}
                    </button>
                  )
                })}
              </div>
              <div role="radiogroup" aria-label="Amount paid" className="grid grid-cols-3 gap-1.5 rounded-[10px] bg-dash-neutral-soft p-1">
                {paidOptions.map(([id, label]) => {
                  const on = effectivePaidMode === id
                  const disabled = isCod ? id !== "none" : walkIn ? id !== "full" : false
                  return (
                    <button key={id} type="button" role="radio" aria-checked={on} disabled={disabled}
                      onClick={() => setPaidMode(id)}
                      className={cn("h-9 rounded-lg text-[13px] font-semibold disabled:opacity-40", on ? "bg-dash-card shadow-sm" : "text-dash-muted")}>
                      {label}
                    </button>
                  )
                })}
              </div>
              {isCod && <p className="text-xs text-dash-muted">Cash on delivery: the customer pays the courier on delivery, so the sale is saved as unpaid and the full amount is collected then.</p>}
              {codErr && <p className="text-xs text-dash-danger">{codErr}</p>}
              {!isCod && walkIn && <p className="text-xs text-dash-muted">Walk-in sales must be paid in full. Pick a customer to allow partial or unpaid sales.</p>}
              {effectivePaidMode === "partial" && (
                <label className="flex items-center justify-between gap-2 text-sm text-dash-muted">Amount received
                  <input type="number" min={0} step="0.01" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)}
                    className="h-[38px] w-[120px] rounded-lg border border-dash-border bg-dash-card px-2.5 text-right text-sm tabular-nums text-dash-ink outline-none focus-visible:border-dash-accent" />
                </label>
              )}
              {effectivePaidMode === "partial" && (tried || partialAmount !== "") && partialErr && <p className="text-xs text-dash-danger">{partialErr}</p>}
              {TX_METHODS.includes(method) && (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Transaction ID
                  <input className={cn(field, "h-10 font-normal")} placeholder="e.g. 9JK4XY2LQ8" value={txId} onChange={(e) => setTxId(e.target.value)} />
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[10px] bg-dash-success-soft p-3 text-dash-success-fg">
                  <div className="text-xs">Paid now</div><div className="text-lg font-bold tabular-nums">{formatCurrency(paidNow)}</div>
                </div>
                <div className={cn("rounded-[10px] p-3", dueNow > 0 ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>
                  <div className="text-xs">Due</div><div className="text-lg font-bold tabular-nums">{formatCurrency(dueNow)}</div>
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Order status
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="h-[42px] w-full rounded-[10px] border-dash-border bg-dash-card font-normal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Packed">Packed</SelectItem>
                  <SelectItem value="Shipped">Shipped</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Internal note
              <textarea rows={2} placeholder="Only visible to staff" value={note} onChange={(e) => setNote(e.target.value)}
                className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent" />
            </label>
            <label className="flex min-h-8 items-center gap-2.5 text-sm">
              <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="size-[18px] accent-[var(--dash-accent)]" />
              Print invoice after saving
            </label>
          </aside>
        </div>

        <DialogFooter className="flex flex-row flex-wrap items-center gap-2.5 border-t border-dash-border bg-dash-card px-6 py-4 sm:justify-between">
          <span className="text-[13px] text-dash-muted">{locationName ? `Stock will be deducted from ${locationName}` : "Stock is deducted when the sale is saved"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <button type="button" onClick={() => onOpenChange(false)}
              className="h-12 rounded-xl border border-dash-border bg-dash-card px-[18px] text-sm font-semibold hover:bg-dash-neutral-soft">
              Cancel
            </button>
            <button type="button" onClick={submit} disabled={saving || itemCount === 0 || overStock}
              className="h-12 rounded-xl bg-dash-accent px-[22px] text-[15px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {saving ? "Creating…" : `Create sale · ${formatCurrency(total)}`}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Quick add-customer */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input value={newCust.phone} onChange={(e) => { setCustErr(""); setNewCust({ ...newCust, phone: e.target.value }) }} placeholder="01XXXXXXXXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="john@example.com" />
            </div>
            {custErr && <p className="text-xs text-dash-danger">{custErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button className="bg-dash-accent text-white hover:brightness-110" onClick={quickAddCustomer} disabled={addingCust}>
              {addingCust ? "Adding…" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
