"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ExternalLink, RefreshCw, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { SectionTitle } from "@/components/common/SectionTitle"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { localeTag } from "@/lib/i18n"
import { courierApi, courierError, type CourierBooking, type CourierShipment, type CourierTrackingEvent } from "@/lib/courierApi"
import { COURIER_NS } from "./i18n"
import { CodeWithCopy, CourierStatusBadge, PROVIDER_META, providerName, useCourierStatusLabel } from "./courier-ui"

interface Props {
  shipmentId: number
  courier: CourierBooking
  /** Called with the refreshed shipment after a sync or cancel. */
  onChanged?: (s: CourierShipment) => void
  /** Load the courier's tracking events when shown (otherwise on demand). */
  autoLoadTracking?: boolean
  className?: string
}

/** Courier booking card: status, consignment / tracking codes, refresh, cancel (Pathao) and the courier's tracking timeline. */
export function CourierShipmentPanel({ shipmentId, courier, onChanged, autoLoadTracking, className }: Props) {
  const { t, i18n } = useTranslation(COURIER_NS)
  const tag = localeTag(i18n.language)
  const statusLabel = useCourierStatusLabel()
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [busy, setBusy] = useState<"" | "sync" | "cancel">("")
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [events, setEvents] = useState<CourierTrackingEvent[] | null>(null)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsError, setEventsError] = useState("")

  const provider = courier.provider.toLowerCase()
  const name = providerName(courier.provider)
  const canCancel = courier.canCancel
  const canSync = courier.canSync && !courier.isFinal
  const when = (iso?: string | null) => (iso ? new Date(iso).toLocaleString(tag, { dateStyle: "medium", timeStyle: "short" }) : "—")

  const loadTracking = useCallback(async () => {
    setEventsLoading(true); setEventsError("")
    try {
      const res = await courierApi.tracking(shipmentId)
      setEvents(res.events ?? [])
    } catch (e) {
      setEventsError(courierError(e, t("common:extra.couldNotLoad")))
    } finally {
      setEventsLoading(false)
    }
  }, [shipmentId, t])

  useEffect(() => {
    setEvents(null); setEventsError("")
    if (autoLoadTracking) loadTracking()
  }, [shipmentId, autoLoadTracking, loadTracking])

  const sync = async () => {
    setBusy("sync")
    try {
      const s = await courierApi.sync(shipmentId)
      toast({ title: t("courier:panel.toast.synced"), description: statusLabel(s.courierBooking?.status) })
      onChanged?.(s)
      if (events) loadTracking()
    } catch (e) {
      toast({ variant: "destructive", title: t("courier:panel.toast.syncFailed"), description: courierError(e, t("common:extra.tryAgain")) })
    } finally {
      setBusy("")
    }
  }

  const cancel = async () => {
    setBusy("cancel")
    try {
      const s = await courierApi.cancel(shipmentId)
      toast({ title: t("courier:panel.toast.cancelled", { courier: name }) })
      setConfirmCancel(false)
      onChanged?.(s)
    } catch (e) {
      toast({ variant: "destructive", title: t("courier:panel.toast.cancelFailed"), description: courierError(e, t("common:extra.tryAgain")) })
    } finally {
      setBusy("")
    }
  }

  return (
    <Card className={className ?? "gap-3 p-4 text-sm shadow-none"}>
      <div className="flex flex-wrap items-center gap-2">
        <UserAvatar shape="square" className="size-8" name={name} fallback={PROVIDER_META[provider]?.ini ?? name.slice(0, 2).toUpperCase()} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{t("courier:panel.title", { courier: name })}</div>
          <div className="text-xs text-muted-foreground">
            {courier.lastSyncedAt ? t("courier:panel.lastSynced", { time: when(courier.lastSyncedAt) }) : t("courier:panel.neverSynced")}
          </div>
        </div>
        <CourierStatusBadge courier={courier} />
      </div>

      {courier.syncError && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden />
          <AlertDescription>{t("courier:panel.syncError", { message: courier.syncError })}</AlertDescription>
        </Alert>
      )}

      <InfoList className="grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
        <InfoRow layout="stacked" label={t("courier:panel.consignment")} value={<CodeWithCopy value={courier.consignmentId} copyLabel={t("courier:panel.copyConsignment")} />} />
        <InfoRow layout="stacked" label={t("courier:panel.trackingCode")} value={<CodeWithCopy value={courier.trackingCode} copyLabel={t("courier:panel.copyTracking")} />} />
        <InfoRow layout="stacked" label={t("courier:panel.courierStatus")} value={courier.rawStatus || "—"} />
        <InfoRow layout="stacked" label={t("courier:panel.codAmount")} value={courier.codAmount != null ? formatCurrency(Number(courier.codAmount)) : "—"} />
        <InfoRow layout="stacked" label={t("courier:panel.codCollected")} value={courier.codCollected != null ? formatCurrency(Number(courier.codCollected)) : "—"} />
        <InfoRow layout="stacked" label={t("courier:panel.deliveryFee")} value={courier.deliveryFee != null ? formatCurrency(Number(courier.deliveryFee)) : "—"} />
        <InfoRow layout="stacked" label={t("courier:panel.bookedAt")} value={when(courier.bookedAt)} />
        {courier.pathao && (courier.pathao.cityName || courier.pathao.zoneName) && (
          <InfoRow layout="stacked" className="col-span-2" label={t("courier:panel.location")}
            value={[courier.pathao.areaName, courier.pathao.zoneName, courier.pathao.cityName].filter(Boolean).join(", ")} />
        )}
      </InfoList>

      <div className="flex flex-wrap gap-2">
        {canSync && (
          <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={sync}>
            <RefreshCw className={busy === "sync" ? "size-4 animate-spin" : "size-4"} aria-hidden /> {t("courier:panel.refresh")}
          </Button>
        )}
        {courier.trackingUrl && (
          <Button asChild variant="outline" size="sm">
            <a href={courier.trackingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" aria-hidden /> {t("courier:panel.openTracking")}
            </a>
          </Button>
        )}
        {canCancel && (
          <Button type="button" variant="outline" size="sm" className="text-destructive" disabled={!!busy} onClick={() => setConfirmCancel(true)}>
            <XCircle className="size-4" aria-hidden /> {t("courier:panel.cancelAtCourier")}
          </Button>
        )}
        {events === null && !eventsLoading && !autoLoadTracking && (
          <Button type="button" variant="ghost" size="sm" onClick={loadTracking}>{t("courier:panel.showTracking")}</Button>
        )}
      </div>

      {(events !== null || eventsLoading || eventsError) && (
        <div>
          <SectionTitle as="p" className="mb-2" action={events !== null && (
            <WithTooltip content={t("courier:panel.reloadTracking")}>
              <Button type="button" variant="ghost" size="icon" className="size-7" aria-label={t("courier:panel.reloadTracking")} disabled={eventsLoading} onClick={loadTracking}>
                <RefreshCw className="size-3.5" aria-hidden />
              </Button>
            </WithTooltip>
          )}>{t("courier:panel.trackingTitle")}</SectionTitle>
          {eventsLoading ? (
            <p className="text-muted-foreground">{t("common:status.loading")}</p>
          ) : eventsError ? (
            <p className="text-destructive">{eventsError}</p>
          ) : !events?.length ? (
            <p className="text-muted-foreground">{t("courier:panel.noEvents")}</p>
          ) : (
            <ol className="space-y-3 border-l pl-4">
              {events.map((e, i) => (
                <li key={`${e.time}-${i}`} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="font-medium">{e.message}</p>
                  <p className="text-xs text-muted-foreground">{[e.status, e.time ? when(e.time) : null].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={(o) => !o && busy !== "cancel" && setConfirmCancel(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("courier:panel.cancelTitle", { courier: name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("courier:panel.cancelDesc", { id: courier.consignmentId ?? "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "cancel"}>{t("courier:panel.keepBooking")}</AlertDialogCancel>
            <AlertDialogAction disabled={busy === "cancel"} onClick={(e) => { e.preventDefault(); cancel() }}>
              {busy === "cancel" ? t("courier:panel.cancelling") : t("courier:panel.cancelAtCourier")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
