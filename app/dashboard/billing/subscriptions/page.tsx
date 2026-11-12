"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { saasBillingApi, type BillingUsage, type PaymentRecord, type Subscription } from "@/lib/saasBillingApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const UNLIMITED = 999999
const TAX_RATE = 0.1
const TRIAL_DAYS = 10


type K = ParseKeys<["account", "common"]>

// ids are sent to the backend; labels are translation keys
const REASONS: { id: string; label: K }[] = [
  { id: "", label: "account:billing.subscriptions.reasons.select" },
  { id: "too_expensive", label: "account:billing.subscriptions.reasons.tooExpensive" },
  { id: "missing_features", label: "account:billing.subscriptions.reasons.missingFeatures" },
  { id: "switching_products", label: "account:billing.subscriptions.reasons.switching" },
  { id: "poor_support", label: "account:billing.subscriptions.reasons.poorSupport" },
  { id: "other", label: "account:billing.subscriptions.reasons.other" },
]
const METHODS: Record<string, K> = { card: "common:payment.card", bkash: "account:billing.shared.methods.bkash", bank: "account:billing.shared.methods.bank" }
const PAY_STATUS: Record<string, K> = { pending: "common:orderStatus.pending", failed: "account:billing.subscriptions.failed", refunded: "common:orderStatus.refunded", cancelled: "common:orderStatus.cancelled" }

const FAQ: [K, K][] = [
  ["account:billing.subscriptions.faq.q1", "account:billing.subscriptions.faq.a1"],
  ["account:billing.subscriptions.faq.q2", "account:billing.subscriptions.faq.a2"],
  ["account:billing.subscriptions.faq.q3", "account:billing.subscriptions.faq.a3"],
]

