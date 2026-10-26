"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { saasBillingApi, type BillingUsage, type PaymentRecord, type Plan, type Subscription } from "@/lib/saasBillingApi"
import { settingsApi } from "@/lib/settingsApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { StatusBadge, type StatusVariant } from "@/components/common/StatusBadge"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const UNLIMITED = 999999
const TAX_RATE = 0.1

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

  const STATUS_PILL = ({
    none: { label: "No plan", variant: "outline" },
    trial: { label: "Trial", variant: "secondary" },
    active: { label: "Active", variant: "default" },
    cancelled: { label: "Cancelled", variant: "destructive" },
    expired: { label: "Expired", variant: "outline" },
  } as Record<typeof status, { label: string; variant: StatusVariant }>)[status]

  let note: { danger: boolean; title: string; text: string }
  if (!sub) note = { danger: false, title: "No active plan.", text: "Pick a plan below to get started." }
  else if (status === "cancelled") note = { danger: true, title: "Plan cancelled.", text: `Access continues until ${fmtD(periodEnd)}. Renew to reactivate the ${sub.planName} plan.` }
  else if (status === "expired") note = { danger: true, title: "Plan expired.", text: `Expired on ${fmtD(periodEnd)}. Choose a plan to regain access.` }
  else if (!sub.currentPeriodStart || !periodEnd) note = { danger: true, title: "Billing date missing.", text: "No subscription start date is saved. Renew once to set it." }
  else if (isTrial) note = { danger: false, title: `Trial ends on ${fmtD(periodEnd)}.`, text: `Started ${fmtD(sub.currentPeriodStart)}.` }
  else note = { danger: false, title: `Renews on ${fmtD(sub.nextBillingDate ?? periodEnd)}.`, text: overAny ? "You are over a plan limit — consider upgrading." : `Started ${fmtD(sub.currentPeriodStart)}.` }

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Plan & billing"
        description="Your subscription, usage and invoices."
        actions={<>
          <Button asChild variant="outline"><Link href="/dashboard/billing/plans">Plans</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/billing/subscriptions">Subscriptions</Link></Button>
          <Button asChild variant="outline"><Link href="/dashboard/company/billing-contact">Billing contact</Link></Button>
        </>}
      />

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-[300px]" /><Skeleton className="h-[300px]" /></div>
      ) : (
        <Card className="grid gap-6 p-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <StatusBadge status={status} variant={STATUS_PILL.variant} label={STATUS_PILL.label} className="self-start" />
            <h2 className="text-[28px] font-bold">{sub?.planName ?? "No plan"}</h2>
            {sub && (
              <span className="text-sm text-muted-foreground">
                <strong className="text-[22px] text-foreground tabular-nums">{isTrial ? "Free" : money(basePrice)}</strong>{" "}
                {isTrial ? "· 10-day trial" : sub.billingPeriod === "yearly" ? "/ year · billed yearly" : "/ month · billed monthly"}
              </span>
            )}
            <Alert variant={note.danger ? "destructive" : "default"}>
              <AlertTitle>{note.title}</AlertTitle>
              <AlertDescription>{note.text}</AlertDescription>
            </Alert>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {sub && !isTrial && writable && (
                <Button type="button" disabled={busy} onClick={renew}>{status === "cancelled" || status === "expired" ? "Reactivate" : "Renew now"}</Button>
              )}
              <Button asChild variant="outline"><a href="#compare-plans">Change plan</a></Button>
              {canCancel && writable && (
                <Button asChild variant="link" className="text-destructive"><Link href="/dashboard/billing/subscriptions?cancel=1">Cancel plan</Link></Button>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Usage this month</h3>
            {!usage ? <Skeleton className="h-32" /> : meters.map((m) => {
              const finite = m.limit !== null && m.limit > 0 && m.limit < UNLIMITED
              const over = finite && m.used > (m.limit as number)
              return (
                <div key={m.label}>
                  <div className="flex justify-between text-sm"><span>{m.label}</span>
                    <span className="text-muted-foreground"><strong className="text-foreground tabular-nums">{m.used.toLocaleString("en-US")}</strong>{" "}
                      {m.limit === null ? "this month" : finite ? `of ${(m.limit as number).toLocaleString("en-US")}` : "of unlimited"}</span></div>
                  <Progress
                    aria-label={`${m.label} usage`}
                    value={finite ? Math.min(100, Math.round((m.used / (m.limit as number)) * 100)) : 0}
                    className={cn("mt-1.5", over && "*:data-[slot=progress-indicator]:bg-destructive")}
                  />
                </div>
              )
            })}
            <Item variant="outline" size="sm">
              <ItemContent>
                <ItemTitle>Auto-renew</ItemTitle>
                <ItemDescription>{!periodSavable ? "Available on an active paid plan" : dAuto ? "Renews automatically each period" : "You will renew manually"}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch checked={dAuto} aria-label="Auto renew" disabled={!periodSavable || !writable}
                  onCheckedChange={() => setDraft({ ...draft, auto: !dAuto })} />
              </ItemActions>
            </Item>
          </div>
        </Card>
      )}

      <SectionCard
        id="compare-plans"
        title="Compare plans"
        actions={
          <SegmentedControl
            aria-label="Billing period"
            size="default"
            value={dPeriod}
            onValueChange={(id) => setDraft({ ...draft, period: id as Period })}
            options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly · 2 months free" }]}
          />
        }
        contentClassName="px-0"
      >
        {loading ? <div className="px-6"><Skeleton className="h-60" /></div> : plans.length === 0 ? (
          <EmptyState title="No plans available. Please contact support." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="align-bottom">Plan</TableHead>
                  {plans.map((p) => {
                    const isCur = p.id === curId
                    const isSel = p.id === dPlan && !isCur
                    return (
                      <TableHead key={p.id} className={cn("h-auto py-2 align-top", isCur ? "bg-muted/50" : isSel && "bg-muted/30")}>
                        {(isCur || p.isFeatured) && <Badge variant={isCur ? "default" : "secondary"} className="mb-1.5">{isCur ? "Your plan" : "Most popular"}</Badge>}
                        <div className="text-base font-bold text-foreground">{p.name}</div>
                        <div className="mt-1 text-xl font-bold text-foreground tabular-nums">{isFree(p) ? "Free" : money(priceOf(p, dPeriod))}
                          <span className="text-xs font-medium text-muted-foreground">{isFree(p) ? " · 10 days" : dPeriod === "yearly" ? " /year" : " /month"}</span></div>
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  ["Team members", (p: Plan) => limitLabel(p.maxUsers)],
                  ["Products", (p: Plan) => limitLabel(p.maxProducts)],
                  ["Branches", (p: Plan) => limitLabel(p.maxBranches)],
                  ...featUnion.map((f) => [f, (p: Plan) => ((p.features || []).map(featName).includes(f) ? "✓" : "—")] as [string, (p: Plan) => string]),
                ] as [string, (p: Plan) => string][]).map(([name, fn]) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    {plans.map((p) => {
                      const v = fn(p)
                      return <TableCell key={p.id} className={cn(v === "—" && "text-muted-foreground", p.id === curId ? "bg-muted/50" : p.id === dPlan && "bg-muted/30")}>{v}</TableCell>
                    })}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell />
                  {plans.map((p) => {
                    const isCur = p.id === curId
                    const isSel = p.id === dPlan && !isCur
                    const trialLocked = isFree(p) && paidEver && !isCur
                    const cta = isCur ? "Current plan" : trialLocked ? "Trial used" : isSel ? "Selected"
                      : curId === null ? "Select" : rank(p.id) > rank(curId) ? "Upgrade" : "Downgrade"
                    return (
                      <TableCell key={p.id} className={cn(isCur ? "bg-muted/50" : isSel && "bg-muted/30")}>
                        <Button type="button" disabled={isCur || trialLocked || !writable}
                          onClick={() => setDraft({ ...draft, plan: isSel ? undefined : p.id })}
                          variant={isSel ? "default" : "outline"} className="w-full">{cta}</Button>
                      </TableCell>
                    )
                  })}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Payment history" description="Invoices for your subscription.">
        {loading ? <Skeleton className="h-24" /> : invoices.length === 0 ? (
          <EmptyState bordered title="No invoices yet — your first invoice will appear here after renewal or a plan change." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Plan</TableHead>
                  <TableHead>Period</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.invoiceNumber}</TableCell>
                    <TableCell>{fmtD(p.paymentDate ?? p.createdAt)}</TableCell>
                    <TableCell>{p.planName || "—"}</TableCell>
                    <TableCell>{p.billingPeriod === "yearly" ? "Yearly" : "Monthly"}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Card className="sticky bottom-0 z-10 flex-row flex-wrap items-center gap-2.5 px-4 py-3">
        <span className="text-sm text-muted-foreground">{statusText}</span>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={discard} disabled={!dirty || busy}>Discard</Button>
          <Button type="button" onClick={save} disabled={!dirty || busy || !writable}>{busy ? "Saving…" : "Save changes"}</Button>
        </div>
      </Card>

      <Dialog open={!!co} onOpenChange={(o) => { if (!o && !co?.busy) setCo(null) }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
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
    </div>
  )
}
