"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeftRight, Banknote, Download, MoreHorizontal, Pencil, Percent, Plus, Search, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"
import financeApi, { financeError, type AccountsResult, type FinanceAccount, type LedgerParams, type LedgerResult, type LedgerRow } from "@/lib/financeApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { FilterBar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { AccountDialog, EntryDialog, TransferDialog } from "@/components/finance/account-dialogs"
import { PaymentFeesDialog } from "@/components/finance/transactions-fees-dialog"
import { FinanceFilters, useFinanceFilters } from "@/components/finance/finance-filters"
import {
  CurrencyTag, SOURCE_LABELS, SignedMoney, accountTypeLabel, csvMoney, downloadCsv, sourceLabel, useFinanceFormat,
} from "@/components/finance/finance-ui"

const ALL = "all"

export default function TransactionsPage() {
  const blocked = useModuleGuard("Finance")
  const { formatCurrency, currency } = useCompanySettings()
  const fmt = useFinanceFormat()
  const { canWrite, canDelete } = useSaasAuth()
  const writable = canWrite("Finance")
  const deletable = canDelete("Finance")
  const money = (n: number) => formatCurrency(n)

  const filters = useFinanceFilters()
  const [account, setAccount] = useState(ALL)
  const [direction, setDirection] = useState(ALL)
  const [source, setSource] = useState(ALL)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)

  const [accRes, setAccRes] = useState<AccountsResult | null>(null)
  const accounts = accRes?.accounts ?? []
  const [accLoading, setAccLoading] = useState(true)
  const [data, setData] = useState<LedgerResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [exporting, setExporting] = useState(false)

  const [accDlg, setAccDlg] = useState<FinanceAccount | "new" | null>(null)
  const [entryDlg, setEntryDlg] = useState<"new" | number | null>(null)
  const [transferDlg, setTransferDlg] = useState<"new" | number | null>(null)
  const [feesOpen, setFeesOpen] = useState(false)
  // Deep link from Overview "Fee settings": ?fees=1 opens the payment-fee editor once
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get("fees") === "1" && writable) {
      setFeesOpen(true)
      sp.delete("fees")
      const qs = sp.toString()
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`)
    }
  }, [writable])
  const [confirm, setConfirm] = useState<{ title: string; body: string; run: () => Promise<unknown> } | null>(null)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1) }, [filters.key, account, direction, source, qD])

  const loadAccounts = useCallback(async () => {
    try { setAccRes(await financeApi.getAccounts()) } catch (e) { toast.error(financeError(e, "Could not load accounts")) } finally { setAccLoading(false) }
  }, [])
  useEffect(() => { loadAccounts() }, [loadAccounts])

  const fp = filters.params
  const params = useCallback((p: number, pp: number): LedgerParams => ({
    ...fp,
    accountId: account !== ALL ? Number(account) : undefined,
    direction: direction !== ALL ? (direction as "in" | "out") : undefined,
    sourceType: source !== ALL ? source : undefined,
    search: qD || undefined, page: p, perPage: pp,
  }), [filters.key, account, direction, source, qD]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    if (!filters.ready || filters.incomplete) return
    setLoading(true); setError("")
    try { setData(await financeApi.getTransactions(params(page, perPage))) }
    catch (e) { setError(financeError(e, "Could not load transactions.")) }
    finally { setLoading(false) }
  }, [params, page, perPage, filters.ready, filters.incomplete])
  useEffect(() => { load() }, [load])

  const refresh = () => { load(); loadAccounts() }

  const exportCsv = async () => {
    setExporting(true)
    try {
      // TXN-3: server CSV respects every filter (period, channel, account, type, search) and has Gross/Fee/Net/Currency
      const { page: _p, perPage: _pp, ...all } = params(1, 100)
      await financeApi.downloadCsv("/finance/transactions", all as Record<string, unknown>, "transactions.csv")
      return
    } catch {
      // fall back to building the CSV here
    }
    try {
      const rows: LedgerRow[] = []
      for (let p = 1; p <= 100; p++) {
        const r = await financeApi.getTransactions(params(p, 100))
        rows.push(...r.rows)
        if (p >= r.meta.lastPage || r.rows.length === 0) break
      }
      if (!rows.length) { toast.error("Nothing to export."); return }
      const oneAccount = account !== ALL
      downloadCsv("transactions", [
        ["Date", (r) => r.date],
        ["Type", (r) => r.sourceLabel || sourceLabel(r.sourceType)],
        ["Direction", (r) => (r.direction === "in" ? "In" : "Out")],
        ["Gross", (r) => csvMoney(r.gross)],
        ["Fee", (r) => csvMoney(r.fee)],
        ["Net", (r) => csvMoney(r.net)],
        ["Currency", (r) => r.currency ?? currency],
        ["Account", (r) => r.accountName],
        ["Method", (r) => r.methodLabel],
        ["Party", (r) => r.party],
        ["Reference", (r) => r.reference],
        ["Category", (r) => r.category],
        ["Note", (r) => r.note],
        ...(oneAccount ? [["Balance", (r: LedgerRow) => (r.runningBalance != null ? csvMoney(r.runningBalance) : "")] as [string, (r: LedgerRow) => string]] : []),
      ], rows)
    } catch (e) {
      toast.error(financeError(e, "Export failed"))
    } finally {
      setExporting(false)
    }
  }

  const setDefault = async (a: FinanceAccount) => {
    try { await financeApi.setDefaultAccount(a.id); toast.success(`${a.name} is now the default account`); loadAccounts() }
    catch (e) { toast.error(financeError(e, "Could not change the default account")) }
  }

  const runConfirm = async () => {
    if (!confirm) return
    try { await confirm.run(); refresh() } catch (e) { toast.error(financeError(e, "Could not delete")) } finally { setConfirm(null) }
  }

  if (blocked) return blocked

  const oneAccount = account !== ALL
  const activeAccounts = accounts.filter((a) => a.isActive)
  const total = accRes?.totals.balance ?? 0
  const unmapped = accRes?.unmappedMethods ?? []
  const defaultName = accounts.find((a) => a.isDefault)?.name

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader
        title="Transactions"
        description={<>Every taka in and out — sales, refunds, supplier payments, expenses, salaries, payouts, manual entries and transfers. Money out is negative. <CurrencyTag code={data?.context.currency?.code} className="ml-1 align-middle" /></>}
        actions={<>
          <Button type="button" variant="outline" onClick={exportCsv} disabled={exporting}><Download className="size-4" aria-hidden /> {exporting ? "Exporting…" : "Export CSV"}</Button>
          {writable && <>
            <Button type="button" variant="outline" onClick={() => setTransferDlg("new")} disabled={activeAccounts.length < 2}><ArrowLeftRight className="size-4" aria-hidden /> Transfer</Button>
            <Button type="button" onClick={() => setEntryDlg("new")} disabled={!activeAccounts.length}><Plus className="size-4" aria-hidden /> Add entry</Button>
          </>}
        </>}
      />

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <SectionCard
          title="Accounts"
          description={accLoading ? undefined : `Total ${formatCurrency(total)}`}
          actions={writable && (
            <>
              <WithTooltip content="Payment fees">
                <Button type="button" variant="outline" size="icon" aria-label="Payment fees" onClick={() => setFeesOpen(true)}><Percent className="size-4" aria-hidden /></Button>
              </WithTooltip>
              <WithTooltip content="Add account">
                <Button type="button" variant="outline" size="icon" aria-label="Add account" onClick={() => setAccDlg("new")}><Plus className="size-4" aria-hidden /></Button>
              </WithTooltip>
            </>
          )}
          className="h-fit"
          contentClassName="px-3"
        >
          {accLoading ? <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div> : (
            <ul className="flex flex-col gap-1">
              <li>
                <Button type="button" variant="ghost" aria-pressed={!oneAccount} onClick={() => setAccount(ALL)}
                  className={cn("h-auto w-full justify-between px-3 py-2.5", !oneAccount && "bg-accent")}>
                  <span className="font-medium">All accounts</span>
                </Button>
              </li>
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-1">
                  <Button type="button" variant="ghost" aria-pressed={account === String(a.id)} onClick={() => setAccount(String(a.id))}
                    className={cn("h-auto min-w-0 flex-1 justify-between gap-3 px-3 py-2.5 text-left", account === String(a.id) && "bg-accent", !a.isActive && "opacity-60")}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="truncate">{a.name}</span>
                        {a.isDefault && <Badge variant="secondary" className="px-1.5">Default</Badge>}
                        {!a.isActive && <Badge variant="outline" className="px-1.5">Inactive</Badge>}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">{a.typeLabel || accountTypeLabel(a.type)}{a.methodLabels.length ? ` · ${a.methodLabels.join(", ")}` : ""}{a.receivesUnmapped ? " · other methods" : ""}</span>
                    </span>
                    <SignedMoney value={a.balance} format={money} className="font-semibold" />
                  </Button>
                  {writable && (
                    <DropdownMenu>
                      <WithTooltip content={`${a.name} options`}>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`${a.name} options`}><MoreHorizontal className="size-4" aria-hidden /></Button>
                        </DropdownMenuTrigger>
                      </WithTooltip>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setAccDlg(a)}><Pencil className="size-4" aria-hidden /> Edit</DropdownMenuItem>
                        {!a.isDefault && a.isActive && <DropdownMenuItem onClick={() => setDefault(a)}><Star className="size-4" aria-hidden /> Set as default</DropdownMenuItem>}
                        {deletable && !a.isDefault && <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onClick={() => setConfirm({
                            title: `Delete ${a.name}?`,
                            body: "Accounts with manual entries or transfers cannot be deleted — deactivate them instead. Its payment methods will post to the default account.",
                            run: async () => { await financeApi.deleteAccount(a.id); toast.success("Account deleted"); if (account === String(a.id)) setAccount(ALL) },
                          })}><Trash2 className="size-4" aria-hidden /> Delete</DropdownMenuItem>
                        </>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          )}
          {unmapped.length > 0 && (
            <p className="mt-3 px-3 text-xs text-muted-foreground">
              Not mapped to an account (posted to {defaultName ?? "the default account"}): {unmapped.map((m) => `${m.label} (${m.count})`).join(", ")}.
            </p>
          )}
        </SectionCard>

        <div className="flex min-w-0 flex-col gap-4">
          <section aria-label="Totals" className={cn("grid gap-4 sm:grid-cols-3", loading && data && "opacity-60")}>
            <StatTile label="Gross" value={<SignedMoney value={data?.totals.gross ?? 0} format={money} />}
              hint={`In ${money(data?.totals.moneyIn ?? 0)} · out ${money(data?.totals.moneyOut ?? 0)}`} />
            <StatTile label="Fees" value={<span className={cn((data?.totals.fees ?? 0) > 0 && "text-destructive")}>{(data?.totals.fees ?? 0) > 0 ? "−" : ""}{money(data?.totals.fees ?? 0)}</span>}
              hint={writable ? <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setFeesOpen(true)}>Estimated payment fees · edit rates</Button> : "Estimated payment fees"} />
            <StatTile label="Net after fees" value={<SignedMoney value={data?.totals.netAfterFees ?? 0} format={money} />}
              hint={oneAccount && data?.openingBalance != null ? `Opening ${money(data.openingBalance)} → closing ${money(data.closingBalance ?? 0)}` : `${fmt.number(data?.totals.count ?? 0)} transactions · ${filters.label}`} />
          </section>

          <FilterBar>
            <InputGroup className="w-full sm:w-64">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput aria-label="Search transactions" placeholder="Party, reference, note…" value={q} onChange={(e) => setQ(e.target.value)} />
            </InputGroup>
            <FinanceFilters filters={filters} idPrefix="transactions" />
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger aria-label="Direction" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>In and out</SelectItem>
                <SelectItem value="in">Money in</SelectItem>
                <SelectItem value="out">Money out</SelectItem>
              </SelectContent>
            </Select>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger aria-label="Type" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {Object.entries(SOURCE_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={account} onValueChange={setAccount}>
              <SelectTrigger aria-label="Account" className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterBar>

          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

          <SectionCard contentClassName="px-2" className="gap-3">
            {loading && !data ? (
              <div className="flex flex-col gap-2 px-2">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-11" />)}</div>
            ) : !data || data.rows.length === 0 ? (
              <EmptyState icon={Banknote} title="No transactions" description="Nothing matches these filters for the period." />
            ) : (
              <div className={cn("overflow-x-auto", loading && "opacity-60")}>
                <Table className="min-w-[1040px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Party / details</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Currency</TableHead>
                      {oneAccount && <TableHead className="text-right">Balance</TableHead>}
                      {writable && <TableHead className="w-10"><span className="sr-only">Actions</span></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.rows.map((r) => {
                      const editable = writable && r.editable && (r.entryId != null || r.transferId != null)
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-muted-foreground">{fmt.date(r.date)}</TableCell>
                          <TableCell><Badge variant={r.direction === "in" ? "secondary" : "outline"}>{r.sourceLabel || sourceLabel(r.sourceType)}</Badge></TableCell>
                          <TableCell className="max-w-[260px]">
                            <div className="truncate font-medium">{r.party || r.category || "—"}</div>
                            {(r.note || (r.category && r.party)) && <div className="truncate text-xs text-muted-foreground">{[r.party ? r.category : null, r.note].filter(Boolean).join(" · ")}</div>}
                          </TableCell>
                          <TableCell>{r.link ? <Link href={r.link.href} className="font-medium text-primary hover:underline">{r.reference || "Open"}</Link> : (r.reference || "—")}</TableCell>
                          <TableCell className="text-muted-foreground">
                            <div>{r.accountName ?? "—"}</div>
                            {r.methodLabel && <div className="text-xs">{r.methodLabel}</div>}
                          </TableCell>
                          <TableCell className="text-right font-medium"><SignedMoney value={r.gross} format={money} positiveTone /></TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{r.fee ? `−${money(r.fee)}` : "—"}</TableCell>
                          <TableCell className="text-right"><SignedMoney value={r.net} format={money} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.currency ?? data.context.currency?.code ?? currency}</TableCell>
                          {oneAccount && <TableCell className="text-right">{r.runningBalance != null ? <SignedMoney value={r.runningBalance} format={money} /> : "—"}</TableCell>}
                          {writable && (
                            <TableCell>
                              {editable && (
                                <DropdownMenu>
                                  <WithTooltip content="Entry options">
                                    <DropdownMenuTrigger asChild>
                                      <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Entry options"><MoreHorizontal className="size-4" aria-hidden /></Button>
                                    </DropdownMenuTrigger>
                                  </WithTooltip>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => (r.entryId != null ? setEntryDlg(r.entryId) : setTransferDlg(r.transferId!))}>
                                      <Pencil className="size-4" aria-hidden /> Edit
                                    </DropdownMenuItem>
                                    {deletable && (
                                      <DropdownMenuItem variant="destructive" onClick={() => setConfirm(r.entryId != null ? {
                                        title: "Delete this entry?", body: `${money(r.amount)} ${r.direction === "in" ? "in" : "out"} on ${fmt.date(r.date)} will be removed from the ledger.`,
                                        run: async () => { await financeApi.deleteEntry(r.entryId!); toast.success("Entry deleted") },
                                      } : {
                                        title: "Delete this transfer?", body: "Both sides of the transfer are removed and the account balances change back.",
                                        run: async () => { await financeApi.deleteTransfer(r.transferId!); toast.success("Transfer deleted") },
                                      })}>
                                        <Trash2 className="size-4" aria-hidden /> Delete
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {data && data.meta.total > 0 && (
              <PaginationControl currentPage={page} totalPages={Math.max(1, data.meta.lastPage)} itemsPerPage={perPage} totalItems={data.meta.total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            )}
          </SectionCard>
        </div>
      </div>

      <AccountDialog account={accDlg} accounts={accounts} methodOptions={accRes?.methodOptions ?? []} onClose={() => setAccDlg(null)} onSaved={refresh} />
      <EntryDialog entry={entryDlg} accounts={accounts} onClose={() => setEntryDlg(null)} onSaved={refresh} />
      <TransferDialog transfer={transferDlg} accounts={accounts} onClose={() => setTransferDlg(null)} onSaved={refresh} />
      <PaymentFeesDialog open={feesOpen} onClose={() => setFeesOpen(false)} onSaved={load} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-destructive text-white hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
