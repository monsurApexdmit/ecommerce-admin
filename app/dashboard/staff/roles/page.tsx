"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { Skeleton } from "@/components/ui/skeleton"
import { staffRoleApi, staffUiApi, type MatrixCell, type MatrixModuleGroup, type RoleMatrix, type StaffRoleResponse } from "@/lib/staffApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionTitle } from "@/components/common/SectionTitle"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type K = ParseKeys<["account", "common"]>
const ACTIONS = ["View", "Create", "Edit", "Delete"] as const
type Act = (typeof ACTIONS)[number]
const KEY: Record<Act, keyof MatrixCell> = { View: "view", Create: "create", Edit: "edit", Delete: "delete" }
const ACT_LABEL: Record<Act, K> = { View: "common:actions.view", Create: "common:actions.create", Edit: "common:actions.edit", Delete: "common:actions.delete" }
const SENS: { key: keyof RoleMatrix["sensitive"]; label: K; sub: K }[] = [
  { key: "cost", label: "account:roles.sens.cost", sub: "account:roles.sens.costSub" },
  { key: "discount", label: "account:roles.sens.discount", sub: "account:roles.sens.discountSub" },
  { key: "refund", label: "account:roles.sens.refund", sub: "account:roles.sens.refundSub" },
  { key: "void", label: "account:roles.sens.void", sub: "account:roles.sens.voidSub" },
  { key: "export", label: "account:roles.sens.export", sub: "account:roles.sens.exportSub" },
]
// Module / group names come from the backend and are the matrix keys (access codes); only their display is translated.
const MODULE_KEY: Record<string, { name: K; summary: K }> = {
  "POS": { name: "account:roles.modules.pos.name", summary: "account:roles.modules.pos.summary" },
  "Sales": { name: "account:roles.modules.sales.name", summary: "account:roles.modules.sales.summary" },
  "Orders": { name: "account:roles.modules.orders.name", summary: "account:roles.modules.orders.summary" },
  "Shipments": { name: "account:roles.modules.shipments.name", summary: "account:roles.modules.shipments.summary" },
  "Customers": { name: "account:roles.modules.customers.name", summary: "account:roles.modules.customers.summary" },
  "Ad order links": { name: "account:roles.modules.adLinks.name", summary: "account:roles.modules.adLinks.summary" },
  "Products": { name: "account:roles.modules.products.name", summary: "account:roles.modules.products.summary" },
  "Categories & brands": { name: "account:roles.modules.categories.name", summary: "account:roles.modules.categories.summary" },
  "Collections": { name: "account:roles.modules.collections.name", summary: "account:roles.modules.collections.summary" },
  "Coupons": { name: "account:roles.modules.coupons.name", summary: "account:roles.modules.coupons.summary" },
  "Print barcode": { name: "account:roles.modules.barcode.name", summary: "account:roles.modules.barcode.summary" },
  "Stock": { name: "account:roles.modules.stock.name", summary: "account:roles.modules.stock.summary" },
  "Suppliers & POs": { name: "account:roles.modules.suppliers.name", summary: "account:roles.modules.suppliers.summary" },
  "Returns": { name: "account:roles.modules.returns.name", summary: "account:roles.modules.returns.summary" },
  "Tailor shop": { name: "account:roles.modules.tailor.name", summary: "account:roles.modules.tailor.summary" },
  "Accounts & ledger": { name: "account:roles.modules.accounts.name", summary: "account:roles.modules.accounts.summary" },
  "Expenses": { name: "account:roles.modules.expenses.name", summary: "account:roles.modules.expenses.summary" },
  "Dues": { name: "account:roles.modules.dues.name", summary: "account:roles.modules.dues.summary" },
  "Reports": { name: "account:roles.modules.reports.name", summary: "account:roles.modules.reports.summary" },
  "Staff": { name: "account:roles.modules.staff.name", summary: "account:roles.modules.staff.summary" },
  "Roles & permissions": { name: "account:roles.modules.roles.name", summary: "account:roles.modules.roles.summary" },
  "Salary": { name: "account:roles.modules.salary.name", summary: "account:roles.modules.salary.summary" },
  "Settings": { name: "account:roles.modules.settings.name", summary: "account:roles.modules.settings.summary" },
  "Store": { name: "account:roles.modules.store.name", summary: "account:roles.modules.store.summary" },
  "Pages": { name: "account:roles.modules.pages.name", summary: "account:roles.modules.pages.summary" },
  "Support": { name: "account:roles.modules.support.name", summary: "account:roles.modules.support.summary" },
  "Notifications": { name: "account:roles.modules.notifications.name", summary: "account:roles.modules.notifications.summary" },
}
const GROUP_KEY: Record<string, K> = {
  Sell: "account:roles.groups.sell", Marketing: "account:roles.groups.marketing", Catalog: "account:roles.groups.catalog",
  Inventory: "account:roles.groups.inventory", Finance: "account:roles.groups.finance", Workspace: "account:roles.groups.workspace",
}
// Default description the page sends for a new role (stored as-is); shown translated
const DEFAULT_ROLE_DESC = "Custom role"
const NO_SENS: RoleMatrix["sensitive"] = { cost: false, discount: false, refund: false, export: false, void: false }
const emptyCell = (): MatrixCell => ({ view: false, create: false, edit: false, delete: false })