export default function SubscriptionsPage() {
  const blocked = useModuleGuard("Subscriptions")
  const { t, i18n } = useTranslation(["account", "common"])
  const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "—")
  const { formatCurrency } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const writable = canWrite("Subscriptions")

  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [loading, setLoading] = useState(true)
  const [histLoading, setHistLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [reason, setReason] = useState("")

  const money = (cents: number) => formatCurrency((cents || 0) / 100)

  const loadSub = useCallback(async () => {
    try {
      const res = await saasBillingApi.getCurrentSubscription()
      const d: any = res.data
      setSub(d && d.status !== "none" && d.id ? (d as Subscription) : null)
    } catch (e: any) {
      if (e?.response?.status !== 404) toast.error(e?.response?.data?.message || t("account:billing.subscriptions.loadFailed"))
      setSub(null)
    }
    try { setUsage((await saasBillingApi.getUsage()).data) } catch { setUsage(null) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadPayments = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await saasBillingApi.getPaymentHistory(page, perPage)
      setPayments(res.data.payments || [])
      setTotal(res.data.total || 0)
    } catch { setPayments([]); setTotal(0) } finally { setHistLoading(false) }
  }, [page, perPage])

  useEffect(() => { (async () => { setLoading(true); await loadSub(); setLoading(false) })() }, [loadSub])
  useEffect(() => { loadPayments() }, [loadPayments])
  // ?cancel=1 (from Plan & billing) opens the cancel dialog once the subscription has loaded
  useEffect(() => {
    if (loading || typeof window === "undefined") return
    if (new URLSearchParams(window.location.search).get("cancel") === "1") {
      window.history.replaceState(null, "", window.location.pathname)
      if (sub && sub.status !== "cancelled" && !(sub.isTrial || sub.status === "trialing")) setCancelOpen(true)
    }
  }, [loading, sub])

  // ---- derived subscription state ----
  const isTrial = !!sub && (sub.isTrial || sub.status === "trialing")
  const periodEnd = sub?.currentPeriodEnd ?? null
  const pastEnd = !!periodEnd && new Date(periodEnd).getTime() < Date.now()
  const status: "active" | "trial" | "cancelled" | "expired" | "past_due" = !sub ? "active"
    : sub.status === "cancelled" ? "cancelled"
    : sub.status === "past_due" ? "past_due"
    : sub.status === "expired" || pastEnd ? "expired"
    : isTrial ? "trial" : "active"
  const cancelled = status === "cancelled", expired = status === "expired"
  const daysLeft = periodEnd ? Math.max(0, Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 864e5)) : 0
  const basePrice = isTrial ? 0 : sub?.periodPrice ?? sub?.price ?? 0
  const yearly = sub?.billingPeriod === "yearly"

  const STATUS_PILL: Record<string, { label: string; variant: StatusVariant }> = {
    active: { label: t("account:billing.shared.status.active"), variant: "default" },
    trial: { label: t("account:billing.shared.status.trial"), variant: "secondary" },
    cancelled: { label: t("account:billing.shared.status.cancelled"), variant: "destructive" },
    expired: { label: t("account:billing.shared.status.expired"), variant: "outline" },
    past_due: { label: t("account:billing.shared.status.pastDue"), variant: "secondary" },
  }
  const pill = STATUS_PILL[status]

  const meters = usage ? [
    { label: t("account:billing.shared.teamMembers"), used: usage.teamMembers.used, limit: usage.teamMembers.limit as number | null },
    { label: t("account:billing.shared.products"), used: usage.products.used, limit: usage.products.limit as number | null },
    { label: t("account:billing.shared.locations"), used: usage.branches.used, limit: usage.branches.limit as number | null },
    { label: t("account:billing.shared.salesThisMonth"), used: usage.salesThisMonth, limit: null as number | null },
  ] : []
  const overAny = meters.some((m) => m.limit !== null && m.limit < UNLIMITED && m.limit > 0 && m.used > m.limit)

  let note: { danger: boolean; text: string } | null = null
  if (cancelled) note = { danger: false, text: t("account:billing.subscriptions.cancelledNote", { date: fmtD(periodEnd) }) }
  else if (expired) note = { danger: true, text: t("account:billing.subscriptions.expiredNote", { date: fmtD(periodEnd) }) }
  else if (overAny) note = { danger: false, text: t("account:billing.subscriptions.overNote") }

  const switchOn = !!sub && sub.autoRenew && status === "active" && !isTrial

  const flipAuto = async () => {
    if (!sub || busy) return
    if (isTrial) { toast.error(t("account:billing.subscriptions.autoPaidOnly")); return }
    if (status !== "active") { toast.error(t("account:billing.subscriptions.reactivateFirst")); return }
    setBusy(true)
    try {
      await saasBillingApi.setAutoRenew(sub.id, !sub.autoRenew)
      toast.success(!sub.autoRenew ? t("account:billing.subscriptions.autoEnabled") : t("account:billing.subscriptions.autoDisabled"))
      await loadSub()
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:billing.subscriptions.autoFailed")) } finally { setBusy(false) }
  }

  const doRenew = async () => {
    if (!sub || isTrial || busy) return
    const totalCents = Math.round(basePrice * (1 + TAX_RATE))
    const early = status === "active" && daysLeft > 7
    const vars = { plan: sub.planName, amount: money(totalCents), date: fmtD(periodEnd) }
    if (!window.confirm(cancelled || expired ? t("account:billing.shared.reactivateConfirm", vars) : early ? t("account:billing.shared.renewConfirmEarly", vars) : t("account:billing.shared.renewConfirm", vars))) return
    setBusy(true)
    try {
      await saasBillingApi.renewSubscription({ subscriptionId: sub.id, billingPeriod: sub.billingPeriod, autoRenew: true })
      toast.success(cancelled || expired ? t("account:billing.subscriptions.reactivated") : t("account:billing.subscriptions.renewed"))
      await Promise.all([loadSub(), loadPayments()])
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:billing.subscriptions.renewFailed")) } finally { setBusy(false) }
  }

  const doCancel = async () => {
    if (!sub) return
    setBusy(true)
    try {
      await saasBillingApi.cancelSubscription({ subscriptionId: sub.id, reason })
      setCancelOpen(false); setReason("")
      toast.success(t("account:billing.subscriptions.cancelledToast"))
      await loadSub()
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:billing.subscriptions.cancelFailed")) } finally { setBusy(false) }
  }

  const download = async (p: PaymentRecord) => {
    try {
      const res = await saasBillingApi.getInvoice(p.id)
      const f = res.data
      const url = URL.createObjectURL(new Blob([f.html], { type: "text/html" }))
      const a = document.createElement("a")
      a.href = url; a.download = f.filename; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(t("account:billing.subscriptions.downloaded", { number: f.invoiceNumber }))
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:billing.subscriptions.downloadFailed")) }
  }

  if (blocked) return blocked

  const cancelDisabled = !writable || cancelled || expired || isTrial

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("account:billing.subscriptions.title")}
        description={t("account:billing.subscriptions.description")}
        actions={<>
          <Button asChild variant="outline"><Link href="/dashboard/billing/overview">{t("account:billing.subscriptions.billingSettings")}</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/billing/plans">{t("account:billing.subscriptions.browsePlans")}</Link></Button>
        </>}
      />

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[320px]" /><Skeleton className="h-[320px]" /></div>
      ) : sub ? (
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="gap-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{t("account:billing.subscriptions.planTitle", { plan: sub.planName })}</h2>
              <StatusBadge status={status} variant={pill.variant} label={pill.label} />
            </div>
            <div><strong className="text-4xl font-bold tabular-nums">{isTrial ? t("account:billing.shared.free") : money(basePrice)}</strong>{" "}
              <span className="text-sm text-muted-foreground">{isTrial ? t("account:billing.shared.trialSuffix") : yearly ? t("account:billing.shared.billedYearly") : t("account:billing.shared.billedMonthly")}</span></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="text-xs text-muted-foreground">{t("account:billing.subscriptions.currentPeriod")}</div>
                <strong className="text-sm">{sub.currentPeriodStart ? `${fmtD(sub.currentPeriodStart)} → ${fmtD(periodEnd)}` : "—"}</strong></div>
              <div><div className="text-xs text-muted-foreground">{cancelled || expired || isTrial ? t("account:billing.subscriptions.endsOn") : t("account:billing.subscriptions.nextBilling")}</div>
                <strong className="text-sm">{fmtD(isTrial || cancelled || expired ? periodEnd : sub.nextBillingDate ?? periodEnd)}</strong></div>
            </div>
            {isTrial && status === "trial" && (
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">{t("account:billing.shared.freeTrial")}</span><span className="text-muted-foreground">{t("account:billing.subscriptions.daysRemaining", { count: daysLeft })}</span></div>
                <Progress aria-label={t("account:billing.subscriptions.trialProgress")} value={Math.min(100, Math.max(0, Math.round(((TRIAL_DAYS - daysLeft) / TRIAL_DAYS) * 100)))} />
              </div>
            )}
            <Item variant="muted" size="sm">
              <ItemContent>
                <ItemTitle>{t("account:billing.subscriptions.autoRenewal")}</ItemTitle>
                <ItemDescription>{isTrial ? t("account:billing.subscriptions.autoTrial") : switchOn ? t("account:billing.subscriptions.autoOn") : t("account:billing.subscriptions.autoOff")}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={switchOn} aria-label={t("account:billing.subscriptions.autoRenewalAria")} disabled={!writable || busy} onCheckedChange={() => flipAuto()} />
              </ItemActions>
            </Item>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/dashboard/billing/plans">{isTrial || expired || cancelled ? t("account:billing.subscriptions.choosePlan") : t("account:billing.subscriptions.upgradePlan")}</Link></Button>
              {!isTrial && writable && <Button type="button" variant="outline" disabled={busy} onClick={doRenew}>{cancelled || expired ? t("account:billing.shared.reactivate") : t("account:billing.shared.renewNow")}</Button>}
              <Button type="button" variant="destructive" disabled={cancelDisabled} onClick={() => setCancelOpen(true)}>{cancelled ? t("account:billing.subscriptions.cancelled") : t("account:billing.subscriptions.cancelSubscription")}</Button>
            </div>
            {note && <Alert variant={note.danger ? "destructive" : "default"}><AlertDescription>{note.text}</AlertDescription></Alert>}
          </Card>

          <SectionCard title={t("account:billing.subscriptions.usage")} contentClassName="flex flex-col gap-4">
            {!usage ? <Skeleton className="h-40" /> : meters.map((m) => {
              const finite = m.limit !== null && m.limit > 0 && m.limit < UNLIMITED
              const over = finite && m.used > (m.limit as number)
              return (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground"><strong className="text-foreground tabular-nums">{m.used.toLocaleString("en-US")}</strong>{" "}
                      {m.limit === null ? t("account:billing.shared.thisMonth") : finite ? t("account:billing.shared.ofLimit", { limit: (m.limit as number).toLocaleString("en-US") }) : t("account:billing.shared.ofUnlimited")}</span>
                  </div>
                  <Progress
                    aria-label={t("account:billing.shared.usageAria", { name: m.label })}
                    value={finite ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100)) : 0}
                    className={cn(over && "*:data-[slot=progress-indicator]:bg-destructive")}
                  />
                </div>
              )
            })}
          </SectionCard>
        </section>
      ) : (
        <SectionCard title={t("account:billing.subscriptions.noSubTitle")} description={t("account:billing.subscriptions.noSubText")}>
          <Button asChild><Link href="/dashboard/billing/plans">{t("account:billing.subscriptions.browsePlans")}</Link></Button>
        </SectionCard>
      )}

      <SectionCard title={t("account:billing.shared.paymentHistory")} description={t("account:billing.subscriptions.historyDescription")} contentClassName="px-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("account:billing.shared.invoice")}</TableHead><TableHead>{t("account:billing.shared.plan")}</TableHead>
                <TableHead>{t("account:billing.shared.method")}</TableHead><TableHead>{t("common:money.amount")}</TableHead><TableHead>{t("common:fields.status")}</TableHead>
                <TableHead className="text-right">{t("common:actions.download")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || histLoading ? [1, 2, 3].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10" /></TableCell></TableRow>) :
                payments.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title={t("account:billing.subscriptions.noHistory")} className="p-4 md:p-6" /></TableCell></TableRow>
                ) : payments.map((p) => {
                  const paid = p.status === "completed" || p.status === "paid"
                  const trialRow = p.amount === 0 && p.description === "Free trial"
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{fmtD(p.paymentDate ?? p.createdAt)}</TableCell>
                      <TableCell>{trialRow ? t("account:billing.shared.freeTrial") : p.invoiceNumber || "—"}</TableCell>
                      <TableCell>{p.planName || p.description || "—"}{p.billingPeriod && <span className="text-xs text-muted-foreground"> ({p.billingPeriod === "yearly" ? t("account:billing.shared.yearly") : t("account:billing.shared.monthly")})</span>}</TableCell>
                      <TableCell>{p.paymentMethod === "free" ? "—" : METHODS[p.paymentMethod] ? t(METHODS[p.paymentMethod]) : (p.paymentMethod || "—")}</TableCell>
                      <TableCell className="tabular-nums">{trialRow ? t("account:billing.shared.free") : money(p.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} variant={paid ? "default" : p.status === "failed" ? "destructive" : "secondary"}
                          label={paid ? t("common:payment.paid") : PAY_STATUS[p.status] ? t(PAY_STATUS[p.status]) : p.status.charAt(0).toUpperCase() + p.status.slice(1)} />
                      </TableCell>
                      <TableCell className="text-right">
                        {p.invoiceNumber && !trialRow && <Button type="button" variant="link" size="sm" aria-label={t("account:billing.subscriptions.downloadAria", { number: p.invoiceNumber })} onClick={() => download(p)}>{t("common:actions.download")}</Button>}
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
        {total > 0 && (
          <div className="px-6 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
        )}
      </SectionCard>

      <SectionCard title={t("account:billing.subscriptions.faq.title")} contentClassName="flex flex-col gap-4">
        {FAQ.map(([qn, an]) => (
          <div key={qn}><div className="text-sm font-semibold">{t(qn)}</div><div className="text-sm text-muted-foreground">{t(an)}</div></div>
        ))}
      </SectionCard>

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!busy) setCancelOpen(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{t("account:billing.subscriptions.cancelSubscription")}</DialogTitle>
          <DialogDescription>{t("account:billing.subscriptions.cancelDescription", { date: fmtD(periodEnd) })}</DialogDescription>
          <FormField label={t("account:billing.subscriptions.cancelReason")} htmlFor="cancel-reason">
            <Select value={String(reason)} onValueChange={(val) => setReason(val)}>
              <SelectTrigger id="cancel-reason" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.id} value={String(r.id)}>{t(r.label)}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>{t("account:billing.subscriptions.keep")}</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={doCancel}>{busy ? t("account:billing.subscriptions.cancelling") : t("account:billing.subscriptions.cancelSubscription")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
