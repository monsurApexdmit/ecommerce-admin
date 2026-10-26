"use client"

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { staffRoleApi, staffUiApi, type MatrixCell, type MatrixModuleGroup, type RoleMatrix, type StaffRoleResponse } from "@/lib/staffApi"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { cn } from "@/lib/utils"

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

const input = "h-[42px] w-full rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm font-normal outline-none focus-visible:border-dash-accent"
const outlineBtn = "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-[13px] font-semibold hover:bg-dash-neutral-soft"

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
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Roles &amp; permissions</h1>
          <p className="mt-1 text-sm text-dash-muted">Decide who can see and change what. Ticking Create, Edit or Delete also turns on View.</p>
        </div>
        <button type="button" onClick={startNew} className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white"><Plus className="size-4" aria-hidden /> Add role</button>
      </div>

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <section className="flex w-full shrink-0 flex-col gap-2 rounded-[14px] border border-dash-border bg-dash-card p-3 xl:w-[300px]">
          <label className="flex h-11 items-center rounded-[10px] border border-dash-border bg-dash-bg px-3.5">
            <span className="sr-only">Search roles</span>
            <input type="search" value={rq} onChange={(e) => setRq(e.target.value)} placeholder="Search by role name" className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-dash-muted" />
          </label>
          {loading ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />) : visibleRoles.length === 0 ? <p className="py-6 text-center text-sm text-dash-muted">No roles found</p> :
            visibleRoles.map((r) => {
              const isOwner = r.name.toLowerCase() === "owner" || r.locked
              return (
                <button key={r.id} type="button" aria-pressed={curId === r.id && !isNew} onClick={() => openRole(r.id)}
                  className={cn("flex items-center justify-between gap-3 rounded-xl border-2 px-3 py-2.5 text-left", curId === r.id && !isNew ? "border-dash-accent bg-dash-accent-soft/40" : "border-transparent hover:bg-dash-neutral-soft")}>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold">{r.name}{isOwner && <span className="ml-1.5 rounded-full bg-dash-neutral-soft px-2 py-px text-[11px] font-bold text-dash-neutral-fg">Locked</span>}</span>
                    <span className="truncate text-xs text-dash-muted">{r.description || "Custom role"}</span>
                  </span>
                  <span className="flex size-7 items-center justify-center rounded-full bg-dash-neutral-soft text-xs font-bold tabular-nums">{r.memberCount ?? 0}</span>
                </button>
              )
            })}
          <button type="button" onClick={startNew} className="mt-1 h-10 rounded-[10px] border border-dashed border-dash-border text-[13px] font-semibold text-dash-muted hover:text-dash-ink">+ New role</button>
        </section>

        <section className="w-full min-w-0 flex-1 rounded-[14px] border border-dash-border bg-dash-card p-5">
          {!curId && !isNew ? <p className="py-14 text-center text-sm text-dash-muted">Pick a role, or add a new one.</p> : loadingRole ? <Skeleton className="h-96 rounded-xl" /> : (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">Role name<input className={input} value={name} disabled={locked} onChange={(e) => { setName(e.target.value); setDirty(true) }} /></label>
                <div className="flex flex-col gap-1.5 text-[13px] font-semibold">Start from a template
                  <div role="group" aria-label="Templates" className="flex flex-wrap gap-1.5">
                    {TEMPLATES.map((t) => <button key={t.id} type="button" disabled={locked} onClick={() => applyTemplate(t)} className="h-9 rounded-full border border-dash-border bg-dash-card px-3 text-[13px] font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">{t.label}</button>)}
                  </div>
                </div>
              </div>
              {locked && <div className="rounded-[10px] bg-dash-warn-soft px-3.5 py-2.5 text-[13px] text-dash-warn-fg">The Owner role always has full access and can’t be changed.</div>}

              <div className="overflow-x-auto rounded-xl border border-dash-border">
                <table className="w-full min-w-[560px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-dash-bg text-xs text-dash-muted">
                      <th className="px-3 py-2.5 text-left font-semibold">Area</th>
                      {ACTIONS.map((a) => (
                        <th key={a} className="px-3 py-2.5 text-center font-semibold">
                          <button type="button" title={`Toggle ${a} for every area`} aria-pressed={modules.length > 0 && modules.every((m) => cell(m)[KEY[a]])} onClick={() => flipColumn(a)} className="rounded px-1.5 py-0.5 hover:bg-dash-neutral-soft">{a}</button>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-center font-semibold">Full</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.group}>
                        <tr><td colSpan={6} className="bg-dash-neutral-soft/60 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-dash-muted">{g.group}</td></tr>
                        {g.modules.map((m) => {
                          const c = cell(m.name)
                          const full = c.view && c.create && c.edit && c.delete
                          return (
                            <tr key={m.name}>
                              <td className="border-t border-dash-border-soft px-3 py-2.5"><div className="font-semibold">{m.name}</div><div className="text-xs text-dash-muted">{m.summary}</div></td>
                              {ACTIONS.map((a) => (
                                <td key={a} className="border-t border-dash-border-soft px-3 py-2.5 text-center">
                                  <button type="button" role="checkbox" aria-checked={c[KEY[a]]} aria-label={`${a} ${m.name}`} onClick={() => flipCell(m.name, a)}
                                    className={cn("inline-flex size-6 items-center justify-center rounded-md border-2 text-xs font-bold", c[KEY[a]] ? "border-dash-accent bg-dash-accent text-white" : "border-dash-border bg-dash-card")}>{c[KEY[a]] ? "✓" : ""}</button>
                                </td>
                              ))}
                              <td className="border-t border-dash-border-soft px-3 py-2.5 text-center">
                                <button type="button" role="switch" aria-checked={full} aria-label={`Full access to ${m.name}`} onClick={() => flipFull(m.name)}
                                  className={cn("inline-flex h-5 w-9 items-center rounded-full p-0.5", full ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></button>
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dash-muted">Sensitive actions</h3>
                {SENS.map((s) => {
                  const on = locked ? true : !!sens[s.key]
                  return (
                    <button key={s.key} type="button" role="switch" aria-checked={on} onClick={() => edit(() => setSens((cur) => ({ ...cur, [s.key]: !cur[s.key] })))}
                      className="flex items-center justify-between gap-3 rounded-xl border border-dash-border px-3.5 py-3 text-left">
                      <span className="flex flex-col"><span className="text-sm font-semibold">{s.label}</span><span className="text-xs text-dash-muted">{s.sub}</span></span>
                      <span className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5", on ? "justify-end bg-dash-accent" : "justify-start bg-dash-border")}><span className="size-4 rounded-full bg-white" /></span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-dash-border-soft pt-4">
                <span className="text-[13px] text-dash-muted">Can open {areaCount} of {modules.length} areas · {sensCount} sensitive action{sensCount === 1 ? "" : "s"} allowed · {memberCount} member{memberCount === 1 ? "" : "s"}{autoSaving ? " · saving…" : dirty ? " · unsaved name/description" : isNew ? "" : " · changes save automatically"}</span>
                <div className="flex gap-2">
                  {!isNew && <button type="button" disabled={locked} onClick={remove} className={cn(outlineBtn, "text-dash-danger-fg disabled:opacity-40")}>Delete</button>}
                  {!isNew && <button type="button" onClick={duplicate} className={outlineBtn}>Duplicate</button>}
                  <button type="button" disabled={saving || locked} onClick={save} className="h-11 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">{saving ? "Saving…" : "Save role"}</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
