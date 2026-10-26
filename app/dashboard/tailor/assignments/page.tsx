"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
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

type Tab = "all" | TailorWorkStatus
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" }, { value: "assigned", label: "Assigned" }, { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Done" }, { value: "returned", label: "Returned" }, { value: "paid", label: "Paid" },
]
const DUE_FILTERS = [
  { v: "any", label: "Expected back: Any" }, { v: "overdue", label: "Overdue" }, { v: "today", label: "Due today" },
  { v: "week", label: "Next 7 days" },
]


const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const todayIso = () => iso(new Date())
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")
const diffDays = (d: string) => Math.round((new Date(`${d.slice(0, 10)}T00:00:00Z`).getTime() - new Date(`${todayIso()}T00:00:00Z`).getTime()) / 86400000)
const esc = (t: unknown) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

interface FormState { orderId: string; dorjiId: string; task: string; qty: string; rate: string; given: string; back: string; notes: string }
const blank = (): FormState => ({ orderId: "", dorjiId: "", task: "", qty: "", rate: "", given: todayIso(), back: "", notes: "" })

export default function AssignmentsPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()

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
      toast.error("Failed to load assignments")
    } finally {
      setLoading(false)
    }
  }, [qD, dorjiF, tab, page, perPage, dueParams])
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
    if (!o) { setErr("Select an order."); return }
    if (!d) { setErr("Select a dorji."); return }
    if (d.status !== "active") { setErr(`${d.name} is not active.`); return }
    if (!form.task.trim()) { setErr("Describe the task."); return }
    if (!(qty > 0) || !Number.isInteger(qty)) { setErr("Pieces must be a whole number above 0."); return }
    if (form.rate === "" || !isFinite(rate) || rate < 0) { setErr("Enter a valid rate per piece."); return }
    if (form.given && form.back && form.back < form.given) { setErr("Expected back date cannot be before the assigned date."); return }
    setSaving(true); setErr("")
    const payload = {
      orderId: o.id, dorjiId: d.id, task: form.task.trim(), pieces: qty, ratePerPiece: rate,
      assignedDate: form.given || todayIso(), expectedCompletion: form.back || null, adminNotes: form.notes.trim() || null,
    }
    try {
      try {
        await tailorWorkshopApi.assign(payload)
      } catch (e: any) {
        if (e?.response?.status === 409 && window.confirm(e.response.data?.message || "This dorji is over capacity. Assign anyway?")) await tailorWorkshopApi.assign({ ...payload, force: true })
        else throw e
      }
      toast.success(`Assigned to ${d.name}`)
      setForm(blank()); refresh()
    } catch (e: any) {
      if (e?.response?.status !== 409) setErr(e?.response?.data?.message || "Could not assign the work.")
    } finally {
      setSaving(false)
    }
  }

  const patch = async (r: AssignmentRow, data: Parameters<typeof tailorWorkshopApi.patchAssignment>[1], okMsg?: string) => {
    try {
      const res = await tailorWorkshopApi.patchAssignment(r.id, data)
      if (okMsg) toast.success(okMsg)
      if (res.orderMovedBack) toast.success(`${r.orderNumber ?? "Order"} moved back to stitching`)
      if (res.orderAllDone && res.orderId && window.confirm(`All jobs for ${res.orderNumber} are done. Mark the order as ready?`)) {
        await tailorApi.updateOrderStatus(res.orderId, "ready", "All dorji jobs finished")
        toast.success("Order marked ready")
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not update the assignment")
    } finally {
      refresh()
    }
  }

  const setStatus = (r: AssignmentRow, v: TailorWorkStatus) => {
    if (v === r.workStatus) return
    if (v === "paid") { toast.error("Pay this job from Tailor payments."); return }
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
      toast.error("Could not load all assignments to print")
    } finally {
      setPrinting(false)
    }
  }

  const remove = async (r: AssignmentRow) => {
    if (!window.confirm(`Delete this assignment (${r.orderNumber ?? "order"} · ${r.task ?? "task"})?`)) return
    try {
      await tailorWorkshopApi.deleteAssignment(r.id)
      toast.success("Assignment deleted")
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not delete the assignment")
    } finally {
      refresh()
    }
  }

  const printCards = (list: AssignmentRow[]) => {
    if (!list.length) { toast.error("No assignments to print"); return }
    const body = list.map((r) => `<div class="card"><h2>${esc(r.orderNumber ?? "—")} · ${esc(r.task ?? "")}</h2>
      <table><tr><td>Customer</td><td>${esc(r.customerName ?? "—")}</td></tr><tr><td>Dorji</td><td>${esc(r.dorjiName ?? "—")}</td></tr>
      <tr><td>Pieces</td><td>${r.pieces}</td></tr><tr><td>Given</td><td>${esc(fmtD(r.assignedDate))}</td></tr><tr><td>Due back</td><td>${esc(fmtD(r.dueDate))}</td></tr>
      <tr><td>Rate per piece</td><td>${esc(formatCurrency(r.ratePerPiece))}</td></tr><tr><td>Dorji charge</td><td>${esc(formatCurrency(r.dorjiCharge))}</td></tr>
      ${r.adminNotes ? `<tr><td>Notes</td><td>${esc(r.adminNotes)}</td></tr>` : ""}</table></div>`).join("")
    const w = window.open("", "_blank")
    if (!w) { toast.error("Allow pop-ups to print job cards"); return }
    w.document.write(`<!doctype html><title>Job cards</title><style>body{font-family:sans-serif;padding:24px;color:#0E1525}.card{border:1px solid #D5DAE5;border-radius:8px;padding:12px 16px;margin-bottom:16px;page-break-inside:avoid}h2{margin:0 0 8px;font-size:16px}table{border-collapse:collapse;width:100%}td{padding:4px 8px;border-bottom:1px solid #EEF0F5;font-size:14px}td:first-child{color:#5B6478;width:140px}</style>${body}`)
    w.document.close(); w.focus(); w.print()
  }

  if (!canRead("TailorOrders")) return <AccessDenied />
  const total = pagination?.total ?? 0
  const un = stats?.firstUnassigned
  const rowChoices = (r: AssignmentRow) => dorjis.filter((d) => d.status === "active" || d.id === r.dorjiId)

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Assignments"
        description="Which dorji has which piece, when it is due back, and what you owe for it."
        actions={<Button type="button" variant="outline" onClick={printAll} disabled={printing}><Printer className="size-4" aria-hidden /> {printing ? "Preparing…" : "Print all job cards"}</Button>}
      />

      {stats && stats.unassignedOrders > 0 && un && canWrite("TailorOrders") && (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-foreground">
          <span><strong>{stats.unassignedOrders} {stats.unassignedOrders === 1 ? "order is" : "orders are"} not assigned yet:</strong>{" "}
            {un.orderNumber} · {un.garments} for {un.customerName || "customer"}{un.deliveryDate ? `, due ${fmtD(un.deliveryDate)}` : ""}{stats.unassignedOrders > 1 ? ` and ${stats.unassignedOrders - 1} more.` : "."}</span>
          <Button type="button" variant="outline" size="sm" onClick={pickUnassigned}>Assign now</Button>
          </AlertDescription>
        </Alert>
      )}
      {stats && (
        <Card className="flex-row flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
          <span><strong>Dorji pay pending:</strong> {formatCurrency(stats.payPending)} <span className="text-muted-foreground">across {stats.payPendingJobs} finished job(s)</span></span>
          <Button asChild variant="link" size="sm"><Link href="/dashboard/tailor/payments">Go to payments</Link></Button>
        </Card>
      )}

      {canWrite("TailorOrders") && (
        <SectionCard aria-label="Assign order" title="Assign work" contentClassName="flex flex-col gap-3">
          {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField className="min-w-0" label="Order" required htmlFor="assign-f1">
              <Select value={form.orderId || "__none"} onValueChange={(v) => pickOrder(v === "__none" ? "" : v)}>
                <SelectTrigger id="assign-f1" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select order…</SelectItem>
                  {orders.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.orderNumber} · {o.customerName || "Customer"} · {o.garments}</SelectItem>)}
                </SelectContent>
              </Select></FormField>
            <FormField className="min-w-0" label="Dorji" required htmlFor="assign-f2">
              <Select value={form.dorjiId || "__none"} onValueChange={(v) => pickDorji(v === "__none" ? "" : v)}>
                <SelectTrigger id="assign-f2" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Select dorji…</SelectItem>
                  {activeDorjis.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select></FormField>
            <FormField className="min-w-0" label="Task" required htmlFor="assign-f3"><Input id="assign-f3" value={form.task} onChange={(e) => set("task", e.target.value)} placeholder="e.g. Blouse stitching" /></FormField>
            <FormField className="min-w-0" label="Pieces" required htmlFor="assign-f4"><Input id="assign-f4" type="number" min="1" value={form.qty} onChange={(e) => set("qty", e.target.value)} /></FormField>
            <FormField className="min-w-0" label="Rate per piece" required htmlFor="assign-f5"><Input id="assign-f5" type="number" min="0" value={form.rate} onChange={(e) => set("rate", e.target.value)} /></FormField>
            <FormField className="min-w-0" label="Assigned on" htmlFor="assign-f6"><Input id="assign-f6" type="date" value={form.given} onChange={(e) => set("given", e.target.value)} /></FormField>
            <FormField className="min-w-0" label="Expected back" htmlFor="assign-f7"><Input id="assign-f7" type="date" value={form.back} min={form.given || undefined} onChange={(e) => set("back", e.target.value)} /></FormField>
            <FormField className="min-w-0" label="Dorji charge" htmlFor="assign-charge">
              <Input id="assign-charge" readOnly tabIndex={-1} value={formatCurrency(charge)} className="font-semibold tabular-nums" /></FormField>
            <FormField className="min-w-0" label="Notes for dorji" htmlFor="assign-f8"><Input id="assign-f8" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Fix collar, use hidden stitch" /></FormField>
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => { setForm(blank()); setErr("") }}>Clear</Button>
            <Button type="button" onClick={save} disabled={saving}>{saving ? "Assigning…" : "Assign"}</Button>
          </div>
        </SectionCard>
      )}

      <Card className="gap-0 py-0">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: stats?.counts[t.value] }))} />
        </div>
        <FilterBar className="gap-2.5 p-4">
          <InputGroup className="min-w-[220px] flex-1">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput type="search" aria-label="Search" placeholder="Search order or customer…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <Select value={dorjiF || "__all"} onValueChange={(v) => { setDorjiF(v === "__all" ? "" : v); setPage(1) }}>
            <SelectTrigger aria-label="Dorji"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__all">Dorji: All</SelectItem>{dorjis.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={dueF} onValueChange={(v) => { setDueF(v); setPage(1) }}>
            <SelectTrigger aria-label="Expected back"><SelectValue /></SelectTrigger>
            <SelectContent>{DUE_FILTERS.map((f) => <SelectItem key={f.v} value={f.v}>{f.label}</SelectItem>)}</SelectContent>
          </Select>
        </FilterBar>

        <div className="overflow-x-auto">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead><TableHead>Dorji</TableHead><TableHead>Given</TableHead>
                <TableHead>Due back</TableHead><TableHead>Work status</TableHead><TableHead>Dorji charge</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12" /></TableCell></TableRow>) :
                rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="whitespace-normal"><EmptyState className="p-4 md:p-6" title="No assignments found" description={qD || dorjiF || tab !== "all" || dueF !== "any" ? "No assignments match these filters." : "No assignments yet. Assign an order to a dorji above."} /></TableCell></TableRow>
                ) : rows.map((r) => {
                  const finished = r.workStatus === "completed" || r.workStatus === "paid"
                  const days = r.dueDate ? diffDays(r.dueDate) : null
                  const when = finished ? (r.workStatus === "paid" ? "Paid" : "Returned to shop") : days === null ? "" : days < 0 ? `Late ${-days}d` : days === 0 ? "Due today" : `In ${days}d`
                  const payState = r.workStatus === "paid" ? "Paid" : r.workStatus === "completed" ? (r.paidAmount > 0 ? `Payable ${formatCurrency(r.payable)}` : "Payable") : r.workStatus === "returned" ? "Held until fixed" : "When done"
                  const locked = r.workStatus === "paid" || !canWrite("TailorOrders")
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="align-top">
                        <div className="font-semibold">{r.orderNumber ?? "—"} · {r.task}{r.pieces ? ` · ${r.pieces} pcs` : ""}</div>
                        <div className="text-xs text-muted-foreground">{r.customerName ?? "—"}</div>
                        {r.adminNotes && <div className="mt-0.5 text-xs text-muted-foreground">{r.adminNotes}</div>}
                      </TableCell>
                      <TableCell className="align-top">
                        <Select disabled={locked} value={String(r.dorjiId)} onValueChange={(v) => patch(r, { dorjiId: Number(v) }, "Reassigned")}>
                          <SelectTrigger aria-label="Dorji" size="sm" className="max-w-[170px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {rowChoices(r).length === 0 || !rowChoices(r).some((d) => d.id === r.dorjiId) ? <SelectItem value={String(r.dorjiId)}>{r.dorjiName ?? "—"}</SelectItem> : null}
                            {rowChoices(r).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.status === "active" ? "" : ` (${d.status.replace("_", " ")})`}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">{fmtD(r.assignedDate)}</TableCell>
                      <TableCell className="align-top">
                        <Input type="date" aria-label="Expected back" disabled={locked} defaultValue={r.dueDate ?? ""} key={`${r.id}-${r.dueDate}`}
                          onBlur={(e) => { if ((e.target.value || null) !== (r.expectedCompletion ?? r.dueDate)) patch(r, { expectedCompletion: e.target.value || null }) }}
                          className="w-auto" />
                        <div className={cn("mt-0.5 text-xs font-semibold", finished ? "text-dash-success-fg" : days !== null && days < 0 ? "text-destructive" : "text-muted-foreground")}>{when}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select disabled={locked} value={r.workStatus} onValueChange={(v) => setStatus(r, v as TailorWorkStatus)}>
                          <SelectTrigger aria-label="Work status" size="sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned">Assigned</SelectItem><SelectItem value="in_progress">In progress</SelectItem><SelectItem value="completed">Done</SelectItem>
                            <SelectItem value="returned">Returned for fixing</SelectItem><SelectItem value="paid" disabled={r.workStatus !== "paid"}>Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="font-bold tabular-nums">{formatCurrency(r.dorjiCharge)}</div>
                        <div className={cn("text-xs", r.workStatus === "completed" ? "font-semibold text-amber-600" : r.workStatus === "paid" ? "text-dash-success-fg" : "text-muted-foreground")}>{payState}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content="Print job card"><Button type="button" variant="outline" size="icon" aria-label="Print job card" onClick={() => printCards([r])}><Printer className="size-4" /></Button></WithTooltip>
                          {canWrite("TailorOrders") && (
                            <WithTooltip content={r.workStatus === "paid" ? "Paid jobs cannot be deleted." : "Delete"}>
                              {r.workStatus === "paid"
                                ? <span tabIndex={0}><WithTooltip content="Delete assignment"><Button type="button" variant="destructive" size="icon" aria-label="Delete assignment" disabled><Trash2 className="size-4" /></Button></WithTooltip></span>
                                : <WithTooltip content="Delete assignment"><Button type="button" variant="destructive" size="icon" aria-label="Delete assignment" onClick={() => remove(r)}><Trash2 className="size-4" /></Button></WithTooltip>}
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
