"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ArrowRight, Download, HandCoins, Scissors, Search, Truck, Users } from "lucide-react"
import { toast } from "sonner"
import financeApi, {
  financeError, type CustomerReceivableRow, type CustomerReceivables, type ReceivableSummary, type SupplierReceivableRow, type SupplierReceivables,
} from "@/lib/financeApi"
import { type SellResponse } from "@/lib/sellsApi"
import { shipmentsApi } from "@/lib/shipmentsApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatTile } from "@/components/common/StatTile"
import { StatusBadge } from "@/components/common/StatusBadge"
import { FilterBar } from "@/components/common/Toolbar"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import { TailorPaymentDialog, type TailorPayTarget } from "@/components/finance/payout-dialogs"
import { ReceivableCollectDialog } from "@/components/finance/receivable-collect-dialog"
import { AsOfNowLabel, CHANNELS, channelLabel } from "@/components/finance/finance-filters"
import { AgingBar, CurrencyTag, SignedMoney, TileSkeletons, csvMoney, downloadCsv, sentenceCase, useFinanceFormat } from "@/components/finance/finance-ui"
import { FIN_NS, methodText, statusText } from "@/components/finance/i18n"

const TABS = ["suppliers", "customers", "cod", "tailor"] as const
type Tab = (typeof TABS)[number]

/** Just the fields RecordPaymentDialog reads. */
function asSale(r: CustomerReceivableRow): SellResponse {
  return {
    id: r.sellId, invoiceNo: r.invoiceNo, customerName: r.customerName ?? "", amount: r.total, paidAmount: r.paid, dueAmount: r.due,
    status: (r.status as SellResponse["status"]) ?? "Pending", paymentStatus: r.paid > 0 ? "partial" : "unpaid", method: r.method ?? "",
    orderTime: r.orderDate ?? "", createdAt: r.orderDate ?? "", updatedAt: r.orderDate ?? "",
  }
}

/** Replace a few query keys without a navigation (no RSC request). */
function patchQuery(patch: Record<string, string | null>) {
  const p = new URLSearchParams(window.location.search)
  Object.entries(patch).forEach(([k, v]) => (v == null ? p.delete(k) : p.set(k, v)))
  const qs = p.toString()
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
}

