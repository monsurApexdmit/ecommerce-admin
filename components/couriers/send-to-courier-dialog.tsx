"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Info, Truck } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { UserAvatar } from "@/components/common/UserAvatar"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import {
  courierApi, courierError, type CourierAccount, type CourierQuote, type CourierRisk, type CourierShipment,
  type DeliveryType, type ItemType, type PathaoStore,
} from "@/lib/courierApi"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { COURIER_NS } from "./i18n"
import { PROVIDER_META, accountName } from "./courier-ui"
import { EMPTY_LOCATION, PathaoLocationFields, type PathaoLocation } from "./location-picker"
import { defaultAccount, useBookableCouriers } from "./use-courier-accounts"

/** Amount still owed on an order (0 when paid) — the default COD. */
export const orderDue = (s: Pick<SellResponse, "amount" | "paidAmount" | "paymentStatus">) =>
  s.paymentStatus === "paid" ? 0 : Math.max(0, Math.round(((Number(s.amount) || 0) - (Number(s.paidAmount) || 0)) * 100) / 100)

const orderAddress = (s: SellResponse) =>
  [s.shippingAddressLine1, s.shippingAddressLine2, s.shippingCity, s.shippingState].filter(Boolean).join(", ")

const itemSummary = (s: SellResponse) =>
  (s.items ?? []).map((it) => `${it.quantity ?? 1}x ${(it as { productName?: string }).productName ?? ""}`.trim()).filter(Boolean).join(", ").slice(0, 200)

interface Form {
  name: string
  phone: string
  address: string
  cod: string
  weight: string
  deliveryType: DeliveryType
  itemType: ItemType
  itemDescription: string
  note: string
  storeId: string
  location: PathaoLocation
}

