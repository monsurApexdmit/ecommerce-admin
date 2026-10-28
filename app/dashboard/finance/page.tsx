"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
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
import { AsOfNowLabel, FinanceFilters, useFinanceFilters, useFinanceQuery, withFinanceQuery } from "@/components/finance/finance-filters"
import { CurrencyTag, DirectionAmount, InOutChart, MixBars, SignedMoney, TileSkeletons, accountTypeLabel, sourceLabel, useFinanceFormat } from "@/components/finance/finance-ui"
import { SetCostsDialog } from "@/components/finance/overview-set-costs-dialog"

/** "+12.5% vs previous period" from the server's changePct; `invert` = lower is better. */
function KpiChange({ kpi, invert, fallback }: { kpi: Kpi; invert?: boolean; fallback?: React.ReactNode }) {
  if (kpi.previous == null) return <>{fallback}</>
  if (kpi.changePct == null) return <span>{kpi.value === 0 ? "No change" : "Nothing in the previous period"}</span>
  const good = invert ? kpi.changePct < 0 : kpi.changePct > 0
  return (
    <span className={cn(kpi.changePct === 0 ? "" : good ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
      {kpi.changePct > 0 ? "+" : ""}{kpi.changePct.toFixed(1)}% vs previous period
    </span>
  )
}

const money0 = (n: number) => Math.round(n * 100) / 100

export default function FinanceOverviewPage() {
  const blocked = useModuleGuard("Finance")
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
      if (id === latest.current) setError(financeError(e, "Could not load the finance overview."))
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
  const prevLabel = compare && pr?.previousFrom && pr.previousTo ? ` · compared with ${fmt.date(pr.previousFrom)} – ${fmt.date(pr.previousTo)}` : ""
  const periodName = (pr?.label || filters.label).toLowerCase()
  const channelNote = data && data.context.channel !== "all" ? ` · ${data.context.channelLabel} sales only` : ""
  const m = data?.metrics
  const cov = data?.profitCoverage
  const covSum = cov ? money0(cov.costed + cov.uncosted + cov.excluded) : 0
  const covAddsUp = cov ? Math.abs(covSum - cov.productSales) < 0.01 : true
  const refunds = m?.refunds
  const fees = m?.fees

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Finance"
        description="Money in and out, profit and what is owed. Period figures follow the filters; balances are as things stand now."
        actions={<>
          <Button asChild variant="outline"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>Transactions</Link></Button>
          <Button asChild><Link href={fl("/dashboard/finance/reports")} prefetch={false}>Reports</Link></Button>
        </>}
      />

      <Toolbar
        actions={<>
          <div className="flex items-center gap-2">
            <Switch id="overview-compare" checked={compare} onCheckedChange={setCompare} />
            <Label htmlFor="overview-compare" className="text-sm font-normal">Compare with previous period</Label>
          </div>
          <WithTooltip content="Refresh">
            <Button type="button" variant="outline" size="icon" aria-label="Refresh" onClick={load} disabled={loading}>
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

      {data?.closeStatus && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
          <CalendarCheck className="size-4 text-muted-foreground" aria-hidden />
          <span>{data.closeStatus.text}</span>
          {data.closeStatus.suggestion && <span className="text-muted-foreground">{data.closeStatus.suggestion.label} has ended and is still open.</span>}
          <Button asChild variant="link" size="sm" className="ml-auto h-auto p-0">
            <Link href={fl("/dashboard/finance/reports?tab=close")} prefetch={false}>{data.closeStatus.suggestion ? data.closeStatus.suggestion.text : "Month-end close"}</Link>
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
                {a.href && <Link href={a.href.startsWith("/dashboard/finance") ? fl(a.href) : a.href} prefetch={false} className="font-medium text-foreground underline underline-offset-2">Review</Link>}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* ── Period figures ── */}
      <section aria-label="Profit" className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", loading && data && "opacity-60")}>
        {!k ? <TileSkeletons /> : <>
          <StatTile label="Revenue" icon={<TrendingUp />} value={money(k.revenue.value)} hint={<KpiChange kpi={prevKpi(k.revenue)} fallback="Sales, by order date" />} />
          <StatTile label="Gross profit" icon={<Scale />} value={<SignedMoney value={k.grossProfit.value} format={money} />}
            hint={<KpiChange kpi={prevKpi(k.grossProfit)} fallback={`Revenue − cost of goods (${money(k.cogs.value)})`} />} />
          <StatTile label="Expenses" icon={<Wallet />} value={money(k.expenses.value)}
            hint={<KpiChange kpi={prevKpi(k.expenses)} invert fallback={data && data.pnl.voidedExpenses ? `Net of ${money(data.pnl.voidedExpenses)} voided` : "Incl. salaries and dorji payouts"} />} />
          <StatTile label="Net profit" icon={<Banknote />} value={<SignedMoney value={k.netProfit.value} format={money} positiveTone />}
            hint={<KpiChange kpi={prevKpi(k.netProfit)} fallback="Gross profit − expenses − payment fees ± other entries" />} />
        </>}
      </section>

      <section aria-label="Sales" className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", loading && data && "opacity-60")}>
        {!k || !m ? <TileSkeletons /> : <>
          <StatTile label="Order volume" icon={<ShoppingBag />} value={money(m.orders.volume || k.orderVolume.value)}
            hint={<KpiChange kpi={prevKpi(k.orderVolume)} fallback={`${formatNumber(m.orders.count)} order${m.orders.count === 1 ? "" : "s"} placed, not cancelled`} />} />
          <StatTile label="Net cash flow" icon={<Scale />} value={<SignedMoney value={k.netCashFlow.value} format={money} positiveTone />}
            hint={`In ${money(k.moneyIn.value)} · out ${money(k.moneyOut.value)} (excl. transfers)`} />
          <StatTile label="Payment fees" icon={<CreditCard />} value={money(fees?.total ?? k.paymentFees.value)}
            hint={<KpiChange kpi={prevKpi(k.paymentFees)} invert fallback={`Estimated on ${formatNumber(fees?.count ?? 0)} payment${fees?.count === 1 ? "" : "s"}`} />} />
          <StatTile label={refunds?.label || `Refunds in ${periodName}`} icon={<Undo2 />} value={money(refunds?.refunded ?? 0)}
            hint={`Refunded ${money(refunds?.refunded ?? 0)} · Awaiting ${money(refunds?.awaiting ?? 0)}`} />
        </>}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Product profit coverage"
          description="Profit is only known for sales of products with a cost price."
          actions={<Button type="button" variant="outline" size="sm" onClick={() => setSetCosts(true)} disabled={!cov}>Set costs</Button>}>
          {!cov ? <Skeleton className="h-36" /> : (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums">{formatPct(cov.costedPct)}</p>
                  <p className="text-sm text-muted-foreground">of product sales have a cost</p>
                </div>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label="Costed, uncosted and excluded product sales">
                  {cov.productSales > 0 && <>
                    <div className="bg-emerald-500" style={{ width: `${(cov.costed / cov.productSales) * 100}%` }} />
                    <div className="bg-amber-500" style={{ width: `${(cov.uncosted / cov.productSales) * 100}%` }} />
                    <div className="bg-slate-400" style={{ width: `${(cov.excluded / cov.productSales) * 100}%` }} />
                  </>}
                </div>
              </div>
              <InfoList>
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-emerald-500" aria-hidden />Costed sales</span>} value={<span className="tabular-nums">{money(cov.costed)}</span>} />
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-amber-500" aria-hidden />Uncosted sales{cov.productsWithoutCost ? ` · ${formatNumber(cov.productsWithoutCost)} products without cost` : ""}</span>} value={<span className="tabular-nums">{money(cov.uncosted)}</span>} />
                <InfoRow label={<span className="flex items-center gap-2"><span className="size-2.5 rounded-sm bg-slate-400" aria-hidden />Not included (custom lines without a product)</span>} value={<span className="tabular-nums">{money(cov.excluded)}</span>} />
                <InfoRow className="border-t pt-2" label={<span className="font-medium text-foreground">= Product sales</span>}
                  value={<span className={cn("tabular-nums", !covAddsUp && "text-destructive")}>{money(cov.productSales)}</span>} />
              </InfoList>
              {!covAddsUp && <p className="text-xs text-destructive">The parts add up to {money(covSum)}, not {money(cov.productSales)}. See Reports → Health checks.</p>}
            </div>
          )}
        </SectionCard>
        <SectionCard title="Payment fees by method" description="Estimated from the fee settings on Transactions."
          actions={<Button asChild variant="link" size="sm"><Link href={fl("/dashboard/finance/transactions?fees=1")} prefetch={false}>Fee settings</Link></Button>}>
          {!fees ? <Skeleton className="h-36" /> : (
            <MixBars items={fees.byMethod.filter((f) => f.fee > 0).map((f) => ({ label: f.label, value: f.fee, hint: `${formatNumber(f.count)} on ${money(f.gross)}` }))}
              format={money} empty="No payment fees in this period. Set fee rates per method to estimate them." />
          )}
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <SectionCard title="Money in vs out" description={data ? `By ${data.cashFlow.granularity}` : undefined}>
          {!data ? <Skeleton className="h-[200px]" /> : <InOutChart buckets={data.cashFlow.points.map((p) => ({ label: p.label, in: p.moneyIn, out: p.moneyOut }))} format={money} />}
        </SectionCard>
        <SectionCard title="Expenses by category" actions={<Button asChild variant="link" size="sm"><Link href={fl("/dashboard/expenses")} prefetch={false}>All expenses</Link></Button>}>
          {!data ? <Skeleton className="h-[200px]" /> : (
            <MixBars items={data.expensesByCategory.map((c) => ({ label: c.name, value: c.amount, hint: c.pct ? `${Math.round(c.pct)}%` : undefined, color: c.color ?? undefined }))} format={money} empty="No expenses in this period." />
          )}
        </SectionCard>
      </div>

      {/* ── Point-in-time figures ── */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <h2 className="text-lg font-semibold">Balances</h2>
        <AsOfNowLabel />
        <span className="text-sm text-muted-foreground">{data?.context.asOf ? `Today, ${fmt.date(data.context.asOf)} · not affected by the period` : "Not affected by the period"}</span>
      </div>

      <section aria-label="Balances" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {!data || !k ? <TileSkeletons /> : <>
          <SectionCard title="Cash on hand" description="All active accounts"
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>Accounts <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums"><SignedMoney value={k.cashOnHand.value} format={money} /></p>
            <MixBars items={data.accountBalances.map((a) => ({ label: a.name, hint: accountTypeLabel(a.type), value: a.balance }))} format={money} empty="No accounts yet." limit={5} />
          </SectionCard>
          <SectionCard title="Owed to you" description="Receivables"
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/receivables")} prefetch={false}>Collect <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums">{money(data.receivables.total + data.payables.supplierCredits)}</p>
            <InfoList>
              <InfoRow label="Owed by customers" value={<span className="tabular-nums">{money(data.receivables.customerDues + data.receivables.codWithCouriers)}</span>} />
              <InfoRow label="· of which COD with couriers" className="pl-3 text-xs" value={<span className="tabular-nums">{money(data.receivables.codWithCouriers)}</span>} />
              <InfoRow label="Tailor order balances" value={<span className="tabular-nums">{money(data.receivables.tailorBalances)}</span>} />
              <InfoRow label="Suppliers owe you" value={<span className="tabular-nums">{money(data.payables.supplierCredits)}</span>} />
            </InfoList>
          </SectionCard>
          <SectionCard title="You owe" description="Payables"
            actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/payouts")} prefetch={false}>Pay <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <p className="mb-3 text-2xl font-semibold tabular-nums">{money(data.payables.total)}</p>
            <InfoList>
              <InfoRow label="Supplier dues" value={<span className="tabular-nums">{money(data.payables.supplierDues)}</span>} />
              <InfoRow label="Unpaid salaries" value={<span className="tabular-nums">{money(data.payables.unpaidSalaries)}</span>} />
              <InfoRow label="Owed to dorjis" value={<span className="tabular-nums">{money(data.payables.dorjiOwed)}</span>} />
            </InfoList>
          </SectionCard>
          <SectionCard title="Store credit" description="Owed to customers (liability)"
            actions={data.storeCredit.href ? <Button asChild variant="ghost" size="sm"><Link href={data.storeCredit.href} prefetch={false}>Customers <ArrowRight className="size-4" aria-hidden /></Link></Button> : undefined}>
            <p className="mb-1 text-2xl font-semibold tabular-nums">{money(data.storeCredit.total)}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              {formatNumber(data.storeCredit.customers)} customer{data.storeCredit.customers === 1 ? "" : "s"} with credit
              <TooltipIcon label="About store credit" content="Credit customers can spend on future orders. It is money you owe them, so it is not counted as income." />
            </p>
          </SectionCard>
        </>}
      </section>

      <SectionCard title="Recent transactions" contentClassName="px-2"
        actions={<Button asChild variant="ghost" size="sm"><Link href={fl("/dashboard/finance/transactions")} prefetch={false}>View all <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
        {!data ? <Skeleton className="mx-4 h-[160px]" /> : data.recentTransactions.length === 0 ? (
          <EmptyState icon={Banknote} title="No transactions yet" description="Sale payments, expenses and transfers show up here." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Details</TableHead><TableHead>Account</TableHead>
                  <TableHead className="text-right">Fee</TableHead><TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.slice(0, 10).map((r) => {
                  const title = r.party || r.reference || r.sourceLabel || sourceLabel(r.sourceType)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.date(r.date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.link ? <Link href={r.link.href} className="hover:underline">{title}</Link> : title}</div>
                        <div className="text-xs text-muted-foreground">{r.sourceLabel || sourceLabel(r.sourceType)}{r.reference && r.party ? ` · ${r.reference}` : ""}</div>
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
          All amounts in {data.context.currency?.code ?? fmt.currencyCode}. Dates in {data.context.tz ?? fmt.tz}.
        </p>
      )}

      <SetCostsDialog open={setCosts} onClose={() => setSetCosts(false)} period={filters.params} />
    </div>
  )
}
