"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Clock, Download, Pencil, Search, Scissors, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { PaginationControl } from "@/components/ui/pagination-control"
import { AccessDenied } from "@/components/ui/access-denied"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { tailorWorkshopApi, type DorjiRow, type DorjiStats, type Pagination, type TailorDorjiStatus } from "@/lib/tailorApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"

const SPECS = ["Shirt", "Panjabi", "Pant", "Pajama", "Jama", "Kurta", "Blouse", "Salwar Kameez", "Coat", "Embroidery"]
const STATUS_LABEL: Record<TailorDorjiStatus, string> = { active: "Active", on_leave: "On leave", inactive: "Inactive" }
const AVATARS = ["bg-dash-accent-soft text-dash-accent-fg", "bg-dash-success-soft text-dash-success-fg", "bg-purple-100 text-purple-800", "bg-dash-warn-soft text-dash-warn-fg"]
type Comm = "fixed" | "percentage" | "salary"
const COMMS: { id: Comm; label: string }[] = [
  { id: "fixed", label: "Per piece" }, { id: "percentage", label: "% of stitching" }, { id: "salary", label: "Monthly salary" },
]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
/** Bangladesh local digits (no +880 / leading 0) for the phone field; other numbers keep their digits. */
const localPhone = (p: string) => {
  const raw = (p || "").trim()
  const digits = raw.replace(/\D/g, "")
  if (raw.startsWith("+880") || digits.startsWith("880")) return digits.replace(/^880/, "")
  return digits.replace(/^0+/, "")
}
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"

interface FormState { name: string; phone: string; address: string; notes: string; spec: string[]; comm: Comm; commVal: string; cap: string; status: TailorDorjiStatus }
const blank = (): FormState => ({ name: "", phone: "", address: "", notes: "", spec: [], comm: "fixed", commVal: "", cap: "", status: "active" })

