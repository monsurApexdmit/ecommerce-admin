"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group"
import { Field, FieldLabel } from "@/components/ui/field"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
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
import { WithTooltip } from "@/components/common/WithTooltip"

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
        className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[1080px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1080px]"
      >
        <DialogHeader className="px-6 py-4 text-left">
          <DialogTitle>New sale</DialogTitle>
          <DialogDescription>{today}</DialogDescription>
        </DialogHeader>
        <Separator />

        <div className="flex min-h-0 flex-1 flex-wrap items-stretch overflow-y-auto">
          {/* Left column */}
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] px-6 py-5">
            {/* 1 · Customer */}
            <fieldset className="flex flex-col gap-2.5">
              <SectionTitle as="legend" className="mb-2.5">1 · Customer</SectionTitle>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <CustomerCombobox value={customerId} onValueChange={onCustomerChange} />
                </div>
                <Button type="button" variant="outline" className="shrink-0" onClick={() => setAddCustOpen(true)}>
                  + New customer
                </Button>
              </div>
              {customerId && (() => {
                const c = getCustomerById(customerId)
                const limit = Number((c as any)?.creditLimit ?? 0)
                return c ? (
                  <p className="text-xs text-muted-foreground">
                    {[
                      c.phone,
                      c.totalOrders !== undefined ? `${c.totalOrders} past orders` : "",
                      `Due ${formatCurrency(Number(c.dueAmount) || 0)}`,
                      limit > 0 ? `Credit limit ${formatCurrency(limit)}` : "",
                    ].filter(Boolean).join(" · ")}
                  </p>
                ) : null
              })()}
              {!customerId && <p className="text-xs text-muted-foreground">Walk-in sales must be paid in full.</p>}
            </fieldset>

            {/* 2 · Products */}
            <fieldset className="flex flex-col gap-2">
              <SectionTitle as="legend" className="mb-2.5">2 · Products</SectionTitle>
              <FormField label="Stock location" htmlFor="ns-location" orientation="horizontal" className="w-fit">
                <Select value={locationId || (warehouses.length === 0 ? "__none" : undefined)} onValueChange={(v) => setLocationId(v === "__none" ? "" : v)}>
                  <SelectTrigger id="ns-location" aria-label="Stock location" className="min-w-[180px]"><SelectValue placeholder="Select location" /></SelectTrigger>
                  <SelectContent>
                    {warehouses.length === 0 && <SelectItem value="__none">Default</SelectItem>}
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <div className="overflow-x-auto">
                <div className="flex min-w-[640px] flex-col gap-2">
                  <div className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px_100px_40px] gap-2 px-0.5 text-xs font-medium text-muted-foreground">
                    <span>Product</span><span>Qty</span><span className="text-right">Unit price</span><span className="text-right">Discount</span><span className="text-right">Line total</span><span />
                  </div>
                  {rows.map((r, i) => {
                    const stock = r.productId ? stockOf(r.productId) : null
                    const over = stock !== null && r.quantity > stock
                    const lErr = tried ? lineErr(r) : ""
                    return (
                      <Card key={i} className="grid grid-cols-[minmax(0,1fr)_120px_100px_90px_100px_40px] items-center gap-2 p-2">
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
                          <span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
                            {r.auto && r.productId && unitFor(r.productId, r.quantity).wholesale ? "Wholesale price applied · " : ""}{stock === null ? "Choose a product" : over ? `Only ${stock} in stock${locationName ? ` at ${locationName}` : ""}` : `${stock} in stock${locationName ? ` at ${locationName}` : ""}`}
                          </span>
                          {lErr && <span className="text-xs text-destructive">{lErr}</span>}
                        </div>
                        <ButtonGroup className="w-full">
                          <WithTooltip content="Decrease quantity"><Button type="button" variant="outline" size="icon" aria-label="Decrease quantity"
                            onClick={() => setQty(i, Math.max(1, r.quantity - 1))}>−</Button></WithTooltip>
                          <ButtonGroupText className="min-w-0 flex-1 justify-center px-1 tabular-nums">{r.quantity}</ButtonGroupText>
                          <WithTooltip content="Increase quantity"><Button type="button" variant="outline" size="icon" aria-label="Increase quantity"
                            onClick={() => setQty(i, r.quantity + 1)}>+</Button></WithTooltip>
                        </ButtonGroup>
                        <Input
                          type="number" min={0} step="0.01" aria-label="Unit price" value={r.price}
                          onChange={(e) => setRow(i, { price: Number(e.target.value) || 0, auto: false })}
                          className="text-right tabular-nums"
                        />
                        <Input
                          type="number" min={0} step="0.01" aria-label="Line discount" value={r.discount || ""} placeholder="0"
                          onChange={(e) => setRow(i, { discount: Math.max(0, Number(e.target.value) || 0) })}
                          className="text-right tabular-nums"
                        />
                        <span className="text-right text-sm font-semibold tabular-nums">{formatCurrency(Math.max(0, r.price * r.quantity - r.discount))}</span>
                        <WithTooltip content="Remove line"><Button type="button" variant="ghost" size="icon" aria-label="Remove line" disabled={rows.length === 1}
                          onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}>
                          <Trash2 className="size-4" />
                        </Button></WithTooltip>
                      </Card>
                    )
                  })}
                </div>
              </div>
              <Button type="button" variant="outline" className="self-start" onClick={() => setRows((p) => [...p, emptyRow()])}>
                + Add product
              </Button>
            </fieldset>

            {/* 3 · Delivery */}
            <fieldset className="flex flex-col gap-3">
              <SectionTitle as="legend" className="mb-2.5">3 · Delivery</SectionTitle>
              <ChoiceCardGroup
                value={delivery}
                onValueChange={(v) => { setDelivery(v); setShipOverride(null) }}
                aria-label="Delivery type"
                className="grid-cols-[repeat(auto-fit,minmax(150px,1fr))]"
              >
                {[{ id: STORE_PICKUP, label: "Store pickup", sub: "No delivery charge" },
                  ...shippingMethods.map((m) => ({
                    id: String(m.id), label: m.name,
                    sub: `${formatCurrency(Number(m.price) || 0)}${m.estimatedDays ? ` · ${m.estimatedDays}` : ""}`,
                  }))].map((z) => (
                  <ChoiceCard key={z.id} value={z.id} title={z.label} description={z.sub} />
                ))}
              </ChoiceCardGroup>
              {needsAddress && (
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Receiver name" htmlFor="ns-ship-name">
                    <Input id="ns-ship-name" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} />
                  </FormField>
                  <FormField label="Phone" htmlFor="ns-ship-phone" error={(tried || ship.phone.trim() !== "") && phoneErr ? phoneErr : undefined}>
                    <Input id="ns-ship-phone" type="tel" value={ship.phone} onChange={(e) => setShip({ ...ship, phone: e.target.value })} />
                  </FormField>
                  <FormField label="Address" htmlFor="ns-ship-line1" className="col-span-2" error={tried && addressErr ? addressErr : undefined}>
                    <Input id="ns-ship-line1" placeholder="House, road, area" value={ship.line1} onChange={(e) => setShip({ ...ship, line1: e.target.value })} />
                  </FormField>
                  <FormField label="City / District" htmlFor="ns-ship-city">
                    <Input id="ns-ship-city" placeholder="e.g. Dhaka" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} />
                  </FormField>
                  <FormField label="State / Area" htmlFor="ns-ship-state">
                    <Input id="ns-ship-state" placeholder="e.g. Mirpur" value={ship.state} onChange={(e) => setShip({ ...ship, state: e.target.value })} />
                  </FormField>
                  <FormField label="Postal code" htmlFor="ns-ship-zip">
                    <Input id="ns-ship-zip" value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} />
                  </FormField>
                  <FormField label="Country" htmlFor="ns-ship-country">
                    <Input id="ns-ship-country" value={ship.country} onChange={(e) => setShip({ ...ship, country: e.target.value })} />
                  </FormField>
                  <FormField label="Courier" htmlFor="ns-ship-courier">
                    <Select value={courier} onValueChange={(v) => setCourier(v)}>
                      <SelectTrigger id="ns-ship-courier" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {COURIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormField>
                  <FormField label="Delivery note" htmlFor="ns-ship-note" className="col-span-2">
                    <Input id="ns-ship-note" placeholder="e.g. Call before delivery" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} />
                  </FormField>
                </div>
              )}
            </fieldset>
          </div>

          {/* Right column: summary & payment */}
          <aside aria-label="Summary and payment" className="flex min-w-0 flex-[1_1_340px] flex-col gap-[18px] border-l bg-muted/40 px-6 py-5">
            <div className="flex flex-col gap-2 text-sm">
              <SectionTitle className="mb-1">4 · Summary</SectionTitle>
              <InfoList>
                <InfoRow label={`Subtotal · ${itemCount} items`} value={<span className="tabular-nums">{formatCurrency(subtotal)}</span>} />
                <InfoRow
                  className="items-center"
                  label={<Label htmlFor="ns-disc" className="font-normal text-muted-foreground">Discount</Label>}
                  value={
                    <span className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-2">
                        <Select value={discType} onValueChange={(v) => setDiscType(v as "flat" | "percent")}>
                          <SelectTrigger aria-label="Discount type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="flat">Flat</SelectItem><SelectItem value="percent">Percent %</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input id="ns-disc" type="number" min={0} step="0.01" value={discount} placeholder="0"
                          onChange={(e) => setDiscount(e.target.value)}
                          aria-invalid={!!discountErr}
                          className="w-[110px] text-right tabular-nums" />
                      </span>
                      {discountErr && <span className="text-xs font-normal text-destructive">{discountErr}</span>}
                    </span>
                  }
                />
                <InfoRow label={`VAT (${taxRate}%) · after discount`} value={<span className="tabular-nums">{formatCurrency(tax)}</span>} />
                <InfoRow
                  className="items-center"
                  label={<Label htmlFor="ns-ship" className="font-normal text-muted-foreground">Delivery charge</Label>}
                  value={
                    <span className="flex flex-col items-end gap-1">
                      <Input id="ns-ship" type="number" min={0} step="0.01" value={needsAddress && shipOverride !== null ? shipOverride : String(zoneCost)} disabled={!needsAddress}
                        onChange={(e) => setShipOverride(e.target.value)}
                        aria-invalid={!!chargeErr}
                        className="w-[110px] text-right tabular-nums" />
                      {chargeErr && <span className="text-xs font-normal text-destructive">{chargeErr}</span>}
                    </span>
                  }
                />
                <Separator className="my-1" />
                <InfoRow
                  className="items-baseline [&>dt]:font-semibold [&>dt]:text-foreground"
                  label="Total"
                  value={<span className="text-3xl font-semibold tracking-tight tabular-nums">{formatCurrency(total)}</span>}
                />
              </InfoList>
            </div>

            <div className="flex flex-col gap-2.5">
              <SectionTitle>5 · Payment</SectionTitle>
              <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-1.5">
                {methodList.map((m) => {
                  const on = method === m.value
                  return (
                    <Button key={m.value} type="button" role="radio" aria-checked={on} variant={on ? "default" : "outline"}
                      onClick={() => { setMethod(m.value); if (m.value === "COD") setPaidMode("none") }}>
                      {m.label}
                    </Button>
                  )
                })}
              </div>
              <SegmentedControl
                aria-label="Amount paid"
                className="w-full"
                value={effectivePaidMode}
                onValueChange={(v) => setPaidMode(v as PaidMode)}
                options={paidOptions.map(([id, label]) => ({
                  value: id,
                  label,
                  disabled: isCod ? id !== "none" : walkIn ? id !== "full" : false,
                }))}
              />
              {isCod && <p className="text-xs text-muted-foreground">Cash on delivery: the customer pays the courier on delivery, so the sale is saved as unpaid and the full amount is collected then.</p>}
              {codErr && <p className="text-xs text-destructive">{codErr}</p>}
              {!isCod && walkIn && <p className="text-xs text-muted-foreground">Walk-in sales must be paid in full. Pick a customer to allow partial or unpaid sales.</p>}
              {effectivePaidMode === "partial" && (
                <FormField
                  label="Amount received" htmlFor="ns-partial" orientation="horizontal"
                  error={(tried || partialAmount !== "") && partialErr ? partialErr : undefined}
                >
                  <Input id="ns-partial" type="number" min={0} step="0.01" value={partialAmount} onChange={(e) => setPartialAmount(e.target.value)}
                    className="w-[120px] text-right tabular-nums" />
                </FormField>
              )}
              {TX_METHODS.includes(method) && (
                <FormField label="Transaction ID" htmlFor="ns-txid">
                  <Input id="ns-txid" placeholder="e.g. 9JK4XY2LQ8" value={txId} onChange={(e) => setTxId(e.target.value)} />
                </FormField>
              )}
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Paid now" value={formatCurrency(paidNow)} className="gap-1 p-3" />
                <StatTile label="Due" value={formatCurrency(dueNow)} className={cn("gap-1 p-3", dueNow > 0 && "border-destructive/50 [&_p]:text-destructive")} />
              </div>
            </div>

            <FormField label="Order status" htmlFor="ns-status">
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="ns-status" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Processing">Processing</SelectItem>
                  <SelectItem value="Packed">Packed</SelectItem>
                  <SelectItem value="Shipped">Shipped</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Internal note" htmlFor="ns-note">
              <Textarea id="ns-note" rows={2} placeholder="Only visible to staff" value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <Field orientation="horizontal">
              <Checkbox id="ns-print-after" checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />
              <FieldLabel htmlFor="ns-print-after" className="font-normal">Print invoice after saving</FieldLabel>
            </Field>
          </aside>
        </div>

        <Separator />
        <DialogFooter className="flex flex-row flex-wrap items-center gap-2.5 px-6 py-4 sm:justify-between">
          <span className="text-sm text-muted-foreground">{locationName ? `Stock will be deducted from ${locationName}` : "Stock is deducted when the sale is saved"}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="lg" onClick={submit} disabled={saving || itemCount === 0 || overStock}>
              {saving ? "Creating…" : `Create sale · ${formatCurrency(total)}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Quick add-customer */}
      <Dialog open={addCustOpen} onOpenChange={setAddCustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <FormField label="Full Name *" htmlFor="ns-cust-name">
              <Input id="ns-cust-name" value={newCust.name} onChange={(e) => setNewCust({ ...newCust, name: e.target.value })} placeholder="John Doe" />
            </FormField>
            <FormField label="Phone *" htmlFor="ns-cust-phone">
              <Input id="ns-cust-phone" value={newCust.phone} onChange={(e) => { setCustErr(""); setNewCust({ ...newCust, phone: e.target.value }) }} placeholder="01XXXXXXXXX" />
            </FormField>
            <FormField label="Email" htmlFor="ns-cust-email">
              <Input id="ns-cust-email" type="email" value={newCust.email} onChange={(e) => setNewCust({ ...newCust, email: e.target.value })} placeholder="john@example.com" />
            </FormField>
            {custErr && <p className="text-xs text-destructive">{custErr}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCustOpen(false)}>Cancel</Button>
            <Button onClick={quickAddCustomer} disabled={addingCust}>
              {addingCust ? "Adding…" : "Add Customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}
