"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { ShipmentResponse, ShipmentStatus } from "@/lib/shipmentsApi"
import { cn } from "@/lib/utils"
import {
  STATUS_LABEL, STATUS_STYLE, TIMELINE_STEPS, codView, shortDate, validNextStatuses,
} from "./shipment-utils"

export interface StatusPayload { status: ShipmentStatus; location?: string; description?: string }

interface Props {
  shipment: ShipmentResponse | null
  formatCurrency: (n: number) => string
  busy: boolean
  onClose: () => void
  onPrint: (s: ShipmentResponse) => void
  /** Resolves true when the update went through */
  onUpdateStatus: (s: ShipmentResponse, p: StatusPayload) => Promise<boolean>
  onRecordCod: (s: ShipmentResponse) => void
}

const btn = "h-10 rounded-[10px] px-3.5 text-[13px] font-semibold disabled:opacity-40"
const input =
  "h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-dash-muted">{label}</p>
      <div className="font-semibold">{children}</div>
    </div>
  )
}

export function ShipmentDetailDialog({ shipment, formatCurrency, busy, onClose, onPrint, onUpdateStatus, onRecordCod }: Props) {
  const [status, setStatus] = useState<ShipmentStatus | "">("")
  const [location, setLocation] = useState("")
  const [note, setNote] = useState("")
  const [failing, setFailing] = useState(false)
  const [failNote, setFailNote] = useState("")

  const id = shipment?.id
  const cur = shipment?.status
  useEffect(() => {
    setStatus(""); setLocation(""); setNote(""); setFailing(false); setFailNote("")
  }, [id, cur])

  if (!shipment) return <Dialog open={false} onOpenChange={() => {}}><DialogContent className="hidden" /></Dialog>

  const s = shipment
  const cod = codView(s)
  const fail = s.status === "failed" || s.status === "returned"
  const nextOptions = validNextStatuses(s.status)
  const stepIdx = TIMELINE_STEPS.indexOf(s.status)
  // Failed shipments stalled after in-transit; show how far they got from history
  const reached = fail
    ? Math.max(0, ...(s.trackingHistory ?? []).map((e) => TIMELINE_STEPS.indexOf(e.status)))
    : stepIdx
  const history = [...(s.trackingHistory ?? [])].sort((a, b) => +new Date(b.eventTime) - +new Date(a.eventTime))
  const address = [s.sell?.customerAddress, s.sell?.area].filter(Boolean).join(", ")
  const canMarkFailed = nextOptions.includes("failed")
  const canCod = cod.kind === "delivered_unpaid"

  const apply = async () => {
    if (!status) return
    if (status === "failed" && !note.trim()) return
    await onUpdateStatus(s, { status, location: location.trim() || undefined, description: note.trim() || undefined })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-dash-display text-xl font-bold">{s.trackingNumber || `Shipment #${s.id}`}</DialogTitle>
          <DialogDescription>
            Order #{s.sell?.invoiceNo ?? s.sellId} ·{" "}
            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-bold", STATUS_STYLE[s.status])}>{STATUS_LABEL[s.status]}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step timeline */}
        <ol className="grid grid-cols-5 gap-1" aria-label="Shipment progress">
          {TIMELINE_STEPS.map((st, i) => {
            const done = i <= reached
            const bad = fail && i === reached
            return (
              <li key={st} className="flex flex-col items-center gap-1.5 text-center">
                <span className={cn("flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold",
                  bad ? "border-dash-danger bg-dash-danger-soft text-dash-danger-fg"
                    : done ? "border-dash-accent bg-dash-accent text-white" : "border-dash-border text-dash-muted")}>
                  {done && !bad ? <Check className="size-3.5" aria-hidden /> : bad ? "!" : i + 1}
                </span>
                <span className={cn("text-[11px] font-semibold leading-tight", done ? "text-dash-ink" : "text-dash-muted")}>{STATUS_LABEL[st].replace(" pickup", "")}</span>
              </li>
            )
          })}
        </ol>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Info label="Customer">{s.sell?.customerName ?? "—"}</Info>
          <Info label="Phone">{s.sell?.customerPhone || "—"}</Info>
          <Info label="Address">{address || "—"}</Info>
          <Info label="Courier">{s.carrier || "—"}</Info>
          <Info label="Service">{[s.shippingMethod, s.deliverySpeed && (s.deliverySpeed === "express" ? "Express" : "Regular")].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label="Rider">{s.rider || "—"}</Info>
          <Info label="COD">
            {cod.amount > 0 ? <>{formatCurrency(cod.amount)} <span className={cn("text-xs font-normal", cod.cls)}>{cod.label}</span></> : <span className={cod.cls}>{cod.label}</span>}
          </Info>
          <Info label="Delivery charge">
            <span className="tabular-nums">{formatCurrency(Number(s.shippingCost) || 0)}</span>
            <span className="text-xs font-normal text-dash-muted"> · paid by {s.deliveryPayer === "us" ? "us" : "customer"}</span>
          </Info>
          <Info label="Package">{[s.package, s.weight ? `${s.weight} kg` : null, s.dimensions].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label="Pickup → ETA">{shortDate(s.pickupDate)} → {s.status === "delivered" ? `delivered ${shortDate(s.deliveredAt)}` : shortDate(s.estimatedDelivery)}</Info>
        </div>
        {s.notes && <p className="rounded-[10px] bg-dash-bg p-3 text-sm text-dash-muted">{s.notes}</p>}

        {/* Actions */}
        <div className="space-y-3 rounded-xl border border-dash-border bg-dash-bg p-3.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onPrint(s)} className={cn(btn, "border border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>Print label</button>
            {canCod && (
              <button type="button" disabled={busy} onClick={() => onRecordCod(s)} className={cn(btn, "bg-dash-success text-white")}>Record COD payment</button>
            )}
            {canMarkFailed && !failing && (
              <button type="button" onClick={() => setFailing(true)} className={cn(btn, "border border-dash-danger-fg/40 text-dash-danger-fg hover:bg-dash-danger-soft")}>Mark failed</button>
            )}
          </div>

          {failing && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reason for failure *
                <textarea rows={2} value={failNote} onChange={(e) => setFailNote(e.target.value)} placeholder="e.g. Customer unreachable"
                  className="resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent" />
              </label>
              <div className="flex gap-2">
                <button type="button" disabled={busy || !failNote.trim()}
                  onClick={() => onUpdateStatus(s, { status: "failed", description: failNote.trim() })}
                  className={cn(btn, "bg-dash-danger text-white")}>Confirm failed</button>
                <button type="button" onClick={() => setFailing(false)} className={cn(btn, "border border-dash-border bg-dash-card")}>Cancel</button>
              </div>
            </div>
          )}

          {nextOptions.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Update status
                <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
                  <SelectTrigger className="h-[42px] w-full rounded-[10px] border-dash-border bg-dash-card font-normal"><SelectValue placeholder="Select next status" /></SelectTrigger>
                  <SelectContent>
                    {nextOptions.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Location
                <input className={input} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dhanmondi hub" />
              </label>
              <button type="button" disabled={busy || !status || (status === "failed" && !note.trim())} onClick={apply}
                className={cn(btn, "h-[42px] bg-dash-accent text-white")}>{busy ? "Saving…" : "Save"}</button>
              {(status === "failed" || status) && (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold sm:col-span-3">
                  Note{status === "failed" ? " *" : ""}
                  <input className={input} value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={status === "failed" ? "Required: why did delivery fail?" : "Optional"} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* History */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dash-muted">Tracking history</p>
          {history.length === 0 ? (
            <p className="text-sm text-dash-muted">No tracking events yet.</p>
          ) : (
            <ol className="space-y-3 border-l border-dash-border pl-4">
              {history.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-dash-accent" aria-hidden />
                  <p className="text-sm font-semibold">{e.description}</p>
                  <p className="text-xs text-dash-muted">
                    {STATUS_LABEL[e.status] ?? e.status}{e.location ? ` · ${e.location}` : ""} · {new Date(e.eventTime).toLocaleString()}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
