"use client"

import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ChevronRight, Layers, Pencil, Plus, Trash2, Check, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useAttribute } from "@/contexts/attribute-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"

const iconBtn =
  "flex size-9 items-center justify-center rounded-lg border border-dash-border bg-dash-card text-dash-ink hover:bg-dash-neutral-soft"
const fieldInput =
  "h-11 min-w-0 flex-1 rounded-[10px] border border-dash-border bg-dash-card px-3 text-sm text-dash-ink outline-none placeholder:text-dash-muted focus-visible:border-dash-accent"

export default function AttributeValuesPage() {
  const params = useParams()
  const attributeId = String(params.id)
  const { attributes, isLoading, updateAttribute } = useAttribute()
  const { toast } = useToast()

  const [draft, setDraft] = useState("")
  const [editIdx, setEditIdx] = useState<number | null>(null)
  const [editText, setEditText] = useState("")
  const [saving, setSaving] = useState(false)

  const blocked = useModuleGuard("Attributes")
  if (blocked) return blocked

  const attribute = attributes.find((a) => a.id === attributeId)

  const saveValues = async (values: string[], message: string, colors?: Record<string, string>) => {
    if (!attribute) return false
    setSaving(true)
    try {
      const keep = colors ?? attribute.valueColors
      await updateAttribute(attribute.id, {
        option: attribute.option,
        values: values as any,
        valueColors: keep && Object.keys(keep).length ? keep : undefined,
      })
      toast({ title: message })
      return true
    } catch (error: any) {
      toast({ variant: "destructive", title: "Could not save", description: error?.message || "Please try again" })
      return false
    } finally {
      setSaving(false)
    }
  }

  const clean = (s: string) => s.replace(/,/g, " ").trim()
  const exists = (v: string, skip?: number) =>
    !!attribute?.values.some((x, i) => i !== skip && x.toLowerCase() === v.toLowerCase())

  const addValue = async () => {
    const v = clean(draft)
    if (!v || !attribute) return
    if (exists(v)) { toast({ variant: "destructive", title: "Already added", description: v }); return }
    if (await saveValues([...attribute.values, v], "Value added")) setDraft("")
  }

  const renameValue = async (i: number) => {
    const v = clean(editText)
    if (!v || !attribute) return
    if (exists(v, i)) { toast({ variant: "destructive", title: "Already added", description: v }); return }
    const old = attribute.values[i]
    const next = attribute.values.map((x, j) => (j === i ? v : x))
    const colors = { ...(attribute.valueColors ?? {}) }
    if (old in colors) { colors[v] = colors[old]; if (v !== old) delete colors[old] }
    if (await saveValues(next, "Value renamed", colors)) setEditIdx(null)
  }

  const removeValue = (i: number) => {
    if (!attribute) return
    if (attribute.values.length <= 1) {
      toast({ variant: "destructive", title: "Keep at least one value", description: "Delete the attribute instead if you no longer need it" })
      return
    }
    saveValues(attribute.values.filter((_, j) => j !== i), "Value removed")
  }

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-[13px] text-dash-muted">
          <Link href="/dashboard/attributes" className="font-semibold text-dash-accent hover:underline">Attributes</Link>
          <ChevronRight className="size-3.5" aria-hidden />
          <span>{attribute?.name ?? "Attribute"}</span>
        </nav>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">{attribute ? attribute.displayName || attribute.name : "Attribute values"}</h1>
        <p className="mt-1 text-sm text-dash-muted">Order here is the order customers see.</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-[14px]" />
      ) : !attribute ? (
        <div className="rounded-[14px] border border-dash-border bg-dash-card py-14 text-center">
          <Layers className="mx-auto mb-2 size-8 text-dash-muted/50" aria-hidden />
          <p className="font-semibold">Attribute not found</p>
          <Link href="/dashboard/attributes" className="text-sm font-semibold text-dash-accent hover:underline">Back to attributes</Link>
        </div>
      ) : (
        <section className="max-w-[720px] rounded-[14px] border border-dash-border bg-dash-card">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-sm text-dash-muted">
              Key: {attribute.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")} · {attribute.option === "radio" || attribute.option === "button" ? "Buttons" : attribute.option === "swatch" ? "Colour swatch" : "Dropdown"} · {attribute.values.length} value{attribute.values.length === 1 ? "" : "s"} · used in {attribute.usedInProducts} product{attribute.usedInProducts === 1 ? "" : "s"}
            </span>
            <label className="flex items-center gap-2 text-[13px] font-semibold">
              Published
              <Switch checked={attribute.published} onCheckedChange={(v) => updateAttribute(attribute.id, { published: v }).catch((e) => toast({ variant: "destructive", title: "Could not update", description: e?.message }))}
                className="h-6 w-11 data-[state=checked]:bg-dash-accent data-[state=unchecked]:bg-dash-border" />
            </label>
          </div>

          <form className="flex gap-2 border-t border-dash-border-soft p-4" onSubmit={(e) => { e.preventDefault(); addValue() }}>
            <label className="sr-only" htmlFor="new-value">New value</label>
            <input id="new-value" className={fieldInput} placeholder="Add a value, e.g. Large" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="submit" disabled={saving || !clean(draft)}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-dash-accent px-[18px] text-sm font-semibold text-white disabled:opacity-40">
              <Plus className="size-4" aria-hidden /> Add value
            </button>
          </form>

          {attribute.values.length === 0 ? (
            <p className="border-t border-dash-border-soft py-10 text-center text-sm text-dash-muted">No values yet. Add the first one above.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-dash-bg text-left text-xs text-dash-muted">
                  <th scope="col" className="w-12 py-3 pl-4 pr-2 font-semibold">#</th>
                  <th scope="col" className="px-2 py-3 font-semibold">Value</th>
                  <th scope="col" className="py-3 pl-2 pr-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attribute.values.map((v, i) => (
                  <tr key={`${v}-${i}`}>
                    <td className="border-b border-dash-border-soft py-3 pl-4 pr-2 tabular-nums text-dash-muted">{i + 1}</td>
                    <td className="border-b border-dash-border-soft px-2 py-3 font-semibold">
                      {editIdx === i ? (
                        <input autoFocus aria-label={`Rename ${v}`} className={fieldInput + " w-full"} value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameValue(i); if (e.key === "Escape") setEditIdx(null) }} />
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {attribute.option === "swatch" && <span className="size-3.5 rounded-full border border-dash-border" style={{ background: attribute.valueColors?.[v] || "transparent" }} />}
                          {v}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-dash-border-soft py-3 pl-2 pr-4">
                      <div className="flex justify-end gap-1">
                        {editIdx === i ? (
                          <>
                            <button type="button" aria-label="Save value" onClick={() => renameValue(i)} disabled={saving} className={iconBtn}><Check className="size-4" /></button>
                            <button type="button" aria-label="Cancel" onClick={() => setEditIdx(null)} className={iconBtn}><X className="size-4" /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" aria-label={`Rename value ${v}`} title="Rename value" onClick={() => { setEditIdx(i); setEditText(v) }} className={iconBtn}><Pencil className="size-4" /></button>
                            <button type="button" aria-label={`Remove ${v}`} onClick={() => removeValue(i)} disabled={saving} className={iconBtn}><Trash2 className="size-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
