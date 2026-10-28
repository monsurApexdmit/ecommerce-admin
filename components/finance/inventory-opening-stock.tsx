"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import financeApi, { financeError, type OpeningStockPreview, type OpeningStockResult, type OpeningStockRow } from "@/lib/financeApi"
import { formatNumber } from "@/lib/finance-format"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FormField } from "@/components/common/FormField"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { StatTile } from "@/components/common/StatTile"
import { DatePicker } from "./date-picker"
import { CurrencyTag, useFinanceFormat } from "./finance-ui"

/** All preview pages (100 per page; capped at 20 pages = 2,000 products). */
async function loadPreview(): Promise<OpeningStockPreview> {
  const first = await financeApi.getOpeningStock({ page: 1, perPage: 100 })
  const rows: OpeningStockRow[] = [...first.rows]
  for (let p = 2; p <= Math.min(first.meta.lastPage, 20); p++) {
    const r = await financeApi.getOpeningStock({ page: p, perPage: 100 })
    rows.push(...r.rows)
    if (r.rows.length === 0) break
  }
  return { ...first, rows }
}

/**
 * INV-1 "Move in opening stock": preview (quantity, editable unit cost, "Needs cost") → cutover date → post.
 * Posting is idempotent on the server: products already moved in are skipped, so running it again changes nothing.
 */
