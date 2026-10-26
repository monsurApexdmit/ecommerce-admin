"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionCard } from "@/components/common/SectionCard"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { saasCompanyApi } from "@/lib/saasCompanyApi"
import {
  TAILOR_PAY_METHODS, TAILOR_STAGES, TAILOR_STAGE_LABEL, tailorMethodLabel, tailorOrdersApi,
  type TailorOrderDetail, type TailorStage,
} from "@/lib/tailorApi"
import { measurementText, printInvoice, printJobCard } from "@/lib/tailorOrderPrint"
import { cn } from "@/lib/utils"
import {
  PayBadge, StageBadge, UrgentBadge, WORK_LABEL, apiError, fmtDate, todayIso, whenText,
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
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-[860px]">
        {loading && !d ? (
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="sr-only">Order details</DialogTitle>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : d && c ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-xl">{d.orderNumber}</DialogTitle>
                <StageBadge stage={d.stage} />
                <PayBadge status={d.paymentStatus} />
                {d.isUrgent && <UrgentBadge />}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => { if (!printInvoice(d, businessName, formatCurrency)) toast.error("Allow pop-ups to print.") }}><Printer className="size-4" aria-hidden /> Print invoice</Button>
                <Button type="button" variant="outline" onClick={() => { if (!printJobCard(d)) toast.error("Allow pop-ups to print.") }}>Print job card</Button>
                {canWrite && open && <Button type="button" variant="destructive" onClick={() => { setCancelOpen(true); setCancelErr("") }}>Cancel order</Button>}
                {canWrite && open && <Button asChild variant="outline"><Link href={`/dashboard/tailor/orders/${d.id}/edit`}>Edit</Link></Button>}
              </div>
            </div>
            <Separator />
            <DialogDescription className="sr-only">Order details, payments and status for {d.orderNumber}</DialogDescription>

            <div className="flex flex-col gap-5 p-6 text-sm">
              <Card className="p-4">
                <InfoList className="gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <InfoRow layout="stacked" label="Customer">{d.customer?.name ?? "—"}<span className="block text-xs font-normal text-muted-foreground">{d.customer?.phone}</span><span className="block text-xs font-normal text-muted-foreground">{d.customer?.address}</span></InfoRow>
                  <InfoRow layout="stacked" label="Order date" value={fmtDate(d.orderDate)} />
                  <InfoRow layout="stacked" label="Delivery">{fmtDate(d.deliveryDate)}<span className={cn("block text-xs", when?.cls)}>{open ? when?.text : ""}</span></InfoRow>
                  <InfoRow layout="stacked" label="Dorji" value={d.dorjiNames.join(", ") || "Not assigned"} />
                  <InfoRow layout="stacked" label="Total / paid / due"><span className="tabular-nums">{formatCurrency(c.total)} · {formatCurrency(c.paid)} · {formatCurrency(c.due)}</span></InfoRow>
                </InfoList>
              </Card>

              {d.notes && <Alert><AlertDescription><p><strong>Order notes:</strong> {d.notes}</p></AlertDescription></Alert>}

              <Card className="gap-0 py-0">
                <ItemGroup>
                  {d.items.map((it, idx) => {
                    const fabric = it.fabricSource === "shop" && it.fabric
                      ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}${it.fabricUnitPrice ? ` @ ${formatCurrency(it.fabricUnitPrice)}` : ""}`
                      : `Customer fabric${it.ownFabricNote ? `: ${it.ownFabricNote}` : ""}`
                    const sub = [fabric, measurementText(it.measurement) || "No measurement", ...it.styleOptions, it.notes].filter(Boolean).join(" — ")
                    return (
                      <Fragment key={it.id}>
                        {idx > 0 && <ItemSeparator />}
                        <Item size="sm" className="items-start">
                          <ItemContent className="min-w-0"><ItemTitle>{it.productType} ×{it.quantity}</ItemTitle><ItemDescription className="text-xs">{sub}</ItemDescription></ItemContent>
                          <ItemActions className="font-semibold tabular-nums">{formatCurrency(it.lineTotal)}</ItemActions>
                        </Item>
                      </Fragment>
                    )
                  })}
                </ItemGroup>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title="Charges">
                  <InfoList>
                    {[["Stitching", stitch], ["Fabric", c.fabric], ...(c.urgent > 0 ? [["Urgent charge", c.urgent]] : []), ...(c.extra > 0 ? [["Extra charge", c.extra]] : []), ...(c.discount > 0 ? [["Discount", -c.discount]] : []), ["Grand total", c.total], ["Paid", c.paid], ["Due", c.due]].map(([l, v]) => (
                      <InfoRow key={l as string} label={l as string}><span className="tabular-nums">{(v as number) < 0 ? "− " : ""}{formatCurrency(Math.abs(v as number))}</span></InfoRow>
                    ))}
                  </InfoList>
                </SectionCard>
                <SectionCard title="Dorji assignments" contentClassName="flex flex-col gap-1.5">
                  {d.assignments.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-2">
                      <span>{a.dorjiName ?? "Dorji"}{a.task ? ` · ${a.task} ×${a.pieces ?? 1}` : a.adminNotes ? ` · ${a.adminNotes}` : ""}
                        <span className="block text-xs text-muted-foreground">{a.expectedCompletion ? `Back by ${fmtDate(a.expectedCompletion)} · ` : ""}Charge {formatCurrency(a.dorjiCharge)}</span></span>
                      <StatusBadge status={a.workStatus} label={WORK_LABEL[a.workStatus] ?? a.workStatus} />
                    </div>
                  ))}
                  {d.assignments.length === 0 && <span className="text-muted-foreground">No dorji assigned yet. <Button asChild variant="link" className="h-auto p-0"><Link href="/dashboard/tailor/assignments">Assign work</Link></Button></span>}
                </SectionCard>
              </div>

              <SectionCard title="Customer payments" contentClassName="flex flex-col gap-1.5">
                {d.payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2">
                    <span>{fmtDate(p.paymentDate)} · {payLabel(p)} · {tailorMethodLabel(p.paymentMethod)}
                      <span className="block text-xs text-muted-foreground">{[p.reference, payLabel(p) !== "Payment" ? "" : p.notes].filter(Boolean).join(" · ")}</span></span>
                    <strong className="tabular-nums">{formatCurrency(p.amount)}</strong>
                  </div>
                ))}
                {d.payments.length === 0 && <span className="text-muted-foreground">No payments recorded.</span>}
              </SectionCard>

              {canWrite && d.dueAmount > 0 && d.stage !== "cancelled" && (
                <SectionCard ref={payRef} title={`Record payment · due ${formatCurrency(d.dueAmount)}`} contentClassName="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <FormField label="Amount" htmlFor="tod-pay-amount"><Input id="tod-pay-amount" type="number" min={0} value={amt} onChange={(e) => { setAmt(e.target.value); setPayErr("") }} /></FormField>
                    <FormField label="Method" htmlFor="tod-pay-method"><Select value={method} onValueChange={(v) => setMethod(v)}><SelectTrigger id="tod-pay-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{TAILOR_PAY_METHODS.map((m) => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}</SelectContent></Select></FormField>
                    <FormField label="Date" htmlFor="tod-pay-date"><Input id="tod-pay-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
                    <FormField label="Reference" htmlFor="tod-pay-ref"><Input id="tod-pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn ID (optional)" /></FormField>
                    <FormField label="Notes" htmlFor="tod-pay-notes"><Input id="tod-pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></FormField>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-sm font-medium text-destructive">{payErr}</span>
                    <Button type="button" disabled={paying} onClick={recordPay}>{paying ? "Recording…" : "Record payment"}</Button>
                  </div>
                </SectionCard>
              )}

              {canWrite && (
                <SectionCard title="Update status" contentClassName="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <FormField label="New status" htmlFor="tod-status"><Select value={sel} onValueChange={(v) => { setSel(v as TailorStage); setSErr("") }}><SelectTrigger id="tod-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTS.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent></Select></FormField>
                    <FormField label="Note (optional)" htmlFor="tod-status-note"><Input id="tod-status-note" value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder="e.g. Trial done, collar to be fixed" /></FormField>
                  </div>
                  {sel === "delivered" && d.dueAmount > 0 && (
                    <span className="text-xs text-muted-foreground">Delivering collects the remaining {formatCurrency(d.dueAmount)} in cash and marks the order as paid.</span>
                  )}
                  {sel !== "new" && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
                    <span className="text-xs text-muted-foreground">Shop fabric is taken out of stock when the order first moves past Received.</span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-sm font-medium text-destructive">{sErr}</span>
                    <Button type="button" disabled={moving} onClick={applyStatus}>{moving ? "Applying…" : "Apply status"}</Button>
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Status timeline" contentClassName="flex flex-col gap-2">
                {[...d.statusLogs].reverse().map((g) => (
                  <div key={g.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span><strong>{g.fromStatus ? `${stageName(g.fromStatus)} → ${stageName(g.toStatus)}` : stageName(g.toStatus)}</strong>{" "}
                      <span className="text-xs text-muted-foreground" title={fmtDate(g.createdAt)}>· {fmtDate(g.createdAt)} ({ago(g.createdAt)})</span>
                      {g.note && <span className="block text-xs text-muted-foreground">{g.note}</span>}</span>
                  </div>
                ))}
                {d.statusLogs.length === 0 && <span className="text-muted-foreground">No status changes yet.</span>}
              </SectionCard>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

      <Dialog open={cancelOpen} onOpenChange={(o) => !moving && setCancelOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {d?.orderNumber}</DialogTitle>
            <DialogDescription>This cannot be undone from here.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            {d && d.paidAmount > 0 && <Alert><AlertDescription>{formatCurrency(d.paidAmount)} already paid is not refunded automatically — refund the customer separately.</AlertDescription></Alert>}
            {d && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <Alert><AlertDescription>The fabric for this order has not been cut yet, so no stock is touched.</AlertDescription></Alert>
            )}
            {d && d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <Alert><AlertDescription>The fabric already taken out of stock for this order will be returned to stock.</AlertDescription></Alert>
            )}
            <FormField label="Reason" htmlFor="tod-cancel-reason" error={cancelErr || undefined}><Textarea id="tod-cancel-reason" rows={3} value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelErr("") }} placeholder="e.g. Customer changed their mind" /></FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={moving} onClick={() => setCancelOpen(false)}>Keep order</Button>
            <Button type="button" variant="destructive" disabled={moving} onClick={cancelOrder}>{moving ? "Cancelling…" : "Cancel order"}</Button>
          </DialogFooter>
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
