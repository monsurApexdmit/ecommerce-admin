"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
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


const REASONS = [
  { id: "", label: "Select a reason" },
  { id: "too_expensive", label: "Too expensive" },
  { id: "missing_features", label: "Missing features" },
  { id: "switching_products", label: "Switching to another product" },
  { id: "poor_support", label: "Poor customer support" },
  { id: "other", label: "Other" },
]
const METHODS: Record<string, string> = { card: "Card", bkash: "bKash", bank: "Bank transfer", free: "—" }

const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

const FAQ = [
  ["How do I change my subscription plan?", 'Click "Upgrade plan" above to change to a different plan. You will be charged the new plan price immediately.'],
  ["Can I cancel my subscription?", 'Yes, click "Cancel subscription" above. Your access will continue until the end of the current billing period.'],
  ["What is auto-renewal?", "Auto-renewal automatically extends your subscription on the next billing date. You can disable it anytime."],
]

export default function SubscriptionsPage() {
  const blocked = useModuleGuard("Subscriptions")
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
      if (e?.response?.status !== 404) toast.error(e?.response?.data?.message || "Failed to load subscription data")
      setSub(null)
    }
    try { setUsage((await saasBillingApi.getUsage()).data) } catch { setUsage(null) }
  }, [])

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
    active: { label: "Active", variant: "default" },
    trial: { label: "Trial", variant: "secondary" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    expired: { label: "Expired", variant: "outline" },
    past_due: { label: "Past due", variant: "secondary" },
  }
  const pill = STATUS_PILL[status]

  const meters = usage ? [
    { label: "Team members", used: usage.teamMembers.used, limit: usage.teamMembers.limit as number | null },
    { label: "Products", used: usage.products.used, limit: usage.products.limit as number | null },
    { label: "Locations", used: usage.branches.used, limit: usage.branches.limit as number | null },
    { label: "Sales this month", used: usage.salesThisMonth, limit: null as number | null },
  ] : []
  const overAny = meters.some((m) => m.limit !== null && m.limit < UNLIMITED && m.limit > 0 && m.used > m.limit)

  let note: { danger: boolean; text: string } | null = null
  if (cancelled) note = { danger: false, text: `Your subscription is cancelled. Access continues until ${fmtD(periodEnd)}.` }
  else if (expired) note = { danger: true, text: `Your subscription expired on ${fmtD(periodEnd)}. Renew to regain access.` }
  else if (overAny) note = { danger: false, text: "You are over a plan limit. Consider upgrading your plan." }

  const switchOn = !!sub && sub.autoRenew && status === "active" && !isTrial

  const flipAuto = async () => {
    if (!sub || busy) return
    if (isTrial) { toast.error("Auto-renewal applies to paid plans only"); return }
    if (status !== "active") { toast.error("Reactivate your subscription first"); return }
    setBusy(true)
    try {
      await saasBillingApi.setAutoRenew(sub.id, !sub.autoRenew)
      toast.success(!sub.autoRenew ? "Auto-renewal enabled" : "Auto-renewal disabled")
      await loadSub()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to update auto-renewal setting") } finally { setBusy(false) }
  }

  const doRenew = async () => {
    if (!sub || isTrial || busy) return
    const totalCents = Math.round(basePrice * (1 + TAX_RATE))
    const early = status === "active" && daysLeft > 7
    const verb = cancelled || expired ? "Reactivate" : "Renew"
    if (!window.confirm(`${early ? `Your plan is paid until ${fmtD(periodEnd)}. ` : ""}${verb} ${sub.planName} for ${money(totalCents)} (incl. 10% tax)?`)) return
    setBusy(true)
    try {
      await saasBillingApi.renewSubscription({ subscriptionId: sub.id, billingPeriod: sub.billingPeriod, autoRenew: true })
      toast.success(cancelled || expired ? "Subscription reactivated" : "Subscription renewed")
      await Promise.all([loadSub(), loadPayments()])
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to renew subscription") } finally { setBusy(false) }
  }

  const doCancel = async () => {
    if (!sub) return
    setBusy(true)
    try {
      await saasBillingApi.cancelSubscription({ subscriptionId: sub.id, reason })
      setCancelOpen(false); setReason("")
      toast.success("Subscription cancelled. Your access continues until the end of the billing period.")
      await loadSub()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to cancel subscription") } finally { setBusy(false) }
  }

  const download = async (p: PaymentRecord) => {
    try {
      const res = await saasBillingApi.getInvoice(p.id)
      const f = res.data
      const url = URL.createObjectURL(new Blob([f.html], { type: "text/html" }))
      const a = document.createElement("a")
      a.href = url; a.download = f.filename; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success(`Invoice ${f.invoiceNumber} downloaded`)
    } catch (e: any) { toast.error(e?.response?.data?.message || "Could not download invoice") }
  }

  if (blocked) return blocked

  const cancelDisabled = !writable || cancelled || expired || isTrial

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Subscriptions"
        description="Manage your subscription and billing details."
        actions={<>
          <Button asChild variant="outline"><Link href="/dashboard/billing/overview">Billing settings</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/billing/plans">Browse plans</Link></Button>
        </>}
      />

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[320px]" /><Skeleton className="h-[320px]" /></div>
      ) : sub ? (
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card className="gap-4 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">{sub.planName} plan</h2>
              <StatusBadge status={status} variant={pill.variant} label={pill.label} />
            </div>
            <div><strong className="text-4xl font-bold tabular-nums">{isTrial ? "Free" : money(basePrice)}</strong>{" "}
              <span className="text-sm text-muted-foreground">{isTrial ? "· 10-day trial" : yearly ? "/ year · billed yearly" : "/ month · billed monthly"}</span></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="text-xs text-muted-foreground">Current period</div>
                <strong className="text-sm">{sub.currentPeriodStart ? `${fmtD(sub.currentPeriodStart)} → ${fmtD(periodEnd)}` : "—"}</strong></div>
              <div><div className="text-xs text-muted-foreground">{cancelled || expired || isTrial ? "Ends on" : "Next billing date"}</div>
                <strong className="text-sm">{fmtD(isTrial || cancelled || expired ? periodEnd : sub.nextBillingDate ?? periodEnd)}</strong></div>
            </div>
            {isTrial && status === "trial" && (
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">Free trial</span><span className="text-muted-foreground">{daysLeft} day{daysLeft === 1 ? "" : "s"} remaining</span></div>
                <Progress aria-label="Free trial progress" value={Math.min(100, Math.max(0, Math.round(((TRIAL_DAYS - daysLeft) / TRIAL_DAYS) * 100)))} />
              </div>
            )}
            <Item variant="muted" size="sm">
              <ItemContent>
                <ItemTitle>Auto-renewal</ItemTitle>
                <ItemDescription>{isTrial ? "Not available during the free trial" : switchOn ? "Your subscription will automatically renew on the next billing date" : "Your subscription will expire and not renew automatically"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={switchOn} aria-label="Auto renewal" disabled={!writable || busy} onCheckedChange={() => flipAuto()} />
              </ItemActions>
            </Item>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/dashboard/billing/plans">{isTrial || expired || cancelled ? "Choose a plan" : "Upgrade plan"}</Link></Button>
              {!isTrial && writable && <Button type="button" variant="outline" disabled={busy} onClick={doRenew}>{cancelled || expired ? "Reactivate" : "Renew now"}</Button>}
              <Button type="button" variant="destructive" disabled={cancelDisabled} onClick={() => setCancelOpen(true)}>{cancelled ? "Cancelled" : "Cancel subscription"}</Button>
            </div>
            {note && <Alert variant={note.danger ? "destructive" : "default"}><AlertDescription>{note.text}</AlertDescription></Alert>}
          </Card>

          <SectionCard title="Usage" contentClassName="flex flex-col gap-4">
            {!usage ? <Skeleton className="h-40" /> : meters.map((m) => {
              const finite = m.limit !== null && m.limit > 0 && m.limit < UNLIMITED
              const over = finite && m.used > (m.limit as number)
              return (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-muted-foreground"><strong className="text-foreground tabular-nums">{m.used.toLocaleString("en-US")}</strong>{" "}
                      {m.limit === null ? "this month" : finite ? `of ${(m.limit as number).toLocaleString("en-US")}` : "of unlimited"}</span>
                  </div>
                  <Progress
                    aria-label={`${m.label} usage`}
                    value={finite ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100)) : 0}
                    className={cn(over && "*:data-[slot=progress-indicator]:bg-destructive")}
                  />
                </div>
              )
            })}
          </SectionCard>
        </section>
      ) : (
        <SectionCard title="No active subscription" description="You are currently on a trial. Choose a plan to start your subscription.">
          <Button asChild><Link href="/dashboard/billing/plans">Browse plans</Link></Button>
        </SectionCard>
      )}

      <SectionCard title="Payment history" description="Invoices for every plan purchase and renewal." contentClassName="px-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Invoice</TableHead><TableHead>Plan</TableHead>
                <TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-right">Download</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || histLoading ? [1, 2, 3].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-10" /></TableCell></TableRow>) :
                payments.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState title="No payment history yet" className="p-4 md:p-6" /></TableCell></TableRow>
                ) : payments.map((p) => {
                  const paid = p.status === "completed" || p.status === "paid"
                  const trialRow = p.amount === 0 && p.description === "Free trial"
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{fmtD(p.paymentDate ?? p.createdAt)}</TableCell>
                      <TableCell>{trialRow ? "Free trial" : p.invoiceNumber || "—"}</TableCell>
                      <TableCell>{p.planName || p.description || "—"}{p.billingPeriod && <span className="text-xs text-muted-foreground"> ({p.billingPeriod === "yearly" ? "Yearly" : "Monthly"})</span>}</TableCell>
                      <TableCell>{METHODS[p.paymentMethod] ?? (p.paymentMethod || "—")}</TableCell>
                      <TableCell className="tabular-nums">{trialRow ? "Free" : money(p.amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} variant={paid ? "default" : p.status === "failed" ? "destructive" : "secondary"}
                          label={paid ? "Paid" : p.status.charAt(0).toUpperCase() + p.status.slice(1)} />
                      </TableCell>
                      <TableCell className="text-right">
                        {p.invoiceNumber && !trialRow && <Button type="button" variant="link" size="sm" aria-label={`Download invoice ${p.invoiceNumber}`} onClick={() => download(p)}>Download</Button>}
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

      <SectionCard title="FAQ" contentClassName="flex flex-col gap-4">
        {FAQ.map(([qn, an]) => (
          <div key={qn}><div className="text-sm font-semibold">{qn}</div><div className="text-sm text-muted-foreground">{an}</div></div>
        ))}
      </SectionCard>

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!busy) setCancelOpen(o) }}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Cancel subscription</DialogTitle>
          <DialogDescription>Are you sure you want to cancel your subscription? Your access will continue until {fmtD(periodEnd)}.</DialogDescription>
          <FormField label="Reason for cancellation (optional)" htmlFor="cancel-reason">
            <Select value={String(reason)} onValueChange={(val) => setReason(val)}>
              <SelectTrigger id="cancel-reason" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => setCancelOpen(false)}>Keep subscription</Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={doCancel}>{busy ? "Cancelling…" : "Cancel subscription"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
