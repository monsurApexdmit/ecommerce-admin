"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
  TAILOR_STAGES, tailorOrdersApi,
  type TailorOrderDetail, type TailorStage,
} from "@/lib/tailorApi"
import { measurementText, printInvoice, printJobCard } from "@/lib/tailorOrderPrint"
import { cn } from "@/lib/utils"
import {
  PayBadge, StageBadge, UrgentBadge, apiError, fmtDate, todayIso, whenText,
} from "./order-ui"
import { PAY_METHOD_IDS, TAILOR_NS, garmentLabel, methodLabel, stageLabel, styleLabel, workLabel, type TailorT } from "./i18n"

interface Props {
  orderId: number | null
  /** open with the record-payment form scrolled into view */
  focusPay?: boolean
  canWrite: boolean
  onClose: () => void
  onChanged: () => void
}

const STATUS_OPTS: TailorStage[] = TAILOR_STAGES.map((s) => s.id as TailorStage)


export function OrderDetailDialog({ orderId, focusPay, canWrite, onClose, onChanged }: Props) {
  const { formatCurrency } = useCompanySettings()
  const { t, i18n } = useTranslation(TAILOR_NS)
  const lng = i18n.language
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
      toast.error(t("tailor:shared.failedLoadOrder"))
      onClose()
    } finally {
      setLoading(false)
    }
  }, [onClose, t])

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
    if (!(a > 0)) return setPayErr(t("tailor:shared.amountPositive"))
    if (a > d.dueAmount + 0.005) return setPayErr(t("tailor:shared.amountOverBalance", { amount: formatCurrency(d.dueAmount) }))
    if (date > todayIso()) return setPayErr(t("tailor:shared.paymentDateFuture"))
    setPaying(true); setPayErr("")
    try {
      await tailorOrdersApi.recordPayment(d.id, { amount: a, paymentMethod: method, paymentDate: date, reference: ref.trim(), notes: notes.trim() })
      toast.success(t("tailor:detail.paymentRecorded", { amount: formatCurrency(a), order: d.orderNumber }))
      setRef(""); setNotes("")
      await load(d.id); onChanged()
    } catch (e) {
      setPayErr(apiError(e, t("tailor:detail.failedRecord")))
    } finally {
      setPaying(false)
    }
  }

  const applyStatus = async () => {
    if (!d) return
    if (sel === d.stage) return setSErr(t("tailor:detail.pickDifferent"))
    setMoving(true); setSErr("")
    try {
      await tailorOrdersApi.transition(d.id, sel, sNote.trim())
      toast.success(t("tailor:shared.movedTo", { order: d.orderNumber, stage: stageLabel(t, sel) }))
      setSNote("")
      await load(d.id); onChanged()
    } catch (e) {
      setSErr(apiError(e, t("tailor:shared.failedUpdateStatus")))
    } finally {
      setMoving(false)
    }
  }

  const cancelOrder = async () => {
    if (!d) return
    const reason = cancelReason.trim()
    if (!reason) return setCancelErr(t("tailor:detail.enterReason"))
    setMoving(true); setCancelErr("")
    try {
      await tailorOrdersApi.transition(d.id, "cancelled", `Cancelled: ${reason}`)
      toast.success(t("tailor:detail.cancelled", { order: d.orderNumber }))
      setCancelOpen(false); setCancelReason("")
      await load(d.id); onChanged()
    } catch (e) {
      setCancelErr(apiError(e, t("tailor:detail.failedCancel")))
    } finally {
      setMoving(false)
    }
  }

  const open = !!d && d.stage !== "delivered" && d.stage !== "cancelled"
  const when = d ? whenText(t, d.daysLeft, d.stage) : null
  const c = d?.charges
  const stitch = c ? c.stitching || c.stitchingOrderLevel : 0

  return (
    <>
    <Dialog open={orderId != null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto p-0 sm:max-w-[860px]">
        {loading && !d ? (
          <div className="flex flex-col gap-3 p-6">
            <DialogTitle className="sr-only">{t("tailor:detail.orderDetails")}</DialogTitle>
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
                <Button type="button" variant="outline" onClick={() => { if (!printInvoice(d, businessName, formatCurrency, i18n.language)) toast.error(t("tailor:shared.allowPopups")) }}><Printer className="size-4" aria-hidden /> {t("tailor:shared.printInvoice")}</Button>
                <Button type="button" variant="outline" onClick={() => { if (!printJobCard(d, i18n.language)) toast.error(t("tailor:shared.allowPopups")) }}>{t("tailor:shared.printJobCard")}</Button>
                {canWrite && open && <Button type="button" variant="destructive" onClick={() => { setCancelOpen(true); setCancelErr("") }}>{t("tailor:detail.cancelOrder")}</Button>}
                {canWrite && open && <Button asChild variant="outline"><Link href={`/dashboard/tailor/orders/${d.id}/edit`}>{t("common:actions.edit")}</Link></Button>}
              </div>
            </div>
            <Separator />
            <DialogDescription className="sr-only">{t("tailor:detail.srDescription", { order: d.orderNumber })}</DialogDescription>

            <div className="flex flex-col gap-5 p-6 text-sm">
              <Card className="p-4">
                <InfoList className="gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <InfoRow layout="stacked" label={t("common:fields.customer")}>{d.customer?.name ?? "—"}<span className="block text-xs font-normal text-muted-foreground">{d.customer?.phone}</span><span className="block text-xs font-normal text-muted-foreground">{d.customer?.address}</span></InfoRow>
                  <InfoRow layout="stacked" label={t("tailor:shared.orderDate")} value={fmtDate(d.orderDate, lng)} />
                  <InfoRow layout="stacked" label={t("tailor:shared.delivery")}>{fmtDate(d.deliveryDate, lng)}<span className={cn("block text-xs", when?.cls)}>{open ? when?.text : ""}</span></InfoRow>
                  <InfoRow layout="stacked" label={t("tailor:shared.dorji")} value={d.dorjiNames.join(", ") || t("tailor:shared.notAssigned")} />
                  <InfoRow layout="stacked" label={t("tailor:detail.totalPaidDue")}><span className="tabular-nums">{formatCurrency(c.total)} · {formatCurrency(c.paid)} · {formatCurrency(c.due)}</span></InfoRow>
                </InfoList>
              </Card>

              {d.notes && <Alert><AlertDescription><p><strong>{t("tailor:detail.orderNotesLabel")}</strong> {d.notes}</p></AlertDescription></Alert>}

              <Card className="gap-0 py-0">
                <ItemGroup>
                  {d.items.map((it, idx) => {
                    const fabric = it.fabricSource === "shop" && it.fabric
                      ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}${it.fabricUnitPrice ? ` @ ${formatCurrency(it.fabricUnitPrice)}` : ""}`
                      : it.ownFabricNote ? t("tailor:shared.customerFabricNote", { note: it.ownFabricNote }) : t("tailor:shared.customerFabric")
                    const sub = [fabric, measurementText(it.measurement, i18n.language) || t("tailor:shared.noMeasurement"), ...it.styleOptions.map((o) => styleLabel(t, o)), it.notes].filter(Boolean).join(" — ")
                    return (
                      <Fragment key={it.id}>
                        {idx > 0 && <ItemSeparator />}
                        <Item size="sm" className="items-start">
                          <ItemContent className="min-w-0"><ItemTitle>{garmentLabel(t, it.productType)} ×{it.quantity}</ItemTitle><ItemDescription className="text-xs">{sub}</ItemDescription></ItemContent>
                          <ItemActions className="font-semibold tabular-nums">{formatCurrency(it.lineTotal)}</ItemActions>
                        </Item>
                      </Fragment>
                    )
                  })}
                </ItemGroup>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                <SectionCard title={t("tailor:shared.charges")}>
                  <InfoList>
                    {[[t("tailor:shared.stitching"), stitch], [t("tailor:shared.fabric"), c.fabric], ...(c.urgent > 0 ? [[t("tailor:shared.urgentCharge"), c.urgent]] : []), ...(c.extra > 0 ? [[t("tailor:shared.extraCharge"), c.extra]] : []), ...(c.discount > 0 ? [[t("common:money.discount"), -c.discount]] : []), [t("tailor:shared.grandTotal"), c.total], [t("common:money.paid"), c.paid], [t("common:money.due"), c.due]].map(([l, v]) => (
                      <InfoRow key={l as string} label={l as string}><span className="tabular-nums">{(v as number) < 0 ? "− " : ""}{formatCurrency(Math.abs(v as number))}</span></InfoRow>
                    ))}
                  </InfoList>
                </SectionCard>
                <SectionCard title={t("tailor:detail.dorjiAssignments")} contentClassName="flex flex-col gap-1.5">
                  {d.assignments.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-2">
                      <span>{a.dorjiName ?? t("tailor:shared.dorji")}{a.task ? ` · ${a.task} ×${a.pieces ?? 1}` : a.adminNotes ? ` · ${a.adminNotes}` : ""}
                        <span className="block text-xs text-muted-foreground">{a.expectedCompletion ? t("tailor:detail.backByCharge", { date: fmtDate(a.expectedCompletion, lng), amount: formatCurrency(a.dorjiCharge) }) : t("tailor:detail.chargeOnly", { amount: formatCurrency(a.dorjiCharge) })}</span></span>
                      <StatusBadge status={a.workStatus} label={workLabel(t, a.workStatus)} />
                    </div>
                  ))}
                  {d.assignments.length === 0 && <span className="text-muted-foreground">{t("tailor:detail.noDorjiYet")} <Button asChild variant="link" className="h-auto p-0"><Link href="/dashboard/tailor/assignments">{t("tailor:detail.assignWork")}</Link></Button></span>}
                </SectionCard>
              </div>

              <SectionCard title={t("tailor:detail.customerPayments")} contentClassName="flex flex-col gap-1.5">
                {d.payments.map((p) => (
                  <div key={p.id} className="flex items-start justify-between gap-2">
                    <span>{fmtDate(p.paymentDate, lng)} · {payLabel(t, p)} · {methodLabel(t, p.paymentMethod)}
                      <span className="block text-xs text-muted-foreground">{[p.reference, payKind(p) !== "payment" ? "" : p.notes].filter(Boolean).join(" · ")}</span></span>
                    <strong className="tabular-nums">{formatCurrency(p.amount)}</strong>
                  </div>
                ))}
                {d.payments.length === 0 && <span className="text-muted-foreground">{t("tailor:detail.noPayments")}</span>}
              </SectionCard>

              {canWrite && d.dueAmount > 0 && d.stage !== "cancelled" && (
                <SectionCard ref={payRef} title={t("tailor:detail.recordPaymentDue", { amount: formatCurrency(d.dueAmount) })} contentClassName="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                    <FormField label={t("common:money.amount")} htmlFor="tod-pay-amount"><Input id="tod-pay-amount" type="number" min={0} value={amt} onChange={(e) => { setAmt(e.target.value); setPayErr("") }} /></FormField>
                    <FormField label={t("common:payment.method")} htmlFor="tod-pay-method"><Select value={method} onValueChange={(v) => setMethod(v)}><SelectTrigger id="tod-pay-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAY_METHOD_IDS.map((m) => <SelectItem key={m} value={m}>{methodLabel(t, m)}</SelectItem>)}</SelectContent></Select></FormField>
                    <FormField label={t("common:fields.date")} htmlFor="tod-pay-date"><Input id="tod-pay-date" type="date" max={todayIso()} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
                    <FormField label={t("common:extra.reference")} htmlFor="tod-pay-ref"><Input id="tod-pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("tailor:shared.txnPlaceholder")} /></FormField>
                    <FormField label={t("common:fields.notes")} htmlFor="tod-pay-notes"><Input id="tod-pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-sm font-medium text-destructive">{payErr}</span>
                    <Button type="button" disabled={paying} onClick={recordPay}>{paying ? t("tailor:detail.recording") : t("tailor:shared.recordPayment")}</Button>
                  </div>
                </SectionCard>
              )}

              {canWrite && (
                <SectionCard title={t("tailor:detail.updateStatus")} contentClassName="flex flex-col gap-3">
                  <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
                    <FormField label={t("tailor:detail.newStatus")} htmlFor="tod-status"><Select value={sel} onValueChange={(v) => { setSel(v as TailorStage); setSErr("") }}><SelectTrigger id="tod-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTS.map((o) => <SelectItem key={o} value={o}>{stageLabel(t, o)}</SelectItem>)}</SelectContent></Select></FormField>
                    <FormField label={t("tailor:detail.noteOptional")} htmlFor="tod-status-note"><Input id="tod-status-note" value={sNote} onChange={(e) => setSNote(e.target.value)} placeholder={t("tailor:detail.statusNotePlaceholder")} /></FormField>
                  </div>
                  {sel === "delivered" && d.dueAmount > 0 && (
                    <span className="text-xs text-muted-foreground">{t("tailor:detail.deliverHint", { amount: formatCurrency(d.dueAmount) })}</span>
                  )}
                  {sel !== "new" && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
                    <span className="text-xs text-muted-foreground">{t("tailor:detail.fabricHint")}</span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    <span role="alert" className="text-sm font-medium text-destructive">{sErr}</span>
                    <Button type="button" disabled={moving} onClick={applyStatus}>{moving ? t("tailor:detail.applying") : t("tailor:detail.applyStatus")}</Button>
                  </div>
                </SectionCard>
              )}

              <SectionCard title={t("tailor:detail.statusTimeline")} contentClassName="flex flex-col gap-2">
                {[...d.statusLogs].reverse().map((g) => (
                  <div key={g.id} className="flex items-start gap-2.5">
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span><strong>{g.fromStatus ? t("tailor:detail.transition", { from: stageLabel(t, g.fromStatus), to: stageLabel(t, g.toStatus) }) : stageLabel(t, g.toStatus)}</strong>{" "}
                      <span className="text-xs text-muted-foreground" title={fmtDate(g.createdAt, lng)}>· {fmtDate(g.createdAt, lng)} ({ago(t, g.createdAt)})</span>
                      {g.note && <span className="block text-xs text-muted-foreground">{g.note}</span>}</span>
                  </div>
                ))}
                {d.statusLogs.length === 0 && <span className="text-muted-foreground">{t("tailor:detail.noStatusChanges")}</span>}
              </SectionCard>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>

      <Dialog open={cancelOpen} onOpenChange={(o) => !moving && setCancelOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("tailor:detail.cancelTitle", { order: d?.orderNumber ?? "" })}</DialogTitle>
            <DialogDescription>{t("tailor:detail.cannotUndo")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 text-sm">
            {d && d.paidAmount > 0 && <Alert><AlertDescription>{t("tailor:detail.paidNotRefunded", { amount: formatCurrency(d.paidAmount) })}</AlertDescription></Alert>}
            {d && !d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <Alert><AlertDescription>{t("tailor:detail.fabricNotCut")}</AlertDescription></Alert>
            )}
            {d && d.fabricDeducted && d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0) && (
              <Alert><AlertDescription>{t("tailor:detail.fabricReturned")}</AlertDescription></Alert>
            )}
            <FormField label={t("common:extra.reason")} htmlFor="tod-cancel-reason" error={cancelErr || undefined}><Textarea id="tod-cancel-reason" rows={3} value={cancelReason} onChange={(e) => { setCancelReason(e.target.value); setCancelErr("") }} placeholder={t("tailor:detail.reasonPlaceholder")} /></FormField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={moving} onClick={() => setCancelOpen(false)}>{t("tailor:detail.keepOrder")}</Button>
            <Button type="button" variant="destructive" disabled={moving} onClick={cancelOrder}>{moving ? t("tailor:detail.cancelling") : t("tailor:detail.cancelOrder")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

type PayKind = "advance" | "final" | "payment"
function payKind(p: { paymentType?: string; notes?: string }): PayKind {
  if (p.paymentType === "advance" || (!p.paymentType && /advance/i.test(p.notes ?? ""))) return "advance"
  if (p.paymentType === "final" || (!p.paymentType && /final/i.test(p.notes ?? ""))) return "final"
  return "payment"
}

function payLabel(t: TailorT, p: { paymentType?: string; notes?: string }): string {
  const k = payKind(p)
  return k === "advance" ? t("tailor:detail.advance") : k === "final" ? t("tailor:detail.finalPayment") : t("tailor:detail.payment")
}

/** "5 mins ago" / "3 days ago" */
function ago(t: TailorT, iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return t("common:ago.justNow")
  const m = Math.floor(s / 60); if (m < 60) return t("common:ago.minutes", { count: m })
  const h = Math.floor(m / 60); if (h < 24) return t("common:ago.hours", { count: h })
  const d = Math.floor(h / 24); if (d < 30) return t("common:ago.days", { count: d })
  const mo = Math.floor(d / 30); if (mo < 12) return t("tailor:detail.agoMonths", { count: mo })
  return t("tailor:detail.agoYears", { count: Math.floor(mo / 12) })
}
