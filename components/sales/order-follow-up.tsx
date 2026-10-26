"use client"

import { useEffect, useState } from "react"
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

export const FOLLOW_UP_OUTCOMES: { value: FollowUpOutcome; label: string; description: string; icon: React.ReactNode; variant: StatusVariant }[] = [
  { value: "confirmed", label: "Confirmed", description: "Customer wants the order", icon: <CheckCircle2 className="size-4" aria-hidden />, variant: "default" },
  { value: "no_answer", label: "No answer", description: "Didn't pick up or busy", icon: <PhoneMissed className="size-4" aria-hidden />, variant: "secondary" },
  { value: "call_later", label: "Call later", description: "Asked for a call back", icon: <Clock className="size-4" aria-hidden />, variant: "secondary" },
  { value: "wrong_number", label: "Wrong number", description: "Number is wrong or off", icon: <PhoneOff className="size-4" aria-hidden />, variant: "destructive" },
  { value: "customer_cancelled", label: "Customer cancelled", description: "Cancels the order", icon: <XCircle className="size-4" aria-hidden />, variant: "destructive" },
  { value: "other", label: "Other", description: "Anything else (add a note)", icon: <MessageSquare className="size-4" aria-hidden />, variant: "outline" },
]
const OUTCOME = Object.fromEntries(FOLLOW_UP_OUTCOMES.map((o) => [o.value, o])) as Record<FollowUpOutcome, (typeof FOLLOW_UP_OUTCOMES)[number]>
const NOTE_REQUIRED: FollowUpOutcome[] = ["wrong_number", "customer_cancelled", "other"]

const CHANNELS: { value: FollowUpChannel; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "other", label: "Other" },
]
const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label])) as Record<FollowUpChannel, string>

export const followUpOutcomeLabel = (o?: string | null) => (o && OUTCOME[o as FollowUpOutcome]?.label) || "—"

/** Pending, or confirmed and not yet handed to a courier (mirrors the backend rule). */
export function canFollowUp(o: SellResponse): boolean {
  if (o.status === "Pending") return true
  return o.status === "Processing" && o.fulfillmentStatus !== "shipped" && !o.shippedAt
}

function shortTime(iso: string): string {
  const d = new Date(iso)
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return time
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}

