"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
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

const ACTIONS = ["View", "Create", "Edit", "Delete"] as const
type Act = (typeof ACTIONS)[number]
const KEY: Record<Act, keyof MatrixCell> = { View: "view", Create: "create", Edit: "edit", Delete: "delete" }
const SENS: { key: keyof RoleMatrix["sensitive"]; label: string; sub: string }[] = [
  { key: "cost", label: "See cost price & profit", sub: "Otherwise only selling prices are shown" },
  { key: "discount", label: "Give discounts", sub: "Up to 10% without owner approval" },
  { key: "refund", label: "Approve refunds", sub: "Return money to customers" },
  { key: "void", label: "Void a completed sale", sub: "Logged and shown to the owner" },
  { key: "export", label: "Export data", sub: "Download customer and sales lists" },
]
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
const TEMPLATES: { id: string; label: string; build: (mods: string[]) => Record<string, MatrixCell>; sens: RoleMatrix["sensitive"] }[] = [
  { id: "sales", label: "Sales manager", sens: { cost: false, discount: true, refund: true, export: false, void: false },
    build: () => merge(grant(["POS", "Sales", "Orders", "Shipments", "Customers"], ["View", "Create", "Edit"]), grant(["Products", "Coupons", "Stock", "Returns"], ["View"]), grant(["Returns"], ["Create"]), grant(["Dues", "Reports"], ["View"])) },
  { id: "cashier", label: "Cashier", sens: NO_SENS,
    build: () => merge(grant(["POS"], ["View", "Create"]), grant(["Customers"], ["View", "Create"]), grant(["Products"], ["View"])) },
  { id: "store", label: "Store keeper", sens: { cost: true, discount: false, refund: false, export: true, void: false },
    build: () => merge(grant(["Stock", "Suppliers & POs", "Returns"], ["View", "Create", "Edit"]), grant(["Products", "Categories & brands", "Print barcode"], ["View", "Create", "Edit"]), grant(["Orders", "Shipments"], ["View"])) },
  { id: "tailor", label: "Tailor manager", sens: { cost: false, discount: true, refund: false, export: false, void: false },
    build: () => merge(grant(["Tailor shop"], ["View", "Create", "Edit"]), grant(["Customers"], ["View", "Create"]), grant(["POS"], ["View", "Create"])) },
]


