"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, PackagePlus } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
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
import { FIN_NS, type FinKey } from "./i18n"

/** Skip reasons from the API → label keys (server label is the fallback). */
const SKIP_KEY: Record<string, FinKey> = { needs_cost: "finance:opening.needsCost" }

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
  const { t } = useTranslation(FIN_NS)
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
      .catch((e) => setErr(financeError(e, t("finance:opening.loadFailed"))))
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
    if (!cutover) { setErr(t("finance:opening.chooseCutover")); return }
    if (cutover > fmt.today) { setErr(t("finance:opening.cutoverFuture")); return }
    if (chosen.length === 0) { setErr(t("finance:opening.pickOne")); return }
    setBusy(true); setErr("")
    try {
      const res = await financeApi.postOpeningStock({
        cutoverDate: cutover,
        items: chosen.map((r) => ({ productId: r.productId, unitCost: costOf(r) })),
        productIds: chosen.map((r) => r.productId),
        setProductCost: true,
      })
      setResult(res)
      toast.success(res.posted > 0 ? t("finance:opening.movedIn", { count: res.posted, n: formatNumber(res.posted) }) : t("finance:opening.nothingNew"))
      onDone()
    } catch (e) {
      setErr(financeError(e, t("finance:opening.failed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("finance:opening.title")}</DialogTitle>
          <DialogDescription>{t("finance:opening.description")}</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-5 text-emerald-600" aria-hidden /> {result.posted > 0 ? t("finance:opening.movedIn", { count: result.posted, n: formatNumber(result.posted) }) : t("finance:opening.nothingMoved")}</div>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatTile label={t("finance:opening.productsMoved")} value={formatNumber(result.posted)} className="p-3" />
              <StatTile label={t("finance:col.units")} value={formatNumber(result.quantity)} className="p-3" />
              <StatTile label={t("finance:opening.valueAdded")} value={fmt.money(result.value)} className="p-3" />
            </div>
            {result.skipped.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">{t("finance:opening.skipped", { n: formatNumber(result.skipped.length) })}</p>
                <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border text-sm">
                  {result.skipped.map((x) => (
                    <li key={`${x.productId}-${x.reason}`} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate">{x.name || t("common:fields.product")}</span>
                      <Badge variant={x.reason === "needs_cost" ? "destructive" : "secondary"}>{SKIP_KEY[x.reason] ? t(SKIP_KEY[x.reason]) : x.label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {result.remaining > 0
                ? t("finance:opening.remaining", { count: result.remaining, n: formatNumber(result.remaining) })
                : t("finance:opening.allMoved")}{" "}
              {t("finance:opening.safe")}
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : rows.length === 0 && !err ? (
          <Alert><AlertDescription>
            {t("finance:opening.nothingToMove")}
            {preview && preview.alreadyMovedIn > 0 ? ` ${t("finance:opening.alreadyMoved", { count: preview.alreadyMovedIn, n: formatNumber(preview.alreadyMovedIn) })}` : ""}
          </AlertDescription></Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-end">
              <FormField label={t("finance:opening.cutover")} htmlFor="opening-cutover" description={preview?.cutoverReason ?? undefined}>
                <DatePicker id="opening-cutover" value={cutover} onChange={setCutover} max="today" />
              </FormField>
              <InfoList className="sm:justify-self-end sm:text-right">
                <InfoRow label={t("finance:opening.ready")} value={t("finance:opening.readyOf", { n: formatNumber(chosen.length), total: formatNumber(rows.length) })} />
                <InfoRow label={t("finance:col.value")} value={<span className="tabular-nums">{fmt.money(totals.value)} <CurrencyTag code={preview?.context.currency?.code} /></span>} />
              </InfoList>
            </div>
            {preview && preview.alreadyMovedIn > 0 && (
              <p className="text-xs text-muted-foreground">{t("finance:opening.notListed", { count: preview.alreadyMovedIn, n: formatNumber(preview.alreadyMovedIn) })}</p>
            )}
            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={allPicked} onCheckedChange={toggleAll} aria-label={t("finance:opening.selectAll")} disabled={!ready.length} /></TableHead>
                    <TableHead>{t("common:fields.product")}</TableHead>
                    <TableHead className="text-right">{t("common:fields.quantity")}</TableHead>
                    <TableHead className="w-40 text-right">{t("finance:col.unitCost")}</TableHead>
                    <TableHead className="text-right">{t("finance:col.value")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const c = costOf(r)
                    return (
                      <TableRow key={r.productId} data-state={picked.has(r.productId) && c > 0 ? "selected" : undefined}>
                        <TableCell><Checkbox checked={picked.has(r.productId) && c > 0} disabled={c <= 0} onCheckedChange={() => toggle(r.productId)} aria-label={t("finance:opening.moveInName", { name: r.name })} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 font-medium">{r.name}{c <= 0 && <Badge variant="destructive">{t("finance:opening.needsCost")}</Badge>}</div>
                          {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.quantity)}</TableCell>
                        <TableCell className="text-right">
                          <Input type="number" inputMode="decimal" min="0" step="0.01" aria-label={t("finance:opening.unitCostOf", { name: r.name })} placeholder="0.00"
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
            <p className="text-xs text-muted-foreground">{t("finance:opening.footnote")}</p>
          </div>
        )}

        {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{result ? t("common:actions.done") : t("common:actions.cancel")}</Button>
          {!result && writable && rows.length > 0 && (
            <Button type="button" onClick={post} disabled={busy || chosen.length === 0}>
              <PackagePlus className="size-4" aria-hidden /> {busy ? t("finance:opening.moving") : t("finance:opening.moveInCount", { count: chosen.length, n: formatNumber(chosen.length) })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
