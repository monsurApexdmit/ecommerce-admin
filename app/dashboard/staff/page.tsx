"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Ban, CheckCircle2, Clock, Download, Eye, Pencil, Search, Trash2, UserCheck, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import staffApi, { staffUiApi, type StaffOverview, type StaffRow, type StaffSalarySummary } from "@/lib/staffApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "all" | "Active" | "Invited" | "On leave" | "Inactive"
const TABS: Tab[] = ["all", "Active", "Invited", "On leave", "Inactive"]
const STATUS_STYLE: Record<string, string> = {
  Active: "bg-dash-success-soft text-dash-success-fg", Invited: "bg-dash-warn-soft text-dash-warn-fg",
  "On leave": "bg-dash-accent-soft text-dash-accent-fg", Inactive: "bg-dash-neutral-soft text-dash-neutral-fg",
}
const PAY_METHODS = ["Cash", "bKash", "Bank transfer", "Check"]
const STATUSES = ["Active", "Invited", "On leave", "Inactive"]

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const iconBtn = "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
const lastActive = (iso: string | null) => {
  if (!iso) return "Never"
  const t = new Date(iso), now = new Date()
  if (now.getTime() - t.getTime() < 5 * 6e4) return "Online now"
  const time = t.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()
  const dayDiff = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()) / 864e5)
  if (dayDiff === 0) return `Today, ${time}`
  if (dayDiff === 1) return `Yesterday, ${time}`
  return `${t.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}
const apiError = (e: any, fallback: string) => {
  const errs = e?.response?.data?.errors
  if (errs && typeof errs === "object") { const first = Object.values(errs).flat()[0]; if (first) return String(first) }
  return e?.response?.data?.message || fallback
}
const PHONE_RE = /^\+?[0-9][0-9\s\-()]{5,19}$/
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
const fmtD = (d?: string | null) => (d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

interface FormState {
  name: string; phone: string; roleId: string; loginMethod: "email" | "pin"; email: string; pin: string; locationIds: number[]
  joined: string; salary: string; method: string; account: string; status: string; nid: string; emergency: string
}
const blank = (): FormState => ({ name: "", phone: "", roleId: "", loginMethod: "email", email: "", pin: "", locationIds: [], joined: new Date().toISOString().slice(0, 10), salary: "", method: "Cash", account: "", status: "Active", nid: "", emergency: "" })

export default function StaffPage() {
  const { formatCurrency } = useCompanySettings()
  const blocked = useModuleGuard("Staff")

  const [data, setData] = useState<StaffOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [roleF, setRoleF] = useState("all")
  const [locF, setLocF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [form, setForm] = useState<FormState>(blank())
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const [viewing, setViewing] = useState<StaffRow | null>(null)
  const [salary, setSalary] = useState<StaffSalarySummary | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])

  const load = useCallback(async () => {
    try {
      setData(await staffUiApi.getOverview({
        search: qD || undefined, status: tab !== "all" ? tab : undefined,
        role_id: roleF !== "all" ? Number(roleF) : undefined, location_id: locF !== "all" ? Number(locF) : undefined,
      }))
    } catch {
      setData(null)
      toast.error("Failed to load staff")
    } finally {
      setLoading(false)
    }
  }, [qD, tab, roleF, locF])
  useEffect(() => { load() }, [load])

  const rows = data?.rows ?? []
  const pageRows = rows.slice((page - 1) * perPage, page * perPage)
  const roles = data?.roles ?? []
  const locations = data?.locations ?? []
  const stats = data?.stats

  const isOwnerRole = (id: string | number) => !!roles.find((r) => String(r.id) === String(id))?.isOwner
  const pickableRoles = roles.filter((r) => !r.isOwner || (editing && editing.roleId === r.id))
  const roleMethod = (id: string) => (/cashier/i.test(roles.find((r) => String(r.id) === id)?.name ?? "") ? "pin" : "email") as "email" | "pin"

  // Defaults for a new member: Cashier role, PIN sign-in, first location.
  const [defaulted, setDefaulted] = useState(false)
  useEffect(() => {
    if (defaulted || !data || editing) return
    const cashier = data.roles.find((r) => /cashier/i.test(r.name) && !r.isOwner) ?? data.roles.find((r) => !r.isOwner)
    setForm((f) => ({
      ...f, roleId: f.roleId || (cashier ? String(cashier.id) : ""),
      loginMethod: cashier && !f.roleId ? roleMethod(String(cashier.id)) : f.loginMethod,
      locationIds: f.locationIds.length ? f.locationIds : data.locations[0] ? [data.locations[0].id] : [],
    }))
    setDefaulted(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editing, defaulted])

  const atSeatLimit = !editing && !!stats && stats.seatLimit != null && stats.seatsUsed >= stats.seatLimit

  const set = (k: keyof FormState, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const startEdit = (r: StaffRow | null) => {
    setEditing(r); setErr(""); setViewing(null)
    if (!r) setDefaulted(false)
    setForm(r ? {
      name: r.name, phone: r.phone ?? "", roleId: r.roleId ? String(r.roleId) : "", loginMethod: (r.loginMethod as "email" | "pin") ?? "email", email: r.email ?? "", pin: "",
      locationIds: r.locationIds, joined: (r.joiningDate ?? "").slice(0, 10), salary: r.salary ? String(r.salary) : "", method: r.paymentMethod || "Cash",
      account: r.account ?? "", status: r.status, nid: r.nid ?? "", emergency: r.emergencyContact ?? "",
    } : blank())
  }

  const openView = async (r: StaffRow) => {
    setViewing(r); setSalary(null)
    try { setSalary(await staffUiApi.getSalarySummary(r.id)) } catch { setSalary(null) }
  }

  const reloadSalary = async (id: number) => { try { setSalary(await staffUiApi.getSalarySummary(id)) } catch { /* keep previous */ } load() }
  const payOne = async (paymentId: number) => {
    if (!viewing) return
    setPayBusy(true)
    try { await staffUiApi.payPayment(paymentId); toast.success("Salary paid"); await reloadSalary(viewing.id) }
    catch (e: any) { toast.error(apiError(e, "Could not pay this salary")) } finally { setPayBusy(false) }
  }
  const payAllDue = async () => {
    if (!viewing || !salary) return
    const due = salary.history.filter((h) => h.canPay)
    if (!window.confirm(`Pay ${due.length} due salar${due.length === 1 ? "y" : "ies"} (${formatCurrency(due.reduce((a, h) => a + h.net, 0))}) to ${viewing.name}?`)) return
    setPayBusy(true)
    let failed = 0
    for (const h of due) { try { await staffUiApi.payPayment(h.id) } catch { failed++ } }
    failed ? toast.error(`${failed} payment${failed === 1 ? "" : "s"} failed`) : toast.success("All due salaries paid")
    await reloadSalary(viewing.id); setPayBusy(false)
  }
  const generateThisMonth = async () => {
    if (!viewing) return
    setPayBusy(true)
    try { await staffUiApi.generatePayroll(monthKey()); toast.success(`${monthLabel} salary generated`); await reloadSalary(viewing.id) }
    catch (e: any) { toast.error(apiError(e, "Could not generate salary")) } finally { setPayBusy(false) }
  }
  const monthLabel = new Date().toLocaleDateString("en-US", { month: "long" })

  const save = async () => {
    if (atSeatLimit) { setErr(`Your plan allows ${stats?.seatLimit} team members. Upgrade your plan to add more.`); return }
    if (!form.name.trim()) { setErr("Enter the person's full name."); return }
    if (!form.phone.trim()) { setErr("Enter a phone number."); return }
    if (!PHONE_RE.test(form.phone.trim())) { setErr("Enter a valid phone number (digits only, 6-20 characters)."); return }
    const digits = (v?: string | null) => (v ?? "").replace(/\D+/g, "")
    const dupPhone = rows.some((r) => r.id !== editing?.id && digits(r.phone) && (digits(r.phone) === digits(form.phone) || digits(r.phone) === `880${digits(form.phone).replace(/^0/, "")}`))
    if (dupPhone) { setErr("This phone number is already used by another team member."); return }
    if (form.email.trim() && rows.some((r) => r.id !== editing?.id && r.email?.toLowerCase() === form.email.trim().toLowerCase())) { setErr("This email is already used by another team member."); return }
    if (!form.roleId) { setErr("Pick a role."); return }
    if (form.loginMethod === "email" && !/^\S+@\S+\.\S+$/.test(form.email.trim())) { setErr("Enter a valid email address."); return }
    if (form.loginMethod === "pin" && !editing && !/^\d{4}$/.test(form.pin)) { setErr("The POS PIN must be exactly 4 digits."); return }
    if (form.loginMethod === "pin" && form.pin && !/^\d{4}$/.test(form.pin)) { setErr("The POS PIN must be exactly 4 digits."); return }
    setSaving(true); setErr("")
    try {
      const body = {
        name: form.name.trim(), phone: form.phone.trim(), contact: form.phone.trim(), staffRoleId: Number(form.roleId),
        loginMethod: form.loginMethod, email: form.loginMethod === "email" ? form.email.trim() : form.email.trim() || undefined,
        pin: form.loginMethod === "pin" && form.pin ? form.pin : undefined, locationIds: form.locationIds,
        joiningDate: form.joined || undefined, ...(editing ? {} : { published: true }), salary: form.salary ? Number(form.salary) : 0, paymentMethod: form.method,
        account: form.account.trim(), bankAccount: form.account.trim(), status: form.status, nid: form.nid.trim(), emergencyContact: form.emergency.trim(),
      }
      if (editing) await staffApi.update(editing.id, body as any)
      else await staffApi.create(body as any)
      toast.success(editing ? "Staff member updated" : form.loginMethod === "email" ? "Staff member added — invite sent" : "Staff member added")
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(apiError(e, "Could not save the staff member."))
    } finally {
      setSaving(false)
    }
  }

  const togglePublished = async (r: StaffRow) => {
    try { await staffApi.update(r.id, { published: !r.published } as any); load() } catch (e: any) { toast.error(apiError(e, "Could not update")) }
  }
  const toggleActive = async (r: StaffRow) => {
    const next = r.status === "Inactive" ? "Active" : "Inactive"
    if (next === "Inactive" && !window.confirm(`Deactivate ${r.name}? They will not be able to sign in.`)) return
    try { await staffApi.update(r.id, { status: next } as any); toast.success(`${r.name} ${next === "Active" ? "reactivated" : "deactivated"}`); load() }
    catch (e: any) { toast.error(apiError(e, "Could not update")) }
  }
  const remove = async (r: StaffRow) => {
    if (!window.confirm(`Delete ${r.name}? This cannot be undone.`)) return
    try { await staffApi.delete(r.id); toast.success("Staff member deleted"); if (editing?.id === r.id) startEdit(null); load() }
    catch (e: any) { toast.error(apiError(e, "Could not delete")) }
  }
  const resend = async (r: StaffRow) => {
    try { await staffUiApi.resendInvite(r.id); toast.success(`Invite sent to ${r.email}`) } catch (e: any) { toast.error(e?.response?.data?.message || "Could not resend the invite") }
  }

  const handleExport = () => {
    exportToCSV(rows.map((r) => ({
      name: r.name, email: r.email ?? "", phone: r.phone ?? "", role: r.roleName ?? "", locations: r.locationNames.join("; "), salary: r.salary,
      payBy: r.paymentMethod ?? "", joined: r.joiningDate ?? "", status: r.status, lastActive: r.lastActiveAt ?? "",
    })), "staff", ["name", "email", "phone", "role", "locations", "salary", "payBy", "joined", "status", "lastActive"])
  }

  if (blocked) return blocked

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Staff</h1>
          <p className="mt-1 text-sm text-dash-muted">Your team, what they can access, and where they work.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setActivityOpen(true)} className={outlineBtn}>Activity log</button>
          <button type="button" onClick={handleExport} className={outlineBtn}><Download className="size-4" aria-hidden /> Export</button>
        </div>
      </div>

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px] rounded-[14px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Team members", value: stats.total, icon: <Users className="size-4" />, color: "blue", hint: `${stats.owners} owner · ${stats.staffCount} staff` },
          { label: "Active today", value: stats.activeToday, icon: <UserCheck className="size-4" />, color: "green", hint: stats.activeToday ? stats.activeTodayNames.join(", ") : "Nobody yet" },
          { label: "Inactive", value: stats.inactive, icon: <Ban className="size-4" />, color: "red", hint: "Deactivated accounts", onClick: () => { setTab("Inactive"); setPage(1) }, active: tab === "Inactive" },
          { label: "Invites pending", value: stats.invited, icon: <Clock className="size-4" />, color: "yellow", hint: stats.invited ? `${stats.firstInvitedName ?? "Someone"} hasn’t logged in` : "All invites accepted", onClick: () => { setTab("Invited"); setPage(1) }, active: tab === "Invited" },
          { label: "Monthly payroll", value: formatCurrency(stats.monthlyPayroll), icon: <Wallet className="size-4" />, color: "purple", hint: "Active team salaries" },
        ]} />
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={TABS.map((t) => ({ value: t, label: t === "all" ? "All" : t, count: data?.counts[t] }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search staff</span>
              <input type="search" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Role" value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1) }} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none">
              <option value="all">Role: All</option>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <select aria-label="Location" value={locF} onChange={(e) => { setLocF(e.target.value); setPage(1) }} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none">
              <option value="all">Location: All</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <button type="button" onClick={() => { setQ(""); setRoleF("all"); setLocF("all"); setTab("all"); setPage(1) }} className={outlineBtn}>Reset</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-4 pr-2 font-semibold">Person</th><th className="px-2 py-3 font-semibold">Role</th><th className="px-2 py-3 font-semibold">Location</th>
                  <th className="px-2 py-3 font-semibold">Salary</th><th className="px-2 py-3 font-semibold">Last active</th><th className="px-2 py-3 font-semibold">Status</th>
                  <th className="px-2 py-3 font-semibold">Published</th><th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-12 rounded" /></td></tr>) :
                  pageRows.length === 0 ? (
                    <tr><td colSpan={8} className="py-14 text-center">
                      <Users className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      <p className="font-semibold">No staff found</p>
                      <p className="text-sm text-dash-muted">{qD || tab !== "all" || roleF !== "all" || locF !== "all" ? "Try clearing the filters." : "Add your first team member with the form."}</p>
                    </td></tr>
                  ) : pageRows.map((r) => (
                    <tr key={r.id} className={editing?.id === r.id ? "bg-dash-accent-soft/40" : ""}>
                      <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">{initials(r.name)}</span>
                          <span className="flex min-w-0 flex-col"><span className="font-semibold">{r.name}</span><span className="truncate text-xs text-dash-muted">{[r.email, r.phone].filter(Boolean).join(" · ") || "—"}</span></span>
                        </div>
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-semibold">{r.roleName ?? "No role"}</span></td>
                      <td className="border-b border-dash-border-soft px-2 py-3">{r.locationNames.join(", ") || "All locations"}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3"><div className="tabular-nums">{r.salary ? formatCurrency(r.salary) : "—"}</div><div className="text-xs text-dash-muted">{r.paymentMethod ?? ""}</div></td>
                      <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{lastActive(r.lastActiveAt)}</td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS_STYLE[r.status] ?? STATUS_STYLE.Inactive)}>{r.status}</span>
                        {r.invited && r.email && <div><button type="button" onClick={() => resend(r)} className="text-xs font-semibold text-dash-accent hover:underline">Resend invite</button></div>}
                      </td>
                      <td className="border-b border-dash-border-soft px-2 py-3">
                        <button type="button" role="switch" aria-checked={r.published} aria-label={`Published: ${r.name}`} disabled={!!r.isOnlyOwner} onClick={() => togglePublished(r)}
                          className={cn("flex h-5 w-9 items-center rounded-full p-0.5", r.published ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></button>
                      </td>
                      <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                        <div className="flex justify-end gap-1">
                          <button type="button" aria-label={`View ${r.name}`} className={iconBtn} onClick={() => openView(r)}><Eye className="size-4" /></button>
                          <button type="button" aria-label={`Edit ${r.name}`} className={iconBtn} onClick={() => startEdit(r)}><Pencil className="size-4" /></button>
                          <button type="button" disabled={!!r.isOnlyOwner} aria-label={r.status === "Inactive" ? "Reactivate" : "Deactivate"} title={r.isOnlyOwner ? "The only Owner cannot be deactivated" : r.status === "Inactive" ? "Reactivate" : "Deactivate"} className={cn(iconBtn, "disabled:cursor-not-allowed disabled:opacity-40")} onClick={() => toggleActive(r)}>
                            {r.status === "Inactive" ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
                          </button>
                          <button type="button" disabled={!!r.isOnlyOwner} aria-label={`Delete ${r.name}`} title={r.isOnlyOwner ? "The only Owner cannot be removed" : undefined} className={cn(iconBtn, "disabled:cursor-not-allowed disabled:opacity-40")} onClick={() => remove(r)}><Trash2 className="size-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
          {stats && <div className="border-t border-dash-border-soft px-4 py-3 text-xs text-dash-muted">{stats.seatsUsed} of {stats.seatLimit ?? "unlimited"} seats used{atSeatLimit ? " · limit reached" : ""}</div>}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:w-[400px]">
          {viewing && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-dash-border bg-dash-bg p-3.5">
              <div className="flex items-center justify-between"><h2 className="font-dash-display text-base font-bold">Staff details</h2><button type="button" onClick={() => setViewing(null)} className="text-[13px] font-semibold text-dash-accent">Close</button></div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-11 items-center justify-center rounded-xl bg-dash-accent-soft font-bold text-dash-accent-fg">{initials(viewing.name)}</span>
                <span className="flex flex-col"><span className="font-semibold">{viewing.name}</span><span className="text-xs text-dash-muted">{viewing.roleName ?? "No role"}</span></span>
              </div>
              {([["Email", viewing.email], ["Phone", viewing.phone], ["Sign in", viewing.loginMethod === "pin" ? "POS PIN" : "Email link"], ["Locations", viewing.locationNames.join(", ") || "All locations"],
                ["Joined", fmtD(viewing.joiningDate)], ["Pay", `${viewing.salary ? formatCurrency(viewing.salary) : "—"} · ${viewing.paymentMethod ?? ""}`], ["Account", viewing.account], ["NID", viewing.nid], ["Emergency contact", viewing.emergencyContact], ["Status", viewing.status], ["Published", viewing.published ? "Yes" : "No"], ["Last active", lastActive(viewing.lastActiveAt)]] as [string, string | null][]).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 text-[13px]"><span className="text-dash-muted">{k}</span><span className="text-right font-semibold">{v || "—"}</span></div>
              ))}
              <div className="mt-1 flex flex-col gap-2 border-t border-dash-border-soft pt-2.5">
                <div className="flex items-center justify-between"><span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Salary</span><Link href={`/dashboard/staff/salary?staff=${viewing.id}`} className="text-xs font-semibold text-dash-accent hover:underline">Open in Salary management →</Link></div>
                {!salary ? <Skeleton className="h-16 rounded-lg" /> : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[["Monthly", salary.monthly], ["Paid this year", salary.paidThisYear], ["Due now", salary.dueNow]].map(([l, v]) => (
                        <div key={l as string} className="rounded-lg bg-dash-card px-2 py-1.5"><div className="text-[11px] text-dash-muted">{l}</div><div className="text-sm font-bold tabular-nums">{formatCurrency(Number(v))}</div></div>
                      ))}
                    </div>
                    {salary.history.length === 0 ? <p className="text-xs text-dash-muted">No salary records yet.</p> : salary.history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex flex-col"><span className="font-semibold">{h.label}</span><span className="text-xs text-dash-muted">{h.detail}</span></span>
                        <span className="flex items-center gap-2"><strong className="tabular-nums">{formatCurrency(h.net)}</strong>
                          <span className={cn("rounded-full px-2 py-px text-[11px] font-bold", h.status === "paid" ? "bg-dash-success-soft text-dash-success-fg" : "bg-dash-warn-soft text-dash-warn-fg")}>{h.status}</span>
                          {h.canPay && <button type="button" disabled={payBusy} onClick={() => payOne(h.id)} className="rounded-md bg-dash-accent px-2 py-0.5 text-[11px] font-semibold text-white disabled:opacity-40">Pay</button>}</span>
                      </div>
                    ))}
                    {(() => {
                      const dueCount = salary.history.filter((h) => h.canPay).length
                      const hasThisMonth = salary.history.some((h) => h.month === monthKey())
                      const canGenerate = !hasThisMonth && salary.monthly > 0 && viewing.status === "Active"
                      if (!dueCount && !canGenerate) return null
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {canGenerate && <button type="button" disabled={payBusy} onClick={generateThisMonth} className={cn(outlineBtn, "h-9 text-xs")}>Generate {monthLabel} salary</button>}
                          {dueCount > 0 && <button type="button" disabled={payBusy} onClick={payAllDue} className="h-9 rounded-[10px] bg-dash-accent px-3 text-xs font-semibold text-white disabled:opacity-40">Pay all due{dueCount > 1 ? ` (${dueCount})` : ""}</button>}
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </div>
          )}

          <div><h2 className="font-dash-display text-lg font-bold">{editing ? `Edit ${editing.name}` : "Add team member"}</h2>
            {err && <p role="alert" className="mt-2 rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}</div>
          {atSeatLimit && <p role="alert" className="rounded-[10px] bg-dash-warn-soft px-3 py-2 text-[13px] font-semibold text-dash-warn-fg">All {stats?.seatLimit} seats on your plan are used. <Link href="/dashboard/billing/plans" className="underline">Upgrade your plan</Link> to add more team members.</p>}
          {editing?.isOnlyOwner && <p className="rounded-[10px] bg-dash-neutral-soft px-3 py-2 text-xs text-dash-muted">You are the only Owner, so this role and status are locked. Make someone else an Owner first to change them.</p>}
          <div className="grid grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Full name *<input className={input} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Rafiq Khan" /></label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Phone *
              <span className="flex h-[42px] items-center overflow-hidden rounded-[10px] border border-dash-border bg-dash-card focus-within:border-dash-accent"><span className="border-r border-dash-border px-2.5 text-sm text-dash-muted">+880</span>
                <input type="tel" className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm font-normal outline-none" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="17XX-XXXXXX" /></span></label>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Role *
            <div className="flex flex-wrap gap-1.5">
              {pickableRoles.map((r) => (
                <button key={r.id} type="button" disabled={!!editing?.isOnlyOwner} aria-pressed={form.roleId === String(r.id)} title={r.description ?? undefined} onClick={() => setForm((f) => ({ ...f, roleId: String(r.id), loginMethod: roleMethod(String(r.id)) }))}
                  className={cn("flex flex-col items-start rounded-[10px] border-2 px-3 py-1.5 text-left", form.roleId === String(r.id) ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                  <span className="text-[13px] font-semibold">{r.name}</span>{r.description && <span className="max-w-[170px] text-[11px] font-normal opacity-80">{r.description}</span>}<span className="text-[11px] font-normal opacity-80">{r.memberCount} member{r.memberCount === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
            <Link href="/dashboard/staff/roles" className="text-xs font-semibold text-dash-accent hover:underline">See exactly what each role can do →</Link>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">How they sign in
            <div role="radiogroup" aria-label="Login method" className="grid grid-cols-2 gap-2">
              {([["email", "Email link", "They set their own password"], ["pin", "POS PIN", "Cashiers, no email needed"]] as const).map(([id, label, sub]) => (
                <button key={id} type="button" role="radio" aria-checked={form.loginMethod === id} onClick={() => set("loginMethod", id)}
                  className={cn("flex flex-col rounded-[10px] border-2 px-3 py-2 text-left", form.loginMethod === id ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>
                  <span className="text-[13px] font-semibold">{label}</span><span className="text-[11px] font-normal opacity-80">{sub}</span></button>
              ))}
            </div>
          </div>
          {form.loginMethod === "email" ? (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Email *<input type="email" className={input} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
              <span className="text-xs font-normal text-dash-muted">They get a link to set their own password. You never see it.</span></label>
          ) : (
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">4-digit POS PIN<input inputMode="numeric" maxLength={4} className={input} value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} placeholder={editing?.hasPin ? "Leave blank to keep the current PIN" : "e.g. 4821"} />
              <span className="text-xs font-normal text-dash-muted">For cashiers who only use the POS. No email needed.</span></label>
          )}
          <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Can work at
            <div role="group" aria-label="Locations" className="flex flex-wrap gap-1.5">
              {locations.map((l) => {
                const on = form.locationIds.includes(l.id)
                return <button key={l.id} type="button" aria-pressed={on} onClick={() => set("locationIds", on ? form.locationIds.filter((x) => x !== l.id) : [...form.locationIds, l.id])}
                  className={cn("h-9 rounded-full border px-3 text-[13px] font-semibold", on ? "border-dash-accent bg-dash-accent-soft text-dash-accent-fg" : "border-dash-border bg-dash-card")}>{l.name}</button>
              })}
            </div>
          </div>
          <details className="rounded-xl border border-dash-border-soft">
            <summary className="cursor-pointer px-3.5 py-3 text-[13px] font-bold">Pay &amp; employment</summary>
            <div className="flex flex-col gap-3 px-3.5 pb-3.5">
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Joining date<input type="date" className={input} value={form.joined} onChange={(e) => set("joined", e.target.value)} /></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Monthly salary (৳)<input type="number" min={0} className={input} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="0" /></label>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Paid by<select className={input} value={form.method} onChange={(e) => set("method", e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Account / wallet no.<input className={input} value={form.account} onChange={(e) => set("account", e.target.value)} placeholder="Optional" /></label>
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Status<select className={input} disabled={!!editing?.isOnlyOwner} value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">NID number<input className={input} value={form.nid} onChange={(e) => set("nid", e.target.value)} placeholder="Optional" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Emergency contact<input className={input} value={form.emergency} onChange={(e) => set("emergency", e.target.value)} placeholder="Name and phone (optional)" /></label>
            </div>
          </details>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => startEdit(null)} className={outlineBtn}>Clear</button>
            <button type="button" disabled={saving || atSeatLimit} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              {saving ? "Saving…" : editing ? "Save changes" : form.loginMethod === "email" ? "Add & send invite" : "Add team member"}
            </button>
          </div>
        </aside>
      </div>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-dash-border bg-dash-card font-dash-body text-dash-ink sm:max-w-md">
          <DialogTitle className="font-dash-display text-xl font-bold">Activity log</DialogTitle>
          <DialogDescription className="text-[13px]">When each team member was last active.</DialogDescription>
          <div className="flex flex-col">
            {[...rows].sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "")).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 border-b border-dash-border-soft py-2.5 last:border-0">
                <span className="flex flex-col"><span className="text-sm font-semibold">{r.name}</span><span className="text-xs text-dash-muted">{r.roleName ?? "No role"}</span></span>
                <span className="text-[13px] text-dash-muted">{lastActive(r.lastActiveAt)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
