"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Clock, Download, Pencil, Search, Scissors, Trash2, Users } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { SegmentedControl } from "@/components/common/SegmentedControl"
import { StatusBadge } from "@/components/common/StatusBadge"
import { FilterBar } from "@/components/common/Toolbar"
import { UserAvatar } from "@/components/common/UserAvatar"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
type Comm = "fixed" | "percentage" | "salary"
const COMMS: { id: Comm; label: string }[] = [
  { id: "fixed", label: "Per piece" }, { id: "percentage", label: "% of stitching" }, { id: "salary", label: "Monthly salary" },
]

/** Bangladesh local digits (no +880 / leading 0) for the phone field; other numbers keep their digits. */
const localPhone = (p: string) => {
  const raw = (p || "").trim()
  const digits = raw.replace(/\D/g, "")
  if (raw.startsWith("+880") || digits.startsWith("880")) return digits.replace(/^880/, "")
  return digits.replace(/^0+/, "")
}

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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Dorjis"
        description="Your tailors — what they are good at, how busy they are, and what you owe them."
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>}
      />

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: "Active dorjis", value: stats.active, icon: <Users className="size-4" />, color: "blue", hint: `${stats.onLeave} on leave` },
          { label: "Pieces in hand", value: stats.piecesInHand, icon: <Scissors className="size-4" />, color: "purple", hint: `Capacity ${stats.capacity}` },
          { label: "Unpaid commission", value: formatCurrency(stats.unpaid), icon: <Clock className="size-4" />, color: "yellow", hint: "For finished pieces" },
          { label: "On-time rate", value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`, icon: <Check className="size-4" />, color: "green", hint: "Finished jobs" },
        ]} />
      )}

      <FilterBar className="gap-2.5">
        <InputGroup className="min-w-[260px] flex-1">
          <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
          <InputGroupInput type="search" aria-label="Search" placeholder="Search name, phone or speciality…" value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(1) }}>
          <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: All</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="on_leave">On leave</SelectItem><SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <section className="grid w-full min-w-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[300px]" />) :
            rows.length === 0 ? (
              <EmptyState bordered icon={Users} className="col-span-full" title="No dorjis found"
                description={qD || statusF !== "all" ? "No dorjis match these filters." : "No dorjis yet. Add your first tailor using the form."} />
            ) : rows.map((d) => {
              const act = d.status === "active"
              const lc = !act ? "[&>[data-slot=progress-indicator]]:bg-muted-foreground/50" : d.workloadPct >= 100 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : d.workloadPct >= 75 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-teal-700"
              const lt = !act ? "text-muted-foreground" : d.workloadPct >= 100 ? "text-destructive" : d.workloadPct >= 75 ? "text-amber-600" : "text-dash-success-fg"
              const comm = d.commissionType === "percentage" ? `${d.commissionValue}% of stitching` : d.commissionType === "salary" ? `${formatCurrency(d.commissionValue)} / month` : `Per piece ${formatCurrency(d.commissionValue)}`
              return (
                <Card key={d.id} className={cn("gap-3 p-[18px]", editing?.id === d.id && "border-primary")}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={d.name} className="size-[46px]" />
                    <div className="min-w-0 flex-1"><div className="truncate text-base font-semibold">{d.name}</div><div className="truncate text-xs text-muted-foreground">{d.phone} · {comm}</div></div>
                    <StatusBadge status={d.status} label={STATUS_LABEL[d.status]} />
                  </div>
                  {d.speciality.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{d.speciality.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}</div>
                  )}
                  {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Workload · {d.activeOrders} active order(s)</span>
                      <strong className={lt}>{d.piecesInHand}{d.maxPieces ? ` / ${d.maxPieces}` : ""} pieces</strong>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, d.workloadPct))} aria-label={`${d.name} workload`} className={cn("mt-1.5", lc)} />
                  </div>
                  <InfoList className="grid-cols-3">
                    <InfoRow layout="stacked" label={<span className="text-xs">Earned ({monthLbl})</span>}><span className="tabular-nums">{formatCurrency(d.earnedMonth)}</span></InfoRow>
                    <InfoRow layout="stacked" label={<span className="text-xs">Unpaid</span>}><span className={cn("tabular-nums", d.unpaid ? "text-dash-warn-fg" : "")}>{formatCurrency(d.unpaid)}</span></InfoRow>
                    <InfoRow layout="stacked" label={<span className="text-xs">On time</span>}>{d.onTimeRate === null ? "—" : `${d.onTimeRate}%`}</InfoRow>
                  </InfoList>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      {canWrite("TailorDorji") && <Button type="button" variant="outline" size="icon" aria-label={`Edit ${d.name}`} onClick={() => startEdit(d)}><Pencil className="size-4" /></Button>}
                      {canWrite("TailorDorji") && <Button type="button" variant="outline" onClick={() => toggleActive(d)} className="min-w-0 flex-1">{act ? "Deactivate" : "Activate"}</Button>}
                      {canDelete("TailorDorji") && <Button type="button" variant="outline" size="icon" aria-label={`Delete ${d.name}`} onClick={() => remove(d)}><Trash2 className="size-4" /></Button>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button asChild variant="outline" className="min-w-0 flex-1"><Link href={`/dashboard/tailor/assignments?dorji=${d.id}`}>View jobs</Link></Button>
                      <Button asChild className="min-w-0 flex-1"><Link href="/dashboard/tailor/payments">Pay&nbsp;{formatCurrency(d.unpaid)}</Link></Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          {!loading && total > 0 && (
            <Card className="col-span-full p-4">
              <PaginationControl currentPage={page} totalPages={pagination?.last_page ?? 1} itemsPerPage={perPage} totalItems={total}
                onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
            </Card>
          )}
        </section>

        {canWrite("TailorDorji") && (
          <SectionCard title={editing ? "Edit dorji" : "Add dorji"} className="w-full shrink-0 xl:w-[380px]" contentClassName="flex flex-col gap-3.5">
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <div className="grid grid-cols-2 gap-3">
              <FormField className="min-w-0" label="Name" required htmlFor="dorji-name"><Input id="dorji-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Full name" /></FormField>
              <FormField className="min-w-0" label="Phone" required htmlFor="dorji-phone">
                <InputGroup>
                  <InputGroupAddon><InputGroupText>+880</InputGroupText></InputGroupAddon>
                  <InputGroupInput id="dorji-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="17XX-XXXXXX" />
                </InputGroup></FormField>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">Specialities</SectionTitle>
              <div role="group" aria-label="Specialities" className="flex flex-wrap gap-1.5">
                {[...SPECS, ...form.spec.filter((s) => !SPECS.includes(s))].map((s) => {
                  const on = form.spec.includes(s)
                  return (
                    <Button key={s} type="button" aria-pressed={on} onClick={() => set("spec", on ? form.spec.filter((x) => x !== s) : [...form.spec, s])}
                      variant={on ? "default" : "outline"} size="sm">
                      {on ? "✓ " : "+ "}{s}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">How you pay</SectionTitle>
              <SegmentedControl aria-label="Commission type" size="default" className="w-full" value={form.comm}
                onValueChange={(v) => set("comm", v as Comm)} options={COMMS.map((o) => ({ value: o.id, label: o.label }))} />
            </div>
            <FormField label={commLabel} htmlFor="dorji-comm" description={commHint}>
              <Input id="dorji-comm" type="number" min="0" value={form.commVal} onChange={(e) => set("commVal", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField className="min-w-0" label="Max pieces at once" htmlFor="dorji-cap"><Input id="dorji-cap" type="number" min="0" value={form.cap} onChange={(e) => set("cap", e.target.value)} placeholder="e.g. 8" /></FormField>
              <FormField className="min-w-0" label="Status" htmlFor="dorji-status">
                <Select value={form.status} onValueChange={(v) => set("status", v as TailorDorjiStatus)}>
                  <SelectTrigger id="dorji-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="on_leave">On leave</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Address" htmlFor="dorji-address"><Input id="dorji-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Area, city" /></FormField>
            <FormField label="Notes" htmlFor="dorji-notes"><Textarea id="dorji-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional — e.g. only works mornings, rush jobs OK" /></FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => startEdit(null)}>Clear</Button>
              <Button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add dorji"}</Button>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
