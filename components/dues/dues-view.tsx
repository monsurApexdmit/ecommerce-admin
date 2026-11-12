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
import { useTranslation } from "react-i18next"
import { localeTag } from "@/lib/i18n"

const BUCKET_COLORS = ["#0F766E", "#F59E0B", "#EA580C", "#B42318"]
// Method ids are sent to the backend as-is; only the label is translated
const METHODS = [
  { id: "Cash", label: "customers:shared.methods.cash" }, { id: "bKash", label: "customers:shared.methods.bkash" },
  { id: "Nagad", label: "customers:shared.methods.nagad" }, { id: "Bank", label: "customers:shared.methods.bank" },
  { id: "Card", label: "customers:shared.methods.card" }, { id: "Other", label: "customers:shared.methods.other" },
] as const
const today = () => new Date().toISOString().slice(0, 10)
const SORTS = { age: "customers:dues.sort.age", amount: "customers:dues.sort.amount", name: "customers:dues.sort.name" } as const
const NEXT_SORT = { age: "amount", amount: "name", name: "age" } as const
// PO status codes → labels (unknown codes show raw)
const STATUS_LABEL = { draft: "customers:dues.poStatus.draft", sent: "customers:dues.poStatus.sent", partial: "customers:dues.poStatus.partial", received: "customers:dues.poStatus.received" } as const
// Aging bucket keys 0–3 are fixed by the backend (DueGroupService::BUCKETS); its English label is the fallback
const BUCKET_LABEL = { 0: "customers:dues.buckets.b0", 1: "customers:dues.buckets.b1", 2: "customers:dues.buckets.b2", 3: "customers:dues.buckets.b3" } as const

interface Props { party: DueParty }

