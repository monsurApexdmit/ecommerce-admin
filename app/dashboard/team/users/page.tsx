"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { saasCompanyApi, type CompanyUser } from "@/lib/saasCompanyApi"
import { staffRoleApi, type StaffRoleResponse } from "@/lib/staffApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

type Tab = "all" | "active" | "invited" | "inactive"
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" }, { value: "active", label: "Active" },
  { value: "invited", label: "Invited" }, { value: "inactive", label: "Inactive" },
]
const STATUS_STYLE: Record<string, string> = {
  active: "bg-dash-success-soft text-dash-success-fg",
  invited: "bg-dash-warn-soft text-dash-warn-fg",
  inactive: "bg-dash-neutral-soft text-dash-neutral-fg",
}
const STATUS_LABEL: Record<string, string> = { active: "Active", invited: "Invited", inactive: "Inactive" }

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent disabled:opacity-60"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"
const linkBtn = "text-xs font-semibold text-dash-accent hover:underline"

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?"
const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—")

interface FormState { email: string; fullName: string; phone: string; roleId: string }
const blank: FormState = { email: "", fullName: "", phone: "", roleId: "" }

const rowKey = (u: CompanyUser) => `${u.rowType ?? "user"}-${u.id}`

export default function TeamUsersPage() {
  const blocked = useModuleGuard("Team Members")
  const { user, canWrite } = useSaasAuth()
  const writable = canWrite("Team Members")

  const [users, setUsers] = useState<CompanyUser[]>([])
  const [roles, setRoles] = useState<StaffRoleResponse[]>([])
  const [maxUsers, setMaxUsers] = useState(0)
  const [seatsUsed, setSeatsUsed] = useState(0)
  const [planName, setPlanName] = useState<string | null>(null)
  const [canAddMore, setCanAddMore] = useState(true)
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<Tab>("all")
  const [q, setQ] = useState("")
  const [roleF, setRoleF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [panel, setPanel] = useState<"new" | CompanyUser | null>(null)
  const [form, setForm] = useState<FormState>(blank)
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await saasCompanyApi.getTeamUsers()
      const d = res.data
      setUsers(d.users ?? [])
      setMaxUsers(d.maxUsers ?? 0)
      setSeatsUsed(d.seatsUsed ?? d.totalUsers ?? (d.users ?? []).length)
      setPlanName(d.planName ?? null)
      setCanAddMore(d.canAddMore !== false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Failed to load team members")
    }
  }, [])

  useEffect(() => {
    (async () => {
      setLoading(true)
      await Promise.all([
        load(),
        staffRoleApi.getAll({ limit: 100 }).then((r) => setRoles(r.data || [])).catch(() => setRoles([])),
      ])
      setLoading(false)
    })()
  }, [load])

  const assignable = useMemo(() => roles.filter((r) => !r.locked && r.name.trim().toLowerCase() !== "owner"), [roles])
  const unlimited = maxUsers >= 999999
  const maxLabel = unlimited ? "unlimited" : String(maxUsers)
  const limitHit = !loading && !unlimited && maxUsers > 0 && !canAddMore

  const counts = useMemo(() => ({
    all: users.length,
    active: users.filter((u) => u.status === "active").length,
    invited: users.filter((u) => u.status === "invited").length,
    inactive: users.filter((u) => u.status === "inactive").length,
  }), [users])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return users
      .filter((u) => (tab === "all" || u.status === tab)
        && (roleF === "all" || (roleF === "owner" ? u.role === "owner" : String(u.roleId ?? "") === roleF))
        && (!s || [u.fullName, u.email, u.phone].some((v) => String(v ?? "").toLowerCase().includes(s))))
      .sort((a, b) => (Number(b.role === "owner") - Number(a.role === "owner")) || String(a.fullName).localeCompare(String(b.fullName)))
  }, [users, tab, q, roleF])

  const pageRows = filtered.slice((page - 1) * perPage, page * perPage)

  const roleNameOf = (u: CompanyUser) => (u.role === "owner" ? "Owner" : u.staffRole?.name ?? roles.find((r) => r.id === u.roleId)?.name ?? "No role")
  const isMe = (u: CompanyUser) => u.rowType !== "invitation" && u.id === user?.id
  const isOwner = (u: CompanyUser) => u.role === "owner" || u.isOwner === true

  const closePanel = () => { setPanel(null); setForm(blank); setErr("") }
  const openInvite = () => {
    if (!canAddMore && !unlimited) { toast.error(`Team member limit reached (${maxLabel}). Upgrade your plan to add more.`); return }
    setPanel("new"); setForm(blank); setErr("")
  }
  const openEdit = (u: CompanyUser) => {
    setPanel(u); setErr("")
    setForm({ email: u.email, fullName: u.fullName, phone: u.phone ?? "", roleId: u.roleId ? String(u.roleId) : "" })
  }
  const set = (k: keyof FormState, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const editing = panel && panel !== "new" ? panel : null
  const ownEdit = !!editing && (isOwner(editing) || isMe(editing))

  const save = async () => {
    const name = form.fullName.trim(), email = form.email.trim().toLowerCase(), phone = form.phone.trim()
    if (!email || !name || (!ownEdit && !form.roleId)) { setErr("Please fill in all required fields"); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address."); return }
    if (users.some((u) => u.email.toLowerCase() === email && !(editing && u.id === editing.id && u.rowType === editing.rowType))) {
      setErr("A team member with this email already exists."); return
    }
    setSaving(true)
    try {
      if (editing && editing.rowType === "invitation") {
        await saasCompanyApi.updateInvitation(editing.invitationId ?? editing.id, {
          fullName: name, phone, email, ...(form.roleId ? { roleId: Number(form.roleId) } : {}),
        })
        toast.success("Invitation updated")
      } else if (editing) {
        await saasCompanyApi.updateTeamMember(editing.id, {
          fullName: name, phone,
          ...(!ownEdit && form.roleId && Number(form.roleId) !== editing.roleId ? { roleId: Number(form.roleId) } : {}),
        })
        toast.success("Team member updated")
      } else {
        await saasCompanyApi.inviteUser({ email, fullName: name, phone: phone || undefined, roleId: Number(form.roleId) })
        toast.success(`Invitation created for ${email}`)
      }
      closePanel()
      await load()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || "Could not save the team member"
      setErr(msg)
      if (e?.response?.status === 422 && /limit/i.test(msg)) toast.error(msg)
    } finally { setSaving(false) }
  }

  const changeRole = async (u: CompanyUser, roleId: string) => {
    if (!roleId) return
    try {
      if (u.rowType === "invitation") await saasCompanyApi.updateInvitation(u.invitationId ?? u.id, { roleId: Number(roleId) })
      else await saasCompanyApi.updateTeamMember(u.id, { roleId: Number(roleId) })
      toast.success(`Role updated to ${roles.find((r) => r.id === Number(roleId))?.name ?? "new role"}`)
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || "Failed to update role") }
  }
  const resend = async (u: CompanyUser) => {
    try { await saasCompanyApi.resendInvitation(u.invitationId ?? u.id); toast.success(`Invitation resent to ${u.email}`); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed to resend invitation") }
  }
  const revoke = async (u: CompanyUser) => {
    if (!window.confirm(`Revoke the invitation for ${u.email}?`)) return
    try { await saasCompanyApi.revokeInvitation(u.invitationId ?? u.id); toast.success("Invitation revoked"); if (editing?.id === u.id) closePanel(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed to revoke invitation") }
  }
  const toggle = async (u: CompanyUser) => {
    const next = u.status === "active" ? "inactive" : "active"
    if (next === "inactive" && !window.confirm(`Deactivate ${u.fullName}? They will no longer be able to sign in.`)) return
    try { await saasCompanyApi.setTeamMemberStatus(u.id, next); toast.success(`${u.fullName} ${next === "active" ? "activated" : "deactivated"}`); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed to update status") }
  }
  const remove = async (u: CompanyUser) => {
    if (!window.confirm(`Are you sure you want to remove ${u.fullName}? This action cannot be undone.`)) return
    try { await saasCompanyApi.removeUser(u.id); toast.success("User removed successfully"); if (editing?.id === u.id) closePanel(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || "Failed to remove user") }
  }

  const guide = useMemo(() => {
    const list = roles.map((r) => ({ key: String(r.id), name: r.name, desc: r.description || "Custom role", count: users.filter((u) => u.roleId === r.id && u.role !== "owner").length }))
    const hasOwner = roles.some((r) => r.name.trim().toLowerCase() === "owner")
    const ownerCount = users.filter((u) => u.role === "owner").length
    const owner = { key: "owner", name: "Owner", desc: "Full access to all features and settings", count: ownerCount }
    return hasOwner ? list.map((g) => (g.name.trim().toLowerCase() === "owner" ? { ...g, count: ownerCount } : g)) : [owner, ...list]
  }, [roles, users])

  if (blocked) return blocked

  const resetFilters = () => { setQ(""); setTab("all"); setRoleF("all"); setPage(1) }

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Team Members</h1>
          <p className="mt-1 text-sm text-dash-muted">
            Manage your team ({seatsUsed}/{maxLabel}). People here can sign in to the admin; staff records for payroll live in{" "}
            <Link href="/dashboard/staff" className="font-semibold text-dash-accent hover:underline">Staff</Link>.
          </p>
        </div>
        {writable && <button type="button" onClick={openInvite} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white">+ Invite member</button>}
      </div>

      {limitHit && (
        <div role="alert" className="rounded-[10px] bg-dash-warn-soft px-4 py-3 text-[13px] text-dash-warn-fg">
          <strong>Team member limit reached.</strong> You have reached the maximum number of team members ({maxLabel}) for your {planName ?? "current"} plan.{" "}
          <Link href="/dashboard/billing/plans" className="font-semibold underline">Upgrade your plan</Link> to add more.
        </div>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <label className="flex h-11 min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
              <input type="search" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted" />
            </label>
            <select aria-label="Role" value={roleF} onChange={(e) => { setRoleF(e.target.value); setPage(1) }} className="h-11 rounded-[10px] border border-dash-border bg-dash-card px-2.5 text-[13px] font-semibold outline-none">
              <option value="all">All roles</option>
              {roles.some((r) => r.name.trim().toLowerCase() === "owner") ? null : <option value="owner">Owner</option>}
              {roles.map((r) => <option key={r.id} value={r.name.trim().toLowerCase() === "owner" ? "owner" : r.id}>{r.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th className="py-3 pl-4 pr-2 font-semibold">Name</th><th className="px-2 py-3 font-semibold">Email</th><th className="px-2 py-3 font-semibold">Role</th>
                  <th className="px-2 py-3 font-semibold">Status</th><th className="px-2 py-3 font-semibold">Joined / invited</th><th className="px-2 py-3 font-semibold">Last login</th>
                  <th className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? [1, 2, 3, 4].map((i) => <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-12 rounded" /></td></tr>) :
                  pageRows.length === 0 ? (
                    <tr><td colSpan={7} className="py-14 text-center">
                      <Users className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
                      {users.length === 0 ? (
                        <>
                          <p className="font-semibold">No team members yet</p>
                          {writable && <button type="button" onClick={openInvite} className="mt-3 h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white">Invite first member</button>}
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">No team members match your filters.</p>
                          <button type="button" onClick={resetFilters} className="mt-1 text-sm font-semibold text-dash-accent hover:underline">Clear filters</button>
                        </>
                      )}
                    </td></tr>
                  ) : pageRows.map((u) => {
                    const own = isOwner(u), me = isMe(u), invited = u.status === "invited"
                    const roleEditable = writable && !own && !me
                    return (
                      <tr key={rowKey(u)} className={editing && rowKey(editing) === rowKey(u) ? "bg-dash-accent-soft/40" : ""}>
                        <td className="border-b border-dash-border-soft py-3 pl-4 pr-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-dash-accent-soft text-xs font-bold text-dash-accent-fg">{initials(u.fullName || u.email)}</span>
                            <span className="flex min-w-0 flex-col"><span className="font-semibold">{u.fullName || "—"}</span>{me && <span className="text-xs text-dash-muted">You</span>}</span>
                          </div>
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3"><div>{u.email}</div><div className="text-xs text-dash-muted">{u.phone ?? ""}</div></td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          {roleEditable ? (
                            <select aria-label="Role" value={u.roleId ?? ""} onChange={(e) => changeRole(u, e.target.value)} className="h-9 rounded-lg border border-dash-border bg-dash-card px-2 text-[13px] font-semibold outline-none">
                              <option value="">Select role…</option>
                              {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                              {u.roleId && !assignable.some((r) => r.id === u.roleId) && <option value={u.roleId}>{roleNameOf(u)}</option>}
                            </select>
                          ) : (
                            <span className="rounded-md bg-dash-neutral-soft px-2 py-[3px] text-xs font-semibold">{roleNameOf(u)}</span>
                          )}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3">
                          <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS_STYLE[u.status] ?? STATUS_STYLE.inactive)}>{STATUS_LABEL[u.status] ?? u.status}</span>
                          {invited && u.invitationExpired && <div className="mt-1 text-[11px] text-dash-danger-fg">Invitation expired</div>}
                        </td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{invited ? `Invited ${fmtD(u.invitedAt ?? u.joinedDate)}` : fmtD(u.joinedDate)}</td>
                        <td className="border-b border-dash-border-soft px-2 py-3 text-dash-muted">{u.lastLogin ? fmtD(u.lastLogin) : "Never"}</td>
                        <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {writable && invited && <button type="button" className={linkBtn} onClick={() => resend(u)}>Resend invite</button>}
                            {writable && invited && <button type="button" className={cn(linkBtn, "text-dash-danger")} onClick={() => revoke(u)}>Revoke</button>}
                            {writable && !own && !me && !invited && <button type="button" className={linkBtn} onClick={() => toggle(u)}>{u.status === "active" ? "Deactivate" : "Activate"}</button>}
                            {writable && <button type="button" aria-label={`Edit ${u.fullName}`} className={linkBtn} onClick={() => openEdit(u)}>Edit</button>}
                            {writable && !own && !me && !invited && <button type="button" aria-label={`Remove ${u.fullName}`} className={cn(linkBtn, "text-dash-danger")} onClick={() => remove(u)}>Remove</button>}
                            {(own || me) && <span className="text-xs text-dash-muted">{own ? "Owner" : "Current user"}</span>}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(filtered.length / perPage))} itemsPerPage={perPage} totalItems={filtered.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </section>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[400px]">
          {panel && (
            <section aria-label="Member form" className="flex flex-col gap-3.5 rounded-[14px] border border-dash-border bg-dash-card p-5">
              <div>
                <h2 className="font-dash-display text-lg font-bold">{editing ? "Edit team member" : "Invite team member"}</h2>
                <p className="mt-1 text-xs text-dash-muted">
                  {editing ? (ownEdit ? "The owner role cannot be changed." : editing.rowType === "invitation" ? "Change the name, email, phone or role of this pending invitation." : "Change the name, phone or role.") : "They are added as a pending invitation for your company."}
                </p>
                {err && <p role="alert" className="mt-2 rounded-[10px] bg-dash-danger-soft px-3 py-2 text-[13px] font-semibold text-dash-danger-fg">{err}</p>}
              </div>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Email *
                <input type="email" className={input} value={form.email} disabled={!!editing && editing.rowType !== "invitation"} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Full name *
                <input className={input} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="John Doe" /></label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Phone
                <input className={input} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXX-XXXXXX" /></label>
              {!ownEdit && (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Role *
                  <select className={input} value={form.roleId} onChange={(e) => set("roleId", e.target.value)}>
                    <option value="">Select a role...</option>
                    {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </label>
              )}
              {!ownEdit && assignable.length === 0 && (
                <p className="text-xs text-dash-warn-fg">No roles yet. <Link href="/dashboard/staff/roles" className="font-semibold underline">Create a role</Link> first, then invite the member.</p>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closePanel} className={outlineBtn}>Cancel</button>
                <button type="button" disabled={saving} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
                  {saving ? "Saving…" : editing ? "Save changes" : "Send invitation"}
                </button>
              </div>
            </section>
          )}

          <section aria-label="Team roles" className="flex flex-col gap-3 rounded-[14px] border border-dash-border bg-dash-card p-5">
            <h2 className="font-dash-display text-lg font-bold">Team roles</h2>
            {loading ? <Skeleton className="h-24 rounded-lg" /> : guide.map((g) => (
              <div key={g.key}>
                <div className="text-[13px] font-semibold">{g.name} <span className="font-normal text-dash-muted">· {g.count} member{g.count === 1 ? "" : "s"}</span></div>
                <div className="text-xs text-dash-muted">{g.desc}</div>
              </div>
            ))}
            <p className="text-xs text-dash-muted">Edit what each role can do in <Link href="/dashboard/staff/roles" className="font-semibold text-dash-accent hover:underline">Roles &amp; access</Link>.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
