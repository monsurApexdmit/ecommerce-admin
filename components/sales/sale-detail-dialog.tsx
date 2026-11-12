"use client"

import { paymentApi } from "@/lib/paymentApi"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import Link from "next/link"
import { AlertTriangle, Megaphone, MapPin, Pencil, Phone, Printer } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { FollowUpDialog, FollowUpHistory, canFollowUp, useFollowUps } from "@/components/sales/order-follow-up"
import { AdSourceBadge, OrderFlagBadges } from "@/components/sales/ad-source"
import { useToast } from "@/hooks/use-toast"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
import { ORDERS_NS, channelLabel, methodLabel, orderStatusLabel, payLabel, type OrdersKey } from "@/components/sales/i18n"

/** Badge variant per payment label (Paid / Partial / Due). */
export const SALE_PAY_VARIANT = {
  Paid: "default",
  Partial: "secondary",
  Due: "destructive",
} as const

/** Paid / Partial / Due plus the amount still owed for a sale. */
export function salePayment(s: SellResponse): { label: keyof typeof SALE_PAY_VARIANT; due: number } {
  const amount = Number(s.amount) || 0
  if (s.paymentStatus === "paid") return { label: "Paid", due: 0 }
  const due = Math.max(0, amount - (Number(s.paidAmount) || 0))
  return { label: s.paymentStatus === "partially_paid" ? "Partial" : "Due", due }
}

/** "Packed" and "Shipped" are derived from fulfillment: set aside / handed to a courier, not yet delivered. */
export function saleDisplayStatus(s: SellResponse): string {
  if (s.status === "Delivered" || s.status === "Cancelled") return s.status
  if (s.fulfillmentStatus === "shipped") return "Shipped"
  if (s.fulfillmentStatus === "packed") return "Packed"
  return s.status
}

export function saleShippingLines(s: SellResponse): string[] {
  return [
    s.shippingFullName || s.customerName || "",
    [s.shippingAddressLine1, s.shippingAddressLine2].filter(Boolean).join(", "),
    [s.shippingCity, s.shippingState, s.shippingPostalCode].filter(Boolean).join(", "),
    s.shippingCountry || "",
    s.shippingPhone || "",
  ].filter(Boolean)
}

const PAY_METHODS = ["Cash", "bKash", "Nagad", "Card", "Bank", "COD"] as const

/** Next step in Confirm -> Packed -> Shipped -> Delivered, or null when there is none to do from here. `label` is a translation key. */
function nextStep(s: SellResponse): { label: OrdersKey; run: () => Promise<{ data: SellResponse }> } | null {
  const st = saleDisplayStatus(s)
  if (st === "Pending") return { label: "common:actions.confirm", run: () => sellsApi.updateStatus(s.id, "Processing") }
  if (st === "Processing") return { label: "orders:detail.step.packed", run: () => sellsApi.updateFulfillment(s.id, "packed") }
  if (st === "Packed") return { label: "orders:detail.step.shipped", run: () => sellsApi.updateFulfillment(s.id, "shipped") }
  if (st === "Shipped") return { label: "orders:detail.step.delivered", run: () => sellsApi.updateStatus(s.id, "Delivered") }
  return null
}

const PHONE_RE = /^\+?[0-9][0-9\s\-()]{6,18}$/

interface SaleDetailDialogProps {
  sale: SellResponse | null
  onClose: () => void
  onPrint: (sale: SellResponse) => void
  /** Override the built-in payment form (e.g. a shared record-payment dialog). */
  onRecordPayment?: (sale: SellResponse) => void
  /** Called with the refreshed sale after a status change or payment, so the host list can update. */
  onChanged?: (sale: SellResponse) => void
  /** Host callback to open a create-shipment flow for this order. */
  onCreateShipment?: (sale: SellResponse) => void
  /** Called after the order is deleted (the dialog then closes). */
  onDeleted?: (sale: SellResponse) => void
}

