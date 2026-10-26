"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import inventoryApi, { type StockRow } from "@/lib/inventoryApi"
import adjustmentApi, { type AdjustmentLogRow, type AdjustmentStats, type AdjustmentType } from "@/lib/adjustmentApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { ChoiceCard, ChoiceCardGroup } from "@/components/common/ChoiceCard"
import { StatTile } from "@/components/common/StatTile"
import { EmptyState } from "@/components/common/EmptyState"

const TYPES: { id: AdjustmentType; label: string; sub: string }[] = [
  { id: "increase", label: "+ Increase", sub: "Add units" },
  { id: "decrease", label: "− Decrease", sub: "Remove units" },
  { id: "set", label: "= Set to", sub: "After a count" },
]
const REASONS: Record<AdjustmentType, string[]> = {
  increase: ["Recount", "Received without PO", "Customer return", "Found", "Other"],
  decrease: ["Recount", "Damaged", "Expired", "Theft / loss", "Gift / sample", "Own use", "Other"],
  set: ["Recount", "Opening stock", "Other"],
}
const BIG_CHANGE = 10

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
const deltaVariant = (n: number) => (n > 0 ? "default" : n < 0 ? "destructive" : "secondary") as "default" | "destructive" | "secondary"

interface Sku { key: string; productId: number; variantId: number | null; label: string; cost: number; byLoc: Record<number, number> }

