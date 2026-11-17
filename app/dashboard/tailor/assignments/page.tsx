"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Printer, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FilterBar } from "@/components/common/Toolbar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { AccessDenied } from "@/components/ui/access-denied"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import {
  tailorApi, tailorWorkshopApi,
  type AssignmentDorjiOption, type AssignmentOrderOption, type AssignmentRow, type AssignmentStats, type Pagination, type TailorWorkStatus,
} from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"
import { localeTag } from "@/lib/i18n"
import { TAILOR_NS, dorjiStatusLabel, type TailorKey } from "@/components/tailor/i18n"

type Tab = "all" | TailorWorkStatus
const TABS: { value: Tab; label: TailorKey }[] = [
  { value: "all", label: "common:status.all" }, { value: "assigned", label: "tailor:work.assigned" }, { value: "in_progress", label: "tailor:work.inProgress" },
  { value: "completed", label: "tailor:work.completed" }, { value: "returned", label: "tailor:work.returnedShort" }, { value: "paid", label: "tailor:work.paid" },
]
const DUE_FILTERS: { v: string; label: TailorKey }[] = [
  { v: "any", label: "tailor:assign.expectedAny" }, { v: "overdue", label: "tailor:shared.overdue" }, { v: "today", label: "tailor:shared.dueToday" },
  { v: "week", label: "tailor:shared.next7Days" },
]


const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const todayIso = () => iso(new Date())
const fmtD = (d: string | null | undefined, lng: string) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(localeTag(lng), { month: "short", day: "numeric", year: "numeric" }) : "—")
const diffDays = (d: string) => Math.round((new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime()) / 86400000)
const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

interface FormState { orderId: string; dorjiId: string; task: string; qty: string; rate: string; given: string; back: string; notes: string }
const blank = (): FormState => ({ orderId: "", dorjiId: "", task: "", qty: "", rate: "", given: todayIso(), back: "", notes: "" })

