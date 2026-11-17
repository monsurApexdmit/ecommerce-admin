"use client"

import { Fragment, useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
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
  AgingBar, ChangeHint, CurrencyTag, DirectionAmount, InOutChart, MixBars, SignedMoney, TileSkeletons, csvMoney, downloadCsv, useFinanceFormat,
} from "@/components/finance/finance-ui"
import { AsOfNowLabel, FinanceFilters, channelLabel, useFinanceFilters } from "@/components/finance/finance-filters"
import { FIN_NS, sourceText, type FinKey, type FinT } from "@/components/finance/i18n"
import { MonthClosePanel } from "@/components/finance/reports-month-close"
import { HealthChecks } from "@/components/finance/reports-health"

type ReportTab = "pnl" | "cashflow" | "statement" | "tax" | "aging" | "close" | "health"
const TABS: [ReportTab, FinKey][] = [
  ["pnl", "finance:reports.tabPnl"], ["cashflow", "finance:reports.tabCashflow"], ["statement", "finance:reports.tabStatement"], ["tax", "finance:reports.tabTax"],
  ["aging", "finance:reports.tabAging"], ["close", "finance:close.title"], ["health", "finance:health.title"],
]
const TAB_IDS = new Set<string>(TABS.map(([id]) => id))
/** Tabs that use the period / channel filter. */
const PERIOD_TABS = new Set<ReportTab>(["pnl", "cashflow", "statement", "tax", "health"])
const CHANNEL_TABS = new Set<ReportTab>(["pnl", "cashflow", "tax", "health"])
const pct = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`)
const changeText = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`)

type CsvRow = Record<string, string | number | null | undefined>
/** Rows keyed by stable field ids; `cols` maps each field to its (translated) header. */
const rowsCsv = (name: string, cols: [field: string, header: string][], rows: CsvRow[]) =>
  downloadCsv<CsvRow>(name, cols.map(([field, h]) => [h, (r: CsvRow) => r[field]] as [string, (r: CsvRow) => string | number | null | undefined]), rows)

