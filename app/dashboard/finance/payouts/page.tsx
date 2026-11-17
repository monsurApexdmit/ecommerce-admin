"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Clock, Download, HandCoins, Plus, Scissors, Search, Truck, Users } from "lucide-react"
import { toast } from "sonner"
import financeApi, { financeError, type PayableResult, type PayableRow, type PayoutRow, type PayoutSummary, type PayoutsResult } from "@/lib/financeApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { FilterBar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { AsOfNowLabel, FinanceFilters, useFinanceFilters } from "@/components/finance/finance-filters"
import { PayableBreakdown, PayoutCreateDialog, type PayoutPick } from "@/components/finance/payout-create-dialog"
import { CurrencyTag, TileSkeletons, csvMoney, downloadCsv, useFinanceFormat } from "@/components/finance/finance-ui"
import { FIN_NS, methodText, payeeText, type FinKey } from "@/components/finance/i18n"

/** Payout type filter (values sent to the API) with label keys. */
const TYPES: { value: string; label: FinKey }[] = [
  { value: "all", label: "common:status.all" },
  { value: "supplier", label: "finance:payouts.suppliers" },
  { value: "salary", label: "finance:payouts.salaries" },
  { value: "dorji", label: "finance:payouts.dorjis" },
]
const PAYEE_TYPES = ["supplier", "dorji", "staff"]