export default function AssignmentsPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const { t, i18n } = useTranslation(TAILOR_NS)
  const lng = i18n.language

  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [stats, setStats] = useState<AssignmentStats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [orders, setOrders] = useState<AssignmentOrderOption[]>([])
  const [dorjis, setDorjis] = useState<AssignmentDorjiOption[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [dorjiF, setDorjiF] = useState("")
  const [dueF, setDueF] = useState("any")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blank())
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const d = new URLSearchParams(window.location.search).get("dorji")
    if (d) setDorjiF(d)
  }, [])
  useEffect(() => { const t = setTimeout(() => { setQD(q.trim()); setPage(1) }, 250); return () => clearTimeout(t) }, [q])

  const dueParams = useMemo(() => {
    const t = todayIso()
    if (dueF === "overdue") { const y = new Date(); y.setDate(y.getDate() - 1); return { due_to: iso(y), open_only: 1 } }
    if (dueF === "today") return { due_from: t, due_to: t }
    if (dueF === "week") { const e = new Date(); e.setDate(e.getDate() + 7); return { due_from: t, due_to: iso(e) } }
    return {}
  }, [dueF])

  const load = useCallback(async () => {
    try {
      const r = await tailorWorkshopApi.getBoard({
        search: qD || undefined, dorji_id: dorjiF || undefined, work_status: tab !== "all" ? tab : undefined, page, limit: perPage, ...dueParams,
      })
      setRows(r.rows); setStats(r.stats); setPagination(r.pagination)
    } catch {
      toast.error(t("tailor:assign.failedLoad"))
    } finally {
      setLoading(false)
    }
  }, [qD, dorjiF, tab, page, perPage, dueParams, t])
  useEffect(() => { load() }, [load])

  const loadOptions = useCallback(async () => {
    try { const o = await tailorWorkshopApi.getAssignmentOptions(); setOrders(o.orders); setDorjis(o.dorjis) } catch { /* options are best-effort */ }
  }, [])
  useEffect(() => { loadOptions() }, [loadOptions])
  const refresh = () => { load(); loadOptions() }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }
  const activeDorjis = dorjis.filter((d) => d.status === "active")
  const charge = (Number(form.qty) || 0) * (Number(form.rate) || 0)

  const pickOrder = (id: string) => {
    const o = orders.find((x) => String(x.id) === id)
    setForm((f) => ({ ...f, orderId: id, ...(o ? { task: o.task, qty: o.pieces ? String(o.pieces) : "", back: o.deliveryDate || f.back || "" } : {}) }))
    setErr("")
  }
  const pickDorji = (id: string) => {
    const d = dorjis.find((x) => String(x.id) === id)
    setForm((f) => ({ ...f, dorjiId: id, rate: d ? (d.ratePerPiece ? String(d.ratePerPiece) : "") : f.rate }))
    setErr("")
  }
  const pickUnassigned = () => {
    const o = stats?.firstUnassigned
    if (o) { setForm({ ...blank(), orderId: String(o.id), task: o.task, qty: o.pieces ? String(o.pieces) : "", back: o.deliveryDate ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }) }
  }

  const save = async () => {
    const o = orders.find((x) => String(x.id) === form.orderId)
    const d = dorjis.find((x) => String(x.id) === form.dorjiId)
    const qty = Number(form.qty), rate = Number(form.rate)
    if (!o) { setErr(t("tailor:assign.selectOrderErr")); return }
    if (!d) { setErr(t("tailor:assign.selectDorjiErr")); return }
    if (d.status !== "active") { setErr(t("tailor:assign.notActive", { name: d.name })); return }
    if (!form.task.trim()) { setErr(t("tailor:assign.describeTask")); return }
    if (!(qty > 0) || !Number.isInteger(qty)) { setErr(t("tailor:assign.piecesWhole")); return }
    if (form.rate === "" || !isFinite(rate) || rate < 0) { setErr(t("tailor:assign.validRate")); return }
    if (form.given && form.back && form.back < form.given) { setErr(t("tailor:assign.backBeforeAssigned")); return }
    setSaving(true); setErr("")
    const payload = {
      orderId: o.id, dorjiId: d.id, task: form.task.trim(), pieces: qty, ratePerPiece: rate,
      assignedDate: form.given || todayIso(), expectedCompletion: form.back || null, adminNotes: form.notes.trim() || null,
    }
    try {
      try {
        await tailorWorkshopApi.assign(payload)
      } catch (e: any) {
        if (e?.response?.status === 409 && window.confirm(e.response.data?.message || t("tailor:assign.overCapacity"))) await tailorWorkshopApi.assign({ ...payload, force: true })
        else throw e
      }
      toast.success(t("tailor:assign.assignedTo", { name: d.name }))
      setForm(blank()); refresh()
    } catch (e: any) {
      if (e?.response?.status !== 409) setErr(e?.response?.data?.message || t("tailor:assign.couldNotAssign"))
    } finally {
      setSaving(false)
    }
  }

  const patch = async (r: AssignmentRow, data: Parameters<typeof tailorWorkshopApi.patchAssignment>[1], okMsg?: string) => {
    try {
      const res = await tailorWorkshopApi.patchAssignment(r.id, data)
      if (okMsg) toast.success(okMsg)
      if (res.orderMovedBack) toast.success(t("tailor:assign.movedBack", { order: r.orderNumber ?? t("tailor:shared.order") }))
      if (res.orderAllDone && res.orderId && window.confirm(t("tailor:assign.allDone", { order: res.orderNumber ?? "" }))) {
        await tailorApi.updateOrderStatus(res.orderId, "ready", "All dorji jobs finished")
        toast.success(t("tailor:assign.markedReady"))
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("tailor:assign.couldNotUpdate"))
    } finally {
      refresh()
    }
  }

  const setStatus = (r: AssignmentRow, v: TailorWorkStatus) => {
    if (v === r.workStatus) return
    if (v === "paid") { toast.error(t("tailor:assign.payFromPayments")); return }
    patch(r, { workStatus: v })
  }

  const params = () => ({
    search: qD || undefined, dorji_id: dorjiF || undefined, work_status: tab !== "all" ? tab : undefined, ...dueParams,
  })
  const [printing, setPrinting] = useState(false)
  const printAll = async () => {
    setPrinting(true)
    try {
      const all: AssignmentRow[] = []
      for (let p = 1; p <= 200; p++) {
        const r = await tailorWorkshopApi.getBoard({ ...params(), page: p, limit: 100 })
        all.push(...r.rows)
        if (p >= (r.pagination?.last_page ?? 1)) break
      }
      printCards(all)
    } catch {
      toast.error(t("tailor:assign.couldNotLoadPrint"))
    } finally {
      setPrinting(false)
    }
  }

  const remove = async (r: AssignmentRow) => {
    if (!window.confirm(t("tailor:assign.deleteConfirm", { order: r.orderNumber ?? t("tailor:assign.orderWord"), task: r.task ?? t("tailor:assign.taskWord") }))) return
    try {
      await tailorWorkshopApi.deleteAssignment(r.id)
      toast.success(t("tailor:assign.deleted"))
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("tailor:assign.couldNotDelete"))
    } finally {
      refresh()
    }
  }

  const printCards = (list: AssignmentRow[]) => {
    if (!list.length) { toast.error(t("tailor:assign.noneToPrint")); return }
    const body = list.map((r) => `<div class="card"><h2>${esc(r.orderNumber ?? "—")} · ${esc(r.task ?? "")}</h2>
      <table><tr><td>${esc(t("common:fields.customer"))}</td><td>${esc(r.customerName ?? "—")}</td></tr><tr><td>${esc(t("tailor:shared.dorji"))}</td><td>${esc(r.dorjiName ?? "—")}</td></tr>
      <tr><td>${esc(t("tailor:assign.pieces"))}</td><td>${r.pieces}</td></tr><tr><td>${esc(t("tailor:assign.colGiven"))}</td><td>${esc(fmtD(r.assignedDate, lng))}</td></tr><tr><td>${esc(t("tailor:assign.colDueBack"))}</td><td>${esc(fmtD(r.dueDate, lng))}</td></tr>
      <tr><td>${esc(t("tailor:assign.ratePerPiece"))}</td><td>${esc(formatCurrency(r.ratePerPiece))}</td></tr><tr><td>${esc(t("tailor:assign.dorjiCharge"))}</td><td>${esc(formatCurrency(r.dorjiCharge))}</td></tr>
      ${r.adminNotes ? `<tr><td>${esc(t("common:fields.notes"))}</td><td>${esc(r.adminNotes)}</td></tr>` : ""}</table></div>`).join("")
    const w = window.open("", "_blank")
    if (!w) { toast.error(t("tailor:assign.allowPopups")); return }
    w.document.write(`<!doctype html><html lang="${esc(lng)}"><meta charset="utf-8"><title>${esc(t("tailor:assign.printTitle"))}</title><style>body{font-family:sans-serif;padding:24px;color:#0E1525}.card{border:1px solid #D5DAE5;border-radius:8px;padding:12px 16px;margin-bottom:16px;page-break-inside:avoid}h2{margin:0 0 8px;font-size:16px}table{border-collapse:collapse;width:100%}td{padding:4px 8px;border-bottom:1px solid #EEF0F5;font-size:14px}td:first-child{color:#5B6478;width:140px}</style>${body}`)
    w.document.close(); w.focus(); w.print()
  }

  if (!canRead("TailorOrders")) return <AccessDenied />
  const total = pagination?.total ?? 0
  const un = stats?.firstUnassigned
  const rowChoices = (r: AssignmentRow) => dorjis.filter((d) => d.status === "active" || d.id === r.dorjiId)

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("tailor:assign.title")}
        description={t("tailor:assign.description")}
        actions={<Button type="button" variant="outline" onClick={printAll} disabled={printing}><Printer className="size-4" aria-hidden /> {printing ? t("tailor:assign.preparing") : t("tailor:assign.printAll")}</Button>}
      />

      {stats && stats.unassignedOrders > 0 && un && canWrite("TailorOrders") && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
          <span><strong>{t("tailor:assign.unassignedHead", { count: stats.unassignedOrders })}</strong>{" "}
            {t("tailor:assign.unassignedBody", { order: un.orderNumber, garments: un.garments, customer: un.customerName || t("tailor:assign.customerFallback") })}{un.deliveryDate ? t("tailor:assign.dueSuffix", { date: fmtD(un.deliveryDate, lng) }) : ""}{stats.unassignedOrders > 1 ? t("tailor:assign.moreSuffix", { count: stats.unassignedOrders - 1 }) : "."}</span>
          <Button type="button" variant="outline" size="sm" onClick={pickUnassigned}>{t("tailor:assign.assignNow")}</Button>
          </AlertDescription>
        </Alert>
      )}
      {stats && (
        <Card className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span><strong>{t("tailor:assign.payPending")}</strong> {formatCurrency(stats.payPending)} <span className="text-muted-foreground">{t("tailor:assign.acrossJobs", { count: stats.payPendingJobs })}</span></span>
          <Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/payments">{t("tailor:assign.goToPayments")}</Link></Button>
        </Card>
      )}

      {canWrite("TailorOrders") && (
        <SectionCard aria-label={t("tailor:assign.assignOrder")} title={t("tailor:assign.assignWork")} contentClassName="flex flex-col gap-3">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField className="min-w-0" label={t("tailor:shared.order")} required htmlFor="assign-f1">
              <Select value={form.orderId || "__none"} onValueChange={(v) => pickOrder(v === "__none" ? "" : v)}>
                <SelectTrigger id="assign-f1" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("tailor:assign.selectOrder")}</SelectItem>
                  {orders.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber} · {o.customerName || t("common:fields.customer")} · {o.garments}</SelectItem>)}
                </SelectContent>
              </Select></FormField>
            <FormField className="min-w-0" label={t("tailor:shared.dorji")} required htmlFor="assign-f2">
              <Select value={form.dorjiId || "__none"} onValueChange={(v) => pickDorji(v === "__none" ? "" : v)}>
                <SelectTrigger id="assign-f2" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("tailor:assign.selectDorji")}</SelectItem>
                  {activeDorjis.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.task")} required htmlFor="assign-f3"><Input id="assign-f3" value={form.task} onChange={(e) => set("task", e.target.value)} placeholder={t("tailor:assign.taskPlaceholder")} /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.pieces")} required htmlFor="assign-f4"><Input id="assign-f4" type="number" min="1" value={form.qty} onChange={(e) => set("qty", e.target.value)} /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.ratePerPiece")} required htmlFor="assign-f5"><Input id="assign-f5" type="number" min="0" value={form.rate} onChange={(e) => set("rate", e.target.value)} /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.assignedOn")} htmlFor="assign-f6"><Input id="assign-f6" type="date" value={form.given} onChange={(e) => set("given", e.target.value)} /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.expectedBack")} htmlFor="assign-f7"><Input id="assign-f7" type="date" value={form.back} min={form.given || undefined} onChange={(e) => set("back", e.target.value)} /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.dorjiCharge")} htmlFor="assign-charge">
              <Input id="assign-charge" readOnly tabIndex={-1} value={formatCurrency(charge)} className="font-semibold tabular-nums" /></FormField>
            <FormField className="min-w-0" label={t("tailor:assign.notesForDorji")} htmlFor="assign-f8"><Input id="assign-f8" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("tailor:assign.notesPlaceholder")} /></FormField>
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setForm(blank()); setErr("") }}>{t("common:actions.clear")}</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? t("tailor:assign.assigning") : t("tailor:assign.assign")}</Button>
          </div>
        </SectionCard>
      )}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map((x) => ({ value: x.value, label: t(x.label), count: stats?.counts[x.value] }))} />
        </div>
        <FilterBar className="gap-2.5 p-4">
          <InputGroup className="min-w-[220px] flex-1">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput type="search" aria-label={t("common:actions.search")} placeholder={t("tailor:assign.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <Select value={dorjiF || "__all"} onValueChange={(v) => { setDorjiF(v === "__all" ? "" : v); setPage(1) }}>
            <SelectTrigger aria-label={t("tailor:shared.dorji")}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__all">{t("tailor:shared.dorjiAll")}</SelectItem>{dorjis.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dueF} onValueChange={(v) => { setDueF(v); setPage(1) }}>
            <SelectTrigger aria-label={t("tailor:assign.expectedBack")}><SelectValue /></SelectTrigger>
            <SelectContent>{DUE_FILTERS.map((f) => <SelectItem key={f.v} value={f.v}>{t(f.label)}</SelectItem>)}</SelectContent>
          </Select>
        </FilterBar>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t("tailor:assign.colJob")}</TableHead><TableHead>{t("tailor:shared.dorji")}</TableHead><TableHead>{t("tailor:assign.colGiven")}</TableHead>
                <TableHead>{t("tailor:assign.colDueBack")}</TableHead><TableHead>{t("tailor:assign.colWorkStatus")}</TableHead><TableHead>{t("tailor:assign.dorjiCharge")}</TableHead>
                <TableHead className="text-right">{t("common:fields.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="whitespace-normal"><EmptyState className="p-4 md:p-6" title={t("tailor:assign.noAssignments")} description={qD || dorjiF || tab !== "all" || dueF !== "any" ? t("tailor:assign.noMatch") : t("tailor:assign.noAssignmentsYet")} /></TableCell></TableRow>
                ) : rows.map((r) => {
                  const finished = r.workStatus === "completed" || r.workStatus === "paid"
                  const days = r.dueDate ? diffDays(r.dueDate) : null
                  const when = finished ? (r.workStatus === "paid" ? t("tailor:work.paid") : t("tailor:assign.returnedToShop")) : days === null ? "" : days < 0 ? t("tailor:when.late", { days: -days }) : days === 0 ? t("tailor:when.dueToday") : t("tailor:when.inDaysShort", { days })
                  const payState = r.workStatus === "paid" ? t("tailor:work.paid") : r.workStatus === "completed" ? (r.paidAmount > 0 ? t("tailor:assign.payableAmount", { amount: formatCurrency(r.payable) }) : t("tailor:assign.payable")) : r.workStatus === "returned" ? t("tailor:assign.heldUntilFixed") : t("tailor:assign.whenDone")
                  const locked = r.workStatus === "paid" || !canWrite("TailorOrders")
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="align-top">
                        <div className="font-semibold">{r.orderNumber ?? "—"} · {r.task}{r.pieces ? ` · ${t("tailor:shared.pcs", { count: r.pieces })}` : ""}</div>
                        <div className="text-xs text-muted-foreground">{r.customerName ?? "—"}</div>
                        {r.adminNotes && <div className="mt-0.5 text-xs text-muted-foreground">{r.adminNotes}</div>}
                      </TableCell>
                      <TableCell className="align-top">
                        <Select disabled={locked} value={String(r.dorjiId)} onValueChange={(v) => patch(r, { dorjiId: Number(v) }, t("tailor:assign.reassigned"))}>
                          <SelectTrigger aria-label={t("tailor:shared.dorji")} size="sm" className="max-w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {rowChoices(r).length === 0 || !rowChoices(r).some((d) => d.id === r.dorjiId) ? <SelectItem value={String(r.dorjiId)}>{r.dorjiName ?? "—"}</SelectItem> : null}
                            {rowChoices(r).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.status === "active" ? "" : ` (${dorjiStatusLabel(t, d.status)})`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">{fmtD(r.assignedDate, lng)}</TableCell>
                      <TableCell className="align-top">
                        <Input type="date" aria-label={t("tailor:assign.expectedBack")} disabled={locked} defaultValue={r.dueDate ?? ""} key={`${r.id}-${r.dueDate}`}
                          onBlur={(e) => { if ((e.target.value || null) !== (r.expectedCompletion ?? r.dueDate)) patch(r, { expectedCompletion: e.target.value || null }) }}
                          className="w-auto" />
                        <div className={cn("mt-0.5 text-xs font-semibold", finished ? "text-dash-success-fg" : days !== null && days < 0 ? "text-destructive" : "text-muted-foreground")}>{when}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select disabled={locked} value={r.workStatus} onValueChange={(v) => setStatus(r, v as TailorWorkStatus)}>
                          <SelectTrigger aria-label={t("tailor:assign.colWorkStatus")} size="sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned">{t("tailor:work.assigned")}</SelectItem><SelectItem value="in_progress">{t("tailor:work.inProgress")}</SelectItem><SelectItem value="completed">{t("tailor:work.completed")}</SelectItem>
                            <SelectItem value="returned">{t("tailor:work.returned")}</SelectItem><SelectItem value="paid" disabled={r.workStatus !== "paid"}>{t("tailor:work.paid")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-bold tabular-nums">{formatCurrency(r.dorjiCharge)}</div>
                        <div className={cn("text-xs", r.workStatus === "completed" ? "font-semibold text-amber-600" : r.workStatus === "paid" ? "text-dash-success-fg" : "text-muted-foreground")}>{payState}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={t("tailor:shared.printJobCard")}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:shared.printJobCard")} onClick={() => printCards([r])}><Printer className="size-4" /></Button></WithTooltip>
                          {canWrite("TailorOrders") && (
                            <WithTooltip content={r.workStatus === "paid" ? t("tailor:assign.paidNoDelete") : t("common:actions.delete")}>
                              {r.workStatus === "paid"
                                ? <span tabIndex={0}><WithTooltip content={t("tailor:assign.deleteAssignment")}><Button type="button" variant="destructive" size="icon" aria-label={t("tailor:assign.deleteAssignment")} disabled><Trash2 className="size-4" /></Button></WithTooltip></span>
                                : <WithTooltip content={t("tailor:assign.deleteAssignment")}><Button type="button" variant="destructive" size="icon" aria-label={t("tailor:assign.deleteAssignment")} onClick={() => remove(r)}><Trash2 className="size-4" /></Button></WithTooltip>}
                            </WithTooltip>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
            </TableBody>
          </Table>
        </div>
        {!loading && total > 0 && (
          <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
        )}
      </Card>
    </div>
  )
}
