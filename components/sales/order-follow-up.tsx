"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, Clock, MessageSquare, Phone, PhoneMissed, PhoneOff, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import {
  sellsApi, type FollowUpChannel, type FollowUpOutcome, type OrderFollowUp, type SellResponse,
} from "@/lib/sellsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
import { ORDERS_NS, methodLabel, type OrdersKey, type OrdersT } from "@/components/sales/i18n"

/** `label` / `description` are translation keys (translated at render). */
export const FOLLOW_UP_OUTCOMES: { value: FollowUpOutcome; label: OrdersKey; description: OrdersKey; icon: React.ReactNode; variant: StatusVariant }[] = [
  { value: "confirmed", label: "orders:followUp.outcome.confirmed", description: "orders:followUp.outcome.confirmedDesc", icon: <CheckCircle2 className="size-4" aria-hidden />, variant: "default" },
  { value: "no_answer", label: "orders:followUp.outcome.noAnswer", description: "orders:followUp.outcome.noAnswerDesc", icon: <PhoneMissed className="size-4" aria-hidden />, variant: "secondary" },
  { value: "call_later", label: "orders:followUp.outcome.callLater", description: "orders:followUp.outcome.callLaterDesc", icon: <Clock className="size-4" aria-hidden />, variant: "secondary" },
  { value: "wrong_number", label: "orders:followUp.outcome.wrongNumber", description: "orders:followUp.outcome.wrongNumberDesc", icon: <PhoneOff className="size-4" aria-hidden />, variant: "destructive" },
  { value: "customer_cancelled", label: "orders:followUp.outcome.customerCancelled", description: "orders:followUp.outcome.customerCancelledDesc", icon: <XCircle className="size-4" aria-hidden />, variant: "destructive" },
  { value: "other", label: "orders:followUp.outcome.other", description: "orders:followUp.outcome.otherDesc", icon: <MessageSquare className="size-4" aria-hidden />, variant: "outline" },
]
const OUTCOME = Object.fromEntries(FOLLOW_UP_OUTCOMES.map((o) => [o.value, o])) as Record<FollowUpOutcome, (typeof FOLLOW_UP_OUTCOMES)[number]>
const NOTE_REQUIRED: FollowUpOutcome[] = ["wrong_number", "customer_cancelled", "other"]

const CHANNELS: { value: FollowUpChannel; label: OrdersKey }[] = [
  { value: "call", label: "orders:followUp.channel.call" },
  { value: "whatsapp", label: "orders:followUp.channel.whatsapp" },
  { value: "sms", label: "orders:followUp.channel.sms" },
  { value: "other", label: "orders:followUp.channel.other" },
]
const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label])) as Record<FollowUpChannel, OrdersKey>

export const followUpOutcomeLabel = (t: OrdersT, o?: string | null) => {
  const key = o ? OUTCOME[o as FollowUpOutcome]?.label : undefined
  return key ? t(key) : o || "—"
}

/** Pending, or confirmed and not yet handed to a courier (mirrors the backend rule). */
export function canFollowUp(o: SellResponse): boolean {
  if (o.status === "Pending") return true
  return o.status === "Processing" && o.fulfillmentStatus !== "shipped" && !o.shippedAt
}

function shortTime(t: OrdersT, lng: string, iso: string): string {
  const d = new Date(iso)
  const tag = localeTag(lng)
  const time = d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" }).toLowerCase()
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return time
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return t("orders:time.tomorrowAt", { time })
  return `${d.toLocaleDateString(tag, { month: "short", day: "numeric" })}, ${time}`
}

/** One-line table summary, e.g. "2 calls · No answer · next 3:00 pm". Null when there is nothing to show. */
export function followUpSummary(t: OrdersT, lng: string, o: SellResponse): { text: string; overdue: boolean } | null {
  const n = Number(o.followUpCount) || 0
  if (n === 0) return o.status === "Pending" ? { text: t("orders:followUp.notCalledYet"), overdue: false } : null
  const parts = [t("orders:followUp.calls", { count: n }), followUpOutcomeLabel(t, o.lastFollowUpOutcome)]
  let overdue = false
  if (o.nextFollowUpAt && canFollowUp(o)) {
    parts.push(t("orders:followUp.next", { time: shortTime(t, lng, o.nextFollowUpAt) }))
    overdue = new Date(o.nextFollowUpAt).getTime() <= Date.now()
  }
  return { text: parts.join(" · "), overdue }
}