export default function DorjisPage() {
  const { canRead, canWrite, canDelete } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()

  const [rows, setRows] = useState<DorjiRow[]>([])
  const [stats, setStats] = useState<DorjiStats | null>(null)
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(12)

  const [form, setForm] = useState<FormState>(blank())
  const [editing, setEditing] = useState<DorjiRow | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setQD(q.trim()); setPage(1) }, 250); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    try {
      const r = await tailorWorkshopApi.getDorjiOverview({ search: qD || undefined, status: statusF !== "all" ? statusF : undefined, page, limit: perPage })
      setRows(r.rows); setStats(r.stats); setPagination(r.pagination)
    } catch {
      toast.error("Failed to load dorjis")
    } finally {
      setLoading(false)
    }
  }, [qD, statusF, page, perPage])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (d: DorjiRow | null) => {
    setEditing(d); setErr("")
    setForm(d ? {
      name: d.name, phone: localPhone(d.phone), address: d.address ?? "", notes: d.notes ?? "", spec: d.speciality, comm: d.commissionType,
      commVal: d.commissionValue ? String(d.commissionValue) : "", cap: d.maxPieces ? String(d.maxPieces) : "", status: d.status,
    } : blank())
  }

  const save = async () => {
    const name = form.name.trim(), phone = form.phone.replace(/\D/g, "")
    if (!name) { setErr("Name is required."); return }
    if (!phone) { setErr("Phone is required."); return }
    if (!/^[0-9]{6,15}$/.test(phone)) { setErr("Enter a valid phone number."); return }
    if (form.commVal !== "" && Number(form.commVal) < 0) { setErr("Amount cannot be negative."); return }
    if (form.cap !== "" && (Number(form.cap) < 0 || !Number.isInteger(Number(form.cap)))) { setErr("Max pieces must be a whole number."); return }
    setSaving(true); setErr("")
    try {
      await tailorWorkshopApi.saveDorji(editing?.id ?? null, {
        name, phone, address: form.address.trim(), notes: form.notes.trim(), speciality: form.spec,
        commissionType: form.comm, commissionValue: Number(form.commVal) || 0, maxPieces: form.cap ? Number(form.cap) : null, status: form.status,
      })
      toast.success(editing ? "Dorji updated" : "Dorji added")
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not save the dorji.")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (d: DorjiRow) => {
    const next: TailorDorjiStatus = d.status === "active" ? "inactive" : "active"
    try { await tailorWorkshopApi.patchDorji(d.id, { status: next }); toast.success(`${d.name} ${next === "active" ? "activated" : "deactivated"}`); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not update") }
  }

  const remove = async (d: DorjiRow) => {
    if (d.totalJobs) { toast.error(`${d.name} has ${d.totalJobs} assignment(s). Deactivate instead.`); return }
    if (!window.confirm(`Delete dorji "${d.name}"?`)) return
    try { await tailorWorkshopApi.deleteDorji(d.id); toast.success("Dorji deleted"); if (editing?.id === d.id) startEdit(null); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not delete") }
  }

  const handleExport = async () => {
    try {
      const all = await tailorWorkshopApi.getDorjiOverview({ search: qD || undefined, status: statusF !== "all" ? statusF : undefined, limit: 100 })
      exportToCSV(all.rows.map((d) => ({
        name: d.name, phone: localPhone(d.phone), address: d.address ?? "", skills: d.speciality.join(" / "), status: STATUS_LABEL[d.status],
        commission: d.commissionType === "percentage" ? `${d.commissionValue}%` : d.commissionType === "salary" ? `Salary ${d.commissionValue}` : "Per piece",
        rate: d.commissionType === "fixed" ? d.commissionValue : 0, inHand: d.piecesInHand, earnedMonth: d.earnedMonth, unpaid: d.unpaid, notes: d.notes ?? "",
      })), "dorjis", ["name", "phone", "address", "skills", "status", "commission", "rate", "inHand", "earnedMonth", "unpaid", "notes"])
    } catch { toast.error("Could not export") }
  }

  if (!canRead("TailorDorji")) return <AccessDenied />
  const monthLbl = new Date().toLocaleDateString("en-US", { month: "short" })
  const total = pagination?.total ?? 0
  const cur = formatCurrency(0).replace(/[\d.,\s]/g, "")
  const commLabel = form.comm === "fixed" ? `Amount per piece (${cur})` : form.comm === "percentage" ? "Percentage (%)" : `Salary per month (${cur})`
  const commHint = form.comm === "fixed" ? "e.g. 120 for each shirt finished" : form.comm === "percentage" ? "Share of the stitching charge, not fabric" : "Fixed pay; jobs are tracked for workload only"

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Dorjis</h1>
          <p className="mt-1 text-sm text-dash-muted">Your tailors — what they are good at, how busy they are, and what you owe them.</p>
        </div>
        <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
      </div>

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Active dorjis", value: stats.active, icon: <Users className="size-4" />, color: "blue", hint: `${stats.onLeave} on leave` },
          { label: "Pieces in hand", value: stats.piecesInHand, icon: <Scissors className="size-4" />, color: "purple", hint: `Capacity ${stats.capacity}` },
          { label: "Unpaid commission", value: formatCurrency(stats.unpaid), icon: <Clock className="size-4" />, color: "yellow", hint: "For finished pieces" },
          { label: "On-time rate", value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`, icon: <Check className="size-4" />, color: "green", hint: "Finished jobs" },
        ]} />
      )}

      <div className="flex flex-wrap gap-2.5">
        <label className="flex h-11 min-w-[260px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-dash-muted">
          <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
          <input type="search" placeholder="Search name, phone or speciality…" value={q} onChange={(e) => setQ(e.target.value)}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
        </label>
        <select aria-label="Status" value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1) }}
          className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-3 text-[13px] font-semibold outline-none">
          <option value="all">Status: All</option><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <section className="grid w-full min-w-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[300px] rounded-[14px]" />) :
            rows.length === 0 ? (
              <div className="col-span-full rounded-[14px] border border-dashed border-dash-border bg-dash-card p-8 text-center text-sm text-dash-muted">
                {qD || statusF !== "all" ? "No dorjis match these filters." : "No dorjis yet. Add your first tailor using the form."}
              </div>
            ) : rows.map((d, i) => {
              const act = d.status === "active"
              const lc = !act ? "bg-dash-muted/50" : d.workloadPct >= 100 ? "bg-dash-danger-fg" : d.workloadPct >= 75 ? "bg-amber-500" : "bg-dash-success-fg"
              const lt = !act ? "text-dash-muted" : d.workloadPct >= 100 ? "text-dash-danger-fg" : d.workloadPct >= 75 ? "text-amber-600" : "text-dash-success-fg"
              const comm = d.commissionType === "percentage" ? `${d.commissionValue}% of stitching` : d.commissionType === "salary" ? `${formatCurrency(d.commissionValue)} / month` : `Per piece ${formatCurrency(d.commissionValue)}`
              return (
                <article key={d.id} className={cn("flex flex-col gap-3 rounded-[14px] border bg-dash-card p-[18px]", editing?.id === d.id ? "border-dash-accent" : "border-dash-border")}>
                  <div className="flex items-center gap-3">
                    <span className={cn("flex size-[46px] shrink-0 items-center justify-center rounded-full font-bold", AVATARS[i % 4])}>{initials(d.name)}</span>
                    <div className="min-w-0 flex-1"><div className="truncate text-base font-bold">{d.name}</div><div className="truncate text-xs text-dash-muted">{d.phone} · {comm}</div></div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", act ? "bg-dash-success-soft text-dash-success-fg" : d.status === "on_leave" ? "bg-dash-accent-soft text-dash-accent-fg" : "bg-dash-neutral-soft text-dash-neutral-fg")}>{STATUS_LABEL[d.status]}</span>
                  </div>
                  {d.speciality.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{d.speciality.map((s) => <span key={s} className="rounded-full bg-dash-neutral-soft px-2.5 py-[3px] text-xs font-semibold text-dash-neutral-fg">{s}</span>)}</div>
                  )}
                  {d.notes && <div className="text-xs text-dash-muted">{d.notes}</div>}
                  <div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-dash-muted">Workload · {d.activeOrders} active order(s)</span>
                      <strong className={lt}>{d.piecesInHand}{d.maxPieces ? ` / ${d.maxPieces}` : ""} pieces</strong>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-dash-neutral-soft"><div className={cn("h-full rounded-full", lc)} style={{ width: `${Math.min(100, d.workloadPct)}%` }} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-[10px] bg-dash-bg p-2"><div className="text-[11px] text-dash-muted">Earned ({monthLbl})</div><div className="font-bold tabular-nums">{formatCurrency(d.earnedMonth)}</div></div>
                    <div className={cn("rounded-[10px] p-2", d.unpaid ? "bg-dash-warn-soft text-dash-warn-fg" : "bg-dash-bg")}><div className={cn("text-[11px]", d.unpaid ? "" : "text-dash-muted")}>Unpaid</div><div className="font-bold tabular-nums">{formatCurrency(d.unpaid)}</div></div>
                    <div className="rounded-[10px] bg-dash-bg p-2"><div className="text-[11px] text-dash-muted">On time</div><div className="font-bold">{d.onTimeRate === null ? "—" : `${d.onTimeRate}%`}</div></div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      {canWrite("TailorDorji") && <button type="button" aria-label={`Edit ${d.name}`} onClick={() => startEdit(d)} className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"><Pencil className="size-4" /></button>}
                      {canWrite("TailorDorji") && <button type="button" onClick={() => toggleActive(d)} className="h-[38px] min-w-0 flex-1 whitespace-nowrap rounded-lg border border-dash-border bg-dash-card px-2.5 text-xs font-semibold hover:bg-dash-neutral-soft">{act ? "Deactivate" : "Activate"}</button>}
                      {canDelete("TailorDorji") && <button type="button" aria-label={`Delete ${d.name}`} onClick={() => remove(d)} className="flex size-[38px] shrink-0 items-center justify-center rounded-lg border border-dash-border bg-dash-card hover:bg-dash-neutral-soft"><Trash2 className="size-4" /></button>}
                    </div>
                    <div className="flex gap-1.5">
                      <Link href={`/dashboard/tailor/assignments?dorji=${d.id}`} className="flex h-[38px] min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg border border-dash-border text-[13px] font-semibold hover:bg-dash-neutral-soft">View jobs</Link>
                      <Link href="/dashboard/tailor/payments" className="flex h-[38px] min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-lg bg-dash-ink text-[13px] font-semibold text-white">Pay&nbsp;{formatCurrency(d.unpaid)}</Link>
                    </div>
                  </div>
                </article>
              )
            })}
          {!loading && total > 0 && (
            <div className="col-span-full rounded-[14px] border border-dash-border bg-dash-card p-4">
              <PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </div>
          )}
        </section>

        {canWrite("TailorDorji") && (
          <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[380px]">
            <div>
              <h2 className="font-dash-display text-lg font-bold">{editing ? "Edit dorji" : "Add dorji"}</h2>
              {err && <p role="alert" className="mt-2 rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Name *<input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Phone *
                <span className="flex h-[42px] items-center overflow-hidden rounded-[10px] border border-dash-border bg-dash-card focus-within:border-dash-accent">
                  <span className="flex h-full items-center border-r border-dash-border bg-dash-bg px-3 text-sm font-semibold text-dash-muted">+880</span>
                  <input type="tel" inputMode="numeric" className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 text-sm font-normal outline-none" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="17XX-XXXXXX" />
                </span></label>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Specialities
              <div role="group" aria-label="Specialities" className="flex flex-wrap gap-1.5">
                {[...SPECS, ...form.spec.filter((s) => !SPECS.includes(s))].map((s) => {
                  const on = form.spec.includes(s)
                  return (
                    <button key={s} type="button" aria-pressed={on} onClick={() => set("spec", on ? form.spec.filter((x) => x !== s) : [...form.spec, s])}
                      className={cn("h-[38px] rounded-full border px-3 text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                      {on ? "✓ " : "+ "}{s}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-semibold">How you pay
              <div role="radiogroup" aria-label="Commission type" className="grid grid-cols-3 gap-1.5">
                {COMMS.map((o) => (
                  <button key={o.id} type="button" role="radio" aria-checked={form.comm === o.id} onClick={() => set("comm", o.id)}
                    className={cn("min-h-11 rounded-[10px] border-2 px-2 py-1.5 text-[13px] font-bold", form.comm === o.id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{o.label}</button>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">{commLabel}
              <input type="number" min="0" className={input} value={form.commVal} onChange={(e) => set("commVal", e.target.value)} />
              <span className="text-xs font-normal text-dash-muted">{commHint}</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Max pieces at once<input type="number" min="0" className={input} value={form.cap} onChange={(e) => set("cap", e.target.value)} placeholder="e.g. 8" /></label>
              <label className="flex min-w-0 flex-col gap-1.5 text-[13px] font-semibold">Status
                <select className={input} value={form.status} onChange={(e) => set("status", e.target.value as TailorDorjiStatus)}>
                  <option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Address<input className={input} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Area, city" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Notes<textarea rows={2} className="w-full resize-y rounded-[10px] border border-dash-border bg-dash-card px-3 py-2.5 text-sm font-normal outline-none focus-visible:border-dash-accent" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional — e.g. only works mornings, rush jobs OK" /></label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => startEdit(null)} className={outlineBtn}>Clear</button>
              <button type="button" onClick={save} disabled={saving} className="h-11 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add dorji"}</button>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
