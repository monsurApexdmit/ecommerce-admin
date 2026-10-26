"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { saasBillingApi, type BillingUsage, type Plan, type Subscription, type UpdatePlanPayload } from "@/lib/saasBillingApi"
import { settingsApi } from "@/lib/settingsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

const UNLIMITED = 999999
const TAX_RATE = 0.1

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-50"
const primaryBtn = "inline-flex h-11 items-center justify-center rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40"
const dialogCls = "max-h-[90vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md"

const METHODS = [
  { id: "card", label: "Credit / debit card" },
  { id: "bkash", label: "bKash" },
  { id: "bank", label: "Bank transfer" },
] as const
type Method = (typeof METHODS)[number]["id"]
type Period = "monthly" | "yearly"

const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "")
const featName = (f: unknown): string => (typeof f === "string" ? f : String((f as { name?: string })?.name ?? ""))
const limitLabel = (v?: number | null) => (!v || v >= UNLIMITED ? "Unlimited" : v.toLocaleString("en-US"))

interface CheckoutState { plan: Plan; period: Period; method: Method; email: string; terms: boolean; err: string; busy: boolean }
interface EditState {
  id: number; name: string; desc: string; price: string; users: string; products: string; branches: string
  featured: boolean; feats: string[]; newFeat: string; err: string; saving: boolean
}