export default function ReceivablesPage() {
  const blocked = useModuleGuard("Finance")
  const { t } = useTranslation(FIN_NS)
  /** Supplier balance direction code → label (server label is the fallback). */
  const directionText = (dir: string, serverLabel: string) =>
    dir === "we_owe" ? t("finance:receivables.weOwe") : dir === "they_owe" ? t("finance:receivables.theyOwe") : serverLabel
  const f = useFinanceFormat()
  const money = f.money
  const sp = useSearchParams()
  const { canWrite } = useSaasAuth()
  const canCollectDue = canWrite("Dues")
  const canCollectCod = canWrite("Shipments")
  const canCollectTailor = canWrite("TailorPayments")
  const canReceive = canWrite("Finance")

  const [tab, setTabState] = useState<Tab>("suppliers")
  const setTab = (t: Tab) => { setTabState(t); patchQuery({ tab: t }) }
  const [summary, setSummary] = useState<ReceivableSummary | null>(null)

  // Suppliers
  const [sup, setSup] = useState<SupplierReceivables | null>(null)
  const [supDir, setSupDir] = useState<"all" | "we_owe" | "they_owe">("all")
  const [supQ, setSupQ] = useState("")
  const [supQD, setSupQD] = useState("")
  const [supErr, setSupErr] = useState("")
  const [collect, setCollect] = useState<SupplierReceivableRow | null>(null)
  const collectFromUrl = useRef<number | null>(null)

  // Customers
  const [cust, setCust] = useState<CustomerReceivables | null>(null)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [bucket, setBucket] = useState("all")
  const [cod, setCod] = useState<"all" | "cod" | "other">("all")
  const [channel, setChannel] = useState("all")
  const [sort, setSort] = useState<"age" | "amount" | "name">("age")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [custLoading, setCustLoading] = useState(true)
  const [custErr, setCustErr] = useState("")
  const [sale, setSale] = useState<SellResponse | null>(null)

  const [tailor, setTailor] = useState<TailorPayTarget | null>(null)
  const [codRow, setCodRow] = useState<ReceivableSummary["codWithCouriers"]["rows"][number] | null>(null)
  const [codBusy, setCodBusy] = useState(false)

  // Deep links: ?tab=suppliers|customers|cod|tailor, ?collect=<vendorId>, ?cod=true
  const init = useRef(false)
  useEffect(() => {
    if (init.current) return
    init.current = true
    const t = sp.get("tab") as Tab | null
    if (t && TABS.includes(t)) setTabState(t)
    const c = sp.get("cod")
    if (c === "true" || c === "false") { setCod(c === "true" ? "cod" : "other"); if (!t) setTabState("customers") }
    const col = Number(sp.get("collect"))
    if (col > 0) { collectFromUrl.current = col; setTabState("suppliers") }
  }, [sp])

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { const t = setTimeout(() => setSupQD(supQ.trim()), 300); return () => clearTimeout(t) }, [supQ])
  useEffect(() => { setPage(1) }, [qD, bucket, cod, channel, sort])

  const loadSummary = useCallback(async () => {
    try { setSummary(await financeApi.getReceivableSummary()) } catch (e) { toast.error(financeError(e, t("finance:receivables.loadFailed"))) }
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  const loadSup = useCallback(async () => {
    setSupErr("")
    try {
      const r = await financeApi.getSupplierReceivables({ search: supQD || undefined, direction: supDir })
      setSup(r)
      if (collectFromUrl.current != null) {
        const row = r.rows.find((x) => x.vendorId === collectFromUrl.current)
        collectFromUrl.current = null
        patchQuery({ collect: null })
        if (row && row.net < 0) setCollect(row)
        else if (row) toast.info(t("finance:receivables.owesNothing", { name: row.displayName }))
      }
    } catch (e) { setSupErr(financeError(e, t("finance:receivables.supFailed"))) }
  }, [supQD, supDir])
  useEffect(() => { loadSup() }, [loadSup])

  const custParams = useCallback((p: number, pp: number) => ({
    search: qD || undefined, bucket: bucket === "all" ? ("all" as const) : Number(bucket), channel,
    cod: cod === "all" ? undefined : cod === "cod", sort, page: p, perPage: pp,
  }), [qD, bucket, channel, cod, sort])

  const loadCust = useCallback(async () => {
    setCustLoading(true); setCustErr("")
    try { setCust(await financeApi.getCustomerReceivables(custParams(page, perPage))) }
    catch (e) { setCustErr(financeError(e, t("finance:receivables.custFailed"))) }
    finally { setCustLoading(false) }
  }, [custParams, page, perPage])
  useEffect(() => { loadCust() }, [loadCust])

  const refresh = () => { loadSummary(); loadSup(); loadCust() }

  const recordCod = async () => {
    if (!codRow) return
    setCodBusy(true)
    try {
      await shipmentsApi.recordCodPayment(codRow.shipmentId)
      toast.success(t("finance:receivables.codRecorded", { amount: money(codRow.amount), invoice: codRow.invoiceNo ?? t("finance:receivables.theOrder") }))
      setCodRow(null); refresh()
    } catch (e) {
      toast.error(financeError(e, t("finance:receivables.codFailed")))
    } finally {
      setCodBusy(false)
    }
  }

  const exportCsv = async () => {
    const cur = summary ? f.currencyCode : f.currencyCode
    try {
      if (tab === "suppliers") {
        const rows = sup?.rows ?? []
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("receivables-suppliers", [
          [t("common:extra.supplier"), (r) => r.displayName], [t("finance:receivables.owedToThem"), (r) => csvMoney(r.owed)], [t("finance:payable.notYetDue"), (r) => csvMoney(r.notYetDue)], [t("finance:receivables.credits"), (r) => csvMoney(r.credits)],
          [t("finance:col.net"), (r) => csvMoney(r.net)], [t("finance:payable.payableNow"), (r) => csvMoney(r.payableNow)], [t("finance:transactions.direction"), (r) => directionText(r.direction, r.directionLabel)], [t("finance:col.currency"), () => cur],
        ], rows)
      } else if (tab === "customers") {
        const rows: CustomerReceivableRow[] = []
        for (let p = 1; p <= 50; p++) {
          const r = await financeApi.getCustomerReceivables(custParams(p, 100))
          rows.push(...r.rows)
          if (p >= r.meta.lastPage || r.rows.length === 0) break
        }
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("receivables-customers", [
          [t("finance:col.invoice"), (r) => r.invoiceNo], [t("common:fields.customer"), (r) => r.customerName], [t("common:fields.phone"), (r) => r.customerPhone], [t("finance:receivables.orderDate"), (r) => r.orderDate], [t("finance:receivables.ageDays"), (r) => r.ageDays],
          [t("common:money.total"), (r) => csvMoney(r.total)], [t("common:money.paid"), (r) => csvMoney(r.paid)], [t("common:money.due"), (r) => csvMoney(r.due)], [t("finance:col.method"), (r) => r.isCod ? "COD" : methodText(t, r.methodKey ?? r.method, r.method)], [t("finance:channel.label"), (r) => r.channel ? channelLabel(t, r.channel) : ""], [t("finance:col.currency"), () => cur],
        ], rows)
      } else if (tab === "cod") {
        const rows = summary?.codWithCouriers.rows ?? []
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("receivables-cod", [
          [t("finance:col.invoice"), (r) => r.invoiceNo], [t("common:fields.customer"), (r) => r.customerName], [t("finance:receivables.courier"), (r) => r.carrier], [t("finance:receivables.tracking"), (r) => r.trackingNumber],
          [t("common:fields.status"), (r) => statusText(t, r.status)], [t("common:money.amount"), (r) => csvMoney(r.amount)], [t("common:orderStatus.shipped"), (r) => r.shippedAt?.slice(0, 10)], [t("common:orderStatus.delivered"), (r) => r.deliveredAt?.slice(0, 10)], [t("finance:receivables.ageDays"), (r) => r.ageDays],
        ], rows)
      } else {
        const rows = summary?.tailorBalances.rows ?? []
        if (!rows.length) { toast.error(t("finance:actions.nothingToExport")); return }
        downloadCsv("receivables-tailor", [
          [t("finance:col.order"), (r) => r.orderNumber], [t("common:fields.customer"), (r) => r.customerName], [t("finance:receivables.orderDate"), (r) => r.orderDate], [t("finance:receivables.deliveryDate"), (r) => r.deliveryDate],
          [t("common:fields.status"), (r) => statusText(t, r.status)], [t("common:money.total"), (r) => csvMoney(r.total)], [t("common:money.paid"), (r) => csvMoney(r.paid)], [t("common:money.due"), (r) => csvMoney(r.due)],
        ], rows)
      }
    } catch (e) {
      toast.error(financeError(e, t("finance:actions.exportFailed")))
    }
  }

  if (blocked) return blocked

  const s = summary
  const owedByCustomers = s ? s.customerDues.total : null
  const currency = sup?.context.currency?.code ?? cust?.context.currency?.code

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title={t("finance:receivables.title")}
        description={t("finance:receivables.description")}
        actions={<Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" aria-hidden /> {t("finance:actions.exportCsv")}</Button>}
      >
        <div className="flex items-center gap-2"><AsOfNowLabel /><CurrencyTag code={currency} /></div>
      </PageHeader>

      <section aria-label={t("finance:transactions.totalsAria")} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? <TileSkeletons /> : <>
          <StatTile label={t("finance:overview.suppliersOweYou")} icon={<HandCoins />} value={money(s.suppliers.theyOweYou)} hint={t("finance:receivables.creditsUnused", { amount: money(s.suppliers.credits) })}
            onClick={() => setTab("suppliers")} active={tab === "suppliers"} />
          <StatTile label={t("finance:overview.owedByCustomers")} icon={<Users />} value={money(owedByCustomers ?? 0)} hint={`${t("finance:receivables.customers", { count: s.customerDues.partyCount })} · ${t("finance:receivables.inclCod", { amount: money(s.codWithCouriers.total) })}`}
            onClick={() => setTab("customers")} active={tab === "customers"} />
          <StatTile label={t("finance:receivables.codWithCouriers")} icon={<Truck />} value={money(s.codWithCouriers.total)}
            hint={s.codWithCouriers.byCourier.length ? s.codWithCouriers.byCourier.map((c) => `${c.carrier} ${money(c.amount)}`).join(" · ") : t("finance:receivables.shipments", { count: s.codWithCouriers.count })}
            onClick={() => setTab("cod")} active={tab === "cod"} />
          <StatTile label={t("finance:receivables.tailorBalances")} icon={<Scissors />} value={money(s.tailorBalances.total)} hint={t("common:count.orders", { count: s.tailorBalances.count })}
            onClick={() => setTab("tailor")} active={tab === "tailor"} />
        </>}
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList aria-label={t("finance:receivables.typeAria")} className="h-auto flex-wrap">
          <TabsTrigger value="suppliers">{t("finance:payouts.suppliers")}{sup ? ` (${sup.rows.length})` : ""}</TabsTrigger>
          <TabsTrigger value="customers">{t("finance:overview.customers")}{cust ? ` (${cust.totals.count})` : ""}</TabsTrigger>
          <TabsTrigger value="cod">{t("finance:receivables.codWithCouriers")}{s ? ` (${s.codWithCouriers.count})` : ""}</TabsTrigger>
          <TabsTrigger value="tailor">{t("finance:receivables.tailorOrders")}{s ? ` (${s.tailorBalances.count})` : ""}</TabsTrigger>
        </TabsList>

        {/* ── Suppliers ── */}
        <TabsContent value="suppliers" className="flex flex-col gap-4">
          <SectionCard contentClassName="flex flex-col gap-4 px-2"
            description={t("finance:receivables.supDesc")}
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/finance/payouts">{t("finance:payouts.title")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label={t("finance:receivables.searchSup")} placeholder={t("finance:receivables.searchSupPh")} value={supQ} onChange={(e) => setSupQ(e.target.value)} />
              </InputGroup>
              <SegmentedControl aria-label={t("finance:transactions.direction")} value={supDir} onValueChange={(v) => setSupDir(v as typeof supDir)}
                options={[{ value: "all", label: t("common:status.all") }, { value: "we_owe", label: t("finance:overview.youOwe") }, { value: "they_owe", label: t("finance:payable.theyOweYou") }]} />
            </FilterBar>
            {supErr && <Alert variant="destructive"><AlertDescription>{supErr}</AlertDescription></Alert>}
            {!sup ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : sup.rows.length === 0 ? (
              <EmptyState icon={Truck} title={t("finance:receivables.noSupTitle")} description={supQD || supDir !== "all" ? t("finance:ui.noMatchFilters") : t("finance:receivables.noSupDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common:extra.supplier")}</TableHead><TableHead className="text-right">{t("finance:receivables.owedToThem")}</TableHead><TableHead className="text-right">{t("finance:payable.notYetDue")}</TableHead>
                      <TableHead className="text-right">{t("finance:receivables.credits")}</TableHead><TableHead className="text-right">{t("finance:col.net")}</TableHead><TableHead className="text-right">{t("finance:payable.payableNow")}</TableHead>
                      <TableHead className="w-28"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sup.rows.map((r) => (
                      <TableRow key={r.vendorId}>
                        <TableCell>
                          {r.deleted ? (
                            <WithTooltip content={r.fullId ? t("finance:receivables.supplierId", { id: r.fullId }) : t("finance:receivables.supplierDeleted")}>
                              <span tabIndex={0} className="font-medium text-muted-foreground">{r.displayName}</span>
                            </WithTooltip>
                          ) : <Link href={`/dashboard/vendors/${r.vendorId}`} className="font-medium hover:underline">{r.displayName}</Link>}
                          <div className={cn("text-xs", r.net < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{directionText(r.direction, r.directionLabel)}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.owed)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.notYetDue ? money(r.notYetDue) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.credits ? money(r.credits) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold"><SignedMoney value={r.net} format={money} /></TableCell>
                        <TableCell className="text-right tabular-nums">{money(Math.max(0, r.payableNow))}</TableCell>
                        <TableCell className="text-right">
                          {r.net < 0 ? (
                            canReceive && <Button type="button" size="sm" variant="outline" onClick={() => setCollect(r)}>{t("finance:actions.collect")}</Button>
                          ) : r.net > 0 && (
                            r.payableNow > 0 && r.payHref && canWrite("Dues") ? (
                              <Button asChild size="sm" variant="outline"><Link href={r.payHref} prefetch={false}>{t("finance:receivables.payOut")}</Link></Button>
                            ) : (
                              <WithTooltip content={!canWrite("Dues") ? t("finance:receivables.noPayPermission") : r.payDisabledReason ?? t("finance:receivables.nothingPayableYet")}>
                                <span tabIndex={0}><Button type="button" size="sm" variant="outline" disabled>{t("finance:receivables.payOut")}</Button></span>
                              </WithTooltip>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">{t("common:money.total")}</TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{money(sup.totals.owed)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-bold tabular-nums">{money(sup.totals.credits)}</TableCell>
                      <TableCell className="text-right font-bold"><SignedMoney value={sup.totals.net} format={money} /></TableCell>
                      <TableCell className="text-right font-bold tabular-nums">{money(sup.totals.payableNow)}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Customers ── */}
        <TabsContent value="customers" className="flex flex-col gap-4">
          <SectionCard title={t("finance:receivables.agingTitle")} description={t("finance:receivables.agingDesc")}>
            {!cust ? <Skeleton className="h-16" /> : <AgingBar buckets={cust.aging} format={money} />}
          </SectionCard>
          <SectionCard contentClassName="flex flex-col gap-4 px-2"
            description={cust ? `${t("finance:receivables.custSummary", { amount: money(cust.totals.due), sales: t("finance:receivables.sales", { count: cust.totals.count }), customers: t("finance:receivables.customers", { count: cust.totals.customers }) })}${cust.totals.codDue ? ` · ${t("finance:receivables.codAmount", { amount: money(cust.totals.codDue) })}` : ""}. ${t("finance:receivables.equalsOverview")}` : undefined}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label={t("finance:receivables.searchCust")} placeholder={t("finance:receivables.searchCustPh")} value={q} onChange={(e) => setQ(e.target.value)} />
              </InputGroup>
              <Select value={bucket} onValueChange={setBucket}>
                <SelectTrigger aria-label={t("finance:col.age")} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("finance:receivables.anyAge")}</SelectItem>
                  {(cust?.aging ?? []).map((b) => <SelectItem key={b.key} value={String(b.key)}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cod} onValueChange={(v) => { setCod(v as typeof cod); patchQuery({ cod: v === "all" ? null : v === "cod" ? "true" : "false" }) }}>
                <SelectTrigger aria-label={t("common:extra.codShort")} className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("finance:receivables.codAll")}</SelectItem>
                  <SelectItem value="cod">{t("finance:receivables.codOnly")}</SelectItem>
                  <SelectItem value="other">{t("finance:receivables.notCod")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger aria-label={t("finance:channel.label")} className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(([c, l]) => <SelectItem key={c} value={c}>{t(l)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger aria-label={t("finance:sort.label")} className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="age">{t("finance:sort.oldest")}</SelectItem>
                  <SelectItem value="amount">{t("finance:sort.highestDue")}</SelectItem>
                  <SelectItem value="name">{t("finance:sort.nameAsc")}</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
            {custErr && <Alert variant="destructive"><AlertDescription>{custErr}</AlertDescription></Alert>}
            {custLoading && !cust ? (
              <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : !cust || cust.rows.length === 0 ? (
              <EmptyState icon={Users} title={t("finance:receivables.noCustTitle")} description={qD || bucket !== "all" || cod !== "all" || channel !== "all" ? t("finance:ui.noMatchFilters") : t("finance:receivables.noCustDesc")} />
            ) : (
              <div className={cn("overflow-x-auto", custLoading && "opacity-60")}>
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance:col.invoice")}</TableHead><TableHead>{t("common:fields.customer")}</TableHead><TableHead>{t("finance:col.age")}</TableHead><TableHead>{t("finance:receivables.payment")}</TableHead>
                      <TableHead className="text-right">{t("common:money.total")}</TableHead><TableHead className="text-right">{t("common:money.due")}</TableHead><TableHead className="w-36"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cust.rows.map((r) => (
                      <TableRow key={r.sellId}>
                        <TableCell>
                          {r.orderHref ? <Link href={r.orderHref} className="font-medium text-primary hover:underline">{r.invoiceNo}</Link> : <span className="font-medium">{r.invoiceNo}</span>}
                          <div className="text-xs text-muted-foreground">{f.date(r.orderDate)}{r.channel ? ` · ${CHANNELS.some(([c]) => c === r.channel) ? channelLabel(t, r.channel) : sentenceCase(r.channel)}` : ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.customerName || t("finance:pickSale.walkIn")}</div>
                          {r.customerPhone && <div className="text-xs text-muted-foreground">{r.customerPhone}</div>}
                        </TableCell>
                        <TableCell>
                          <div className={cn(r.ageDays > 30 && "text-destructive")}>{t("finance:receivables.days", { count: r.ageDays })}</div>
                          <div className="text-xs text-muted-foreground">{cust.aging.find((b) => b.key === r.bucket)?.label ?? ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{r.isCod ? t("common:extra.codShort") : r.method ? methodText(t, r.methodKey ?? r.method, sentenceCase(r.method)) : "—"}</span>
                            {r.paid > 0 && <Badge variant="secondary">{t("common:payment.partial")}</Badge>}
                          </div>
                          {r.isCod && r.codState && <div className="text-xs text-muted-foreground">{r.codState === "to_collect" ? t("finance:receivables.withCourier") : t("finance:receivables.deliveredRecord")}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.total)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.due)}</TableCell>
                        <TableCell className="text-right">
                          {canCollectDue && <Button type="button" size="sm" variant="outline" onClick={() => setSale(asSale(r))}>{t("finance:actions.recordPayment")}</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {cust && cust.meta.total > 0 && (
              <PaginationControl currentPage={page} totalPages={Math.max(1, cust.meta.lastPage)} itemsPerPage={perPage} totalItems={cust.meta.total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            )}
          </SectionCard>
        </TabsContent>

        {/* ── COD with couriers ── */}
        <TabsContent value="cod">
          <SectionCard contentClassName="px-2"
            description={t("finance:receivables.codDesc")}
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/orders/shipments">{t("finance:receivables.shipmentsLink")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            {!s ? <Skeleton className="mx-2 h-32" /> : s.codWithCouriers.rows.length === 0 ? (
              <EmptyState icon={Truck} title={t("finance:receivables.noCodTitle")} description={t("finance:receivables.noCodDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance:col.invoice")}</TableHead><TableHead>{t("common:fields.customer")}</TableHead><TableHead>{t("finance:receivables.courier")}</TableHead><TableHead>{t("common:fields.status")}</TableHead><TableHead>{t("common:orderStatus.delivered")}</TableHead>
                      <TableHead className="text-right">{t("common:extra.codShort")}</TableHead><TableHead className="w-28"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.codWithCouriers.rows.map((r) => (
                      <TableRow key={r.shipmentId}>
                        <TableCell className="font-medium">{r.invoiceNo ? <Link href={`/dashboard/orders?q=${encodeURIComponent(r.invoiceNo)}`} className="text-primary hover:underline">{r.invoiceNo}</Link> : "—"}</TableCell>
                        <TableCell>{r.customerName ?? "—"}</TableCell>
                        <TableCell><div>{r.carrier ?? "—"}</div>{r.trackingNumber && <div className="text-xs text-muted-foreground">{r.trackingNumber}</div>}</TableCell>
                        <TableCell><StatusBadge status={r.status ?? "—"} label={statusText(t, r.status)} /></TableCell>
                        <TableCell className="text-muted-foreground"><div>{f.date(r.deliveredAt)}</div><div className="text-xs">{t("finance:receivables.days", { count: r.ageDays })}</div></TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          {r.codState === "delivered_record_payment" && canCollectCod
                            ? <Button type="button" size="sm" variant="outline" onClick={() => setCodRow(r)}>{t("finance:actions.record")}</Button>
                            : <span className="text-xs text-muted-foreground">{r.codState === "to_collect" ? t("finance:receivables.onTheWay") : ""}</span>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ── Tailor ── */}
        <TabsContent value="tailor">
          <SectionCard contentClassName="px-2" description={t("finance:receivables.tailorDesc")}
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/tailor/payments">{t("finance:receivables.tailorPayments")} <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            {!s ? <Skeleton className="mx-2 h-32" /> : s.tailorBalances.rows.length === 0 ? (
              <EmptyState icon={Scissors} title={t("finance:receivables.noTailorTitle")} description={t("finance:receivables.noTailorDesc")} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("finance:col.order")}</TableHead><TableHead>{t("common:fields.customer")}</TableHead><TableHead>{t("finance:receivables.delivery")}</TableHead><TableHead>{t("common:fields.status")}</TableHead>
                      <TableHead className="text-right">{t("common:money.total")}</TableHead><TableHead className="text-right">{t("common:money.due")}</TableHead><TableHead className="w-24"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.tailorBalances.rows.map((r) => (
                      <TableRow key={r.orderId}>
                        <TableCell className="font-medium"><Link href={`/dashboard/tailor/orders/${r.orderId}`} className="text-primary hover:underline">{r.orderNumber ?? t("finance:receivables.openOrder")}</Link></TableCell>
                        <TableCell>{r.customerName ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{f.date(r.deliveryDate)}</TableCell>
                        <TableCell>{r.status ? <StatusBadge status={r.status} label={statusText(t, r.status)} /> : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.total)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.due)}</TableCell>
                        <TableCell className="text-right">
                          {canCollectTailor && <Button type="button" size="sm" variant="outline" onClick={() => setTailor({ kind: "customer", id: r.orderId })}>{t("finance:actions.collect")}</Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>

      <ReceivableCollectDialog row={collect} onClose={() => setCollect(null)} onDone={refresh} />
      <RecordPaymentDialog sales={sale ? [sale] : []} onClose={() => setSale(null)} onDone={refresh} />
      <TailorPaymentDialog target={tailor} onClose={() => setTailor(null)} onDone={refresh} />

      <AlertDialog open={!!codRow} onOpenChange={(o) => !o && !codBusy && setCodRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("finance:receivables.codQ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {codRow ? t("finance:receivables.codQDesc", { courier: codRow.carrier ?? t("finance:receivables.theCourier"), amount: money(codRow.amount), invoice: codRow.invoiceNo ?? t("finance:receivables.thisOrder") }) : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={codBusy}>{t("common:actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); recordCod() }} disabled={codBusy}>{codBusy ? t("common:actions.saving") : t("finance:receivables.recordCollection")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
