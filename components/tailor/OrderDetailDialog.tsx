"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { saasCompanyApi } from "@/lib/saasCompanyApi"
import {
  TAILOR_PAY_METHODS, TAILOR_STAGES, TAILOR_STAGE_LABEL, tailorMethodLabel, tailorOrdersApi,
  type TailorOrderDetail, type TailorStage,
} from "@/lib/tailorApi"
import { measurementText, printInvoice, printJobCard } from "@/lib/tailorOrderPrint"
import { cn } from "@/lib/utils"
import {
  PayBadge, StageBadge, UrgentBadge, WORK_LABEL, apiError, fmtDate, tInput, tOutlineBtn, tPrimaryBtn, todayIso, whenText,
} from "./order-ui"

interface Props {
  orderId: number | null
  /** open with the record-payment form scrolled into view */
  focusPay?: boolean
  canWrite: boolean
  onClose: () => void
  onChanged: () => void
}

const STATUS_OPTS: { id: TailorStage; label: string }[] = TAILOR_STAGES.map((s) => ({ id: s.id as TailorStage, label: s.label }))

const label = "flex flex-col gap-1.5 text-[13px] font-semibold"
const sectionTitle = "text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted"

export function OrderDetailDialog({ orderId, focusPay, canWrite, onClose, onChanged }: Props) {
  const { formatCurrency } = useCompanySettings()
  const [d, setD] = useState<TailorOrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const payRef = useRef<HTMLDivElement>(null)

  // payment form
  const [amt, setAmt] = useState("")
  const [method, setMethod] = useState("cash")
  const [date, setDate] = useState(todayIso())
  const [ref, setRef] = useState("")
  const [notes, setNotes] = useState("")
  const [payErr, setPayErr] = useState("")
  const [paying, setPaying] = useState(false)

  // status form
  const [sel, setSel] = useState<TailorStage>("new")
  const [sNote, setSNote] = useState("")
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelErr, setCancelErr] = useState("")
  const [sErr, setSErr] = useState("")
  const [moving, setMoving] = useState(false)

  const load = useCallback(async (id: number) => {
    setLoading(true)
    try {
      const o = await tailorOrdersApi.detail(id)
      setD(o)
      setSel(o.stage)
      setAmt(o.dueAmount > 0 ? String(o.dueAmount) : "")
    } catch {
      toast.error("Failed to load order")
      onClose()
    } finally {
      setLoading(false)
    }
  }, [onClose])

  useEffect(() => {
    if (orderId == null) { setD(null); return }
    setPayErr(""); setSErr(""); setSNote(""); setRef(""); setNotes(""); setMethod("cash"); setDate(todayIso()); setCancelOpen(false); setCancelReason(""); setCancelErr("")
    load(orderId)
  }, [orderId, load])

  useEffect(() => {
    saasCompanyApi.getProfile().then((r) => setBusinessName(r.data?.name ?? "")).catch(() => {})
  }, [])

  useEffect(() => {
    if (focusPay && d && payRef.current) payRef.current.scrollIntoView({ block: "center" })
  }, [focusPay, d?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const recordPay = async () => {
    if (!d) return
    const a = Number(amt)
    if (!(a > 0)) return setPayErr("Enter an amount greater than 0.")
    if (a > d.dueAmount + 0.005) return setPayErr(`Amount is more than the balance (${formatCurrency(d.dueAmount)}).`)
    if (date > todayIso()) return setPayErr("Payment date cannot be in the future.")
    setPaying(true); setPayErr("")
    try {
      await tailorOrdersApi.recordPayment(d.id, { amount: a, paymentMethod: method, paymentDate: date, reference: ref.trim(), notes: notes.trim() })
      toast.success(`Payment of ${formatCurrency(a)} recorded for ${d.orderNumber}`)
      setRef(""); setNotes("")
      await load(d.id); onChanged()
    } catch (e) {
      setPayErr(apiError(e, "Failed to record payment"))
    } finally {
      setPaying(false)
    }
  }

  const applyStatus = async () => {
    if (!d) return
    if (sel === d.stage) return setSErr("Pick a different status.")
    setMoving(true); setSErr("")
    try {
      await tailorOrdersApi.transition(d.id, sel, sNote.trim())
      toast.success(`${d.orderNumber} moved to ${TAILOR_STAGE_LABEL[sel].toLowerCase()}`)
      setSNote("")
      await load(d.id); onChanged()
    } catch (e) {
      setSErr(apiError(e, "Failed to update status"))
    } finally {
      setMoving(false)
    }
  }

  const cancelOrder = async () => {
    if (!d) return
    const reason = cancelReason.trim()
    if (!reason) return setCancelErr("Enter a reason for cancelling.")
    setMoving(true); setCancelErr("")
    try {
      await tailorOrdersApi.transition(d.id, "cancelled", `Cancelled: ${reason}`)
      toast.success(`${d.orderNumber} cancelled`)
      setCancelOpen(false); setCancelReason("")
      await load(d.id); onChanged()
    } catch (e) {
      setCancelErr(apiError(e, "Failed to cancel order"))
    } finally {
      setMoving(false)
    }
  }

  const open = !!d && d.stage !== "delivered" && d.stage !== "cancelled"
  const when = d ? whenText(d.daysLeft, d.stage) : null
  const c = d?.charges
  const stitch = c ? c.stitching || c.stitchingOrderLevel : 0

  return (
    <>
    <Dialog open={orderId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[860px]">
        {loading && !d ? (
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="sr-only">Order details</DialogTitle>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : d && c ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dash-border-soft px-6 py-4 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="font-dash-display text-xl font-bold">{d.orderNumber}</DialogTitle>
                <StageBadge stage={d.stage} />
                <PayBadge status={d.paymentStatus} />
                {d.isUrgent && <UrgentBadge />}
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={cn(tOutlineBtn, "h-9")} onClick={() => { if (!printInvoice(d, businessName, formatCurrency)) toast.error("Allow pop-ups to print.") }}><Printer className="size-4" aria-hidden /> Print invoice</button>
                <button type="button" className={cn(tOutlineBtn, "h-9")} onClick={() => { if (!printJobCard(d)) toast.error("Allow pop-ups to print.") }}>Print job card</button>
                {canWrite && open && <button type="button" className={cn(tOutlineBtn, "h-9 text-dash-danger-fg")} onClick={() => { setCancelOpen(true); setCancelErr("") }}>Cancel order</button>}
                {canWrite && open && <Link href={`/dashboard/tailor/orders/${d.id}/edit`} className={cn(tOutlineBtn, "h-9")}>Edit</Link>}
              </div>
            </div>
            <DialogDescription className="sr-only">Order details, payments and status for {d.orderNumber}</DialogDescription>

            <div className="flex flex-col gap-5 p-6 text-sm">
              <div className="grid gap-3 rounded-xl bg-dash-bg p-4 sm:grid-cols-2 lg:grid-cols-5">
                <div><div className={sectionTitle}>Customer</div><div className="font-semibold">{d.customer?.name ?? "—"}</div><div className="text-xs text-dash-muted">{d.customer?.phone}</div><div className="text-xs text-dash-muted">{d.customer?.address}</div></div>
                <div><div className={sectionTitle}>Order date</div><div className="font-semibold">{fmtDate(d.orderDate)}</div></div>
                <div><div className={sectionTitle}>Delivery</div><div className="font-semibold">{fmtDate(d.deliveryDate)}</div><div className={cn("text-xs font-semibold", when?.cls)}>{open ? when?.text : ""}</div></div>
                <div><div className={sectionTitle}>Dorji</div><div className="font-semibold">{d.dorjiNames.join(", ") || "Not assigned"}</div></div>
                <div><div className={sectionTitle}>Total / paid / due</div><div className="font-semibold tabular-nums">{formatCurrency(c.total)} · {formatCurrency(c.paid)} · {formatCurrency(c.due)}</div></div>
              </div>

              {d.notes && <div className="rounded-[10px] bg-dash-warn-soft px-3.5 py-2.5 text-[13px] text-dash-warn-fg"><strong>Order notes:</strong> {d.notes}</div>}

              <div className="flex flex-col rounded-xl border border-dash-border">
                {d.items.map((it) => {
                  const fabric = it.fabricSource === "shop" && it.fabric
                    ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}${it.fabricUnitPrice ? ` @ ${formatCurrency(it.fabricUnitPrice)}` : ""}`
                    : `Customer fabric${it.ownFabricNote ? `: ${it.ownFabricNote}` : ""}`
                  const sub = [fabric, measurementText(it.measurement) || "No measurement", ...it.styleOptions, it.notes].filter(Boolean).join(" — ")
                  return (
                    <div key={it.id} className="flex items-start justify-between gap-3 border-b border-dash-border-soft px-3.5 py-3 last:border-0">
                      <div className="min-w-0"><div className="font-semibold">{it.productType} ×{it.quantity}</div><div className="text-xs text-dash-muted">{sub}</div></div>
                      <div className="font-bold tabular-nums">{formatCurrency(it.lineTotal)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5 rounded-xl border border-dash-border p-3.5">
                  <div className={sectionTitle}>Charges</div>
                  {[["Stitching", stitch], ["Fabric", c.fabric], ...(c.urgent > 0 ? [["Urgent charge", c.urgent]] : []), ...(c.extra > 0 ? [["Extra charge", c.extra]] : []), ...(c.discount > 0 ? [["Discount", -c.discount]] : []), ["Grand total", c.total], ["Paid", c.paid], ["Due", c.due]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between"><span className="text-dash-muted">{l}</span><strong className="tabular-nums">{(v as number) < 0 ? "− " : ""}{formatCurrency(Math.abs(v as number))}</strong></div>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5 rounded-xl border border-dash-border p-3.5">
                  <div className={sectionTitle}>Dorji assignments</div>
                  {d.assignments.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-2">
                      <span>{a.dorjiName ?? "Dorji"}{a.task ? ` · ${a.task} ×${a.pieces ?? 1}` : a.adminNotes ? ` · ${a.adminNotes}` : ""}
                        <span className="block text-xs text-dash-muted">{a.expectedCompletion ? `Back by ${fmtDate(a.expectedCompletion)} · ` : ""}Charge {formatCurrency(a.dorjiCharge)}</span></span>
                      <strong className="whitespace-nowrap text-xs">{WORK_LABEL[a.workStatus] ?? a.workStatus}</strong>
                    </div>
                  ))}
                  {d.assignments.length === 0 && <span className="text-dash-muted">No dorji assigned yet. <Link href="/dashboard/tailor/assignments" className="font-semibold text-dash-accent hover:underline">Assign work</Link></span>}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 rounded-xl border border-dash-border p-3.5">
                <div className={sectionTitle}>Customer payments</div>
                {d.payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2">
                    <span>{fmtDate(p.paymentDate)} · {payLabel(p)} · {tailorMethodLabel(p.paymentMethod)}
                      <span className="block text-xs text-dash-muted">{[p.reference, payLabel(p) !== "Payment" ? "" : p.notes].filter(Boolean).join(" · ")}</span></span>
                    <strong className="tabular-nums">{formatCurrency(p.amount)}</strong>
                  </div>
                ))}
                {d.payments.length === 0 && <span className="text-dash-muted">No payments recorded.</span>}
              </div>

              {canWrite && d.dueAmount > 0 && d.stage !== "cancelled" && (
                <div ref={payRef} className="flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-bg p-4">
                  <div className={sectionTitle}>Record payment · due {formatCurrency(d.dueAmount)}</div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <label className={label}>Amount<input type="number" min={0} className={tInput} value={amt} onChange={(e) => { setAmt(e.target.value); setPayErr("") }} /></label>
                    <label className={label}>Method<select className={tInput} value={method} onChange={(e) => setMethod(e.target.value)}>{TAILOR_PAY_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
                    <label className={label}>Date<input type="date" max={todayIso()} className={tInput} value={date} onChange={(e) => setDate(e.target.value)} /></label>
                    <label className={label}>Reference<input className={tInput} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn ID (optional)" /></label>
                    <label className={label}>Notes<input className={tInput} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{payErr}</span>
                    <button type="button" disabled={paying} onClick={recordPay} className={tPrimaryBtn}>{paying ? "Recording…" : "Record payment"}</button>
                  </div>
                </div>
              )}

              {canWrite && (
                <div className="flex flex-col gap-3 rounded-xl border border-dash-border bg-dash-bg p-4">
                  <div className={sectionTitle}>Update status</div>
                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <label className={label}>New status<select className={tInput} value={sel} onChange={(e) => { setSel(e.target.value as TailorStage); setSErr("") }}>{STATUS_OPTS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></label>
                    <label className={label}>Note (optional)<input className={tInput} value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="e.g. Trial done, collar to be fixed" /></label>
                  </div>
                  {sel === "delivered" && d.dueAmount > 0 && (
                    <span className="text-xs text-dash-muted">Delivering collects the remaining {formatCurrency(d.dueAmount)} in cash and marks the order as paid.</span>
                  )}
                  {sel !== "new" && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
                    <span className="text-xs text-dash-muted">Shop fabric is taken out of stock when the order first moves past Received.</span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{sErr}</span>
                    <button type="button" disabled={moving} onClick={applyStatus} className={tPrimaryBtn}>{moving ? "Applying…" : "Apply status"}</button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2 rounded-xl border border-dash-border p-3.5">
                <div className={sectionTitle}>Status timeline</div>
                {[...d.statusLogs].reverse().map((g) => (
                  <div key={g.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-dash-accent" aria-hidden />
                    <span><strong>{g.fromStatus ? `${stageName(g.fromStatus)} → ${stageName(g.toStatus)}` : stageName(g.toStatus)}</strong>{" "}
                      <span className="text-xs text-dash-muted" title={fmtDate(g.createdAt)}>· {fmtDate(g.createdAt)} ({ago(g.createdAt)})</span>
                      {g.note && <span className="block text-xs text-dash-muted">{g.note}</span>}</span>
                  </div>
                ))}
                {d.statusLogs.length === 0 && <span className="text-dash-muted">No status changes yet.</span>}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

      <Dialog open={cancelOpen} onOpenChange={(o) => !moving && setCancelOpen(o)}>
        <DialogContent className="gap-0 border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-md">
          <div className="border-b border-dash-border-soft px-6 py-4">
            <DialogTitle className="font-dash-display text-xl font-bold">Cancel {d?.orderNumber}</DialogTitle>
            <DialogDescription className="text-[13px]">This cannot be undone from here.</DialogDescription>
          </div>
          <div className="flex flex-col gap-3 px-6 py-4 text-[13px]">
            {d && d.paidAmount > 0 && <div className="rounded-[10px] bg-dash-warn-soft px-3 py-2 text-dash-warn-fg">{formatCurrency(d.paidAmount)} already paid is not refunded automatically — refund the customer separately.</div>}
            {d && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <div className="rounded-[10px] bg-dash-neutral-soft px-3 py-2 text-dash-muted">The fabric for this order has not been cut yet, so no stock is touched.</div>
            )}
            {d && d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <div className="rounded-[10px] bg-dash-neutral-soft px-3 py-2 text-dash-muted">The fabric already taken out of stock for this order will be returned to stock.</div>
            )}
            <label className={label}>Reason<textarea rows={3} className={cn(tInput, "h-auto py-2")} value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelErr("") }} placeholder="e.g. Customer changed their mind" /></label>
            <span role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{cancelErr}</span>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-4">
            <button type="button" className={tOutlineBtn} disabled={moving} onClick={() => setCancelOpen(false)}>Keep order</button>
            <button type="button" className={tPrimaryBtn} disabled={moving} onClick={cancelOrder}>{moving ? "Cancelling…" : "Cancel order"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function stageName(raw: string): string {
  if (["pending", "measurement_taken", "assigned"].includes(raw)) return TAILOR_STAGE_LABEL.new
  return TAILOR_STAGE_LABEL[raw as TailorStage] ?? raw
}

function payLabel(p: { paymentType?: string; notes?: string }): string {
  if (p.paymentType === "advance" || (!p.paymentType && /advance/i.test(p.notes ?? ""))) return "Advance"
  if (p.paymentType === "final" || (!p.paymentType && /final/i.test(p.notes ?? ""))) return "Final payment"
  return "Payment"
}

/** "5 min ago" / "3 days ago" */
function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo} mo ago`
  return `${Math.floor(mo / 12)} yr ago`
}
