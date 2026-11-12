"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle, ArrowRight, Banknote, CalendarCheck, CreditCard, Info, Landmark, RefreshCw, Scale, ShoppingBag, TrendingUp, Undo2, Wallet,
} from "lucide-react"
import financeApi, { financeError, type Kpi, type Overview } from "@/lib/financeApi"
import { formatNumber, formatPct } from "@/lib/finance-format"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { Toolbar } from "@/components/common/Toolbar"
import { TooltipIcon, WithTooltip } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { AsOfNowLabel, FinanceFilters, channelLabel, presetLabel, useFinanceFilters, useFinanceQuery, withFinanceQuery } from "@/components/finance/finance-filters"
import { CurrencyTag, DirectionAmount, InOutChart, MixBars, SignedMoney, TileSkeletons, useFinanceFormat } from "@/components/finance/finance-ui"
import { FIN_NS, accountTypeText, methodText, sourceText } from "@/components/finance/i18n"
import { SetCostsDialog } from "@/components/finance/overview-set-costs-dialog"

/** "+12.5% vs previous period" from the server's changePct; `invert` = lower is better. */
function KpiChange({ kpi, invert, fallback }: { kpi: Kpi; invert?: boolean; fallback?: React.ReactNode }) {
  const { t } = useTranslation(FIN_NS)
  if (kpi.previous == null) return <>{fallback}</>
  if (kpi.changePct == null) return <span>{kpi.value === 0 ? t("finance:ui.noChange") : t("finance:overview.nothingPrevious")}</span>
  const good = invert ? kpi.changePct < 0 : kpi.changePct > 0
  return (
    <span className={cn(kpi.changePct === 0 ? "" : good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      {t("finance:ui.vsPrevious", { change: `${kpi.changePct > 0 ? "+" : ""}${kpi.changePct.toFixed(1)}%` })}
    </span>
  )
}

const money0 = (n: number) => Math.round(n * 100) / 100

export default function FinanceOverviewPage() {
  const blocked = useModuleGuard("Finance")
  const { t } = useTranslation(FIN_NS)
  const fmt = useFinanceFormat()
  const filters = useFinanceFilters()
  const fq = useFinanceQuery()
  const fl = (href: string) => withFinanceQuery(href, fq)
  const [compare, setCompare] = useState(true)
  const [data, setData] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [setCosts, setSetCosts] = useState(false)
  const latest = useRef(0)

  const { ready, incomplete, key } = filters
  const load = useCallback(async () => {
    if (!ready || incomplete) return
    const id = ++latest.current
    setLoading(true); setError("")
    try {
      const d = await financeApi.getOverview(filters.params)
      if (id === latest.current) setData(d)
    } catch (e) {
      if (id === latest.current) setError(financeError(e, t("finance:overview.loadFailed")))
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [ready, incomplete, key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  if (blocked) return blocked

  const money = fmt.money
  const k = data?.kpis
  const prevKpi = (kpi: Kpi): Kpi => (compare ? kpi : { ...kpi, previous: null })
  const pr = data?.context.period
  const periodText = pr?.from ? (pr.from === pr.to ? fmt.date(pr.from) : `${fmt.date(pr.from)} – ${fmt.date(pr.to)}`) : (pr?.label || filters.label)
  const prevLabel = compare && pr?.previousFrom && pr.previousTo ? ` · ${t("finance:overview.comparedWith", { range: `${fmt.date(pr.previousFrom)} – ${fmt.date(pr.previousTo)}` })}` : ""
  const periodName = (pr?.preset && pr.preset !== "custom" ? presetLabel(t, pr.preset) : filters.label).toLowerCase()
  const channelNote = data && data.context.channel !== "all" ? ` · ${t("finance:overview.channelOnly", { channel: channelLabel(t, data.context.channel, data.context.channelLabel) })}` : ""
  const close = data?.closeStatus
  const closeText = close ? (close.closedThrough ? t("finance:close.closedThrough", { date: fmt.longDate(close.closedThrough) }) : t("finance:close.noneClosed")) : ""
  const suggestMonth = close?.suggestion ? fmt.bucket(close.suggestion.month, close.suggestion.label) : ""
  const m = data?.metrics
  const cov = data?.profitCoverage
  const covSum = cov ? money0(cov.costed + cov.uncosted + cov.excluded) : 0
  const covAddsUp = cov ? Math.abs(covSum - cov.productSales) < 0.01 : true
  const refunds = m?.refunds
  const fees = m?.fees

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:overview.title")}
        description={t("finance:overview.description")}
        actions={<>
          <Button asChild variant="outline"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>{t("finance:transactions.title")}</Link></Button>
          <Button asChild><Link href={fl("/dashboard/finance/reports")} prefetch={false}>{t("finance:reports.title")}</Link></Button>
        </>}
      />

      <Toolbar
        actions={<>
          <div className="flex items-center gap-2">
            <Switch id="overview-compare" checked={compare} onCheckedChange={setCompare} />
            <Label htmlFor="overview-compare" className="text-sm font-normal">{t("finance:overview.compare")}</Label>
          </div>
          <WithTooltip content={t("common:actions.refresh")}>
            <Button type="button" variant="outline" size="icon" aria-label={t("common:actions.refresh")} onClick={load} disabled={loading}>
              <RefreshCw className={cn("size-4", loading && "animate-spin")} aria-hidden />
            </Button>
          </WithTooltip>
        </>}
      >
        <FinanceFilters filters={filters} idPrefix="overview" />
        <span className="text-sm text-muted-foreground">{periodText}{prevLabel}{channelNote}</span>
        <CurrencyTag code={data?.context.currency?.code} />
      </Toolbar>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {close && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
          <span>{closeText}</span>
          {close.suggestion && <span className="text-muted-foreground">{t("finance:overview.monthStillOpen", { month: suggestMonth })}</span>}
          <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0">
            <Link href={fl("/dashboard/finance/reports?tab=close")} prefetch={false}>{close.suggestion ? t("finance:close.closeMonth", { month: suggestMonth }) : t("finance:close.title")}</Link>
          </Button>
        </div>
      )}

      {data && data.alerts.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.alerts.map((a, i) => (
            <Alert key={`${a.type}-${i}`} variant={a.severity === "danger" ? "destructive" : "default"}
              className={cn(a.severity === "warning" && "border-amber-300 dark:border-amber-700")}>
              {a.severity === "info" ? <Info aria-hidden /> : <AlertTriangle aria-hidden className={cn(a.severity === "warning" && "text-amber-600")} />}
              <AlertTitle>{a.title}</AlertTitle>
              <AlertDescription>
                <span>{a.message}</span>
                {a.href && <Link href={a.href.startsWith("/dashboard/finance") ? fl(a.href) : a.href} prefetch={false} className="font-medium text-foreground underline underline-offset-2">{t("finance:overview.review")}</Link>}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ── Period figures ── */}
      <section aria-label={t("finance:overview.profitAria")} className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", loading && data && "opacity-60")}>
        {!k ? <TileSkeletons /> : <>
          <StatTile label={t("finance:kpi.revenue")} icon={<TrendingUp />} value={money(k.revenue.value)} hint={<KpiChange kpi={prevKpi(k.revenue)} fallback={t("finance:overview.revenueHint")} />} />
          <StatTile label={t("finance:kpi.grossProfit")} icon={<Scale />} value={<SignedMoney value={k.grossProfit.value} format={money} />}
            hint={<KpiChange kpi={prevKpi(k.grossProfit)} fallback={t("finance:overview.grossHint", { cogs: money(k.cogs.value) })} />} />
          <StatTile label={t("finance:kpi.expenses")} icon={<Wallet />} value={money(k.expenses.value)}
            hint={<KpiChange kpi={prevKpi(k.expenses)} invert fallback={data && data.pnl.voidedExpenses ? t("finance:overview.netOfVoided", { amount: money(data.pnl.voidedExpenses) }) : t("finance:overview.expensesHint")} />} />
          <StatTile label={t("finance:kpi.netProfit")} icon={<Banknote />} value={<SignedMoney value={k.netProfit.value} format={money} positiveTone />}
            hint={<KpiChange kpi={prevKpi(k.netProfit)} fallback={t("finance:overview.netHint")} />} />
        </>}
      </section>

      <section aria-label={t("finance:overview.salesAria")} className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", loading && data && "opacity-60")}>
        {!k || !m ? <TileSkeletons /> : <>
          <StatTile label={t("finance:kpi.orderVolume")} icon={<ShoppingBag />} value={money(m.orders.volume || k.orderVolume.value)}
            hint={<KpiChange kpi={prevKpi(k.orderVolume)} fallback={t("finance:overview.ordersPlaced", { count: m.orders.count, n: formatNumber(m.orders.count) })} />} />
          <StatTile label={t("finance:kpi.netCashFlow")} icon={<Scale />} value={<SignedMoney value={k.netCashFlow.value} format={money} positiveTone />}
            hint={t("finance:overview.cashFlowHint", { in: money(k.moneyIn.value), out: money(k.moneyOut.value) })} />
          <StatTile label={t("finance:kpi.paymentFees")} icon={<CreditCard />} value={money(fees?.total ?? k.paymentFees.value)}
            hint={<KpiChange kpi={prevKpi(k.paymentFees)} invert fallback={t("finance:overview.feesEstimated", { count: fees?.count ?? 0, n: formatNumber(fees?.count ?? 0) })} />} />
          <StatTile label={t("finance:kpi.refundsIn", { period: periodName })} icon={<Undo2 />} value={money(refunds?.refunded ?? 0)}
            hint={t("finance:overview.refundsHint", { refunded: money(refunds?.refunded ?? 0), awaiting: money(refunds?.awaiting ?? 0) })} />
        </>}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title={t("finance:overview.coverageTitle")}
          description={t("finance:overview.coverageDesc")}
          actions={<Button type="button" variant="outline" size="sm" onClick={() => setSetCosts(true)} disabled={!cov}>{t("finance:setCosts.title")}</Button>}>
          {!cov ? <Skeleton className="h-36" /> : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">{formatPct(cov.costedPct)}</p>
                  <p className="text-sm text-muted-foreground">{t("finance:overview.haveCost")}</p>
                </div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={t("finance:overview.coverageAria")}>
                  {cov.productSales > 0 && <>
                    <div className="bg-emerald-500" style={{ width: `${(cov.costed / cov.productSales) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(cov.uncosted / cov.productSales) * 100}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(cov.excluded / cov.productSales) * 100}%` }} />
                  </>}
                </div>
              </div>
              <InfoList>
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden />{t("finance:overview.costed")}</span>} value={<span className="tabular-nums">{money(cov.costed)}</span>} />
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-amber-500" aria-hidden />{t("finance:overview.uncosted")}{cov.productsWithoutCost ? ` · ${t("finance:overview.productsWithoutCost", { count: cov.productsWithoutCost, n: formatNumber(cov.productsWithoutCost) })}` : ""}</span>} value={<span className="tabular-nums">{money(cov.uncosted)}</span>} />
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-slate-400" aria-hidden />{t("finance:overview.excluded")}</span>} value={<span className="tabular-nums">{money(cov.excluded)}</span>} />
                <InfoRow className="border-t pt-2" label={<span className="font-medium text-foreground">= {t("finance:overview.productSales")}</span>}
                  value={<span className={cn("tabular-nums", !covAddsUp && "text-destructive")}>{money(cov.productSales)}</span>} />
              </InfoList>
              {!covAddsUp && <p className="text-xs text-destructive">{t("finance:overview.partsMismatch", { sum: money(covSum), total: money(cov.productSales) })}</p>}
            </div>
          )}
        </SectionCard>
        <SectionCard title={t("finance:overview.feesByMethod")} description={t("finance:overview.feesByMethodDesc")}
          actions={<Button asChild variant="link" size="sm"><Link href={fl("/dashboard/finance/transactions?fees=1")} prefetch={false}>{t("finance:overview.feeSettings")}</Link></Button>}>
          {!fees ? <Skeleton className="h-36" /> : (
            <MixBars items={fees.byMethod.filter((f) => f.fee > 0).map((f) => ({ label: methodText(t, f.methodKey, f.label), value: f.fee, hint: t("finance:overview.feeOn", { n: formatNumber(f.count), amount: money(f.gross) }) }))}
              format={money} empty={t("finance:overview.noFees")} />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title={t("finance:ui.inVsOut")} description={data ? (data.cashFlow.granularity === "month" ? t("finance:ui.byMonth") : t("finance:ui.byDay")) : undefined}>
          {!data ? <Skeleton className="h-[200px]" /> : <InOutChart buckets={data.cashFlow.points.map((p) => ({ label: fmt.bucket(p.key, p.label, "month"), in: p.moneyIn, out: p.moneyOut }))} format={money} />}
        </SectionCard>
        <SectionCard title={t("finance:ui.expensesByCategory")} actions={<Button asChild variant="link" size="sm"><Link href={fl("/dashboard/expenses")} prefetch={false}>{t("finance:overview.allExpenses")}</Link></Button>}>
          {!data ? <Skeleton className="h-[200px]" /> : (
            <MixBars items={data.expensesByCategory.map((c) => ({ label: c.name, value: c.amount, hint: c.pct ? `${Math.round(c.pct)}%` : undefined, color: c.color ?? undefined }))} format={money} empty={t("finance:ui.noExpenses")} />
          )}
        </SectionCard>
      </div>

      {/* ── Point-in-time figures ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <h2 className="text-lg font-semibold">{t("finance:overview.balances")}</h2>
        <AsOfNowLabel />
        <span className="text-sm text-muted-foreground">{data?.context.asOf ? t("finance:overview.asOfToday", { date: fmt.date(data.context.asOf) }) : t("finance:overview.notAffected")}</span>
      </div>

      <section aria-label={t("finance:overview.balances")} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {!data || !k ? <TileSkeletons /> : <>
          <SectionCard title={t("finance:overview.cashOnHand")} description={t("finance:overview.allActiveAccounts")}
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>{t("finance:accounts.title")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums"><SignedMoney value={k.cashOnHand.value} format={money} /></p>
            <MixBars items={data.accountBalances.map((a) => ({ label: a.name, hint: accountTypeText(t, a.type), value: a.balance }))} format={money} empty={t("finance:overview.noAccounts")} limit={5} />
          </SectionCard>
          <SectionCard title={t("finance:overview.owedToYou")} description={t("finance:receivables.title")}
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/receivables")} prefetch={false}>{t("finance:actions.collect")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums">{money(data.receivables.total + data.payables.supplierCredits)}</p>
            <InfoList>
              <InfoRow label={t("finance:overview.owedByCustomers")} value={<span className="tabular-nums">{money(data.receivables.customerDues + data.receivables.codWithCouriers)}</span>} />
              <InfoRow label={`· ${t("finance:overview.ofWhichCod")}`} className="pl-3 text-xs" value={<span className="tabular-nums">{money(data.receivables.codWithCouriers)}</span>} />
              <InfoRow label={t("finance:overview.tailorBalances")} value={<span className="tabular-nums">{money(data.receivables.tailorBalances)}</span>} />
              <InfoRow label={t("finance:overview.suppliersOweYou")} value={<span className="tabular-nums">{money(data.payables.supplierCredits)}</span>} />
            </InfoList>
          </SectionCard>
          <SectionCard title={t("finance:overview.youOwe")} description={t("finance:overview.payables")}
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/payouts")} prefetch={false}>{t("finance:actions.pay")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums">{money(data.payables.total)}</p>
            <InfoList>
              <InfoRow label={t("finance:overview.supplierDues")} value={<span className="tabular-nums">{money(data.payables.supplierDues)}</span>} />
              <InfoRow label={t("finance:overview.unpaidSalaries")} value={<span className="tabular-nums">{money(data.payables.unpaidSalaries)}</span>} />
              <InfoRow label={t("finance:overview.owedToDorjis")} value={<span className="tabular-nums">{money(data.payables.dorjiOwed)}</span>} />
            </InfoList>
          </SectionCard>
          <SectionCard title={t("finance:overview.storeCredit")} description={t("finance:overview.storeCreditDesc")}
            actions={data.storeCredit.href ? <Button asChild variant="ghost" size="sm"><Link href={data.storeCredit.href} prefetch={false}>{t("finance:overview.customers")} <ArrowRight className="size-4" aria-hidden /></Link></Button> : undefined}>
            <p className="mb-1 text-2xl font-semibold tabular-nums">{money(data.storeCredit.total)}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {t("finance:overview.customersWithCredit", { count: data.storeCredit.customers, n: formatNumber(data.storeCredit.customers) })}
              <TooltipIcon label={t("finance:overview.aboutStoreCredit")} content={t("finance:overview.storeCreditTip")} />
            </p>
          </SectionCard>
        </>}
      </section>

      <SectionCard title={t("finance:overview.recent")} contentClassName="px-2"
        actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>{t("common:actions.viewAll")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
        {!data ? <Skeleton className="mx-4 h-[160px]" /> : data.recentTransactions.length === 0 ? (
          <EmptyState icon={Banknote} title={t("finance:overview.noTxTitle")} description={t("finance:overview.noTxDesc")} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("common:extra.details")}</TableHead><TableHead>{t("finance:col.account")}</TableHead>
                  <TableHead className="text-right">{t("finance:col.fee")}</TableHead><TableHead className="text-right">{t("common:money.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.slice(0, 10).map((r) => {
                  const src = sourceText(t, r.sourceType, r.sourceLabel)
                  const title = r.party || r.reference || src
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.date(r.date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.link ? <Link href={r.link.href} className="hover:underline">{title}</Link> : title}</div>
                        <div className="text-xs text-muted-foreground">{src}{r.reference && r.party ? ` · ${r.reference}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.accountName ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.fee ? `−${money(r.fee)}` : "—"}</TableCell>
                      <TableCell className="text-right"><DirectionAmount direction={r.direction} amount={r.amount} format={money} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {data && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Landmark className="size-3.5" aria-hidden />
          {t("finance:overview.footer", { code: data.context.currency?.code ?? fmt.currencyCode, tz: data.context.tz ?? fmt.tz })}
        </p>
      )}

      <SetCostsDialog open={setCosts} onClose={() => setSetCosts(false)} period={filters.params} />
    </div>
  )
}
