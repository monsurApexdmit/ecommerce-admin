"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation(["catalog", "common"])
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
      toast({ variant: "destructive", title: t("catalog:shared.couldNotSave"), description: error?.message || t("common:extra.tryAgain") })
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
    if (exists(v)) { toast({ variant: "destructive", title: t("catalog:attributes.detail.alreadyAdded"), description: v }); return }
    if (await saveValues([...attribute.values, v], t("catalog:attributes.detail.valueAdded"))) setDraft("")
  }

  const renameValue = async (i: number) => {
    const v = clean(editText)
    if (!v || !attribute) return
    if (exists(v, i)) { toast({ variant: "destructive", title: t("catalog:attributes.detail.alreadyAdded"), description: v }); return }
    const old = attribute.values[i]
    const next = attribute.values.map((x, j) => (j === i ? v : x))
    const colors = { ...(attribute.valueColors ?? {}) }
    if (old in colors) { colors[v] = colors[old]; if (v !== old) delete colors[old] }
    if (await saveValues(next, t("catalog:attributes.detail.valueRenamed"), colors)) setEditIdx(null)
  }

  const removeValue = (i: number) => {
    if (!attribute) return
    if (attribute.values.length <= 1) {
      toast({ variant: "destructive", title: t("catalog:attributes.detail.keepOne"), description: t("catalog:attributes.detail.keepOneDesc") })
      return
    }
    saveValues(attribute.values.filter((_, j) => j !== i), t("catalog:attributes.detail.valueRemoved"))
  }

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <div className="flex flex-col gap-1.5">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link href="/dashboard/attributes">{t("catalog:attributes.title")}</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{attribute?.name ?? t("catalog:attributes.detail.fallback")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <PageHeader title={attribute ? attribute.displayName || attribute.name : t("catalog:attributes.detail.titleFallback")} description={t("catalog:attributes.detail.desc")} />
      </div>

      {isLoading ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : !attribute ? (
        <EmptyState icon={Layers} bordered title={t("catalog:attributes.detail.notFound")}
          action={<Button asChild variant="link"><Link href="/dashboard/attributes">{t("catalog:attributes.detail.back")}</Link></Button>} />
      ) : (
        <Card className="max-w-[720px] gap-0 py-0">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="text-sm text-muted-foreground">
              {t("catalog:attributes.meta", {
                key: attribute.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
                option: attribute.option === "radio" || attribute.option === "button"
                  ? t("catalog:attributes.options.buttons")
                  : attribute.option === "swatch" ? t("catalog:attributes.options.swatch") : t("catalog:attributes.options.dropdown"),
                values: t("catalog:attributes.valueCount", { count: attribute.values.length }),
                products: t("common:count.products", { count: attribute.usedInProducts }),
              })}
            </span>
            <Label className="flex items-center gap-2">
              {t("common:status.published")}
              <Switch checked={attribute.published} onCheckedChange={(v) => updateAttribute(attribute.id, { published: v }).catch((e) => toast({ variant: "destructive", title: t("catalog:shared.couldNotUpdate"), description: e?.message }))} />
            </Label>
          </div>

          <Separator />
          <form className="flex gap-2 p-4" onSubmit={(e) => { e.preventDefault(); addValue() }}>
            <Label className="sr-only" htmlFor="new-value">{t("catalog:attributes.detail.newValue")}</Label>
            <Input id="new-value" className="min-w-0 flex-1" placeholder={t("catalog:attributes.detail.newValuePlaceholder")} value={draft} onChange={(e) => setDraft(e.target.value)} />
            <Button type="submit" disabled={saving || !clean(draft)}>
              <Plus className="size-4" aria-hidden /> {t("catalog:attributes.detail.addValue")}
            </Button>
          </form>

          {attribute.values.length === 0 ? (
            <>
              <Separator />
              <EmptyState title={t("catalog:attributes.detail.noValues")} description={t("catalog:attributes.detail.noValuesDesc")} className="p-6 md:p-8" />
            </>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="w-12 pl-4">#</TableHead>
                  <TableHead scope="col">{t("catalog:attributes.detail.value")}</TableHead>
                  <TableHead scope="col" className="pr-4 text-right">{t("common:fields.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attribute.values.map((v, i) => (
                  <TableRow key={`${v}-${i}`}>
                    <TableCell className="pl-4 tabular-nums text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-semibold">
                      {editIdx === i ? (
                        <Input autoFocus aria-label={t("catalog:attributes.detail.renameName", { name: v })} className="w-full" value={editText}
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
                            <WithTooltip content={t("catalog:attributes.detail.saveValue")}><Button type="button" variant="outline" size="icon" aria-label={t("catalog:attributes.detail.saveValue")} onClick={() => renameValue(i)} disabled={saving}><Check className="size-4" /></Button></WithTooltip>
                            <WithTooltip content={t("common:actions.cancel")}><Button type="button" variant="outline" size="icon" aria-label={t("common:actions.cancel")} onClick={() => setEditIdx(null)}><X className="size-4" /></Button></WithTooltip>
                          </>
                        ) : (
                          <>
                            <WithTooltip content={t("catalog:attributes.detail.renameValue")}>
                              <Button type="button" variant="outline" size="icon" aria-label={t("catalog:attributes.detail.renameValueName", { name: v })} onClick={() => { setEditIdx(i); setEditText(v) }}><Pencil className="size-4" /></Button>
                            </WithTooltip>
                            <WithTooltip content={t("common:extra.removeName", { name: v })}><Button type="button" variant="outline" size="icon" aria-label={t("common:extra.removeName", { name: v })} onClick={() => removeValue(i)} disabled={saving}><Trash2 className="size-4" /></Button></WithTooltip>
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
