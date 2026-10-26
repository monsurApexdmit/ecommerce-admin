"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Banknote, Bell, CalendarClock, Download, FileText, Search, Wallet, Clock } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import dueApi, { type DueDocument, type DueHistoryItem, type DueParty, type DuePartyRow, type DueSummaryData } from "@/lib/dueApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { cn } from "@/lib/utils"

const BUCKET_COLORS = ["#0F766E", "#F59E0B", "#EA580C", "#B42318"]
const METHODS = [
  { id: "Cash", sub: "" }, { id: "bKash", sub: "" }, { id: "Nagad", sub: "" }, { id: "Bank", sub: "" }, { id: "Card", sub: "" }, { id: "Other", sub: "" },
]
const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const today = () => new Date().toISOString().slice(0, 10)
const SORTS = { age: "Most overdue", amount: "Highest due", name: "Name A–Z" } as const
const NEXT_SORT = { age: "amount", amount: "name", name: "age" } as const
const STATUS_LABEL: Record<string, string> = { draft: "Draft", sent: "Ordered", partial: "Partly received", received: "Received" }
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

interface Props { party: DueParty }

export function DuesView({ party }: Props) {
  const isCust = party === "customers"
  const { formatCurrency } = useCompanySettings()
  const copy = isCust
    ? { title: "Customer dues", sub: "Who owes you money, how long it has been, and a one-tap reminder.", who: "customers", search: "Search customers…", agingTitle: "How old are the dues?", cols: ["Customer", "Unpaid", "Due", "Oldest unpaid", "Last reminder", ""], action: "Collect", verb: "Collect", histTitle: "Recent payments received", histEmpty: "No payments received yet.", pickEmpty: "Pick a customer to collect a payment." }
    : { title: "Vendor dues", sub: "What you owe suppliers and when — so you pay on time without running out of cash.", who: "suppliers", search: "Search suppliers…", agingTitle: "How old are the bills?", cols: ["Supplier", "Purchase orders", "Due", "Due date", "Status", ""], action: "Pay", verb: "Pay", histTitle: "Recent payments made", histEmpty: "No payments made yet.", pickEmpty: "Pick a supplier to record a payment." }

  const [data, setData] = useState<DueSummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [pf, setPf] = useState("all")
  const [bucket, setBucket] = useState<number | null>(null)
  const [sort, setSort] = useState<"age" | "amount" | "name">("age")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [sel, setSel] = useState<DuePartyRow | null>(null)
  const [docs, setDocs] = useState<DueDocument[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [amount, setAmount] = useState("")
  const defaultMethod = isCust ? "Cash" : "bKash"
  const [method, setMethod] = useState(defaultMethod)
  const [date, setDate] = useState(today())
  const [ref, setRef] = useState("")
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [note, setNote] = useState("")

  const [history, setHistory] = useState<DueHistoryItem[]>([])

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    try {
      setData(await dueApi.getSummary(party, { search: qD || undefined, payment: pf !== "all" ? pf : undefined, bucket: bucket ?? undefined, sort }))
    } catch {
      setData({ rows: [], aging: [], stats: {} })
      toast.error("Failed to load dues")
    } finally {
      setLoading(false)
    }
  }, [party, qD, pf, bucket, sort])
  useEffect(() => { load() }, [load])

  const loadHistory = useCallback(() => { dueApi.getHistory(isCust ? "in" : "out", 15).then(setHistory).catch(() => setHistory([])) }, [isCust])
  useEffect(() => { loadHistory() }, [loadHistory])

  const key = (d: DueDocument) => `${d.documentType}-${d.documentId ?? 0}`

  const open = async (row: DuePartyRow) => {
    setSel(row); setErr(""); setMessage(""); setNotes(""); setRef(""); setDate(today()); setMethod(defaultMethod); setNote("")
    setDocsLoading(true)
    try {
      const res = await dueApi.getDocuments(party, row.partyId)
      setDocs(res.documents)
      const all = new Set(res.documents.map(key))
      setPicked(all)
      setAmount(String(res.documents.reduce((a, d) => a + d.due, 0)))
    } catch {
      setDocs([]); setPicked(new Set()); setAmount("")
    } finally {
      setDocsLoading(false)
    }
    if (isCust && !row.walkIn) {
      // always preview the reminder text; preview=true records nothing
      dueApi.remind(row.partyId, "Copy", true).then((r) => setMessage(r.message)).catch(() => setMessage(""))
    }
  }

  const toggleDoc = (d: DueDocument) => {
    const next = new Set(picked)
    next.has(key(d)) ? next.delete(key(d)) : next.add(key(d))
    setPicked(next)
    setAmount(String(docs.filter((x) => next.has(key(x))).reduce((a, x) => a + x.due, 0)))
  }

  const pickedDue = docs.filter((d) => picked.has(key(d))).reduce((a, d) => a + d.due, 0)
  const amtNum = Number(amount) || 0

  const settle = async () => {
    if (!sel) return
    if (date > today()) { setErr("Payment date cannot be in the future."); return }
    if (picked.size === 0) { setErr("Select at least one document."); return }
    if (!(amtNum > 0)) { setErr("Enter an amount above zero."); return }
    if (amtNum > pickedDue + 0.005) { setErr(`That is more than the ${formatCurrency(pickedDue)} due on the selected documents.`); return }
    setBusy(true); setErr("")
    try {
      await dueApi.settle(party, sel.partyId, {
        amount: amtNum, method, date, reference: ref.trim() || undefined, notes: notes.trim() || undefined,
        documentIds: docs.filter((d) => picked.has(key(d))).map((d) => ({ type: d.documentType, id: d.documentId })),
      })
      toast.success(`${isCust ? "Collected" : "Paid"} ${formatCurrency(amtNum)} ${isCust ? "from" : "to"} ${sel.name}`)
      const stillOpen = amtNum < pickedDue - 0.005 || docs.length > picked.size
      await Promise.all([load(), loadHistory()])
      // when fully settled the auto-select effect moves to the next row
      if (stillOpen) await open({ ...sel })
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not record the payment.")
    } finally {
      setBusy(false)
    }
  }

  const remind = async (row: DuePartyRow, channel: "SMS" | "WhatsApp" | "Copy") => {
    try {
      const res = await dueApi.remind(row.partyId, channel)
      setMessage(res.message)
      load()
      if (channel === "Copy") { await navigator.clipboard?.writeText(res.message); toast.success("Reminder copied and logged") }
      else {
        const phone = (row.phone ?? "").replace(/[^\d+]/g, "")
        if (channel === "SMS") window.open(`sms:${phone}?body=${encodeURIComponent(res.message)}`)
        else window.open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(res.message)}`, "_blank")
        toast.success(`${channel} reminder recorded for ${row.name}`)
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not prepare the reminder")
    }
  }

  const supplierDueText = (r: DuePartyRow) => r.dueDate == null ? "No due date" : r.dueInDays == null ? "" : r.dueInDays < 0 ? `Overdue ${-r.dueInDays}d` : r.dueInDays === 0 ? "Due today" : `Due in ${r.dueInDays}d`
  const supplierStatus = (r: DuePartyRow) => (r.statuses ?? []).map((x) => STATUS_LABEL[x] ?? x).join(" / ") + (r.overdue ? " · overdue" : "")
  const reminderText = (r: DuePartyRow) => r.lastReminder?.at ? `${r.lastReminder.channel ?? "Reminder"} · ${fmtD(r.lastReminder.at.slice(0, 10))}` : "Not reminded"
  const docsText = (r: DuePartyRow) => {
    const nos = r.lastDocNos ?? []
    const base = nos.length <= 2 ? nos.join(", ") : `${nos[0]} +${r.docs - 1} more`
    return base || plural(r.docs, "document")
  }

  const supplierNote = sel && !isCust
    ? `Hi, we have sent ${formatCurrency(amtNum > 0 ? amtNum : sel.due)} for ${docs.filter((d) => picked.has(key(d))).map((d) => d.no).join(", ") || (sel.lastDocNos ?? []).join(", ")} by ${method}. Please confirm receipt.`
    : ""
  const sendSupplierNote = async (channel: "SMS" | "WhatsApp" | "Copy") => {
    if (!sel) return
    const text = note || supplierNote
    const phone = (sel.phone ?? "").replace(/[^\d+]/g, "")
    if (channel === "Copy") { await navigator.clipboard?.writeText(text); toast.success("Note copied") }
    else if (channel === "SMS") window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    else window.open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`, "_blank")
  }

  const handleExport = () => {
    const list = data?.rows ?? []
    if (isCust) {
      exportToCSV(list.map((r) => ({
        name: r.name, phone: r.phone ?? "", group: r.group ?? "", unpaidInvoices: r.docs, due: r.due, oldest: r.oldestDate ?? "", ageDays: r.ageDays, lastReminder: reminderText(r),
      })), "customer-dues", ["name", "phone", "group", "unpaidInvoices", "due", "oldest", "ageDays", "lastReminder"])
    } else {
      exportToCSV(list.map((r) => ({
        name: r.name, purchaseOrders: (r.lastDocNos ?? []).join(" "), due: r.due, dueDate: r.dueDate ?? "", daysOld: r.ageDays, status: supplierStatus(r),
      })), "vendor-dues", ["name", "purchaseOrders", "due", "dueDate", "daysOld", "status"])
    }
  }

  const rows = data?.rows ?? []
  // auto-select the first row (and keep the panel valid when filters drop the selected party)
  useEffect(() => {
    if (loading) return
    if (rows.length === 0) { if (sel) { setSel(null); setDocs([]) } return }
    if (!sel || !rows.some((r) => r.partyId === sel.partyId)) open(rows[0])
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps
  const pageRows = rows.slice((page - 1) * perPage, page * perPage)
  const totalDue = rows.reduce((a, r) => a + r.due, 0)
  const s = data?.stats ?? {}
  const num = (...keys: string[]) => { for (const k of keys) if (typeof s[k] === "number") return s[k]; return 0 }
  const agingMax = Math.max(1, ...(data?.aging ?? []).map((a) => a.amount))
  const kpis = useMemo(() => isCust ? [
    { label: "Customers owe you", value: formatCurrency(num("totalDue")), icon: <Wallet className="size-4" />, color: "yellow" as const, hint: `${num("partyCount")} customer${num("partyCount") === 1 ? "" : "s"}` },
    { label: "Overdue 30+ days", value: formatCurrency(num("overdue30Amount")), icon: <Clock className="size-4" />, color: "red" as const, hint: `${num("overdue30Parties")} customer${num("overdue30Parties") === 1 ? "" : "s"}` },
    { label: "Collected this month", value: formatCurrency(num("collectedThisMonth")), icon: <Banknote className="size-4" />, color: "green" as const, hint: `${num("collectedThisMonthCount")} payment${num("collectedThisMonthCount") === 1 ? "" : "s"}` },
    { label: "Open invoices", value: num("openInvoices"), icon: <FileText className="size-4" />, color: "blue" as const, hint: num("openInvoices") ? `Avg ${formatCurrency(num("avgInvoice"))} each` : "Nothing outstanding" },
  ] : [
    { label: "You owe suppliers", value: formatCurrency(num("totalDue")), icon: <Wallet className="size-4" />, color: "yellow" as const, hint: `${plural(num("partyCount"), "supplier")} · ${plural(num("openBills"), "PO")}` },
    { label: "Overdue", value: formatCurrency(num("overdueAmount")), icon: <Clock className="size-4" />, color: "red" as const, hint: `${plural(num("overdueParties"), "supplier")} past due date` },
    { label: "Due in next 7 days", value: formatCurrency(num("dueNext7Amount")), icon: <CalendarClock className="size-4" />, color: "blue" as const, hint: plural(num("dueNext7Parties"), "supplier") },
    { label: "Paid this month", value: formatCurrency(num("paidThisMonth")), icon: <Banknote className="size-4" />, color: "green" as const, hint: plural(num("paidThisMonthCount"), "payment") },
  ], [data, isCust, formatCurrency]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-1 text-sm text-dash-muted">{copy.sub}</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : <StatsCards stats={kpis} />}

      <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
        <div className="flex items-center justify-between"><h2 className="font-dash-display text-base font-bold">{copy.agingTitle}</h2><span className="text-xs text-dash-muted">Click a bucket to filter</span></div>
        <div className="mt-3 flex h-3 gap-1 overflow-hidden rounded-full">
          {(data?.aging ?? []).map((a) => <div key={a.key} style={{ width: `${Math.max(a.amount ? 4 : 0, Math.round((a.amount / Math.max(1, (data?.aging ?? []).reduce((x, y) => x + y.amount, 0))) * 100))}%`, background: BUCKET_COLORS[a.key] }} />)}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(data?.aging ?? []).map((a) => (
            <button key={a.key} type="button" aria-pressed={bucket === a.key} onClick={() => { setBucket(bucket === a.key ? null : a.key); setPage(1) }}
              className={cn("flex flex-col gap-0.5 rounded-xl border-2 p-3 text-left", bucket === a.key ? "border-dash-accent bg-dash-accent-soft/50" : "border-dash-border hover:bg-dash-neutral-soft")}>
              <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="size-2.5 rounded-full" style={{ background: BUCKET_COLORS[a.key] }} />{a.label}</span>
              <span className="font-dash-display text-lg font-bold tabular-nums" style={{ opacity: a.amount / agingMax > 0 ? 1 : 0.5 }}>{formatCurrency(a.amount)}</span>
              <span className="text-xs text-dash-muted">{plural(a.count, "account")}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[200px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
              <input type="search" placeholder={copy.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Payment progress" value={pf} onChange={(e) => { setPf(e.target.value); setPage(1) }} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none">
              <option value="all">Payments: All</option><option value="partial">Partly paid</option><option value="unpaid">Nothing paid yet</option>
            </select>
            <button type="button" onClick={() => { setSort(NEXT_SORT[sort]); setPage(1) }} className={outlineBtn}>Sort: {SORTS[sort]}</button>
            <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  {copy.cols.map((c, i) => <th key={i} scope="col" className={cn("px-3 py-3 font-semibold", i === 0 && "pl-4", i === 2 && "text-right", i === 5 && "pr-4 text-right")}>{c || "Actions"}</th>)}
                </tr>
              </thead>
              <tbody>
                {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-11 rounded" /></td></tr>) :
                  pageRows.length === 0 ? (
                    <tr><td colSpan={6} className="py-14 text-center">
                      <Wallet className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">{isCust ? "No customer owes you anything" : "You do not owe any supplier"}</p>
                      <p className="text-sm text-dash-muted">{qD || pf !== "all" || bucket !== null ? "Try clearing the filters." : "Open balances will show up here."}</p>
                    </td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.partyId} className={sel?.partyId === r.partyId ? "bg-dash-accent-soft/40" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-3">
                        <button type="button" onClick={() => open(r)} className="flex flex-col text-left">
                          <span className="font-semibold">{r.name}</span>
                          <span className="text-xs text-dash-muted">{isCust
                            ? ([r.phone, r.group].filter(Boolean).join(" · ") || (r.walkIn ? "Sells without a customer" : "No phone"))
                            : (r.phone || "No phone")}</span>
                        </button>
                      </td>
                      <td className="border-b border-dash-border-soft px-3 py-3">
                        {isCust ? `${plural(r.docs, "invoice")}${r.hasPartial ? " · partly paid" : ""}` : `${docsText(r)}${r.hasPartial ? " · partly paid" : ""}`}
                      </td>
                      <td className="border-b border-dash-border-soft px-3 py-3 text-right font-bold tabular-nums">{formatCurrency(r.due)}{r.hasPartial && <div className="text-xs font-normal text-dash-muted">{formatCurrency(r.paidSoFar)} paid</div>}</td>
                      {isCust ? (
                        <>
                          <td className="border-b border-dash-border-soft px-3 py-3">
                            <div>{fmtD(r.oldestDate)}</div>
                            <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", r.ageDays > 60 ? "bg-dash-danger-soft text-dash-danger-fg" : r.ageDays > 30 ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-success-soft text-dash-success-fg")}>{r.ageDays} days</span>
                          </td>
                          <td className="border-b border-dash-border-soft px-3 py-3 text-dash-muted">{r.walkIn ? "—" : reminderText(r)}</td>
                        </>
                      ) : (
                        <>
                          <td className="border-b border-dash-border-soft px-3 py-3">
                            <div>{r.dueDate ? fmtD(r.dueDate) : "No due date"}</div>
                            <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", r.overdue ? "bg-dash-danger-soft text-dash-danger-fg" : (r.dueInDays ?? 99) <= 7 ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-success-soft text-dash-success-fg")}>{r.dueDate ? supplierDueText(r) : `${r.ageDays} days old`}</span>
                          </td>
                          <td className="border-b border-dash-border-soft px-3 py-3 text-dash-muted">{supplierStatus(r) || "—"}</td>
                        </>
                      )}
                      <td className="border-b border-dash-border-soft py-3 pl-3 pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => open(r)} className="h-9 rounded-lg bg-dash-ink px-3 text-[13px] font-semibold text-dash-bg">{copy.action}</button>
                          {isCust && !r.walkIn && <button type="button" aria-label={`Send reminder to ${r.name}`} className={iconBtn} onClick={() => { open(r).then(() => remind(r, "Copy")) }}><Bell className="size-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 pt-3.5 text-[13px] text-dash-muted tabular-nums">{rows.length} {copy.who} · {formatCurrency(totalDue)} outstanding</div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[390px]">
          {!sel ? <p className="py-10 text-center text-sm text-dash-muted">{copy.pickEmpty}</p> : (
            <>
              <div><h2 className="font-dash-display text-lg font-bold">{sel.name}</h2><span className="text-[13px] text-dash-muted">{[sel.phone, sel.email, isCust ? sel.group : null].filter(Boolean).join(" · ") || (sel.walkIn ? "Sells without a customer attached" : `${plural(sel.docs, isCust ? "open invoice" : "open PO")}`)}</span></div>
              <div className="flex items-baseline justify-between rounded-[10px] bg-dash-warn-soft px-3.5 py-3 text-dash-warn-fg"><span className="text-[13px] font-semibold">{isCust ? "Owes you" : "You owe"}</span><span className="font-dash-display text-xl font-bold tabular-nums">{formatCurrency(sel.due)}</span></div>
              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Unpaid documents
                {docsLoading ? <Skeleton className="h-16 rounded-xl" /> : docs.map((d) => (
                  <label key={key(d)} className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-dash-border px-3 py-2.5 font-normal">
                    <input type="checkbox" className="size-4" checked={picked.has(key(d))} onChange={() => toggleDoc(d)} />
                    <span className="flex min-w-0 flex-1 flex-col"><span className="text-sm font-semibold">{d.no}</span><span className="text-xs text-dash-muted">{fmtD(d.date)} · {d.ageDays} days old{d.paid > 0 ? ` · paid ${formatCurrency(d.paid)} of ${formatCurrency(d.total)}` : ""}{!isCust && d.status ? ` · ${STATUS_LABEL[d.status] ?? d.status}` : ""}</span></span>
                    <strong className="tabular-nums">{formatCurrency(d.due)}</strong>
                  </label>
                ))}
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Amount<input type="number" min={0} step="0.01" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
              <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Method
                <div role="radiogroup" aria-label="Method" className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <button key={m.id} type="button" role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}
                      className={cn("h-9 rounded-[10px] border-2 px-3 text-[13px] font-semibold", method === m.id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{m.id}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Date<input type="date" max={today()} className={input} value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Reference<input className={input} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></label>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Notes<textarea rows={2} className={cn(input, "h-auto py-2.5")} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label>
              {err && <p role="alert" className="text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
              <button type="button" disabled={busy} onClick={settle} className="h-11 rounded-[10px] bg-dash-accent text-sm font-semibold text-white disabled:opacity-40">{busy ? "Saving…" : `${copy.verb} ${formatCurrency(amtNum)}`}</button>
              {isCust && sel.walkIn && (
                <p className="border-t border-dash-border-soft pt-3 text-xs text-dash-muted">These sells have no customer attached, so there is nobody to remind. You can still collect payments against them here.</p>
              )}
              {isCust && !sel.walkIn && (
                <div className="flex flex-col gap-2 border-t border-dash-border-soft pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Send a reminder</span>
                  <div className="rounded-[10px] bg-dash-neutral-soft px-3 py-2.5 text-[13px] leading-snug">{message || "Preparing message…"}</div>
                  <div className="flex gap-2">
                    {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <button key={c} type="button" onClick={() => remind(sel, c)} className={cn(outlineBtn, "h-10 flex-1")}>{c}</button>)}
                  </div>
                </div>
              )}
              {!isCust && (
                <div className="flex flex-col gap-2 border-t border-dash-border-soft pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Note to supplier (optional)</span>
                  <textarea rows={3} className={cn(input, "h-auto py-2.5")} value={note || supplierNote} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <button key={c} type="button" onClick={() => sendSupplierNote(c)} className={cn(outlineBtn, "h-10 flex-1")}>{c}</button>)}
                  </div>
                </div>
              )}
            </>
          )}
        </aside>
      </div>

      <section aria-label="Payment history" className="rounded-[14px] border border-dash-border bg-dash-card p-5">
        <h2 className="font-dash-display text-base font-bold">{copy.histTitle}</h2>
        {history.length === 0 ? <p className="py-6 text-sm text-dash-muted">{copy.histEmpty}</p> : (
          <div className="mt-2 flex flex-col">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 border-b border-dash-border-soft py-2.5 last:border-0">
                <span className="flex min-w-0 flex-col"><span className="text-sm font-semibold">{h.partyName}</span><span className="truncate text-xs text-dash-muted">{[h.documentNo, h.reference, h.notes].filter(Boolean).join(" · ") || "Applied to oldest document"}</span></span>
                <span className="text-xs text-dash-muted">{fmtD(h.date)} · {h.method}</span>
                <strong className="tabular-nums">{formatCurrency(h.amount)}</strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
