"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Truck, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { UserAvatar } from "@/components/common/UserAvatar"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { courierApi, courierError, type BulkBookResponse, type DeliveryType, type ItemType } from "@/lib/courierApi"
import type { SellResponse } from "@/lib/sellsApi"
import { COURIER_NS } from "./i18n"
import { CopyButton, PROVIDER_META, accountName } from "./courier-ui"
import { canSendToCourier, orderDue } from "./send-to-courier-dialog"
import { defaultAccount, useBookableCouriers } from "./use-courier-accounts"

const MAX_BULK = 100

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Selected orders (ineligible ones are listed and skipped) */
  orders: SellResponse[]
  /** Called after a run that booked at least one order */
  onDone?: () => void
}

/** Sends many orders to one courier: shared defaults, then a per-order result list. */
export function BulkCourierDialog({ open, onOpenChange, orders: selection, onDone }: Props) {
  const { t } = useTranslation(COURIER_NS)
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const couriers = useBookableCouriers(open)

  const [accountId, setAccountId] = useState<number | null>(null)
  const [weight, setWeight] = useState("0.5")
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(48)
  const [itemType, setItemType] = useState<ItemType>(2)
  const [note, setNote] = useState("")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BulkBookResponse | null>(null)
  const [error, setError] = useState("")
  // The host may clear its selection after a run; keep the orders this dialog was opened with
  const [orders, setOrders] = useState<SellResponse[]>(selection)

  const account = couriers.accounts.find((a) => a.id === accountId) ?? null
  const isPathao = account?.provider === "pathao"
  const eligible = orders.filter(canSendToCourier)
  const skipped = orders.filter((o) => !canSendToCourier(o))
  const batch = eligible.slice(0, MAX_BULK)

  const applyDefaults = (id: number | null) => {
    const a = couriers.accounts.find((x) => x.id === id)
    setAccountId(id)
    setWeight(String(a?.settings?.weightKg ?? 0.5))
    setDeliveryType((a?.settings?.deliveryType ?? 48) as DeliveryType)
    setItemType((a?.settings?.itemType ?? 2) as ItemType)
    setNote(a?.settings?.note ?? "")
  }

  useEffect(() => {
    if (!open) return
    setResult(null); setError(""); setOrders(selection)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open || !couriers.loaded) return
    if (!accountId || !couriers.accounts.some((a) => a.id === accountId)) applyDefaults(defaultAccount(couriers.accounts)?.id ?? null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, couriers.loaded, couriers.accounts])

  const run = async () => {
    if (!account || batch.length === 0) return
    const w = Number(weight)
    if (!Number.isFinite(w) || w <= 0) { setError(t("courier:book.err.weight")); return }
    setRunning(true); setError("")
    try {
      const res = await courierApi.bulkBook({
        sellIds: batch.map((o) => o.id),
        courierAccountId: account.id,
        defaults: { weightKg: w, note: note.trim() || undefined, ...(isPathao ? { deliveryType, itemType } : {}) },
      })
      setResult(res)
      if (res.succeeded > 0) onDone?.()
      toast({
        variant: res.failed > 0 && res.succeeded === 0 ? "destructive" : undefined,
        title: t("courier:bulk.toast.done", { courier: accountName(account) }),
        description: t("courier:bulk.summary", { ok: res.succeeded, failed: res.failed }),
      })
    } catch (e) {
      setError(courierError(e, t("common:extra.tryAgain")))
    } finally {
      setRunning(false)
    }
  }

  const invoiceOf = (id: number, fallback?: string | null) => fallback || orders.find((o) => o.id === id)?.invoiceNo || `#${id}`

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>{t("courier:bulk.title", { count: orders.length })}</DialogTitle>
          <DialogDescription>{result ? t("courier:bulk.summary", { ok: result.succeeded, failed: result.failed }) : t("courier:bulk.description")}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
          {couriers.error ? (
            <Alert variant="destructive"><AlertDescription>{t("common:extra.couldNotLoad")}</AlertDescription></Alert>
          ) : couriers.loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : couriers.accounts.length === 0 ? (
            <EmptyState bordered icon={Truck} title={t("courier:book.noCouriers")} description={t("courier:book.noCouriersDesc")}
              action={<Button asChild variant="outline"><Link href="/dashboard/shipping-methods">{t("courier:book.connectCourier")}</Link></Button>} />
          ) : result ? (
            <Card className="gap-0 overflow-hidden py-0 shadow-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("courier:bulk.col.order")}</TableHead>
                    <TableHead>{t("courier:bulk.col.result")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.results.map((r) => (
                    <TableRow key={r.sellId}>
                      <TableCell className="align-top font-medium">#{invoiceOf(r.sellId, r.invoiceNo)}</TableCell>
                      <TableCell className="whitespace-normal">
                        {r.ok ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <CheckCircle2 className="size-4 text-primary" aria-hidden />
                            <span>{t("courier:bulk.booked")}</span>
                            {(r.trackingCode || r.consignmentId) && (
                              <span className="inline-flex items-center font-mono text-[13px]">
                                {r.trackingCode || r.consignmentId}
                                <CopyButton value={String(r.trackingCode || r.consignmentId)} label={t("courier:panel.copyTracking")} />
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="flex items-start gap-1.5 text-destructive">
                            <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                            <span>{r.message || t("courier:bulk.failed")}</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : (
            <>
              <section className="space-y-2.5">
                <SectionTitle>{t("courier:book.courier")}</SectionTitle>
                <ChoiceCardGroup value={accountId ? String(accountId) : ""} onValueChange={(v) => applyDefaults(Number(v))} aria-label={t("courier:book.courier")}
                  className="grid-cols-[repeat(auto-fill,minmax(170px,1fr))]">
                  {couriers.accounts.map((a) => (
                    <ChoiceCard key={a.id} value={String(a.id)} className="p-3" title={accountName(a)}
                      icon={<UserAvatar shape="square" className="size-8" name={accountName(a)} fallback={PROVIDER_META[a.provider]?.ini ?? a.provider.slice(0, 2).toUpperCase()} />}
                      description={a.isDefault ? t("courier:integrations.default") : undefined} />
                  ))}
                </ChoiceCardGroup>
              </section>

              <section className="space-y-2.5">
                <SectionTitle>{t("courier:bulk.defaults")}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField label={t("courier:book.weight")} htmlFor="bc-weight">
                    <Input id="bc-weight" type="number" min={0.1} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </FormField>
                  <FormField label={t("courier:book.note")} htmlFor="bc-note">
                    <Input id="bc-note" value={note} maxLength={500} placeholder={t("courier:book.notePh")} onChange={(e) => setNote(e.target.value)} />
                  </FormField>
                  {isPathao && (
                    <>
                      <FormField label={t("courier:book.deliveryType")}>
                        <SegmentedControl aria-label={t("courier:book.deliveryType")} value={String(deliveryType)} onValueChange={(v) => setDeliveryType(Number(v) as DeliveryType)}
                          options={[{ value: "48", label: t("courier:deliveryType.normal") }, { value: "12", label: t("courier:deliveryType.onDemand") }]} />
                      </FormField>
                      <FormField label={t("courier:book.itemType")}>
                        <SegmentedControl aria-label={t("courier:book.itemType")} value={String(itemType)} onValueChange={(v) => setItemType(Number(v) as ItemType)}
                          options={[{ value: "2", label: t("courier:itemType.parcel") }, { value: "1", label: t("courier:itemType.document") }]} />
                      </FormField>
                    </>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{isPathao ? t("courier:bulk.pathaoHint") : t("courier:bulk.codHint")}</p>
              </section>

              <section className="space-y-2.5">
                <SectionTitle>{t("courier:bulk.orders", { count: batch.length })}</SectionTitle>
                {eligible.length > MAX_BULK && (
                  <Alert><AlertDescription>{t("courier:bulk.tooMany", { max: MAX_BULK })}</AlertDescription></Alert>
                )}
                <Card className="max-h-64 gap-0 overflow-y-auto py-0 shadow-none">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("courier:bulk.col.order")}</TableHead>
                        <TableHead>{t("common:fields.customer")}</TableHead>
                        <TableHead className="text-right">{t("courier:bulk.col.cod")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batch.map((o) => (
                        <TableRow key={o.id}>
                          <TableCell className="font-medium">#{o.invoiceNo}</TableCell>
                          <TableCell className="max-w-[220px] truncate">{o.shippingFullName || o.customerName}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrency(orderDue(o))}</TableCell>
                        </TableRow>
                      ))}
                      {skipped.map((o) => (
                        <TableRow key={o.id} className="text-muted-foreground">
                          <TableCell>#{o.invoiceNo}</TableCell>
                          <TableCell colSpan={2} className="whitespace-normal">
                            <Badge variant="outline">{t("courier:bulk.skipped")}</Badge> {t("courier:bulk.skippedReason")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </section>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
            </>
          )}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          {result ? (
            <Button type="button" onClick={() => onOpenChange(false)}>{t("common:actions.done")}</Button>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={running} onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
              {couriers.accounts.length > 0 && (
                <Button type="button" disabled={running || !account || batch.length === 0} onClick={run}>
                  {running ? t("courier:bulk.running", { count: batch.length }) : t("courier:bulk.send", { count: batch.length, courier: account ? accountName(account) : "" })}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
