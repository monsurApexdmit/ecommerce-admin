"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { saasBillingApi, type BillingUsage, type PaymentRecord, type Subscription } from "@/lib/saasBillingApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const UNLIMITED = 999999
const TAX_RATE = 0.1
const TRIAL_DAYS = 10

const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:cursor-not-allowed disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const card = "rounded-[14px] border border-dash-border bg-dash-card"

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

  const STATUS_PILL: Record<string, { label: string; cls: string; border: string }> = {
    active: { label: "Active", cls: "bg-dash-success-soft text-dash-success-fg", border: "border-dash-success" },
    trial: { label: "Trial", cls: "bg-dash-accent-soft text-dash-accent-fg", border: "border-dash-accent" },
    cancelled: { label: "Cancelled", cls: "bg-dash-danger-soft text-dash-danger-fg", border: "border-dash-danger-soft" },
    expired: { label: "Expired", cls: "bg-dash-neutral-soft text-dash-neutral-fg", border: "border-dash-border" },
    past_due: { label: "Past due", cls: "bg-dash-warn-soft text-dash-warn-fg", border: "border-dash-warn" },
  }
  const pill = STATUS_PILL[status]

  const meters = usage ? [
    { label: "Team members", used: usage.teamMembers.used, limit: usage.teamMembers.limit as number | null },
    { label: "Products", used: usage.products.used, limit: usage.products.limit as number | null },
    { label: "Locations", used: usage.branches.used, limit: usage.branches.limit as number | null },
    { label: "Sales this month", used: usage.salesThisMonth, limit: null as number | null },
  ] : []
  const overAny = meters.some((m) => m.limit !== null && m.limit < UNLIMITED && m.limit > 0 && m.used > m.limit)

  let note: { cls: string; text: string } | null = null
  if (cancelled) note = { cls: "bg-dash-warn-soft text-dash-warn-fg", text: `Your subscription is cancelled. Access continues until ${fmtD(periodEnd)}.` }
  else if (expired) note = { cls: "bg-dash-danger-soft text-dash-danger-fg", text: `Your subscription expired on ${fmtD(periodEnd)}. Renew to regain access.` }
  else if (overAny) note = { cls: "bg-dash-warn-soft text-dash-warn-fg", text: "You are over a plan limit. Consider upgrading your plan." }

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Subscriptions</h1>
          <p className="mt-1 text-sm text-dash-muted">Manage your subscription and billing details.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/billing/overview" className={outlineBtn}>Billing settings</Link>
          <Link href="/dashboard/billing/plans" className={outlineBtn}>Browse plans</Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]"><Skeleton className="h-[320px] rounded-[14px]" /><Skeleton className="h-[320px] rounded-[14px]" /></div>
      ) : sub ? (
        <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className={cn(card, "flex flex-col gap-4 border-2 p-6", pill.border)}>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-dash-display text-2xl font-bold">{sub.planName} plan</h2>
              <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", pill.cls)}>{pill.label}</span>
            </div>
            <div><strong className="font-dash-display text-4xl font-bold tabular-nums">{isTrial ? "Free" : money(basePrice)}</strong>{" "}
              <span className="text-sm text-dash-muted">{isTrial ? "· 10-day trial" : yearly ? "/ year · billed yearly" : "/ month · billed monthly"}</span></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><div className="text-xs text-dash-muted">Current period</div>
                <strong className="text-sm">{sub.currentPeriodStart ? `${fmtD(sub.currentPeriodStart)} → ${fmtD(periodEnd)}` : "—"}</strong></div>
              <div><div className="text-xs text-dash-muted">{cancelled || expired || isTrial ? "Ends on" : "Next billing date"}</div>
                <strong className="text-sm">{fmtD(isTrial || cancelled || expired ? periodEnd : sub.nextBillingDate ?? periodEnd)}</strong></div>
            </div>
            {isTrial && status === "trial" && (
              <div>
                <div className="mb-1 flex justify-between text-xs"><span className="font-semibold">Free trial</span><span className="text-dash-muted">{daysLeft} day{daysLeft === 1 ? "" : "s"} remaining</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-dash-neutral-soft"><div className="h-full rounded-full bg-dash-accent" style={{ width: `${Math.min(100, Math.max(0, Math.round(((TRIAL_DAYS - daysLeft) / TRIAL_DAYS) * 100)))}%` }} /></div>
              </div>
            )}
            <div className="flex items-center justify-between gap-4 rounded-[10px] bg-dash-bg px-4 py-3">
              <span className="flex flex-col"><span className="text-sm font-semibold">Auto-renewal</span>
                <span className="text-xs text-dash-muted">{isTrial ? "Not available during the free trial" : switchOn ? "Your subscription will automatically renew on the next billing date" : "Your subscription will expire and not renew automatically"}</span></span>
              <button type="button" role="switch" aria-checked={switchOn} aria-label="Auto renewal" disabled={!writable || busy} onClick={flipAuto}
                className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 disabled:opacity-50", switchOn ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/billing/plans" className={primaryBtn}>{isTrial || expired || cancelled ? "Choose a plan" : "Upgrade plan"}</Link>
              {!isTrial && writable && <button type="button" disabled={busy} onClick={doRenew} className={outlineBtn}>{cancelled || expired ? "Reactivate" : "Renew now"}</button>}
              <button type="button" disabled={cancelDisabled} onClick={() => setCancelOpen(true)} className={cn(outlineBtn, "text-dash-danger")}>{cancelled ? "Cancelled" : "Cancel subscription"}</button>
            </div>
            {note && <div className={cn("rounded-[10px] px-4 py-3 text-[13px] font-semibold", note.cls)}>{note.text}</div>}
          </div>

          <div className={cn(card, "flex flex-col gap-4 p-6")}>
            <h3 className="font-dash-display text-lg font-bold">Usage</h3>
            {!usage ? <Skeleton className="h-40 rounded-lg" /> : meters.map((m) => {
              const finite = m.limit !== null && m.limit > 0 && m.limit < UNLIMITED
              const over = finite && m.used > (m.limit as number)
              return (
                <div key={m.label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                    <span className="font-semibold">{m.label}</span>
                    <span className="text-dash-muted"><strong className="text-dash-ink tabular-nums">{m.used.toLocaleString("en-US")}</strong>{" "}
                      {m.limit === null ? "this month" : finite ? `of ${(m.limit as number).toLocaleString("en-US")}` : "of unlimited"}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-dash-neutral-soft">
                    <div className={cn("h-full rounded-full", over ? "bg-dash-danger" : "bg-dash-accent")} style={{ width: `${finite ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100)) : 0}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : (
        <section className={cn(card, "flex flex-col items-start gap-2 p-6")}>
          <h2 className="font-dash-display text-xl font-bold">No active subscription</h2>
          <p className="text-sm text-dash-muted">You are currently on a trial. Choose a plan to start your subscription.</p>
          <Link href="/dashboard/billing/plans" className={cn(primaryBtn, "mt-2")}>Browse plans</Link>
        </section>
      )}

      <section className={card}>
        <div className="p-5 pb-3">
          <h2 className="font-dash-display text-lg font-bold">Payment history</h2>
          <p className="text-xs text-dash-muted">Invoices for every plan purchase and renewal.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th className="py-3 pl-5 pr-2 font-semibold">Date</th><th className="px-2 py-3 font-semibold">Invoice</th><th className="px-2 py-3 font-semibold">Plan</th>
                <th className="px-2 py-3 font-semibold">Method</th><th className="px-2 py-3 font-semibold">Amount</th><th className="px-2 py-3 font-semibold">Status</th>
                <th className="py-3 pl-2 pr-5 text-right font-semibold">Download</th>
              </tr>
            </thead>
            <tbody>
              {loading || histLoading ? [1, 2, 3].map((i) => <tr key={i}><td colSpan={7} className="px-5 py-3"><Skeleton className="h-10 rounded" /></td></tr>) :
                payments.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-dash-muted">No payment history yet</td></tr>
                ) : payments.map((p) => {
                  const paid = p.status === "completed" || p.status === "paid"
                  const trialRow = p.amount === 0 && p.description === "Free trial"
                  return (
                    <tr key={p.id}>
                      <td className="border-b border-dash-border-soft py-3 pl-5 pr-2">{fmtD(p.paymentDate ?? p.createdAt)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 font-semibold">{trialRow ? "Free trial" : p.invoiceNumber || "—"}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">{p.planName || p.description || "—"}{p.billingPeriod && <span className="text-xs text-dash-muted"> ({p.billingPeriod === "yearly" ? "Yearly" : "Monthly"})</span>}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">{METHODS[p.paymentMethod] ?? (p.paymentMethod || "—")}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 tabular-nums">{trialRow ? "Free" : money(p.amount)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", paid ? "bg-dash-success-soft text-dash-success-fg" : p.status === "failed" ? "bg-dash-danger-soft text-dash-danger-fg" : "bg-dash-warn-soft text-dash-warn-fg")}>
                          {paid ? "Paid" : p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                        </span>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-5 text-right">
                        {p.invoiceNumber && !trialRow && <button type="button" aria-label={`Download invoice ${p.invoiceNumber}`} onClick={() => download(p)} className="text-xs font-semibold text-dash-accent hover:underline">Download</button>}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {total > 0 && (
          <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
        )}
      </section>

      <section className={cn(card, "flex flex-col gap-4 p-6")}>
        <h2 className="font-dash-display text-lg font-bold">FAQ</h2>
        {FAQ.map(([qn, an]) => (
          <div key={qn}><div className="text-sm font-semibold">{qn}</div><div className="text-[13px] text-dash-muted">{an}</div></div>
        ))}
      </section>

      <Dialog open={cancelOpen} onOpenChange={(o) => { if (!busy) setCancelOpen(o) }}>
        <DialogContent className="border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogTitle className="font-dash-display text-xl font-bold">Cancel subscription</DialogTitle>
          <DialogDescription className="text-[13px]">Are you sure you want to cancel your subscription? Your access will continue until {fmtD(periodEnd)}.</DialogDescription>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reason for cancellation (optional)
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="h-[42px] rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent">
              {REASONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => setCancelOpen(false)} className={outlineBtn}>Keep subscription</button>
            <button type="button" disabled={busy} onClick={doCancel} className="h-11 rounded-[10px] bg-dash-danger px-4 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Cancelling…" : "Cancel subscription"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