const grant = (mods: string[], acts: Act[]): Record<string, MatrixCell> =>
  Object.fromEntries(mods.map((m) => [m, Object.fromEntries(acts.map((a) => [KEY[a], true])) as unknown as MatrixCell]))
const merge = (...os: Record<string, Partial<MatrixCell>>[]) => {
  const r: Record<string, MatrixCell> = {}
  os.forEach((o) => Object.keys(o).forEach((m) => { r[m] = { ...(r[m] ?? emptyCell()), ...o[m] } }))
  return r
}
// Same starting points as the design: a template only pre-fills the grid, nothing is saved until Save role.
const TEMPLATES: { id: string; label: K; build: (mods: string[]) => Record<string, MatrixCell>; sens: RoleMatrix["sensitive"] }[] = [
  { id: "sales", label: "account:roles.templates.sales", sens: { cost: false, discount: true, refund: true, export: false, void: false },
    build: () => merge(grant(["POS", "Sales", "Orders", "Shipments", "Customers"], ["View", "Create", "Edit"]), grant(["Products", "Coupons", "Stock", "Returns"], ["View"]), grant(["Returns"], ["Create"]), grant(["Dues", "Reports"], ["View"])) },
  { id: "cashier", label: "account:roles.templates.cashier", sens: NO_SENS,
    build: () => merge(grant(["POS"], ["View", "Create"]), grant(["Customers"], ["View", "Create"]), grant(["Products"], ["View"])) },
  { id: "store", label: "account:roles.templates.store", sens: { cost: true, discount: false, refund: false, export: true, void: false },
    build: () => merge(grant(["Stock", "Suppliers & POs", "Returns"], ["View", "Create", "Edit"]), grant(["Products", "Categories & brands", "Print barcode"], ["View", "Create", "Edit"]), grant(["Orders", "Shipments"], ["View"])) },
  { id: "tailor", label: "account:roles.templates.tailor", sens: { cost: false, discount: true, refund: false, export: false, void: false },
    build: () => merge(grant(["Tailor shop"], ["View", "Create", "Edit"]), grant(["Customers"], ["View", "Create"]), grant(["POS"], ["View", "Create"])) },
]


