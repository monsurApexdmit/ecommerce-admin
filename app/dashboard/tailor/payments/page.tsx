"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarClock, Printer, Search, Users, Wallet, Banknote } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
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

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const filterSelCls = "h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

const pad = (n: number) => String(n).padStart(2, "0")
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const r2 = (v: number) => Math.round(v * 100) / 100
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const csvCell = (v: unknown) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

const typeTone: Record<string, string> = {
  advance: "bg-dash-accent-soft text-dash-accent-fg",
  payment: "bg-dash-success-soft text-dash-success-fg",
  final: "bg-dash-success-soft text-dash-success-fg",
  payout: "bg-dash-warn-soft text-dash-warn-fg",
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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Payments</h1>
          <p className="mt-1 text-sm text-dash-muted">Money in from customers and money out to dorjis.</p>
        </div>
        <button type="button" onClick={exportCsv} className={outlineBtn}>Export</button>
      </div>

      {!st ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
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
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as TailorLedgerKind); setPage(1) }} tabs={[
              { value: "customer", label: "From customers", count: ledger?.counts.customer }, { value: "dorji", label: "To dorjis", count: ledger?.counts.dorji },
            ]} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search payments</span>
              <input type="search" placeholder="Search order, name or reference…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Method" className={filterSelCls} value={methodF} onChange={(e) => { setMethodF(e.target.value); setPage(1) }}>
              <option value="all">Method: All</option>{METHODS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <select aria-label="Date range" className={filterSelCls} value={rangeF} onChange={(e) => { setRangeF(e.target.value as Range); setPage(1) }}>
              {RANGES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <label className="flex items-center gap-2 text-[13px] font-semibold">From
              <input type="date" aria-label="From date" className={filterSelCls} value={fromD} onChange={(e) => { setFromD(e.target.value); setPage(1) }} /></label>
            <label className="flex items-center gap-2 text-[13px] font-semibold">To
              <input type="date" aria-label="To date" className={filterSelCls} value={toD} onChange={(e) => { setToD(e.target.value); setPage(1) }} /></label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-4 pr-2 font-semibold">Date</th>
                  <th className="px-2 py-3 font-semibold">{tab === "customer" ? "Customer / order" : "Dorji / reference"}</th>
                  <th className="px-2 py-3 font-semibold">Type</th><th className="px-2 py-3 font-semibold">Method</th>
                  <th className="px-2 py-3 text-right font-semibold">Amount</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {loading && !ledger ? [1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-11 rounded" /></td></tr>) :
                  rows.length === 0 ? (
                    <tr><td colSpan={6} className="py-14 text-center">
                      <Wallet className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No payments found</p>
                      <p className="text-sm text-dash-muted">{tabCount ? "No payments match these filters." : tab === "customer" ? "No customer payments recorded yet." : "No dorji payouts recorded yet."}</p>
                    </td></tr>
                  ) : rows.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap border-b border-dash-border-soft py-3 pl-4 pr-2 text-dash-muted">{fmtD(p.paymentDate)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><div className="font-semibold">{p.who}</div><div className="text-xs text-dash-muted">{p.refLabel}</div></td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><span className={cn("inline-flex rounded-full px-2.5 py-[3px] text-xs font-bold", typeTone[p.type] ?? "bg-dash-neutral-soft")}>{p.typeLabel}</span></td>
                      <td className="border-b border-dash-border-soft px-2 py-3">{p.methodLabel}</td>
                      <td className={cn("border-b border-dash-border-soft px-2 py-3 text-right font-bold tabular-nums", p.kind === "dorji" ? "text-dash-danger-fg" : "text-dash-success-fg")}>{p.kind === "dorji" ? "−" : "+"}{formatCurrency(p.amount)}</td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex justify-end"><button type="button" aria-label="Print receipt" title="Print receipt" className={iconBtn} onClick={() => printReceipt(p)}><Printer className="size-4" /></button></div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 text-[13px] text-dash-muted tabular-nums">
            <span>Showing {total} payment(s){hasFilter ? " (filtered)" : ""}</span>
            <strong className="text-dash-ink">Total {formatCurrency(ledger?.totalAmount ?? 0)}</strong>
          </div>
          {total > 0 && (
            <div className="p-4 pt-3">
              <PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(total / perPage))} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[380px]">
          <h2 className="font-dash-display text-lg font-bold">Record payment</h2>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Payment for
            <div role="radiogroup" aria-label="Payment for" className="flex gap-1.5">
              {([["customer", "Customer order"], ["dorji", "Dorji payout"]] as [TailorLedgerKind, string][]).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => { setKind(id); setErr("") }}
                  className={cn("h-10 flex-1 rounded-[10px] border-2 px-3 text-[13px] font-semibold", kind === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{label}</button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{kind === "customer" ? "Order" : "Dorji"}
            <select className={input} value={pick} disabled={optsLoading || opts.length === 0}
              onChange={(e) => { setPick(e.target.value); const o = opts.find((x) => String(x.id) === e.target.value); setAmt(o ? String(o.balance) : ""); setErr("") }}>
              {opts.length === 0 ? <option value="">{optsLoading ? "Loading…" : kind === "customer" ? "No orders with a balance" : "No unpaid dorji work"}</option> :
                opts.map((o) => <option key={o.id} value={o.id}>{fmtOpt(o)}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between rounded-[10px] bg-dash-neutral-soft px-3 py-2.5 text-[13px]">
            <span className="text-dash-muted">{kind === "customer" ? "Customer still owes" : "You owe"}</span><strong className="tabular-nums">{formatCurrency(bal)}</strong>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Amount
            {chips.length > 0 && (
              <div role="group" aria-label="Quick amount" className="flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button key={c.label} type="button" aria-pressed={amtN === c.v} onClick={() => { setAmt(String(c.v)); setErr("") }}
                    className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", amtN === c.v ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{c.label}</button>
                ))}
              </div>
            )}
            <input type="number" min={0} step="any" className={input} value={amt} onChange={(e) => { setAmt(e.target.value); setErr("") }} placeholder="0.00" />
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Method
            <div role="radiogroup" aria-label="Method" className="flex flex-wrap gap-1.5">
              {METHODS.map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={method === id} onClick={() => setMethod(id)}
                  className={cn("h-9 rounded-[10px] border-2 px-3 text-[13px] font-semibold", method === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Date<input type="date" className={input} max={todayStr()} value={date} onChange={(e) => { setDate(e.target.value); setErr("") }} /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reference<input className={input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Txn ID (optional)" /></label>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Notes<input className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" /></label>
          <div className="flex items-center justify-between rounded-[10px] bg-dash-neutral-soft px-3 py-2.5 text-[13px]">
            <span className="text-dash-muted">Balance after</span>
            <strong className={cn("tabular-nums", after <= 0 ? "text-dash-success-fg" : "text-dash-warn-fg")}>{bal > 0 && after <= 0 ? "Fully paid" : `${formatCurrency(after)} left`}</strong>
          </div>
          <label className="flex items-center gap-2 text-[13px] font-semibold">
            <input type="checkbox" checked={printAfter} onChange={(e) => setPrintAfter(e.target.checked)} className="size-4 accent-[var(--dash-accent)]" />Print receipt after saving
          </label>
          {err && <p role="alert" className="rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          {mayWrite && (
            <button type="button" disabled={saving || !current} onClick={record} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? "Saving…" : `Record ${formatCurrency(amtN)}`}
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}
