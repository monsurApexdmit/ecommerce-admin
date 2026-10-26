"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Pencil } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { saasBillingApi, type BillingUsage, type Plan, type Subscription, type UpdatePlanPayload } from "@/lib/saasBillingApi"
import { settingsApi } from "@/lib/settingsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { FormField } from "@/components/common/FormField"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WithTooltip } from "@/components/common/WithTooltip"

const UNLIMITED = 999999
const TAX_RATE = 0.1

const dialogCls = "max-h-[90vh] overflow-y-auto sm:max-w-md"

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
    if (subStatus === "trial") return { danger: false, t: "Free trial active.", x: `${dl} day${dl === 1 ? "" : "s"} remaining • Select a plan below to upgrade.` }
    if (subStatus === "cancelled") return { danger: false, t: "Subscription cancelled.", x: `Access continues until ${fmtD(periodEnd)}. Pick a plan to resubscribe.` }
    if (subStatus === "expired") return { danger: true, t: "Subscription expired.", x: "Choose a plan to regain access." }
    if (subStatus === "none") return { danger: false, t: "No active plan.", x: "Pick a plan below to get started." }
    return { danger: false, t: "Active subscription.", x: `Current plan: ${curPlan?.name ?? sub?.planName ?? "No active plan"}${periodEnd ? ` • renews ${fmtD(sub?.nextBillingDate ?? periodEnd)}` : ""}` }
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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Choose your plan"
        description={<span className="block max-w-2xl">Start with a free trial or pick a plan that scales with your business. All plans include a 30-day money-back guarantee.</span>}
        actions={<Button asChild variant="outline"><Link href="/dashboard/billing/subscriptions">My subscription</Link></Button>}
      />

      {!loading && (
        <Alert role="status" variant={banner.danger ? "destructive" : "default"}>
          <AlertTitle>{banner.t}</AlertTitle>
          <AlertDescription>{banner.x}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Billing period"
          size="default"
          value={period}
          onValueChange={(id) => setPeriod(id as Period)}
          options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly · 2 months free" }]}
        />
        <span className="text-xs text-muted-foreground">Prices exclude {Math.round(TAX_RATE * 100)}% tax added at checkout.</span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[440px]" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState bordered title="No plans available" description="Please contact support for assistance." />
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
              <Card key={p.id} className={cn("relative gap-4 p-6", (popular || isCur) && "border-primary")}>
                {popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">MOST POPULAR</Badge>}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isCur && <Badge variant="secondary" className="mb-1.5">Current plan</Badge>}
                    <h2 className="text-2xl font-bold">{p.name}</h2>
                  </div>
                  {isSuperAdmin && (
                    <WithTooltip content={`Edit ${p.name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${p.name}`} onClick={() => openEdit(p)}><Pencil className="size-4" /></Button></WithTooltip>
                  )}
                </div>
                <p className="min-h-10 text-sm text-muted-foreground">{p.description}</p>
                <div>
                  <span className="text-4xl font-bold tabular-nums">{free ? "Free" : money(price)}</span>{" "}
                  <span className="text-sm text-muted-foreground">{free ? "· 10-day trial" : period === "yearly" ? "/ year" : "/ month"}</span>
                  {!free && period === "yearly" && <div className="text-xs font-semibold text-primary">Save {money(p.price * 12 - price)} vs monthly</div>}
                </div>
                <Button type="button" disabled={dis} onClick={() => openCheckout(p)}
                  variant={popular ? "default" : "outline"}>{cta}</Button>
                <div>
                  <SectionTitle className="mb-2">Limits</SectionTitle>
                  <div className="flex flex-col gap-1 text-sm">
                    <span><strong>{limitLabel(p.maxUsers)}</strong> team members</span>
                    <span><strong>{limitLabel(p.maxProducts)}</strong> products</span>
                    <span><strong>{limitLabel(p.maxBranches)}</strong> branches</span>
                  </div>
                </div>
                <div>
                  <SectionTitle className="mb-2">Features</SectionTitle>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {shown.map((f, i) => <li key={`${f}-${i}`} className="flex gap-2"><span aria-hidden className="text-primary">&#10003;</span><span>{f}</span></li>)}
                  </ul>
                  {feats.length > 5 && (
                    <Button type="button" variant="link" size="sm" onClick={() => setExpanded({ ...expanded, [p.id]: !open })} className="mt-2">
                      {open ? "Show less" : `+ ${feats.length - 5} more features`}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && plans.length > 0 && (
        <SectionCard title="Compare plans" contentClassName="px-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  {plans.map((p) => (
                    <TableHead key={p.id} className={cn("h-auto py-2", p.id === sub?.planId && "bg-muted/50")}>
                      <div>{p.name}</div>
                      <div className="font-normal text-muted-foreground">{isFree(p) ? "Free" : `${money(priceOf(p, period))}${period === "yearly" ? "/yr" : "/mo"}`}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Team members", (p: Plan) => limitLabel(p.maxUsers)],
                  ["Products", (p: Plan) => limitLabel(p.maxProducts)],
                  ["Branches", (p: Plan) => limitLabel(p.maxBranches)],
                  ...featUnion.map((f) => [f, (p: Plan) => ((p.features || []).map(featName).includes(f) ? "✓" : "—")] as [string, (p: Plan) => string]),
                ].map(([name, fn]) => (
                  <TableRow key={name as string}>
                    <TableCell>{name as string}</TableCell>
                    {plans.map((p) => {
                      const v = (fn as (p: Plan) => string)(p)
                      return <TableCell key={p.id} className={cn(v === "—" && "text-muted-foreground", p.id === sub?.planId && "bg-muted/50")}>{v}</TableCell>
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
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
                <DialogTitle>{free ? "Start your free trial" : `Confirm ${co.plan.name} plan`}</DialogTitle>
                <DialogDescription>Review your order, choose how you want to pay and confirm.</DialogDescription>
                <Card className="gap-1.5 bg-muted/50 p-4 shadow-none">
                  <InfoList className="gap-1.5">
                    <InfoRow label={`${co.plan.name} (${free ? "10-day trial" : co.period === "yearly" ? "Yearly" : "Monthly"})`} value={<span className="tabular-nums">{money(sub0)}</span>} />
                    <InfoRow label={`Tax (${Math.round(TAX_RATE * 100)}%)`} value={<span className="tabular-nums">{money(tax)}</span>} />
                  </InfoList>
                  <Separator />
                  <div className="flex justify-between text-sm font-bold"><span>Total</span><span className="tabular-nums">{money(sub0 + tax)}</span></div>
                </Card>
                {over.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      You currently exceed this plan&apos;s limits for {over.join(", ")}. Existing data is kept, but you will not be able to add more until you are within the limit.
                    </AlertDescription>
                  </Alert>
                )}
                {!free && (
                  <div className="flex flex-col gap-3">
                    <FormField label="Payment method" htmlFor="co-method">
                      <Select value={String(co.method)} onValueChange={(val) => setCo({ ...co, method: val as Method, err: "" })}>
                        <SelectTrigger id="co-method" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METHODS.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select></FormField>
                    <FormField label="Billing email *" htmlFor="co-email">
                      <Input id="co-email" type="email" value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value, err: "" })} placeholder="billing@yourshop.com" /></FormField>
                  </div>
                )}
                <FormField orientation="horizontal" label="I agree to the terms of service and the 30-day money-back policy." htmlFor="co-terms"
                  className="flex-row-reverse justify-end [&>[data-slot=field-label]]:flex-none">
                  <Checkbox id="co-terms" checked={co.terms} onCheckedChange={(c) => setCo({ ...co, terms: c === true, err: "" })} />
                </FormField>
                {co.err && <Alert variant="destructive"><AlertDescription>{co.err}</AlertDescription></Alert>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={co.busy} onClick={() => setCo(null)}>Cancel</Button>
                  <Button type="button" disabled={co.busy} onClick={confirmCheckout}>{co.busy ? "Processing…" : free ? "Start free trial" : `Pay ${money(sub0 + tax)}`}</Button>
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
              <DialogTitle>Edit plan: {plans.find((p) => p.id === ed.id)?.name}</DialogTitle>
              <DialogDescription>Update plan details, pricing, limits, and features.</DialogDescription>
              <FormField label="Plan name *" htmlFor="ed-name">
                <Input id="ed-name" value={ed.name} onChange={(e) => setE({ name: e.target.value })} placeholder="e.g. Professional" /></FormField>
              <FormField label="Description" htmlFor="ed-desc">
                <Textarea id="ed-desc" rows={2} value={ed.desc} onChange={(e) => setE({ desc: e.target.value })} placeholder="Short description of the plan" /></FormField>
              <FormField label="Price (per month)" htmlFor="ed-price" description="Yearly price is 10 times the monthly price (2 months free).">
                <Input id="ed-price" type="number" step="0.01" min={0} value={ed.price} onChange={(e) => setE({ price: e.target.value })} placeholder="e.g. 149" /></FormField>
              <div className="grid grid-cols-3 gap-2.5">
                <FormField label="Max team members" htmlFor="ed-users"><Input id="ed-users" type="number" min={0} value={ed.users} onChange={(e) => setE({ users: e.target.value })} /></FormField>
                <FormField label="Max products" htmlFor="ed-products"><Input id="ed-products" type="number" min={0} value={ed.products} onChange={(e) => setE({ products: e.target.value })} /></FormField>
                <FormField label="Max branches" htmlFor="ed-branches"><Input id="ed-branches" type="number" min={0} value={ed.branches} onChange={(e) => setE({ branches: e.target.value })} /></FormField>
              </div>
              <span className="-mt-1 text-xs text-muted-foreground">999999 means unlimited.</span>
              <FormField orientation="horizontal" label={<>Mark as &quot;Most popular&quot;</>} htmlFor="ed-featured"
                className="flex-row-reverse justify-end [&>[data-slot=field-label]]:flex-none">
                <Checkbox id="ed-featured" checked={ed.featured} onCheckedChange={(c) => setE({ featured: c === true })} />
              </FormField>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">Features</span>
                {ed.feats.map((f, i) => (
                  <Item key={`${f}-${i}`} variant="muted" size="sm" className="py-2">
                    <ItemContent>{f}</ItemContent>
                    <ItemActions>
                      <WithTooltip content="Remove feature"><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove feature" onClick={() => setE({ feats: ed.feats.filter((_, j) => j !== i) })}>&times;</Button></WithTooltip>
                    </ItemActions>
                  </Item>
                ))}
                <div className="flex gap-2">
                  <Input value={ed.newFeat} onChange={(e) => setEd({ ...ed, newFeat: e.target.value })} placeholder="Add new feature..."
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const t = ed.newFeat.trim(); if (t) setE({ feats: [...ed.feats, t], newFeat: "" }) } }} />
                  <Button type="button" variant="outline" onClick={() => { const t = ed.newFeat.trim(); if (t) setE({ feats: [...ed.feats, t], newFeat: "" }) }}>Add</Button>
                </div>
              </div>
              {ed.err && <Alert variant="destructive"><AlertDescription>{ed.err}</AlertDescription></Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={ed.saving} onClick={() => setEd(null)}>Cancel</Button>
                <Button type="button" disabled={ed.saving} onClick={saveEdit}>{ed.saving ? "Saving…" : "Save changes"}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
