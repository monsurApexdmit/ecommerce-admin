"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { BarChart3, Download, Lock, Printer } from "lucide-react"
import { toast } from "sonner"
import financeApi, {
  financeError, type AgingReport, type CashflowReport, type FinanceAccount, type HealthResult, type PnlFigures, type PnlReport, type StatementReport, type TaxReport,
} from "@/lib/financeApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { Toolbar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import {
  AgingBar, ChangeHint, CurrencyTag, DirectionAmount, InOutChart, MixBars, SignedMoney, TileSkeletons, csvMoney, downloadCsv, fmtDate, sourceLabel, useFinanceFormat,
} from "@/components/finance/finance-ui"
import { AsOfNowLabel, FinanceFilters, useFinanceFilters } from "@/components/finance/finance-filters"
import { MonthClosePanel } from "@/components/finance/reports-month-close"
import { HealthChecks } from "@/components/finance/reports-health"

type ReportTab = "pnl" | "cashflow" | "statement" | "tax" | "aging" | "close" | "health"
const TABS: [ReportTab, string][] = [
  ["pnl", "Profit and loss"], ["cashflow", "Cash flow"], ["statement", "Account statement"], ["tax", "Tax summary"], ["aging", "Receivables and payables"],
  ["close", "Month-end close"], ["health", "Health checks"],
]
const TAB_IDS = new Set<string>(TABS.map(([id]) => id))
/** Tabs that use the period / channel filter. */
const PERIOD_TABS = new Set<ReportTab>(["pnl", "cashflow", "statement", "tax", "health"])
const CHANNEL_TABS = new Set<ReportTab>(["pnl", "cashflow", "tax", "health"])
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`)
const changeText = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`)

type CsvRow = Record<string, string | number | null | undefined>
const rowsCsv = (name: string, headers: string[], rows: CsvRow[]) =>
  downloadCsv<CsvRow>(name, headers.map((h) => [h, (r: CsvRow) => r[h]] as [string, (r: CsvRow) => string | number | null | undefined]), rows)