const fromAccount = (a: CourierAccount | null, prev?: Partial<Form>): Partial<Form> => ({
  weight: String(a?.settings?.weightKg ?? prev?.weight ?? 0.5),
  deliveryType: (a?.settings?.deliveryType ?? 48) as DeliveryType,
  itemType: (a?.settings?.itemType ?? 2) as ItemType,
  note: a?.settings?.note ?? "",
  storeId: a?.credentials?.storeId != null ? String(a.credentials.storeId) : "",
  location: EMPTY_LOCATION,
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Order to book */
  sellId: number | null
  /** Preselect this account (else the default one) */
  accountId?: number | null
  onBooked?: (shipment: CourierShipment) => void
}

/** Books one order with a connected courier (Pathao / Steadfast): recipient, COD, parcel and Pathao delivery area. */
export function SendToCourierDialog({ open, onOpenChange, sellId, accountId: preferId, onBooked }: Props) {
  const { t } = useTranslation(COURIER_NS)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const couriers = useBookableCouriers(open)

  const [sale, setSale] = useState<SellResponse | null>(null)
  const [saleError, setSaleError] = useState(false)
  const [accountId, setAccountId] = useState<number | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [stores, setStores] = useState<PathaoStore[]>([])
  const [quote, setQuote] = useState<CourierQuote | null>(null)
  const [quoting, setQuoting] = useState(false)
  const [risk, setRisk] = useState<CourierRisk | null>(null)

  const account = couriers.accounts.find((a) => a.id === accountId) ?? null
  const isPathao = account?.provider === "pathao"

  // Load the order each time the dialog opens
  useEffect(() => {
    if (!open || !sellId) return
    let cancelled = false
    setSale(null); setSaleError(false); setForm(null); setErrors({}); setQuote(null); setRisk(null)
    sellsApi.getById(sellId)
      .then((r) => { if (!cancelled) setSale(r.data) })
      .catch(() => { if (!cancelled) setSaleError(true) })
    return () => { cancelled = true }
  }, [open, sellId])

  // Pick the account once accounts are in
  useEffect(() => {
    if (!open || !couriers.loaded) return
    const list = couriers.accounts
    const preferred = list.find((a) => a.id === preferId)
    setAccountId((cur) => preferred?.id ?? (cur && list.some((a) => a.id === cur) ? cur : defaultAccount(list)?.id ?? null))
  }, [open, couriers.loaded, couriers.accounts, preferId])

  // Prefill from the order + account defaults
  useEffect(() => {
    if (!sale || form || !couriers.loaded) return
    const acc = couriers.accounts.find((a) => a.id === accountId) ?? null
    if (!acc && couriers.accounts.length > 0) return // account not picked yet
    setForm({
      name: sale.shippingFullName || sale.customerName || "",
      phone: sale.shippingPhone || sale.shippingAddress?.phone || "",
      address: orderAddress(sale),
      cod: String(orderDue(sale)),
      itemDescription: acc?.settings?.itemDescription || itemSummary(sale),
      ...(fromAccount(acc) as Required<Pick<Form, "weight" | "deliveryType" | "itemType" | "note" | "storeId" | "location">>),
    })
  }, [sale, form, accountId, couriers.accounts, couriers.loaded])

  // Pathao stores of the chosen account
  useEffect(() => {
    setStores([])
    if (!open || !account || account.provider !== "pathao") return
    let cancelled = false
    courierApi.stores(account.id).then((list) => {
      if (cancelled) return
      setStores(list)
      setForm((f) => (f && !f.storeId && list.length ? { ...f, storeId: String((list.find((s) => s.isDefault) ?? list[0]).id) } : f))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [open, account])

  // Delivery charge quote (Pathao, once city + zone are known)
  const quoteKey = form && isPathao && form.location.cityId && form.location.zoneId
    ? [accountId, form.location.cityId, form.location.zoneId, form.weight, form.deliveryType, form.itemType].join("|") : ""
  useEffect(() => {
    setQuote(null)
    if (!quoteKey || !form || !accountId) return
    let cancelled = false
    setQuoting(true)
    const timer = setTimeout(() => {
      courierApi.quote({
        courierAccountId: accountId, sellId: sellId ?? undefined, weightKg: Number(form.weight) || undefined,
        deliveryType: form.deliveryType, itemType: form.itemType,
        cityId: form.location.cityId ?? undefined, zoneId: form.location.zoneId ?? undefined,
      })
        .then((q) => { if (!cancelled) setQuote(q) })
        .catch((e) => { if (!cancelled) setQuote({ available: false, deliveryFee: null, message: courierError(e, "") || null }) })
        .finally(() => { if (!cancelled) setQuoting(false) })
    }, 400)
    return () => { cancelled = true; clearTimeout(timer); setQuoting(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  // Customer delivery success rate (optional endpoint; Pathao only)
  const phone = form?.phone.replace(/\D/g, "") ?? ""
  useEffect(() => {
    setRisk(null)
    if (!open || !isPathao || phone.length < 11 || !accountId) return
    let cancelled = false
    const timer = setTimeout(() => {
      courierApi.risk(phone, accountId).then((r) => { if (!cancelled && r?.available) setRisk(r) }).catch(() => {})
    }, 600)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [open, isPathao, phone, accountId])

  const patch = (p: Partial<Form>) => { setForm((f) => (f ? { ...f, ...p } : f)); setErrors({}) }
  const pickAccount = (id: string) => {
    const acc = couriers.accounts.find((a) => String(a.id) === id) ?? null
    setAccountId(acc?.id ?? null)
    setForm((f) => (f ? { ...f, ...fromAccount(acc, f), itemDescription: acc?.settings?.itemDescription || f.itemDescription } : f))
    setErrors({})
  }

  const due = sale ? orderDue(sale) : 0
  const providerLabel = account ? accountName(account) : ""

  const validate = (f: Form) => {
    const e: Record<string, string> = {}
    if (!f.name.trim()) e["recipient.name"] = t("courier:book.err.name")
    if (f.phone.replace(/\D/g, "").length < 10) e["recipient.phone"] = t("courier:book.err.phone")
    if (!f.address.trim()) e["recipient.address"] = t("courier:book.err.address")
    const cod = Number(f.cod)
    if (f.cod === "" || !Number.isFinite(cod) || cod < 0) e.codAmount = t("courier:book.err.cod")
    const w = Number(f.weight)
    if (!Number.isFinite(w) || w <= 0) e.weightKg = t("courier:book.err.weight")
    if (account?.provider === "pathao" && !f.storeId && stores.length > 0) e["pathao.storeId"] = t("courier:book.err.store")
    return e
  }

  const submit = async () => {
    if (!form || !sellId || !account) return
    const e = validate(form)
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const loc = form.location
      const s = await courierApi.book(sellId, {
        courierAccountId: account.id,
        codAmount: Number(form.cod),
        weightKg: Number(form.weight),
        ...(isPathao ? { deliveryType: form.deliveryType, itemType: form.itemType } : {}),
        itemDescription: form.itemDescription.trim() || undefined,
        note: form.note.trim() || undefined,
        recipient: { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim() },
        ...(isPathao ? {
          pathao: {
            storeId: form.storeId ? Number(form.storeId) : undefined,
            cityId: loc.cityId ?? undefined, cityName: loc.cityId ? loc.cityName : undefined,
            zoneId: loc.zoneId ?? undefined, zoneName: loc.zoneId ? loc.zoneName : undefined,
            areaId: loc.areaId ?? undefined, areaName: loc.areaId ? loc.areaName : undefined,
          },
        } : {}),
      })
      const code = s.courierBooking?.trackingCode || s.courierBooking?.consignmentId || s.trackingNumber
      toast({ title: t("courier:book.toast.booked", { courier: providerLabel }), description: code ? t("courier:book.toast.tracking", { code }) : undefined })
      onBooked?.(s)
      onOpenChange(false)
    } catch (err: any) {
      const fieldErrors = err?.response?.data?.errors
      if (fieldErrors && typeof fieldErrors === "object") {
        const out: Record<string, string> = {}
        Object.entries(fieldErrors).forEach(([k, v]) => { out[k] = Array.isArray(v) ? String(v[0]) : String(v) })
        setErrors(out)
      }
      toast({ variant: "destructive", title: t("courier:book.toast.failed"), description: courierError(err, t("common:extra.tryAgain")) })
    } finally {
      setSaving(false)
    }
  }

  const loading = couriers.loading || (!sale && !saleError) || (!!sale && !form && couriers.accounts.length > 0)
  const noCouriers = couriers.loaded && couriers.accounts.length === 0
  const generalError = errors.courier || errors.courierAccountId || errors.sell

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>{sale ? t("courier:book.titleInvoice", { invoice: sale.invoiceNo }) : t("courier:book.title")}</DialogTitle>
          <DialogDescription>{t("courier:book.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
          {saleError || couriers.error ? (
            <Alert variant="destructive"><AlertDescription>{t("common:extra.couldNotLoad")}</AlertDescription></Alert>
          ) : noCouriers ? (
            <EmptyState
              bordered
              icon={Truck}
              title={t("courier:book.noCouriers")}
              description={t("courier:book.noCouriersDesc")}
              action={<Button asChild variant="outline"><Link href="/dashboard/shipping-methods">{t("courier:book.connectCourier")}</Link></Button>}
            />
          ) : loading || !form ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : (
            <>
              {/* Courier */}
              <section className="space-y-2.5">
                <SectionTitle>{t("courier:book.courier")}</SectionTitle>
                <ChoiceCardGroup value={accountId ? String(accountId) : ""} onValueChange={pickAccount} aria-label={t("courier:book.courier")}
                  className="grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {couriers.accounts.map((a) => (
                    <ChoiceCard key={a.id} value={String(a.id)} className="p-3"
                      icon={<UserAvatar shape="square" className="size-8" name={accountName(a)} fallback={PROVIDER_META[a.provider]?.ini ?? a.provider.slice(0, 2).toUpperCase()} />}
                      title={accountName(a)}
                      description={[a.isDefault ? t("courier:integrations.default") : null, a.environment === "sandbox" ? t("courier:integrations.sandbox") : null].filter(Boolean).join(" · ") || undefined} />
                  ))}
                </ChoiceCardGroup>
                {generalError && <p className="text-sm font-medium text-destructive">{generalError}</p>}
              </section>

              {/* Recipient */}
              <section className="space-y-2.5">
                <SectionTitle>{t("courier:book.recipient")}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("courier:book.name")} htmlFor="cb-name" required error={errors["recipient.name"]}>
                    <Input id="cb-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} aria-invalid={!!errors["recipient.name"]} />
                  </FormField>
                  <FormField label={t("common:fields.phone")} htmlFor="cb-phone" required error={errors["recipient.phone"]}
                    description={risk ? t("courier:book.risk", { rate: Math.round(Number(risk.successRate) || 0), delivered: risk.delivered ?? 0, total: risk.totalParcels ?? 0 }) : undefined}>
                    <Input id="cb-phone" inputMode="tel" value={form.phone} onChange={(e) => patch({ phone: e.target.value })} aria-invalid={!!errors["recipient.phone"]} />
                  </FormField>
                  <FormField label={t("common:fields.address")} htmlFor="cb-address" required error={errors["recipient.address"]} className="sm:col-span-2">
                    <Textarea id="cb-address" rows={2} value={form.address} onChange={(e) => patch({ address: e.target.value })} aria-invalid={!!errors["recipient.address"]} />
                  </FormField>
                </div>
              </section>

              {/* Pathao delivery area */}
              {isPathao && account && (
                <section className="space-y-2.5">
                  <SectionTitle>{t("courier:book.deliveryArea")}</SectionTitle>
                  <PathaoLocationFields accountId={account.id} value={form.location} idPrefix="cb-loc"
                    onChange={(location) => patch({ location })} />
                  <p className="text-xs text-muted-foreground">{t("courier:book.areaHint")}</p>
                  {stores.length > 1 && (
                    <FormField label={t("courier:book.pickupStore")} htmlFor="cb-store" error={errors["pathao.storeId"]}>
                      <Select value={form.storeId} onValueChange={(v) => patch({ storeId: v })}>
                        <SelectTrigger id="cb-store" className="w-full"><SelectValue placeholder={t("courier:book.pickStore")} /></SelectTrigger>
                        <SelectContent>
                          {stores.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                  {errors["pathao.storeId"] && stores.length <= 1 && <p className="text-sm text-destructive">{errors["pathao.storeId"]}</p>}
                </section>
              )}

              {/* Parcel */}
              <section className="space-y-2.5">
                <SectionTitle>{t("courier:book.parcel")}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("courier:book.cod")} htmlFor="cb-cod" error={errors.codAmount}
                    description={due > 0 ? t("courier:book.codDue", { due: formatCurrency(due) }) : t("courier:book.codPaid")}>
                    <Input id="cb-cod" type="number" min={0} step="0.01" className="tabular-nums" value={form.cod}
                      onChange={(e) => patch({ cod: e.target.value })} aria-invalid={!!errors.codAmount} />
                  </FormField>
                  <FormField label={t("courier:book.weight")} htmlFor="cb-weight" error={errors.weightKg}>
                    <Input id="cb-weight" type="number" min={0.1} step="0.1" value={form.weight}
                      onChange={(e) => patch({ weight: e.target.value })} aria-invalid={!!errors.weightKg} />
                  </FormField>
                  {isPathao && (
                    <>
                      <FormField label={t("courier:book.deliveryType")}>
                        <SegmentedControl aria-label={t("courier:book.deliveryType")} value={String(form.deliveryType)}
                          onValueChange={(v) => patch({ deliveryType: Number(v) as DeliveryType })}
                          options={[{ value: "48", label: t("courier:deliveryType.normal") }, { value: "12", label: t("courier:deliveryType.onDemand") }]} />
                      </FormField>
                      <FormField label={t("courier:book.itemType")}>
                        <SegmentedControl aria-label={t("courier:book.itemType")} value={String(form.itemType)}
                          onValueChange={(v) => patch({ itemType: Number(v) as ItemType })}
                          options={[{ value: "2", label: t("courier:itemType.parcel") }, { value: "1", label: t("courier:itemType.document") }]} />
                      </FormField>
                    </>
                  )}
                  <FormField label={t("courier:book.itemDescription")} htmlFor="cb-items" className="sm:col-span-2" error={errors.itemDescription}>
                    <Input id="cb-items" value={form.itemDescription} maxLength={255} onChange={(e) => patch({ itemDescription: e.target.value })} />
                  </FormField>
                  <FormField label={t("courier:book.note")} htmlFor="cb-note" className="sm:col-span-2" error={errors.note}>
                    <Textarea id="cb-note" rows={2} value={form.note} maxLength={500} placeholder={t("courier:book.notePh")} onChange={(e) => patch({ note: e.target.value })} />
                  </FormField>
                </div>
              </section>

              {/* Charges */}
              <Card className="gap-2 p-4 text-sm shadow-none">
                <InfoList>
                  <InfoRow label={t("courier:book.collect")} value={<span className="tabular-nums">{formatCurrency(Number(form.cod) || 0)}</span>} />
                  <InfoRow label={t("courier:book.charge")} value={
                    !isPathao ? <span className="font-normal text-muted-foreground">{t("courier:book.chargeOnInvoice", { courier: providerLabel })}</span>
                      : quoting ? <span className="font-normal text-muted-foreground">{t("courier:book.quoting")}</span>
                      : quote?.available && quote.deliveryFee != null ? <span className="tabular-nums">{formatCurrency(Number(quote.deliveryFee))}</span>
                      : <span className="font-normal text-muted-foreground">{quote?.message || t("courier:book.pickAreaForCharge")}</span>
                  } />
                  {isPathao && quote?.available && quote.codFeePercent != null && Number(form.cod) > 0 && (
                    <InfoRow label={t("courier:book.codFee", { pct: quote.codFeePercent })}
                      value={<span className="tabular-nums">{formatCurrency(Math.round(Number(form.cod) * Number(quote.codFeePercent)) / 100)}</span>} />
                  )}
                </InfoList>
              </Card>

              {account?.environment === "sandbox" && (
                <Alert>
                  <Info aria-hidden />
                  <AlertDescription>{t("courier:book.sandboxNote")}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
          {!noCouriers && (
            <Button type="button" disabled={saving || loading || !form || !account} onClick={submit}>
              {saving ? t("courier:book.booking") : account ? t("courier:book.bookWith", { courier: providerLabel }) : t("courier:book.book")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Whether an order can be sent to a courier: not cancelled/delivered/POS and no live courier booking (a manual shipment gets filled in). */
export function canSendToCourier(o: Pick<SellResponse, "status" | "source" | "shipments">): boolean {
  if (o.status === "Cancelled" || o.status === "Delivered" || o.source === "pos") return false
  return !(o.shipments ?? []).some((s) => s.courierBooking && !s.courierBooking.isFinal && !["returned", "cancelled"].includes(String(s.status).toLowerCase()))
}