/** One-line table summary, e.g. "2 calls · No answer · next 3:00 pm". Null when there is nothing to show. */
export function followUpSummary(o: SellResponse): { text: string; overdue: boolean } | null {
  const n = Number(o.followUpCount) || 0
  if (n === 0) return o.status === "Pending" ? { text: "Not called yet", overdue: false } : null
  const parts = [`${n} call${n === 1 ? "" : "s"}`, followUpOutcomeLabel(o.lastFollowUpOutcome)]
  let overdue = false
  if (o.nextFollowUpAt && canFollowUp(o)) {
    parts.push(`next ${shortTime(o.nextFollowUpAt)}`)
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
  if (loading) return <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div>
  if (items.length === 0) {
    return <EmptyState icon={Phone} title="No follow-ups yet" description="Calls you log appear here." bordered className="p-4 md:p-4" />
  }
  return (
    <ol className="divide-y rounded-lg border text-sm">
      {items.map((f) => (
        <li key={f.id} className="flex flex-col gap-1 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={f.outcome} variant={OUTCOME[f.outcome]?.variant ?? "outline"} label={followUpOutcomeLabel(f.outcome)} />
            <span className="text-muted-foreground">
              {CHANNEL_LABEL[f.channel] ?? f.channel} · {f.staffName || "Staff"} · {new Date(f.createdAt).toLocaleString()}
            </span>
          </div>
          {f.note && <p className="whitespace-pre-line">{f.note}</p>}
          {f.nextFollowUpAt && <p className="text-xs text-muted-foreground">Next follow-up: {new Date(f.nextFollowUpAt).toLocaleString()}</p>}
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
    if (!outcome) err.outcome = "Pick what happened."
    if (outcome && NOTE_REQUIRED.includes(outcome) && !note.trim()) err.note = "Add a note for this outcome."
    if (note.length > 1000) err.note = "Note must be 1000 characters or fewer."
    if (outcome === "call_later") {
      if (!next) err.next = "Pick when to call back."
      else if (new Date(next).getTime() <= Date.now()) err.next = "The next follow-up must be in the future."
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
        title: outcome === "confirmed" ? "Order confirmed" : outcome === "customer_cancelled" ? "Order cancelled" : "Follow-up saved",
        description: `#${order.invoiceNo}`,
      })
      onSaved?.(res.order)
      onClose()
    } catch (e: any) {
      const d = e?.response?.data
      const fieldErr = d?.errors ? Object.values(d.errors).flat().join(" ") : ""
      toast({ variant: "destructive", title: "Could not save follow-up", description: fieldErr || d?.message || e?.message })
    } finally { setSaving(false) }
  }

  const phone = order ? order.shippingPhone || order.shippingAddress?.phone || "" : ""
  const isCod = order ? String(order.method).toUpperCase() === "COD" : false

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Follow up #{order?.invoiceNo}</DialogTitle>
          <DialogDescription>Call the customer to confirm the order, then log what happened.</DialogDescription>
        </DialogHeader>
        {order && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4">
              <InfoList className="grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                <InfoRow layout="stacked" label="Customer" value={order.shippingFullName || order.customerName} />
                <InfoRow layout="stacked" label="Phone" value={phone ? <span className="tabular-nums">{phone}</span> : "—"} />
                <InfoRow layout="stacked" label="Amount" value={<span className="tabular-nums">{formatCurrency(Number(order.amount))}</span>} />
                <InfoRow layout="stacked" label="Payment" value={isCod ? <StatusBadge status="COD" variant="secondary" label="Cash on delivery" /> : order.method} />
              </InfoList>
              {phone && (
                <Button asChild variant="outline">
                  <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}><Phone className="size-4" aria-hidden /> Call</a>
                </Button>
              )}
            </div>

            <FormField label="Outcome" required error={errors.outcome}>
              <ChoiceCardGroup
                aria-label="Outcome"
                value={outcome}
                onValueChange={(v) => { setOutcome(v as FollowUpOutcome); setErrors({}) }}
                className="grid-cols-2 sm:grid-cols-3"
              >
                {FOLLOW_UP_OUTCOMES.map((o) => (
                  <ChoiceCard key={o.value} value={o.value} icon={o.icon} title={o.label} description={o.description} className="p-3" />
                ))}
              </ChoiceCardGroup>
            </FormField>

            <FormField label="Channel">
              <SegmentedControl aria-label="Channel" value={channel} onValueChange={(v) => setChannel(v as FollowUpChannel)} options={CHANNELS} />
            </FormField>

            {outcome === "call_later" && (
              <FormField label="Next follow-up" htmlFor="fu-next" required error={errors.next}>
                <div className="flex flex-wrap items-center gap-2">
                  <Input id="fu-next" type="datetime-local" value={next} min={toLocalInput(new Date())}
                    onChange={(e) => { setNext(e.target.value); setErrors((x) => ({ ...x, next: "" })) }}
                    aria-invalid={!!errors.next} className="w-auto" />
                  <Button type="button" variant="outline" size="sm" onClick={() => quick("hour")}>+1 hour</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => quick("tomorrow")}>Tomorrow 10am</Button>
                </div>
              </FormField>
            )}

            <FormField
              label="Note" htmlFor="fu-note" required={!!outcome && NOTE_REQUIRED.includes(outcome)} error={errors.note}
              description={outcome === "customer_cancelled"
                ? "The order will be cancelled and its stock returned."
                : <span className={cn("tabular-nums", note.length > 1000 && "text-destructive")}>{note.length}/1000</span>}
            >
              <Textarea id="fu-note" rows={3} value={note} placeholder="What did the customer say?"
                onChange={(e) => { setNote(e.target.value); setErrors((x) => ({ ...x, note: "" })) }} aria-invalid={!!errors.note} />
            </FormField>

            <div className="space-y-2">
              <SectionTitle>Previous follow-ups</SectionTitle>
              <FollowUpHistory items={history.items} loading={history.loading} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          <Button type="button" disabled={saving || !order} variant={outcome === "customer_cancelled" ? "destructive" : "default"} onClick={save}>
            {saving ? "Saving…" : outcome === "confirmed" ? "Save & confirm order" : outcome === "customer_cancelled" ? "Save & cancel order" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