export default function FinanceReportsPage() {
  const blocked = useModuleGuard("Finance")
  const { formatCurrency } = useCompanySettings()
  const { canRead } = useSaasAuth()
  const money = (n: number) => formatCurrency(n)
  const f = useFinanceFormat()

  // Tab lives in ?tab= (deep links like ?tab=close from Overview); written with replaceState (no RSC request)
  const [tab, setTabState] = useState<ReportTab>("pnl")
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab")
    if (t && TAB_IDS.has(t)) setTabState(t as ReportTab)
  }, [])
  const setTab = (t: ReportTab) => {
    setTabState(t)
    const sp = new URLSearchParams(window.location.search)
    sp.set("tab", t)
    window.history.replaceState(window.history.state, "", `${window.location.pathname}?${sp.toString()}`)
  }
  const filters = useFinanceFilters()
  const [compare, setCompare] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [pnl, setPnl] = useState<PnlReport | null>(null)
  const [cash, setCash] = useState<CashflowReport | null>(null)
  const [cashPrev, setCashPrev] = useState<CashflowReport | null>(null)
  const [tax, setTax] = useState<TaxReport | null>(null)
  const [taxPrev, setTaxPrev] = useState<TaxReport | null>(null)
  const [aging, setAging] = useState<AgingReport | null>(null)
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [stmt, setStmt] = useState<StatementReport | null>(null)
  const [accounts, setAccounts] = useState<FinanceAccount[]>([])
  const [accountId, setAccountId] = useState("")

  useEffect(() => {
    financeApi.getAccounts().then((r) => {
      setAccounts(r.accounts)
      const def = r.accounts.find((a) => a.isDefault) ?? r.accounts[0]
      if (def) setAccountId((cur) => cur || String(def.id))
    }).catch(() => {})
  }, [])

  const { ready, incomplete, key: filterKey } = filters
  const params = filters.params
  const periodOnly = filters.periodParams
  const channel = params.channel

  const latest = useRef(0)
  const load = useCallback(async () => {
    if (!ready || tab === "close") { setLoading(false); return }
    if (incomplete && PERIOD_TABS.has(tab)) { setLoading(false); return }
    const id = ++latest.current
    setLoading(true); setError("")
    try {
      if (tab === "pnl") {
        const r = await financeApi.getPnl({ ...params, compare: compare ? "previous" : "none" })
        if (id === latest.current) setPnl(r)
      } else if (tab === "cashflow") {
        const cur = await financeApi.getCashflow(params)
        const p = cur.period
        const prev = compare && p?.previousFrom && p.previousTo ? await financeApi.getCashflow({ from: p.previousFrom, to: p.previousTo, channel }) : null
        if (id === latest.current) { setCash(cur); setCashPrev(prev) }
      } else if (tab === "tax") {
        const cur = await financeApi.getTax(params)
        const p = cur.period
        const prev = compare && p?.previousFrom && p.previousTo ? await financeApi.getTax({ from: p.previousFrom, to: p.previousTo, channel }) : null
        if (id === latest.current) { setTax(cur); setTaxPrev(prev) }
      } else if (tab === "aging") {
        const r = await financeApi.getAging()
        if (id === latest.current) setAging(r)
      } else if (tab === "health") {
        const r = await financeApi.getHealth(params)
        if (id === latest.current) setHealth(r)
      } else if (tab === "statement") {
        if (!accountId) { setStmt(null); return }
        const r = await financeApi.getStatement({ ...periodOnly, accountId: Number(accountId) })
        if (id === latest.current) setStmt(r)
      }
    } catch (e) {
      if (id === latest.current) setError(financeError(e, "Could not load this report."))
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [tab, filterKey, compare, accountId, incomplete, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const periodInfo = tab === "pnl" ? pnl?.period : tab === "cashflow" ? cash?.period : tab === "tax" ? tax?.period : tab === "statement" ? stmt?.period : tab === "health" ? health?.context.period : null
  const ctx = tab === "pnl" ? pnl?.context : tab === "cashflow" ? cash?.context : tab === "tax" ? tax?.context : tab === "health" ? health?.context : null
  const range = (a?: string | null, b?: string | null) => (a ? `${f.date(a)} – ${f.date(b)}` : "")
  const periodText = tab === "aging"
    ? `As of ${f.date(aging?.asOf ?? null)}`
    : tab === "close"
      ? "Lock months you have filed so their figures stop moving"
      : periodInfo
        ? `${periodInfo.from ? range(periodInfo.from, periodInfo.to) : periodInfo.label}${compare && periodInfo.previousFrom && tab !== "statement" && tab !== "health" ? ` · compared with ${range(periodInfo.previousFrom, periodInfo.previousTo)}` : ""}${ctx && ctx.channel !== "all" ? ` · ${ctx.channelLabel}` : ""}`
        : filters.label

  // ── CSV ──
  const exportCsv = () => {
    try {
      if (tab === "pnl" && pnl) {
        const c = pnl.current, p = pnl.previous
        const line = (label: string, cur: number, prev?: number | null, ch?: number | null): CsvRow => ({ Line: label, Amount: csvMoney(cur), Previous: p ? csvMoney(prev ?? 0) : "", Change: ch != null ? changeText(ch) : "" })
        const rows: CsvRow[] = [
          line("Revenue", c.revenue, p?.revenue, pnl.changes?.revenue),
          line("Cost of goods sold", c.cogs, p?.cogs, pnl.changes?.cogs),
          line("Gross profit", c.grossProfit, p?.grossProfit, pnl.changes?.grossProfit),
          ...c.expensesByCategory.map((e) => line(`Expense: ${e.name}`, e.amount, p?.expensesByCategory.find((x) => x.name === e.name)?.amount ?? 0)),
          line("Total expenses", c.expenses, p?.expenses, pnl.changes?.expenses),
          line("Other income", c.otherIncome, p?.otherIncome),
          line("Other expenses", c.otherExpenses, p?.otherExpenses),
          line("Payment fees (estimated)", c.paymentFees, p?.paymentFees),
          line("Net profit", c.netProfit, p?.netProfit, pnl.changes?.netProfit),
        ]
        rowsCsv("profit-and-loss", ["Line", "Amount", "Previous", "Change"], rows)
      } else if (tab === "cashflow" && cash) {
        rowsCsv("cash-flow", ["Section", "Name", "Opening", "Money in", "Money out", "Transfers in", "Transfers out", "Closing"], [
          ...cash.bySource.map((s) => ({ Section: "By source", Name: s.label || sourceLabel(s.sourceType), "Money in": csvMoney(s.moneyIn), "Money out": csvMoney(s.moneyOut) })),
          ...cash.byAccount.map((a) => ({
            Section: "By account", Name: a.name, Opening: csvMoney(a.openingBalance), "Money in": csvMoney(a.moneyIn), "Money out": csvMoney(a.moneyOut),
            "Transfers in": csvMoney(a.transfersIn), "Transfers out": csvMoney(a.transfersOut), Closing: csvMoney(a.closingBalance),
          })),
          { Section: "Total", Name: "All accounts", Opening: csvMoney(cash.openingBalance), "Money in": csvMoney(cash.moneyIn), "Money out": csvMoney(cash.moneyOut), Closing: csvMoney(cash.closingBalance) },
        ])
      } else if (tab === "statement" && stmt) {
        rowsCsv(`statement-${(stmt.account?.name ?? "account").toLowerCase().replace(/\s+/g, "-")}`, ["Date", "Type", "Party", "Reference", "Money in", "Money out", "Balance"], [
          { Date: periodInfo?.from ?? "", Type: "Opening balance", Balance: csvMoney(stmt.openingBalance) },
          ...stmt.rows.map((r) => ({
            Date: r.date, Type: r.sourceLabel || sourceLabel(r.sourceType), Party: r.party ?? r.note ?? "", Reference: r.reference ?? "",
            "Money in": r.direction === "in" ? csvMoney(r.amount) : "", "Money out": r.direction === "out" ? csvMoney(r.amount) : "", Balance: r.runningBalance != null ? csvMoney(r.runningBalance) : "",
          })),
          { Date: periodInfo?.to ?? "", Type: "Closing balance", "Money in": csvMoney(stmt.moneyIn), "Money out": csvMoney(stmt.moneyOut), Balance: csvMoney(stmt.closingBalance) },
        ])
      } else if (tab === "tax" && tax) {
        rowsCsv("tax-summary", ["Group", "Label", "Orders", "Taxable amount", "Tax"], [
          ...tax.byRate.map((r) => ({ Group: "By rate", Label: taxRateLabel(r), Orders: r.orders, "Taxable amount": csvMoney(r.taxableAmount), Tax: csvMoney(r.tax) })),
          ...(tax.notBrokenDown ? [{ Group: "By rate", Label: tax.notBrokenDown.label, Orders: tax.notBrokenDown.orders, "Taxable amount": csvMoney(tax.notBrokenDown.taxableAmount), Tax: csvMoney(tax.notBrokenDown.tax) }] : []),
          ...tax.byMonth.map((m) => ({ Group: "By month", Label: m.label, Orders: m.orders, "Taxable amount": csvMoney(m.taxableAmount), Tax: csvMoney(m.tax) })),
          { Group: "Total", Label: `Tax collected (${tax.context.currency?.code ?? ""})`, Orders: tax.taxedOrders, "Taxable amount": csvMoney(tax.taxableSales), Tax: csvMoney(tax.taxCollected) },
        ])
      } else if (tab === "health" && health) {
        rowsCsv("health-checks", ["Check", "Title", "Status", "Expected", "Actual", "Difference", "Explanation"], health.checks.map((c) => ({
          Check: c.id, Title: c.title, Status: c.status, Expected: c.expected != null ? csvMoney(c.expected) : "", Actual: c.actual != null ? csvMoney(c.actual) : "",
          Difference: c.difference != null ? csvMoney(c.difference) : "", Explanation: c.explanation,
        })))
      } else if (tab === "aging" && aging) {
        const labels = aging.receivables.buckets.map((b) => b.label)
        rowsCsv("aging", ["Side", "Name", "Due", "Age days", "Bucket", "Overdue"], [
          ...aging.receivables.customers.map((c) => ({ Side: "Receivable", Name: c.name, Due: csvMoney(c.due), "Age days": c.ageDays, Bucket: labels[c.bucket] ?? c.bucket })),
          ...aging.payables.suppliers.map((s) => ({ Side: "Payable", Name: s.name, Due: csvMoney(s.due), "Age days": s.ageDays, Bucket: aging.payables.buckets[s.bucket]?.label ?? s.bucket, Overdue: s.overdue ? "Yes" : "" })),
        ])
      } else {
        toast.error("Nothing to export yet.")
      }
    } catch {
      toast.error("Export failed")
    }
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Reports"
        description={<span className="inline-flex flex-wrap items-center gap-2">{periodText}{tab === "aging" && <AsOfNowLabel />}<CurrencyTag code={ctx?.currency?.code} /></span>}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          {canRead("Reports") && <Button asChild variant="outline"><Link href="/dashboard/reports"><BarChart3 className="size-4" aria-hidden /> Sales &amp; stock reports</Link></Button>}
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> Print</Button>
          {tab !== "close" && <Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" aria-hidden /> Export CSV</Button>}
        </div>}
      />

      <Toolbar className="gap-3 print:hidden"
        actions={(tab === "pnl" || tab === "cashflow" || tab === "tax") && (
          <div className="flex items-center gap-2">
            <Switch id="report-compare" checked={compare} onCheckedChange={setCompare} />
            <Label htmlFor="report-compare" className="text-sm font-normal">Compare with previous period</Label>
          </div>
        )}
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
          <TabsList aria-label="Report" className="h-auto flex-wrap">
            {TABS.map(([id, label]) => <TabsTrigger key={id} value={id}>{label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {PERIOD_TABS.has(tab) && <FinanceFilters filters={filters} channel={CHANNEL_TABS.has(tab)} idPrefix="report" />}
        {tab === "statement" && (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger aria-label="Account" className="w-48"><SelectValue placeholder="Choose account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.isActive ? "" : " (inactive)"}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Toolbar>

      <h2 className="hidden text-lg font-semibold print:block">{TABS.find(([id]) => id === tab)?.[1]}</h2>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {(tab === "pnl" && pnl?.closeStatus) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm print:hidden">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          <span>{pnl.closeStatus.text}</span>
          {pnl.closeStatus.suggestion && (
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setTab("close")}>{pnl.closeStatus.suggestion.text}</Button>
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-5", loading && "opacity-60")}>
        {tab === "pnl" && (pnl ? <PnlView report={pnl} money={money} /> : <ReportSkeleton />)}
        {tab === "cashflow" && (cash ? <CashflowView report={cash} prev={cashPrev} money={money} /> : <ReportSkeleton />)}
        {tab === "statement" && (!accountId ? <EmptyState title="Choose an account" description="Pick the account to see its statement." />
          : stmt ? <StatementView report={stmt} money={money} from={periodInfo?.from ?? null} to={periodInfo?.to ?? null} /> : <ReportSkeleton />)}
        {tab === "tax" && (tax ? <TaxView report={tax} prev={taxPrev} money={money} /> : <ReportSkeleton />)}
        {tab === "aging" && (aging ? <AgingView report={aging} money={money} /> : <ReportSkeleton />)}
        {tab === "close" && <MonthClosePanel onChanged={() => setPnl(null)} />}
        {tab === "health" && (health ? <HealthChecks report={health} /> : <ReportSkeleton />)}
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><TileSkeletons /></div>
      <Skeleton className="h-64" />
    </>
  )
}

// ─── Profit & loss ───────────────────────────────────────────────────────────

function PnlView({ report, money }: { report: PnlReport; money: (n: number) => string }) {
  const c = report.current, p = report.previous, ch = report.changes
  const prevCat = (name: string) => p?.expensesByCategory.find((e) => e.name === name)?.amount ?? 0
  const Line = ({ label, cur, prev, change, strong, indent, negative, invert }: {
    label: React.ReactNode; cur: number; prev?: number; change?: number | null; strong?: boolean; indent?: boolean; negative?: boolean; invert?: boolean
  }) => (
    <TableRow className={cn(strong && "bg-muted/40")}>
      <TableCell className={cn(indent && "pl-8 text-muted-foreground", strong && "font-semibold")}>{label}</TableCell>
      <TableCell className={cn("text-right tabular-nums", strong && "font-semibold")}>
        {negative ? <span className="text-muted-foreground">({money(cur)})</span> : <SignedMoney value={cur} format={money} />}
      </TableCell>
      {p && <TableCell className="text-right tabular-nums text-muted-foreground">{negative ? `(${money(prev ?? 0)})` : money(prev ?? 0)}</TableCell>}
      {p && (
        <TableCell className="text-right text-xs">
          {change !== undefined ? (
            change == null ? <span className="text-muted-foreground">—</span>
              : <span className={cn(change === 0 ? "text-muted-foreground" : (invert ? change < 0 : change > 0) ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{changeText(change)}</span>
          ) : <ChangeHintPlain cur={cur} prev={prev ?? 0} invert={invert} />}
        </TableCell>
      )}
    </TableRow>
  )

  return (
    <>
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Revenue" value={money(c.revenue)} hint={p ? <ChangeHint current={c.revenue} previous={p.revenue} /> : `${c.info.orders} orders`} />
        <StatTile label="Gross profit" value={<SignedMoney value={c.grossProfit} format={money} />} hint={`Margin ${pct(c.grossMarginPct)}`} />
        <StatTile label="Expenses" value={money(c.expenses)} hint={p ? <ChangeHint current={c.expenses} previous={p.expenses} invert /> : `${c.expensesByCategory.length} categories`} />
        <StatTile label="Net profit" value={<SignedMoney value={c.netProfit} format={money} positiveTone />} hint={`Margin ${pct(c.netMarginPct)}`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] print:grid-cols-1">
        <SectionCard title="Statement" contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead><TableHead className="text-right">This period</TableHead>
                  {p && <TableHead className="text-right">Previous</TableHead>}{p && <TableHead className="text-right">Change</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <Line label="Revenue" cur={c.revenue} prev={p?.revenue} change={ch?.revenue} />
                <Line label="Cost of goods sold" cur={c.cogs} prev={p?.cogs} change={ch?.cogs} negative invert />
                <Line label={<>Gross profit <span className="font-normal text-muted-foreground">· {pct(c.grossMarginPct)}</span></>} cur={c.grossProfit} prev={p?.grossProfit} change={ch?.grossProfit} strong />
                {c.expensesByCategory.map((e) => <Line key={e.name} label={e.name} cur={e.amount} prev={prevCat(e.name)} negative indent invert />)}
                <Line label="Total expenses" cur={c.expenses} prev={p?.expenses} change={ch?.expenses} negative invert />
                {(c.otherIncome > 0 || (p?.otherIncome ?? 0) > 0) && <Line label="Other income" cur={c.otherIncome} prev={p?.otherIncome} />}
                {(c.otherExpenses > 0 || (p?.otherExpenses ?? 0) > 0) && <Line label="Other expenses" cur={c.otherExpenses} prev={p?.otherExpenses} negative invert />}
                {(c.paymentFees > 0 || (p?.paymentFees ?? 0) > 0) && <Line label="Payment fees (estimated)" cur={c.paymentFees} prev={p?.paymentFees} negative invert />}
                <Line label={<>Net profit <span className="font-normal text-muted-foreground">· {pct(c.netMarginPct)}</span></>} cur={c.netProfit} prev={p?.netProfit} change={ch?.netProfit} strong />
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            Included in revenue (not deducted again): tax {money(c.info.tax)}, shipping {money(c.info.shipping)}, discounts given {money(c.info.discounts)}.
            Customer refunds paid in the period: {money(c.info.refunds)}. Other income / expenses are manual entries from Transactions.
            {c.voidedExpenses > 0 && <> Expenses are net of {money(c.voidedExpenses)} voided in this period (a void counts in the month it is posted, so closed months never change).</>}
            {c.paymentFees > 0 && <> Payment fees are estimates from the payment-method fee settings.</>}
          </p>
        </SectionCard>
        <SectionCard title="Expenses by category" className="print:break-inside-avoid">
          <MixBars items={c.expensesByCategory.map((e) => ({ label: e.name, value: e.amount, color: e.color ?? undefined }))} format={money} empty="No expenses in this period." />
        </SectionCard>
      </div>

      {report.months.length > 1 && (
        <SectionCard title="By month" contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead><TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">COGS</TableHead><TableHead className="text-right">Gross profit</TableHead>
                  <TableHead className="text-right">Expenses</TableHead><TableHead className="text-right">Other ±</TableHead><TableHead className="text-right">Net profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.months.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">
                      {m.label}
                      {m.closed && <Badge variant="secondary" className="ml-2 gap-1"><Lock className="size-3" aria-hidden /> Closed</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(m.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(m.cogs)}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={m.grossProfit} format={money} /></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(m.expenses)}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={m.otherIncome - m.otherExpenses} format={money} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      <SignedMoney value={m.netProfit} format={money} positiveTone />
                      {m.closed && m.netAtClose != null && Math.abs(m.netAtClose - m.netProfit) >= 0.005 && (
                        <div className="text-xs font-normal text-muted-foreground">At close <SignedMoney value={m.netAtClose} format={money} /></div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      )}
    </>
  )
}

function ChangeHintPlain({ cur, prev, invert }: { cur: number; prev: number; invert?: boolean }) {
  if (!prev) return <span className="text-muted-foreground">—</span>
  const v = ((cur - prev) / Math.abs(prev)) * 100
  return <span className={cn(v === 0 ? "text-muted-foreground" : (invert ? v < 0 : v > 0) ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{changeText(v)}</span>
}

// ─── Cash flow ───────────────────────────────────────────────────────────────

function CashflowView({ report: r, prev, money }: { report: CashflowReport; prev: CashflowReport | null; money: (n: number) => string }) {
  return (
    <>
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Opening balance" value={<SignedMoney value={r.openingBalance} format={money} />} hint="All accounts" />
        <StatTile label="Money in" value={<span className="text-emerald-600 dark:text-emerald-400">{money(r.moneyIn)}</span>} hint={prev ? <ChangeHint current={r.moneyIn} previous={prev.moneyIn} /> : "Excludes transfers"} />
        <StatTile label="Money out" value={<span className="text-destructive">{money(r.moneyOut)}</span>} hint={prev ? <ChangeHint current={r.moneyOut} previous={prev.moneyOut} invert /> : "Excludes transfers"} />
        <StatTile label="Closing balance" value={<SignedMoney value={r.closingBalance} format={money} />} hint={<>Net <SignedMoney value={r.net} format={money} positiveTone /></>} />
      </section>

      <SectionCard title="Money in vs out" description={`By ${r.granularity}`} className="print:break-inside-avoid">
        <InOutChart buckets={r.series.map((p) => ({ label: p.label, in: p.moneyIn, out: p.moneyOut }))} format={money} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-1">
        <SectionCard title="By source" contentClassName="px-2" className="print:break-inside-avoid">
          {r.bySource.length === 0 ? <p className="px-2 text-sm text-muted-foreground">No money moved in this period.</p> : (
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow><TableHead>Source</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Net</TableHead>{prev && <TableHead className="text-right">Previous net</TableHead>}</TableRow>
                </TableHeader>
                <TableBody>
                  {r.bySource.map((s) => (
                    <TableRow key={s.sourceType}>
                      <TableCell className="font-medium">{s.label || sourceLabel(s.sourceType)} <span className="text-xs font-normal text-muted-foreground">· {s.count}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{s.moneyIn ? money(s.moneyIn) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.moneyOut ? money(s.moneyOut) : "—"}</TableCell>
                      <TableCell className="text-right"><SignedMoney value={s.net} format={money} /></TableCell>
                      {prev && <TableCell className="text-right text-muted-foreground"><SignedMoney value={prev.bySource.find((x) => x.sourceType === s.sourceType)?.net ?? 0} format={money} /></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{money(r.moneyIn)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{money(r.moneyOut)}</TableCell>
                    <TableCell className="text-right font-bold"><SignedMoney value={r.net} format={money} /></TableCell>
                    {prev && <TableCell className="text-right font-bold"><SignedMoney value={prev.net} format={money} /></TableCell>}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}
        </SectionCard>
        <SectionCard title="By account" contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow><TableHead>Account</TableHead><TableHead className="text-right">Opening</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead><TableHead className="text-right">Transfers</TableHead><TableHead className="text-right">Closing</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {r.byAccount.map((a) => (
                  <TableRow key={a.accountId}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={a.openingBalance} format={money} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(a.moneyIn)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(a.moneyOut)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground"><SignedMoney value={a.transfersIn - a.transfersOut} format={money} /></TableCell>
                    <TableCell className="text-right font-semibold"><SignedMoney value={a.closingBalance} format={money} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">All accounts</TableCell>
                  <TableCell className="text-right font-bold"><SignedMoney value={r.openingBalance} format={money} /></TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{money(r.moneyIn)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{money(r.moneyOut)}</TableCell>
                  <TableCell className="text-right font-bold text-muted-foreground">—</TableCell>
                  <TableCell className="text-right font-bold"><SignedMoney value={r.closingBalance} format={money} /></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </SectionCard>
      </div>
    </>
  )
}

// ─── Account statement ───────────────────────────────────────────────────────

function StatementView({ report: r, money, from, to }: { report: StatementReport; money: (n: number) => string; from: string | null; to: string | null }) {
  return (
    <>
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Opening balance" value={<SignedMoney value={r.openingBalance} format={money} />} hint={r.account?.name} />
        <StatTile label="Money in" value={<span className="text-emerald-600 dark:text-emerald-400">{money(r.moneyIn)}</span>} hint="Incl. transfers in" />
        <StatTile label="Money out" value={<span className="text-destructive">{money(r.moneyOut)}</span>} hint="Incl. transfers out" />
        <StatTile label="Closing balance" value={<SignedMoney value={r.closingBalance} format={money} />} hint={`${r.rows.length} lines`} />
      </section>
      {r.truncated && <Alert><AlertDescription>Only the first 5,000 lines are shown. Totals and balances include everything.</AlertDescription></Alert>}
      <SectionCard title={r.account ? `${r.account.name} statement` : "Statement"} contentClassName="px-2">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Details</TableHead><TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="text-muted-foreground">{from ? fmtDate(from) : "—"}</TableCell>
                <TableCell colSpan={4} className="font-semibold">Opening balance</TableCell>
                <TableCell className="text-right font-semibold"><SignedMoney value={r.openingBalance} format={money} /></TableCell>
              </TableRow>
              {r.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{fmtDate(row.date)}</TableCell>
                  <TableCell><Badge variant="outline">{row.sourceLabel || sourceLabel(row.sourceType)}</Badge></TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="truncate">{row.party ?? row.category ?? "—"}</div>
                    {row.note && <div className="truncate text-xs text-muted-foreground">{row.note}</div>}
                  </TableCell>
                  <TableCell>{row.link ? <Link href={row.link.href} className="text-primary hover:underline">{row.reference || "Open"}</Link> : (row.reference || "—")}</TableCell>
                  <TableCell className="text-right"><DirectionAmount direction={row.direction} amount={row.amount} format={money} /></TableCell>
                  <TableCell className="text-right">{row.runningBalance != null ? <SignedMoney value={row.runningBalance} format={money} /> : "—"}</TableCell>
                </TableRow>
              ))}
              {r.rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No transactions on this account in the period.</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">{to ? fmtDate(to) : ""}</TableCell>
                <TableCell colSpan={4} className="font-bold">Closing balance</TableCell>
                <TableCell className="text-right font-bold"><SignedMoney value={r.closingBalance} format={money} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </SectionCard>
    </>
  )
}

// ─── Tax ─────────────────────────────────────────────────────────────────────

/** "VAT 15%" (server name), else "Tax 15%". */
const taxRateLabel = (r: TaxReport["byRate"][number]) => r.label || r.name || (r.rate == null ? "Other" : `Tax ${r.rate}%`)

function TaxTable({ title, first, rows, total, money }: {
  title: string; first: string
  rows: { key: string; label: string; orders: number; taxable: number; tax: number; muted?: boolean }[]
  total: { orders: number; taxable: number; tax: number; label: string }
  money: (n: number) => string
}) {
  return (
    <SectionCard title={title} contentClassName="px-2" className="print:break-inside-avoid">
      {rows.length === 0 ? <p className="px-2 text-sm text-muted-foreground">No tax charged in this period.</p> : (
        <div className="overflow-x-auto">
          <Table className="min-w-[420px]">
            <TableHeader>
              <TableRow><TableHead>{first}</TableHead><TableHead className="text-right">Orders</TableHead><TableHead className="text-right">Taxable</TableHead><TableHead className="text-right">Tax</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((x) => (
                <TableRow key={x.key}>
                  <TableCell className={cn("font-medium", x.muted && "font-normal text-muted-foreground")}>{x.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{x.orders}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(x.taxable)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(x.tax)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">{total.label}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{total.orders}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{money(total.taxable)}</TableCell>
                <TableCell className="text-right font-bold tabular-nums">{money(total.tax)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </SectionCard>
  )
}

function TaxView({ report: r, prev, money }: { report: TaxReport; prev: TaxReport | null; money: (n: number) => string }) {
  const code = r.context.currency?.code
  const rateRows = [
    ...r.byRate.map((x) => ({ key: `r-${x.rate ?? "none"}-${x.name ?? ""}`, label: taxRateLabel(x), orders: x.orders, taxable: x.taxableAmount, tax: x.tax })),
    ...(r.notBrokenDown && r.notBrokenDown.tax !== 0
      ? [{ key: "not-broken-down", label: r.notBrokenDown.label, orders: r.notBrokenDown.orders, taxable: r.notBrokenDown.taxableAmount, tax: r.notBrokenDown.tax, muted: true }]
      : []),
  ]
  const rateSum = rateRows.reduce((n, x) => n + x.tax, 0)
  const gap = Math.round((r.taxCollected - rateSum) * 100) / 100
  const total = { orders: r.taxedOrders, taxable: r.taxableSales, tax: r.taxCollected, label: `Tax collected${code ? ` (${code})` : ""}` }
  return (
    <>
      <section aria-label="Summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Tax collected" value={money(r.taxCollected)} hint={prev ? <ChangeHint current={r.taxCollected} previous={prev.taxCollected} /> : "On non-cancelled sales"} />
        <StatTile label="Taxable sales" value={money(r.taxableSales)} hint="Sale amount − tax, taxed sales only" />
        <StatTile label="Effective rate" value={pct(r.effectiveRatePct)} hint={`Of ${money(r.salesTotal)} total sales`} />
        <StatTile label="Taxed orders" value={`${r.taxedOrders.toLocaleString("en-US")} / ${r.orders.toLocaleString("en-US")}`} hint="Taxed / all orders" />
      </section>
      {rateRows.length > 0 && Math.abs(gap) >= 0.01 && (
        <Alert><AlertDescription>The rates below add up to {money(rateSum)}, {money(Math.abs(gap))} {gap > 0 ? "less" : "more"} than tax collected. Run Health checks (R9) to see why.</AlertDescription></Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-1">
        <TaxTable title="By rate" first="Rate" rows={rateRows} total={total} money={money} />
        <TaxTable title="By month" first="Month" rows={r.byMonth.map((x) => ({ key: x.key, label: x.label, orders: x.orders, taxable: x.taxableAmount, tax: x.tax }))} total={total} money={money} />
      </div>
    </>
  )
}

// ─── Aging ───────────────────────────────────────────────────────────────────

function AgingView({ report: r, money }: { report: AgingReport; money: (n: number) => string }) {
  const sides = [
    {
      title: "Receivables", sub: "Owed to you", total: r.receivables.total, buckets: r.receivables.buckets, href: "/dashboard/finance/receivables", dues: "/dashboard/dues/customers",
      extras: [["COD with couriers (in customer dues)", r.receivables.codWithCouriers], ["Tailor order balances", r.receivables.tailorBalances]] as [string, number][],
      rows: r.receivables.customers.map((c) => ({ key: `c${c.partyId}`, name: c.name, due: c.due, age: c.ageDays, bucket: r.receivables.buckets[c.bucket]?.label ?? "", overdue: false })),
    },
    {
      title: "Payables", sub: "You owe", total: r.payables.total, buckets: r.payables.buckets, href: "/dashboard/finance/payouts", dues: "/dashboard/dues/vendors",
      extras: [["Unpaid salaries", r.payables.unpaidSalaries], ["Owed to dorjis", r.payables.dorjiOwed]] as [string, number][],
      rows: r.payables.suppliers.map((s) => ({ key: `s${s.partyId}`, name: s.name, due: s.due, age: s.ageDays, bucket: r.payables.buckets[s.bucket]?.label ?? "", overdue: s.overdue })),
    },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-1">
      {sides.map((s) => (
        <SectionCard key={s.title} title={`${s.title} · ${money(s.total)}`} description={<span className="inline-flex flex-wrap items-center gap-2">{s.sub}<AsOfNowLabel /></span>} className="print:break-inside-avoid" contentClassName="flex flex-col gap-5"
          actions={<Button asChild variant="ghost" size="sm" className="print:hidden"><Link href={s.href}>Open</Link></Button>}>
          <AgingBar buckets={s.buckets} format={money} />
          <dl className="grid gap-1 text-sm">
            {s.extras.map(([label, v]) => (
              <Fragment key={label}>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{money(v)}</dd></div>
              </Fragment>
            ))}
          </dl>
          <div className="-mx-4 overflow-x-auto">
            <Table className="min-w-[420px]">
              <TableHeader>
                <TableRow><TableHead>{s.title === "Receivables" ? "Customer" : "Supplier"}</TableHead><TableHead>Age</TableHead><TableHead className="text-right">Due</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}{row.overdue && <Badge variant="destructive" className="ml-2">Overdue</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{row.age} days <span className="text-xs">· {row.bucket}</span></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{money(row.due)}</TableCell>
                  </TableRow>
                ))}
                {s.rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">Nothing outstanding.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <Button asChild variant="link" size="sm" className="self-start px-0 print:hidden"><Link href={s.dues}>Full {s.title === "Receivables" ? "customer" : "supplier"} dues</Link></Button>
        </SectionCard>
      ))}
    </div>
  )
}
