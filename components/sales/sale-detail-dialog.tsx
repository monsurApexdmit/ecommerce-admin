"use client"

import { paymentApi } from "@/lib/paymentApi"
import { useEffect, useState } from "react"
import { MapPin, Pencil, Printer } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { sellsApi, type SellResponse } from "@/lib/sellsApi"
import { useToast } from "@/hooks/use-toast"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"

export const SALE_STATUS_STYLE: Record<string, string> = {
  Pending: "bg-dash-warn-soft text-dash-warn-fg",
  Processing: "bg-dash-accent-soft text-dash-accent-fg",
  Packed: "bg-dash-accent-soft text-dash-accent-fg",
  Shipped: "bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300",
  Delivered: "bg-dash-success-soft text-dash-success-fg",
  Cancelled: "bg-dash-danger-soft text-dash-danger-fg",
}

export const SALE_PAY_STYLE = {
  Paid: "bg-dash-success-soft text-dash-success-fg",
  Partial: "bg-dash-warn-soft text-dash-warn-fg",
  Due: "bg-dash-danger-soft text-dash-danger-fg",
} as const

/** Paid / Partial / Due plus the amount still owed for a sale. */
export function salePayment(s: SellResponse): { label: keyof typeof SALE_PAY_STYLE; due: number } {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><p className="text-xs text-dash-muted">{label}</p><div className="font-semibold">{children}</div></div>
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
      <DialogContent className="max-h-[88vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-dash-display text-xl font-bold">Order #{sale?.invoiceNo}</DialogTitle>
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
          const sumRow = "flex justify-between py-0.5"
          return (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <Field label="Date">{new Date(sale.orderTime).toLocaleString()}</Field>
                <Field label="Customer">{sale.customerName}</Field>
                <Field label="Method">{sale.method}</Field>
                <Field label="Status">
                  <span className={cn("inline-flex rounded-full px-2.5 py-[3px] text-xs font-bold", SALE_STATUS_STYLE[status] ?? "")}>{status}</span>
                </Field>
                <Field label="Payment">
                  <span className={cn("inline-flex rounded-md px-2.5 py-[3px] text-xs font-bold", SALE_PAY_STYLE[pay.label])}>{pay.label}</span>
                </Field>
                <Field label="Channel · location">{[sale.source ? sale.source.charAt(0).toUpperCase() + sale.source.slice(1) : "", sale.locationName || ""].filter(Boolean).join(" · ") || "—"}</Field>
                {sale.couponCode && <Field label="Coupon"><span className="font-mono text-[13px]">{sale.couponCode}</span></Field>}
                {(sale.transactionId || sale.paymentTransactionId) && <Field label="Transaction ID"><span className="break-all font-mono text-[13px]">{sale.transactionId || sale.paymentTransactionId}</span></Field>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-dash-border p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dash-muted">
                    <MapPin className="size-4" aria-hidden /> Delivery address
                  </p>
                  {saleShippingLines(sale).length ? (
                    <div className="space-y-0.5 text-sm">{saleShippingLines(sale).map((l, i) => <p key={i}>{l}</p>)}</div>
                  ) : <p className="text-sm text-dash-muted">No delivery address on this order.</p>}
                </div>
                <div className="space-y-2 rounded-xl border border-dash-border p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Receiver &amp; courier</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <Field label="Receiver">{receiverName || "—"}</Field>
                    <Field label="Phone">{receiverPhone || "—"}</Field>
                    <Field label="Courier">{courier || "—"}</Field>
                    <Field label="Zone">{zone || "—"}</Field>
                    <div className="col-span-2"><Field label="Tracking"><span className="break-all font-mono text-[13px]">{tracking || "—"}</span></Field></div>
                  </div>
                </div>
              </div>

              {(sale.deliveryNote || sale.notes) && (
                <div className="rounded-xl border border-dash-border p-4 text-sm">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-dash-muted">{sale.deliveryNote ? "Delivery note" : "Notes"}</p>
                  <p className="whitespace-pre-line">{sale.deliveryNote || sale.notes}</p>
                </div>
              )}

              {editOpen && (
                <div className="space-y-3 rounded-xl border border-dash-border p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Edit delivery details &amp; note</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1"><span className="text-xs text-dash-muted">Receiver name</span>
                      <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" />
                      {formErr.name && <span className="text-xs text-dash-danger-fg">{formErr.name}</span>}</label>
                    <label className="space-y-1"><span className="text-xs text-dash-muted">Phone</span>
                      <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel"
                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" />
                      {formErr.phone && <span className="text-xs text-dash-danger-fg">{formErr.phone}</span>}</label>
                  </div>
                  <label className="block space-y-1"><span className="text-xs text-dash-muted">Address</span>
                    <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" />
                    {formErr.address && <span className="text-xs text-dash-danger-fg">{formErr.address}</span>}</label>
                  <label className="block space-y-1"><span className="text-xs text-dash-muted">Note</span>
                    <textarea value={form.note} rows={3} onChange={(e) => setForm({ ...form, note: e.target.value })}
                      className="w-full rounded-lg border border-dash-border bg-dash-card px-3 py-2 text-sm" />
                    <span className="flex justify-between text-xs">
                      <span className="text-dash-danger-fg">{formErr.note}</span>
                      <span className={form.note.length > 500 ? "text-dash-danger-fg" : "text-dash-muted"}>{form.note.length}/500</span>
                    </span></label>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditOpen(false)} className="h-9 rounded-[10px] border border-dash-border px-3 text-[13px] font-semibold">Cancel</button>
                    <button type="button" disabled={busy} onClick={saveDetails}
                      className="h-9 rounded-[10px] bg-dash-accent px-3 text-[13px] font-semibold text-white disabled:opacity-60">Save details</button>
                  </div>
                </div>
              )}

              {items.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-dash-border">
                  <table className="w-full text-sm">
                    <thead className="bg-dash-bg text-left text-xs text-dash-muted">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Product</th>
                        <th className="px-3 py-2 text-center font-semibold">Qty</th>
                        <th className="px-3 py-2 text-right font-semibold">Price</th>
                        {hasLineDisc && <th className="px-3 py-2 text-right font-semibold">Discount</th>}
                        <th className="px-3 py-2 text-right font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => {
                        const { price, qty, disc } = lineOf(it)
                        return (
                          <tr key={i} className="border-t border-dash-border-soft">
                            <td className="px-3 py-2">{(it as any).productName ?? (it as any).product_name}</td>
                            <td className="px-3 py-2 text-center tabular-nums">{qty}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(price)}</td>
                            {hasLineDisc && <td className="px-3 py-2 text-right tabular-nums">{disc > 0 ? `−${formatCurrency(disc)}` : "—"}</td>}
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrency(price * qty - disc)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="ml-auto w-full max-w-xs text-sm tabular-nums">
                {items.length > 0 && <div className={sumRow}><span className="text-dash-muted">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>}
                {(orderDisc + lineDiscTotal > 0 || sale.couponCode) && (
                  <div className={sumRow}>
                    <span className="text-dash-muted">Discount{sale.couponCode ? ` (${sale.couponCode})` : ""}</span>
                    <span>−{formatCurrency(orderDisc + lineDiscTotal)}</span>
                  </div>
                )}
                {tax > 0.005 && <div className={sumRow}><span className="text-dash-muted">Tax</span><span>{formatCurrency(tax)}</span></div>}
                <div className={sumRow}><span className="text-dash-muted">Delivery</span><span>{formatCurrency(delivery)}</span></div>
                <div className="mt-1 flex justify-between border-t border-dash-border pt-2 font-dash-display text-lg font-bold">
                  <span>Total</span><span>{formatCurrency(total)}</span>
                </div>
                <div className={sumRow}><span className="text-dash-muted">Paid</span><span>{formatCurrency(paid)}</span></div>
                <div className={cn(sumRow, "font-semibold", pay.due > 0 && "text-dash-danger-fg")}><span>Due</span><span>{formatCurrency(pay.due)}</span></div>
              </div>

              {payOpen && !onRecordPayment && (
                <div className="space-y-3 rounded-xl border border-dash-border p-4 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-dash-muted">Record payment</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1"><span className="text-xs text-dash-muted">Amount (max {formatCurrency(pay.due)})</span>
                      <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" /></label>
                    <label className="space-y-1"><span className="text-xs text-dash-muted">Method</span>
                      <select value={method} onChange={(e) => setMethod(e.target.value)}
                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm">
                        {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select></label>
                    <label className="space-y-1"><span className="text-xs text-dash-muted">Transaction ID (optional)</span>
                      <input value={txn} onChange={(e) => setTxn(e.target.value)}
                        className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" /></label>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setPayOpen(false)} className="h-9 rounded-[10px] border border-dash-border px-3 text-[13px] font-semibold">Cancel</button>
                    <button type="button" disabled={busy} onClick={() => submitPayment(pay.due)}
                      className="h-9 rounded-[10px] bg-dash-accent px-3 text-[13px] font-semibold text-white disabled:opacity-60">Save payment</button>
                  </div>
                </div>
              )}

              {confirm && (
                <div className="space-y-3 rounded-xl border border-dash-danger-fg/40 p-4 text-sm">
                  <p className="font-semibold">{confirm === "cancel" ? `Cancel order #${sale.invoiceNo}?` : `Delete order #${sale.invoiceNo}? This cannot be undone.`}</p>
                  {confirm === "cancel" && (
                    <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
                      className="h-10 w-full rounded-lg border border-dash-border bg-dash-card px-3 text-sm" />
                  )}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setConfirm(null)} className="h-9 rounded-[10px] border border-dash-border px-3 text-[13px] font-semibold">Keep</button>
                    <button type="button" disabled={busy} onClick={confirm === "cancel" ? cancelOrder : deleteOrder}
                      className="h-9 rounded-[10px] bg-dash-danger-fg px-3 text-[13px] font-semibold text-white disabled:opacity-60">
                      {confirm === "cancel" ? "Cancel order" : "Delete order"}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button type="button" onClick={() => onPrint(sale)}
                  className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                  <Printer className="size-4" aria-hidden /> Print invoice
                </button>
                {pay.due > 0 && !cancelled && (
                  <button type="button" disabled={busy}
                    onClick={() => (onRecordPayment ? onRecordPayment(sale) : (setAmount(String(pay.due)), setPayOpen((v) => !v)))}
                    className="h-10 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                    Record payment
                  </button>
                )}
                {!editOpen && (
                  <button type="button" disabled={busy} onClick={() => openEdit(sale)}
                    className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                    <Pencil className="size-4" aria-hidden /> Edit delivery &amp; note
                  </button>
                )}
                {onCreateShipment && !cancelled && sale.status !== "Delivered" && !shipment && (
                  <button type="button" disabled={busy} onClick={() => onCreateShipment(sale)}
                    className="h-10 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft">
                    Create shipment
                  </button>
                )}
                {!cancelled && sale.status !== "Delivered" && (
                  <button type="button" disabled={busy} onClick={() => setConfirm("cancel")}
                    className="h-10 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold text-dash-danger-fg hover:bg-dash-neutral-soft">
                    Cancel order
                  </button>
                )}
                {cancelled && !(Number(sale.paidAmount) > 0) && (
                  <button type="button" disabled={busy} onClick={() => setConfirm("delete")}
                    className="h-10 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold text-dash-danger-fg hover:bg-dash-neutral-soft">
                    Delete order
                  </button>
                )}
                {step && (
                  <button type="button" disabled={busy} onClick={() => advance(step)}
                    className="h-10 rounded-[10px] bg-dash-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-60">
                    {step.label}
                  </button>
                )}
              </div>
            </div>
          )
        })()}
      </DialogContent>
    </Dialog>
  )
}
