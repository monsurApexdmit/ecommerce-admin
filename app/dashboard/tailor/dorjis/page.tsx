"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
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
import { WithTooltip } from "@/components/common/WithTooltip"
import { TAILOR_NS, dorjiStatusLabel, garmentLabel, type TailorKey } from "@/components/tailor/i18n"
import { localeTag } from "@/lib/i18n"

/** Speciality values saved to the API (English); shown via garmentLabel(). */
const SPECS = ["Shirt", "Panjabi", "Pant", "Pajama", "Jama", "Kurta", "Blouse", "Salwar Kameez", "Coat", "Embroidery"]
type Comm = "fixed" | "percentage" | "salary"
const COMMS: { id: Comm; label: TailorKey }[] = [
  { id: "fixed", label: "tailor:dorjis.commFixed" }, { id: "percentage", label: "tailor:dorjis.commPercentage" }, { id: "salary", label: "tailor:dorjis.commSalary" },
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
  const { t, i18n } = useTranslation(TAILOR_NS)

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
      toast.error(t("tailor:dorjis.failedLoad"))
    } finally {
      setLoading(false)
    }
  }, [qD, statusF, page, perPage, t])
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
    if (!name) { setErr(t("tailor:shared.nameRequired")); return }
    if (!phone) { setErr(t("tailor:shared.phoneRequired")); return }
    if (!/^[0-9]{6,15}$/.test(phone)) { setErr(t("tailor:shared.validPhone")); return }
    if (form.commVal !== "" && Number(form.commVal) < 0) { setErr(t("tailor:dorjis.negative")); return }
    if (form.cap !== "" && (Number(form.cap) < 0 || !Number.isInteger(Number(form.cap)))) { setErr(t("tailor:dorjis.wholeNumber")); return }
    setSaving(true); setErr("")
    try {
      await tailorWorkshopApi.saveDorji(editing?.id ?? null, {
        name, phone, address: form.address.trim(), notes: form.notes.trim(), speciality: form.spec,
        commissionType: form.comm, commissionValue: Number(form.commVal) || 0, maxPieces: form.cap ? Number(form.cap) : null, status: form.status,
      })
      toast.success(editing ? t("tailor:dorjis.updated") : t("tailor:dorjis.added"))
      startEdit(null)
      load()
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("tailor:dorjis.couldNotSave"))
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (d: DorjiRow) => {
    const next: TailorDorjiStatus = d.status === "active" ? "inactive" : "active"
    try { await tailorWorkshopApi.patchDorji(d.id, { status: next }); toast.success(next === "active" ? t("tailor:dorjis.activated", { name: d.name }) : t("tailor:dorjis.deactivated", { name: d.name })); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("tailor:dorjis.couldNotUpdate")) }
  }

  const remove = async (d: DorjiRow) => {
    if (d.totalJobs) { toast.error(t("tailor:dorjis.hasJobs", { name: d.name, count: d.totalJobs })); return }
    if (!window.confirm(t("tailor:dorjis.deleteConfirm", { name: d.name }))) return
    try { await tailorWorkshopApi.deleteDorji(d.id); toast.success(t("tailor:dorjis.deleted")); if (editing?.id === d.id) startEdit(null); load() }
    catch (e: any) { toast.error(e?.response?.data?.message || t("tailor:shared.couldNotDelete")) }
  }

  const handleExport = async () => {
    try {
      const all = await tailorWorkshopApi.getDorjiOverview({ search: qD || undefined, status: statusF !== "all" ? statusF : undefined, limit: 100 })
      exportToCSV(all.rows.map((d) => ({
        name: d.name, phone: localPhone(d.phone), address: d.address ?? "", skills: d.speciality.join(" / "), status: dorjiStatusLabel(t, d.status),
        commission: d.commissionType === "percentage" ? `${d.commissionValue}%` : d.commissionType === "salary" ? `${t("tailor:dorjis.commSalary")} ${d.commissionValue}` : t("tailor:dorjis.commFixed"),
        rate: d.commissionType === "fixed" ? d.commissionValue : 0, inHand: d.piecesInHand, earnedMonth: d.earnedMonth, unpaid: d.unpaid, notes: d.notes ?? "",
      })), "dorjis", ["name", "phone", "address", "skills", "status", "commission", "rate", "inHand", "earnedMonth", "unpaid", "notes"])
    } catch { toast.error(t("tailor:dorjis.couldNotExport")) }
  }

  if (!canRead("TailorDorji")) return <AccessDenied />
  const monthLbl = new Date().toLocaleDateString(localeTag(i18n.language), { month: "short" })
  const total = pagination?.total ?? 0
  const cur = formatCurrency(0).replace(/[\d.,\s]/g, "")
  const commLabel = form.comm === "fixed" ? t("tailor:dorjis.commLabelFixed", { cur }) : form.comm === "percentage" ? t("tailor:dorjis.commLabelPct") : t("tailor:dorjis.commLabelSalary", { cur })
  const commHint = form.comm === "fixed" ? t("tailor:dorjis.hintFixed") : form.comm === "percentage" ? t("tailor:dorjis.hintPct") : t("tailor:dorjis.hintSalary")

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("tailor:dorjis.title")}
        description={t("tailor:dorjis.description")}
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>}
      />

      {loading || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[110px]" />)}</div>
      ) : (
        <StatsCards stats={[
          { label: t("tailor:dorjis.activeDorjis"), value: stats.active, icon: <Users className="size-4" />, color: "blue", hint: t("tailor:dorjis.onLeaveCount", { count: stats.onLeave }) },
          { label: t("tailor:dorjis.piecesInHand"), value: stats.piecesInHand, icon: <Scissors className="size-4" />, color: "purple", hint: t("tailor:dorjis.capacity", { count: stats.capacity }) },
          { label: t("tailor:dorjis.unpaidCommission"), value: formatCurrency(stats.unpaid), icon: <Clock className="size-4" />, color: "yellow", hint: t("tailor:dorjis.forFinishedPieces") },
          { label: t("tailor:dorjis.onTimeRate"), value: stats.onTimeRate === null ? "—" : `${stats.onTimeRate}%`, icon: <Check className="size-4" />, color: "green", hint: t("tailor:dorjis.finishedJobs") },
        ]} />
      )}

      <FilterBar className="gap-2.5">
        <InputGroup className="min-w-[260px] flex-1">
          <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
          <InputGroupInput type="search" aria-label={t("common:actions.search")} placeholder={t("tailor:dorjis.searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
        </InputGroup>
        <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(1) }}>
          <SelectTrigger aria-label={t("common:fields.status")}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("tailor:dorjis.statusAll")}</SelectItem><SelectItem value="active">{t("tailor:dorjiStatus.active")}</SelectItem><SelectItem value="on_leave">{t("tailor:dorjiStatus.onLeave")}</SelectItem><SelectItem value="inactive">{t("tailor:dorjiStatus.inactive")}</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <div className="flex flex-col items-start gap-4 xl:flex-row">
        <section className="grid w-full min-w-0 flex-1 grid-cols-1 gap-3.5 md:grid-cols-2 2xl:grid-cols-3">
          {loading ? [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[300px]" />) :
            rows.length === 0 ? (
              <EmptyState bordered icon={Users} className="col-span-full" title={t("tailor:dorjis.noDorjisFound")}
                description={qD || statusF !== "all" ? t("tailor:dorjis.noMatch") : t("tailor:dorjis.noDorjisYet")} />
            ) : rows.map((d) => {
              const act = d.status === "active"
              const lc = !act ? "[&>[data-slot=progress-indicator]]:bg-muted-foreground/50" : d.workloadPct >= 100 ? "[&>[data-slot=progress-indicator]]:bg-destructive" : d.workloadPct >= 75 ? "[&>[data-slot=progress-indicator]]:bg-amber-500" : "[&>[data-slot=progress-indicator]]:bg-teal-700"
              const lt = !act ? "text-muted-foreground" : d.workloadPct >= 100 ? "text-destructive" : d.workloadPct >= 75 ? "text-amber-600" : "text-dash-success-fg"
              const comm = d.commissionType === "percentage" ? t("tailor:dorjis.pctOfStitching", { value: d.commissionValue }) : d.commissionType === "salary" ? t("tailor:dorjis.perMonth", { amount: formatCurrency(d.commissionValue) }) : t("tailor:dorjis.perPieceAmount", { amount: formatCurrency(d.commissionValue) })
              return (
                <Card key={d.id} className={cn("gap-3 p-[18px]", editing?.id === d.id && "border-primary")}>
                  <div className="flex items-center gap-3">
                    <UserAvatar name={d.name} className="size-[46px]" />
                    <div className="min-w-0 flex-1"><div className="truncate text-base font-semibold">{d.name}</div><div className="truncate text-xs text-muted-foreground">{d.phone} · {comm}</div></div>
                    <StatusBadge status={d.status} label={dorjiStatusLabel(t, d.status)} />
                  </div>
                  {d.speciality.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">{d.speciality.map((s) => <Badge key={s} variant="secondary">{garmentLabel(t, s)}</Badge>)}</div>
                  )}
                  {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("tailor:dorjis.workloadActive", { count: d.activeOrders })}</span>
                      <strong className={lt}>{d.maxPieces ? t("tailor:dorjis.piecesOfMax", { count: d.piecesInHand, max: d.maxPieces }) : t("tailor:dorjis.pieces", { count: d.piecesInHand })}</strong>
                    </div>
                    <Progress value={Math.min(100, Math.max(0, d.workloadPct))} aria-label={t("tailor:shared.workloadOf", { name: d.name })} className={cn("mt-1.5", lc)} />
                  </div>
                  <InfoList className="grid-cols-3">
                    <InfoRow layout="stacked" label={<span className="text-xs">{t("tailor:dorjis.earned", { month: monthLbl })}</span>}><span className="tabular-nums">{formatCurrency(d.earnedMonth)}</span></InfoRow>
                    <InfoRow layout="stacked" label={<span className="text-xs">{t("tailor:dorjis.unpaid")}</span>}><span className={cn("tabular-nums", d.unpaid ? "text-dash-warn-fg" : "")}>{formatCurrency(d.unpaid)}</span></InfoRow>
                    <InfoRow layout="stacked" label={<span className="text-xs">{t("tailor:dorjis.onTime")}</span>}>{d.onTimeRate === null ? "—" : `${d.onTimeRate}%`}</InfoRow>
                  </InfoList>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      {canWrite("TailorDorji") && <WithTooltip content={t("tailor:shared.editName", { name: d.name })}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:shared.editName", { name: d.name })} onClick={() => startEdit(d)}><Pencil className="size-4" /></Button></WithTooltip>}
                      {canWrite("TailorDorji") && <Button type="button" variant="outline" onClick={() => toggleActive(d)} className="min-w-0 flex-1">{act ? t("tailor:dorjis.deactivate") : t("tailor:dorjis.activate")}</Button>}
                      {canDelete("TailorDorji") && <WithTooltip content={t("tailor:shared.deleteName", { name: d.name })}><Button type="button" variant="outline" size="icon" aria-label={t("tailor:shared.deleteName", { name: d.name })} onClick={() => remove(d)}><Trash2 className="size-4" /></Button></WithTooltip>}
                    </div>
                    <div className="flex gap-1.5">
                      <Button asChild variant="outline" className="min-w-0 flex-1"><Link href={`/dashboard/tailor/assignments?dorji=${d.id}`}>{t("tailor:dorjis.viewJobs")}</Link></Button>
                      <Button asChild className="min-w-0 flex-1"><Link href="/dashboard/tailor/payments" className="truncate">{t("tailor:dorjis.pay", { amount: formatCurrency(d.unpaid) })}</Link></Button>
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
          <SectionCard title={editing ? t("tailor:dorjis.editDorji") : t("tailor:dorjis.addDorji")} className="w-full shrink-0 xl:w-[380px]" contentClassName="flex flex-col gap-3.5">
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <div className="grid grid-cols-2 gap-3">
              <FormField className="min-w-0" label={t("common:fields.name")} required htmlFor="dorji-name"><Input id="dorji-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder={t("tailor:shared.fullName")} /></FormField>
              <FormField className="min-w-0" label={t("common:fields.phone")} required htmlFor="dorji-phone">
                <InputGroup>
                  <InputGroupAddon><InputGroupText>+880</InputGroupText></InputGroupAddon>
                  <InputGroupInput id="dorji-phone" type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="17XX-XXXXXX" />
                </InputGroup></FormField>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">{t("tailor:dorjis.specialities")}</SectionTitle>
              <div role="group" aria-label={t("tailor:dorjis.specialities")} className="flex flex-wrap gap-1.5">
                {[...SPECS, ...form.spec.filter((s) => !SPECS.includes(s))].map((s) => {
                  const on = form.spec.includes(s)
                  return (
                    <Button key={s} type="button" aria-pressed={on} onClick={() => set("spec", on ? form.spec.filter((x) => x !== s) : [...form.spec, s])}
                      variant={on ? "default" : "outline"} size="sm">
                      {on ? "✓ " : "+ "}{garmentLabel(t, s)}
                    </Button>
                  )
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <SectionTitle as="p">{t("tailor:dorjis.howYouPay")}</SectionTitle>
              <SegmentedControl aria-label={t("tailor:dorjis.commissionType")} size="default" className="w-full" value={form.comm}
                onValueChange={(v) => set("comm", v as Comm)} options={COMMS.map((o) => ({ value: o.id, label: t(o.label) }))} />
            </div>
            <FormField label={commLabel} htmlFor="dorji-comm" description={commHint}>
              <Input id="dorji-comm" type="number" min="0" value={form.commVal} onChange={(e) => set("commVal", e.target.value)} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField className="min-w-0" label={t("tailor:dorjis.maxPieces")} htmlFor="dorji-cap"><Input id="dorji-cap" type="number" min="0" value={form.cap} onChange={(e) => set("cap", e.target.value)} placeholder={t("tailor:dorjis.maxPlaceholder")} /></FormField>
              <FormField className="min-w-0" label={t("common:fields.status")} htmlFor="dorji-status">
                <Select value={form.status} onValueChange={(v) => set("status", v as TailorDorjiStatus)}>
                  <SelectTrigger id="dorji-status" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="active">{t("tailor:dorjiStatus.active")}</SelectItem><SelectItem value="on_leave">{t("tailor:dorjiStatus.onLeave")}</SelectItem><SelectItem value="inactive">{t("tailor:dorjiStatus.inactive")}</SelectItem></SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label={t("common:fields.address")} htmlFor="dorji-address"><Input id="dorji-address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder={t("tailor:dorjis.addressPlaceholder")} /></FormField>
            <FormField label={t("common:fields.notes")} htmlFor="dorji-notes"><Textarea id="dorji-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder={t("tailor:dorjis.notesPlaceholder")} /></FormField>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => startEdit(null)}>{t("common:actions.clear")}</Button>
              <Button type="button" onClick={save} disabled={saving}>{saving ? t("common:actions.saving") : editing ? t("common:actions.saveChanges") : t("tailor:dorjis.addDorji")}</Button>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  )
}
