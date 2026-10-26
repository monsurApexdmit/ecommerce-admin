"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { saasBillingApi, type BillingUsage, type PaymentRecord, type Plan, type Subscription } from "@/lib/saasBillingApi"
import { settingsApi } from "@/lib/settingsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const UNLIMITED = 999999
const TAX_RATE = 0.1

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:cursor-not-allowed disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const card = "rounded-[14px] border border-dash-border bg-dash-card"

const METHODS = [
  { id: "card", label: "Credit / debit card" },
  { id: "bkash", label: "bKash" },
  { id: "bank", label: "Bank transfer" },
] as const
type Method = (typeof METHODS)[number]["id"]
type Period = "monthly" | "yearly"

const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const featName = (f: unknown): string => (typeof f === "string" ? f : String((f as { name?: string })?.name ?? ""))
const limitLabel = (v?: number | null) => (!v || v >= UNLIMITED ? "Unlimited" : v.toLocaleString("en-US"))

interface Checkout { plan: Plan; period: Period; method: Method; email: string; terms: boolean; err: string; busy: boolean }

export default function PlanBillingPage() {
  const blocked = useModuleGuard("Subscriptions")
  const { formatCurrency } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const writable = canWrite("Subscriptions")

  const [plans, setPlans] = useState<Plan[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [invoices, setInvoices] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<{ plan?: number; period?: Period; auto?: boolean }>({})
  const [co, setCo] = useState<Checkout | null>(null)

  const money = (cents: number) => formatCurrency((cents || 0) / 100)

  const load = useCallback(async () => {
    try {
      const res = await saasBillingApi.getPlans()
      setPlans(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to load plans") }
    try {
      const s: any = (await saasBillingApi.getCurrentSubscription()).data
      setSub(s && s.status !== "none" && s.id ? (s as Subscription) : null)
    } catch { setSub(null) }
    try { setUsage((await saasBillingApi.getUsage()).data) } catch { setUsage(null) }
    try {
      const r = await saasBillingApi.getPaymentHistory(1, 50)
      setInvoices((r.data.payments || []).filter((p) => p.amount > 0 && !!p.invoiceNumber))
    } catch { setInvoices([]) }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false) })() }, [load])

  // ---- derived state ----
  const periodEnd = sub?.currentPeriodEnd ?? null
  const pastEnd = !!periodEnd && new Date(periodEnd).getTime() < Date.now()
  const isTrial = !!sub && (sub.isTrial || sub.status === "trialing")
  const status: "none" | "trial" | "active" | "cancelled" | "expired" = !sub ? "none"
    : sub.status === "cancelled" ? "cancelled"
    : sub.status === "expired" || pastEnd ? "expired"
    : isTrial ? "trial" : "active"
  const curId = sub && status !== "expired" ? sub.planId : null
  const curPlan = plans.find((p) => p.id === sub?.planId) ?? null
  const rank = (id?: number | null) => plans.findIndex((p) => p.id === id)
  const paidEver = !!sub && !isTrial
  const isFree = (p: Plan) => p.price === 0
  const priceOf = (p: Plan, per: Period) => (per === "yearly" ? p.priceYearly ?? p.price * 10 : p.price)

  const savedPeriod: Period = sub?.billingPeriod === "yearly" ? "yearly" : "monthly"
  const savedAuto = !!sub?.autoRenew && status === "active"
  const periodSavable = status === "active" // paid + live
  const dPlan = draft.plan ?? curId
  const dPeriod = draft.period ?? savedPeriod
  const dAuto = draft.auto ?? savedAuto
  const planChanged = draft.plan !== undefined && draft.plan !== curId
  const periodChanged = periodSavable && dPeriod !== savedPeriod
  const autoChanged = periodSavable && dAuto !== savedAuto
  const dirty = planChanged || periodChanged || autoChanged
  const dPlanObj = plans.find((p) => p.id === dPlan) ?? null

  const meters = usage ? [
    { label: "Team members", used: usage.teamMembers.used, limit: usage.teamMembers.limit as number | null },
    { label: "Products", used: usage.products.used, limit: usage.products.limit as number | null },
    { label: "Locations", used: usage.branches.used, limit: usage.branches.limit as number | null },
    { label: "Sales this month", used: usage.salesThisMonth, limit: null as number | null },
  ] : []
  const overAny = meters.some((m) => m.limit !== null && m.limit < UNLIMITED && m.limit > 0 && m.used > m.limit)

  const STATUS_PILL = {
    none: { label: "No plan", cls: "bg-dash-neutral-soft text-dash-neutral-fg", border: "border-dash-border" },
    trial: { label: "Trial", cls: "bg-dash-accent-soft text-dash-accent-fg", border: "border-dash-accent" },
    active: { label: "Active", cls: "bg-dash-success-soft text-dash-success-fg", border: "border-dash-accent" },
    cancelled: { label: "Cancelled", cls: "bg-dash-danger-soft text-dash-danger-fg", border: "border-dash-danger-soft" },
    expired: { label: "Expired", cls: "bg-dash-neutral-soft text-dash-neutral-fg", border: "border-dash-border" },
  }[status]

  let note: { cls: string; title: string; text: string }
  if (!sub) note = { cls: "bg-dash-neutral-soft text-dash-neutral-fg", title: "No active plan.", text: "Pick a plan below to get started." }
  else if (status === "cancelled") note = { cls: "bg-dash-danger-soft text-dash-danger-fg", title: "Plan cancelled.", text: `Access continues until ${fmtD(periodEnd)}. Renew to reactivate the ${sub.planName} plan.` }
  else if (status === "expired") note = { cls: "bg-dash-danger-soft text-dash-danger-fg", title: "Plan expired.", text: `Expired on ${fmtD(periodEnd)}. Choose a plan to regain access.` }
  else if (!sub.currentPeriodStart || !periodEnd) note = { cls: "bg-dash-danger-soft text-dash-danger-fg", title: "Billing date missing.", text: "No subscription start date is saved. Renew once to set it." }
  else if (isTrial) note = { cls: "bg-dash-neutral-soft text-dash-neutral-fg", title: `Trial ends on ${fmtD(periodEnd)}.`, text: `Started ${fmtD(sub.currentPeriodStart)}.` }
  else note = { cls: "bg-dash-neutral-soft text-dash-neutral-fg", title: `Renews on ${fmtD(sub.nextBillingDate ?? periodEnd)}.`, text: overAny ? "You are over a plan limit — consider upgrading." : `Started ${fmtD(sub.currentPeriodStart)}.` }

  const basePrice = isTrial ? 0 : sub?.periodPrice ?? sub?.price ?? 0

  const featUnion = useMemo(() => {
    const out: string[] = []
    plans.forEach((p) => (p.features || []).map(featName).forEach((f) => { if (f && !out.includes(f)) out.push(f) }))
    return out
  }, [plans])

  // ---- actions ----
  const overLimits = (p: Plan): string[] => {
    if (!usage) return []
    const out: string[] = []
    const chk = (label: string, used: number, limit?: number | null) => { if (limit && limit < UNLIMITED && used > limit) out.push(`${label} (${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")})`) }
    chk("team members", usage.teamMembers.used, p.maxUsers)
    chk("products", usage.products.used, p.maxProducts)
    chk("branches", usage.branches.used, p.maxBranches)
    return out
  }

  const discard = () => { if (!dirty) return; setDraft({}); toast("Changes discarded") }

  const openCheckout = (p: Plan) => {
    setCo({ plan: p, period: isFree(p) ? "monthly" : dPeriod, method: "card", email: "", terms: false, err: "", busy: false })
    const fill = (em?: string) => { if (em) setCo((c) => (c && !c.email ? { ...c, email: em } : c)) }
    settingsApi.getGeneral().then((r) => r?.data?.storeEmail?.trim() || "").catch(() => "").then(async (em) => {
      if (em) return fill(em)
      try { fill((await saasBillingApi.getBillingContact())?.data?.email) } catch { /* ignore */ }
    })
  }

  const save = async () => {
    if (!dirty) { toast("No changes to save"); return }
    if (!writable || busy) return
    if (planChanged && dPlanObj) { openCheckout(dPlanObj); return }
    if (!sub) return
    setBusy(true)
    try {
      if (periodChanged) await saasBillingApi.setBillingPeriod(sub.id, dPeriod)
      if (autoChanged) await saasBillingApi.setAutoRenew(sub.id, dAuto)
      toast.success("Billing preferences saved")
      setDraft({})
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Could not save billing preferences") } finally { setBusy(false) }
  }

  const confirmCheckout = async () => {
    if (!co || co.busy) return
    const paid = !isFree(co.plan)
    if (paid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(co.email.trim())) { setCo({ ...co, err: "Enter a valid billing email." }); return }
    if (!co.terms) { setCo({ ...co, err: "Please accept the terms to continue." }); return }
    setCo({ ...co, busy: true, err: "" })
    const payload = { planId: co.plan.id, billingPeriod: co.period, paymentMethod: co.method, billingEmail: co.email.trim() || undefined }
    try {
      if (sub) await saasBillingApi.changePlan(payload)
      else await saasBillingApi.subscribeToPlan(payload)
      // a plan switch turns auto-renew on; honour an explicit "off" choice
      if (paid && !dAuto) {
        try {
          const fresh: any = (await saasBillingApi.getCurrentSubscription()).data
          if (fresh?.id) await saasBillingApi.setAutoRenew(fresh.id, false)
        } catch { /* keep default */ }
      }
      toast.success(`Plan changed to ${co.plan.name}`)
      setCo(null); setDraft({})
      await load()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Payment failed. Please try again."
      setCo((c) => (c ? { ...c, busy: false, err: msg } : c))
    }
  }

  const renew = async () => {
    if (!sub || isTrial || busy || !writable) return
    const early = status === "active" && !!periodEnd && (new Date(periodEnd).getTime() - Date.now()) / 864e5 > 7
    const verb = status === "cancelled" || status === "expired" ? "Reactivate" : "Renew"
    const totalCents = Math.round(basePrice * (1 + TAX_RATE))
    if (!window.confirm(`${early ? `Your plan is paid until ${fmtD(periodEnd)}. ` : ""}${verb} ${sub.planName} for ${money(totalCents)} (incl. 10% tax)?`)) return
    setBusy(true)
    try {
      await saasBillingApi.renewSubscription({ subscriptionId: sub.id, billingPeriod: sub.billingPeriod, autoRenew: true })
      toast.success(verb === "Renew" ? "Plan renewed" : "Plan reactivated")
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to renew plan") } finally { setBusy(false) }
  }

  if (blocked) return blocked

  const canCancel = !!sub && status === "active" && !isTrial
  const statusText = dirty
    ? `You have unsaved changes${planChanged && dPlanObj ? ` — plan will switch to ${dPlanObj.name}.` : "."}`
    : "All changes saved."

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Plan &amp; billing</h1>
          <p className="mt-1 text-sm text-dash-muted">Your subscription, usage and invoices.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/billing/plans" className={outlineBtn}>Plans</Link>
          <Link href="/dashboard/billing/subscriptions" className={outlineBtn}>Subscriptions</Link>
          <Link href="/dashboard/company/billing-contact" className={outlineBtn}>Billing contact</Link>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-[300px] rounded-[14px]" /><Skeleton className="h-[300px] rounded-[14px]" /></div>
      ) : (
        <section className={cn(card, "grid gap-6 border-2 p-6 lg:grid-cols-2", STATUS_PILL.border)}>
          <div className="flex flex-col gap-2">
            <span className={cn("self-start rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS_PILL.cls)}>{STATUS_PILL.label}</span>
            <h2 className="font-dash-display text-[28px] font-bold">{sub?.planName ?? "No plan"}</h2>
            {sub && (
              <span className="text-sm text-dash-muted">
                <strong className="text-[22px] text-dash-ink tabular-nums">{isTrial ? "Free" : money(basePrice)}</strong>{" "}
                {isTrial ? "· 10-day trial" : sub.billingPeriod === "yearly" ? "/ year · billed yearly" : "/ month · billed monthly"}
              </span>
            )}
            <div className={cn("rounded-[10px] px-3 py-2.5 text-[13px]", note.cls)}><strong>{note.title}</strong> {note.text}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {sub && !isTrial && writable && (
                <button type="button" disabled={busy} onClick={renew} className={primaryBtn}>{status === "cancelled" || status === "expired" ? "Reactivate" : "Renew now"}</button>
              )}
              <a href="#compare-plans" className={outlineBtn}>Change plan</a>
              {canCancel && writable && (
                <Link href="/dashboard/billing/subscriptions?cancel=1" className="inline-flex h-11 items-center px-3 text-sm font-semibold text-dash-danger hover:underline">Cancel plan</Link>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-bold">Usage this month</h3>
            {!usage ? <Skeleton className="h-32 rounded-lg" /> : meters.map((m) => {
              const finite = m.limit !== null && m.limit > 0 && m.limit < UNLIMITED
              const over = finite && m.used > (m.limit as number)
              return (
                <div key={m.label}>
                  <div className="flex justify-between text-sm"><span>{m.label}</span>
                    <span className="text-dash-muted"><strong className="text-dash-ink tabular-nums">{m.used.toLocaleString("en-US")}</strong>{" "}
                      {m.limit === null ? "this month" : finite ? `of ${(m.limit as number).toLocaleString("en-US")}` : "of unlimited"}</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-dash-neutral-soft">
                    <div className={cn("h-full rounded-full", over ? "bg-dash-danger" : "bg-dash-accent")} style={{ width: `${finite ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100)) : 0}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="flex items-center justify-between gap-4 rounded-xl border border-dash-border p-3">
              <span className="flex flex-col"><span className="font-semibold">Auto-renew</span>
                <span className="text-xs text-dash-muted">{!periodSavable ? "Available on an active paid plan" : dAuto ? "Renews automatically each period" : "You will renew manually"}</span></span>
              <button type="button" role="switch" aria-checked={dAuto} aria-label="Auto renew" disabled={!periodSavable || !writable}
                onClick={() => setDraft({ ...draft, auto: !dAuto })}
                className={cn("flex h-[22px] w-10 shrink-0 items-center rounded-full p-[3px] disabled:opacity-50", dAuto ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></button>
            </div>
          </div>
        </section>
      )}

      <section id="compare-plans" className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dash-border-soft p-5">
          <h2 className="font-dash-display text-lg font-bold">Compare plans</h2>
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-[10px] bg-dash-neutral-soft p-[3px]">
            {([["monthly", "Monthly"], ["yearly", "Yearly · 2 months free"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={dPeriod === id} onClick={() => setDraft({ ...draft, period: id })}
                className={cn("h-9 rounded-lg px-3.5 text-[13px] font-semibold", dPeriod === id ? "bg-dash-card shadow-sm" : "text-dash-muted")}>{label}</button>
            ))}
          </div>
        </div>
        {loading ? <div className="p-5"><Skeleton className="h-60 rounded-lg" /></div> : plans.length === 0 ? (
          <div className="p-10 text-center text-sm text-dash-muted">No plans available. Please contact support.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-dash-muted">
                  <th className="px-5 py-4 align-bottom font-semibold">Plan</th>
                  {plans.map((p) => {
                    const isCur = p.id === curId
                    const isSel = p.id === dPlan && !isCur
                    return (
                      <th key={p.id} className={cn("px-2.5 py-4 align-top", isCur ? "bg-dash-accent-soft/50" : isSel && "bg-dash-success-soft/40")}>
                        {(isCur || p.isFeatured) && <span className={cn("mb-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold", isCur ? "bg-dash-ink text-dash-card" : "bg-dash-success-soft text-dash-success-fg")}>{isCur ? "Your plan" : "Most popular"}</span>}
                        <div className="text-base font-bold text-dash-ink">{p.name}</div>
                        <div className="mt-1 text-xl font-bold text-dash-ink tabular-nums">{isFree(p) ? "Free" : money(priceOf(p, dPeriod))}
                          <span className="text-xs font-medium text-dash-muted">{isFree(p) ? " · 10 days" : dPeriod === "yearly" ? " /year" : " /month"}</span></div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {([
                  ["Team members", (p: Plan) => limitLabel(p.maxUsers)],
                  ["Products", (p: Plan) => limitLabel(p.maxProducts)],
                  ["Branches", (p: Plan) => limitLabel(p.maxBranches)],
                  ...featUnion.map((f) => [f, (p: Plan) => ((p.features || []).map(featName).includes(f) ? "✓" : "—")] as [string, (p: Plan) => string]),
                ] as [string, (p: Plan) => string][]).map(([name, fn]) => (
                  <tr key={name}>
                    <td className="border-t border-dash-border-soft px-5 py-2.5 text-dash-muted">{name}</td>
                    {plans.map((p) => {
                      const v = fn(p)
                      return <td key={p.id} className={cn("border-t border-dash-border-soft px-2.5 py-2.5 font-semibold", v === "—" && "font-normal text-dash-muted/50", p.id === curId ? "bg-dash-accent-soft/50" : p.id === dPlan && "bg-dash-success-soft/40")}>{v}</td>
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="px-5 py-3.5" />
                  {plans.map((p) => {
                    const isCur = p.id === curId
                    const isSel = p.id === dPlan && !isCur
                    const trialLocked = isFree(p) && paidEver && !isCur
                    const cta = isCur ? "Current plan" : trialLocked ? "Trial used" : isSel ? "Selected"
                      : curId === null ? "Select" : rank(p.id) > rank(curId) ? "Upgrade" : "Downgrade"
                    return (
                      <td key={p.id} className={cn("px-2.5 py-3.5", isCur ? "bg-dash-accent-soft/50" : isSel && "bg-dash-success-soft/40")}>
                        <button type="button" disabled={isCur || trialLocked || !writable}
                          onClick={() => setDraft({ ...draft, plan: isSel ? undefined : p.id })}
                          className={cn("h-10 w-full rounded-[10px] text-[13px] font-bold disabled:cursor-not-allowed",
                            isCur || trialLocked ? "bg-dash-border text-dash-muted" : isSel ? "border-2 border-dash-accent bg-dash-accent-soft" : "border border-dash-border bg-dash-card hover:bg-dash-neutral-soft")}>{cta}</button>
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cn(card, "flex flex-col gap-4 p-6")}>
        <div>
          <h2 className="font-dash-display text-lg font-bold">Payment history</h2>
          <p className="mt-1 text-[13px] text-dash-muted">Invoices for your subscription.</p>
        </div>
        {loading ? <Skeleton className="h-24 rounded-lg" /> : invoices.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-dash-border p-7 text-center text-sm text-dash-muted">No invoices yet — your first invoice will appear here after renewal or a plan change.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="px-3.5 py-2.5 font-semibold">Invoice</th><th className="px-3.5 py-2.5 font-semibold">Date</th><th className="px-3.5 py-2.5 font-semibold">Plan</th>
                  <th className="px-3.5 py-2.5 font-semibold">Period</th><th className="px-3.5 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((p) => (
                  <tr key={p.id}>
                    <td className="border-t border-dash-border-soft px-3.5 py-2.5 font-semibold">{p.invoiceNumber}</td>
                    <td className="border-t border-dash-border-soft px-3.5 py-2.5">{fmtD(p.paymentDate ?? p.createdAt)}</td>
                    <td className="border-t border-dash-border-soft px-3.5 py-2.5">{p.planName || "—"}</td>
                    <td className="border-t border-dash-border-soft px-3.5 py-2.5">{p.billingPeriod === "yearly" ? "Yearly" : "Monthly"}</td>
                    <td className="border-t border-dash-border-soft px-3.5 py-2.5 text-right font-bold tabular-nums">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2.5 rounded-[14px] border border-dash-border bg-dash-card px-4 py-3.5 shadow-[0_-6px_20px_rgba(14,21,37,0.06)]">
        <span className="text-[13px] text-dash-muted">{statusText}</span>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={discard} disabled={!dirty || busy} className={outlineBtn}>Discard</button>
          <button type="button" onClick={save} disabled={!dirty || busy || !writable} className={primaryBtn}>{busy ? "Saving…" : "Save changes"}</button>
        </div>
      </div>

      <Dialog open={!!co} onOpenChange={(o) => { if (!o && !co?.busy) setCo(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          {co && (() => {
            const free = isFree(co.plan)
            const sub0 = free ? 0 : priceOf(co.plan, co.period)
            const tax = Math.round(sub0 * TAX_RATE)
            const over = overLimits(co.plan)
            return (
              <>
                <DialogTitle className="font-dash-display text-xl font-bold">{free ? "Start your free trial" : `Confirm ${co.plan.name} plan`}</DialogTitle>
                <DialogDescription className="text-[13px]">Review your order, choose how you want to pay and confirm.</DialogDescription>
                <div className="flex flex-col gap-1.5 rounded-[10px] bg-dash-bg p-4 text-sm">
                  <div className="flex justify-between"><span>{co.plan.name} ({free ? "10-day trial" : co.period === "yearly" ? "Yearly" : "Monthly"})</span><span className="tabular-nums">{money(sub0)}</span></div>
                  <div className="flex justify-between text-dash-muted"><span>Tax ({Math.round(TAX_RATE * 100)}%)</span><span className="tabular-nums">{money(tax)}</span></div>
                  <div className="flex justify-between border-t border-dash-border pt-1.5 font-bold"><span>Total</span><span className="tabular-nums">{money(sub0 + tax)}</span></div>
                </div>
                {over.length > 0 && (
                  <div className="rounded-[10px] bg-dash-warn-soft px-3.5 py-2.5 text-[13px] text-dash-warn-fg">
                    You currently exceed this plan&apos;s limits for {over.join(", ")}. Existing data is kept, but you will not be able to add more until you are within the limit.
                  </div>
                )}
                {!free && (
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Payment method
                      <select className={input} value={co.method} onChange={(e) => setCo({ ...co, method: e.target.value as Method, err: "" })}>
                        {METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select></label>
                    <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Billing email *
                      <input type="email" className={input} value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value, err: "" })} placeholder="billing@yourshop.com" /></label>
                  </div>
                )}
                <label className="flex items-start gap-2 text-[13px]">
                  <input type="checkbox" className="mt-0.5" checked={co.terms} onChange={(e) => setCo({ ...co, terms: e.target.checked, err: "" })} />
                  <span>I agree to the terms of service and the 30-day money-back policy.</span>
                </label>
                {co.err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{co.err}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={co.busy} onClick={() => setCo(null)} className={outlineBtn}>Cancel</button>
                  <button type="button" disabled={co.busy} onClick={confirmCheckout} className={primaryBtn}>{co.busy ? "Processing…" : free ? "Start free trial" : `Pay ${money(sub0 + tax)}`}</button>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
