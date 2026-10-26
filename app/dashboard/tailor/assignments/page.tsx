"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Printer, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
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
const WS_STYLE: Record<TailorWorkStatus, string> = {
  assigned: "bg-dash-neutral-soft text-dash-neutral-fg", in_progress: "bg-dash-accent-soft text-dash-accent-fg",
  completed: "bg-dash-success-soft text-dash-success-fg", returned: "bg-dash-danger-soft text-dash-danger-fg", paid: "bg-dash-neutral-soft text-dash-muted",
}
const DUE_FILTERS = [
  { v: "any", label: "Expected back: Any" }, { v: "overdue", label: "Overdue" }, { v: "today", label: "Due today" },
  { v: "week", label: "Next 7 days" },
]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const sel = "h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none"

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Assignments</h1>
          <p className="mt-1 text-sm text-dash-muted">Which dorji has which piece, when it is due back, and what you owe for it.</p>
        </div>
        <button type="button" onClick={printAll} disabled={printing} className={outlineBtn}><Printer className="size-4" aria-hidden /> {printing ? "Preparing…" : "Print all job cards"}</button>
      </div>

      {stats && stats.unassignedOrders > 0 && un && canWrite("TailorOrders") && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-amber-200 bg-dash-warn-soft px-4 py-3 text-sm text-dash-warn-fg">
          <span><strong>{stats.unassignedOrders} {stats.unassignedOrders === 1 ? "order is" : "orders are"} not assigned yet:</strong>{" "}
            {un.orderNumber} · {un.garments} for {un.customerName || "customer"}{un.deliveryDate ? `, due ${fmtD(un.deliveryDate)}` : ""}{stats.unassignedOrders > 1 ? ` and ${stats.unassignedOrders - 1} more.` : "."}</span>
          <button type="button" onClick={pickUnassigned} className="h-9 rounded-lg border border-current px-3 text-[13px] font-semibold">Assign now</button>
        </div>
      )}
      {stats && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-dash-border bg-dash-card px-4 py-3 text-sm">
          <span><strong>Dorji pay pending:</strong> {formatCurrency(stats.payPending)} <span className="text-dash-muted">across {stats.payPendingJobs} finished job(s)</span></span>
          <Link href="/dashboard/tailor/payments" className="text-[13px] font-semibold text-dash-accent hover:underline">Go to payments</Link>
        </div>
      )}

      {canWrite("TailorOrders") && (
        <section aria-label="Assign order" className="rounded-[14px] border border-dash-border bg-dash-card p-5">
          <h2 className="font-dash-display text-lg font-bold">Assign work</h2>
          {err && <p role="alert" className="mt-2 rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Order *
              <select className={input} value={form.orderId} onChange={(e) => pickOrder(e.target.value)}>
                <option value="">Select order…</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} · {o.customerName || "Customer"} · {o.garments}</option>)}
              </select></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Dorji *
              <select className={input} value={form.dorjiId} onChange={(e) => pickDorji(e.target.value)}>
                <option value="">Select dorji…</option>
                {activeDorjis.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Task *<input className={input} value={form.task} onChange={(e) => set("task", e.target.value)} placeholder="e.g. Blouse stitching" /></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Pieces *<input type="number" min="1" className={input} value={form.qty} onChange={(e) => set("qty", e.target.value)} /></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Rate per piece *<input type="number" min="0" className={input} value={form.rate} onChange={(e) => set("rate", e.target.value)} /></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Assigned on<input type="date" className={input} value={form.given} onChange={(e) => set("given", e.target.value)} /></label>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Expected back<input type="date" className={input} value={form.back} min={form.given || undefined} onChange={(e) => set("back", e.target.value)} /></label>
            <div className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Dorji charge
              <span className="flex h-[42px] items-center rounded-[10px] bg-dash-bg px-3 text-sm font-bold tabular-nums">{formatCurrency(charge)}</span></div>
            <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Notes for dorji<input className={input} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Fix collar, use hidden stitch" /></label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(blank()); setErr("") }} className={outlineBtn}>Clear</button>
            <button type="button" onClick={save} disabled={saving} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-60">{saving ? "Assigning…" : "Assign"}</button>
          </div>
        </section>
      )}

      <section className="rounded-[14px] border border-dash-border bg-dash-card">
        <div className="px-4">
          <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
            tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: stats?.counts[t.value] }))} />
        </div>
        <div className="flex flex-wrap items-center gap-2.5 p-4">
          <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
            <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
            <input type="search" placeholder="Search order or customer…" value={q} onChange={(e) => setQ(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
          </label>
          <select aria-label="Dorji" value={dorjiF} onChange={(e) => { setDorjiF(e.target.value); setPage(1) }} className={sel}>
            <option value="">Dorji: All</option>{dorjis.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select aria-label="Expected back" value={dueF} onChange={(e) => { setDueF(e.target.value); setPage(1) }} className={sel}>
            {DUE_FILTERS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead>
              <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                <th className="py-3 pl-4 pr-2 font-semibold">Job</th><th className="px-2 py-3 font-semibold">Dorji</th><th className="px-2 py-3 font-semibold">Given</th>
                <th className="px-2 py-3 font-semibold">Due back</th><th className="px-2 py-3 font-semibold">Work status</th><th className="px-2 py-3 font-semibold">Dorji charge</th>
                <th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-12 rounded" /></td></tr>) :
                rows.length === 0 ? (
                  <tr><td colSpan={7} className="py-12 text-center text-dash-muted">{qD || dorjiF || tab !== "all" || dueF !== "any" ? "No assignments match these filters." : "No assignments yet. Assign an order to a dorji above."}</td></tr>
                ) : rows.map((r) => {
                  const finished = r.workStatus === "completed" || r.workStatus === "paid"
                  const days = r.dueDate ? diffDays(r.dueDate) : null
                  const when = finished ? (r.workStatus === "paid" ? "Paid" : "Returned to shop") : days === null ? "" : days < 0 ? `Late ${-days}d` : days === 0 ? "Due today" : `In ${days}d`
                  const payState = r.workStatus === "paid" ? "Paid" : r.workStatus === "completed" ? (r.paidAmount > 0 ? `Payable ${formatCurrency(r.payable)}` : "Payable") : r.workStatus === "returned" ? "Held until fixed" : "When done"
                  const locked = r.workStatus === "paid" || !canWrite("TailorOrders")
                  return (
                    <tr key={r.id}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2 align-top">
                        <div className="font-semibold">{r.orderNumber ?? "—"} · {r.task}{r.pieces ? ` · ${r.pieces} pcs` : ""}</div>
                        <div className="text-xs text-dash-muted">{r.customerName ?? "—"}</div>
                        {r.adminNotes && <div className="mt-0.5 text-xs text-dash-muted">{r.adminNotes}</div>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 align-top">
                        <select aria-label="Dorji" disabled={locked} value={r.dorjiId} onChange={(e) => patch(r, { dorjiId: Number(e.target.value) }, "Reassigned")}
                          className="h-9 max-w-[170px] rounded-lg border border-dash-border bg-dash-card px-2 text-[13px] outline-none disabled:opacity-60">
                          {rowChoices(r).length === 0 || !rowChoices(r).some((d) => d.id === r.dorjiId) ? <option value={r.dorjiId}>{r.dorjiName ?? "—"}</option> : null}
                          {rowChoices(r).map((d) => <option key={d.id} value={d.id}>{d.name}{d.status === "active" ? "" : ` (${d.status.replace("_", " ")})`}</option>)}
                        </select>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 align-top text-dash-muted">{fmtD(r.assignedDate)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3 align-top">
                        <input type="date" aria-label="Expected back" disabled={locked} defaultValue={r.dueDate ?? ""} key={`${r.id}-${r.dueDate}`}
                          onBlur={(e) => { if ((e.target.value || null) !== (r.expectedCompletion ?? r.dueDate)) patch(r, { expectedCompletion: e.target.value || null }) }}
                          className="h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-[13px] outline-none disabled:opacity-60" />
                        <div className={cn("mt-0.5 text-xs font-semibold", finished ? "text-dash-success-fg" : days !== null && days < 0 ? "text-dash-danger-fg" : "text-dash-muted")}>{when}</div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 align-top">
                        <select aria-label="Work status" disabled={locked} value={r.workStatus} onChange={(e) => setStatus(r, e.target.value as TailorWorkStatus)}
                          className={cn("h-9 rounded-full border-0 px-3 text-xs font-bold outline-none disabled:opacity-80", WS_STYLE[r.workStatus])}>
                          <option value="assigned">Assigned</option><option value="in_progress">In progress</option><option value="completed">Done</option>
                          <option value="returned">Returned for fixing</option><option value="paid" disabled={r.workStatus !== "paid"}>Paid</option>
                        </select>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3 align-top">
                        <div className="font-bold tabular-nums">{formatCurrency(r.dorjiCharge)}</div>
                        <div className={cn("text-xs", r.workStatus === "completed" ? "font-semibold text-amber-600" : r.workStatus === "paid" ? "text-dash-success-fg" : "text-dash-muted")}>{payState}</div>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4 align-top">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label="Print job card" onClick={() => printCards([r])} className="flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"><Printer className="size-4" /></button>
                          {canWrite("TailorOrders") && <button type="button" aria-label="Delete assignment" title={r.workStatus === "paid" ? "Paid jobs cannot be deleted." : "Delete"} disabled={r.workStatus === "paid"} onClick={() => remove(r)} className="flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-danger-fg hover:bg-dash-danger-soft disabled:opacity-40"><Trash2 className="size-4" /></button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
        {!loading && total > 0 && (
          <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
            onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
        )}
      </section>
    </div>
  )
}
