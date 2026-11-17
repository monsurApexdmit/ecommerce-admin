"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { sellsApi } from "@/lib/sellsApi"
import { shipmentsApi, type ReadyOrder, type ShipmentResponse } from "@/lib/shipmentsApi"
import { shippingMethodApi, type ShippingMethod } from "@/lib/shippingMethodApi"
import { printShippingLabel } from "@/lib/shipping-label"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { UserAvatar } from "@/components/common/UserAvatar"

const NS = ["inventory", "orders", "common"] as const
type K = ParseKeys<typeof NS>

// `name` is saved as the shipment's carrier, so it stays as-is; the screen shows translated labels.
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

/** Built-in courier names / subtitles → label keys (other couriers are brand names, shown as-is) */
const COURIER_NAME_KEY: Record<string, K> = {
  "Own rider": "inventory:shipments.courier.ownRider",
  Other: "common:extra.other",
}
const COURIER_SUB_KEY: Record<string, K> = {
  Courier: "orders:shipments.courier",
  "Your riders": "inventory:shipments.courier.yourRiders",
  "Enter manually": "inventory:shipments.courier.enterManually",
}

const PACKS: { id: string; label: K; weight: number; dims: string }[] = [
  { id: "pouch", label: "inventory:shipments.pack.pouch", weight: 0.5, dims: "25×20×3" },
  { id: "box-m", label: "inventory:shipments.pack.boxM", weight: 1.5, dims: "30×20×15" },
  { id: "box-l", label: "inventory:shipments.pack.boxL", weight: 4, dims: "45×35×25" },
  { id: "custom", label: "inventory:shipments.pack.custom", weight: 1, dims: "" },
]

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
  const { t, i18n } = useTranslation(NS)
  const courierLabel = (name: string) => (COURIER_NAME_KEY[name] ? t(COURIER_NAME_KEY[name]) : name)
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
    const timer = setTimeout(() => {
      shipmentsApi
        .getReadyToShip({ search: orderSearch.trim().replace(/^#/, "") || undefined, per_page: 50 })
        .then((r) => { if (!cancelled) { setOrders(r.orders); setOrdersTotal(r.total) } })
        .catch(() => { if (!cancelled) { setOrders([]); setOrdersTotal(0) } })
        .finally(() => { if (!cancelled) setLoadingOrders(false) })
    }, orderSearch ? 300 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
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
  const carrierLabel = courierLabel(carrierName)
  const riderName = rider.trim()

  // Speed options come from the order's shipping method (regular price, express rate, days)
  const method = order ? methods.find((m) => m.name === order.shippingMethod) : undefined
  const ownRider = courier === "Own rider"
  const baseFee = ownRider ? 0 : Number(order?.shippingCost) || Number(method?.price) || 0
  const expressFee = Number(method?.expressRate) || 0
  const speeds = [
    { id: "regular" as const, label: t("inventory:shipments.speed.regular"), sub: method?.estimatedDays || t("inventory:shipments.speed.standard"), fee: baseFee },
    ...(expressFee > 0 ? [{ id: "express" as const, label: t("inventory:shipments.speed.express"), sub: t("inventory:shipments.speed.nextDay"), fee: ownRider ? 0 : expressFee }] : []),
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
  const fmtDay = (d: Date | null) => (d ? d.toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric" }) : "—")
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
      toast({ variant: "destructive", title: t("inventory:shipments.create.addressRequired"), description: t("inventory:shipments.create.addressRequiredDesc") })
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
      toast({ title: t("inventory:shipments.create.created"), description: `#${order.invoiceNo} · ${carrierLabel}` })
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
      toast({ variant: "destructive", title: t("inventory:shipments.create.failed"), description: err?.response?.data?.message || t("common:extra.tryAgain") })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] w-[calc(100%-2rem)] max-w-[1040px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px]"
      >
        <DialogHeader className="px-6 py-4 text-left">
          <DialogTitle>{t("orders:shipments.createShipment")}</DialogTitle>
          <DialogDescription>{t("inventory:shipments.create.description")}</DialogDescription>
        </DialogHeader>
        <Separator />

        <div className="flex min-h-0 flex-1 flex-wrap items-stretch overflow-y-auto">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[22px] px-6 py-5">
            {/* 1 · Order */}
            <fieldset className="flex flex-col gap-2.5">
              <SectionTitle as="legend" className="mb-2.5">{t("inventory:shipments.create.step1")}</SectionTitle>
              {!order ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Label htmlFor="ship-order-search" className="sr-only">{t("inventory:returns.customer.form.searchOrders")}</Label>
                    <Input id="ship-order-search" type="search" placeholder={t("inventory:shipments.create.searchPh")} value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-9" />
                  </div>
                  <Card role="listbox" aria-label={t("inventory:shipments.create.readyList")} className="max-h-[260px] gap-0 overflow-y-auto py-0 shadow-none">
                    <div className="bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                      {loadingOrders ? t("inventory:shipments.create.loadingOrders") : `${t("inventory:shipments.create.readyCount", { count: ordersTotal })}${ordersTotal > orders.length ? ` ${t("inventory:shipments.create.showingNarrow", { count: orders.length })}` : ""}`}
                    </div>
                    {orders.map((o) => {
                      return (
                        <Button key={o.id} type="button" variant="ghost" role="option" aria-selected={false} onClick={() => { setPicked(o); setOrderId(o.id); setAddrOv(null); setFeeOv(null); setCodOv(null) }}
                          className="h-auto min-h-14 w-full justify-start gap-3 rounded-none text-left whitespace-normal">
                          <span className="flex flex-1 flex-col">
                            <span className="text-sm font-semibold">#{o.invoiceNo}</span>
                            <span className="text-xs font-normal text-muted-foreground">
                              {o.customerName} · {o.address || t("inventory:shipments.create.addressMissing")}
                            </span>
                          </span>
                          <Badge variant={o.paymentLabel === "Paid" ? "default" : "secondary"}>
                            {o.paymentLabel === "Paid" ? t("common:payment.paid") : o.isCod ? t("common:extra.codShort") : t("common:payment.unpaid")}
                          </Badge>
                          <span className="w-[90px] text-right font-bold tabular-nums">{formatCurrency(Number(o.amount))}</span>
                        </Button>
                      )
                    })}
                    {!loadingOrders && orders.length === 0 && (
                      <>
                        <Separator />
                        <p className="p-4 text-sm text-muted-foreground">{orderSearch ? t("inventory:shipments.create.noMatching") : t("inventory:shipments.create.noOrders")}</p>
                      </>
                    )}
                  </Card>
                </>
              ) : (
                <Card className="flex-row flex-wrap gap-4 border-primary px-4 py-3.5 shadow-none">
                  <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                    <span className="font-bold">#{order.invoiceNo}</span>
                    <span className="text-sm">
                      {t("common:count.items", { count: order.itemCount })} · {formatCurrency(Number(order.amount))} ·{" "}
                      <span className="font-bold">{order.paymentLabel === "Paid" ? t("common:payment.paid") : order.isCod ? t("common:payment.cod") : t("common:payment.unpaid")}</span>
                    </span>
                  </div>
                  <div className="flex min-w-[260px] flex-1 flex-col gap-1 text-sm">
                    <span className="font-bold">{order.customerName}{order.customerPhone ? ` · ${order.customerPhone}` : ""}</span>
                    <FormField label={t("inventory:shipments.create.address")} htmlFor="ship-address" className="gap-1">
                      <Input id="ship-address" className="w-full" placeholder={t("inventory:shipments.create.addressPh")} value={addr}
                        onChange={(e) => setAddrOv(e.target.value)} />
                    </FormField>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setOrderId(null)} className="self-start">
                    {t("inventory:returns.change")}
                  </Button>
                </Card>
              )}
            </fieldset>

            {/* 2 · Courier */}
            <fieldset className="flex flex-col gap-2.5">
              <SectionTitle as="legend" className="mb-2.5">{t("inventory:shipments.create.step2")}</SectionTitle>
              <ChoiceCardGroup value={courier} onValueChange={(v) => { setCourier(v); setFeeOv(null); setCodOv(null) }} aria-label={t("orders:shipments.courier")}
                className="grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
                {COURIERS.map((c) => (
                  <ChoiceCard key={c.name} value={c.name} title={courierLabel(c.name)} description={COURIER_SUB_KEY[c.sub] ? t(COURIER_SUB_KEY[c.sub]) : c.sub} className="p-3"
                    icon={<UserAvatar shape="square" className="size-8" name={c.name} fallback={c.ini} />} />
                ))}
              </ChoiceCardGroup>
              {courier !== "Own rider" && courier !== "Other" && (
                <Alert>
                  <Check aria-hidden />
                  <AlertDescription>{t("inventory:shipments.create.notConnected", { courier })}</AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("inventory:shipments.create.tracking")} htmlFor="ship-tracking" className="min-w-0">
                  <Input id="ship-tracking" className="w-full" placeholder={t("inventory:shipments.create.trackingPh")} value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </FormField>
                {courier === "Other" && (
                  <FormField label={t("inventory:shipments.create.courierName")} htmlFor="ship-courier-name" className="min-w-0">
                    <Input id="ship-courier-name" className="w-full" placeholder={t("inventory:shipments.create.courierNamePh")} value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
                  </FormField>
                )}
                <FormField label={t("inventory:shipments.create.rider")} htmlFor="ship-rider" className="min-w-0">
                  <Input id="ship-rider" className="w-full" placeholder={t("inventory:shipments.create.riderPh")} value={rider} onChange={(e) => setRider(e.target.value)} />
                </FormField>
              </div>
              <ChoiceCardGroup value={activeSpeed.id} onValueChange={(v) => { setSpeed(v as typeof activeSpeed.id); setFeeOv(null); setCodOv(null) }} aria-label={t("inventory:shipments.create.speed")}
                className="grid-cols-2 gap-2.5">
                {speeds.map((s) => (
                  <ChoiceCard key={s.id} value={s.id} title={s.label} description={s.sub} className="p-3">
                    <span className="text-base font-bold tabular-nums">{formatCurrency(s.fee)}</span>
                  </ChoiceCard>
                ))}
              </ChoiceCardGroup>
            </fieldset>

            {/* 3 · Package */}
            <fieldset className="flex flex-col gap-2.5">
              <SectionTitle as="legend" className="mb-2.5">{t("inventory:shipments.create.step3")}</SectionTitle>
              <SegmentedControl aria-label={t("inventory:shipments.create.packageSize")} value={pack} onValueChange={pickPack}
                options={PACKS.map((p) => ({ value: p.id, label: t(p.label) }))} />
              <div className="grid grid-cols-3 gap-2.5">
                <FormField label={t("inventory:shipments.create.weight")} htmlFor="ship-weight" className="min-w-0">
                  <Input id="ship-weight" className="w-full" type="number" step="0.1" min={0} value={weight} onChange={(e) => { setWeight(e.target.value); setPack("custom") }} />
                </FormField>
                <FormField label={t("inventory:shipments.create.size")} htmlFor="ship-dims" className="min-w-0">
                  <Input id="ship-dims" className="w-full" value={dims} onChange={(e) => { setDims(e.target.value); setPack("custom") }} />
                </FormField>
                <FormField label={t("inventory:shipments.create.pickupDate")} htmlFor="ship-pickup" className="min-w-0">
                  <Input id="ship-pickup" className="w-full" type="date" value={pickup} onChange={(e) => setPickup(e.target.value)} />
                </FormField>
                <FormField label={t("inventory:shipments.create.noteForRider")} htmlFor="ship-note" className="col-span-3">
                  <Textarea id="ship-note" rows={2} placeholder={t("inventory:shipments.create.notePh")} value={note} onChange={(e) => setNote(e.target.value)} />
                </FormField>
              </div>
            </fieldset>
          </div>

          <aside aria-label={t("inventory:shipments.create.charges")} className="flex min-w-0 flex-[1_1_320px] flex-col gap-4 border-l bg-muted/40 px-6 py-5">
            <SectionTitle as="p">{t("inventory:shipments.create.step4")}</SectionTitle>
            <FormField
              label={t("inventory:shipments.create.amountToCollect")}
              htmlFor="ship-cod"
              description={!order ? t("inventory:shipments.create.selectOrderFirst") : due === 0 ? t("inventory:shipments.create.alreadyPaid")
                : payer === "customer" ? t("inventory:shipments.create.dueWithDelivery", { due: formatCurrency(due), fee: formatCurrency(fee) }) : t("inventory:shipments.create.due", { due: formatCurrency(due) })}
            >
              <Input id="ship-cod" className="w-full tabular-nums" type="number" min={0} step="0.01" disabled={!order}
                value={codOv !== null ? codOv : String(autoCod)} onChange={(e) => setCodOv(e.target.value)} />
            </FormField>
            <SegmentedControl aria-label={t("inventory:shipments.create.whoPays")} value={payer} onValueChange={(v) => { setPayer(v as typeof payer); setCodOv(null) }}
              className="grid w-full grid-cols-2"
              options={[{ value: "customer", label: t("inventory:shipments.create.customerPays") }, { value: "us", label: t("inventory:shipments.create.wePay") }]} />
            <Card className="gap-2 p-3.5 text-sm shadow-none">
              <InfoList>
                <InfoRow label={t("inventory:shipments.deliveryCharge")} className="items-center">
                  <Input type="number" min={0} step="0.01" aria-label={t("inventory:shipments.deliveryCharge")} value={feeOv !== null ? feeOv : String(activeSpeed.fee)}
                    onChange={(e) => { setFeeOv(e.target.value); setCodOv(null) }}
                    className="w-[110px] text-right tabular-nums" />
                </InfoRow>
                <InfoRow label={t("orders:shipments.csv.codFee")} value={<span className="tabular-nums">−{formatCurrency(codFee)}</span>} />
                <InfoRow label={t("inventory:shipments.create.customerPaysAmount")} value={<span className="tabular-nums">{formatCurrency(cod)}</span>} />
              </InfoList>
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="font-bold">{t("inventory:shipments.create.youReceive")}</span>
                <span className="text-2xl font-bold tabular-nums">{formatCurrency(net)}</span>
              </div>
              <span className="text-xs text-muted-foreground">{t("inventory:shipments.create.paidOutBy", { courier: carrierLabel })}</span>
            </Card>
            <Card className="gap-1 px-3.5 py-3 text-sm shadow-none">
              <span className="font-bold">{t("inventory:shipments.create.eta")}</span>
              <span className="text-muted-foreground">{etaTxt}</span>
            </Card>
            <Label className="flex min-h-8 items-center gap-2.5">
              <Checkbox checked={printLabel} onCheckedChange={(v) => setPrintLabel(v === true)} />
              {t("inventory:shipments.create.printLabel")}
            </Label>
            <Label className="flex min-h-8 items-center gap-2.5">
              <Checkbox checked={markPicked} onCheckedChange={(v) => setMarkPicked(v === true)} />
              {t("inventory:shipments.create.markShipped")}
            </Label>
          </aside>
        </div>

        <Separator />
        <DialogFooter className="flex flex-row flex-wrap items-center gap-2.5 px-6 py-4 sm:justify-between">
          <span className="text-sm text-muted-foreground">{order ? t("inventory:shipments.create.shippingWith", { invoice: order.invoiceNo, courier: carrierLabel }) : t("inventory:shipments.create.selectToContinue")}</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={submit} disabled={!order || saving}>
              {saving ? t("inventory:shipments.create.creating") : t("orders:shipments.createShipment")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
