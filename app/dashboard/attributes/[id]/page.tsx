"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Layers, Pencil, Plus, Trash2, Check, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { PageHeader } from "@/components/common/PageHeader"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import { useAttribute } from "@/contexts/attribute-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"

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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <div className="flex flex-col gap-1.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/dashboard/attributes">Attributes</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{attribute?.name ?? "Attribute"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader title={attribute ? attribute.displayName || attribute.name : "Attribute values"} description="Order here is the order customers see." />
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !attribute ? (
        <EmptyState icon={Layers} bordered title="Attribute not found"
          action={<Button asChild variant="link"><Link href="/dashboard/attributes">Back to attributes</Link></Button>} />
      ) : (
        <Card className="max-w-[720px] gap-0 py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-sm text-muted-foreground">
              Key: {attribute.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")} · {attribute.option === "radio" || attribute.option === "button" ? "Buttons" : attribute.option === "swatch" ? "Colour swatch" : "Dropdown"} · {attribute.values.length} value{attribute.values.length === 1 ? "" : "s"} · used in {attribute.usedInProducts} product{attribute.usedInProducts === 1 ? "" : "s"}
            </span>
            <Label className="flex items-center gap-2">
              Published
              <Switch checked={attribute.published} onCheckedChange={(v) => updateAttribute(attribute.id, { published: v }).catch((e) => toast({ variant: "destructive", title: "Could not update", description: e?.message }))} />
            </Label>
          </div>

          <Separator />
          <form className="flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); addValue() }}>
            <Label className="sr-only" htmlFor="new-value">New value</Label>
            <Input id="new-value" className="min-w-0 flex-1" placeholder="Add a value, e.g. Large" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" disabled={saving || !clean(draft)}>
              <Plus className="size-4" aria-hidden /> Add value
            </Button>
          </form>

          {attribute.values.length === 0 ? (
            <>
              <Separator />
              <EmptyState title="No values yet" description="Add the first one above." className="p-6 md:p-8" />
            </>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-12 pl-4">#</TableHead>
                  <TableHead scope="col">Value</TableHead>
                  <TableHead scope="col" className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attribute.values.map((v, i) => (
                  <TableRow key={`${v}-${i}`}>
                    <TableCell className="pl-4 tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">
                      {editIdx === i ? (
                        <Input autoFocus aria-label={`Rename ${v}`} className="w-full" value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") renameValue(i); if (e.key === "Escape") setEditIdx(null) }} />
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          {attribute.option === "swatch" && <span aria-hidden className="size-3.5 rounded-full border" style={{ background: attribute.valueColors?.[v] || "transparent" }} />}
                          {v}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-4">
                      <div className="flex justify-end gap-1">
                        {editIdx === i ? (
                          <>
                            <Button type="button" variant="outline" size="icon" aria-label="Save value" onClick={() => renameValue(i)} disabled={saving}><Check className="size-4" /></Button>
                            <Button type="button" variant="outline" size="icon" aria-label="Cancel" onClick={() => setEditIdx(null)}><X className="size-4" /></Button>
                          </>
                        ) : (
                          <>
                            <WithTooltip content="Rename value">
                              <Button type="button" variant="outline" size="icon" aria-label={`Rename value ${v}`} onClick={() => { setEditIdx(i); setEditText(v) }}><Pencil className="size-4" /></Button>
                            </WithTooltip>
                            <Button type="button" variant="outline" size="icon" aria-label={`Remove ${v}`} onClick={() => removeValue(i)} disabled={saving}><Trash2 className="size-4" /></Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  )
}
