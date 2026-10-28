"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
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
import { AsOfNowLabel, CHANNELS } from "@/components/finance/finance-filters"
import { AgingBar, CurrencyTag, SignedMoney, TileSkeletons, csvMoney, downloadCsv, sentenceCase, useFinanceFormat } from "@/components/finance/finance-ui"

const TABS = ["suppliers", "customers", "cod", "tailor"] as const
type Tab = (typeof TABS)[number]
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

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
    try { setSummary(await financeApi.getReceivableSummary()) } catch (e) { toast.error(financeError(e, "Could not load receivables")) }
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
        else if (row) toast.info(`${row.displayName} doesn't owe you anything.`)
      }
    } catch (e) { setSupErr(financeError(e, "Could not load supplier balances.")) }
  }, [supQD, supDir])
  useEffect(() => { loadSup() }, [loadSup])

  const custParams = useCallback((p: number, pp: number) => ({
    search: qD || undefined, bucket: bucket === "all" ? ("all" as const) : Number(bucket), channel,
    cod: cod === "all" ? undefined : cod === "cod", sort, page: p, perPage: pp,
  }), [qD, bucket, channel, cod, sort])

  const loadCust = useCallback(async () => {
    setCustLoading(true); setCustErr("")
    try { setCust(await financeApi.getCustomerReceivables(custParams(page, perPage))) }
    catch (e) { setCustErr(financeError(e, "Could not load customer receivables.")) }
    finally { setCustLoading(false) }
  }, [custParams, page, perPage])
  useEffect(() => { loadCust() }, [loadCust])

  const refresh = () => { loadSummary(); loadSup(); loadCust() }

  const recordCod = async () => {
    if (!codRow) return
    setCodBusy(true)
    try {
      await shipmentsApi.recordCodPayment(codRow.shipmentId)
      toast.success(`COD of ${money(codRow.amount)} recorded for ${codRow.invoiceNo ?? "the order"}`)
      setCodRow(null); refresh()
    } catch (e) {
      toast.error(financeError(e, "Could not record the COD payment"))
    } finally {
      setCodBusy(false)
    }
  }

  const exportCsv = async () => {
    const cur = summary ? f.currencyCode : f.currencyCode
    try {
      if (tab === "suppliers") {
        const rows = sup?.rows ?? []
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("receivables-suppliers", [
          ["Supplier", (r) => r.displayName], ["Owed to them", (r) => csvMoney(r.owed)], ["Not yet due", (r) => csvMoney(r.notYetDue)], ["Credits", (r) => csvMoney(r.credits)],
          ["Net", (r) => csvMoney(r.net)], ["Payable now", (r) => csvMoney(r.payableNow)], ["Direction", (r) => r.directionLabel], ["Currency", () => cur],
        ], rows)
      } else if (tab === "customers") {
        const rows: CustomerReceivableRow[] = []
        for (let p = 1; p <= 50; p++) {
          const r = await financeApi.getCustomerReceivables(custParams(p, 100))
          rows.push(...r.rows)
          if (p >= r.meta.lastPage || r.rows.length === 0) break
        }
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("receivables-customers", [
          ["Invoice", (r) => r.invoiceNo], ["Customer", (r) => r.customerName], ["Phone", (r) => r.customerPhone], ["Order date", (r) => r.orderDate], ["Age days", (r) => r.ageDays],
          ["Total", (r) => csvMoney(r.total)], ["Paid", (r) => csvMoney(r.paid)], ["Due", (r) => csvMoney(r.due)], ["Method", (r) => r.method], ["Channel", (r) => r.channel], ["Currency", () => cur],
        ], rows)
      } else if (tab === "cod") {
        const rows = summary?.codWithCouriers.rows ?? []
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("receivables-cod", [
          ["Invoice", (r) => r.invoiceNo], ["Customer", (r) => r.customerName], ["Courier", (r) => r.carrier], ["Tracking", (r) => r.trackingNumber],
          ["Status", (r) => sentenceCase(r.status)], ["Amount", (r) => csvMoney(r.amount)], ["Shipped", (r) => r.shippedAt?.slice(0, 10)], ["Delivered", (r) => r.deliveredAt?.slice(0, 10)], ["Age days", (r) => r.ageDays],
        ], rows)
      } else {
        const rows = summary?.tailorBalances.rows ?? []
        if (!rows.length) { toast.error("Nothing to export."); return }
        downloadCsv("receivables-tailor", [
          ["Order", (r) => r.orderNumber], ["Customer", (r) => r.customerName], ["Order date", (r) => r.orderDate], ["Delivery date", (r) => r.deliveryDate],
          ["Status", (r) => sentenceCase(r.status)], ["Total", (r) => csvMoney(r.total)], ["Paid", (r) => csvMoney(r.paid)], ["Due", (r) => csvMoney(r.due)],
        ], rows)
      }
    } catch (e) {
      toast.error(financeError(e, "Export failed"))
    }
  }

  if (blocked) return blocked

  const s = summary
  const owedByCustomers = s ? s.customerDues.total : null
  const currency = sup?.context.currency?.code ?? cust?.context.currency?.code

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Receivables"
        description="Owed to and from suppliers and customers"
        actions={<Button type="button" variant="outline" onClick={exportCsv}><Download className="size-4" aria-hidden /> Export CSV</Button>}
      >
        <div className="flex items-center gap-2"><AsOfNowLabel /><CurrencyTag code={currency} /></div>
      </PageHeader>

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!s ? <TileSkeletons /> : <>
          <StatTile label="Suppliers owe you" icon={<HandCoins />} value={money(s.suppliers.theyOweYou)} hint={`Credits ${money(s.suppliers.credits)} not yet used`}
            onClick={() => setTab("suppliers")} active={tab === "suppliers"} />
          <StatTile label="Owed by customers" icon={<Users />} value={money(owedByCustomers ?? 0)} hint={`${plural(s.customerDues.partyCount, "customer")} · incl. COD ${money(s.codWithCouriers.total)}`}
            onClick={() => setTab("customers")} active={tab === "customers"} />
          <StatTile label="COD with couriers" icon={<Truck />} value={money(s.codWithCouriers.total)}
            hint={s.codWithCouriers.byCourier.length ? s.codWithCouriers.byCourier.map((c) => `${c.carrier} ${money(c.amount)}`).join(" · ") : plural(s.codWithCouriers.count, "shipment")}
            onClick={() => setTab("cod")} active={tab === "cod"} />
          <StatTile label="Tailor balances" icon={<Scissors />} value={money(s.tailorBalances.total)} hint={plural(s.tailorBalances.count, "order")}
            onClick={() => setTab("tailor")} active={tab === "tailor"} />
        </>}
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <TabsList aria-label="Receivable type" className="h-auto flex-wrap">
          <TabsTrigger value="suppliers">Suppliers{sup ? ` (${sup.rows.length})` : ""}</TabsTrigger>
          <TabsTrigger value="customers">Customers{cust ? ` (${cust.totals.count})` : ""}</TabsTrigger>
          <TabsTrigger value="cod">COD with couriers{s ? ` (${s.codWithCouriers.count})` : ""}</TabsTrigger>
          <TabsTrigger value="tailor">Tailor orders{s ? ` (${s.tailorBalances.count})` : ""}</TabsTrigger>
        </TabsList>

        {/* ── Suppliers ── */}
        <TabsContent value="suppliers" className="flex flex-col gap-4">
          <SectionCard contentClassName="flex flex-col gap-4 px-2"
            description="What you owe each supplier, less the credits (returns credited to you). A negative net means they owe you."
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/finance/payouts">Payouts <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label="Search suppliers" placeholder="Supplier…" value={supQ} onChange={(e) => setSupQ(e.target.value)} />
              </InputGroup>
              <SegmentedControl aria-label="Direction" value={supDir} onValueChange={(v) => setSupDir(v as typeof supDir)}
                options={[{ value: "all", label: "All" }, { value: "we_owe", label: "You owe" }, { value: "they_owe", label: "They owe you" }]} />
            </FilterBar>
            {supErr && <Alert variant="destructive"><AlertDescription>{supErr}</AlertDescription></Alert>}
            {!sup ? <div className="flex flex-col gap-2 px-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-11" />)}</div> : sup.rows.length === 0 ? (
              <EmptyState icon={Truck} title="No supplier balances" description={supQD || supDir !== "all" ? "Nothing matches these filters." : "You owe no supplier and none owes you."} />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[820px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead><TableHead className="text-right">Owed to them</TableHead><TableHead className="text-right">Not yet due</TableHead>
                      <TableHead className="text-right">Credits</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Payable now</TableHead>
                      <TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sup.rows.map((r) => (
                      <TableRow key={r.vendorId}>
                        <TableCell>
                          {r.deleted ? (
                            <WithTooltip content={r.fullId ? `Supplier id ${r.fullId}` : "This supplier was deleted"}>
                              <span tabIndex={0} className="font-medium text-muted-foreground">{r.displayName}</span>
                            </WithTooltip>
                          ) : <Link href={`/dashboard/vendors/${r.vendorId}`} className="font-medium hover:underline">{r.displayName}</Link>}
                          <div className={cn("text-xs", r.net < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>{r.directionLabel}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.owed)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.notYetDue ? money(r.notYetDue) : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.credits ? money(r.credits) : "—"}</TableCell>
                        <TableCell className="text-right font-semibold"><SignedMoney value={r.net} format={money} /></TableCell>
                        <TableCell className="text-right tabular-nums">{money(Math.max(0, r.payableNow))}</TableCell>
                        <TableCell className="text-right">
                          {r.net < 0 ? (
                            canReceive && <Button type="button" size="sm" variant="outline" onClick={() => setCollect(r)}>Collect</Button>
                          ) : r.net > 0 && (
                            r.payableNow > 0 && r.payHref && canWrite("Dues") ? (
                              <Button asChild size="sm" variant="outline"><Link href={r.payHref} prefetch={false}>Pay out</Link></Button>
                            ) : (
                              <WithTooltip content={!canWrite("Dues") ? "You don't have permission to pay suppliers." : r.payDisabledReason ?? "Nothing is payable yet."}>
                                <span tabIndex={0}><Button type="button" size="sm" variant="outline" disabled>Pay out</Button></span>
                              </WithTooltip>
                            )
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-bold">Total</TableCell>
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
          <SectionCard title="How old are the customer dues?" description="By order date of each unpaid or partly paid sale (COD not collected included).">
            {!cust ? <Skeleton className="h-16" /> : <AgingBar buckets={cust.aging} format={money} />}
          </SectionCard>
          <SectionCard contentClassName="flex flex-col gap-4 px-2"
            description={cust ? `${money(cust.totals.due)} due on ${plural(cust.totals.count, "sale")} from ${plural(cust.totals.customers, "customer")}${cust.totals.codDue ? ` · ${money(cust.totals.codDue)} COD` : ""}. With no filters this equals “Owed by customers” on the Overview.` : undefined}>
            <FilterBar className="px-2">
              <InputGroup className="w-full sm:w-64">
                <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
                <InputGroupInput aria-label="Search customer receivables" placeholder="Invoice, customer, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
              </InputGroup>
              <Select value={bucket} onValueChange={setBucket}>
                <SelectTrigger aria-label="Age" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any age</SelectItem>
                  {(cust?.aging ?? []).map((b) => <SelectItem key={b.key} value={String(b.key)}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={cod} onValueChange={(v) => { setCod(v as typeof cod); patchQuery({ cod: v === "all" ? null : v === "cod" ? "true" : "false" }) }}>
                <SelectTrigger aria-label="COD" className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">COD and other</SelectItem>
                  <SelectItem value="cod">COD only</SelectItem>
                  <SelectItem value="other">Not COD</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger aria-label="Channel" className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{CHANNELS.map(([c, l]) => <SelectItem key={c} value={c}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
                <SelectTrigger aria-label="Sort" className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="age">Oldest first</SelectItem>
                  <SelectItem value="amount">Highest due</SelectItem>
                  <SelectItem value="name">Name A–Z</SelectItem>
                </SelectContent>
              </Select>
            </FilterBar>
            {custErr && <Alert variant="destructive"><AlertDescription>{custErr}</AlertDescription></Alert>}
            {custLoading && !cust ? (
              <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : !cust || cust.rows.length === 0 ? (
              <EmptyState icon={Users} title="No customer dues" description={qD || bucket !== "all" || cod !== "all" || channel !== "all" ? "Nothing matches these filters." : "Every sale is paid."} />
            ) : (
              <div className={cn("overflow-x-auto", custLoading && "opacity-60")}>
                <Table className="min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Age</TableHead><TableHead>Payment</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="w-36"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cust.rows.map((r) => (
                      <TableRow key={r.sellId}>
                        <TableCell>
                          {r.orderHref ? <Link href={r.orderHref} className="font-medium text-primary hover:underline">{r.invoiceNo}</Link> : <span className="font-medium">{r.invoiceNo}</span>}
                          <div className="text-xs text-muted-foreground">{f.date(r.orderDate)}{r.channel ? ` · ${CHANNELS.find(([c]) => c === r.channel)?.[1] ?? sentenceCase(r.channel)}` : ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{r.customerName || "Walk-in"}</div>
                          {r.customerPhone && <div className="text-xs text-muted-foreground">{r.customerPhone}</div>}
                        </TableCell>
                        <TableCell>
                          <div className={cn(r.ageDays > 30 && "text-destructive")}>{r.ageDays} days</div>
                          <div className="text-xs text-muted-foreground">{cust.aging.find((b) => b.key === r.bucket)?.label ?? ""}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span>{r.isCod ? "COD" : sentenceCase(r.method)}</span>
                            {r.paid > 0 && <Badge variant="secondary">Partly paid</Badge>}
                          </div>
                          {r.isCod && r.codState && <div className="text-xs text-muted-foreground">{r.codState === "to_collect" ? "With the courier" : "Delivered — record the collection"}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.total)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.due)}</TableCell>
                        <TableCell className="text-right">
                          {canCollectDue && <Button type="button" size="sm" variant="outline" onClick={() => setSale(asSale(r))}>Record payment</Button>}
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
            description="COD shipments handed to the courier whose cash is not recorded yet. Record the collection once the courier pays you. Already part of “Owed by customers”."
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/orders/shipments">Shipments <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            {!s ? <Skeleton className="mx-2 h-32" /> : s.codWithCouriers.rows.length === 0 ? (
              <EmptyState icon={Truck} title="No COD cash with couriers" description="Every delivered COD order has been collected." />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Courier</TableHead><TableHead>Status</TableHead><TableHead>Delivered</TableHead>
                      <TableHead className="text-right">COD</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.codWithCouriers.rows.map((r) => (
                      <TableRow key={r.shipmentId}>
                        <TableCell className="font-medium">{r.invoiceNo ? <Link href={`/dashboard/orders?q=${encodeURIComponent(r.invoiceNo)}`} className="text-primary hover:underline">{r.invoiceNo}</Link> : "—"}</TableCell>
                        <TableCell>{r.customerName ?? "—"}</TableCell>
                        <TableCell><div>{r.carrier ?? "—"}</div>{r.trackingNumber && <div className="text-xs text-muted-foreground">{r.trackingNumber}</div>}</TableCell>
                        <TableCell><StatusBadge status={r.status ?? "—"} label={sentenceCase(r.status)} /></TableCell>
                        <TableCell className="text-muted-foreground"><div>{f.date(r.deliveredAt)}</div><div className="text-xs">{r.ageDays} days</div></TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.amount)}</TableCell>
                        <TableCell className="text-right">
                          {r.codState === "delivered_record_payment" && canCollectCod
                            ? <Button type="button" size="sm" variant="outline" onClick={() => setCodRow(r)}>Record</Button>
                            : <span className="text-xs text-muted-foreground">{r.codState === "to_collect" ? "On the way" : ""}</span>}
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
          <SectionCard contentClassName="px-2" description="Tailor orders with a balance still to collect."
            actions={<Button asChild variant="ghost" size="sm"><Link href="/dashboard/tailor/payments">Tailor payments <ArrowRight className="size-4" aria-hidden /></Link></Button>}>
            {!s ? <Skeleton className="mx-2 h-32" /> : s.tailorBalances.rows.length === 0 ? (
              <EmptyState icon={Scissors} title="No tailor balances" description="Every tailor order is paid." />
            ) : (
              <div className="overflow-x-auto">
                <Table className="min-w-[720px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Delivery</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead><TableHead className="text-right">Due</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {s.tailorBalances.rows.map((r) => (
                      <TableRow key={r.orderId}>
                        <TableCell className="font-medium"><Link href={`/dashboard/tailor/orders/${r.orderId}`} className="text-primary hover:underline">{r.orderNumber ?? "Open order"}</Link></TableCell>
                        <TableCell>{r.customerName ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{f.date(r.deliveryDate)}</TableCell>
                        <TableCell>{r.status ? <StatusBadge status={r.status} label={sentenceCase(r.status)} /> : "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.total)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">{money(r.due)}</TableCell>
                        <TableCell className="text-right">
                          {canCollectTailor && <Button type="button" size="sm" variant="outline" onClick={() => setTailor({ kind: "customer", id: r.orderId })}>Collect</Button>}
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
            <AlertDialogTitle>Record COD collection?</AlertDialogTitle>
            <AlertDialogDescription>
              {codRow ? `${codRow.carrier ?? "The courier"} handed over ${money(codRow.amount)} for ${codRow.invoiceNo ?? "this order"}. This records the payment on the sale, the same as on the Shipments page.` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={codBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); recordCod() }} disabled={codBusy}>{codBusy ? "Saving…" : "Record collection"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
