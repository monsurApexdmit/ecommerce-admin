"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"
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
  { id: "card", label: "account:billing.shared.methods.card" },
  { id: "bkash", label: "account:billing.shared.methods.bkash" },
  { id: "bank", label: "account:billing.shared.methods.bank" },
] as const
type Method = (typeof METHODS)[number]["id"]
type Period = "monthly" | "yearly"

const featName = (f: unknown): string => (typeof f === "string" ? f : String((f as { name?: string })?.name ?? ""))

interface CheckoutState { plan: Plan; period: Period; method: Method; email: string; terms: boolean; err: string; busy: boolean }
interface EditState {
  id: number; name: string; desc: string; price: string; users: string; products: string; branches: string
  featured: boolean; feats: string[]; newFeat: string; err: string; saving: boolean
}

export default function PlansPage() {
  const blocked = useModuleGuard("Billing Plans")
  const { t, i18n } = useTranslation(["account", "common"])
  const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "")
  const limitLabel = (v?: number | null) => (!v || v >= UNLIMITED ? t("account:billing.shared.unlimited") : v.toLocaleString("en-US"))
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
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:billing.shared.loadPlansFailed")) }
    try {
      const s: any = (await saasBillingApi.getCurrentSubscription()).data
      const live: Subscription | null = s && s.status !== "none" && s.id ? s : null
      setSub(live)
      if (live?.billingPeriod === "yearly") setPeriod("yearly")
    } catch { setSub(null) }
    try { setUsage((await saasBillingApi.getUsage()).data) } catch { setUsage(null) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (subStatus === "trial") return { danger: false, t: t("account:billing.plans.trialActive"), x: t("account:billing.plans.trialRemaining", { count: dl }) }
    if (subStatus === "cancelled") return { danger: false, t: t("account:billing.plans.cancelledTitle"), x: t("account:billing.plans.cancelledText", { date: fmtD(periodEnd) }) }
    if (subStatus === "expired") return { danger: true, t: t("account:billing.plans.expiredTitle"), x: t("account:billing.plans.expiredText") }
    if (subStatus === "none") return { danger: false, t: t("account:billing.shared.noPlanTitle"), x: t("account:billing.shared.noPlanText") }
    const plan = curPlan?.name ?? sub?.planName ?? t("account:billing.plans.noActivePlan")
    return { danger: false, t: t("account:billing.plans.activeTitle"), x: periodEnd ? t("account:billing.plans.activeTextRenews", { plan, date: fmtD(sub?.nextBillingDate ?? periodEnd) }) : t("account:billing.plans.activeText", { plan }) }
  }, [sub, subStatus, periodEnd, curPlan, t, i18n.language]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- checkout ----
  const overLimits = (p: Plan): string[] => {
    if (!usage) return []
    const out: string[] = []
    const chk = (label: string, used: number, limit?: number | null) => { if (limit && limit < UNLIMITED && used > limit) out.push(t("account:billing.co.overItem", { label, used: used.toLocaleString("en-US"), limit: limit.toLocaleString("en-US") })) }
    chk(t("account:billing.co.overTeam"), usage.teamMembers.used, p.maxUsers)
    chk(t("account:billing.co.overProducts"), usage.products.used, p.maxProducts)
    chk(t("account:billing.co.overBranches"), usage.branches.used, p.maxBranches)
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
    if (paid && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(co.email.trim())) { setCo({ ...co, err: t("account:billing.co.invalidEmail") }); return }
    if (!co.terms) { setCo({ ...co, err: t("account:billing.co.acceptTerms") }); return }
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
      toast.success(isFree(co.plan) ? t("account:billing.plans.trialStarted") : t("account:billing.plans.subscribed", { plan: co.plan.name }))
      setCo(null)
      await load()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || t("account:billing.co.paymentFailed")
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
    if (!name) return fail(t("account:billing.plans.nameRequired"))
    if (plans.some((p) => p.id !== ed.id && p.name.toLowerCase() === name.toLowerCase())) return fail(t("account:billing.plans.nameTaken"))
    if (ed.price === "" || !isFinite(price) || price < 0) return fail(t("account:billing.plans.priceInvalid"))
    if (ints.some((n) => !Number.isInteger(n) || n < 0)) return fail(t("account:billing.plans.limitsInvalid"))
    setEd({ ...ed, saving: true, err: "" })
    const payload: UpdatePlanPayload = { name, description: ed.desc.trim(), price, maxUsers: ints[0], maxProducts: ints[1], maxBranches: ints[2], features: ed.feats, isFeatured: ed.featured }
    try {
      const res = await saasBillingApi.updatePlan(ed.id, payload)
      setPlans((ps) => ps.map((p) => (p.id === ed.id ? { ...p, ...(res.data as Plan) } : p)))
      setEd(null)
      toast.success(t("account:billing.plans.planUpdated"))
    } catch (e: any) { setEd((x) => (x ? { ...x, saving: false, err: e?.response?.data?.message || t("account:billing.plans.updateFailed") } : x)) }
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
        title={t("account:billing.plans.title")}
        description={<span className="block max-w-2xl">{t("account:billing.plans.description")}</span>}
        actions={<Button asChild variant="outline"><Link href="/dashboard/billing/subscriptions">{t("account:billing.plans.mySubscription")}</Link></Button>}
      />

      {!loading && (
        <Alert role="status" variant={banner.danger ? "destructive" : "default"}>
          <AlertTitle>{banner.t}</AlertTitle>
          <AlertDescription>{banner.x}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label={t("account:billing.shared.billingPeriod")}
          size="default"
          value={period}
          onValueChange={(id) => setPeriod(id as Period)}
          options={[{ value: "monthly", label: t("account:billing.shared.monthly") }, { value: "yearly", label: t("account:billing.shared.yearlyPromo") }]}
        />
        <span className="text-xs text-muted-foreground">{t("account:billing.plans.taxNote", { rate: Math.round(TAX_RATE * 100) })}</span>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[440px]" />)}</div>
      ) : plans.length === 0 ? (
        <EmptyState bordered title={t("account:billing.plans.noPlans")} description={t("account:billing.plans.contactSupport")} />
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
            const cta = isCur ? t("account:billing.shared.currentPlan") : trialLocked ? t("account:billing.plans.trialAlreadyUsed") : free ? t("account:billing.co.startTrial")
              : subStatus === "expired" || subStatus === "none" ? t("account:billing.plans.getStarted") : rank(p.id) > rank(sub?.planId) ? t("account:billing.shared.upgrade") : t("account:billing.plans.switchPlan")
            return (
              <Card key={p.id} className={cn("relative gap-4 p-6", (popular || isCur) && "border-primary")}>
                {popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{t("account:billing.plans.mostPopularBadge")}</Badge>}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isCur && <Badge variant="secondary" className="mb-1.5">{t("account:billing.shared.currentPlan")}</Badge>}
                    <h2 className="text-2xl font-bold">{p.name}</h2>
                  </div>
                  {isSuperAdmin && (
                    <WithTooltip content={t("account:billing.plans.editName", { name: p.name })}><Button type="button" variant="outline" size="icon" aria-label={t("account:billing.plans.editName", { name: p.name })} onClick={() => openEdit(p)}><Pencil className="size-4" /></Button></WithTooltip>
                  )}
                </div>
                <p className="min-h-10 text-sm text-muted-foreground">{p.description}</p>
                <div>
                  <span className="text-4xl font-bold tabular-nums">{free ? t("account:billing.shared.free") : money(price)}</span>{" "}
                  <span className="text-sm text-muted-foreground">{free ? t("account:billing.shared.trialSuffix") : period === "yearly" ? t("account:billing.shared.perYear") : t("account:billing.shared.perMonth")}</span>
                  {!free && period === "yearly" && <div className="text-xs font-semibold text-primary">{t("account:billing.plans.saveVsMonthly", { amount: money(p.price * 12 - price) })}</div>}
                </div>
                <Button type="button" disabled={dis} onClick={() => openCheckout(p)}
                  variant={popular ? "default" : "outline"}>{cta}</Button>
                <div>
                  <SectionTitle className="mb-2">{t("account:billing.plans.limits")}</SectionTitle>
                  <div className="flex flex-col gap-1 text-sm">
                    <span><Trans t={t} i18nKey="account:billing.plans.limitTeam" values={{ value: limitLabel(p.maxUsers) }} components={{ b: <strong /> }} /></span>
                    <span><Trans t={t} i18nKey="account:billing.plans.limitProducts" values={{ value: limitLabel(p.maxProducts) }} components={{ b: <strong /> }} /></span>
                    <span><Trans t={t} i18nKey="account:billing.plans.limitBranches" values={{ value: limitLabel(p.maxBranches) }} components={{ b: <strong /> }} /></span>
                  </div>
                </div>
                <div>
                  <SectionTitle className="mb-2">{t("account:billing.plans.features")}</SectionTitle>
                  <ul className="flex flex-col gap-1.5 text-sm">
                    {shown.map((f, i) => <li key={`${f}-${i}`} className="flex gap-2"><span aria-hidden className="text-primary">&#10003;</span><span>{f}</span></li>)}
                  </ul>
                  {feats.length > 5 && (
                    <Button type="button" variant="link" size="sm" onClick={() => setExpanded({ ...expanded, [p.id]: !open })} className="mt-2">
                      {open ? t("account:billing.plans.showLess") : t("account:billing.plans.moreFeatures", { count: feats.length - 5 })}
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {!loading && plans.length > 0 && (
        <SectionCard title={t("account:billing.shared.compare")} contentClassName="px-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("account:billing.plans.feature")}</TableHead>
                  {plans.map((p) => (
                    <TableHead key={p.id} className={cn("h-auto py-2", p.id === sub?.planId && "bg-muted/50")}>
                      <div>{p.name}</div>
                      <div className="font-normal text-muted-foreground">{isFree(p) ? t("account:billing.shared.free") : `${money(priceOf(p, period))}${period === "yearly" ? t("account:billing.shared.perYearShort") : t("account:billing.shared.perMonthShort")}`}</div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  [t("account:billing.shared.teamMembers"), (p: Plan) => limitLabel(p.maxUsers)],
                  [t("account:billing.shared.products"), (p: Plan) => limitLabel(p.maxProducts)],
                  [t("account:billing.shared.branches"), (p: Plan) => limitLabel(p.maxBranches)],
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
                <DialogTitle>{free ? t("account:billing.co.trialTitle") : t("account:billing.co.confirmTitle", { plan: co.plan.name })}</DialogTitle>
                <DialogDescription>{t("account:billing.co.description")}</DialogDescription>
                <Card className="gap-1.5 bg-muted/50 p-4 shadow-none">
                  <InfoList className="gap-1.5">
                    <InfoRow label={t("account:billing.co.line", { plan: co.plan.name, period: free ? t("account:billing.co.trialPeriod") : co.period === "yearly" ? t("account:billing.shared.yearly") : t("account:billing.shared.monthly") })} value={<span className="tabular-nums">{money(sub0)}</span>} />
                    <InfoRow label={t("account:billing.co.tax", { rate: Math.round(TAX_RATE * 100) })} value={<span className="tabular-nums">{money(tax)}</span>} />
                  </InfoList>
                  <Separator />
                  <div className="flex justify-between text-sm font-bold"><span>{t("common:money.total")}</span><span className="tabular-nums">{money(sub0 + tax)}</span></div>
                </Card>
                {over.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      {t("account:billing.co.overLimits", { list: over.join(", ") })}
                    </AlertDescription>
                  </Alert>
                )}
                {!free && (
                  <div className="flex flex-col gap-3">
                    <FormField label={t("account:billing.co.paymentMethod")} htmlFor="co-method">
                      <Select value={String(co.method)} onValueChange={(val) => setCo({ ...co, method: val as Method, err: "" })}>
                        <SelectTrigger id="co-method" className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METHODS.map((m) => <SelectItem key={m.id} value={String(m.id)}>{t(m.label)}</SelectItem>)}
                        </SelectContent>
                      </Select></FormField>
                    <FormField label={t("account:billing.co.billingEmail")} htmlFor="co-email">
                      <Input id="co-email" type="email" value={co.email} onChange={(e) => setCo({ ...co, email: e.target.value, err: "" })} placeholder={t("account:billing.co.emailPlaceholder")} /></FormField>
                  </div>
                )}
                <FormField orientation="horizontal" label={t("account:billing.co.terms")} htmlFor="co-terms"
                  className="flex-row-reverse justify-end [&>[data-slot=field-label]]:flex-none">
                  <Checkbox id="co-terms" checked={co.terms} onCheckedChange={(c) => setCo({ ...co, terms: c === true, err: "" })} />
                </FormField>
                {co.err && <Alert variant="destructive"><AlertDescription>{co.err}</AlertDescription></Alert>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" disabled={co.busy} onClick={() => setCo(null)}>{t("common:actions.cancel")}</Button>
                  <Button type="button" disabled={co.busy} onClick={confirmCheckout}>{co.busy ? t("account:billing.co.processing") : free ? t("account:billing.co.startTrial") : t("account:billing.co.pay", { amount: money(sub0 + tax) })}</Button>
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
              <DialogTitle>{t("account:billing.plans.edit.title", { name: plans.find((p) => p.id === ed.id)?.name ?? "" })}</DialogTitle>
              <DialogDescription>{t("account:billing.plans.edit.description")}</DialogDescription>
              <FormField label={t("account:billing.plans.edit.name")} htmlFor="ed-name">
                <Input id="ed-name" value={ed.name} onChange={(e) => setE({ name: e.target.value })} placeholder={t("account:billing.plans.edit.namePlaceholder")} /></FormField>
              <FormField label={t("common:fields.description")} htmlFor="ed-desc">
                <Textarea id="ed-desc" rows={2} value={ed.desc} onChange={(e) => setE({ desc: e.target.value })} placeholder={t("account:billing.plans.edit.descPlaceholder")} /></FormField>
              <FormField label={t("account:billing.plans.edit.price")} htmlFor="ed-price" description={t("account:billing.plans.edit.priceHelp")}>
                <Input id="ed-price" type="number" step="0.01" min={0} value={ed.price} onChange={(e) => setE({ price: e.target.value })} placeholder={t("account:billing.plans.edit.pricePlaceholder")} /></FormField>
              <div className="grid grid-cols-3 gap-2.5">
                <FormField label={t("account:billing.plans.edit.maxUsers")} htmlFor="ed-users"><Input id="ed-users" type="number" min={0} value={ed.users} onChange={(e) => setE({ users: e.target.value })} /></FormField>
                <FormField label={t("account:billing.plans.edit.maxProducts")} htmlFor="ed-products"><Input id="ed-products" type="number" min={0} value={ed.products} onChange={(e) => setE({ products: e.target.value })} /></FormField>
                <FormField label={t("account:billing.plans.edit.maxBranches")} htmlFor="ed-branches"><Input id="ed-branches" type="number" min={0} value={ed.branches} onChange={(e) => setE({ branches: e.target.value })} /></FormField>
              </div>
              <span className="-mt-1 text-xs text-muted-foreground">{t("account:billing.plans.edit.unlimitedHint")}</span>
              <FormField orientation="horizontal" label={t("account:billing.plans.edit.featured")} htmlFor="ed-featured"
                className="flex-row-reverse justify-end [&>[data-slot=field-label]]:flex-none">
                <Checkbox id="ed-featured" checked={ed.featured} onCheckedChange={(c) => setE({ featured: c === true })} />
              </FormField>
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{t("account:billing.plans.features")}</span>
                {ed.feats.map((f, i) => (
                  <Item key={`${f}-${i}`} variant="muted" size="sm" className="py-2">
                    <ItemContent>{f}</ItemContent>
                    <ItemActions>
                      <WithTooltip content={t("account:billing.plans.edit.removeFeature")}><Button type="button" variant="ghost" size="icon-sm" aria-label={t("account:billing.plans.edit.removeFeature")} onClick={() => setE({ feats: ed.feats.filter((_, j) => j !== i) })}>&times;</Button></WithTooltip>
                    </ItemActions>
                  </Item>
                ))}
                <div className="flex gap-2">
                  <Input value={ed.newFeat} onChange={(e) => setEd({ ...ed, newFeat: e.target.value })} placeholder={t("account:billing.plans.edit.newFeature")}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); const nf = ed.newFeat.trim(); if (nf) setE({ feats: [...ed.feats, nf], newFeat: "" }) } }} />
                  <Button type="button" variant="outline" onClick={() => { const nf = ed.newFeat.trim(); if (nf) setE({ feats: [...ed.feats, nf], newFeat: "" }) }}>{t("common:actions.add")}</Button>
                </div>
              </div>
              {ed.err && <Alert variant="destructive"><AlertDescription>{ed.err}</AlertDescription></Alert>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" disabled={ed.saving} onClick={() => setEd(null)}>{t("common:actions.cancel")}</Button>
                <Button type="button" disabled={ed.saving} onClick={saveEdit}>{ed.saving ? t("common:actions.saving") : t("common:actions.saveChanges")}</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