export default function PayoutsPage() {
  const blocked = useModuleGuard("Finance")
  const { t } = useTranslation(FIN_NS)
  const f = useFinanceFormat()
  const money = f.money
  const { canWrite } = useSaasAuth()
  const canPayAny = canWrite("Dues") || canWrite("Salary Management") || canWrite("TailorPayments")
  const sp = useSearchParams()

  // Point in time: who can be paid now (v2.9) + salary/dorji totals (v1 summary)
  const [payable, setPayable] = useState<PayableResult | null>(null)
  const [summary, setSummary] = useState<PayoutSummary | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Paid-out history (period)
  const filters = useFinanceFilters()
  const [type, setType] = useState("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [data, setData] = useState<PayoutsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createFor, setCreateFor] = useState<PayoutPick | null>(null)

  // PO-4 deep link: ?type=supplier&id=5&create=1 opens Pay pre-filled (once)
  const deepLinked = useRef(false)
  useEffect(() => {
    if (deepLinked.current) return
    deepLinked.current = true
    const t = sp.get("type"), id = Number(sp.get("id"))
    if (sp.get("create") === "1") {
      setCreateFor(t && PAYEE_TYPES.includes(t) && id > 0 ? { type: t, id } : null)
      setCreateOpen(true)
      const next = new URLSearchParams(sp.toString())
      next.delete("create"); next.delete("type"); next.delete("id")
      const qs = next.toString()
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    }
  }, [sp])

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1) }, [filters.key, type, qD])

  const loadNow = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([financeApi.getPayable(), financeApi.getPayoutSummary()])
      setPayable(p); setSummary(s)
    } catch (e) { toast.error(financeError(e, t("finance:payouts.owedFailed"))) }
  }, [])
  useEffect(() => { loadNow() }, [loadNow])

  const params = useCallback((p: number, pp: number) => ({
    ...filters.periodParams, type: type !== "all" ? type : undefined, search: qD || undefined, page: p, perPage: pp,
  }), [filters.periodParams.preset, filters.periodParams.from, filters.periodParams.to, type, qD]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!filters.ready || filters.incomplete) return
    setLoading(true); setError("")
    try { setData(await financeApi.getPayouts(params(page, perPage))) }
    catch (e) { setError(financeError(e, t("finance:payouts.loadFailed"))) }
    finally { setLoading(false) }
  }, [params, page, perPage, filters.ready, filters.incomplete])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); loadNow() }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const rows: PayoutRow[] = []
      for (let p = 1; p <= 100; p++) {
        const r = await financeApi.getPayouts(params(p, 100))
        rows.push(...r.rows)
        if (p >= r.meta.lastPage || r.rows.length === 0) break
      }
      if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
      const cur = data?.context.currency?.code ?? f.currencyCode
      downloadCsv("payouts", [
        [t("common:fields.date"), (r) => r.date], [t("common:fields.type"), (r) => payeeText(t, r.type, r.typeLabel)], [t("finance:col.payee"), (r) => r.payee], [t("common:money.amount"), (r) => csvMoney(r.amount)], [t("finance:col.currency"), () => cur],
        [t("finance:col.account"), (r) => r.accountName], [t("finance:col.method"), (r) => methodText(t, r.method, r.methodLabel)], [t("common:extra.reference"), (r) => r.reference], [t("common:fields.note"), (r) => r.note],
      ], rows)
    } catch (e) {
      toast.error(financeError(e, t("finance:actions.exportFailed")))
    } finally {
      setExporting(false)
    }
  }

  const openPay = (r?: PayableRow) => { setCreateFor(r ? { type: r.type, id: r.id } : null); setCreateOpen(true) }

  if (blocked) return blocked

  const tot = payable?.totals
  const supplierRows = payable?.rows.filter((r) => r.type === "supplier") ?? []
  const supplierPayable = supplierRows.reduce((n, r) => n + Math.max(0, r.payableNow), 0)
  const supplierOwed = supplierRows.reduce((n, r) => n + r.owed, 0)
  const currency = payable?.context.currency?.code ?? data?.context.currency?.code

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:payouts.title")}
        description={t("finance:payouts.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? t("finance:actions.exporting") : t("finance:actions.exportCsv")}</Button>
          {canPayAny && <Button type="button" onClick={() => openPay()}><Plus className="size-4" aria-hidden /> {t("finance:payoutCreate.title")}</Button>}
        </>}
      >
        <div className="flex items-center gap-2"><AsOfNowLabel /><CurrencyTag code={currency} /></div>
      </PageHeader>

      <section aria-label={t("finance:payouts.amountsAria")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!tot || !summary ? <TileSkeletons /> : <>
          <StatTile label={t("finance:payable.payableNow")} icon={<HandCoins />} value={money(tot.payableNow)}
            hint={t("finance:payouts.payableHint", { owed: money(tot.owed), notYetDue: money(tot.notYetDue), credits: money(tot.credits) })} />
          <StatTile label={t("finance:payouts.suppliers")} icon={<Truck />} value={money(supplierPayable)}
            hint={`${t("finance:payouts.supplierHint", { owed: money(supplierOwed) })}${tot.theyOweYou ? ` · ${t("finance:payouts.theyOweAmount", { amount: money(tot.theyOweYou) })}` : ""}`} />
          <StatTile label={t("finance:overview.unpaidSalaries")} icon={<Users />} value={money(summary.unpaidSalaries.total)} hint={t("finance:payouts.payslips", { count: summary.unpaidSalaries.count })} />
          <StatTile label={t("finance:overview.owedToDorjis")} icon={<Scissors />} value={money(summary.dorjiOwed.total)} hint={t("finance:payouts.dorjiCount", { count: summary.dorjiOwed.count })} />
        </>}
      </section>

      <SectionCard title={t("finance:payouts.whoTitle")} description={t("finance:payouts.whoDesc")}
        actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/finance/receivables?tab=suppliers">{t("finance:payouts.supplierBalances")}</Link></Button>}
        contentClassName="px-2">
        {!payable ? <Skeleton className="mx-2 h-32" /> : payable.rows.length === 0 ? (
          <EmptyState icon={HandCoins} title={t("finance:payouts.nothingOwedTitle")} description={t("finance:payouts.nothingOwedDesc")} />
        ) : (
          <div className="flex flex-col">
            {([["now", t("finance:payable.payableNow"), payable.payable], ["nothing", t("finance:payable.nothingPayable"), payable.nothingPayable]] as const).map(([id, title, rows]) => rows.length > 0 && (
              <div key={id} className="flex flex-col">
                <p className="px-2 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
                <ul className="divide-y">
                  {rows.map((r: PayableRow) => {
                    const key = `${r.type}-${r.id}`
                    const zero = r.payableNow <= 0
                    return (
                      <li key={key} className={cn("px-2 py-2.5", zero && "text-muted-foreground")}>
                        <div className="flex items-center gap-3">
                          <Button type="button" variant="link" className={cn("h-auto min-w-0 flex-1 justify-start p-0 text-left", zero ? "text-muted-foreground" : "text-foreground")}
                            aria-expanded={expanded === key} onClick={() => setExpanded(expanded === key ? null : key)}>
                            <span className="truncate font-medium">{r.displayName}</span>
                            <Badge variant="outline" className="ml-2 px-1.5 font-normal">{payeeText(t, r.type)}</Badge>
                          </Button>
                          {r.nextDue && <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:flex"><Clock className="size-3.5" aria-hidden />{t("finance:payouts.amountOn", { amount: money(r.nextDue.amount), date: f.date(r.nextDue.date) })}</span>}
                          <span className="w-32 text-right font-semibold tabular-nums">{r.status === "they_owe_you" ? <span className="text-xs font-medium">{t("finance:payouts.theyOweAmount", { amount: money(Math.abs(r.payableNow)) })}</span> : money(Math.max(0, r.payableNow))}</span>
                          {canPayAny && (zero ? (
                            <WithTooltip content={r.status === "they_owe_you" ? t("finance:payouts.creditsLarger") : r.nextDue ? t("finance:payable.becomesPayable", { amount: money(r.nextDue.amount), date: f.date(r.nextDue.date) }) : t("finance:payable.nothingNow")}>
                              <span tabIndex={0}><Button type="button" size="sm" variant="outline" disabled>{t("finance:actions.pay")}</Button></span>
                            </WithTooltip>
                          ) : <Button type="button" size="sm" variant="outline" onClick={() => openPay(r)}>{t("finance:actions.pay")}</Button>)}
                        </div>
                        {expanded === key && <div className="mt-2 max-w-md"><PayableBreakdown row={r} money={money} date={f.date} /></div>}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title={t("finance:payouts.paidOut")} description={data ? `${t("finance:payouts.paidOutDesc", { count: data.totals.count, amount: money(data.totals.total) })} · ${filters.label}` : undefined} contentClassName="flex flex-col gap-4 px-2">
        <FilterBar className="px-2">
          <FinanceFilters filters={filters} channel={false} idPrefix="payouts" />
          <SegmentedControl aria-label={t("finance:payouts.typeAria")} value={type} onValueChange={setType}
            options={TYPES.map((x) => ({ value: x.value, label: x.value !== "all" && data?.totals.byType[x.value] != null ? `${t(x.label)} · ${money(data.totals.byType[x.value])}` : t(x.label) }))} />
          <InputGroup className="w-full sm:w-60">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput aria-label={t("finance:payouts.search")} placeholder={t("finance:payouts.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
        </FilterBar>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {loading && !data ? (
          <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={HandCoins} title={t("finance:payouts.emptyTitle")} description={t("finance:payouts.emptyDesc")} />
        ) : (
          <div className={cn("overflow-x-auto", loading && "opacity-60")}>
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("finance:col.payee")}</TableHead><TableHead>{t("common:fields.type")}</TableHead><TableHead>{t("common:extra.reference")}</TableHead><TableHead>{t("finance:col.account")}</TableHead><TableHead className="text-right">{t("common:money.amount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{f.date(r.date)}</TableCell>
                    <TableCell className="font-medium">{r.payee ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{payeeText(t, r.type, r.typeLabel)}</Badge></TableCell>
                    <TableCell className="max-w-[220px] truncate">{r.link ? <Link href={r.link.href} className="text-primary hover:underline">{r.reference || t("finance:actions.open")}</Link> : (r.reference || "—")}</TableCell>
                    <TableCell className="text-muted-foreground"><div>{r.accountName ?? "—"}</div>{r.methodLabel && <div className="text-xs">{methodText(t, r.method, r.methodLabel)}</div>}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-destructive">−{money(r.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {data && data.meta.total > 0 && (
          <PaginationControl currentPage={page} totalPages={Math.max(1, data.meta.lastPage)} itemsPerPage={perPage} totalItems={data.meta.total}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
        )}
      </SectionCard>

      <PayoutCreateDialog open={createOpen} initial={createFor} onClose={() => { setCreateOpen(false); setCreateFor(null) }} onDone={refresh} />
    </div>
  )
}
