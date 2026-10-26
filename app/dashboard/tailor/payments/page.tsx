"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Printer, Search, Users, Wallet, Banknote } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { FilterBar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorApi, type TailorLedger, type TailorLedgerKind, type TailorLedgerRow, type TailorPayableOption } from "@/lib/tailorApi"
import { saasCompanyApi, type CompanyProfile } from "@/lib/saasCompanyApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Range = "all" | "month" | "today"

const METHODS: [string, string][] = [["cash", "Cash"], ["bank", "Bank transfer"], ["bkash", "bKash"], ["nagad", "Nagad"], ["card", "Card"]]
const RANGES: [Range, string][] = [["all", "All time"], ["month", "This month"], ["today", "Today"]]


const pad = (n: number) => String(n).padStart(2, "0")
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const r2 = (v: number) => Math.round(v * 100) / 100
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const typeVariant: Record<string, "default" | "secondary" | "outline"> = {
  advance: "secondary",
  payment: "default",
  final: "default",
  payout: "outline",
}

export default function TailorPaymentsPage() {
  const { formatCurrency } = useCompanySettings()
  const { canWrite } = useSaasAuth()
  const blocked = useModuleGuard("TailorPayments")
  const mayWrite = canWrite("TailorPayments")

  const [ledger, setLedger] = useState<TailorLedger | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<CompanyProfile | null>(null)

  const [tab, setTab] = useState<TailorLedgerKind>("customer")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [methodF, setMethodF] = useState("all")
  const [rangeF, setRangeF] = useState<Range>("all")
  const [fromD, setFromD] = useState("")
  const [toD, setToD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  // record form
  const [kind, setKind] = useState<TailorLedgerKind>("customer")
  const [opts, setOpts] = useState<TailorPayableOption[]>([])
  const [optsLoading, setOptsLoading] = useState(true)
  const [pick, setPick] = useState("")
  const [amt, setAmt] = useState("")
  const [method, setMethod] = useState("cash")
  const [date, setDate] = useState(todayStr())
  const [ref, setRef] = useState("")
  const [notes, setNotes] = useState("")
  const [printAfter, setPrintAfter] = useState(false)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { saasCompanyApi.getProfile().then((r) => setProfile(r.data)).catch(() => {}) }, [])

  const params = useCallback((p: number, pp: number) => {
    const o: Record<string, any> = { kind: tab, page: p, per_page: pp, range: rangeF }
    if (qD) o.search = qD
    if (methodF !== "all") o.method = methodF
    if (fromD) o.from = fromD
    if (toD) o.to = toD
    return o
  }, [tab, qD, methodF, rangeF, fromD, toD])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setLedger(await tailorApi.getPaymentLedger(params(page, perPage)))
    } catch {
      toast.error("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }, [params, page, perPage])
  useEffect(() => { load() }, [load])

  const loadOpts = useCallback(async (k: TailorLedgerKind) => {
    setOptsLoading(true)
    try {
      const list = await tailorApi.getPayableOptions(k)
      setOpts(list)
      setPick(list[0] ? String(list[0].id) : "")
      setAmt(list[0] ? String(list[0].balance) : "")
    } catch {
      setOpts([]); setPick(""); setAmt("")
      toast.error("Failed to load balances")
    } finally {
      setOptsLoading(false)
    }
  }, [])
  useEffect(() => { loadOpts(kind) }, [kind, loadOpts])

  const current = opts.find((o) => String(o.id) === pick)
  const bal = current?.balance ?? 0
  const amtN = Number(amt) > 0 ? Number(amt) : 0
  const after = r2(Math.max(0, bal - amtN))
  const fmtOpt = (o: TailorPayableOption) => kind === "customer"
    ? `${o.orderNumber} · ${o.name ?? "Unknown"} — due ${formatCurrency(o.balance)}`
    : `${o.name} — unpaid ${formatCurrency(o.balance)}`

  const printReceipt = (p: { kind: TailorLedgerKind; paymentDate: string; createdAt?: string | null; who: string; refLabel: string; methodLabel: string; amount: number }) => {
    const w = window.open("", "_blank")
    if (!w) { toast.error("Allow pop-ups to print the receipt."); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt</title><style>body{font-family:system-ui,sans-serif;color:#0E1525;margin:24px}</style></head><body>
      <h1>${esc(profile?.name || "Receipt")}</h1><h2>${p.kind === "dorji" ? "Payment voucher" : "Payment receipt"}</h2>
      <p>Date: ${esc(fmtD(p.createdAt || p.paymentDate))}<br>${p.kind === "dorji" ? "Paid to" : "Received from"}: <b>${esc(p.who)}</b><br>Reference: ${esc(p.refLabel)}<br>Method: ${esc(p.methodLabel)}</p>
      <h2>${esc(formatCurrency(p.amount))}</h2></body></html>`)
    w.document.close(); w.focus()
    setTimeout(() => { try { w.print() } catch { /* ignore */ } }, 200)
  }

  const record = async () => {
    if (!current) { setErr(kind === "customer" ? "No orders have a balance due." : "No dorji has unpaid finished work."); return }
    if (!(amtN > 0)) { setErr("Enter an amount greater than 0."); return }
    if (amtN > bal + 0.005) { setErr(`Amount is more than the balance (${formatCurrency(bal)}).`); return }
    if (!date) { setErr("Pick a date."); return }
    if (date > todayStr()) { setErr("Payment date cannot be in the future."); return }
    setSaving(true); setErr("")
    try {
      await tailorApi.recordPayment({
        kind, orderId: kind === "customer" ? current.id : undefined, dorjiId: kind === "dorji" ? current.id : undefined,
        amount: amtN, expectedBalance: bal, paymentMethod: method, paymentDate: date, reference: ref.trim(), notes: notes.trim(),
      })
      toast.success(`Payment of ${formatCurrency(amtN)} recorded`)
      if (printAfter) {
        printReceipt({
          kind, paymentDate: date, createdAt: todayStr(), who: current.name ?? "—", refLabel: kind === "customer" ? [current.orderNumber, ref.trim()].filter(Boolean).join(" · ") : (ref.trim() || "Payout"),
          methodLabel: METHODS.find((m) => m[0] === method)?.[1] ?? method, amount: amtN,
        })
      }
      setRef(""); setNotes("")
      setTab(kind); setPage(1)
      load(); loadOpts(kind)
    } catch (e: any) {
      const errs = e?.response?.data?.errors
      if (e?.response?.status === 409) loadOpts(kind)
      setErr((errs && Object.values(errs).flat()[0] as string) || e?.response?.data?.message || "Could not record the payment.")
    } finally {
      setSaving(false)
    }
  }

  const exportCsv = async () => {
    try {
      const rows: TailorLedgerRow[] = []
      for (let p = 1; p <= 50; p++) {
        const r = await tailorApi.getPaymentLedger(params(p, 100))
        rows.push(...r.data)
        if (rows.length >= r.total || r.data.length === 0) break
      }
      if (!rows.length) { toast.error("Nothing to export."); return }
      const lines = [["Date", "Party", "Reference", "Type", "Method", "Amount"], ...rows.map((p) => [p.paymentDate, p.who, p.refLabel, p.typeLabel, p.methodLabel, p.amount])]
      const blob = new Blob([lines.map((l) => l.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" })
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob); a.download = tab === "customer" ? "tailor-customer-payments.csv" : "tailor-dorji-payments.csv"; a.click()
      URL.revokeObjectURL(a.href)
    } catch {
      toast.error("Export failed")
    }
  }

  const chips = useMemo(() => (bal > 0 ? [{ label: `Full ${formatCurrency(bal)}`, v: bal }, { label: "Half", v: r2(bal / 2) }] : []), [bal, formatCurrency])

  if (blocked) return blocked

  const st = ledger?.stats
  const rows = ledger?.data ?? []
  const total = ledger?.total ?? 0
  const hasFilter = !!(qD || methodF !== "all" || rangeF !== "all" || fromD || toD)
  const tabCount = ledger?.counts[tab] ?? 0

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Payments"
        description="Money in from customers and money out to dorjis."
        actions={<Button type="button" variant="outline" onClick={exportCsv}>Export</Button>}
      />

      {!st ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <div className="[&>div]:lg:grid-cols-4">
          <StatsCards stats={[
            { label: "Collected this month", value: formatCurrency(st.collectedMonth), icon: <Wallet className="size-4" />, color: "green", hint: `${st.collectedMonthCount} payments` },
            { label: "Still to collect", value: formatCurrency(st.toCollect), icon: <CalendarClock className="size-4" />, color: "yellow", hint: `${st.toCollectOrders} orders` },
            { label: "Paid to dorjis", value: formatCurrency(st.paidDorjisMonth), icon: <Users className="size-4" />, color: "blue", hint: "This month" },
            { label: "Owed to dorjis", value: formatCurrency(st.owedDorjis), icon: <Banknote className="size-4" />, color: st.owedDorjis > 0 ? "red" : "green", hint: "For finished work" },
          ]} />
        </div>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as TailorLedgerKind); setPage(1) }} tabs={[
              { value: "customer", label: "From customers", count: ledger?.counts.customer }, { value: "dorji", label: "To dorjis", count: ledger?.counts.dorji },
            ]} />
          </div>
          <FilterBar className="gap-2.5 p-4">
            <InputGroup className="min-w-[220px] flex-1">
              <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
              <InputGroupInput type="search" aria-label="Search payments" placeholder="Search order, name or reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} />
            </InputGroup>
            <Select value={methodF} onValueChange={(v) => { setMethodF(v); setPage(1) }}>
              <SelectTrigger aria-label="Method"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Method: All</SelectItem>{METHODS.map(([id, l]) => <SelectItem key={id} value={id}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={rangeF} onValueChange={(v) => { setRangeF(v as Range); setPage(1) }}>
              <SelectTrigger aria-label="Date range"><SelectValue /></SelectTrigger>
              <SelectContent>{RANGES.map(([id, l]) => <SelectItem key={id} value={id}>{l}</SelectItem>)}</SelectContent>
            </Select>
            <FormField orientation="horizontal" className="w-auto gap-2" label="From" htmlFor="pay-from">
              <Input id="pay-from" type="date" aria-label="From date" className="w-auto" value={fromD} onChange={(e) => { setFromD(e.target.value); setPage(1) }} /></FormField>
            <FormField orientation="horizontal" className="w-auto gap-2" label="To" htmlFor="pay-to">
              <Input id="pay-to" type="date" aria-label="To date" className="w-auto" value={toD} onChange={(e) => { setToD(e.target.value); setPage(1) }} /></FormField>
          </FilterBar>

          <div className="overflow-x-auto">
            <Table className="min-w-[640px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>{tab === "customer" ? "Customer / order" : "Dorji / reference"}</TableHead>
                  <TableHead>Type</TableHead><TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !ledger ? [1, 2, 3, 4, 5].map((i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-11" /></TableCell></TableRow>) :
                  rows.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="whitespace-normal">
                      <EmptyState icon={Wallet} title="No payments found" className="p-4 md:p-6"
                        description={tabCount ? "No payments match these filters." : tab === "customer" ? "No customer payments recorded yet." : "No dorji payouts recorded yet."} />
                    </TableCell></TableRow>
                  ) : rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{fmtD(p.paymentDate)}</TableCell>
                      <TableCell><div className="font-medium">{p.who}</div><div className="text-xs text-muted-foreground">{p.refLabel}</div></TableCell>
                      <TableCell><Badge variant={typeVariant[p.type] ?? "outline"}>{p.typeLabel}</Badge></TableCell>
                      <TableCell>{p.methodLabel}</TableCell>
                      <TableCell className={cn("text-right font-bold tabular-nums", p.kind === "dorji" ? "text-destructive" : "text-dash-success-fg")}>{p.kind === "dorji" ? "−" : "+"}{formatCurrency(p.amount)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end"><WithTooltip content="Print receipt"><Button type="button" variant="outline" size="icon" aria-label="Print receipt" onClick={() => printReceipt(p)}><Printer className="size-4" /></Button></WithTooltip></div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 text-sm text-muted-foreground tabular-nums">
            <span>Showing {total} payment(s){hasFilter ? " (filtered)" : ""}</span>
            <strong className="text-foreground">Total {formatCurrency(ledger?.totalAmount ?? 0)}</strong>
          </div>
          {total > 0 && (
            <div className="p-4 pt-3">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </Card>

        <SectionCard title="Record payment" className="w-full shrink-0 xl:w-[380px]" contentClassName="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <SectionTitle as="p">Payment for</SectionTitle>
            <SegmentedControl aria-label="Payment for" size="default" className="w-full" value={kind}
              onValueChange={(v) => { setKind(v as TailorLedgerKind); setErr("") }}
              options={[{ value: "customer", label: "Customer order" }, { value: "dorji", label: "Dorji payout" }]} />
          </div>
          <FormField label={kind === "customer" ? "Order" : "Dorji"} htmlFor="pay-pick">
            <Select value={pick || undefined} disabled={optsLoading || opts.length === 0}
              onValueChange={(v) => { setPick(v); const o = opts.find((x) => String(x.id) === v); setAmt(o ? String(o.balance) : ""); setErr("") }}>
              <SelectTrigger id="pay-pick" className="w-full"><SelectValue placeholder={optsLoading ? "Loading…" : kind === "customer" ? "No orders with a balance" : "No unpaid dorji work"} /></SelectTrigger>
              <SelectContent>{opts.map((o) => <SelectItem key={o.id} value={String(o.id)}>{fmtOpt(o)}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <Card className="px-3 py-2.5 shadow-none">
            <InfoList><InfoRow label={kind === "customer" ? "Customer still owes" : "You owe"}><span className="tabular-nums">{formatCurrency(bal)}</span></InfoRow></InfoList>
          </Card>
          <FormField label="Amount" htmlFor="pay-amount">
            {chips.length > 0 && (
              <div role="group" aria-label="Quick amount" className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <Button key={c.label} type="button" aria-pressed={amtN === c.v} onClick={() => { setAmt(String(c.v)); setErr("") }}
                    variant={amtN === c.v ? "default" : "outline"} size="sm">{c.label}</Button>
                ))}
              </div>
            )}
            <Input id="pay-amount" type="number" min={0} step="any" value={amt} onChange={(e) => { setAmt(e.target.value); setErr("") }} placeholder="0.00" />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <SectionTitle as="p">Method</SectionTitle>
            <SegmentedControl aria-label="Method" value={method} onValueChange={setMethod}
              options={METHODS.map(([id, label]) => ({ value: id, label }))} />
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Date" htmlFor="pay-date"><Input id="pay-date" type="date" max={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setErr("") }} /></FormField>
            <FormField label="Reference" htmlFor="pay-ref"><Input id="pay-ref" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn ID (optional)" /></FormField>
          </div>
          <FormField label="Notes" htmlFor="pay-notes"><Input id="pay-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" /></FormField>
          <Card className="px-3 py-2.5 shadow-none">
            <InfoList>
              <InfoRow label="Balance after"><span className={cn("tabular-nums", after <= 0 ? "text-dash-success-fg" : "text-dash-warn-fg")}>{bal > 0 && after <= 0 ? "Fully paid" : `${formatCurrency(after)} left`}</span></InfoRow>
            </InfoList>
          </Card>
          <Label>
            <Checkbox checked={printAfter} onCheckedChange={(v) => setPrintAfter(v === true)} />Print receipt after saving
          </Label>
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          {mayWrite && (
            <Button type="button" disabled={saving || !current} onClick={record}>
              {saving ? "Saving…" : `Record ${formatCurrency(amtN)}`}
            </Button>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
