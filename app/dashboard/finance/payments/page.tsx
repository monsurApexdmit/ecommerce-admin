"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { ArrowRight, ClipboardList, Download, Plus, Receipt, Search, ShoppingBag, Truck, Undo2, Wallet } from "lucide-react"
import { toast } from "sonner"
import financeApi, { financeError, type AccountsResult, type LedgerRow, type LinkedCount, type PaymentsParams, type PaymentsResult, type PaymentsSummary } from "@/lib/financeApi"
import { formatNumber } from "@/lib/finance-format"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { FilterBar } from "@/components/common/Toolbar"
import { TooltipIcon } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PickSaleForPayment } from "@/components/finance/pick-sale-dialog"
import { TailorPaymentDialog, type TailorPayTarget } from "@/components/finance/payout-dialogs"
import { AsOfNowLabel, FinanceFilters, channelLabel, presetLabel, useFinanceFilters, useFinanceQuery, withFinanceQuery } from "@/components/finance/finance-filters"
import { CurrencyTag, SignedMoney, TileSkeletons, csvMoney, downloadCsv, useFinanceFormat } from "@/components/finance/finance-ui"
import { FIN_NS, METHOD_CODES, methodText, sourceText, type FinKey } from "@/components/finance/i18n"

const ALL = "all"
/** Payment type filter (source types sent to the API) with label keys. */
const TYPES: [string, FinKey][] = [
  ["sale", "finance:payments.typeSale"], ["cod", "finance:payments.typeCod"], ["tailor_payment", "finance:payments.typeTailor"],
  ["supplier_refund", "finance:payments.typeSupplierRefund"], ["refund", "finance:payments.typeRefund"],
]
/** "Needs a look" rows from the API → label keys. */
type LookKey = "onlineUnconfirmed" | "codAwaitingCollection" | "refundsAwaiting"
const LOOK_KEY: Record<LookKey, FinKey> = {
  onlineUnconfirmed: "finance:payments.lookOnline",
  codAwaitingCollection: "finance:payments.lookCod",
  refundsAwaiting: "finance:payments.lookRefunds",
}
const FALLBACK_HREF = {
  online: "/dashboard/orders?source=online&pay=unpaid",
  cod: "/dashboard/orders?method=COD&pay=unpaid",
  refunds: "/dashboard/returns/customer",
}
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""))

function LookRow({ item, kind, href, icon }: { item: LinkedCount; kind: LookKey; href: string; icon: React.ReactNode }) {
  const { money } = useFinanceFormat()
  const { t } = useTranslation(FIN_NS)
  const zero = item.count === 0
  return (
    <li>
      <Link href={href} prefetch={false} className={cn("flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-accent", zero && "text-muted-foreground")}>
        <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{t(LOOK_KEY[kind])}</span>
        <span className="text-sm tabular-nums">{money(item.amount)}</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    </li>
  )
}

