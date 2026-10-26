"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { FormField } from "@/components/common/FormField"
import { EmptyState } from "@/components/common/EmptyState"
import { Toolbar } from "@/components/common/Toolbar"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { WithTooltip } from "@/components/common/WithTooltip"

const BUCKET_COLORS = ["#0F766E", "#F59E0B", "#EA580C", "#B42318"]
const METHODS = [
  { id: "Cash", sub: "" }, { id: "bKash", sub: "" }, { id: "Nagad", sub: "" }, { id: "Bank", sub: "" }, { id: "Card", sub: "" }, { id: "Other", sub: "" },
]
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader title={copy.title} description={copy.sub} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : <StatsCards stats={kpis} />}

      <SectionCard title={copy.agingTitle} actions={<span className="text-xs text-muted-foreground">Click a bucket to filter</span>} contentClassName="flex flex-col gap-3">
        <div className="flex h-3 gap-1 overflow-hidden rounded-full">
          {(data?.aging ?? []).map((a) => <div key={a.key} style={{ width: `${Math.max(a.amount ? 4 : 0, Math.round((a.amount / Math.max(1, (data?.aging ?? []).reduce((x, y) => x + y.amount, 0))) * 100))}%`, background: BUCKET_COLORS[a.key] }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(data?.aging ?? []).map((a) => (
            <Button key={a.key} type="button" variant={bucket === a.key ? "secondary" : "outline"} aria-pressed={bucket === a.key} onClick={() => { setBucket(bucket === a.key ? null : a.key); setPage(1) }}
              className={cn("h-auto flex-col items-start justify-start gap-0.5 whitespace-normal text-left", bucket === a.key && "ring-2 ring-ring")}>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: BUCKET_COLORS[a.key] }} />{a.label}</span>
              <span className="text-lg font-semibold tabular-nums" style={{ opacity: a.amount / agingMax > 0 ? 1 : 0.5 }}>{formatCurrency(a.amount)}</span>
              <span className="text-xs font-normal text-muted-foreground">{plural(a.count, "account")}</span>
            </Button>
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <Toolbar className="gap-2.5 p-4" actions={<>
            <Button type="button" variant="outline" onClick={() => { setSort(NEXT_SORT[sort]); setPage(1) }}>Sort: {SORTS[sort]}</Button>
            <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export CSV</Button>
          </>}>
            <div className="relative min-w-[200px] flex-1">
              <Label htmlFor={`dues-search-${party}`} className="sr-only">Search</Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id={`dues-search-${party}`} type="search" placeholder={copy.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <Select value={pf} onValueChange={(v) => { setPf(v); setPage(1) }}>
              <SelectTrigger aria-label="Payment progress"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Payments: All</SelectItem><SelectItem value="partial">Partly paid</SelectItem><SelectItem value="unpaid">Nothing paid yet</SelectItem>
              </SelectContent>
            </Select>
          </Toolbar>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  {copy.cols.map((c, i) => <TableHead key={i} scope="col" className={cn(i === 0 && "pl-4", i === 2 && "text-right", i === 5 && "pr-4 text-right")}>{c || "Actions"}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-11" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6}>
                      <EmptyState
                        icon={Wallet}
                        title={isCust ? "No customer owes you anything" : "You do not owe any supplier"}
                        description={qD || pf !== "all" || bucket !== null ? "Try clearing the filters." : "Open balances will show up here."}
                        className="p-4 md:p-6"
                      />
                    </TableCell></TableRow>
                  ) : pageRows.map((r) => (
                    <TableRow key={r.partyId} data-state={sel?.partyId === r.partyId ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Button type="button" variant="ghost" onClick={() => open(r)} className="h-auto flex-col items-start gap-0 px-0 text-left hover:bg-transparent">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs font-normal text-muted-foreground">{isCust
                            ? ([r.phone, r.group].filter(Boolean).join(" · ") || (r.walkIn ? "Sells without a customer" : "No phone"))
                            : (r.phone || "No phone")}</span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        {isCust ? `${plural(r.docs, "invoice")}${r.hasPartial ? " · partly paid" : ""}` : `${docsText(r)}${r.hasPartial ? " · partly paid" : ""}`}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.due)}{r.hasPartial && <div className="text-xs font-normal text-muted-foreground">{formatCurrency(r.paidSoFar)} paid</div>}</TableCell>
                      {isCust ? (
                        <>
                          <TableCell>
                            <div>{fmtD(r.oldestDate)}</div>
                            <Badge variant={r.ageDays > 60 ? "destructive" : r.ageDays > 30 ? "secondary" : "outline"}>{r.ageDays} days</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.walkIn ? "—" : reminderText(r)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div>{r.dueDate ? fmtD(r.dueDate) : "No due date"}</div>
                            <Badge variant={r.overdue ? "destructive" : (r.dueInDays ?? 99) <= 7 ? "secondary" : "outline"}>{r.dueDate ? supplierDueText(r) : `${r.ageDays} days old`}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{supplierStatus(r) || "—"}</TableCell>
                        </>
                      )}
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button type="button" size="sm" onClick={() => open(r)}>{copy.action}</Button>
                          {isCust && !r.walkIn && <WithTooltip content={`Send reminder to ${r.name}`}><Button type="button" variant="outline" size="icon" aria-label={`Send reminder to ${r.name}`} onClick={() => { open(r).then(() => remind(r, "Copy")) }}><Bell className="size-4" /></Button></WithTooltip>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pt-3.5 pb-4 text-sm text-muted-foreground tabular-nums">{rows.length} {copy.who} · {formatCurrency(totalDue)} outstanding</div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-0"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </Card>

        <aside className="w-full shrink-0 xl:w-[390px]">
          {!sel ? (
            <Card><EmptyState title={copy.pickEmpty} className="p-4 md:p-6" /></Card>
          ) : (
            <SectionCard
              title={sel.name}
              description={[sel.phone, sel.email, isCust ? sel.group : null].filter(Boolean).join(" · ") || (sel.walkIn ? "Sells without a customer attached" : `${plural(sel.docs, isCust ? "open invoice" : "open PO")}`)}
              contentClassName="flex flex-col gap-3.5"
            >
              <Item variant="muted" size="sm">
                <ItemContent><ItemTitle>{isCust ? "Owes you" : "You owe"}</ItemTitle></ItemContent>
                <ItemActions><span className="text-xl font-semibold tabular-nums">{formatCurrency(sel.due)}</span></ItemActions>
              </Item>
              <FormField label="Unpaid documents">
                {docsLoading ? <Skeleton className="h-16" /> : docs.map((d) => (
                  <FieldLabel key={key(d)} className="cursor-pointer">
                    <Field orientation="horizontal">
                      <Checkbox checked={picked.has(key(d))} onCheckedChange={() => toggleDoc(d)} />
                      <FieldContent className="min-w-0">
                        <FieldTitle>{d.no}</FieldTitle>
                        <FieldDescription className="text-xs">{fmtD(d.date)} · {d.ageDays} days old{d.paid > 0 ? ` · paid ${formatCurrency(d.paid)} of ${formatCurrency(d.total)}` : ""}{!isCust && d.status ? ` · ${STATUS_LABEL[d.status] ?? d.status}` : ""}</FieldDescription>
                      </FieldContent>
                      <strong className="tabular-nums">{formatCurrency(d.due)}</strong>
                    </Field>
                  </FieldLabel>
                ))}
              </FormField>
              <FormField label="Amount" htmlFor={`dues-amount-${party}`}><Input id={`dues-amount-${party}`} type="number" min={0} step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
              <FormField label="Method">
                <div role="radiogroup" aria-label="Method" className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <Button key={m.id} type="button" size="sm" variant={method === m.id ? "default" : "outline"} role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}>{m.id}</Button>
                  ))}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label="Date" htmlFor={`dues-date-${party}`}><Input id={`dues-date-${party}`} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
                <FormField label="Reference" htmlFor={`dues-ref-${party}`}><Input id={`dues-ref-${party}`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Optional" /></FormField>
              </div>
              <FormField label="Notes" htmlFor={`dues-notes-${party}`}><Textarea id={`dues-notes-${party}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></FormField>
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              <Button type="button" disabled={busy} onClick={settle}>{busy ? "Saving…" : `${copy.verb} ${formatCurrency(amtNum)}`}</Button>
              {isCust && sel.walkIn && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">These sells have no customer attached, so there is nobody to remind. You can still collect payments against them here.</p>
                </>
              )}
              {isCust && !sel.walkIn && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <SectionTitle>Send a reminder</SectionTitle>
                    <Item variant="muted" size="sm" className="leading-snug">{message || "Preparing message…"}</Item>
                    <div className="flex gap-2">
                      {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <Button key={c} type="button" variant="outline" className="flex-1" onClick={() => remind(sel, c)}>{c}</Button>)}
                    </div>
                  </div>
                </>
              )}
              {!isCust && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <SectionTitle>Note to supplier (optional)</SectionTitle>
                    <Textarea rows={3} aria-label="Note to supplier" value={note || supplierNote} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <Button key={c} type="button" variant="outline" className="flex-1" onClick={() => sendSupplierNote(c)}>{c}</Button>)}
                    </div>
                  </div>
                </>
              )}
            </SectionCard>
          )}
        </aside>
      </div>

      <SectionCard role="region" aria-label="Payment history" title={copy.histTitle}>
        {history.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{copy.histEmpty}</p> : (
          <ItemGroup>
            {history.map((h, i) => (
              <Fragment key={h.id}>
                {i > 0 && <ItemSeparator />}
                <Item role="listitem" size="sm" className="px-0">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{h.partyName}</ItemTitle>
                    <ItemDescription className="truncate text-xs">{[h.documentNo, h.reference, h.notes].filter(Boolean).join(" · ") || "Applied to oldest document"}</ItemDescription>
                  </ItemContent>
                  <span className="text-xs text-muted-foreground">{fmtD(h.date)} · {h.method}</span>
                  <ItemActions><strong className="tabular-nums">{formatCurrency(h.amount)}</strong></ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        )}
      </SectionCard>
    </div>
  )
}