export default function FinanceReportsPage() {
  const blocked = useModuleGuard("Finance")
  const { t } = useTranslation(FIN_NS)
  const { formatCurrency } = useCompanySettings()
  const { canRead } = useSaasAuth()
  const money = (n: number) => formatCurrency(n)
  const f = useFinanceFormat()

  // Tab lives in ?tab= (deep links like ?tab=close from Overview); written with replaceState (no RSC request)
  const [tab, setTabState] = useState<ReportTab>("pnl")
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("tab")
    if (q && TAB_IDS.has(q)) setTabState(q as ReportTab)
  }, [])
  const setTab = (next: ReportTab) => {
    setTabState(next)
    const sp = new URLSearchParams(window.location.search)
    sp.set("tab", next)
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
      if (id === latest.current) setError(financeError(e, t("finance:reports.loadFailed")))
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [tab, filterKey, compare, accountId, incomplete, ready]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const periodInfo = tab === "pnl" ? pnl?.period : tab === "cashflow" ? cash?.period : tab === "tax" ? tax?.period : tab === "statement" ? stmt?.period : tab === "health" ? health?.context.period : null
  const ctx = tab === "pnl" ? pnl?.context : tab === "cashflow" ? cash?.context : tab === "tax" ? tax?.context : tab === "health" ? health?.context : null
  const range = (a?: string | null, b?: string | null) => (a ? `${f.date(a)} – ${f.date(b)}` : "")
  const periodText = tab === "aging"
    ? t("finance:reports.asOf", { date: f.date(aging?.asOf ?? null) })
    : tab === "close"
      ? t("finance:reports.closeIntro")
      : periodInfo
        ? `${periodInfo.from ? range(periodInfo.from, periodInfo.to) : filters.label}${compare && periodInfo.previousFrom && tab !== "statement" && tab !== "health" ? ` · ${t("finance:overview.comparedWith", { range: range(periodInfo.previousFrom, periodInfo.previousTo) })}` : ""}${ctx && ctx.channel !== "all" ? ` · ${channelLabel(t, ctx.channel, ctx.channelLabel)}` : ""}`
        : filters.label

  // ── CSV ──
  const exportCsv = () => {
    try {
      if (tab === "pnl" && pnl) {
        const c = pnl.current, p = pnl.previous
        const line = (label: string, cur: number, prev?: number | null, ch?: number | null): CsvRow => ({ line: label, amount: csvMoney(cur), previous: p ? csvMoney(prev ?? 0) : "", change: ch != null ? changeText(ch) : "" })
        const rows: CsvRow[] = [
          line(t("finance:kpi.revenue"), c.revenue, p?.revenue, pnl.changes?.revenue),
          line(t("finance:kpi.cogs"), c.cogs, p?.cogs, pnl.changes?.cogs),
          line(t("finance:kpi.grossProfit"), c.grossProfit, p?.grossProfit, pnl.changes?.grossProfit),
          ...c.expensesByCategory.map((e) => line(t("finance:reports.expenseLine", { name: e.name }), e.amount, p?.expensesByCategory.find((x) => x.name === e.name)?.amount ?? 0)),
          line(t("finance:reports.totalExpenses"), c.expenses, p?.expenses, pnl.changes?.expenses),
          line(t("finance:reports.otherIncome"), c.otherIncome, p?.otherIncome),
          line(t("finance:reports.otherExpenses"), c.otherExpenses, p?.otherExpenses),
          line(t("finance:reports.feesEstimated"), c.paymentFees, p?.paymentFees),
          line(t("finance:kpi.netProfit"), c.netProfit, p?.netProfit, pnl.changes?.netProfit),
        ]
        rowsCsv("profit-and-loss", [["line", t("finance:reports.line")], ["amount", t("common:money.amount")], ["previous", t("finance:reports.previous")], ["change", t("finance:reports.change")]], rows)
      } else if (tab === "cashflow" && cash) {
        rowsCsv("cash-flow", [
          ["section", t("finance:reports.section")], ["name", t("common:fields.name")], ["opening", t("finance:reports.opening")], ["in", t("finance:ui.moneyIn")],
          ["out", t("finance:ui.moneyOut")], ["tin", t("finance:reports.transfersIn")], ["tout", t("finance:reports.transfersOut")], ["closing", t("finance:reports.closing")],
        ], [
          ...cash.bySource.map((s) => ({ section: t("finance:reports.bySource"), name: sourceText(t, s.sourceType, s.label), in: csvMoney(s.moneyIn), out: csvMoney(s.moneyOut) })),
          ...cash.byAccount.map((a) => ({
            section: t("finance:reports.byAccount"), name: a.name, opening: csvMoney(a.openingBalance), in: csvMoney(a.moneyIn), out: csvMoney(a.moneyOut),
            tin: csvMoney(a.transfersIn), tout: csvMoney(a.transfersOut), closing: csvMoney(a.closingBalance),
          })),
          { section: t("common:money.total"), name: t("finance:accounts.all"), opening: csvMoney(cash.openingBalance), in: csvMoney(cash.moneyIn), out: csvMoney(cash.moneyOut), closing: csvMoney(cash.closingBalance) },
        ])
      } else if (tab === "statement" && stmt) {
        rowsCsv(`statement-${(stmt.account?.name ?? "account").toLowerCase().replace(/\s+/g, "-")}`, [
          ["date", t("common:fields.date")], ["type", t("common:fields.type")], ["party", t("finance:col.party")], ["reference", t("common:extra.reference")],
          ["in", t("finance:ui.moneyIn")], ["out", t("finance:ui.moneyOut")], ["balance", t("finance:col.balance")],
        ], [
          { date: periodInfo?.from ?? "", type: t("finance:reports.openingBalance"), balance: csvMoney(stmt.openingBalance) },
          ...stmt.rows.map((r) => ({
            date: r.date, type: sourceText(t, r.sourceType, r.sourceLabel), party: r.party ?? r.note ?? "", reference: r.reference ?? "",
            in: r.direction === "in" ? csvMoney(r.amount) : "", out: r.direction === "out" ? csvMoney(r.amount) : "", balance: r.runningBalance != null ? csvMoney(r.runningBalance) : "",
          })),
          { date: periodInfo?.to ?? "", type: t("finance:reports.closingBalance"), in: csvMoney(stmt.moneyIn), out: csvMoney(stmt.moneyOut), balance: csvMoney(stmt.closingBalance) },
        ])
      } else if (tab === "tax" && tax) {
        rowsCsv("tax-summary", [
          ["group", t("finance:reports.group")], ["label", t("finance:reports.label")], ["orders", t("finance:reports.orders")], ["taxable", t("finance:reports.taxableAmount")], ["tax", t("common:money.tax")],
        ], [
          ...tax.byRate.map((r) => ({ group: t("finance:reports.byRate"), label: taxRateLabel(t, r), orders: r.orders, taxable: csvMoney(r.taxableAmount), tax: csvMoney(r.tax) })),
          ...(tax.notBrokenDown ? [{ group: t("finance:reports.byRate"), label: tax.notBrokenDown.label, orders: tax.notBrokenDown.orders, taxable: csvMoney(tax.notBrokenDown.taxableAmount), tax: csvMoney(tax.notBrokenDown.tax) }] : []),
          ...tax.byMonth.map((m) => ({ group: t("finance:ui.byMonth"), label: f.bucket(m.key, m.label), orders: m.orders, taxable: csvMoney(m.taxableAmount), tax: csvMoney(m.tax) })),
          { group: t("common:money.total"), label: t("finance:reports.taxCollectedCode", { code: tax.context.currency?.code ?? "" }), orders: tax.taxedOrders, taxable: csvMoney(tax.taxableSales), tax: csvMoney(tax.taxCollected) },
        ])
      } else if (tab === "health" && health) {
        rowsCsv("health-checks", [
          ["check", t("finance:reports.check")], ["title", t("finance:reports.checkTitle")], ["status", t("common:fields.status")], ["expected", t("finance:health.expected")],
          ["actual", t("finance:health.actual")], ["difference", t("finance:health.difference")], ["explanation", t("finance:inventory.explanation")],
        ], health.checks.map((c) => ({
          check: c.id, title: c.title, status: healthStatusText(t, c.status), expected: c.expected != null ? csvMoney(c.expected) : "", actual: c.actual != null ? csvMoney(c.actual) : "",
          difference: c.difference != null ? csvMoney(c.difference) : "", explanation: c.explanation,
        })))
      } else if (tab === "aging" && aging) {
        const labels = aging.receivables.buckets.map((b) => b.label)
        rowsCsv("aging", [
          ["side", t("finance:reports.side")], ["name", t("common:fields.name")], ["due", t("common:money.due")], ["age", t("finance:receivables.ageDays")],
          ["bucket", t("finance:reports.bucket")], ["overdue", t("finance:reports.overdue")],
        ], [
          ...aging.receivables.customers.map((c) => ({ side: t("finance:reports.receivable"), name: c.name, due: csvMoney(c.due), age: c.ageDays, bucket: labels[c.bucket] ?? c.bucket })),
          ...aging.payables.suppliers.map((s) => ({ side: t("finance:reports.payable"), name: s.name, due: csvMoney(s.due), age: s.ageDays, bucket: aging.payables.buckets[s.bucket]?.label ?? s.bucket, overdue: s.overdue ? t("common:actions.yes") : "" })),
        ])
      } else {
        toast.error(t("finance:reports.nothingYet"))
      }
    } catch {
      toast.error(t("finance:actions.exportFailed"))
    }
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:reports.title")}
        description={<span className="inline-flex flex-wrap items-center gap-2">{periodText}{tab === "aging" && <AsOfNowLabel />}<CurrencyTag code={ctx?.currency?.code} /></span>}
        actions={<div className="flex flex-wrap gap-2 print:hidden">
          {canRead("Reports") && <Button asChild variant="outline"><Link href="/dashboard/reports"><BarChart3 className="size-4" aria-hidden /> {t("finance:reports.salesStock")}</Link></Button>}
          <Button type="button" variant="outline" onClick={() => window.print()}><Printer className="size-4" aria-hidden /> {t("common:actions.print")}</Button>
          {tab !== "close" && <Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" aria-hidden /> {t("finance:actions.exportCsv")}</Button>}
        </div>}
      />

      <Toolbar className="gap-3 print:hidden"
        actions={(tab === "pnl" || tab === "cashflow" || tab === "tax") && (
          <div className="flex items-center gap-2">
            <Switch id="report-compare" checked={compare} onCheckedChange={setCompare} />
            <Label htmlFor="report-compare" className="text-sm font-normal">{t("finance:overview.compare")}</Label>
          </div>
        )}
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)}>
          <TabsList aria-label={t("finance:reports.reportAria")} className="h-auto flex-wrap">
            {TABS.map(([id, label]) => <TabsTrigger key={id} value={id}>{t(label)}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        {PERIOD_TABS.has(tab) && <FinanceFilters filters={filters} channel={CHANNEL_TABS.has(tab)} idPrefix="report" />}
        {tab === "statement" && (
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger aria-label={t("finance:col.account")} className="w-48"><SelectValue placeholder={t("finance:account.choose")} /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.isActive ? "" : ` (${t("common:status.inactive").toLowerCase()})`}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </Toolbar>

      <h2 className="hidden text-lg font-semibold print:block">{t(TABS.find(([id]) => id === tab)?.[1] ?? "finance:reports.title")}</h2>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

      {(tab === "pnl" && pnl?.closeStatus) && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm print:hidden">
          <Lock className="size-4 text-muted-foreground" aria-hidden />
          <span>{pnl.closeStatus.closedThrough ? t("finance:close.closedThrough", { date: f.longDate(pnl.closeStatus.closedThrough) }) : t("finance:close.noneClosed")}</span>
          {pnl.closeStatus.suggestion && (
            <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setTab("close")}>{t("finance:close.closeMonth", { month: f.bucket(pnl.closeStatus.suggestion.month, pnl.closeStatus.suggestion.label) })}</Button>
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-5", loading && "opacity-60")}>
        {tab === "pnl" && (pnl ? <PnlView report={pnl} money={money} /> : <ReportSkeleton />)}
        {tab === "cashflow" && (cash ? <CashflowView report={cash} prev={cashPrev} money={money} /> : <ReportSkeleton />)}
        {tab === "statement" && (!accountId ? <EmptyState title={t("finance:reports.chooseAccountTitle")} description={t("finance:reports.chooseAccountDesc")} />
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
  const { t } = useTranslation(FIN_NS)
  const f = useFinanceFormat()
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
      <section aria-label={t("common:extra.summary")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("finance:kpi.revenue")} value={money(c.revenue)} hint={p ? <ChangeHint current={c.revenue} previous={p.revenue} /> : t("common:count.orders", { count: c.info.orders })} />
        <StatTile label={t("finance:kpi.grossProfit")} value={<SignedMoney value={c.grossProfit} format={money} />} hint={t("finance:kpi.margin", { pct: pct(c.grossMarginPct) })} />
        <StatTile label={t("finance:kpi.expenses")} value={money(c.expenses)} hint={p ? <ChangeHint current={c.expenses} previous={p.expenses} invert /> : t("finance:reports.categories", { count: c.expensesByCategory.length })} />
        <StatTile label={t("finance:kpi.netProfit")} value={<SignedMoney value={c.netProfit} format={money} positiveTone />} hint={t("finance:kpi.margin", { pct: pct(c.netMarginPct) })} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr] print:grid-cols-1">
        <SectionCard title={t("finance:reports.statement")} contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[480px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance:reports.line")}</TableHead><TableHead className="text-right">{t("finance:reports.thisPeriod")}</TableHead>
                  {p && <TableHead className="text-right">{t("finance:reports.previous")}</TableHead>}{p && <TableHead className="text-right">{t("finance:reports.change")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                <Line label={t("finance:kpi.revenue")} cur={c.revenue} prev={p?.revenue} change={ch?.revenue} />
                <Line label={t("finance:kpi.cogs")} cur={c.cogs} prev={p?.cogs} change={ch?.cogs} negative invert />
                <Line label={<>{t("finance:kpi.grossProfit")} <span className="font-normal text-muted-foreground">· {pct(c.grossMarginPct)}</span></>} cur={c.grossProfit} prev={p?.grossProfit} change={ch?.grossProfit} strong />
                {c.expensesByCategory.map((e) => <Line key={e.name} label={e.name} cur={e.amount} prev={prevCat(e.name)} negative indent invert />)}
                <Line label={t("finance:reports.totalExpenses")} cur={c.expenses} prev={p?.expenses} change={ch?.expenses} negative invert />
                {(c.otherIncome > 0 || (p?.otherIncome ?? 0) > 0) && <Line label={t("finance:reports.otherIncome")} cur={c.otherIncome} prev={p?.otherIncome} />}
                {(c.otherExpenses > 0 || (p?.otherExpenses ?? 0) > 0) && <Line label={t("finance:reports.otherExpenses")} cur={c.otherExpenses} prev={p?.otherExpenses} negative invert />}
                {(c.paymentFees > 0 || (p?.paymentFees ?? 0) > 0) && <Line label={t("finance:reports.feesEstimated")} cur={c.paymentFees} prev={p?.paymentFees} negative invert />}
                <Line label={<>{t("finance:kpi.netProfit")} <span className="font-normal text-muted-foreground">· {pct(c.netMarginPct)}</span></>} cur={c.netProfit} prev={p?.netProfit} change={ch?.netProfit} strong />
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 px-2 text-xs text-muted-foreground">
            {t("finance:reports.pnlNote", { tax: money(c.info.tax), shipping: money(c.info.shipping), discounts: money(c.info.discounts), refunds: money(c.info.refunds) })}
            {c.voidedExpenses > 0 && <> {t("finance:reports.pnlVoided", { amount: money(c.voidedExpenses) })}</>}
            {c.paymentFees > 0 && <> {t("finance:reports.pnlFees")}</>}
          </p>
        </SectionCard>
        <SectionCard title={t("finance:ui.expensesByCategory")} className="print:break-inside-avoid">
          <MixBars items={c.expensesByCategory.map((e) => ({ label: e.name, value: e.amount, color: e.color ?? undefined }))} format={money} empty={t("finance:ui.noExpenses")} />
        </SectionCard>
      </div>

      {report.months.length > 1 && (
        <SectionCard title={t("finance:ui.byMonth")} contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance:col.month")}</TableHead><TableHead className="text-right">{t("finance:col.revenue")}</TableHead><TableHead className="text-right">{t("finance:col.cogs")}</TableHead><TableHead className="text-right">{t("finance:col.grossProfit")}</TableHead>
                  <TableHead className="text-right">{t("finance:kpi.expenses")}</TableHead><TableHead className="text-right">{t("finance:reports.otherPm")}</TableHead><TableHead className="text-right">{t("finance:kpi.netProfit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.months.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">
                      {f.bucket(m.key, m.label)}
                      {m.closed && <Badge variant="secondary" className="ml-2 gap-1"><Lock className="size-3" aria-hidden /> {t("finance:close.closed")}</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{money(m.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(m.cogs)}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={m.grossProfit} format={money} /></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{money(m.expenses)}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={m.otherIncome - m.otherExpenses} format={money} /></TableCell>
                    <TableCell className="text-right font-semibold">
                      <SignedMoney value={m.netProfit} format={money} positiveTone />
                      {m.closed && m.netAtClose != null && Math.abs(m.netAtClose - m.netProfit) >= 0.005 && (
                        <div className="text-xs font-normal text-muted-foreground">{t("finance:reports.atClose")} <SignedMoney value={m.netAtClose} format={money} /></div>
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
  const { t } = useTranslation(FIN_NS)
  const f = useFinanceFormat()
  return (
    <>
      <section aria-label={t("common:extra.summary")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("finance:reports.openingBalance")} value={<SignedMoney value={r.openingBalance} format={money} />} hint={t("finance:accounts.all")} />
        <StatTile label={t("finance:ui.moneyIn")} value={<span className="text-emerald-600 dark:text-emerald-400">{money(r.moneyIn)}</span>} hint={prev ? <ChangeHint current={r.moneyIn} previous={prev.moneyIn} /> : t("finance:reports.exclTransfers")} />
        <StatTile label={t("finance:ui.moneyOut")} value={<span className="text-destructive">{money(r.moneyOut)}</span>} hint={prev ? <ChangeHint current={r.moneyOut} previous={prev.moneyOut} invert /> : t("finance:reports.exclTransfers")} />
        <StatTile label={t("finance:reports.closingBalance")} value={<SignedMoney value={r.closingBalance} format={money} />} hint={<>{t("finance:col.net")} <SignedMoney value={r.net} format={money} positiveTone /></>} />
      </section>

      <SectionCard title={t("finance:ui.inVsOut")} description={r.granularity === "month" ? t("finance:ui.byMonth") : t("finance:ui.byDay")} className="print:break-inside-avoid">
        <InOutChart buckets={r.series.map((p) => ({ label: f.bucket(p.key, p.label, "month"), in: p.moneyIn, out: p.moneyOut }))} format={money} />
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-1">
        <SectionCard title={t("finance:reports.bySource")} contentClassName="px-2" className="print:break-inside-avoid">
          {r.bySource.length === 0 ? <p className="px-2 text-sm text-muted-foreground">{t("finance:ui.noMoneyMoved")}</p> : (
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow><TableHead>{t("finance:reports.source")}</TableHead><TableHead className="text-right">{t("finance:col.in")}</TableHead><TableHead className="text-right">{t("finance:col.out")}</TableHead><TableHead className="text-right">{t("finance:col.net")}</TableHead>{prev && <TableHead className="text-right">{t("finance:reports.previousNet")}</TableHead>}</TableRow>
                </TableHeader>
                <TableBody>
                  {r.bySource.map((s) => (
                    <TableRow key={s.sourceType}>
                      <TableCell className="font-medium">{sourceText(t, s.sourceType, s.label)} <span className="text-xs font-normal text-muted-foreground">· {s.count}</span></TableCell>
                      <TableCell className="text-right tabular-nums">{s.moneyIn ? money(s.moneyIn) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{s.moneyOut ? money(s.moneyOut) : "—"}</TableCell>
                      <TableCell className="text-right"><SignedMoney value={s.net} format={money} /></TableCell>
                      {prev && <TableCell className="text-right text-muted-foreground"><SignedMoney value={prev.bySource.find((x) => x.sourceType === s.sourceType)?.net ?? 0} format={money} /></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{t("common:money.total")}</TableCell>
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
        <SectionCard title={t("finance:reports.byAccount")} contentClassName="px-2" className="print:break-inside-avoid">
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow><TableHead>{t("finance:col.account")}</TableHead><TableHead className="text-right">{t("finance:reports.opening")}</TableHead><TableHead className="text-right">{t("finance:col.in")}</TableHead><TableHead className="text-right">{t("finance:col.out")}</TableHead><TableHead className="text-right">{t("finance:reports.transfers")}</TableHead><TableHead className="text-right">{t("finance:reports.closing")}</TableHead></TableRow>
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
                  <TableCell className="font-bold">{t("finance:accounts.all")}</TableCell>
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
  const { t } = useTranslation(FIN_NS)
  const f = useFinanceFormat()
  return (
    <>
      <section aria-label={t("common:extra.summary")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("finance:reports.openingBalance")} value={<SignedMoney value={r.openingBalance} format={money} />} hint={r.account?.name} />
        <StatTile label={t("finance:ui.moneyIn")} value={<span className="text-emerald-600 dark:text-emerald-400">{money(r.moneyIn)}</span>} hint={t("finance:reports.inclTransfersIn")} />
        <StatTile label={t("finance:ui.moneyOut")} value={<span className="text-destructive">{money(r.moneyOut)}</span>} hint={t("finance:reports.inclTransfersOut")} />
        <StatTile label={t("finance:reports.closingBalance")} value={<SignedMoney value={r.closingBalance} format={money} />} hint={t("finance:reports.lines", { count: r.rows.length })} />
      </section>
      {r.truncated && <Alert><AlertDescription>{t("finance:reports.truncated")}</AlertDescription></Alert>}
      <SectionCard title={r.account ? t("finance:reports.accountStatement", { name: r.account.name }) : t("finance:reports.statement")} contentClassName="px-2">
        <div className="overflow-x-auto">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("common:fields.type")}</TableHead><TableHead>{t("common:extra.details")}</TableHead><TableHead>{t("common:extra.reference")}</TableHead>
                <TableHead className="text-right">{t("common:money.amount")}</TableHead><TableHead className="text-right">{t("finance:col.balance")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="text-muted-foreground">{from ? f.date(from) : "—"}</TableCell>
                <TableCell colSpan={4} className="font-semibold">{t("finance:reports.openingBalance")}</TableCell>
                <TableCell className="text-right font-semibold"><SignedMoney value={r.openingBalance} format={money} /></TableCell>
              </TableRow>
              {r.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{f.date(row.date)}</TableCell>
                  <TableCell><Badge variant="outline">{sourceText(t, row.sourceType, row.sourceLabel)}</Badge></TableCell>
                  <TableCell className="max-w-[240px]">
                    <div className="truncate">{row.party ?? row.category ?? "—"}</div>
                    {row.note && <div className="truncate text-xs text-muted-foreground">{row.note}</div>}
                  </TableCell>
                  <TableCell>{row.link ? <Link href={row.link.href} className="text-primary hover:underline">{row.reference || t("finance:actions.open")}</Link> : (row.reference || "—")}</TableCell>
                  <TableCell className="text-right"><DirectionAmount direction={row.direction} amount={row.amount} format={money} /></TableCell>
                  <TableCell className="text-right">{row.runningBalance != null ? <SignedMoney value={row.runningBalance} format={money} /> : "—"}</TableCell>
                </TableRow>
              ))}
              {r.rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">{t("finance:reports.noStatementRows")}</TableCell></TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-bold">{to ? f.date(to) : ""}</TableCell>
                <TableCell colSpan={4} className="font-bold">{t("finance:reports.closingBalance")}</TableCell>
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
const taxRateLabel = (t: FinT, r: TaxReport["byRate"][number]) => r.label || r.name || (r.rate == null ? t("common:extra.other") : t("finance:reports.taxRate", { rate: r.rate }))

/** Health check status code → translated label (raw code as fallback). */
const healthStatusText = (t: FinT, s: string) => (s === "pass" ? t("finance:health.pass") : s === "fail" ? t("finance:health.fail") : s === "info" ? t("finance:health.explained") : s)

function TaxTable({ title, first, rows, total, money }: {
  title: string; first: string
  rows: { key: string; label: string; orders: number; taxable: number; tax: number; muted?: boolean }[]
  total: { orders: number; taxable: number; tax: number; label: string }
  money: (n: number) => string
}) {
  const { t } = useTranslation(FIN_NS)
  return (
    <SectionCard title={title} contentClassName="px-2" className="print:break-inside-avoid">
      {rows.length === 0 ? <p className="px-2 text-sm text-muted-foreground">{t("finance:reports.noTax")}</p> : (
        <div className="overflow-x-auto">
          <Table className="min-w-[420px]">
            <TableHeader>
              <TableRow><TableHead>{first}</TableHead><TableHead className="text-right">{t("finance:reports.orders")}</TableHead><TableHead className="text-right">{t("finance:reports.taxable")}</TableHead><TableHead className="text-right">{t("common:money.tax")}</TableHead></TableRow>
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
  const { t } = useTranslation(FIN_NS)
  const f = useFinanceFormat()
  const code = r.context.currency?.code
  const rateRows = [
    ...r.byRate.map((x) => ({ key: `r-${x.rate ?? "none"}-${x.name ?? ""}`, label: taxRateLabel(t, x), orders: x.orders, taxable: x.taxableAmount, tax: x.tax })),
    ...(r.notBrokenDown && r.notBrokenDown.tax !== 0
      ? [{ key: "not-broken-down", label: r.notBrokenDown.label, orders: r.notBrokenDown.orders, taxable: r.notBrokenDown.taxableAmount, tax: r.notBrokenDown.tax, muted: true }]
      : []),
  ]
  const rateSum = rateRows.reduce((n, x) => n + x.tax, 0)
  const gap = Math.round((r.taxCollected - rateSum) * 100) / 100
  const total = { orders: r.taxedOrders, taxable: r.taxableSales, tax: r.taxCollected, label: code ? t("finance:reports.taxCollectedCode", { code }) : t("finance:reports.taxCollected") }
  return (
    <>
      <section aria-label={t("common:extra.summary")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={t("finance:reports.taxCollected")} value={money(r.taxCollected)} hint={prev ? <ChangeHint current={r.taxCollected} previous={prev.taxCollected} /> : t("finance:reports.nonCancelled")} />
        <StatTile label={t("finance:reports.taxableSales")} value={money(r.taxableSales)} hint={t("finance:reports.taxableHint")} />
        <StatTile label={t("finance:reports.effectiveRate")} value={pct(r.effectiveRatePct)} hint={t("finance:reports.ofTotalSales", { amount: money(r.salesTotal) })} />
        <StatTile label={t("finance:reports.taxedOrders")} value={`${r.taxedOrders.toLocaleString("en-US")} / ${r.orders.toLocaleString("en-US")}`} hint={t("finance:reports.taxedOfAll")} />
      </section>
      {rateRows.length > 0 && Math.abs(gap) >= 0.01 && (
        <Alert><AlertDescription>{gap > 0
          ? t("finance:reports.ratesLess", { sum: money(rateSum), gap: money(Math.abs(gap)) })
          : t("finance:reports.ratesMore", { sum: money(rateSum), gap: money(Math.abs(gap)) })}</AlertDescription></Alert>
      )}
      <div className="grid gap-5 lg:grid-cols-2 print:grid-cols-1">
        <TaxTable title={t("finance:reports.byRate")} first={t("finance:reports.rate")} rows={rateRows} total={total} money={money} />
        <TaxTable title={t("finance:ui.byMonth")} first={t("finance:col.month")} rows={r.byMonth.map((x) => ({ key: x.key, label: f.bucket(x.key, x.label), orders: x.orders, taxable: x.taxableAmount, tax: x.tax }))} total={total} money={money} />
      </div>
    </>
  )
}

// ─── Aging ───────────────────────────────────────────────────────────────────

function AgingView({ report: r, money }: { report: AgingReport; money: (n: number) => string }) {
  const { t } = useTranslation(FIN_NS)
  const sides = [
    {
      id: "receivables", title: t("finance:receivables.title"), sub: t("finance:overview.owedToYou"), total: r.receivables.total, buckets: r.receivables.buckets, href: "/dashboard/finance/receivables", dues: "/dashboard/dues/customers",
      party: t("common:fields.customer"), fullDues: t("finance:reports.fullCustomerDues"),
      extras: [[t("finance:reports.codInDues"), r.receivables.codWithCouriers], [t("finance:overview.tailorBalances"), r.receivables.tailorBalances]] as [string, number][],
      rows: r.receivables.customers.map((c) => ({ key: `c${c.partyId}`, name: c.name, due: c.due, age: c.ageDays, bucket: r.receivables.buckets[c.bucket]?.label ?? "", overdue: false })),
    },
    {
      id: "payables", title: t("finance:overview.payables"), sub: t("finance:overview.youOwe"), total: r.payables.total, buckets: r.payables.buckets, href: "/dashboard/finance/payouts", dues: "/dashboard/dues/vendors",
      party: t("common:extra.supplier"), fullDues: t("finance:reports.fullSupplierDues"),
      extras: [[t("finance:overview.unpaidSalaries"), r.payables.unpaidSalaries], [t("finance:overview.owedToDorjis"), r.payables.dorjiOwed]] as [string, number][],
      rows: r.payables.suppliers.map((s) => ({ key: `s${s.partyId}`, name: s.name, due: s.due, age: s.ageDays, bucket: r.payables.buckets[s.bucket]?.label ?? "", overdue: s.overdue })),
    },
  ]
  return (
    <div className="grid gap-5 xl:grid-cols-2 print:grid-cols-1">
      {sides.map((s) => (
        <SectionCard key={s.id} title={`${s.title} · ${money(s.total)}`} description={<span className="inline-flex flex-wrap items-center gap-2">{s.sub}<AsOfNowLabel /></span>} className="print:break-inside-avoid" contentClassName="flex flex-col gap-5"
          actions={<Button asChild variant="ghost" size="sm" className="print:hidden"><Link href={s.href}>{t("finance:actions.open")}</Link></Button>}>
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
                <TableRow><TableHead>{s.party}</TableHead><TableHead>{t("finance:col.age")}</TableHead><TableHead className="text-right">{t("common:money.due")}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {s.rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.name}{row.overdue && <Badge variant="destructive" className="ml-2">{t("finance:reports.overdue")}</Badge>}</TableCell>
                    <TableCell className="text-muted-foreground">{t("finance:receivables.days", { count: row.age })} <span className="text-xs">· {row.bucket}</span></TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{money(row.due)}</TableCell>
                  </TableRow>
                ))}
                {s.rows.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">{t("finance:reports.nothingOutstanding")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          <Button asChild variant="link" size="sm" className="self-start px-0 print:hidden"><Link href={s.dues}>{s.fullDues}</Link></Button>
        </SectionCard>
      ))}
    </div>
  )
}