export default function AdjustmentPage() {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const blocked = useModuleGuard("Inventory")

  const [skus, setSkus] = useState<Sku[]>([])
  const [locations, setLocations] = useState<{ id: number; name: string }[]>([])
  const [loadingForm, setLoadingForm] = useState(true)

  const [loc, setLoc] = useState("")
  const [skuKey, setSkuKey] = useState("")
  const [type, setType] = useState<AdjustmentType>("decrease")
  const [qty, setQty] = useState(1)
  const [reason, setReason] = useState(REASONS.decrease[0])
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const [log, setLog] = useState<AdjustmentLogRow[]>([])
  const [reasonOpts, setReasonOpts] = useState<string[]>([])
  const [stats, setStats] = useState<AdjustmentStats>({ added30d: 0, removed30d: 0, shrinkageValue30d: 0 })
  const [total, setTotal] = useState(0)
  const [logLoading, setLogLoading] = useState(true)
  const [reasonFilter, setReasonFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const loadForm = useCallback(async () => {
    try {
      const ov = await inventoryApi.getOverview()
      setLocations(ov.locations)
      const flat: StockRow[] = ov.items.flatMap((r) => (r.variants?.length ? r.variants : [r]))
      setSkus(flat.map((r) => ({
        key: `${r.type}-${r.id}`,
        productId: r.productId,
        variantId: r.type === "variant" ? r.id : null,
        label: r.variantName ? `${r.name} · ${r.variantName}` : r.name,
        cost: r.cost,
        byLoc: Object.fromEntries(r.locations.map((l) => [l.locationId, l.quantity])),
      })))
      setLoc((cur) => cur || String((ov.locations.find((l) => l.isDefault) ?? ov.locations[0])?.id ?? ""))
      setSkuKey((cur) => cur || (flat[0] ? `${flat[0].type}-${flat[0].id}` : ""))
    } catch {
      /* the form stays empty */
    } finally {
      setLoadingForm(false)
    }
  }, [])

  const loadLog = useCallback(async () => {
    setLogLoading(true)
    try {
      const res = await adjustmentApi.getLog({ page, per_page: perPage, reason: reasonFilter !== "all" ? reasonFilter : undefined })
      setLog(res.data)
      setStats(res.stats)
      setTotal(res.total)
      setReasonOpts(res.reasons)
    } catch {
      setLog([])
    } finally {
      setLogLoading(false)
    }
  }, [page, perPage, reasonFilter])

  useEffect(() => { loadForm() }, [loadForm])
  useEffect(() => { loadLog() }, [loadLog])

  const sku = skus.find((s) => s.key === skuKey)
  const before = sku ? sku.byLoc[Number(loc)] ?? 0 : 0
  const after = type === "increase" ? before + qty : type === "decrease" ? Math.max(0, before - qty) : qty
  const diff = after - before
  const locName = locations.find((l) => String(l.id) === loc)?.name ?? ""
  const bigChange = Math.abs(diff) >= BIG_CHANGE
  const valueImpact = diff * (sku?.cost ?? 0)

  const pickType = (t: AdjustmentType) => {
    setType(t)
    setReason((r) => (REASONS[t].includes(r) ? r : REASONS[t][0]))
    setErr("")
  }

  const startCount = () => { setType("set"); setReason("Recount"); setQty(before); setErr("") }

  const apply = async () => {
    if (!sku) { setErr("Choose a product."); return }
    if (!loc) { setErr("Choose a warehouse."); return }
    if (type !== "set" && qty <= 0) { setErr("Enter a quantity greater than 0."); return }
    if (type === "decrease" && qty > before) { setErr(`Only ${before} in stock at ${locName}.`); return }
    if (diff === 0) { setErr("No quantity changed."); return }
    if (reason === "Other" && !note.trim()) { setErr("Add a note explaining the reason."); return }
    setBusy(true); setErr("")
    try {
      await adjustmentApi.create({
        productId: sku.productId, variantId: sku.variantId, locationId: Number(loc),
        type, quantity: qty, reason, note: note.trim() || undefined,
      })
      toast({ title: "Adjustment applied", description: `${sku.label}: ${before} → ${after}` })
      setQty(1); setNote("")
      await Promise.all([loadForm(), loadLog()])
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not apply the adjustment.")
    } finally {
      setBusy(false)
    }
  }


  const handleExport = () => {
    exportToCSV(
      log.map((g) => ({
        no: g.number, date: g.createdAt ?? "", product: g.productName + (g.variantName ? ` · ${g.variantName}` : ""), warehouse: g.locationName ?? "",
        type: g.type, change: g.delta, before: g.before, after: g.after, reason: g.reason, note: g.note ?? "", by: g.createdBy ?? "",
      })),
      "stock-adjustments", ["no", "date", "product", "warehouse", "type", "change", "before", "after", "reason", "note", "by"],
    )
  }

  const productOptions = useMemo(
    () => skus.map((s) => ({ key: s.key, label: `${s.label} — ${s.byLoc[Number(loc)] ?? 0} in stock` })),
    [skus, loc],
  )

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Stock adjustment"
        description="Fix stock counts with a reason, so every change can be explained later."
        actions={<Button type="button" variant="outline" onClick={startCount}>Start full stock count</Button>}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <SectionCard
          className="w-full shrink-0 xl:w-[460px]"
          title="New adjustment"
          description="Correct stock after a count, damage or loss. Every change is logged."
        >
          {loadingForm ? (
            <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="flex flex-col gap-4">
              <FormField label="Warehouse" htmlFor="adj-warehouse">
                <Select value={loc || undefined} onValueChange={(v) => { setLoc(v); setErr("") }}>
                  <SelectTrigger id="adj-warehouse" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {locations.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Product" htmlFor="adj-product">
                <Select value={skuKey || "__none"} onValueChange={(v) => { setSkuKey(v === "__none" ? "" : v); setErr("") }}>
                  <SelectTrigger id="adj-product" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Select a product</SelectItem>
                    {productOptions.map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Change type</p>
                <ChoiceCardGroup value={type} onValueChange={(v) => pickType(v as AdjustmentType)} aria-label="Adjustment type" className="grid-cols-3">
                  {TYPES.map((t) => (
                    <ChoiceCard key={t.id} value={t.id} title={t.label} description={t.sub} className="items-center text-center" />
                  ))}
                </ChoiceCardGroup>
              </div>

              <div className="grid grid-cols-[1fr_auto] items-end gap-3">
                <FormField label={type === "set" ? "Counted quantity" : "Quantity"} htmlFor="adj-qty">
                  <Input id="adj-qty" type="number" min={0} className="w-full" value={qty} onChange={(e) => { setQty(Math.max(0, Math.floor(Number(e.target.value)) || 0)); setErr("") }} />
                </FormField>
                <Card className="flex-row items-center gap-2 px-3 py-2 text-sm shadow-none">
                  <span className="flex flex-col"><span className="text-xs text-muted-foreground">Now</span><strong className="tabular-nums">{before}</strong></span>
                  <span aria-hidden>→</span>
                  <span className="flex flex-col"><span className="text-xs text-muted-foreground">After</span><strong className="tabular-nums">{after}</strong></span>
                  <Badge variant={deltaVariant(diff)} className="tabular-nums">{sign(diff)}</Badge>
                </Card>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">Reason</p>
                <div className="flex flex-wrap gap-1.5">
                  {REASONS[type].map((r) => (
                    <Button key={r} type="button" size="sm" aria-pressed={reason === r} onClick={() => setReason(r)}
                      variant={reason === r ? "default" : "outline"}>
                      {r}
                    </Button>
                  ))}
                </div>
              </div>

              <FormField label="Note" htmlFor="adj-note">
                <Textarea id="adj-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 pieces torn during unpacking" />
              </FormField>

              {bigChange && (
                <Alert>
                  <AlertDescription>This is a large change ({sign(diff)}). It will be flagged for owner review.</AlertDescription>
                </Alert>
              )}
              {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}

              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Value impact <strong className="text-foreground tabular-nums">{valueImpact < 0 ? "−" : "+"}{formatCurrency(Math.abs(valueImpact))}</strong></span>
                <Button type="button" disabled={busy} onClick={apply}>
                  {busy ? "Applying…" : "Apply adjustment"}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          className="w-full min-w-0 flex-1"
          title="Audit trail"
          actions={<>
              <Select value={reasonFilter} onValueChange={(v) => { setReasonFilter(v); setPage(1) }}>
                <SelectTrigger aria-label="Filter by reason" className="w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Reason: All</SelectItem>
                  {reasonOpts.filter(Boolean).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>
          </>}
        >
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile label="Added (30d)" value={`+${stats.added30d}`} />
            <StatTile label="Removed (30d)" value={stats.removed30d ? `−${stats.removed30d}` : "0"} />
            <StatTile label="Shrinkage value" value={formatCurrency(stats.shrinkageValue30d)} />
          </div>

          {logLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : log.length === 0 ? (
            <EmptyState title="No adjustments yet." />
          ) : (
            <div className="flex flex-col">
              {log.map((g, i) => (
                <div key={g.id}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm" className="flex-nowrap px-0">
                    <ItemMedia>
                      <Badge variant={deltaVariant(g.delta)} className="min-w-12 justify-center tabular-nums">{sign(g.delta)}</Badge>
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="block w-full truncate">
                        <span className="mr-2 text-xs font-bold text-muted-foreground">{g.number}</span>
                        {g.productName}{g.variantName ? ` · ${g.variantName}` : ""}
                        {g.flagged && <Badge variant="secondary" className="ml-2">Flagged</Badge>}
                      </ItemTitle>
                      <ItemDescription className="truncate">{g.locationName ?? "—"} · {g.reason}{g.note ? ` (${g.note})` : ""}{g.before !== null && g.after !== null ? ` · ${g.before} → ${g.after}` : ""}</ItemDescription>
                    </ItemContent>
                    <ItemActions className="flex-col items-end gap-0 text-right">
                      <div className="text-sm">{g.createdAt ? new Date(g.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}{g.createdAt ? ` · ${new Date(g.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : ""}</div>
                      <div className="text-xs text-muted-foreground">{g.createdBy ?? "—"}</div>
                    </ItemActions>
                  </Item>
                </div>
              ))}
            </div>
          )}

          {!logLoading && total > 0 && (
            <div className="mt-3">
              <Separator className="mb-3" />
              <PaginationControl
                currentPage={page}
                totalPages={Math.max(1, Math.ceil(total / perPage))}
                itemsPerPage={perPage}
                totalItems={total}
                onPageChange={setPage}
                onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }}
              />
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
