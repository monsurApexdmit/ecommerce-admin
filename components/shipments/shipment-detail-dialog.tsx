"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
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
  TIMELINE_STEPS, codView, shortDate, validNextStatuses, type CodKind,
} from "./shipment-utils"

const NS = ["inventory", "orders", "common"] as const
type K = ParseKeys<typeof NS>

/** Shipment status code → label key (codes stay as data). */
const STATUS_KEY: Record<ShipmentStatus, K> = {
  pending: "orders:shipments.status.pending",
  picked_up: "orders:shipments.status.picked_up",
  in_transit: "orders:shipments.status.in_transit",
  out_for_delivery: "orders:shipments.status.out_for_delivery",
  delivered: "orders:shipments.status.delivered",
  failed: "orders:shipments.status.failed",
  returned: "orders:shipments.status.returned",
}
/** Short step names under the progress timeline */
const STEP_KEY: Partial<Record<ShipmentStatus, K>> = {
  pending: "inventory:shipments.step.pending",
}
const COD_KEY: Partial<Record<CodKind, K>> = {
  prepaid: "orders:shipments.cod.prepaid",
  to_collect: "orders:shipments.cod.to_collect",
  collected: "orders:shipments.cod.collected",
  delivered_unpaid: "orders:shipments.cod.delivered_unpaid",
  returning: "orders:shipments.cod.returning",
}

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

/** Package presets saved by CreateShipmentModal → label keys */
const PACK_KEY: Record<string, K> = {
  pouch: "inventory:shipments.pack.pouch",
  "box-m": "inventory:shipments.pack.boxM",
  "box-l": "inventory:shipments.pack.boxL",
  custom: "inventory:shipments.pack.custom",
}

const Info = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <InfoRow layout="stacked" label={label} className="min-w-0">{children}</InfoRow>
)