export default function RolesPage() {
  const blocked = useModuleGuard("Staff")
  const { t } = useTranslation(["account", "common"])
  const modName = (m: string) => (MODULE_KEY[m] ? t(MODULE_KEY[m].name) : m)
  const modSummary = (m: string, raw: string) => (MODULE_KEY[m] ? t(MODULE_KEY[m].summary) : raw)
  const groupName = (g: string) => (GROUP_KEY[g] ? t(GROUP_KEY[g]) : g)
  const descLabel = (d?: string | null) => (!d || d === DEFAULT_ROLE_DESC ? t("account:roles.customRole") : d)

  const [roles, setRoles] = useState<StaffRoleResponse[]>([])
  const [groups, setGroups] = useState<MatrixModuleGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [rq, setRq] = useState("")
  const [curId, setCurId] = useState<number | null>(null)
  const [loadingRole, setLoadingRole] = useState(false)

  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [matrix, setMatrix] = useState<Record<string, MatrixCell>>({})
  const [sens, setSens] = useState<RoleMatrix["sensitive"]>(NO_SENS)
  const [locked, setLocked] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [isNew, setIsNew] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const touched = useRef(false)
  const savedRef = useRef<{ matrix: Record<string, MatrixCell>; sens: RoleMatrix["sensitive"] }>({ matrix: {}, sens: NO_SENS })
  const [autoSaving, setAutoSaving] = useState(false)

  const modules = useMemo(() => groups.flatMap((g) => g.modules.map((m) => m.name)), [groups])

  const loadRoles = useCallback(async () => {
    try {
      const res = await staffRoleApi.getAll({ limit: 200 } as any)
      setRoles(res.data ?? [])
      return res.data ?? []
    } catch { setRoles([]); return [] } finally { setLoading(false) }
  }, [])

  const openRole = useCallback(async (id: number) => {
    setCurId(id); setIsNew(false); setLoadingRole(true)
    try {
      const m = await staffUiApi.getRoleMatrix(id)
      setName(m.name); setDesc(m.description ?? ""); setMatrix(m.matrix ?? {}); setSens({ ...NO_SENS, ...m.sensitive }); setLocked(m.locked); setMemberCount(m.memberCount); setDirty(false); touched.current = false; savedRef.current = { matrix: m.matrix ?? {}, sens: { ...NO_SENS, ...m.sensitive } }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("account:roles.loadFailed"))
    } finally { setLoadingRole(false) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      try { setGroups(await staffUiApi.getMatrixModules()) } catch { /* grid stays empty */ }
      const list = await loadRoles()
      const first = list.find((r) => r.name.toLowerCase() !== "owner") ?? list[0]
      if (first) openRole(first.id)
    })()
  }, [loadRoles, openRole])

  const cell = (m: string): MatrixCell => (locked ? { view: true, create: true, edit: true, delete: true } : matrix[m] ?? emptyCell())
  const edit = (fn: () => void) => { if (locked) { toast.error(t("account:roles.ownerToast")); return }; touched.current = true; fn(); if (isNew) setDirty(true) }

  // Existing roles save every toggle immediately; a failed save rolls the grid back to the last saved state.
  useEffect(() => {
    if (!touched.current || isNew || !curId || locked) return
    const timer = setTimeout(async () => {
      touched.current = false
      setAutoSaving(true)
      try {
        await staffUiApi.saveRoleMatrix(curId, { name: name.trim() || undefined, description: desc.trim(), matrix, sensitive: sens })
        savedRef.current = { matrix, sens }
      } catch (e: any) {
        setMatrix(savedRef.current.matrix); setSens(savedRef.current.sens)
        toast.error(e?.response?.data?.message || t("account:roles.reverted"))
      } finally { setAutoSaving(false) }
    }, 250)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix, sens])

  const flipCell = (m: string, a: Act) => edit(() => setMatrix((cur) => {
    const c = { ...(cur[m] ?? emptyCell()) }
    const k = KEY[a]
    c[k] = !c[k]
    if (a === "View" && !c.view) { c.create = false; c.edit = false; c.delete = false }
    if (a !== "View" && c[k]) c.view = true
    return { ...cur, [m]: c }
  }))
  const flipFull = (m: string) => edit(() => setMatrix((cur) => {
    const c = cell(m)
    const all = c.view && c.create && c.edit && c.delete
    return { ...cur, [m]: all ? emptyCell() : { view: true, create: true, edit: true, delete: true } }
  }))
  const flipColumn = (a: Act) => edit(() => setMatrix((cur) => {
    const on = modules.every((m) => (cur[m] ?? emptyCell())[KEY[a]])
    const next: Record<string, MatrixCell> = {}
    modules.forEach((m) => {
      const c = { ...(cur[m] ?? emptyCell()) }
      c[KEY[a]] = !on
      if (a === "View" && on) { c.create = false; c.edit = false; c.delete = false }
      if (a !== "View" && !on) c.view = true
      next[m] = c
    })
    return next
  }))

  const startNew = () => { setIsNew(true); setCurId(null); setName(""); setDesc(DEFAULT_ROLE_DESC); setMatrix({}); setSens(NO_SENS); setLocked(false); setMemberCount(0); setDirty(true) }
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => { if (locked) return; touched.current = true; setMatrix(t.build(modules)); setSens(t.sens); if (isNew) setDirty(true) }

  const save = async () => {
    if (!name.trim()) { toast.error(t("account:roles.nameRequired")); return }
    setSaving(true)
    try {
      if (isNew) {
        const created = await staffUiApi.createRole({ name: name.trim(), description: desc.trim() || undefined, matrix, sensitive: sens })
        toast.success(t("account:roles.created"))
        await loadRoles(); await openRole(created.id)
      } else if (curId) {
        await staffUiApi.saveRoleMatrix(curId, { name: name.trim(), description: desc.trim(), matrix, sensitive: sens })
        toast.success(t("account:roles.saved"))
        await loadRoles(); setDirty(false); savedRef.current = { matrix, sens }
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t("account:roles.saveFailed"))
    } finally { setSaving(false) }
  }

  const duplicate = async () => {
    if (!curId) return
    try { const r = await staffUiApi.duplicateRole(curId); toast.success(t("account:roles.duplicated", { name: r.name })); await loadRoles(); await openRole(r.id) }
    catch (e: any) { toast.error(e?.response?.data?.message || t("account:roles.duplicateFailed")) }
  }
  const remove = async () => {
    if (!curId) return
    if (!window.confirm(t("account:roles.deleteConfirm", { name }))) return
    try {
      await staffRoleApi.delete(curId)
      toast.success(t("account:roles.deleted"))
      const list = await loadRoles()
      const next = list[0]
      if (next) openRole(next.id); else { setCurId(null); setName("") }
    } catch (e: any) { toast.error(e?.response?.data?.message || t("account:roles.deleteFailed")) }
  }

  const visibleRoles = roles.filter((r) => !rq.trim() || r.name.toLowerCase().includes(rq.trim().toLowerCase()))
  const areaCount = modules.filter((m) => { const c = cell(m); return c.view || c.create || c.edit || c.delete }).length
  const sensCount = SENS.filter((s) => (locked ? true : !!sens[s.key])).length

  if (blocked) return blocked

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("account:roles.title")}
        description={t("account:roles.description")}
        actions={<Button type="button" onClick={startNew}><Plus className="size-4" aria-hidden /> {t("account:roles.addRole")}</Button>}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full shrink-0 gap-2 p-3 xl:w-[300px]">
          <Input type="search" aria-label={t("account:roles.searchAria")} value={rq} onChange={(e) => setRq(e.target.value)} placeholder={t("account:roles.searchPlaceholder")} />
          {loading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />) : visibleRoles.length === 0 ? <EmptyState title={t("account:roles.noRoles")} className="p-4 md:p-6" /> :
            visibleRoles.map((r) => {
              const isOwner = r.name.toLowerCase() === "owner" || r.locked
              return (
                <Button key={r.id} type="button" variant={curId === r.id && !isNew ? "secondary" : "ghost"} aria-pressed={curId === r.id && !isNew} onClick={() => openRole(r.id)}
                  className="h-auto w-full justify-between gap-3 whitespace-normal text-left">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{r.name}{isOwner && <Badge variant="outline" className="ml-1.5">{t("account:roles.locked")}</Badge>}</span>
                    <span className="truncate text-xs text-muted-foreground">{descLabel(r.description)}</span>
                  </span>
                  <Badge variant="secondary" className="tabular-nums">{r.memberCount ?? 0}</Badge>
                </Button>
              )
            })}
          <Button type="button" variant="outline" onClick={startNew} className="mt-1">{t("account:roles.newRole")}</Button>
        </Card>

        <Card className="w-full min-w-0 flex-1 p-5">
          {!curId && !isNew ? <EmptyState title={t("account:roles.pickRole")} /> : loadingRole ? <Skeleton className="h-96" /> : (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t("account:roles.roleName")} htmlFor="role-name"><Input id="role-name" value={name} disabled={locked} onChange={(e) => { setName(e.target.value); setDirty(true) }} /></FormField>
                <FormField label={t("account:roles.template")}>
                  <div role="group" aria-label={t("account:roles.templatesAria")} className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((tp) => <Button key={tp.id} type="button" variant="outline" size="sm" disabled={locked} onClick={() => applyTemplate(tp)}>{t(tp.label)}</Button>)}
                  </div>
                </FormField>
              </div>
              {locked && <Alert><AlertDescription>{t("account:roles.ownerLocked")}</AlertDescription></Alert>}

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">{t("account:roles.area")}</TableHead>
                      {ACTIONS.map((a) => (
                        <TableHead key={a} className="px-3 text-center">
                          <WithTooltip content={t("account:roles.toggleColumn", { action: t(ACT_LABEL[a]) })}>
                            <Button type="button" variant="ghost" size="sm" aria-pressed={modules.length > 0 && modules.every((m) => cell(m)[KEY[a]])} onClick={() => flipColumn(a)}>{t(ACT_LABEL[a])}</Button>
                          </WithTooltip>
                        </TableHead>
                      ))}
                      <TableHead className="px-3 text-center">{t("account:roles.full")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => (
                      <Fragment key={g.group}>
                        <TableRow><TableCell colSpan={6} className="bg-muted/50 px-3 py-1.5"><SectionTitle as="p">{groupName(g.group)}</SectionTitle></TableCell></TableRow>
                        {g.modules.map((m) => {
                          const c = cell(m.name)
                          const full = c.view && c.create && c.edit && c.delete
                          return (
                            <TableRow key={m.name}>
                              <TableCell className="px-3"><div className="font-semibold">{modName(m.name)}</div><div className="text-xs text-muted-foreground">{modSummary(m.name, m.summary)}</div></TableCell>
                              {ACTIONS.map((a) => (
                                <TableCell key={a} className="px-3 text-center">
                                  <Checkbox checked={c[KEY[a]]} aria-label={t("account:roles.cellAria", { action: t(ACT_LABEL[a]), module: modName(m.name) })} onCheckedChange={() => flipCell(m.name, a)} />
                                </TableCell>
                              ))}
                              <TableCell className="px-3 text-center">
                                <Switch checked={full} aria-label={t("account:roles.fullAria", { module: modName(m.name) })} onCheckedChange={() => flipFull(m.name)} />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-2">
                <SectionTitle>{t("account:roles.sensitive")}</SectionTitle>
                {SENS.map((s) => {
                  const on = locked ? true : !!sens[s.key]
                  return (
                    <Item key={s.key} variant="outline" size="sm" asChild>
                      <Label htmlFor={`sens-${s.key}`}>
                        <ItemContent><ItemTitle>{t(s.label)}</ItemTitle><ItemDescription>{t(s.sub)}</ItemDescription></ItemContent>
                        <ItemActions><Switch id={`sens-${s.key}`} checked={on} onCheckedChange={() => edit(() => setSens((cur) => ({ ...cur, [s.key]: !cur[s.key] })))} /></ItemActions>
                      </Label>
                    </Item>
                  )
                })}
              </div>

              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{[
                  t("account:roles.areasOpen", { count: areaCount, total: modules.length }),
                  t("account:roles.sensAllowed", { count: sensCount }),
                  t("account:roles.members", { count: memberCount }),
                  autoSaving ? t("account:roles.savingNote") : dirty ? t("account:roles.unsavedNote") : isNew ? "" : t("account:roles.autoNote"),
                ].filter(Boolean).join(" · ")}</span>
                <div className="flex gap-2">
                  {!isNew && <Button type="button" variant="destructive" disabled={locked} onClick={remove}>{t("common:actions.delete")}</Button>}
                  {!isNew && <Button type="button" variant="outline" onClick={duplicate}>{t("common:actions.duplicate")}</Button>}
                  <Button type="button" disabled={saving || locked} onClick={save}>{saving ? t("common:actions.saving") : t("account:roles.saveRole")}</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