export default function PlansPage() {
  const blocked = useModuleGuard("Billing Plans")
  const { formatCurrency } = useCompanySettings()
  const { user } = useSaasAuth()
  const isSuperAdmin = (user?.role as string | undefined) === "super_admin"

  const [plans, setPlans] = useState<Plan[]>([])
  const [sub, setSub] = useState<Subscription | null>(null)
  const [usage, setUsage] = useState<BillingUsage | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>("monthly")
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [co, setCo] = useState<CheckoutState | null>(null)
  const [ed, setEd] = useState<EditState | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await saasBillingApi.getPlans()
      setPlans(Array.isArray(res.data) ? res.data : [])
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to load plans") }
    try {
      const s: any = (await saasBillingApi.getCurrentSubscription()).data
      const live: Subscription | null = s && s.status !== "none" && s.id ? s : null
      setSub(live)
      if (live?.billingPeriod === "yearly") setPeriod("yearly")
    } catch { setSub(null) }
    try { setUsage((await saasBillingApi.getUsage()).data) } catch { setUsage(null) }
  }, [])

  useEffect(() => { (async () => { setLoading(true); await load(); setLoading(false) })() }, [load])

  const money = (cents: number) => formatCurrency((cents || 0) / 100)
  const priceOf = (p: Plan, per: Period) => (per === "yearly" ? p.priceYearly ?? p.price * 10 : p.price)
  const isFree = (p: Plan) => p.price === 0

  const periodEnd = sub?.currentPeriodEnd ?? null
  const pastEnd = !!periodEnd && new Date(periodEnd).getTime() < Date.now()
  const subStatus: "none" | "trial" | "active" | "cancelled" | "expired" = !sub ? "none"
    : sub.status === "cancelled" ? "cancelled"
    : sub.status === "expired" || pastEnd ? "expired"
    : sub.isTrial || sub.status === "trialing" ? "trial" : "active"
  const curPlan = plans.find((p) => p.id === sub?.planId) ?? null
  const rank = (id?: number) => plans.findIndex((p) => p.id === id)

  const banner = useMemo(() => {
    const dl = sub?.daysRemaining ?? 0
    if (subStatus === "trial") return { cls: "bg-dash-success-soft text-dash-success-fg", t: "Free trial active.", x: `${dl} day${dl === 1 ? "" : "s"} remaining • Select a plan below to upgrade.` }
    if (subStatus === "cancelled") return { cls: "bg-dash-warn-soft text-dash-warn-fg", t: "Subscription cancelled.", x: `Access continues until ${fmtD(periodEnd)}. Pick a plan to resubscribe.` }
    if (subStatus === "expired") return { cls: "bg-dash-danger-soft text-dash-danger-fg", t: "Subscription expired.", x: "Choose a plan to regain access." }
    if (subStatus === "none") return { cls: "bg-dash-neutral-soft text-dash-neutral-fg", t: "No active plan.", x: "Pick a plan below to get started." }
    return { cls: "bg-dash-success-soft text-dash-success-fg", t: "Active subscription.", x: `Current plan: ${curPlan?.name ?? sub?.planName ?? "No active plan"}${periodEnd ? ` • renews ${fmtD(sub?.nextBillingDate ?? periodEnd)}` : ""}` }
  }, [sub, subStatus, periodEnd, curPlan])

  // ---- checkout ----
  const overLimits = (p: Plan): string[] => {
    if (!usage) return []
    const out: string[] = []
    const chk = (label: string, used: number, limit?: number | null) => { if (limit && limit < UNLIMITED && used > limit) out.push(`${label} (${used.toLocaleString("en-US")} of ${limit.toLocaleString("en-US")})`) }
    chk("team members", usage.teamMembers.used, p.maxUsers)
    chk("products", usage.products.used, p.maxProducts)
    chk("branches", usage.branches.used, p.maxBranches)
    return out
  }

  const openCheckout = (p: Plan) => {
    setCo({ plan: p, period: isFree(p) ? "monthly" : period, method: "card", email: "", terms: false, err: "", busy: false })
    // prefill: store email (general settings), falling back to the billing contact
    const fill = (em?: string) => { if (em) setCo((c) => (c && !c.email ? { ...c, email: em } : c)) }
    settingsApi.getGeneral().then((r) => r?.data?.storeEmail?.trim() || "").catch(() => "").then(async (em) => {
      if (em) return fill(em)
      try { fill((await saasBillingApi.getBillingContact())?.data?.email) } catch { /* ignore */ }
    })
  }

  const confirmCheckout = async () => {
    if (!co || co.busy) return
    const paid = !isFree(co.plan)
    if (paid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(co.email.trim())) { setCo({ ...co, err: "Enter a valid billing email." }); return }
    if (!co.terms) { setCo({ ...co, err: "Please accept the terms to continue." }); return }
    setCo({ ...co, busy: true, err: "" })
    const payload = { planId: co.plan.id, billingPeriod: co.period, paymentMethod: co.method, billingEmail: co.email.trim() || undefined }
    try {
      if (sub && sub.planId === co.plan.id) {
        await saasBillingApi.renewSubscription({ subscriptionId: sub.id, billingPeriod: co.period, paymentMethod: co.method, billingEmail: payload.billingEmail, autoRenew: true })
      } else if (sub) {
        await saasBillingApi.changePlan(payload)
      } else {
        await saasBillingApi.subscribeToPlan(payload)
      }
      toast.success(isFree(co.plan) ? "Free trial started" : `Subscribed to ${co.plan.name}`)
      setCo(null)
      await load()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Payment failed. Please try again."
      setCo((c) => (c ? { ...c, busy: false, err: msg } : c))
    }
  }

  // ---- edit plan (platform admins) ----
  const openEdit = (p: Plan) => setEd({
    id: p.id, name: p.name, desc: p.description || "", price: String(p.price / 100), users: String(p.maxUsers ?? 0), products: String(p.maxProducts ?? 0),
    branches: String(p.maxBranches ?? 0), featured: !!p.isFeatured, feats: (p.features || []).map(featName).filter(Boolean), newFeat: "", err: "", saving: false,
  })
  const setE = (patch: Partial<EditState>) => setEd((e) => (e ? { ...e, ...patch, err: "" } : e))

  const saveEdit = async () => {
    if (!ed) return
    const name = ed.name.trim(), price = Number(ed.price)
    const ints = [ed.users, ed.products, ed.branches].map(Number)
    const fail = (err: string) => setEd({ ...ed, err })
    if (!name) return fail("Plan name is required.")
    if (plans.some((p) => p.id !== ed.id && p.name.toLowerCase() === name.toLowerCase())) return fail("Another plan already uses this name.")
    if (ed.price === "" || !isFinite(price) || price < 0) return fail("Price must be zero or more.")
    if (ints.some((n) => !Number.isInteger(n) || n < 0)) return fail("Limits must be whole numbers (0 or more).")
    setEd({ ...ed, saving: true, err: "" })
    const payload: UpdatePlanPayload = { name, description: ed.desc.trim(), price, maxUsers: ints[0], maxProducts: ints[1], maxBranches: ints[2], features: ed.feats, isFeatured: ed.featured }
    try {
      const res = await saasBillingApi.updatePlan(ed.id, payload)
      setPlans((ps) => ps.map((p) => (p.id === ed.id ? { ...p, ...(res.data as Plan) } : p)))
      setEd(null)
      toast.success("Plan updated")
    } catch (e: any) { setEd((x) => (x ? { ...x, saving: false, err: e?.response?.data?.message || "Failed to update plan" } : x)) }
  }

  // ---- compare table ----
  const featUnion = useMemo(() => {
    const out: string[] = []
    plans.forEach((p) => (p.features || []).map(featName).forEach((f) => { if (f && !out.includes(f)) out.push(f) }))
    return out
  }, [plans])

  if (blocked) return blocked

  const curId = sub && subStatus !== "expired" ? sub.planId : null
  // the trial is locked only once a PAID plan has existed (a mere trial does not lock it)
  const paidEver = !!sub && !(sub.isTrial || sub.status === "trialing" || curPlan?.price === 0)

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Choose your plan</h1>
          <p className="mt-1 max-w-2xl text-sm text-dash-muted">Start with a free trial or pick a plan that scales with your business. All plans include a 30-day money-back guarantee.</p>
        </div>
        <Link href="/dashboard/billing/subscriptions" className={outlineBtn}>My subscription</Link>
      </div>

      {!loading && <div role="status" className={cn("rounded-[10px] px-4 py-3 text-[13px]", banner.cls)}><strong>{banner.t}</strong> <span>{banner.x}</span></div>}

      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-[10px] bg-dash-neutral-soft p-1">
          {([["monthly", "Monthly"], ["yearly", "Yearly · 2 months free"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={period === id} onClick={() => setPeriod(id)}
              className={cn("h-9 rounded-lg px-3.5 text-[13px] font-semibold", period === id ? "bg-dash-card shadow-sm" : "text-dash-muted")}>{label}</button>
          ))}
        </div>
        <span className="text-xs text-dash-muted">Prices exclude {Math.round(TAX_RATE * 100)}% tax added at checkout.</span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[440px] rounded-[14px]" />)}</div>
      ) : plans.length === 0 ? (
        <div className="rounded-[14px] border border-dash-border bg-dash-card p-10 text-center">
          <div className="font-semibold">No plans available</div>
          <div className="text-sm text-dash-muted">Please contact support for assistance.</div>
        </div>
      ) : (
        <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.map((p) => {
            const free = isFree(p), isCur = curId === p.id, popular = !!p.isFeatured
            const feats = (p.features || []).map(featName).filter(Boolean)
            const open = !!expanded[p.id]
            const shown = open ? feats : feats.slice(0, 5)
            const trialLocked = free && paidEver && !isCur
            const dis = isCur || trialLocked
            const price = free ? 0 : priceOf(p, period)
            const cta = isCur ? "Current plan" : trialLocked ? "Trial already used" : free ? "Start free trial"
              : subStatus === "expired" || subStatus === "none" ? "Get started" : rank(p.id) > rank(sub?.planId) ? "Upgrade" : "Switch plan"
            return (
              <article key={p.id} className={cn("relative flex flex-col gap-4 rounded-[14px] bg-dash-card p-6", popular ? "border-2 border-dash-accent shadow-lg" : isCur ? "border-2 border-dash-success" : "border border-dash-border")}>
                {popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-dash-accent px-3 py-1 text-[11px] font-bold tracking-wide text-white">MOST POPULAR</span>}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isCur && <span className="mb-1.5 inline-block rounded-full bg-dash-success-soft px-2.5 py-[3px] text-[11px] font-bold text-dash-success-fg">Current plan</span>}
                    <h2 className="font-dash-display text-2xl font-bold">{p.name}</h2>
                  </div>
                  {isSuperAdmin && (
                    <button type="button" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)} className="flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"><Pencil className="size-4" /></button>
                  )}
                </div>
                <p className="min-h-10 text-[13px] text-dash-muted">{p.description}</p>
                <div>
                  <span className="font-dash-display text-4xl font-bold tabular-nums">{free ? "Free" : money(price)}</span>{" "}
                  <span className="text-sm text-dash-muted">{free ? "· 10-day trial" : period === "yearly" ? "/ year" : "/ month"}</span>
                  {!free && period === "yearly" && <div className="text-xs font-semibold text-dash-success-fg">Save {money(p.price * 12 - price)} vs monthly</div>}
                </div>
                <button type="button" disabled={dis} onClick={() => openCheckout(p)}
                  className={cn("h-11 rounded-[10px] text-sm font-semibold disabled:cursor-not-allowed", dis ? "bg-dash-border text-dash-muted" : popular ? "bg-dash-accent text-white" : "bg-dash-ink text-dash-card")}>{cta}</button>
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Limits</div>
                  <div className="flex flex-col gap-1 text-[13px]">
                    <span><strong>{limitLabel(p.maxUsers)}</strong> team members</span>
                    <span><strong>{limitLabel(p.maxProducts)}</strong> products</span>
                    <span><strong>{limitLabel(p.maxBranches)}</strong> branches</span>
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Features</div>
                  <ul className="flex flex-col gap-1.5 text-[13px]">
                    {shown.map((f, i) => <li key={`${f}-${i}`} className="flex gap-2"><span aria-hidden className="text-dash-success">&#10003;</span><span>{f}</span></li>)}
                  </ul>
                  {feats.length > 5 && (
                    <button type="button" onClick={() => setExpanded({ ...expanded, [p.id]: !open })} className="mt-2 text-xs font-semibold text-dash-accent hover:underline">
                      {open ? "Show less" : `+ ${feats.length - 5} more features`}
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {!loading && plans.length > 0 && (
        <section className="rounded-[14px] border border-dash-border bg-dash-card">
          <div className="p-5 pb-3"><h2 className="font-dash-display text-lg font-bold">Compare plans</h2></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-5 pr-2 font-semibold">Feature</th>
                  {plans.map((p) => (
                    <th key={p.id} className={cn("px-2 py-3 font-semibold", p.id === sub?.planId && "bg-dash-accent-soft/50")}>
                      <div className="text-dash-ink">{p.name}</div>
                      <div className="font-normal">{isFree(p) ? "Free" : `${money(priceOf(p, period))}${period === "yearly" ? "/yr" : "/mo"}`}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Team members", (p: Plan) => limitLabel(p.maxUsers)],
                  ["Products", (p: Plan) => limitLabel(p.maxProducts)],
                  ["Branches", (p: Plan) => limitLabel(p.maxBranches)],
                  ...featUnion.map((f) => [f, (p: Plan) => ((p.features || []).map(featName).includes(f) ? "✓" : "—")] as [string, (p: Plan) => string]),
                ].map(([name, fn]) => (
                  <tr key={name as string}>
                    <td className="border-b border-dash-border-soft py-2.5 pl-5 pr-2">{name as string}</td>
                    {plans.map((p) => {
                      const v = (fn as (p: Plan) => string)(p)
                      return <td key={p.id} className={cn("border-b border-dash-border-soft px-2 py-2.5", v === "—" && "text-dash-muted/50", p.id === sub?.planId && "bg-dash-accent-soft/50")}>{v}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Checkout */}
      <Dialog open={!!co} onOpenChange={(o) => { if (!o && !co?.busy) setCo(null) }}>
        <DialogContent className={dialogCls}>
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

      {/* Edit plan (platform admins only) */}
      <Dialog open={!!ed} onOpenChange={(o) => { if (!o && !ed?.saving) setEd(null) }}>
        <DialogContent className={dialogCls}>
          {ed && (
            <>
              <DialogTitle className="font-dash-display text-xl font-bold">Edit plan: {plans.find((p) => p.id === ed.id)?.name}</DialogTitle>
              <DialogDescription className="text-[13px]">Update plan details, pricing, limits, and features.</DialogDescription>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Plan name *
                <input className={input} value={ed.name} onChange={(e) => setE({ name: e.target.value })} placeholder="e.g. Professional" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Description
                <textarea rows={2} className="rounded-[10px] border border-dash-border bg-dash-card px-3 py-2 text-sm font-normal outline-none focus-visible:border-dash-accent" value={ed.desc} onChange={(e) => setE({ desc: e.target.value })} placeholder="Short description of the plan" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Price (per month)
                <input type="number" step="0.01" min={0} className={input} value={ed.price} onChange={(e) => setE({ price: e.target.value })} placeholder="e.g. 149" />
                <span className="text-xs font-normal text-dash-muted">Yearly price is 10 times the monthly price (2 months free).</span></label>
              <div className="grid grid-cols-3 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Max team members<input type="number" min={0} className={input} value={ed.users} onChange={(e) => setE({ users: e.target.value })} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Max products<input type="number" min={0} className={input} value={ed.products} onChange={(e) => setE({ products: e.target.value })} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Max branches<input type="number" min={0} className={input} value={ed.branches} onChange={(e) => setE({ branches: e.target.value })} /></label>
              </div>
              <span className="-mt-1 text-xs text-dash-muted">999999 means unlimited.</span>
              <label className="flex items-center gap-2 text-[13px] font-semibold"><input type="checkbox" checked={ed.featured} onChange={(e) => setE({ featured: e.target.checked })} />Mark as &quot;Most popular&quot;</label>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-semibold">Features</span>
                {ed.feats.map((f, i) => (
                  <div key={`${f}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-dash-bg px-3 py-2 text-[13px]">
                    <span>{f}</span>
                    <button type="button" aria-label="Remove feature" onClick={() => setE({ feats: ed.feats.filter((_, j) => j !== i) })} className="text-dash-danger">&times;</button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <input className={input} value={ed.newFeat} onChange={(e) => setEd({ ...ed, newFeat: e.target.value })} placeholder="Add new feature..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = ed.newFeat.trim(); if (t) setE({ feats: [...ed.feats, t], newFeat: "" }) } }} />
                  <button type="button" className={outlineBtn} onClick={() => { const t = ed.newFeat.trim(); if (t) setE({ feats: [...ed.feats, t], newFeat: "" }) }}>Add</button>
                </div>
              </div>
              {ed.err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{ed.err}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={ed.saving} onClick={() => setEd(null)} className={outlineBtn}>Cancel</button>
                <button type="button" disabled={ed.saving} onClick={saveEdit} className={primaryBtn}>{ed.saving ? "Saving…" : "Save changes"}</button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