export function ShipmentDetailDialog({ shipment, formatCurrency, busy, onClose, onPrint, onUpdateStatus, onRecordCod }: Props) {
  const { t, i18n } = useTranslation(NS)
  const tag = localeTag(i18n.language)
  const statusLabel = (st: ShipmentStatus | string) => (st in STATUS_KEY ? t(STATUS_KEY[st as ShipmentStatus]) : st)
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
  const codLabel = COD_KEY[cod.kind] ? t(COD_KEY[cod.kind]!) : cod.label

  const apply = async () => {
    if (!status) return
    if (status === "failed" && !note.trim()) return
    await onUpdateStatus(s, { status, location: location.trim() || undefined, description: note.trim() || undefined })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{s.trackingNumber || t("inventory:shipments.detail.titleFallback", { id: s.id })}</DialogTitle>
          <DialogDescription>
            {t("inventory:shipments.detail.order", { invoice: s.sell?.invoiceNo ?? s.sellId })} ·{" "}
            <StatusBadge status={s.status} label={statusLabel(s.status)} />
          </DialogDescription>
        </DialogHeader>

        {/* Step timeline */}
        <ol className="grid grid-cols-5 gap-1" aria-label={t("inventory:shipments.detail.progress")}>
          {TIMELINE_STEPS.map((st, i) => {
            const done = i <= reached
            const bad = fail && i === reached
            return (
              <li key={st} className="flex flex-col items-center gap-1.5 text-center">
                <Badge variant={bad ? "destructive" : done ? "default" : "outline"} className="size-7 justify-center rounded-full p-0">
                  {done && !bad ? <Check className="size-3.5" aria-hidden /> : bad ? "!" : i + 1}
                </Badge>
                <span className={cn("text-xs font-medium leading-tight", done ? "text-foreground" : "text-muted-foreground")}>{t(STEP_KEY[st] ?? STATUS_KEY[st])}</span>
              </li>
            )
          })}
        </ol>

        <InfoList className="grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Info label={t("common:fields.customer")}>{s.sell?.customerName ?? "—"}</Info>
          <Info label={t("common:fields.phone")}>{s.sell?.customerPhone || "—"}</Info>
          <Info label={t("common:fields.address")}>{address || "—"}</Info>
          <Info label={t("orders:shipments.courier")}>{s.carrier || "—"}</Info>
          <Info label={t("inventory:shipments.detail.service")}>{[s.shippingMethod, s.deliverySpeed && (s.deliverySpeed === "express" ? t("inventory:shipments.speed.express") : t("inventory:shipments.speed.regular"))].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label={t("inventory:shipments.detail.rider")}>{s.rider || "—"}</Info>
          <Info label={t("orders:shipments.col.cod")}>
            {cod.amount > 0 ? <>{formatCurrency(cod.amount)} <span className={cn("text-xs font-normal", cod.cls)}>{codLabel}</span></> : <span className={cod.cls}>{codLabel}</span>}
          </Info>
          <Info label={t("inventory:shipments.deliveryCharge")}>
            <span className="tabular-nums">{formatCurrency(Number(s.shippingCost) || 0)}</span>
            <span className="text-xs font-normal text-muted-foreground"> · {s.deliveryPayer === "us" ? t("inventory:shipments.detail.paidByUs") : t("inventory:shipments.detail.paidByCustomer")}</span>
          </Info>
          <Info label={t("inventory:shipments.detail.package")}>{[s.package ? (PACK_KEY[s.package] ? t(PACK_KEY[s.package]) : s.package) : null, s.weight ? t("inventory:shipments.detail.kg", { value: s.weight }) : null, s.dimensions].filter(Boolean).join(" · ") || "—"}</Info>
          <Info label={t("inventory:shipments.detail.pickupEta")}>{shortDate(s.pickupDate, tag)} → {s.status === "delivered" ? t("inventory:shipments.detail.deliveredOn", { date: shortDate(s.deliveredAt, tag) }) : shortDate(s.estimatedDelivery, tag)}</Info>
        </InfoList>
        {s.notes && <Card className="p-3 text-sm text-muted-foreground shadow-none">{s.notes}</Card>}

        {/* Actions */}
        <Card className="gap-3 p-3.5 shadow-none">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onPrint(s)}>{t("orders:shipments.printLabel")}</Button>
            {canCod && (
              <Button type="button" disabled={busy} onClick={() => onRecordCod(s)}>{t("inventory:shipments.detail.recordCod")}</Button>
            )}
            {canMarkFailed && !failing && (
              <Button type="button" variant="destructive" onClick={() => setFailing(true)}>{t("inventory:shipments.detail.markFailed")}</Button>
            )}
          </div>

          {failing && (
            <div className="space-y-2">
              <FormField label={t("inventory:shipments.detail.failReason")} htmlFor="shipment-fail-note">
                <Textarea id="shipment-fail-note" rows={2} value={failNote} onChange={(e) => setFailNote(e.target.value)} placeholder={t("inventory:shipments.detail.failReasonPh")} />
              </FormField>
              <div className="flex gap-2">
                <Button type="button" variant="destructive" disabled={busy || !failNote.trim()}
                  onClick={() => onUpdateStatus(s, { status: "failed", description: failNote.trim() })}>{t("inventory:shipments.detail.confirmFailed")}</Button>
                <Button type="button" variant="outline" onClick={() => setFailing(false)}>{t("common:actions.cancel")}</Button>
              </div>
            </div>
          )}

          {nextOptions.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <FormField label={t("orders:shipments.updateStatus")} htmlFor="shipment-next-status">
                <Select value={status} onValueChange={(v) => setStatus(v as ShipmentStatus)}>
                  <SelectTrigger id="shipment-next-status" className="w-full"><SelectValue placeholder={t("inventory:shipments.detail.selectNext")} /></SelectTrigger>
                  <SelectContent>
                    {nextOptions.map((st) => <SelectItem key={st} value={st}>{statusLabel(st)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label={t("common:fields.location")} htmlFor="shipment-location">
                <Input id="shipment-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("inventory:shipments.detail.locationPh")} />
              </FormField>
              <Button type="button" disabled={busy || !status || (status === "failed" && !note.trim())} onClick={apply}>{busy ? t("common:actions.saving") : t("common:actions.save")}</Button>
              {(status === "failed" || status) && (
                <FormField label={status === "failed" ? t("inventory:shipments.detail.noteRequired") : t("common:fields.note")} htmlFor="shipment-note" className="sm:col-span-3">
                  <Input id="shipment-note" value={note} onChange={(e) => setNote(e.target.value)}
                    placeholder={status === "failed" ? t("inventory:shipments.detail.notePhFailed") : t("common:status.optional")} />
                </FormField>
              )}
            </div>
          )}
        </Card>

        {/* History */}
        <div>
          <SectionTitle as="p" className="mb-2">{t("inventory:shipments.detail.history")}</SectionTitle>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inventory:shipments.detail.noEvents")}</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {history.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="text-sm font-semibold">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {statusLabel(e.status)}{e.location ? ` · ${e.location}` : ""} · {new Date(e.eventTime).toLocaleString(tag)}
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