export function SaleDetailDialog({ sale: saleProp, onClose, onPrint, onRecordPayment, onChanged, onCreateShipment, onDeleted }: SaleDetailDialogProps) {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const { t, i18n } = useTranslation(ORDERS_NS)
  const tag = localeTag(i18n.language)
  const [sale, setSale] = useState<SellResponse | null>(saleProp)
  const [busy, setBusy] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState<string>("Cash")
  const [txn, setTxn] = useState("")

  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ name: "", phone: "", address: "", note: "" })
  const [formErr, setFormErr] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState<null | "cancel" | "delete">(null)
  const [reason, setReason] = useState("")
  const [followUpOpen, setFollowUpOpen] = useState(false)
  // History only for orders that show the Follow-ups section
  const followUps = useFollowUps(saleProp && (canFollowUp(saleProp) || (Number(saleProp.followUpCount) || 0) > 0) ? saleProp.id : null)

  useEffect(() => { setSale(saleProp); setPayOpen(false); setEditOpen(false); setConfirm(null); setReason("") }, [saleProp])

  const openEdit = (s: SellResponse) => {
    setForm({
      name: s.shippingFullName || s.customerName || "",
      phone: s.shippingPhone || s.shippingAddress?.phone || "",
      address: [s.shippingAddressLine1, s.shippingAddressLine2].filter(Boolean).join(", "),
      note: s.notes || "",
    })
    setFormErr({}); setEditOpen(true)
  }

  const saveDetails = async () => {
    if (!sale) return
    const err: Record<string, string> = {}
    if (!form.name.trim()) err.name = t("orders:detail.err.receiverRequired")
    if (!form.phone.trim()) err.phone = t("orders:detail.err.phoneRequired")
    else if (!PHONE_RE.test(form.phone.trim())) err.phone = t("orders:detail.err.phoneInvalid")
    if (!form.address.trim()) err.address = t("orders:detail.err.addressRequired")
    if (form.note.length > 500) err.note = t("orders:detail.err.noteMax", { max: 500 })
    setFormErr(err)
    if (Object.keys(err).length) return
    setBusy(true)
    try {
      const res = await sellsApi.updateDeliveryDetails(sale.id, {
        shippingFullName: form.name.trim(), shippingPhone: form.phone.trim(),
        shippingAddressLine1: form.address.trim(), notes: form.note.trim(),
      })
      const fresh = await sellsApi.getById(sale.id).catch(() => res)
      apply(fresh.data)
      setEditOpen(false)
      toast({ title: t("orders:detail.toast.deliveryUpdated") })
    } catch (e: any) {
      toast({ title: t("orders:detail.toast.updateDetailsFailed"), description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const cancelOrder = async () => {
    if (!sale) return
    setBusy(true)
    try {
      const res = await sellsApi.updateStatus(sale.id, "Cancelled", reason.trim() || undefined)
      apply(res.data); setConfirm(null); setReason("")
      toast({ title: t("orders:detail.toast.orderCancelled") })
    } catch (e: any) {
      toast({ title: t("orders:detail.toast.cancelFailed"), description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const deleteOrder = async () => {
    if (!sale) return
    setBusy(true)
    try {
      await sellsApi.delete(sale.id)
      toast({ title: t("orders:detail.toast.orderDeleted") })
      onDeleted?.(sale); onChanged?.(sale); onClose()
    } catch (e: any) {
      toast({ title: t("orders:detail.toast.deleteFailed"), description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false); setConfirm(null) }
  }

  const apply = (next: SellResponse | undefined) => {
    if (!next) return
    setSale(next)
    onChanged?.(next)
  }

  const advance = async (step: NonNullable<ReturnType<typeof nextStep>>) => {
    setBusy(true)
    try {
      const res = await step.run()
      apply(res.data)
      toast({ title: t("orders:detail.toast.orderUpdated") })
    } catch (e: any) {
      toast({ title: t("orders:detail.toast.statusFailed"), description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const submitPayment = async (due: number) => {
    if (!sale) return
    const amt = Number(amount)
    if (amt > due + 0.005) {
      toast({ title: t("orders:detail.toast.invalidAmount"), description: t("orders:detail.toast.exceedsDue", { due: formatCurrency(due) }), variant: "destructive" })
      return
    }
    if (!(amt > 0)) {
      toast({ title: t("orders:detail.toast.invalidAmount"), description: t("orders:detail.toast.amountPositive"), variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      await paymentApi.recordPayment("sells", sale.id, {
        amount: amt, paymentMethod: method, paymentDate: new Date().toISOString().slice(0, 10), referenceNo: txn.trim() || undefined,
      })
      const fresh = await sellsApi.getById(sale.id)
      apply(fresh.data)
      setPayOpen(false); setAmount(""); setTxn("")
      toast({ title: t("orders:detail.toast.paymentRecorded") })
    } catch (e: any) {
      toast({ title: t("orders:detail.toast.paymentFailed"), description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!saleProp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("orders:detail.title", { invoice: sale?.invoiceNo ?? "" })}</DialogTitle>
          <DialogDescription className="sr-only">{t("orders:detail.srDescription")}</DialogDescription>
        </DialogHeader>
        {sale && (() => {
          const pay = salePayment(sale)
          const status = saleDisplayStatus(sale)
          const cancelled = sale.status === "Cancelled"
          const shipment = sale.shipments?.[0]
          const courier = sale.courier || shipment?.courier || shipment?.carrier || sale.carrier || ""
          const tracking = shipment?.trackingNumber || sale.trackingNumber || ""
          const zone = sale.zoneName || shipment?.zone || ""
          const items = sale.items ?? []
          const lineOf = (it: any) => {
            const price = Number(it.unit_price ?? it.unitPrice ?? it.price ?? 0)
            const qty = Number(it.quantity ?? 1)
            return { price, qty, disc: Number(it.discount) || 0 }
          }
          const hasLineDisc = items.some((it) => lineOf(it).disc > 0)
          const subtotal = items.reduce((a, it) => { const l = lineOf(it); return a + l.price * l.qty }, 0)
          const lineDiscTotal = items.reduce((a, it) => a + lineOf(it).disc, 0)
          const orderDisc = Number(sale.discount) || 0
          const delivery = Number(sale.shippingCost) || 0
          const total = Number(sale.amount) || 0
          const tax = sale.taxAmount != null ? Number(sale.taxAmount) : items.length ? Math.round((total - (subtotal - lineDiscTotal - orderDisc + delivery)) * 100) / 100 : 0
          const paid = Math.max(0, total - pay.due)
          const step = cancelled ? null : nextStep(sale)
          const receiverName = sale.shippingFullName || sale.customerName
          const receiverPhone = sale.shippingPhone || sale.shippingAddress?.phone || ""
          const utm: [string, string | null | undefined][] = [
            ["utm_source", sale.utmSource], ["utm_medium", sale.utmMedium], ["utm_campaign", sale.utmCampaign],
            ["utm_content", sale.utmContent], ["utm_term", sale.utmTerm],
          ]
          const hasAttribution = !!(sale.adSource || sale.campaignLink || utm.some(([, v]) => v) || sale.clickId || sale.landingUrl || sale.referrer)
          return (
            <div className="space-y-5">
              {sale.possibleDuplicate && (
                <Alert variant="destructive">
                  <AlertTriangle aria-hidden />
                  <AlertTitle>{t("orders:detail.duplicateTitle")}</AlertTitle>
                  <AlertDescription>{t("orders:detail.duplicateDesc")}</AlertDescription>
                </Alert>
              )}
              {cancelled && sale.paymentStatus === "paid" && /refund/i.test(sale.cancelReason ?? "") && (
                <Alert variant="destructive">
                  <AlertTriangle aria-hidden />
                  <AlertTitle>{t("orders:detail.refundTitle")}</AlertTitle>
                  <AlertDescription>{t("orders:detail.refundDesc")}</AlertDescription>
                </Alert>
              )}
              {cancelled && sale.cancelReason && !/refund/i.test(sale.cancelReason) && (
                <Alert>
                  <AlertTitle>{t("orders:detail.cancelledTitle", { reason: sale.cancelReason })}</AlertTitle>
                  <AlertDescription>{t("orders:detail.cancelledDesc")}</AlertDescription>
                </Alert>
              )}
              {!cancelled && sale.paymentStatus === "pending_payment" && sale.stockHoldExpiresAt && (
                <Alert>
                  <AlertTitle>{t("orders:detail.awaitingTitle")}</AlertTitle>
                  <AlertDescription>
                    {t("orders:detail.awaitingDesc", { time: new Date(sale.stockHoldExpiresAt).toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" }) })}
                  </AlertDescription>
                </Alert>
              )}
              <InfoList className="grid-cols-2 gap-4 sm:grid-cols-3">
                <InfoRow layout="stacked" label={t("common:fields.date")} value={new Date(sale.orderTime).toLocaleString(tag)} />
                <InfoRow layout="stacked" label={t("common:fields.customer")} value={sale.customerName} />
                <InfoRow layout="stacked" label={t("orders:detail.method")} value={methodLabel(t, sale.method)} />
                <InfoRow layout="stacked" label={t("common:fields.status")} value={<StatusBadge status={status} label={orderStatusLabel(t, status)} />} />
                <InfoRow layout="stacked" label={t("orders:detail.payment")} value={<StatusBadge status={pay.label} variant={SALE_PAY_VARIANT[pay.label]} label={payLabel(t, pay.label)} />} />
                <InfoRow layout="stacked" label={t("orders:detail.channelLocation")} value={[channelLabel(t, sale.source), sale.locationName || ""].filter(Boolean).join(" · ") || "—"} />
                {(sale.adSource || sale.isQuickOrder) && (
                  <InfoRow layout="stacked" label={t("orders:detail.source")} value={
                    <span className="flex flex-wrap gap-1">
                      <AdSourceBadge source={sale.adSource} label={sale.adSourceLabel} />
                      <OrderFlagBadges order={{ isQuickOrder: sale.isQuickOrder }} />
                    </span>
                  } />
                )}
                {sale.couponCode && <InfoRow layout="stacked" label={t("orders:detail.coupon")} value={<span className="font-mono text-[13px]">{sale.couponCode}</span>} />}
                {(sale.transactionId || sale.paymentTransactionId) && <InfoRow layout="stacked" label={t("orders:detail.transactionId")} value={<span className="break-all font-mono text-[13px]">{sale.transactionId || sale.paymentTransactionId}</span>} />}
              </InfoList>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="gap-2 p-4">
                  <SectionTitle className="flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden /> {t("orders:detail.deliveryAddress")}
                  </SectionTitle>
                  {saleShippingLines(sale).length ? (
                    <div className="space-y-0.5 text-sm">{saleShippingLines(sale).map((l, i) => <p key={i}>{l}</p>)}</div>
                  ) : <p className="text-sm text-muted-foreground">{t("orders:detail.noAddress")}</p>}
                </Card>
                <Card className="gap-2 p-4 text-sm">
                  <SectionTitle>{t("orders:detail.receiverCourier")}</SectionTitle>
                  <InfoList className="grid-cols-2 gap-x-3 gap-y-2">
                    <InfoRow layout="stacked" label={t("orders:detail.receiver")} value={receiverName || "—"} />
                    <InfoRow layout="stacked" label={t("common:fields.phone")} value={receiverPhone || "—"} />
                    <InfoRow layout="stacked" label={t("orders:detail.courier")} value={courier || "—"} />
                    <InfoRow layout="stacked" label={t("orders:detail.zone")} value={zone || "—"} />
                    <InfoRow layout="stacked" className="col-span-2" label={t("orders:detail.tracking")} value={<span className="break-all font-mono text-[13px]">{tracking || "—"}</span>} />
                  </InfoList>
                </Card>
              </div>

              {hasAttribution && (
                <Card className="gap-2 p-4 text-sm">
                  <SectionTitle className="flex items-center gap-1.5">
                    <Megaphone className="size-4" aria-hidden /> {t("orders:detail.adCampaign")}
                  </SectionTitle>
                  <InfoList className="grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                    {sale.campaignLink && (
                      <InfoRow layout="stacked" className="col-span-2 sm:col-span-3" label={t("orders:detail.orderLink")} value={
                        <Link href={`/dashboard/marketing/links?link=${sale.campaignLink.id}`} className="text-primary underline-offset-4 hover:underline">
                          {sale.campaignLink.name} <span className="font-mono text-xs text-muted-foreground">/{sale.campaignLink.code}</span>
                        </Link>
                      } />
                    )}
                    {utm.filter(([, v]) => v).map(([k, v]) => (
                      <InfoRow key={k} layout="stacked" label={k} value={<span className="break-all font-mono text-[13px]">{v}</span>} />
                    ))}
                    {sale.clickId && <InfoRow layout="stacked" className="col-span-2 sm:col-span-3" label={t("orders:detail.clickId")} value={<span className="break-all font-mono text-xs">{sale.clickId}</span>} />}
                    {sale.landingUrl && <InfoRow layout="stacked" className="col-span-2 sm:col-span-3" label={t("orders:detail.landingPage")} value={<span className="break-all font-mono text-xs">{sale.landingUrl}</span>} />}
                    {sale.referrer && <InfoRow layout="stacked" className="col-span-2 sm:col-span-3" label={t("orders:detail.referrer")} value={<span className="break-all font-mono text-xs">{sale.referrer}</span>} />}
                  </InfoList>
                </Card>
              )}

              {(sale.deliveryNote || sale.notes) && (
                <Card className="gap-1 p-4 text-sm">
                  <SectionTitle>{sale.deliveryNote ? t("orders:detail.deliveryNote") : t("common:fields.notes")}</SectionTitle>
                  <p className="whitespace-pre-line">{sale.deliveryNote || sale.notes}</p>
                </Card>
              )}

              {(canFollowUp(sale) || (Number(sale.followUpCount) || 0) > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <SectionTitle className="flex items-center gap-1.5">
                      <Phone className="size-4" aria-hidden /> {t("orders:detail.followUps")}
                    </SectionTitle>
                    {canFollowUp(sale) && (
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setFollowUpOpen(true)}>
                        <Phone className="size-4" aria-hidden /> {t("orders:detail.followUp")}
                      </Button>
                    )}
                  </div>
                  <FollowUpHistory items={followUps.items} loading={followUps.loading} />
                </div>
              )}

              {editOpen && (
                <Card className="gap-3 p-4 text-sm">
                  <SectionTitle>{t("orders:detail.editTitle")}</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label={t("orders:detail.receiverName")} htmlFor="sale-edit-name" error={formErr.name}>
                      <Input id="sale-edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!formErr.name} />
                    </FormField>
                    <FormField label={t("common:fields.phone")} htmlFor="sale-edit-phone" error={formErr.phone}>
                      <Input id="sale-edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" aria-invalid={!!formErr.phone} />
                    </FormField>
                  </div>
                  <FormField label={t("common:fields.address")} htmlFor="sale-edit-address" error={formErr.address}>
                    <Input id="sale-edit-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} aria-invalid={!!formErr.address} />
                  </FormField>
                  <FormField
                    label={t("common:fields.note")} htmlFor="sale-edit-note" error={formErr.note}
                    description={<span className={cn("tabular-nums", form.note.length > 500 && "text-destructive")}>{form.note.length}/500</span>}
                  >
                    <Textarea id="sale-edit-note" value={form.note} rows={3} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-invalid={!!formErr.note} />
                  </FormField>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>{t("common:actions.cancel")}</Button>
                    <Button type="button" size="sm" disabled={busy} onClick={saveDetails}>{t("orders:detail.saveDetails")}</Button>
                  </div>
                </Card>
              )}

              {items.length > 0 && (
                <Card className="gap-0 overflow-hidden py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common:fields.product")}</TableHead>
                        <TableHead className="text-center">{t("common:fields.qty")}</TableHead>
                        <TableHead className="text-right">{t("common:money.price")}</TableHead>
                        {hasLineDisc && <TableHead className="text-right">{t("common:money.discount")}</TableHead>}
                        <TableHead className="text-right">{t("common:money.total")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it, i) => {
                        const { price, qty, disc } = lineOf(it)
                        return (
                          <TableRow key={i}>
                            <TableCell>{(it as any).productName ?? (it as any).product_name}</TableCell>
                            <TableCell className="text-center tabular-nums">{qty}</TableCell>
                            <TableCell className="text-right tabular-nums">{formatCurrency(price)}</TableCell>
                            {hasLineDisc && <TableCell className="text-right tabular-nums">{disc > 0 ? `−${formatCurrency(disc)}` : "—"}</TableCell>}
                            <TableCell className="text-right tabular-nums">{formatCurrency(price * qty - disc)}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </Card>
              )}

              <InfoList className="ml-auto w-full max-w-xs gap-1 tabular-nums">
                {items.length > 0 && <InfoRow label={t("common:money.subtotal")} value={formatCurrency(subtotal)} />}
                {(orderDisc + lineDiscTotal > 0 || sale.couponCode) && (
                  <InfoRow label={sale.couponCode ? t("orders:detail.discountWithCoupon", { code: sale.couponCode }) : t("common:money.discount")} value={`−${formatCurrency(orderDisc + lineDiscTotal)}`} />
                )}
                {tax > 0.005 && <InfoRow label={t("common:money.tax")} value={formatCurrency(tax)} />}
                <InfoRow label={t("orders:detail.delivery")} value={formatCurrency(delivery)} />
                <Separator className="my-1" />
                <InfoRow label={t("common:money.total")} value={formatCurrency(total)} className="text-lg font-semibold [&>dt]:text-foreground" />
                <InfoRow label={t("common:money.paid")} value={formatCurrency(paid)} />
                <InfoRow label={t("common:money.due")} value={formatCurrency(pay.due)} className={cn("font-semibold", pay.due > 0 ? "[&>*]:text-destructive" : "[&>dt]:text-foreground")} />
              </InfoList>

              {payOpen && !onRecordPayment && (
                <Card className="gap-3 p-4 text-sm">
                  <SectionTitle>{t("orders:detail.recordPayment")}</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label={t("orders:detail.amountMax", { max: formatCurrency(pay.due) })} htmlFor="sale-pay-amount">
                      <Input id="sale-pay-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
                    </FormField>
                    <FormField label={t("orders:detail.method")} htmlFor="sale-pay-method">
                      <Select value={method} onValueChange={(v) => setMethod(v)}>
                        <SelectTrigger id="sale-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label={t("orders:detail.transactionIdOptional")} htmlFor="sale-pay-txn">
                      <Input id="sale-pay-txn" value={txn} onChange={(e) => setTxn(e.target.value)} />
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPayOpen(false)}>{t("common:actions.cancel")}</Button>
                    <Button type="button" size="sm" disabled={busy} onClick={() => submitPayment(pay.due)}>{t("orders:detail.savePayment")}</Button>
                  </div>
                </Card>
              )}

              {confirm && (
                <Card className="gap-3 border-destructive/40 p-4 text-sm">
                  <p className="font-semibold">{confirm === "cancel" ? t("orders:detail.confirmCancel", { invoice: sale.invoiceNo }) : t("orders:detail.confirmDelete", { invoice: sale.invoiceNo })}</p>
                  {confirm === "cancel" && (
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("orders:detail.reasonPlaceholder")} aria-label={t("orders:detail.reasonLabel")} />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(null)}>{t("orders:detail.keep")}</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={confirm === "cancel" ? cancelOrder : deleteOrder}>
                      {confirm === "cancel" ? t("orders:detail.cancelOrder") : t("orders:detail.deleteOrder")}
                    </Button>
                  </div>
                </Card>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onPrint(sale)}>
                  <Printer className="size-4" aria-hidden /> {t("orders:detail.printInvoice")}
                </Button>
                {pay.due > 0 && !cancelled && (
                  <Button type="button" variant="outline" disabled={busy}
                    onClick={() => (onRecordPayment ? onRecordPayment(sale) : (setAmount(String(pay.due)), setPayOpen((v) => !v)))}>
                    {t("orders:detail.recordPayment")}
                  </Button>
                )}
                {!editOpen && (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => openEdit(sale)}>
                    <Pencil className="size-4" aria-hidden /> {t("orders:detail.editDelivery")}
                  </Button>
                )}
                {onCreateShipment && !cancelled && sale.status !== "Delivered" && !shipment && (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => onCreateShipment(sale)}>
                    {t("orders:detail.createShipment")}
                  </Button>
                )}
                {!cancelled && sale.status !== "Delivered" && (
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm("cancel")}>
                    {t("orders:detail.cancelOrder")}
                  </Button>
                )}
                {cancelled && !(Number(sale.paidAmount) > 0) && (
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm("delete")}>
                    {t("orders:detail.deleteOrder")}
                  </Button>
                )}
                {step && (
                  <Button type="button" disabled={busy} onClick={() => advance(step)}>
                    {t(step.label)}
                  </Button>
                )}
              </div>
            </div>
          )
        })()}
        <FollowUpDialog
          order={followUpOpen ? sale : null}
          onClose={() => setFollowUpOpen(false)}
          onSaved={(next) => {
            followUps.reload()
            sellsApi.getById(next.id).then((r) => apply(r.data)).catch(() => apply(next))
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
