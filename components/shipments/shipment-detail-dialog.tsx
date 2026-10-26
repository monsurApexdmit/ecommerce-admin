"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import type { ShipmentResponse, ShipmentStatus } from "@/lib/shipmentsApi"
import { cn } from "@/lib/utils"
import {
  STATUS_LABEL, TIMELINE_STEPS, codView, shortDate, validNextStatuses,
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

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <InfoRow layout="stacked" label={label} className="min-w-0">{children}</InfoRow>
)

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s.trackingNumber || `Shipment #${s.id}`}</DialogTitle>
          <DialogDescription>
            Order #{s.sell?.invoiceNo ?? s.sellId} ·{" "}
            <StatusBadge status={s.status} label={STATUS_LABEL[s.status]} />
          </DialogDescription>
        </DialogHeader>

        {/* Step timeline */}
        <ol className="grid grid-cols-5 gap-1" aria-label="Shipment progress">
          {TIMELINE_STEPS.map((st, i) => {
            const done = i <= reached
            const bad = fail && i === reached
            return (
              <li key={st} className="flex flex-col items-center gap-1.5 text-center">
                <Badge variant={bad ? "destructive" : done ? "default" : "outline"} className="size-7 justify-center rounded-full p-0">
                  {done && !bad ? <Check className="size-3.5" aria-hidden /> : bad ? "!" : i + 1}
                </Badge>
                <span className={cn("text-xs font-medium leading-tight", done ? "text-foreground" : "text-muted-foreground")}>{STATUS_LABEL[st].replace(" pickup", "")}</span>
              </li>
            )
          })}
        </ol>

        <InfoList className="grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
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
            <span className="text-xs font-normal text-muted-foreground"> · paid by {s.deliveryPayer === "us" ? "us" : "customer"}</span>
          </Info>
          <Info label="Package">{[s.package, s.weight ? `${s.weight} kg` : null, s.dimensions].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label="Pickup → ETA">{shortDate(s.pickupDate)} → {s.status === "delivered" ? `delivered ${shortDate(s.deliveredAt)}` : shortDate(s.estimatedDelivery)}</Info>
        </InfoList>
        {s.notes && <Card className="p-3 text-sm text-muted-foreground shadow-none">{s.notes}</Card>}

        {/* Actions */}
        <Card className="gap-3 p-3.5 shadow-none">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onPrint(s)}>Print label</Button>
            {canCod && (
              <Button type="button" disabled={busy} onClick={() => onRecordCod(s)}>Record COD payment</Button>
            )}
            {canMarkFailed && !failing && (
              <Button type="button" variant="destructive" onClick={() => setFailing(true)}>Mark failed</Button>
            )}
          </div>

          {failing && (
            <div className="space-y-2">
              <FormField label="Reason for failure *" htmlFor="shipment-fail-note">
                <Textarea id="shipment-fail-note" rows={2} value={failNote} onChange={(e) => setFailNote(e.target.value)} placeholder="e.g. Customer unreachable" />
              </FormField>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" disabled={busy || !failNote.trim()}
                  onClick={() => onUpdateStatus(s, { status: "failed", description: failNote.trim() })}>Confirm failed</Button>
                <Button type="button" variant="outline" onClick={() => setFailing(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {nextOptions.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FormField label="Update status" htmlFor="shipment-next-status">
                <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
                  <SelectTrigger id="shipment-next-status" className="w-full"><SelectValue placeholder="Select next status" /></SelectTrigger>
                  <SelectContent>
                    {nextOptions.map((st) => <SelectItem key={st} value={st}>{STATUS_LABEL[st]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Location" htmlFor="shipment-location">
                <Input id="shipment-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Dhanmondi hub" />
              </FormField>
              <Button type="button" disabled={busy || !status || (status === "failed" && !note.trim())} onClick={apply}>{busy ? "Saving…" : "Save"}</Button>
              {(status === "failed" || status) && (
                <FormField label={`Note${status === "failed" ? " *" : ""}`} htmlFor="shipment-note" className="sm:col-span-3">
                  <Input id="shipment-note" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={status === "failed" ? "Required: why did delivery fail?" : "Optional"} />
                </FormField>
              )}
            </div>
          )}
        </Card>

        {/* History */}
        <div>
          <SectionTitle as="p" className="mb-2">Tracking history</SectionTitle>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tracking events yet.</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {history.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="text-sm font-semibold">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
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
