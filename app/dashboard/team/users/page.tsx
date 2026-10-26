"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Search, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { StatusBadge } from "@/components/common/StatusBadge"
import { UserAvatar } from "@/components/common/UserAvatar"
import { EmptyState } from "@/components/common/EmptyState"
import { saasCompanyApi, type CompanyUser } from "@/lib/saasCompanyApi"
import { staffRoleApi, type StaffRoleResponse } from "@/lib/staffApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Tab = "all" | "active" | "invited" | "inactive"
const TABS: { value: Tab; label: string }[] = [
  { value: "all", label: "All" }, { value: "active", label: "Active" },
  { value: "invited", label: "Invited" }, { value: "inactive", label: "Inactive" },
]
const STATUS_LABEL: Record<string, string> = { active: "Active", invited: "Invited", inactive: "Inactive" }


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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Team Members"
        description={<>
          Manage your team ({seatsUsed}/{maxLabel}). People here can sign in to the admin; staff records for payroll live in{" "}
          <Link href="/dashboard/staff" className="font-semibold text-primary hover:underline">Staff</Link>.
        </>}
        actions={writable && <Button type="button" onClick={openInvite}>+ Invite member</Button>}
      />

      {limitHit && (
        <Alert>
          <AlertTitle>Team member limit reached.</AlertTitle>
          <AlertDescription>
            <p>You have reached the maximum number of team members ({maxLabel}) for your {planName ?? "current"} plan.{" "}
            <Link href="/dashboard/billing/plans" className="font-semibold underline">Upgrade your plan</Link> to add more.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.value] }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <Label className="flex min-w-[220px] flex-1 items-center gap-2">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">Search</span>
              <Input type="search" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1" />
            </Label>
            <Select value={String(roleF)} onValueChange={(val) => { setRoleF(val); setPage(1) }}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {roles.some((r) => r.name.trim().toLowerCase() === "owner") ? null : <SelectItem value="owner">Owner</SelectItem>}
                {roles.map((r) => <SelectItem key={r.id} value={String(r.name.trim().toLowerCase() === "owner" ? "owner" : r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead>
                  <TableHead>Status</TableHead><TableHead>Joined / invited</TableHead><TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7}>
                      {users.length === 0 ? (
                        <EmptyState icon={Users} title="No team members yet" className="p-4 md:p-6"
                          action={writable ? <Button type="button" onClick={openInvite}>Invite first member</Button> : undefined} />
                      ) : (
                        <EmptyState icon={Users} title="No team members match your filters." className="p-4 md:p-6"
                          action={<Button type="button" variant="link" onClick={resetFilters}>Clear filters</Button>} />
                      )}
                    </TableCell></TableRow>
                  ) : pageRows.map((u) => {
                    const own = isOwner(u), me = isMe(u), invited = u.status === "invited"
                    const roleEditable = writable && !own && !me
                    return (
                      <TableRow key={rowKey(u)} data-state={editing && rowKey(editing) === rowKey(u) ? "selected" : undefined}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <UserAvatar shape="square" name={u.fullName || u.email} className="size-9" />
                            <span className="flex min-w-0 flex-col"><span className="font-medium">{u.fullName || "—"}</span>{me && <span className="text-xs text-muted-foreground">You</span>}</span>
                          </div>
                        </TableCell>
                        <TableCell><div>{u.email}</div><div className="text-xs text-muted-foreground">{u.phone ?? ""}</div></TableCell>
                        <TableCell>
                          {roleEditable ? (
                            <Select value={String(u.roleId ?? "") === "" ? "__none" : String(u.roleId ?? "")} onValueChange={(val) => changeRole(u, (val === "__none" ? "" : val))}>
                              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">Select role…</SelectItem>
                                {assignable.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                                {u.roleId && !assignable.some((r) => r.id === u.roleId) && <SelectItem value={String(u.roleId)}>{roleNameOf(u)}</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">{roleNameOf(u)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} variant={u.status === "invited" ? "secondary" : undefined} label={STATUS_LABEL[u.status] ?? u.status} />
                          {invited && u.invitationExpired && <div className="mt-1 text-xs text-destructive">Invitation expired</div>}
                        </TableCell>
                        <TableCell>{invited ? `Invited ${fmtD(u.invitedAt ?? u.joinedDate)}` : fmtD(u.joinedDate)}</TableCell>
                        <TableCell>{u.lastLogin ? fmtD(u.lastLogin) : "Never"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {writable && invited && <Button type="button" variant="link" size="sm" onClick={() => resend(u)}>Resend invite</Button>}
                            {writable && invited && <Button type="button" variant="link" size="sm" className="text-destructive" onClick={() => revoke(u)}>Revoke</Button>}
                            {writable && !own && !me && !invited && <Button type="button" variant="link" size="sm" onClick={() => toggle(u)}>{u.status === "active" ? "Deactivate" : "Activate"}</Button>}
                            {writable && <Button type="button" variant="link" size="sm" aria-label={`Edit ${u.fullName}`} onClick={() => openEdit(u)}>Edit</Button>}
                            {writable && !own && !me && !invited && <Button type="button" variant="link" size="sm" aria-label={`Remove ${u.fullName}`} className="text-destructive" onClick={() => remove(u)}>Remove</Button>}
                            {(own || me) && <span className="text-xs text-muted-foreground">{own ? "Owner" : "Current user"}</span>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          </div>
          {!loading && filtered.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(filtered.length / perPage))} itemsPerPage={perPage} totalItems={filtered.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
        </Card>

        <aside className="flex w-full shrink-0 flex-col gap-3.5 xl:w-[400px]">
          {panel && (
            <SectionCard
              aria-label="Member form"
              title={editing ? "Edit team member" : "Invite team member"}
              description={editing ? (ownEdit ? "The owner role cannot be changed." : editing.rowType === "invitation" ? "Change the name, email, phone or role of this pending invitation." : "Change the name, phone or role.") : "They are added as a pending invitation for your company."}
              contentClassName="flex flex-col gap-3.5"
            >
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              <FormField label="Email *" htmlFor="team-email">
                <Input id="team-email" type="email" value={form.email} disabled={!!editing && editing.rowType !== "invitation"} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" /></FormField>
              <FormField label="Full name *" htmlFor="team-fullName">
                <Input id="team-fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="John Doe" /></FormField>
              <FormField label="Phone" htmlFor="team-phone">
                <Input id="team-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXX-XXXXXX" /></FormField>
              {!ownEdit && (
                <FormField label="Role *" htmlFor="team-role">
                  <Select value={String(form.roleId) === "" ? "__none" : String(form.roleId)} onValueChange={(val) => set("roleId", (val === "__none" ? "" : val))}>
                    <SelectTrigger id="team-role" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Select a role...</SelectItem>
                      {assignable.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              {!ownEdit && assignable.length === 0 && (
                <p className="text-xs text-muted-foreground">No roles yet. <Link href="/dashboard/staff/roles" className="font-semibold underline">Create a role</Link> first, then invite the member.</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closePanel}>Cancel</Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : editing ? "Save changes" : "Send invitation"}
                </Button>
              </div>
            </SectionCard>
          )}

          <SectionCard aria-label="Team roles" title="Team roles" contentClassName="flex flex-col gap-3">
            {loading ? <Skeleton className="h-24" /> : guide.map((g) => (
              <div key={g.key}>
                <div className="text-sm font-medium">{g.name} <span className="font-normal text-muted-foreground">· {g.count} member{g.count === 1 ? "" : "s"}</span></div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Edit what each role can do in <Link href="/dashboard/staff/roles" className="font-semibold text-primary hover:underline">Roles &amp; access</Link>.</p>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
