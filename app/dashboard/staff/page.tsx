"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Ban, CheckCircle2, ChevronDown, Clock, Download, Eye, Pencil, Search, Trash2, UserCheck, Users, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { StatsCards } from "@/components/ui/stats-card"
import { StatusTabs } from "@/components/ui/status-tabs"
import { PaginationControl } from "@/components/ui/pagination-control"
import staffApi, { staffUiApi, type StaffOverview, type StaffRow, type StaffSalarySummary } from "@/lib/staffApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Toolbar } from "@/components/common/Toolbar"
import { UserAvatar } from "@/components/common/UserAvatar"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"

type Tab = "all" | "Active" | "Invited" | "On leave" | "Inactive"
const TABS: Tab[] = ["all", "Active", "Invited", "On leave", "Inactive"]
const PAY_METHODS = ["Cash", "bKash", "Bank transfer", "Check"]
const STATUSES = ["Active", "Invited", "On leave", "Inactive"]

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
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Staff"
        description="Your team, what they can access, and where they work."
        actions={<>
          <Button type="button" variant="outline" onClick={() => setActivityOpen(true)}>Activity log</Button>
          <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
        </>}
      />

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
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
        <Card className="w-full min-w-0 flex-1 gap-0 py-0">
          <div className="px-4">
            <StatusTabs value={tab} onChange={(t) => { setTab(t as Tab); setPage(1) }}
              tabs={TABS.map((t) => ({ value: t, label: t === "all" ? "All" : t, count: data?.counts[t] }))} />
          </div>
          <Toolbar className="p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input type="search" aria-label="Search staff" placeholder="Search name, email or phone…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} className="pl-8" />
            </div>
            <Select value={roleF} onValueChange={(v) => { setRoleF(v); setPage(1) }}>
              <SelectTrigger aria-label="Role"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Role: All</SelectItem>{roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={locF} onValueChange={(v) => { setLocF(v); setPage(1) }}>
              <SelectTrigger aria-label="Location"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Location: All</SelectItem>{locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button type="button" variant="outline" onClick={() => { setQ(""); setRoleF("all"); setLocF("all"); setTab("all"); setPage(1) }}>Reset</Button>
          </Toolbar>

          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Person</TableHead><TableHead>Role</TableHead><TableHead>Location</TableHead>
                  <TableHead>Salary</TableHead><TableHead>Last active</TableHead><TableHead>Status</TableHead>
                  <TableHead>Published</TableHead><TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? [1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={8} className="px-4 py-3"><Skeleton className="h-12" /></TableCell></TableRow>) :
                  pageRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8}>
                      <EmptyState icon={Users} title="No staff found" className="p-4 md:p-6"
                        description={qD || tab !== "all" || roleF !== "all" || locF !== "all" ? "Try clearing the filters." : "Add your first team member with the form."} />
                    </TableCell></TableRow>
                  ) : pageRows.map((r) => (
                    <TableRow key={r.id} data-state={editing?.id === r.id ? "selected" : undefined}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <UserAvatar name={r.name} shape="square" className="size-9" />
                          <span className="flex min-w-0 flex-col"><span className="font-semibold">{r.name}</span><span className="truncate text-xs text-muted-foreground">{[r.email, r.phone].filter(Boolean).join(" · ") || "—"}</span></span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{r.roleName ?? "No role"}</Badge></TableCell>
                      <TableCell>{r.locationNames.join(", ") || "All locations"}</TableCell>
                      <TableCell><div className="tabular-nums">{r.salary ? formatCurrency(r.salary) : "—"}</div><div className="text-xs text-muted-foreground">{r.paymentMethod ?? ""}</div></TableCell>
                      <TableCell className="text-muted-foreground">{lastActive(r.lastActiveAt)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                        {r.invited && r.email && <div><Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => resend(r)}>Resend invite</Button></div>}
                      </TableCell>
                      <TableCell>
                        <Switch checked={r.published} aria-label={`Published: ${r.name}`} disabled={!!r.isOnlyOwner} onCheckedChange={() => togglePublished(r)} />
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          <WithTooltip content={`View ${r.name}`}><Button type="button" variant="outline" size="icon" aria-label={`View ${r.name}`} onClick={() => openView(r)}><Eye className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={`Edit ${r.name}`}><Button type="button" variant="outline" size="icon" aria-label={`Edit ${r.name}`} onClick={() => startEdit(r)}><Pencil className="size-4" /></Button></WithTooltip>
                          <WithTooltip content={r.isOnlyOwner ? "The only Owner cannot be deactivated" : r.status === "Inactive" ? "Reactivate" : "Deactivate"}>
                            <span tabIndex={r.isOnlyOwner ? 0 : undefined} className="inline-flex">
                              <Button type="button" variant="outline" size="icon" disabled={!!r.isOnlyOwner} aria-label={r.status === "Inactive" ? "Reactivate" : "Deactivate"} onClick={() => toggleActive(r)}>
                                {r.status === "Inactive" ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}
                              </Button>
                            </span>
                          </WithTooltip>
                          <WithTooltip content={r.isOnlyOwner ? "The only Owner cannot be removed" : undefined}>
                            <span tabIndex={r.isOnlyOwner ? 0 : undefined} className="inline-flex">
                              <Button type="button" variant="outline" size="icon" disabled={!!r.isOnlyOwner} aria-label={`Delete ${r.name}`} onClick={() => remove(r)}><Trash2 className="size-4" /></Button>
                            </span>
                          </WithTooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
          {!loading && rows.length > 0 && (
            <div className="p-4 pt-3"><PaginationControl currentPage={page} totalPages={Math.max(1, Math.ceil(rows.length / perPage))} itemsPerPage={perPage} totalItems={rows.length}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} /></div>
          )}
          {stats && <>
            <Separator />
            <div className="px-4 py-3 text-xs text-muted-foreground">{stats.seatsUsed} of {stats.seatLimit ?? "unlimited"} seats used{atSeatLimit ? " · limit reached" : ""}</div>
          </>}
        </Card>

        <Card role="complementary" className="w-full shrink-0 gap-3.5 p-5 xl:w-[400px]">
          {viewing && (
            <SectionCard
              title="Staff details"
              actions={<Button type="button" variant="ghost" size="sm" onClick={() => setViewing(null)}>Close</Button>}
              className="gap-3 py-4"
              contentClassName="flex flex-col gap-2.5 px-4"
            >
              <div className="flex items-center gap-2.5">
                <UserAvatar name={viewing.name} shape="square" className="size-11" />
                <span className="flex flex-col"><span className="font-semibold">{viewing.name}</span><span className="text-xs text-muted-foreground">{viewing.roleName ?? "No role"}</span></span>
              </div>
              <InfoList>
                {([["Email", viewing.email], ["Phone", viewing.phone], ["Sign in", viewing.loginMethod === "pin" ? "POS PIN" : "Email link"], ["Locations", viewing.locationNames.join(", ") || "All locations"],
                  ["Joined", fmtD(viewing.joiningDate)], ["Pay", `${viewing.salary ? formatCurrency(viewing.salary) : "—"} · ${viewing.paymentMethod ?? ""}`], ["Account", viewing.account], ["NID", viewing.nid], ["Emergency contact", viewing.emergencyContact], ["Status", viewing.status], ["Published", viewing.published ? "Yes" : "No"], ["Last active", lastActive(viewing.lastActiveAt)]] as [string, string | null][]).map(([k, v]) => (
                  <InfoRow key={k} label={k} value={v || "—"} />
                ))}
              </InfoList>
              <Separator className="mt-1" />
              <div className="flex flex-col gap-2">
                <SectionTitle action={<Button variant="link" size="sm" asChild className="h-auto p-0"><Link href={`/dashboard/staff/salary?staff=${viewing.id}`}>Open in Salary management →</Link></Button>}>Salary</SectionTitle>
                {!salary ? <Skeleton className="h-16" /> : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[["Monthly", salary.monthly], ["Paid this year", salary.paidThisYear], ["Due now", salary.dueNow]].map(([l, v]) => (
                        <Card key={l as string} className="gap-0 px-2 py-1.5"><div className="text-xs text-muted-foreground">{l}</div><div className="text-sm font-bold tabular-nums">{formatCurrency(Number(v))}</div></Card>
                      ))}
                    </div>
                    {salary.history.length === 0 ? <p className="text-xs text-muted-foreground">No salary records yet.</p> : salary.history.map((h) => (
                      <div key={h.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex flex-col"><span className="font-semibold">{h.label}</span><span className="text-xs text-muted-foreground">{h.detail}</span></span>
                        <span className="flex items-center gap-2"><strong className="tabular-nums">{formatCurrency(h.net)}</strong>
                          <StatusBadge status={h.status} variant={h.status === "paid" ? "default" : "secondary"} />
                          {h.canPay && <Button type="button" size="sm" disabled={payBusy} onClick={() => payOne(h.id)}>Pay</Button>}</span>
                      </div>
                    ))}
                    {(() => {
                      const dueCount = salary.history.filter((h) => h.canPay).length
                      const hasThisMonth = salary.history.some((h) => h.month === monthKey())
                      const canGenerate = !hasThisMonth && salary.monthly > 0 && viewing.status === "Active"
                      if (!dueCount && !canGenerate) return null
                      return (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {canGenerate && <Button type="button" variant="outline" size="sm" disabled={payBusy} onClick={generateThisMonth}>Generate {monthLabel} salary</Button>}
                          {dueCount > 0 && <Button type="button" size="sm" disabled={payBusy} onClick={payAllDue}>Pay all due{dueCount > 1 ? ` (${dueCount})` : ""}</Button>}
                        </div>
                      )
                    })()}
                  </>
                )}
              </div>
            </SectionCard>
          )}

          <div><h2 className="text-lg font-semibold">{editing ? `Edit ${editing.name}` : "Add team member"}</h2>
            {err && <Alert variant="destructive" role="alert" className="mt-2"><AlertDescription>{err}</AlertDescription></Alert>}</div>
          {atSeatLimit && <Alert role="alert"><AlertDescription><p>All {stats?.seatLimit} seats on your plan are used. <Link href="/dashboard/billing/plans" className="underline">Upgrade your plan</Link> to add more team members.</p></AlertDescription></Alert>}
          {editing?.isOnlyOwner && <Alert><AlertDescription>You are the only Owner, so this role and status are locked. Make someone else an Owner first to change them.</AlertDescription></Alert>}
          <div className="grid grid-cols-2 gap-2.5">
            <FormField label="Full name" required htmlFor="staff-name"><Input id="staff-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Rafiq Khan" /></FormField>
            <FormField label="Phone" required htmlFor="staff-phone">
              <InputGroup><InputGroupAddon><InputGroupText>+880</InputGroupText></InputGroupAddon>
                <InputGroupInput id="staff-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="17XX-XXXXXX" /></InputGroup></FormField>
          </div>
          <FormField label="Role" required description={<Link href="/dashboard/staff/roles" className="underline-offset-4 hover:underline">See exactly what each role can do →</Link>}>
            <ChoiceCardGroup aria-label="Role" className="grid-cols-2" disabled={!!editing?.isOnlyOwner} value={form.roleId}
              onValueChange={(id) => setForm((f) => ({ ...f, roleId: id, loginMethod: roleMethod(id) }))}>
              {pickableRoles.map((r) => (
                <ChoiceCard key={r.id} value={String(r.id)} title={r.name} description={r.description || undefined}>
                  <span className="text-xs font-normal text-muted-foreground">{r.memberCount} member{r.memberCount === 1 ? "" : "s"}</span>
                </ChoiceCard>
              ))}
            </ChoiceCardGroup>
          </FormField>
          <FormField label="How they sign in">
            <ChoiceCardGroup aria-label="Login method" className="grid-cols-2" value={form.loginMethod} onValueChange={(id) => set("loginMethod", id)}>
              {([["email", "Email link", "They set their own password"], ["pin", "POS PIN", "Cashiers, no email needed"]] as const).map(([id, label, sub]) => (
                <ChoiceCard key={id} value={id} title={label} description={sub} />
              ))}
            </ChoiceCardGroup>
          </FormField>
          {form.loginMethod === "email" ? (
            <FormField label="Email" required htmlFor="staff-email" description="They get a link to set their own password. You never see it.">
              <Input id="staff-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@example.com" />
            </FormField>
          ) : (
            <FormField label="4-digit POS PIN" htmlFor="staff-pin" description="For cashiers who only use the POS. No email needed.">
              <Input id="staff-pin" inputMode="numeric" maxLength={4} value={form.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} placeholder={editing?.hasPin ? "Leave blank to keep the current PIN" : "e.g. 4821"} />
            </FormField>
          )}
          <FormField label="Can work at">
            <div role="group" aria-label="Locations" className="flex flex-wrap gap-1.5">
              {locations.map((l) => {
                const on = form.locationIds.includes(l.id)
                return <Button key={l.id} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => set("locationIds", on ? form.locationIds.filter((x) => x !== l.id) : [...form.locationIds, l.id])}>{l.name}</Button>
              })}
            </div>
          </FormField>
          <Collapsible asChild>
            <Card className="gap-0 py-0">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="group w-full justify-between">
                  Pay &amp; employment
                  <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" aria-hidden />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-3 px-3.5 pb-3.5 pt-2">
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Joining date" htmlFor="staff-joined"><Input id="staff-joined" type="date" value={form.joined} onChange={(e) => set("joined", e.target.value)} /></FormField>
                  <FormField label="Monthly salary (৳)" htmlFor="staff-salary"><Input id="staff-salary" type="number" min={0} value={form.salary} onChange={(e) => set("salary", e.target.value)} placeholder="0" /></FormField>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <FormField label="Paid by" htmlFor="staff-pay-method"><Select value={form.method} onValueChange={(v) => set("method", v)}><SelectTrigger id="staff-pay-method" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></FormField>
                  <FormField label="Account / wallet no." htmlFor="staff-account"><Input id="staff-account" value={form.account} onChange={(e) => set("account", e.target.value)} placeholder="Optional" /></FormField>
                </div>
                <FormField label="Status" htmlFor="staff-status"><Select disabled={!!editing?.isOnlyOwner} value={form.status} onValueChange={(v) => set("status", v)}><SelectTrigger id="staff-status" className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></FormField>
                <FormField label="NID number" htmlFor="staff-nid"><Input id="staff-nid" value={form.nid} onChange={(e) => set("nid", e.target.value)} placeholder="Optional" /></FormField>
                <FormField label="Emergency contact" htmlFor="staff-emergency"><Input id="staff-emergency" value={form.emergency} onChange={(e) => set("emergency", e.target.value)} placeholder="Name and phone (optional)" /></FormField>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => startEdit(null)}>Clear</Button>
            <Button type="button" disabled={saving || atSeatLimit} onClick={save}>
              {saving ? "Saving…" : editing ? "Save changes" : form.loginMethod === "email" ? "Add & send invite" : "Add team member"}
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogTitle>Activity log</DialogTitle>
          <DialogDescription>When each team member was last active.</DialogDescription>
          <ItemGroup>
            {[...rows].sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "")).map((r, i) => (
              <Fragment key={r.id}>
                {i > 0 && <ItemSeparator />}
                <Item size="sm" className="px-0">
                  <ItemContent><ItemTitle>{r.name}</ItemTitle><ItemDescription>{r.roleName ?? "No role"}</ItemDescription></ItemContent>
                  <ItemActions className="text-sm text-muted-foreground">{lastActive(r.lastActiveAt)}</ItemActions>
                </Item>
              </Fragment>
            ))}
          </ItemGroup>
        </DialogContent>
      </Dialog>
    </div>
  )
}