export default function PaymentsPage() {
  const blocked = useModuleGuard("Finance")
  const { t } = useTranslation(FIN_NS)
  const fmt = useFinanceFormat()
  const { canWrite } = useSaasAuth()
  const money = fmt.money
  const filters = useFinanceFilters()
  const fq = useFinanceQuery()
  const fl = (href: string) => (href.startsWith("/dashboard/finance") ? withFinanceQuery(href, fq) : href)

  const [type, setType] = useState(ALL)
  const [account, setAccount] = useState(ALL)
  const [method, setMethod] = useState(ALL)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [data, setData] = useState<PaymentsResult | null>(null)
  const [summary, setSummary] = useState<PaymentsSummary | null>(null)
  const [accounts, setAccounts] = useState<AccountsResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [summaryError, setSummaryError] = useState("")
  const [exporting, setExporting] = useState(false)
  const [picking, setPicking] = useState(false)
  const [tailor, setTailor] = useState<TailorPayTarget | null>(null)
  const latest = useRef(0)
  const latestSummary = useRef(0)

  const { ready, incomplete, key } = filters
  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1) }, [key, type, account, method, qD])
  useEffect(() => { financeApi.getAccounts().then(setAccounts).catch(() => {}) }, [])

  const params = useCallback((p: number, pp: number): PaymentsParams => ({
    ...filters.params,
    type: type !== ALL ? type : undefined, accountId: account !== ALL ? Number(account) : undefined, method: method !== ALL ? method : undefined,
    search: qD || undefined, page: p, perPage: pp,
  }), [key, type, account, method, qD]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(async () => {
    if (!ready || incomplete) return
    const id = ++latestSummary.current
    setSummaryError("")
    try {
      const s = await financeApi.getPaymentsSummary(filters.params)
      if (id === latestSummary.current) setSummary(s)
    } catch (e) {
      if (id === latestSummary.current) setSummaryError(financeError(e, t("finance:payments.summaryFailed")))
    }
  }, [ready, incomplete, key]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadSummary() }, [loadSummary])

  const load = useCallback(async () => {
    if (!ready || incomplete) return
    const id = ++latest.current
    setLoading(true); setError("")
    try {
      const d = await financeApi.getPayments(params(page, perPage))
      if (id === latest.current) setData(d)
    } catch (e) {
      if (id === latest.current) setError(financeError(e, t("finance:payments.loadFailed")))
    } finally {
      if (id === latest.current) setLoading(false)
    }
  }, [params, page, perPage, ready, incomplete])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); loadSummary() }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const { page: _p, perPage: _pp, ...rest } = params(1, 100)
      await financeApi.downloadCsv("/finance/payments", clean(rest as Record<string, unknown>), `payments-${fmt.today}.csv`)
    } catch {
      // Fallback: build the CSV from the paged JSON
      try {
        const rows: LedgerRow[] = []
        for (let p = 1; p <= 100; p++) {
          const r = await financeApi.getPayments(params(p, 100))
          rows.push(...r.rows)
          if (p >= r.meta.lastPage || r.rows.length === 0) break
        }
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("payments-received", [
          [t("common:fields.date"), (r) => r.date], [t("common:fields.type"), (r) => sourceText(t, r.sourceType, r.sourceLabel)], [t("common:extra.from"), (r) => r.party], [t("common:extra.reference"), (r) => r.reference],
          [t("finance:col.gross"), (r) => csvMoney(r.gross)], [t("finance:col.fee"), (r) => csvMoney(r.fee)], [t("finance:col.net"), (r) => csvMoney(r.net)], [t("finance:col.currency"), (r) => r.currency ?? fmt.currencyCode],
          [t("finance:col.account"), (r) => r.accountName], [t("finance:col.method"), (r) => methodText(t, r.methodKey, r.methodLabel)], [t("finance:channel.label"), (r) => r.channel ? channelLabel(t, r.channel) : ""], [t("common:fields.note"), (r) => r.note],
        ], rows)
      } catch (e) {
        toast.error(financeError(e, t("finance:actions.exportFailed")))
      }
    } finally {
      setExporting(false)
    }
  }

  if (blocked) return blocked

  const tot = data?.totals
  const s = summary
  const ctx = s?.context ?? data?.context
  const pr = ctx?.period
  const periodName = (pr?.preset && pr.preset !== "custom" ? presetLabel(t, pr.preset) : filters.label).toLowerCase()
  const periodText = pr?.from ? (pr.from === pr.to ? fmt.date(pr.from) : `${fmt.date(pr.from)} – ${fmt.date(pr.to)}`) : (pr?.label || filters.label)
  const methodOptions: [string, string][] = (accounts?.methodOptions.length ? accounts.methodOptions.map((m) => [m.key, m.label] as [string, string]) : METHOD_CODES.map((k) => [k, ""] as [string, string]))
    .map(([k, l]) => [k, k === "cod" ? t("finance:method.codLong") : methodText(t, k, l)])
  const paidOverVolume = s ? s.paidVolume.total - s.orderVolume.amount > 0.005 : false
  const currency = ctx?.currency?.code ?? fmt.currencyCode

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:payments.title")}
        description={t("finance:payments.description")}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? t("finance:actions.exporting") : t("finance:actions.exportCsv")}</Button>
          {canWrite("TailorPayments") && <Button type="button" variant="outline" onClick={() => setTailor({ kind: "customer" })}>{t("finance:source.tailor_payment")}</Button>}
          {canWrite("Dues") && <Button type="button" onClick={() => setPicking(true)}><Plus className="size-4" aria-hidden /> {t("finance:actions.recordPayment")}</Button>}
        </>}
      />

      <div className="flex flex-wrap items-center gap-2">
        <FinanceFilters filters={filters} idPrefix="payments" />
        <span className="text-sm text-muted-foreground">{periodText}{ctx && ctx.channel !== "all" ? ` · ${t("finance:overview.channelOnly", { channel: channelLabel(t, ctx.channel, ctx.channelLabel) })}` : ""}</span>
        <CurrencyTag code={ctx?.currency?.code} />
      </div>

      {summaryError && <Alert variant="destructive"><AlertDescription>{summaryError}</AlertDescription></Alert>}

      <section aria-label={t("finance:transactions.totalsAria")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? <TileSkeletons /> : <>
          <StatTile label={t("finance:kpi.orderVolume")} icon={<ShoppingBag />} value={money(s.orderVolume.amount)}
            hint={t("finance:payments.ordersPlacedIn", { count: s.orderVolume.count, n: formatNumber(s.orderVolume.count), period: periodName })} />
          <StatTile label={t("finance:payments.paidVolume")} icon={<Receipt />} value={money(s.paidVolume.recorded)}
            hint={<span className="inline-flex flex-wrap items-center gap-1">
              {s.paidVolume.estimated > 0
                ? <>{t("finance:payments.estimated", { amount: money(s.paidVolume.estimated), n: formatNumber(s.paidVolume.estimatedCount), total: money(s.paidVolume.total) })}</>
                : <>{t("finance:payments.recordedOnOrders")}</>}
              {s.paidVolume.estimatedNote && <TooltipIcon label={t("finance:payments.aboutEstimated")} content={s.paidVolume.estimatedNote} className="size-5" />}
              {paidOverVolume && <span className="text-destructive">{t("finance:payments.overVolume")}</span>}
            </span>} />
          <StatTile label={t("finance:payments.received")} icon={<Wallet />} value={<span className="text-emerald-600 dark:text-emerald-400">{money(s.received.amount)}</span>}
            hint={t("finance:payments.receivedHint", { fees: money(s.received.fees), net: money(s.received.net), count: s.received.count, n: formatNumber(s.received.count) })} />
          <StatTile label={t("finance:kpi.refundsIn", { period: periodName })} icon={<Undo2 />}
            value={<span className={s.refunds.refunded ? "text-destructive" : ""}>{s.refunds.refunded ? `−${money(s.refunds.refunded)}` : money(0)}</span>}
            hint={t("finance:payments.refundsHint", { refunded: money(s.refunds.refunded), awaiting: money(s.refunds.awaiting) })} />
        </>}
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title={<span className="flex flex-wrap items-center gap-2">{t("finance:payments.needsLook")} <AsOfNowLabel /></span>}
          description={s?.needsALook.asOf ? t("finance:payments.asOfToday", { date: fmt.date(s.needsALook.asOf) }) : `${t("finance:overview.notAffected")}.`}>
          {!s ? <Skeleton className="h-32" /> : (
            <ul className="flex flex-col">
              <LookRow item={s.needsALook.onlineUnconfirmed} kind="onlineUnconfirmed" href={s.needsALook.onlineUnconfirmed.href ?? FALLBACK_HREF.online} icon={<ClipboardList />} />
              <LookRow item={s.needsALook.codAwaitingCollection} kind="codAwaitingCollection" href={fl(s.needsALook.codAwaitingCollection.href ?? FALLBACK_HREF.cod)} icon={<Truck />} />
              <LookRow item={s.needsALook.refundsAwaiting} kind="refundsAwaiting" href={s.needsALook.refundsAwaiting.href ?? FALLBACK_HREF.refunds} icon={<Undo2 />} />
            </ul>
          )}
        </SectionCard>
        <SectionCard title={t("finance:payments.toSuppliers")} description={t("finance:payments.toSuppliersDesc", { period: periodName })}
          actions={s && <>
            <Button asChild variant="ghost" size="sm"><Link href={fl(s.toSuppliers.receivablesHref ?? "/dashboard/finance/receivables?tab=suppliers")} prefetch={false}>{t("finance:receivables.title")}</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href={fl(s.toSuppliers.payoutsHref ?? "/dashboard/finance/payouts")} prefetch={false}>{t("finance:payouts.title")} <ArrowRight className="size-4" aria-hidden /></Link></Button>
          </>}>
          {!s ? <Skeleton className="h-32" /> : (
            <InfoList>
              <InfoRow label={t("finance:payments.owedToSuppliers")} value={<span className="tabular-nums">{money(s.toSuppliers.owed)}</span>} />
              <InfoRow label={`· ${t("finance:payable.notYetDue").toLowerCase()}`} className="pl-3 text-xs" value={<span className="tabular-nums">−{money(s.toSuppliers.notYetDue)}</span>} />
              <InfoRow label={`· ${t("finance:payable.credits").toLowerCase()}`} className="pl-3 text-xs" value={<span className="tabular-nums">−{money(s.toSuppliers.credits)}</span>} />
              <InfoRow label={<span className="font-medium text-foreground">{t("finance:payable.payableNow")}</span>} className="border-t pt-2" value={<SignedMoney value={s.toSuppliers.payableNow} format={money} />} />
              <InfoRow label={t("finance:payments.paidIn", { period: periodName })} value={<span className="tabular-nums">{money(s.toSuppliers.paidInPeriod)}</span>} />
            </InfoList>
          )}
        </SectionCard>
      </div>

      <SectionCard title={t("finance:payments.listTitle")} description={tot ? t("finance:payments.listDesc", { count: tot.count, n: formatNumber(tot.count), received: money(tot.received), refunded: money(tot.refunded), fees: money(tot.fees), net: money(tot.netAfterFees) }) : undefined}
        contentClassName="flex flex-col gap-4 px-2">
        <FilterBar className="px-2">
          <InputGroup className="w-full sm:w-60">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput aria-label={t("finance:payments.search")} placeholder={t("finance:payments.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger aria-label={t("common:fields.type")} className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("finance:transactions.allTypes")}</SelectItem>
              {TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{t(l)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={account} onValueChange={setAccount}>
            <SelectTrigger aria-label={t("finance:col.account")} className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("finance:accounts.all")}</SelectItem>
              {(accounts?.accounts ?? []).map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger aria-label={t("finance:col.method")} className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("finance:payments.allMethods")}</SelectItem>
              {methodOptions.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterBar>
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {loading && !data ? (
          <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-11" />)}</div>
        ) : !data || data.rows.length === 0 ? (
          <EmptyState icon={Receipt} title={t("finance:payments.emptyTitle")} description={t("finance:payments.emptyDesc")} />
        ) : (
          <div className={cn("overflow-x-auto", loading && "opacity-60")}>
            <Table className="min-w-[940px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:fields.date")}</TableHead><TableHead>{t("common:fields.type")}</TableHead><TableHead>{t("common:extra.from")}</TableHead><TableHead>{t("common:extra.reference")}</TableHead><TableHead>{t("finance:col.account")}</TableHead>
                  <TableHead className="text-right">{t("finance:col.gross")}</TableHead><TableHead className="text-right">{t("finance:col.fee")}</TableHead><TableHead className="text-right">{t("finance:col.net")}</TableHead><TableHead>{t("finance:col.currency")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.date(r.date)}</TableCell>
                    <TableCell><Badge variant={r.gross < 0 ? "destructive" : "secondary"}>{sourceText(t, r.sourceType, r.sourceLabel)}</Badge></TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="truncate font-medium">{r.party ?? "—"}</div>
                      {r.note && <div className="truncate text-xs text-muted-foreground">{r.note}</div>}
                    </TableCell>
                    <TableCell>{r.link ? <Link href={r.link.href} className="font-medium text-primary hover:underline">{r.reference || t("finance:actions.open")}</Link> : (r.reference || "—")}</TableCell>
                    <TableCell className="text-muted-foreground"><div>{r.accountName ?? "—"}</div>{r.methodLabel && <div className="text-xs">{r.methodLabel.toLowerCase() === "cod" ? t("common:extra.codShort") : methodText(t, r.methodKey, r.methodLabel)}</div>}</TableCell>
                    <TableCell className="text-right"><SignedMoney value={r.gross} format={money} positiveTone /></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{r.fee ? `−${money(r.fee)}` : "—"}</TableCell>
                    <TableCell className="text-right font-medium"><SignedMoney value={r.net} format={money} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.currency ?? currency}</TableCell>
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

      <PickSaleForPayment open={picking} onClose={() => setPicking(false)} onDone={refresh} />
      <TailorPaymentDialog target={tailor} onClose={() => setTailor(null)} onDone={refresh} />
    </div>
  )
}
