"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Trans, useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
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

type K = ParseKeys<["account", "common"]>
type Tab = "all" | "active" | "invited" | "inactive"
const TABS: { value: Tab; label: K }[] = [
  { value: "all", label: "common:status.all" }, { value: "active", label: "common:status.active" },
  { value: "invited", label: "account:team.invited" }, { value: "inactive", label: "common:status.inactive" },
]
const STATUS_LABEL: Record<string, K> = { active: "common:status.active", invited: "account:team.invited", inactive: "common:status.inactive" }
// The backend's default description for new roles; shown translated
const DEFAULT_ROLE_DESC = "Custom role"

interface FormState { email: string; fullName: string; phone: string; roleId: string }
const blank: FormState = { email: "", fullName: "", phone: "", roleId: "" }

const rowKey = (u: CompanyUser) => `${u.rowType ?? "user"}-${u.id}`

export default function TeamUsersPage() {
  const blocked = useModuleGuard("Team Members")
  const { t, i18n } = useTranslation(["account", "common"])
  const fmtD = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" }) : "—")
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
      toast.error(e?.response?.data?.message || t("account:team.loadFailed"))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
  const maxLabel = unlimited ? t("account:team.unlimited") : String(maxUsers)
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

  const roleNameOf = (u: CompanyUser) => (u.role === "owner" ? t("account:team.owner") : u.staffRole?.name ?? roles.find((r) => r.id === u.roleId)?.name ?? t("account:team.noRole"))
  const isMe = (u: CompanyUser) => u.rowType !== "invitation" && u.id === user?.id
  const isOwner = (u: CompanyUser) => u.role === "owner" || u.isOwner === true

  const closePanel = () => { setPanel(null); setForm(blank); setErr("") }
  const openInvite = () => {
    if (!canAddMore && !unlimited) { toast.error(t("account:team.limitToast", { max: maxLabel })); return }
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
    if (!email || !name || (!ownEdit && !form.roleId)) { setErr(t("account:team.required")); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr(t("account:team.emailInvalid")); return }
    if (users.some((u) => u.email.toLowerCase() === email && !(editing && u.id === editing.id && u.rowType === editing.rowType))) {
      setErr(t("account:team.emailTaken")); return
    }
    setSaving(true)
    try {
      if (editing && editing.rowType === "invitation") {
        await saasCompanyApi.updateInvitation(editing.invitationId ?? editing.id, {
          fullName: name, phone, email, ...(form.roleId ? { roleId: Number(form.roleId) } : {}),
        })
        toast.success(t("account:team.invitationUpdated"))
      } else if (editing) {
        await saasCompanyApi.updateTeamMember(editing.id, {
          fullName: name, phone,
          ...(!ownEdit && form.roleId && Number(form.roleId) !== editing.roleId ? { roleId: Number(form.roleId) } : {}),
        })
        toast.success(t("account:team.memberUpdated"))
      } else {
        await saasCompanyApi.inviteUser({ email, fullName: name, phone: phone || undefined, roleId: Number(form.roleId) })
        toast.success(t("account:team.invitationCreated", { email }))
      }
      closePanel()
      await load()
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || t("account:team.saveFailed")
      setErr(msg)
      if (e?.response?.status === 422 && /limit/i.test(msg)) toast.error(msg)
    } finally { setSaving(false) }
  }

  const changeRole = async (u: CompanyUser, roleId: string) => {
    if (!roleId) return
    try {
      if (u.rowType === "invitation") await saasCompanyApi.updateInvitation(u.invitationId ?? u.id, { roleId: Number(roleId) })
      else await saasCompanyApi.updateTeamMember(u.id, { roleId: Number(roleId) })
      toast.success(t("account:team.roleUpdated", { role: roles.find((r) => r.id === Number(roleId))?.name ?? t("account:team.newRoleFallback") }))
      await load()
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:team.roleFailed")) }
  }
  const resend = async (u: CompanyUser) => {
    try { await saasCompanyApi.resendInvitation(u.invitationId ?? u.id); toast.success(t("account:team.resent", { email: u.email })); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("account:team.resendFailed")) }
  }
  const revoke = async (u: CompanyUser) => {
    if (!window.confirm(t("account:team.revokeConfirm", { email: u.email }))) return
    try { await saasCompanyApi.revokeInvitation(u.invitationId ?? u.id); toast.success(t("account:team.revoked")); if (editing?.id === u.id) closePanel(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("account:team.revokeFailed")) }
  }
  const toggle = async (u: CompanyUser) => {
    const next = u.status === "active" ? "inactive" : "active"
    if (next === "inactive" && !window.confirm(t("account:team.deactivateConfirm", { name: u.fullName }))) return
    try { await saasCompanyApi.setTeamMemberStatus(u.id, next); toast.success(next === "active" ? t("account:team.activated", { name: u.fullName }) : t("account:team.deactivated", { name: u.fullName })); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("account:team.statusFailed")) }
  }
  const remove = async (u: CompanyUser) => {
    if (!window.confirm(t("account:team.removeConfirm", { name: u.fullName }))) return
    try { await saasCompanyApi.removeUser(u.id); toast.success(t("account:team.removed")); if (editing?.id === u.id) closePanel(); await load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("account:team.removeFailed")) }
  }

  const guide = useMemo(() => {
    const list = roles.map((r) => ({ key: String(r.id), name: r.name, desc: !r.description || r.description === DEFAULT_ROLE_DESC ? t("account:team.customRole") : r.description, count: users.filter((u) => u.roleId === r.id && u.role !== "owner").length }))
    const hasOwner = roles.some((r) => r.name.trim().toLowerCase() === "owner")
    const ownerCount = users.filter((u) => u.role === "owner").length
    const owner = { key: "owner", name: t("account:team.owner"), desc: t("account:team.ownerDesc"), count: ownerCount }
    return hasOwner ? list.map((g) => (g.name.trim().toLowerCase() === "owner" ? { ...g, count: ownerCount } : g)) : [owner, ...list]
  }, [roles, users, t])

  if (blocked) return blocked

  const resetFilters = () => { setQ(""); setTab("all"); setRoleF("all"); setPage(1) }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("account:team.title")}
        description={<Trans t={t} i18nKey="account:team.description" values={{ used: seatsUsed, max: maxLabel }}
          components={{ link: <Link href="/dashboard/staff" className="font-semibold text-primary hover:underline" /> }} />}
        actions={writable && <Button type="button" onClick={openInvite}>{t("account:team.invite")}</Button>}
      />

      {limitHit && (
        <Alert>
          <AlertTitle>{t("account:team.limitTitle")}</AlertTitle>
          <AlertDescription>
            <p><Trans t={t} i18nKey="account:team.limitText" values={{ max: maxLabel, plan: planName ?? t("account:team.currentPlanFallback") }}
              components={{ link: <Link href="/dashboard/billing/plans" className="font-semibold underline" /> }} /></p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(v) => { setTab(v as Tab); setPage(1) }}
              tabs={TABS.map((tb) => ({ value: tb.value, label: t(tb.label), count: counts[tb.value] }))} />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 p-4">
            <Label className="flex min-w-[220px] flex-1 items-center gap-2">
              <Search className="size-[18px]" aria-hidden /><span className="sr-only">{t("common:actions.search")}</span>
              <Input type="search" placeholder={t("account:team.searchPlaceholder")} value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }}
                className="min-w-0 flex-1" />
            </Label>
            <Select value={String(roleF)} onValueChange={(val) => { setRoleF(val); setPage(1) }}>
              <SelectTrigger aria-label={t("account:team.role")}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("account:team.allRoles")}</SelectItem>
                {roles.some((r) => r.name.trim().toLowerCase() === "owner") ? null : <SelectItem value="owner">{t("account:team.owner")}</SelectItem>}
                {roles.map((r) => <SelectItem key={r.id} value={String(r.name.trim().toLowerCase() === "owner" ? "owner" : r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common:fields.name")}</TableHead><TableHead>{t("common:fields.email")}</TableHead><TableHead>{t("account:team.role")}</TableHead>
                  <TableHead>{t("common:fields.status")}</TableHead><TableHead>{t("account:team.joinedInvited")}</TableHead><TableHead>{t("account:team.lastLogin")}</TableHead>
                  <TableHead className="text-right">{t("common:fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={7}><Skeleton className="h-12" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7}>
                      {users.length === 0 ? (
                        <EmptyState icon={Users} title={t("account:team.empty")} className="p-4 md:p-6"
                          action={writable ? <Button type="button" onClick={openInvite}>{t("account:team.inviteFirst")}</Button> : undefined} />
                      ) : (
                        <EmptyState icon={Users} title={t("account:team.noMatch")} className="p-4 md:p-6"
                          action={<Button type="button" variant="link" onClick={resetFilters}>{t("common:actions.clearFilters")}</Button>} />
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
                            <span className="flex min-w-0 flex-col"><span className="font-medium">{u.fullName || "—"}</span>{me && <span className="text-xs text-muted-foreground">{t("account:team.you")}</span>}</span>
                          </div>
                        </TableCell>
                        <TableCell><div>{u.email}</div><div className="text-xs text-muted-foreground">{u.phone ?? ""}</div></TableCell>
                        <TableCell>
                          {roleEditable ? (
                            <Select value={String(u.roleId ?? "") === "" ? "__none" : String(u.roleId ?? "")} onValueChange={(val) => changeRole(u, (val === "__none" ? "" : val))}>
                              <SelectTrigger aria-label={t("account:team.role")}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none">{t("account:team.selectRole")}</SelectItem>
                                {assignable.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                                {u.roleId && !assignable.some((r) => r.id === u.roleId) && <SelectItem value={String(u.roleId)}>{roleNameOf(u)}</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">{roleNameOf(u)}</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={u.status} variant={u.status === "invited" ? "secondary" : undefined} label={STATUS_LABEL[u.status] ? t(STATUS_LABEL[u.status]) : u.status} />
                          {invited && u.invitationExpired && <div className="mt-1 text-xs text-destructive">{t("account:team.invitationExpired")}</div>}
                        </TableCell>
                        <TableCell>{invited ? t("account:team.invitedOn", { date: fmtD(u.invitedAt ?? u.joinedDate) }) : fmtD(u.joinedDate)}</TableCell>
                        <TableCell>{u.lastLogin ? fmtD(u.lastLogin) : t("account:team.never")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap items-center justify-end gap-3">
                            {writable && invited && <Button type="button" variant="link" size="sm" onClick={() => resend(u)}>{t("account:team.resendInvite")}</Button>}
                            {writable && invited && <Button type="button" variant="link" size="sm" className="text-destructive" onClick={() => revoke(u)}>{t("account:team.revoke")}</Button>}
                            {writable && !own && !me && !invited && <Button type="button" variant="link" size="sm" onClick={() => toggle(u)}>{u.status === "active" ? t("account:team.deactivate") : t("account:team.activate")}</Button>}
                            {writable && <Button type="button" variant="link" size="sm" aria-label={t("account:team.editName", { name: u.fullName })} onClick={() => openEdit(u)}>{t("common:actions.edit")}</Button>}
                            {writable && !own && !me && !invited && <Button type="button" variant="link" size="sm" aria-label={t("common:extra.removeName", { name: u.fullName })} className="text-destructive" onClick={() => remove(u)}>{t("common:actions.remove")}</Button>}
                            {(own || me) && <span className="text-xs text-muted-foreground">{own ? t("account:team.owner") : t("account:team.currentUser")}</span>}
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
              aria-label={t("account:team.form.aria")}
              title={editing ? t("account:team.form.editTitle") : t("account:team.form.inviteTitle")}
              description={editing ? (ownEdit ? t("account:team.form.ownerLocked") : editing.rowType === "invitation" ? t("account:team.form.editInvitation") : t("account:team.form.editMember")) : t("account:team.form.inviteDesc")}
              contentClassName="flex flex-col gap-3.5"
            >
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              <FormField label={t("account:team.form.email")} htmlFor="team-email">
                <Input id="team-email" type="email" value={form.email} disabled={!!editing && editing.rowType !== "invitation"} onChange={(e) => set("email", e.target.value)} placeholder="user@example.com" /></FormField>
              <FormField label={t("account:team.form.fullName")} htmlFor="team-fullName">
                <Input id="team-fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder={t("account:team.form.namePlaceholder")} /></FormField>
              <FormField label={t("common:fields.phone")} htmlFor="team-phone">
                <Input id="team-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXX-XXXXXX" /></FormField>
              {!ownEdit && (
                <FormField label={t("account:team.form.role")} htmlFor="team-role">
                  <Select value={String(form.roleId) === "" ? "__none" : String(form.roleId)} onValueChange={(val) => set("roleId", (val === "__none" ? "" : val))}>
                    <SelectTrigger id="team-role" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">{t("account:team.form.selectRole")}</SelectItem>
                      {assignable.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
              {!ownEdit && assignable.length === 0 && (
                <p className="text-xs text-muted-foreground"><Trans t={t} i18nKey="account:team.form.noRoles" components={{ link: <Link href="/dashboard/staff/roles" className="font-semibold underline" /> }} /></p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closePanel}>{t("common:actions.cancel")}</Button>
                <Button type="button" disabled={saving} onClick={save}>
                  {saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("account:team.form.send")}
                </Button>
              </div>
            </SectionCard>
          )}

          <SectionCard aria-label={t("account:team.roles.title")} title={t("account:team.roles.title")} contentClassName="flex flex-col gap-3">
            {loading ? <Skeleton className="h-24" /> : guide.map((g) => (
              <div key={g.key}>
                <div className="text-sm font-medium">{g.name} <span className="font-normal text-muted-foreground">{t("account:team.roles.members", { count: g.count })}</span></div>
                <div className="text-xs text-muted-foreground">{g.desc}</div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground"><Trans t={t} i18nKey="account:team.roles.editHint" components={{ link: <Link href="/dashboard/staff/roles" className="font-semibold text-primary hover:underline" /> }} /></p>
          </SectionCard>
        </aside>
      </div>
    </div>
  )
}