export default function RolesPage() {
  const blocked = useModuleGuard("Staff")

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
      toast.error(e?.response?.data?.message || "Could not load the role")
    } finally { setLoadingRole(false) }
  }, [])

  useEffect(() => {
    (async () => {
      try { setGroups(await staffUiApi.getMatrixModules()) } catch { /* grid stays empty */ }
      const list = await loadRoles()
      const first = list.find((r) => r.name.toLowerCase() !== "owner") ?? list[0]
      if (first) openRole(first.id)
    })()
  }, [loadRoles, openRole])

  const cell = (m: string): MatrixCell => (locked ? { view: true, create: true, edit: true, delete: true } : matrix[m] ?? emptyCell())
  const edit = (fn: () => void) => { if (locked) { toast.error("The Owner role can’t be changed."); return }; touched.current = true; fn(); if (isNew) setDirty(true) }

  // Existing roles save every toggle immediately; a failed save rolls the grid back to the last saved state.
  useEffect(() => {
    if (!touched.current || isNew || !curId || locked) return
    const t = setTimeout(async () => {
      touched.current = false
      setAutoSaving(true)
      try {
        await staffUiApi.saveRoleMatrix(curId, { name: name.trim() || undefined, description: desc.trim(), matrix, sensitive: sens })
        savedRef.current = { matrix, sens }
      } catch (e: any) {
        setMatrix(savedRef.current.matrix); setSens(savedRef.current.sens)
        toast.error(e?.response?.data?.message || "Could not save that change — reverted")
      } finally { setAutoSaving(false) }
    }, 250)
    return () => clearTimeout(t)
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

  const startNew = () => { setIsNew(true); setCurId(null); setName(""); setDesc("Custom role"); setMatrix({}); setSens(NO_SENS); setLocked(false); setMemberCount(0); setDirty(true) }
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => { if (locked) return; touched.current = true; setMatrix(t.build(modules)); setSens(t.sens); if (isNew) setDirty(true) }

  const save = async () => {
    if (!name.trim()) { toast.error("Give the role a name."); return }
    setSaving(true)
    try {
      if (isNew) {
        const created = await staffUiApi.createRole({ name: name.trim(), description: desc.trim() || undefined, matrix, sensitive: sens })
        toast.success("Role created")
        await loadRoles(); await openRole(created.id)
      } else if (curId) {
        await staffUiApi.saveRoleMatrix(curId, { name: name.trim(), description: desc.trim(), matrix, sensitive: sens })
        toast.success("Role saved")
        await loadRoles(); setDirty(false); savedRef.current = { matrix, sens }
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Could not save the role")
    } finally { setSaving(false) }
  }

  const duplicate = async () => {
    if (!curId) return
    try { const r = await staffUiApi.duplicateRole(curId); toast.success(`Created “${r.name}”`); await loadRoles(); await openRole(r.id) }
    catch (e: any) { toast.error(e?.response?.data?.message || "Could not duplicate") }
  }
  const remove = async () => {
    if (!curId) return
    if (!window.confirm(`Delete the role “${name}”?`)) return
    try {
      await staffRoleApi.delete(curId)
      toast.success("Role deleted")
      const list = await loadRoles()
      const next = list[0]
      if (next) openRole(next.id); else { setCurId(null); setName("") }
    } catch (e: any) { toast.error(e?.response?.data?.message || "Could not delete the role") }
  }

  const visibleRoles = roles.filter((r) => !rq.trim() || r.name.toLowerCase().includes(rq.trim().toLowerCase()))
  const areaCount = modules.filter((m) => { const c = cell(m); return c.view || c.create || c.edit || c.delete }).length
  const sensCount = SENS.filter((s) => (locked ? true : !!sens[s.key])).length

  if (blocked) return blocked

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Roles & permissions"
        description="Decide who can see and change what. Ticking Create, Edit or Delete also turns on View."
        actions={<Button type="button" onClick={startNew}><Plus className="size-4" aria-hidden /> Add role</Button>}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <Card className="w-full shrink-0 gap-2 p-3 xl:w-[300px]">
          <Input type="search" aria-label="Search roles" value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Search by role name" />
          {loading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />) : visibleRoles.length === 0 ? <EmptyState title="No roles found" className="p-4 md:p-6" /> :
            visibleRoles.map((r) => {
              const isOwner = r.name.toLowerCase() === "owner" || r.locked
              return (
                <Button key={r.id} type="button" variant={curId === r.id && !isNew ? "secondary" : "ghost"} aria-pressed={curId === r.id && !isNew} onClick={() => openRole(r.id)}
                  className="h-auto w-full justify-between gap-3 whitespace-normal text-left">
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{r.name}{isOwner && <Badge variant="outline" className="ml-1.5">Locked</Badge>}</span>
                    <span className="truncate text-xs text-muted-foreground">{r.description || "Custom role"}</span>
                  </span>
                  <Badge variant="secondary" className="tabular-nums">{r.memberCount ?? 0}</Badge>
                </Button>
              )
            })}
          <Button type="button" variant="outline" onClick={startNew} className="mt-1">+ New role</Button>
        </Card>

        <Card className="w-full min-w-0 flex-1 p-5">
          {!curId && !isNew ? <EmptyState title="Pick a role, or add a new one." /> : loadingRole ? <Skeleton className="h-96" /> : (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Role name" htmlFor="role-name"><Input id="role-name" value={name} disabled={locked} onChange={(e) => { setName(e.target.value); setDirty(true) }} /></FormField>
                <FormField label="Start from a template">
                  <div role="group" aria-label="Templates" className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((t) => <Button key={t.id} type="button" variant="outline" size="sm" disabled={locked} onClick={() => applyTemplate(t)}>{t.label}</Button>)}
                  </div>
                </FormField>
              </div>
              {locked && <Alert><AlertDescription>The Owner role always has full access and can’t be changed.</AlertDescription></Alert>}

              <div className="overflow-x-auto rounded-md border">
                <Table className="min-w-[560px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3">Area</TableHead>
                      {ACTIONS.map((a) => (
                        <TableHead key={a} className="px-3 text-center">
                          <WithTooltip content={`Toggle ${a} for every area`}>
                            <Button type="button" variant="ghost" size="sm" aria-pressed={modules.length > 0 && modules.every((m) => cell(m)[KEY[a]])} onClick={() => flipColumn(a)}>{a}</Button>
                          </WithTooltip>
                        </TableHead>
                      ))}
                      <TableHead className="px-3 text-center">Full</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((g) => (
                      <Fragment key={g.group}>
                        <TableRow><TableCell colSpan={6} className="bg-muted/50 px-3 py-1.5"><SectionTitle as="p">{g.group}</SectionTitle></TableCell></TableRow>
                        {g.modules.map((m) => {
                          const c = cell(m.name)
                          const full = c.view && c.create && c.edit && c.delete
                          return (
                            <TableRow key={m.name}>
                              <TableCell className="px-3"><div className="font-semibold">{m.name}</div><div className="text-xs text-muted-foreground">{m.summary}</div></TableCell>
                              {ACTIONS.map((a) => (
                                <TableCell key={a} className="px-3 text-center">
                                  <Checkbox checked={c[KEY[a]]} aria-label={`${a} ${m.name}`} onCheckedChange={() => flipCell(m.name, a)} />
                                </TableCell>
                              ))}
                              <TableCell className="px-3 text-center">
                                <Switch checked={full} aria-label={`Full access to ${m.name}`} onCheckedChange={() => flipFull(m.name)} />
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
                <SectionTitle>Sensitive actions</SectionTitle>
                {SENS.map((s) => {
                  const on = locked ? true : !!sens[s.key]
                  return (
                    <Item key={s.key} variant="outline" size="sm" asChild>
                      <Label htmlFor={`sens-${s.key}`}>
                        <ItemContent><ItemTitle>{s.label}</ItemTitle><ItemDescription>{s.sub}</ItemDescription></ItemContent>
                        <ItemActions><Switch id={`sens-${s.key}`} checked={on} onCheckedChange={() => edit(() => setSens((cur) => ({ ...cur, [s.key]: !cur[s.key] })))} /></ItemActions>
                      </Label>
                    </Item>
                  )
                })}
              </div>

              <Separator />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Can open {areaCount} of {modules.length} areas · {sensCount} sensitive action{sensCount === 1 ? "" : "s"} allowed · {memberCount} member{memberCount === 1 ? "" : "s"}{autoSaving ? " · saving…" : dirty ? " · unsaved name/description" : isNew ? "" : " · changes save automatically"}</span>
                <div className="flex gap-2">
                  {!isNew && <Button type="button" variant="destructive" disabled={locked} onClick={remove}>Delete</Button>}
                  {!isNew && <Button type="button" variant="outline" onClick={duplicate}>Duplicate</Button>}
                  <Button type="button" disabled={saving || locked} onClick={save}>{saving ? "Saving…" : "Save role"}</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