export function OpeningStockDialog({ open, onClose, onDone, writable }: { open: boolean; onClose: () => void; onDone: () => void; writable: boolean }) {
  const fmt = useFinanceFormat()
  const [preview, setPreview] = useState<OpeningStockPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState("")
  const [cutover, setCutover] = useState("")
  const [costs, setCosts] = useState<Record<number, string>>({})
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OpeningStockResult | null>(null)

  useEffect(() => {
    if (!open) return
    setErr(""); setResult(null); setBusy(false); setPreview(null); setCosts({}); setPicked(new Set()); setLoading(true)
    loadPreview()
      .then((p) => {
        setPreview(p)
        setCutover(p.cutoverDate ?? fmt.today)
        setCosts(Object.fromEntries(p.rows.map((r) => [r.productId, r.unitCost != null ? String(r.unitCost) : ""])))
        setPicked(new Set(p.rows.filter((r) => r.unitCost != null && r.unitCost > 0).map((r) => r.productId)))
      })
      .catch((e) => setErr(financeError(e, "Could not load the opening stock preview.")))
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = preview?.rows ?? []
  const costOf = (r: OpeningStockRow) => { const n = Number(costs[r.productId]); return Number.isFinite(n) && n > 0 ? n : 0 }
  const ready = rows.filter((r) => costOf(r) > 0)
  const chosen = ready.filter((r) => picked.has(r.productId))
  const totals = useMemo(() => ({
    qty: chosen.reduce((n, r) => n + r.quantity, 0),
    value: chosen.reduce((n, r) => n + r.quantity * costOf(r), 0),
  }), [chosen, costs]) // eslint-disable-line react-hooks/exhaustive-deps
  const allPicked = ready.length > 0 && chosen.length === ready.length

  const setCost = (r: OpeningStockRow, v: string) => {
    setCosts((c) => ({ ...c, [r.productId]: v }))
    const n = Number(v)
    setPicked((s) => { const next = new Set(s); if (Number.isFinite(n) && n > 0) next.add(r.productId); else next.delete(r.productId); return next })
  }
  const toggle = (id: number) => setPicked((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
  const toggleAll = () => setPicked(allPicked ? new Set() : new Set(ready.map((r) => r.productId)))

  const post = async () => {
    if (!cutover) { setErr("Choose a cutover date."); return }
    if (cutover > fmt.today) { setErr("Cutover date cannot be in the future."); return }
    if (chosen.length === 0) { setErr("Pick at least one product with a unit cost."); return }
    setBusy(true); setErr("")
    try {
      const res = await financeApi.postOpeningStock({
        cutoverDate: cutover,
        items: chosen.map((r) => ({ productId: r.productId, unitCost: costOf(r) })),
        productIds: chosen.map((r) => r.productId),
        setProductCost: true,
      })
      setResult(res)
      toast.success(res.posted > 0 ? res.message : "Nothing new to move in")
      onDone()
    } catch (e) {
      setErr(financeError(e, "Could not move in the opening stock."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Move in opening stock</DialogTitle>
          <DialogDescription>
            Records where stock you already had came from: one opening movement per product, valued at its unit cost. Stock on hand doesn&apos;t change.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> {result.posted > 0 ? result.message : "Nothing new was moved in"}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label="Products moved in" value={formatNumber(result.posted)} className="p-3" />
              <StatTile label="Units" value={formatNumber(result.quantity)} className="p-3" />
              <StatTile label="Stock value added" value={fmt.money(result.value)} className="p-3" />
            </div>
            {result.skipped.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Skipped ({formatNumber(result.skipped.length)})</p>
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">
                  {result.skipped.map((x) => (
                    <li key={`${x.productId}-${x.reason}`} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate">{x.name || "Product"}</span>
                      <Badge variant={x.reason === "needs_cost" ? "destructive" : "secondary"}>{x.label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {result.remaining > 0
                ? `${formatNumber(result.remaining)} product${result.remaining === 1 ? "" : "s"} still wait${result.remaining === 1 ? "s" : ""} — add a unit cost and run this again.`
                : "Every product with stock is now moved in."}{" "}
              Running it again is safe: products already moved in are skipped.
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 && !err ? (
          <Alert><AlertDescription>
            Nothing to move in: every product&apos;s stock is explained by its movements.
            {preview && preview.alreadyMovedIn > 0 ? ` ${formatNumber(preview.alreadyMovedIn)} product${preview.alreadyMovedIn === 1 ? " was" : "s were"} moved in already.` : ""}
          </AlertDescription></Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
              <FormField label="Cutover date" htmlFor="opening-cutover" description={preview?.cutoverReason ?? undefined}>
                <DatePicker id="opening-cutover" value={cutover} onChange={setCutover} max="today" />
              </FormField>
              <InfoList className="sm:justify-self-end sm:text-right">
                <InfoRow label="Ready to move in" value={`${formatNumber(chosen.length)} of ${formatNumber(rows.length)} products`} />
                <InfoRow label="Value" value={<span className="tabular-nums">{fmt.money(totals.value)} <CurrencyTag code={preview?.context.currency?.code} /></span>} />
              </InfoList>
            </div>
            {preview && preview.alreadyMovedIn > 0 && (
              <p className="text-xs text-muted-foreground">{formatNumber(preview.alreadyMovedIn)} product{preview.alreadyMovedIn === 1 ? " was" : "s were"} moved in before and {preview.alreadyMovedIn === 1 ? "is" : "are"} not listed.</p>
            )}
            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allPicked} onCheckedChange={toggleAll} aria-label="Select every product with a cost" disabled={!ready.length} /></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="w-40 text-right">Unit cost</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const c = costOf(r)
                    return (
                      <TableRow key={r.productId} data-state={picked.has(r.productId) && c > 0 ? "selected" : undefined}>
                        <TableCell><Checkbox checked={picked.has(r.productId) && c > 0} disabled={c <= 0} onCheckedChange={() => toggle(r.productId)} aria-label={`Move in ${r.name}`} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">{r.name}{c <= 0 && <Badge variant="destructive">Needs cost</Badge>}</div>
                          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.quantity)}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Unit cost of ${r.name}`} placeholder="0.00"
                            className={cn("ml-auto h-8 w-32 text-right tabular-nums", c <= 0 && "border-destructive")} value={costs[r.productId] ?? ""}
                            onChange={(e) => setCost(r, e.target.value)} disabled={!writable} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{c > 0 ? fmt.money(r.quantity * c) : "—"}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-xs text-muted-foreground">Products without a unit cost stay listed with &quot;Needs cost&quot; and are not posted. A cost you enter is also saved as the product&apos;s cost price.</p>
          </div>
        )}

        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{result ? "Done" : "Cancel"}</Button>
          {!result && writable && rows.length > 0 && (
            <Button type="button" onClick={post} disabled={busy || chosen.length === 0}>
              <PackagePlus className="size-4" aria-hidden /> {busy ? "Moving in…" : `Move in ${formatNumber(chosen.length)} product${chosen.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