export function DuesView({ party }: Props) {
  const { t, i18n } = useTranslation(["customers", "common"])
  const locale = localeTag(i18n.language)
  const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" }) : "—")
  const statusLabel = (x: string) => { const k = (STATUS_LABEL as Record<string, (typeof STATUS_LABEL)[keyof typeof STATUS_LABEL] | undefined>)[x]; return k ? t(k) : x }
  const methodLabel = (m: string) => { const k = METHODS.find((x) => x.id === m)?.label; return k ? t(k) : m }
  const isCust = party === "customers"
  const { formatCurrency } = useCompanySettings()
  const copy = isCust
    ? { title: t("customers:dues.cust.title"), sub: t("customers:dues.cust.sub"), search: t("customers:dues.cust.search"), agingTitle: t("customers:dues.cust.aging"),
        cols: [t("common:fields.customer"), t("customers:dues.cust.colUnpaid"), t("common:money.due"), t("customers:dues.cust.colOldest"), t("customers:dues.cust.colReminder"), ""],
        action: t("customers:dues.cust.action"), histTitle: t("customers:dues.cust.histTitle"), histEmpty: t("customers:dues.cust.histEmpty"), pickEmpty: t("customers:dues.cust.pickEmpty") }
    : { title: t("customers:dues.vend.title"), sub: t("customers:dues.vend.sub"), search: t("customers:dues.vend.search"), agingTitle: t("customers:dues.vend.aging"),
        cols: [t("common:extra.supplier"), t("customers:dues.vend.colPOs"), t("common:money.due"), t("customers:dues.vend.colDueDate"), t("common:fields.status"), ""],
        action: t("customers:dues.vend.action"), histTitle: t("customers:dues.vend.histTitle"), histEmpty: t("customers:dues.vend.histEmpty"), pickEmpty: t("customers:dues.vend.pickEmpty") }

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
      toast.error(t("customers:dues.toast.loadFailed"))
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
    if (date > today()) { setErr(t("customers:dues.errors.future")); return }
    if (picked.size === 0) { setErr(t("customers:dues.errors.selectDoc")); return }
    if (!(amtNum > 0)) { setErr(t("customers:dues.errors.amount")); return }
    if (amtNum > pickedDue + 0.005) { setErr(t("customers:dues.errors.tooMuch", { due: formatCurrency(pickedDue) })); return }
    setBusy(true); setErr("")
    try {
      await dueApi.settle(party, sel.partyId, {
        amount: amtNum, method, date, reference: ref.trim() || undefined, notes: notes.trim() || undefined,
        documentIds: docs.filter((d) => picked.has(key(d))).map((d) => ({ type: d.documentType, id: d.documentId })),
      })
      toast.success(isCust ? t("customers:dues.toast.collected", { amount: formatCurrency(amtNum), name: sel.name }) : t("customers:dues.toast.paid", { amount: formatCurrency(amtNum), name: sel.name }))
      const stillOpen = amtNum < pickedDue - 0.005 || docs.length > picked.size
      await Promise.all([load(), loadHistory()])
      // when fully settled the auto-select effect moves to the next row
      if (stillOpen) await open({ ...sel })
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("customers:dues.errors.saveFailed"))
    } finally {
      setBusy(false)
    }
  }

  const remind = async (row: DuePartyRow, channel: "SMS" | "WhatsApp" | "Copy") => {
    try {
      const res = await dueApi.remind(row.partyId, channel)
      setMessage(res.message)
      load()
      if (channel === "Copy") { await navigator.clipboard?.writeText(res.message); toast.success(t("customers:dues.toast.reminderCopied")) }
      else {
        const phone = (row.phone ?? "").replace(/[^\d+]/g, "")
        if (channel === "SMS") window.open(`sms:${phone}?body=${encodeURIComponent(res.message)}`)
        else window.open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(res.message)}`, "_blank")
        toast.success(t("customers:dues.toast.reminderRecorded", { channel, name: row.name }))
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("customers:dues.toast.reminderFailed"))
    }
  }

  const supplierDueText = (r: DuePartyRow) => r.dueDate == null ? t("customers:dues.noDueDate") : r.dueInDays == null ? "" : r.dueInDays < 0 ? t("customers:dues.overdueDays", { count: -r.dueInDays }) : r.dueInDays === 0 ? t("customers:dues.dueToday") : t("customers:dues.dueIn", { count: r.dueInDays })
  const supplierStatus = (r: DuePartyRow) => {
    const text = (r.statuses ?? []).map(statusLabel).join(" / ")
    return r.overdue ? t("customers:dues.overdueSuffix", { text }) : text
  }
  const reminderText = (r: DuePartyRow) => r.lastReminder?.at ? t("customers:dues.reminderAt", { channel: r.lastReminder.channel ?? t("customers:dues.reminderFallback"), date: fmtD(r.lastReminder.at.slice(0, 10)) }) : t("customers:dues.notReminded")
  const docsText = (r: DuePartyRow) => {
    const nos = r.lastDocNos ?? []
    const base = nos.length <= 2 ? nos.join(", ") : t("customers:dues.docsMore", { first: nos[0], count: r.docs - 1 })
    return base || t("customers:dues.documents", { count: r.docs })
  }

  const supplierNote = sel && !isCust
    ? t("customers:dues.supplierNote", { amount: formatCurrency(amtNum > 0 ? amtNum : sel.due), docs: docs.filter((d) => picked.has(key(d))).map((d) => d.no).join(", ") || (sel.lastDocNos ?? []).join(", "), method: methodLabel(method) })
    : ""
  const sendSupplierNote = async (channel: "SMS" | "WhatsApp" | "Copy") => {
    if (!sel) return
    const text = note || supplierNote
    const phone = (sel.phone ?? "").replace(/[^\d+]/g, "")
    if (channel === "Copy") { await navigator.clipboard?.writeText(text); toast.success(t("customers:dues.toast.noteCopied")) }
    else if (channel === "SMS") window.open(`sms:${phone}?body=${encodeURIComponent(text)}`)
    else window.open(`https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(text)}`, "_blank")
  }

  // Headers stay English: exportToCSV reads each row by its header lower-cased with spaces → "_",
  // so row keys are snake_case to match. Numbers go in as strings: the util blanks falsy values (0).
  const handleExport = () => {
    const list = data?.rows ?? []
    if (isCust) {
      exportToCSV(list.map((r) => ({
        name: r.name, phone: r.phone ?? "", group: r.group ?? "", unpaid_invoices: String(r.docs ?? 0), due: String(r.due ?? 0),
        oldest: r.oldestDate ?? "", age_days: String(r.ageDays ?? 0), last_reminder: reminderText(r),
      })), "customer-dues", ["Name", "Phone", "Group", "Unpaid invoices", "Due", "Oldest", "Age days", "Last reminder"])
    } else {
      exportToCSV(list.map((r) => ({
        name: r.name, purchase_orders: (r.lastDocNos ?? []).join(" "), due: String(r.due ?? 0), due_date: r.dueDate ?? "",
        days_old: String(r.ageDays ?? 0), status: supplierStatus(r),
      })), "vendor-dues", ["Name", "Purchase orders", "Due", "Due date", "Days old", "Status"])
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
    { label: t("customers:dues.kpi.custOwe"), value: formatCurrency(num("totalDue")), icon: <Wallet className="size-4" />, color: "yellow" as const, hint: t("customers:dues.kpi.customers", { count: num("partyCount") }) },
    { label: t("customers:dues.kpi.overdue30"), value: formatCurrency(num("overdue30Amount")), icon: <Clock className="size-4" />, color: "red" as const, hint: t("customers:dues.kpi.customers", { count: num("overdue30Parties") }) },
    { label: t("customers:dues.kpi.collectedMonth"), value: formatCurrency(num("collectedThisMonth")), icon: <Banknote className="size-4" />, color: "green" as const, hint: t("customers:dues.kpi.payments", { count: num("collectedThisMonthCount") }) },
    { label: t("customers:dues.kpi.openInvoices"), value: num("openInvoices"), icon: <FileText className="size-4" />, color: "blue" as const, hint: num("openInvoices") ? t("customers:dues.kpi.avgEach", { amount: formatCurrency(num("avgInvoice")) }) : t("customers:dues.kpi.nothingOutstanding") },
  ] : [
    { label: t("customers:dues.kpi.youOwe"), value: formatCurrency(num("totalDue")), icon: <Wallet className="size-4" />, color: "yellow" as const, hint: `${t("customers:dues.kpi.suppliers", { count: num("partyCount") })} · ${t("customers:dues.kpi.pos", { count: num("openBills") })}` },
    { label: t("customers:dues.kpi.overdue"), value: formatCurrency(num("overdueAmount")), icon: <Clock className="size-4" />, color: "red" as const, hint: t("customers:dues.kpi.pastDue", { suppliers: t("customers:dues.kpi.suppliers", { count: num("overdueParties") }) }) },
    { label: t("customers:dues.kpi.next7"), value: formatCurrency(num("dueNext7Amount")), icon: <CalendarClock className="size-4" />, color: "blue" as const, hint: t("customers:dues.kpi.suppliers", { count: num("dueNext7Parties") }) },
    { label: t("customers:dues.kpi.paidMonth"), value: formatCurrency(num("paidThisMonth")), icon: <Banknote className="size-4" />, color: "green" as const, hint: t("customers:dues.kpi.payments", { count: num("paidThisMonthCount") }) },
  ], [data, isCust, formatCurrency, t]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5")}>
      <PageHeader title={copy.title} description={copy.sub} />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : <StatsCards stats={kpis} />}

      <SectionCard title={copy.agingTitle} actions={<span className="text-xs text-muted-foreground">{t("customers:dues.bucketHint")}</span>} contentClassName="flex flex-col gap-3">
        <div className="flex h-3 gap-1 overflow-hidden rounded-full">
          {(data?.aging ?? []).map((a) => <div key={a.key} style={{ width: `${Math.max(a.amount ? 4 : 0, Math.round((a.amount / Math.max(1, (data?.aging ?? []).reduce((x, y) => x + y.amount, 0))) * 100))}%`, background: BUCKET_COLORS[a.key] }} />)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {(data?.aging ?? []).map((a) => (
            <Button key={a.key} type="button" variant={bucket === a.key ? "secondary" : "outline"} aria-pressed={bucket === a.key} onClick={() => { setBucket(bucket === a.key ? null : a.key); setPage(1) }}
              className={cn("h-auto flex-col items-start justify-start gap-0.5 whitespace-normal text-left", bucket === a.key && "ring-2 ring-ring")}>
              <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: BUCKET_COLORS[a.key] }} />{BUCKET_LABEL[a.key] ? t(BUCKET_LABEL[a.key]) : a.label}</span>
              <span className="text-lg font-semibold tabular-nums" style={{ opacity: a.amount / agingMax > 0 ? 1 : 0.5 }}>{formatCurrency(a.amount)}</span>
              <span className="text-xs font-normal text-muted-foreground">{t("customers:dues.accounts", { count: a.count })}</span>
            </Button>
          ))}
        </div>
      </SectionCard>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <Toolbar className="gap-2.5 p-4" actions={<>
            <Button type="button" variant="outline" onClick={() => { setSort(NEXT_SORT[sort]); setPage(1) }}>{t("customers:dues.sortBy", { sort: t(SORTS[sort]) })}</Button>
            <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("customers:dues.exportCsv")}</Button>
          </>}>
            <div className="relative min-w-[200px] flex-1">
              <Label htmlFor={`dues-search-${party}`} className="sr-only">{t("common:actions.search")}</Label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input id={`dues-search-${party}`} type="search" placeholder={copy.search} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-9" />
            </div>
            <Select value={pf} onValueChange={(v) => { setPf(v); setPage(1) }}>
              <SelectTrigger aria-label={t("customers:dues.paymentProgress")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("customers:dues.paymentsAll")}</SelectItem><SelectItem value="partial">{t("customers:dues.partlyPaid")}</SelectItem><SelectItem value="unpaid">{t("customers:dues.nothingPaid")}</SelectItem>
              </SelectContent>
            </Select>
          </Toolbar>
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow>
                  {copy.cols.map((c, i) => <TableHead key={i} scope="col" className={cn(i === 0 && "pl-4", i === 2 && "text-right", i === 5 && "pr-4 text-right")}>{c || t("common:fields.actions")}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={6} className="px-4"><Skeleton className="h-11" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={6}>
                      <EmptyState
                        icon={Wallet}
                        title={isCust ? t("customers:dues.cust.empty") : t("customers:dues.vend.empty")}
                        description={qD || pf !== "all" || bucket !== null ? t("customers:shared.tryClearing") : t("customers:dues.noBalances")}
                        className="p-4 md:p-6"
                      />
                    </TableCell></TableRow>
                  ) : pageRows.map((r) => (
                    <TableRow key={r.partyId} data-state={sel?.partyId === r.partyId ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <Button type="button" variant="ghost" onClick={() => open(r)} className="h-auto flex-col items-start gap-0 px-0 text-left hover:bg-transparent">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs font-normal text-muted-foreground">{isCust
                            ? ([r.phone, r.group].filter(Boolean).join(" · ") || (r.walkIn ? t("customers:dues.walkInRow") : t("customers:dues.noPhone")))
                            : (r.phone || t("customers:dues.noPhone"))}</span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        {(() => { const text = isCust ? t("customers:dues.invoices", { count: r.docs }) : docsText(r); return r.hasPartial ? t("customers:dues.withPartial", { text }) : text })()}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{formatCurrency(r.due)}{r.hasPartial && <div className="text-xs font-normal text-muted-foreground">{t("customers:dues.paidSoFar", { amount: formatCurrency(r.paidSoFar) })}</div>}</TableCell>
                      {isCust ? (
                        <>
                          <TableCell>
                            <div>{fmtD(r.oldestDate)}</div>
                            <Badge variant={r.ageDays > 60 ? "destructive" : r.ageDays > 30 ? "secondary" : "outline"}>{t("customers:dues.days", { count: r.ageDays })}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{r.walkIn ? "—" : reminderText(r)}</TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <div>{r.dueDate ? fmtD(r.dueDate) : t("customers:dues.noDueDate")}</div>
                            <Badge variant={r.overdue ? "destructive" : (r.dueInDays ?? 99) <= 7 ? "secondary" : "outline"}>{r.dueDate ? supplierDueText(r) : t("customers:dues.daysOld", { count: r.ageDays })}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{supplierStatus(r) || "—"}</TableCell>
                        </>
                      )}
                      <TableCell className="pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button type="button" size="sm" onClick={() => open(r)}>{copy.action}</Button>
                          {isCust && !r.walkIn && <WithTooltip content={t("customers:dues.sendReminderTo", { name: r.name })}><Button type="button" variant="outline" size="icon" aria-label={t("customers:dues.sendReminderTo", { name: r.name })} onClick={() => { open(r).then(() => remind(r, "Copy")) }}><Bell className="size-4" /></Button></WithTooltip>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pt-3.5 pb-4 text-sm text-muted-foreground tabular-nums">{isCust ? t("customers:dues.cust.footer", { count: rows.length, amount: formatCurrency(totalDue) }) : t("customers:dues.vend.footer", { count: rows.length, amount: formatCurrency(totalDue) })}</div>
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
              description={[sel.phone, sel.email, isCust ? sel.group : null].filter(Boolean).join(" · ") || (sel.walkIn ? t("customers:dues.walkInDesc") : isCust ? t("customers:dues.openInvoices", { count: sel.docs }) : t("customers:dues.openPOs", { count: sel.docs }))}
              contentClassName="flex flex-col gap-3.5"
            >
              <Item variant="muted" size="sm">
                <ItemContent><ItemTitle>{isCust ? t("customers:dues.cust.owes") : t("customers:dues.vend.owes")}</ItemTitle></ItemContent>
                <ItemActions><span className="text-xl font-semibold tabular-nums">{formatCurrency(sel.due)}</span></ItemActions>
              </Item>
              <FormField label={t("customers:dues.unpaidDocs")}>
                {docsLoading ? <Skeleton className="h-16" /> : docs.map((d) => (
                  <FieldLabel key={key(d)} className="cursor-pointer">
                    <Field orientation="horizontal">
                      <Checkbox checked={picked.has(key(d))} onCheckedChange={() => toggleDoc(d)} />
                      <FieldContent className="min-w-0">
                        <FieldTitle>{d.no}</FieldTitle>
                        <FieldDescription className="text-xs">{[fmtD(d.date), t("customers:dues.daysOld", { count: d.ageDays }), d.paid > 0 ? t("customers:dues.paidOf", { paid: formatCurrency(d.paid), total: formatCurrency(d.total) }) : "", !isCust && d.status ? statusLabel(d.status) : ""].filter(Boolean).join(" · ")}</FieldDescription>
                      </FieldContent>
                      <strong className="tabular-nums">{formatCurrency(d.due)}</strong>
                    </Field>
                  </FieldLabel>
                ))}
              </FormField>
              <FormField label={t("common:money.amount")} htmlFor={`dues-amount-${party}`}><Input id={`dues-amount-${party}`} type="number" min={0} step="0.01" className="tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value)} /></FormField>
              <FormField label={t("customers:dues.method")}>
                <div role="radiogroup" aria-label={t("customers:dues.method")} className="flex flex-wrap gap-1.5">
                  {METHODS.map((m) => (
                    <Button key={m.id} type="button" size="sm" variant={method === m.id ? "default" : "outline"} role="radio" aria-checked={method === m.id} onClick={() => setMethod(m.id)}>{t(m.label)}</Button>
                  ))}
                </div>
              </FormField>
              <div className="grid grid-cols-2 gap-2.5">
                <FormField label={t("common:fields.date")} htmlFor={`dues-date-${party}`}><Input id={`dues-date-${party}`} type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} /></FormField>
                <FormField label={t("common:extra.reference")} htmlFor={`dues-ref-${party}`}><Input id={`dues-ref-${party}`} value={ref} onChange={(e) => setRef(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
              </div>
              <FormField label={t("common:fields.notes")} htmlFor={`dues-notes-${party}`}><Textarea id={`dues-notes-${party}`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("common:status.optional")} /></FormField>
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              <Button type="button" disabled={busy} onClick={settle}>{busy ? t("common:actions.saving") : isCust ? t("customers:dues.cust.verbAmount", { amount: formatCurrency(amtNum) }) : t("customers:dues.vend.verbAmount", { amount: formatCurrency(amtNum) })}</Button>
              {isCust && sel.walkIn && (
                <>
                  <Separator />
                  <p className="text-xs text-muted-foreground">{t("customers:dues.walkInNote")}</p>
                </>
              )}
              {isCust && !sel.walkIn && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <SectionTitle>{t("customers:dues.sendReminder")}</SectionTitle>
                    <Item variant="muted" size="sm" className="leading-snug">{message || t("customers:dues.preparing")}</Item>
                    <div className="flex gap-2">
                      {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <Button key={c} type="button" variant="outline" className="flex-1" onClick={() => remind(sel, c)}>{c === "Copy" ? t("common:actions.copy") : c}</Button>)}
                    </div>
                  </div>
                </>
              )}
              {!isCust && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-2">
                    <SectionTitle>{t("customers:dues.noteToSupplier")}</SectionTitle>
                    <Textarea rows={3} aria-label={t("customers:dues.noteToSupplierAria")} value={note || supplierNote} onChange={(e) => setNote(e.target.value)} />
                    <div className="flex gap-2">
                      {(["SMS", "WhatsApp", "Copy"] as const).map((c) => <Button key={c} type="button" variant="outline" className="flex-1" onClick={() => sendSupplierNote(c)}>{c === "Copy" ? t("common:actions.copy") : c}</Button>)}
                    </div>
                  </div>
                </>
              )}
            </SectionCard>
          )}
        </aside>
      </div>

      <SectionCard role="region" aria-label={t("customers:dues.historyAria")} title={copy.histTitle}>
        {history.length === 0 ? <p className="py-6 text-sm text-muted-foreground">{copy.histEmpty}</p> : (
          <ItemGroup>
            {history.map((h, i) => (
              <Fragment key={h.id}>
                {i > 0 && <ItemSeparator />}
                <Item role="listitem" size="sm" className="px-0">
                  <ItemContent className="min-w-0">
                    <ItemTitle>{h.partyName}</ItemTitle>
                    <ItemDescription className="truncate text-xs">{[h.documentNo, h.reference, h.notes].filter(Boolean).join(" · ") || t("customers:dues.appliedOldest")}</ItemDescription>
                  </ItemContent>
                  <span className="text-xs text-muted-foreground">{fmtD(h.date)} · {methodLabel(h.method)}</span>
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