/** `yyyy-MM-ddTHH:mm` in local time, for datetime-local inputs. */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Previous follow-ups, newest first. */
export function FollowUpHistory({ items, loading }: { items: OrderFollowUp[]; loading?: boolean }) {
  const { t, i18n } = useTranslation(ORDERS_NS)
  const tag = localeTag(i18n.language)
  if (loading) return <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
  if (items.length === 0) {
    return <EmptyState icon={Phone} title={t("orders:followUp.historyEmpty")} description={t("orders:followUp.historyEmptyHint")} bordered className="p-4 md:p-4" />
  }
  return (
    <ol className="divide-y rounded-lg border text-sm">
      {items.map((f) => (
        <li key={f.id} className="flex flex-col gap-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={f.outcome} variant={OUTCOME[f.outcome]?.variant ?? "outline"} label={followUpOutcomeLabel(t, f.outcome)} />
            <span className="text-muted-foreground">
              {CHANNEL_LABEL[f.channel] ? t(CHANNEL_LABEL[f.channel]) : f.channel} · {f.staffName || t("orders:followUp.staff")} · {new Date(f.createdAt).toLocaleString(tag)}
            </span>
          </div>
          {f.note && <p className="whitespace-pre-line">{f.note}</p>}
          {f.nextFollowUpAt && <p className="text-xs text-muted-foreground">{t("orders:followUp.nextAt", { date: new Date(f.nextFollowUpAt).toLocaleString(tag) })}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Loads an order's follow-up history; `reload` after logging a new one. */
export function useFollowUps(sellId: number | null | undefined) {
  const [items, setItems] = useState<OrderFollowUp[]>([])
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!sellId) { setItems([]); return }
    let live = true
    setLoading(true)
    sellsApi.getFollowUps(sellId)
      .then((r) => { if (live) setItems(r) })
      .catch(() => { if (live) setItems([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [sellId, tick])
  return { items, loading, reload: () => setTick((t) => t + 1) }
}

interface FollowUpDialogProps {
  order: SellResponse | null
  onClose: () => void
  /** Called with the refreshed order after a follow-up is saved. */
  onSaved?: (order: SellResponse) => void
}

/** Log a confirmation call for an order: outcome, channel, note, next call-back, plus the call history. */
export function FollowUpDialog({ order, onClose, onSaved }: FollowUpDialogProps) {
  const { t } = useTranslation(ORDERS_NS)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const history = useFollowUps(order?.id)
  const [outcome, setOutcome] = useState<FollowUpOutcome | "">("")
  const [channel, setChannel] = useState<FollowUpChannel>("call")
  const [note, setNote] = useState("")
  const [next, setNext] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setOutcome(""); setChannel("call"); setNote(""); setNext(""); setErrors({})
  }, [order?.id])

  const quick = (kind: "hour" | "tomorrow") => {
    const d = new Date()
    if (kind === "hour") d.setHours(d.getHours() + 1)
    else { d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0) }
    setNext(toLocalInput(d)); setErrors((e) => ({ ...e, next: "" }))
  }

  const save = async () => {
    if (!order) return
    const err: Record<string, string> = {}
    if (!outcome) err.outcome = t("orders:followUp.err.pickOutcome")
    if (outcome && NOTE_REQUIRED.includes(outcome) && !note.trim()) err.note = t("orders:followUp.err.noteRequired")
    if (note.length > 1000) err.note = t("orders:detail.err.noteMax", { max: 1000 })
    if (outcome === "call_later") {
      if (!next) err.next = t("orders:followUp.err.pickTime")
      else if (new Date(next).getTime() <= Date.now()) err.next = t("orders:followUp.err.futureTime")
    }
    setErrors(err)
    if (Object.keys(err).length || !outcome) return
    setSaving(true)
    try {
      const res = await sellsApi.logFollowUp(order.id, {
        outcome, channel, note: note.trim() || undefined,
        nextFollowUpAt: outcome === "call_later" && next ? new Date(next).toISOString() : undefined,
      })
      toast({
        title: outcome === "confirmed" ? t("orders:followUp.toast.orderConfirmed") : outcome === "customer_cancelled" ? t("orders:followUp.toast.orderCancelled") : t("orders:followUp.toast.saved"),
        description: `#${order.invoiceNo}`,
      })
      onSaved?.(res.order)
      onClose()
    } catch (e: any) {
      const d = e?.response?.data
      const fieldErr = d?.errors ? Object.values(d.errors).flat().join(" ") : ""
      toast({ variant: "destructive", title: t("orders:followUp.toast.saveFailed"), description: fieldErr || d?.message || e?.message })
    } finally { setSaving(false) }
  }

  const phone = order ? order.shippingPhone || order.shippingAddress?.phone || "" : ""
  const isCod = order ? String(order.method).toUpperCase() === "COD" : false

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("orders:followUp.title", { invoice: order?.invoiceNo ?? "" })}</DialogTitle>
          <DialogDescription>{t("orders:followUp.description")}</DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
              <InfoList className="grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <InfoRow layout="stacked" label={t("common:fields.customer")} value={order.shippingFullName || order.customerName} />
                <InfoRow layout="stacked" label={t("common:fields.phone")} value={phone ? <span className="tabular-nums">{phone}</span> : "—"} />
                <InfoRow layout="stacked" label={t("common:money.amount")} value={<span className="tabular-nums">{formatCurrency(Number(order.amount))}</span>} />
                <InfoRow layout="stacked" label={t("orders:detail.payment")} value={isCod ? <StatusBadge status="COD" variant="secondary" label={t("common:payment.cod")} /> : methodLabel(t, order.method)} />
              </InfoList>
              {phone && (
                <Button asChild variant="outline">
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" aria-hidden /> {t("orders:followUp.call")}</a>
                </Button>
              )}
            </div>

            <FormField label={t("orders:followUp.outcomeLabel")} required error={errors.outcome}>
              <ChoiceCardGroup
                aria-label={t("orders:followUp.outcomeLabel")}
                value={outcome}
                onValueChange={(v) => { setOutcome(v as FollowUpOutcome); setErrors({}) }}
                className="grid-cols-2 sm:grid-cols-3"
              >
                {FOLLOW_UP_OUTCOMES.map((o) => (
                  <ChoiceCard key={o.value} value={o.value} icon={o.icon} title={t(o.label)} description={t(o.description)} className="p-3" />
                ))}
              </ChoiceCardGroup>
            </FormField>

            <FormField label={t("orders:followUp.channelLabel")}>
              <SegmentedControl aria-label={t("orders:followUp.channelLabel")} value={channel} onValueChange={(v) => setChannel(v as FollowUpChannel)}
                options={CHANNELS.map((c) => ({ value: c.value, label: t(c.label) }))} />
            </FormField>

            {outcome === "call_later" && (
              <FormField label={t("orders:followUp.nextLabel")} htmlFor="fu-next" required error={errors.next}>
                <div className="flex flex-wrap items-center gap-2">
                  <Input id="fu-next" type="datetime-local" value={next} min={toLocalInput(new Date())}
                    onChange={(e) => { setNext(e.target.value); setErrors((x) => ({ ...x, next: "" })) }}
                    aria-invalid={!!errors.next} className="w-auto" />
                  <Button type="button" variant="outline" size="sm" onClick={() => quick("hour")}>{t("orders:followUp.plusHour")}</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => quick("tomorrow")}>{t("orders:followUp.tomorrow10")}</Button>
                </div>
              </FormField>
            )}

            <FormField
              label={t("common:fields.note")} htmlFor="fu-note" required={!!outcome && NOTE_REQUIRED.includes(outcome)} error={errors.note}
              description={outcome === "customer_cancelled"
                ? t("orders:followUp.cancelHint")
                : <span className={cn("tabular-nums", note.length > 1000 && "text-destructive")}>{note.length}/1000</span>}
            >
              <Textarea id="fu-note" rows={3} value={note} placeholder={t("orders:followUp.notePlaceholder")}
                onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: "" })) }} aria-invalid={!!errors.note} />
            </FormField>

            <div className="space-y-2">
              <SectionTitle>{t("orders:followUp.previous")}</SectionTitle>
              <FollowUpHistory items={history.items} loading={history.loading} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.close")}</Button>
          <Button type="button" disabled={saving || !order} variant={outcome === "customer_cancelled" ? "destructive" : "default"} onClick={save}>
            {saving ? t("common:actions.saving") : outcome === "confirmed" ? t("orders:followUp.saveConfirm") : outcome === "customer_cancelled" ? t("orders:followUp.saveCancel") : t("common:actions.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
