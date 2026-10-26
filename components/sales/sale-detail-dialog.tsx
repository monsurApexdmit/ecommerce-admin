"use client"

import { paymentApi } from "@/lib/paymentApi"
import { useEffect, useState } from "react"
import { MapPin, Pencil, Printer } from "lucide-react"
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
import { useToast } from "@/hooks/use-toast"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"

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

/** Next step in Confirm -> Packed -> Shipped -> Delivered, or null when there is none to do from here. */
function nextStep(s: SellResponse): { label: string; run: () => Promise<{ data: SellResponse }> } | null {
  const st = saleDisplayStatus(s)
  if (st === "Pending") return { label: "Confirm", run: () => sellsApi.updateStatus(s.id, "Processing") }
  if (st === "Processing") return { label: "Packed", run: () => sellsApi.updateFulfillment(s.id, "packed") }
  if (st === "Packed") return { label: "Shipped", run: () => sellsApi.updateFulfillment(s.id, "shipped") }
  if (st === "Shipped") return { label: "Delivered", run: () => sellsApi.updateStatus(s.id, "Delivered") }
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
    if (!form.name.trim()) err.name = "Receiver name is required."
    if (!form.phone.trim()) err.phone = "Phone is required."
    else if (!PHONE_RE.test(form.phone.trim())) err.phone = "Enter a valid phone number."
    if (!form.address.trim()) err.address = "Address is required."
    if (form.note.length > 500) err.note = "Note must be 500 characters or fewer."
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
      toast({ title: "Delivery details updated" })
    } catch (e: any) {
      toast({ title: "Could not update details", description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const cancelOrder = async () => {
    if (!sale) return
    setBusy(true)
    try {
      const res = await sellsApi.updateStatus(sale.id, "Cancelled", reason.trim() || undefined)
      apply(res.data); setConfirm(null); setReason("")
      toast({ title: "Order cancelled" })
    } catch (e: any) {
      toast({ title: "Could not cancel order", description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const deleteOrder = async () => {
    if (!sale) return
    setBusy(true)
    try {
      await sellsApi.delete(sale.id)
      toast({ title: "Order deleted" })
      onDeleted?.(sale); onChanged?.(sale); onClose()
    } catch (e: any) {
      toast({ title: "Could not delete order", description: e?.response?.data?.message || e?.message, variant: "destructive" })
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
      toast({ title: "Order updated" })
    } catch (e: any) {
      toast({ title: "Could not update status", description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  const submitPayment = async (due: number) => {
    if (!sale) return
    const amt = Number(amount)
    if (amt > due + 0.005) {
      toast({ title: "Invalid amount", description: `Amount exceeds the due (${formatCurrency(due)}).`, variant: "destructive" })
      return
    }
    if (!(amt > 0)) {
      toast({ title: "Invalid amount", description: "Enter an amount greater than 0.", variant: "destructive" })
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
      toast({ title: "Payment recorded" })
    } catch (e: any) {
      toast({ title: "Could not record payment", description: e?.response?.data?.message || e?.message, variant: "destructive" })
    } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!saleProp} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order #{sale?.invoiceNo}</DialogTitle>
          <DialogDescription className="sr-only">Order details</DialogDescription>
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
          return (
            <div className="space-y-5">
              <InfoList className="grid-cols-2 gap-4 sm:grid-cols-3">
                <InfoRow layout="stacked" label="Date" value={new Date(sale.orderTime).toLocaleString()} />
                <InfoRow layout="stacked" label="Customer" value={sale.customerName} />
                <InfoRow layout="stacked" label="Method" value={sale.method} />
                <InfoRow layout="stacked" label="Status" value={<StatusBadge status={status} />} />
                <InfoRow layout="stacked" label="Payment" value={<StatusBadge status={pay.label} variant={SALE_PAY_VARIANT[pay.label]} />} />
                <InfoRow layout="stacked" label="Channel · location" value={[sale.source ? sale.source.charAt(0).toUpperCase() + sale.source.slice(1) : "", sale.locationName || ""].filter(Boolean).join(" · ") || "—"} />
                {sale.couponCode && <InfoRow layout="stacked" label="Coupon" value={<span className="font-mono text-[13px]">{sale.couponCode}</span>} />}
                {(sale.transactionId || sale.paymentTransactionId) && <InfoRow layout="stacked" label="Transaction ID" value={<span className="break-all font-mono text-[13px]">{sale.transactionId || sale.paymentTransactionId}</span>} />}
              </InfoList>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="gap-2 p-4">
                  <SectionTitle className="flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden /> Delivery address
                  </SectionTitle>
                  {saleShippingLines(sale).length ? (
                    <div className="space-y-0.5 text-sm">{saleShippingLines(sale).map((l, i) => <p key={i}>{l}</p>)}</div>
                  ) : <p className="text-sm text-muted-foreground">No delivery address on this order.</p>}
                </Card>
                <Card className="gap-2 p-4 text-sm">
                  <SectionTitle>Receiver &amp; courier</SectionTitle>
                  <InfoList className="grid-cols-2 gap-x-3 gap-y-2">
                    <InfoRow layout="stacked" label="Receiver" value={receiverName || "—"} />
                    <InfoRow layout="stacked" label="Phone" value={receiverPhone || "—"} />
                    <InfoRow layout="stacked" label="Courier" value={courier || "—"} />
                    <InfoRow layout="stacked" label="Zone" value={zone || "—"} />
                    <InfoRow layout="stacked" className="col-span-2" label="Tracking" value={<span className="break-all font-mono text-[13px]">{tracking || "—"}</span>} />
                  </InfoList>
                </Card>
              </div>

              {(sale.deliveryNote || sale.notes) && (
                <Card className="gap-1 p-4 text-sm">
                  <SectionTitle>{sale.deliveryNote ? "Delivery note" : "Notes"}</SectionTitle>
                  <p className="whitespace-pre-line">{sale.deliveryNote || sale.notes}</p>
                </Card>
              )}

              {editOpen && (
                <Card className="gap-3 p-4 text-sm">
                  <SectionTitle>Edit delivery details &amp; note</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Receiver name" htmlFor="sale-edit-name" error={formErr.name}>
                      <Input id="sale-edit-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!formErr.name} />
                    </FormField>
                    <FormField label="Phone" htmlFor="sale-edit-phone" error={formErr.phone}>
                      <Input id="sale-edit-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" aria-invalid={!!formErr.phone} />
                    </FormField>
                  </div>
                  <FormField label="Address" htmlFor="sale-edit-address" error={formErr.address}>
                    <Input id="sale-edit-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} aria-invalid={!!formErr.address} />
                  </FormField>
                  <FormField
                    label="Note" htmlFor="sale-edit-note" error={formErr.note}
                    description={<span className={cn("tabular-nums", form.note.length > 500 && "text-destructive")}>{form.note.length}/500</span>}
                  >
                    <Textarea id="sale-edit-note" value={form.note} rows={3} onChange={(e) => setForm({ ...form, note: e.target.value })} aria-invalid={!!formErr.note} />
                  </FormField>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button type="button" size="sm" disabled={busy} onClick={saveDetails}>Save details</Button>
                  </div>
                </Card>
              )}

              {items.length > 0 && (
                <Card className="gap-0 overflow-hidden py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        {hasLineDisc && <TableHead className="text-right">Discount</TableHead>}
                        <TableHead className="text-right">Total</TableHead>
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
                {items.length > 0 && <InfoRow label="Subtotal" value={formatCurrency(subtotal)} />}
                {(orderDisc + lineDiscTotal > 0 || sale.couponCode) && (
                  <InfoRow label={`Discount${sale.couponCode ? ` (${sale.couponCode})` : ""}`} value={`−${formatCurrency(orderDisc + lineDiscTotal)}`} />
                )}
                {tax > 0.005 && <InfoRow label="Tax" value={formatCurrency(tax)} />}
                <InfoRow label="Delivery" value={formatCurrency(delivery)} />
                <Separator className="my-1" />
                <InfoRow label="Total" value={formatCurrency(total)} className="text-lg font-semibold [&>dt]:text-foreground" />
                <InfoRow label="Paid" value={formatCurrency(paid)} />
                <InfoRow label="Due" value={formatCurrency(pay.due)} className={cn("font-semibold", pay.due > 0 ? "[&>*]:text-destructive" : "[&>dt]:text-foreground")} />
              </InfoList>

              {payOpen && !onRecordPayment && (
                <Card className="gap-3 p-4 text-sm">
                  <SectionTitle>Record payment</SectionTitle>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label={`Amount (max ${formatCurrency(pay.due)})`} htmlFor="sale-pay-amount">
                      <Input id="sale-pay-amount" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular-nums" />
                    </FormField>
                    <FormField label="Method" htmlFor="sale-pay-method">
                      <Select value={method} onValueChange={(v) => setMethod(v)}>
                        <SelectTrigger id="sale-pay-method" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormField>
                    <FormField label="Transaction ID (optional)" htmlFor="sale-pay-txn">
                      <Input id="sale-pay-txn" value={txn} onChange={(e) => setTxn(e.target.value)} />
                    </FormField>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPayOpen(false)}>Cancel</Button>
                    <Button type="button" size="sm" disabled={busy} onClick={() => submitPayment(pay.due)}>Save payment</Button>
                  </div>
                </Card>
              )}

              {confirm && (
                <Card className="gap-3 border-destructive/40 p-4 text-sm">
                  <p className="font-semibold">{confirm === "cancel" ? `Cancel order #${sale.invoiceNo}?` : `Delete order #${sale.invoiceNo}? This cannot be undone.`}</p>
                  {confirm === "cancel" && (
                    <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" aria-label="Cancellation reason" />
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => setConfirm(null)}>Keep</Button>
                    <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={confirm === "cancel" ? cancelOrder : deleteOrder}>
                      {confirm === "cancel" ? "Cancel order" : "Delete order"}
                    </Button>
                  </div>
                </Card>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => onPrint(sale)}>
                  <Printer className="size-4" aria-hidden /> Print invoice
                </Button>
                {pay.due > 0 && !cancelled && (
                  <Button type="button" variant="outline" disabled={busy}
                    onClick={() => (onRecordPayment ? onRecordPayment(sale) : (setAmount(String(pay.due)), setPayOpen((v) => !v)))}>
                    Record payment
                  </Button>
                )}
                {!editOpen && (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => openEdit(sale)}>
                    <Pencil className="size-4" aria-hidden /> Edit delivery &amp; note
                  </Button>
                )}
                {onCreateShipment && !cancelled && sale.status !== "Delivered" && !shipment && (
                  <Button type="button" variant="outline" disabled={busy} onClick={() => onCreateShipment(sale)}>
                    Create shipment
                  </Button>
                )}
                {!cancelled && sale.status !== "Delivered" && (
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm("cancel")}>
                    Cancel order
                  </Button>
                )}
                {cancelled && !(Number(sale.paidAmount) > 0) && (
                  <Button type="button" variant="destructive" disabled={busy} onClick={() => setConfirm("delete")}>
                    Delete order
                  </Button>
                )}
                {step && (
                  <Button type="button" disabled={busy} onClick={() => advance(step)}>
                    {step.label}
                  </Button>
                )}
              </div>
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}
