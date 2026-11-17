"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { ParseKeys } from "i18next"
import { localeTag } from "@/lib/i18n"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaginationControl } from "@/components/ui/pagination-control"
import { bricolage, instrument } from "@/components/dashboard/fonts"
import transferApi, { type LocationProduct, type TransferDocument } from "@/lib/transferApi"
import { exportToCSV } from "@/lib/export-import-utils"
import { useWarehouse } from "@/contexts/warehouse-context"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Item, ItemActions, ItemContent, ItemDescription, ItemSeparator, ItemTitle } from "@/components/ui/item"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { Toolbar } from "@/components/common/Toolbar"
import { StatusBadge } from "@/components/common/StatusBadge"
import { EmptyState } from "@/components/common/EmptyState"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { WithTooltip } from "@/components/common/WithTooltip"

const NS = ["inventory", "common"] as const
type K = ParseKeys<typeof NS>

// Reason values are saved on the transfer as-is; only the shown label is translated
const REASONS = ["Restock store", "Rebalance stock", "Customer order pickup", "Return to warehouse"]
const REASON_KEY: Record<string, K> = {
  "Restock store": "inventory:transfers.reason.restockStore",
  "Rebalance stock": "inventory:transfers.reason.rebalance",
  "Customer order pickup": "inventory:transfers.reason.pickup",
  "Return to warehouse": "inventory:transfers.reason.returnToWarehouse",
}


interface Line { key: string; productId: number; variantId: number | null; name: string; avail: number; qty: number }

export default function TransferPage() {
  const { t, i18n } = useTranslation(NS)
  const reasonLabel = (r?: string | null) => (r && REASON_KEY[r] ? t(REASON_KEY[r]) : r ?? "")
  const { warehouses } = useWarehouse()
  const { toast } = useToast()
  const blocked = useModuleGuard("Transfers")

  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [q, setQ] = useState("")
  const [stock, setStock] = useState<LocationProduct[]>([])
  const [stockLoading, setStockLoading] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [reason, setReason] = useState(REASONS[0])
  const [sentWith, setSentWith] = useState("")
  const [note, setNote] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  const [history, setHistory] = useState<TransferDocument[]>([])
  const [stats, setStats] = useState({ count: 0, unitsMoved: 0 })
  const [total, setTotal] = useState(0)
  const [histLoading, setHistLoading] = useState(true)
  const [hq, setHq] = useState("")
  const [hqDebounced, setHqDebounced] = useState("")
  const [statusF, setStatusF] = useState("all")
  const [locF, setLocF] = useState("all")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [open, setOpen] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (warehouses.length === 0) return
    const def = warehouses.find((w) => w.isDefault) ?? warehouses[0]
    setFrom((f) => f || String(def.id))
    setTo((cur) => cur || String((warehouses.find((w) => w.id !== def.id) ?? def).id))
  }, [warehouses])

  useEffect(() => {
    const id = setTimeout(() => setHqDebounced(hq.trim()), 250)
    return () => clearTimeout(id)
  }, [hq])

  const loadStock = useCallback(async () => {
    if (!from) return
    setStockLoading(true)
    try {
      const res = await transferApi.getProductsByLocation(Number(from))
      const flat: LocationProduct[] = (res.data ?? []).flatMap((p): LocationProduct[] =>
        p.variants?.length
          ? p.variants.map((v) => ({ type: "variant" as const, id: v.id, productId: p.id, productName: p.name, variantName: v.name, sku: v.sku, stock: v.stock }))
          : [{ type: "product" as const, id: p.id, productId: p.id, productName: p.name, sku: p.sku, stock: p.stock }],
      )
      setStock(flat.filter((x) => x.stock > 0))
    } catch {
      setStock([])
    } finally {
      setStockLoading(false)
    }
  }, [from])

  useEffect(() => { loadStock() }, [loadStock])

  const loadHistory = useCallback(async () => {
    setHistLoading(true)
    try {
      const res = await transferApi.getDocuments({
        search: hqDebounced || undefined,
        status: statusF !== "all" ? statusF : undefined,
        location_id: locF !== "all" ? Number(locF) : undefined,
        page, per_page: perPage,
      })
      setHistory(res.data)
      setStats(res.stats)
      setTotal(res.total)
    } catch {
      setHistory([])
    } finally {
      setHistLoading(false)
    }
  }, [hqDebounced, statusF, locF, page, perPage])

  useEffect(() => { loadHistory() }, [loadHistory])

  const nameOf = (id: string) => warehouses.find((w) => String(w.id) === id)?.name ?? "—"
  const fromName = nameOf(from)

  const results = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    return stock
      .filter((s) => !lines.some((l) => l.productId === s.productId && l.variantId === (s.type === "variant" ? s.id : null)))
      .filter((s) => `${s.productName} ${s.variantName ?? ""} ${s.sku}`.toLowerCase().includes(term))
      .slice(0, 6)
  }, [q, stock, lines])
  const noResults = q.trim() !== "" && results.length === 0

  const units = lines.reduce((a, l) => a + l.qty, 0)

  const swap = () => { setFrom(to); setTo(from); setLines([]); setErr("") }
  const changeFrom = (v: string) => { setFrom(v); setLines([]); setErr("") }

  const addLine = (s: LocationProduct) => {
    setLines((ls) => [...ls, {
      key: `${s.type}-${s.id}`, productId: s.productId, variantId: s.type === "variant" ? s.id : null,
      name: s.variantName ? `${s.productName} · ${s.variantName}` : s.productName, avail: s.stock, qty: 1,
    }])
    setQ("")
    setErr("")
  }
  const setQty = (key: string, v: number) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, qty: Math.max(1, Math.min(l.avail, Math.floor(v) || 1)) } : l)))

  const submit = async () => {
    if (!from || !to) { setErr(t("inventory:transfers.validation.bothLocations")); return }
    if (from === to) { setErr(t("inventory:transfers.validation.sameLocation")); return }
    if (lines.length === 0) { setErr(t("inventory:transfers.validation.noProducts")); return }
    setBusy(true); setErr("")
    try {
      const doc = await transferApi.createDocument({
        fromLocationId: Number(from), toLocationId: Number(to), reason,
        sentWith: sentWith.trim() || undefined, note: note.trim() || undefined,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId ?? undefined, quantity: l.qty })),
      })
      toast({ title: t("inventory:transfers.toast.done", { number: doc.transferNo }), description: t("inventory:transfers.toast.moved", { count: units, location: nameOf(to) }) })
      setLines([]); setSentWith(""); setNote("")
      setPage(1)
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      setErr(e?.response?.data?.message || t("inventory:transfers.toast.failed"))
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (doc: TransferDocument) => {
    if (!window.confirm(t("inventory:transfers.confirmCancel", { number: doc.transferNo, count: doc.units, location: doc.from.name }))) return
    try {
      await transferApi.cancelDocument(doc.id)
      toast({ title: t("inventory:transfers.toast.cancelled", { number: doc.transferNo }), description: t("inventory:transfers.toast.cancelledDesc") })
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      toast({ variant: "destructive", title: t("inventory:transfers.toast.cancelFailed"), description: e?.response?.data?.message })
    }
  }

  const cycleLoc = () => {
    const opts = ["all", ...warehouses.map((w) => String(w.id))]
    setLocF(opts[(opts.indexOf(locF) + 1) % opts.length])
    setPage(1)
  }

  const handleExport = () => {
    const rows = history.flatMap((d) => {
      const base = {
        no: d.transferNo, date: d.createdAt, from: d.from.name, to: d.to.name,
        reason: reasonLabel(d.reason), sentWith: d.sentWith ?? "",
        status: d.isReversal ? t("inventory:transfers.status.reversal") : d.status === "completed" ? t("common:orderStatus.completed") : d.status === "cancelled" ? t("common:orderStatus.cancelled") : d.status,
        note: [d.reversedBy ? t("inventory:transfers.returnedVia", { number: d.reversedBy }) : "", d.note ?? ""].filter(Boolean).join(" · "), by: d.createdBy ?? "",
      }
      return d.lines.length
        ? d.lines.map((l) => ({ ...base, product: l.name, quantity: l.quantity }))
        : [{ ...base, product: "", quantity: d.units }]
    })
    exportToCSV(rows, "stock-transfers", ["no", "date", "from", "to", "product", "quantity", "reason", "sentWith", "status", "note", "by"])
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title={t("inventory:transfers.title")}
        description={t("inventory:transfers.description")}
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> {t("common:actions.export")}</Button>}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <SectionCard
          className="w-full shrink-0 xl:w-[520px]"
          title={t("inventory:transfers.newTitle")}
          description={t("inventory:transfers.newDescription")}
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <FormField label={t("common:extra.from")} htmlFor="tr-from">
                <Select value={from || undefined} onValueChange={changeFrom}>
                  <SelectTrigger id="tr-from" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <WithTooltip content={t("inventory:transfers.swap")}><Button type="button" variant="outline" size="icon" onClick={swap} aria-label={t("inventory:transfers.swap")}>⇄</Button></WithTooltip>
              <FormField label={t("common:extra.to")} htmlFor="tr-to">
                <Select value={to || undefined} onValueChange={(v) => { setTo(v); setErr("") }}>
                  <SelectTrigger id="tr-to" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">{t("common:fields.products")}</p>
              <Label htmlFor="tr-search" className="sr-only">{t("inventory:returns.supplier.form.searchProducts")}</Label>
              <Input id="tr-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("inventory:transfers.searchPh", { location: fromName })} />
              {results.length > 0 && (
                <Card className="gap-0 overflow-hidden py-0">
                  {results.map((r) => (
                    <Button key={`${r.type}-${r.id}`} type="button" variant="ghost" onClick={() => addLine(r)}
                      className="h-auto w-full justify-between gap-3 rounded-none text-left whitespace-normal">
                      <span className="text-sm font-semibold">{r.variantName ? `${r.productName} · ${r.variantName}` : r.productName}</span>
                      <span className="text-xs text-muted-foreground">{t("inventory:transfers.available", { count: r.stock })}</span>
                    </Button>
                  ))}
                </Card>
              )}
              {noResults && !stockLoading && <div className="text-xs text-muted-foreground">{t("inventory:transfers.noMatch", { location: fromName })}</div>}

              <Card className="gap-0 py-0">
                {lines.length === 0 ? (
                  <EmptyState title={t("inventory:transfers.addProducts")} className="p-4 md:p-6" />
                ) : lines.map((l, i) => (
                  <div key={l.key}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">{l.name}</ItemTitle>
                      <ItemDescription>{t("inventory:transfers.availableIn", { count: l.avail, location: fromName })}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                    <div className="flex items-center">
                      <WithTooltip content={t("inventory:returns.decreaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.decreaseQty")} onClick={() => setQty(l.key, l.qty - 1)}>−</Button></WithTooltip>
                      <Input type="number" min={1} max={l.avail} aria-label={t("common:fields.quantity")} value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))}
                        className="mx-1 w-16 text-center tabular-nums" />
                      <WithTooltip content={t("inventory:returns.increaseQty")}><Button type="button" variant="outline" size="icon" aria-label={t("inventory:returns.increaseQty")} onClick={() => setQty(l.key, l.qty + 1)}>+</Button></WithTooltip>
                    </div>
                    <WithTooltip content={t("common:actions.remove")}><Button type="button" variant="ghost" size="icon" aria-label={t("common:actions.remove")} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</Button></WithTooltip>
                    </ItemActions>
                  </Item>
                  </div>
                ))}
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label={t("common:extra.reason")} htmlFor="tr-reason">
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="tr-reason" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{reasonLabel(r)}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label={t("inventory:transfers.sentWith")} htmlFor="tr-sent-with">
                <Input id="tr-sent-with" className="w-full" value={sentWith} onChange={(e) => setSentWith(e.target.value)} placeholder={t("inventory:transfers.sentWithPh")} />
              </FormField>
            </div>
            <FormField label={t("common:fields.note")} htmlFor="tr-note">
              <Textarea id="tr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("common:status.optional")} />
            </FormField>

            {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{t("inventory:purchases.units", { count: units })} · {fromName} → {nameOf(to)}</span>
              <Button type="button" disabled={lines.length === 0 || busy} onClick={submit}>
                {busy ? t("inventory:transfers.moving") : t("inventory:transfers.moveNow", { count: units })}
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="w-full min-w-0 flex-1"
          title={t("inventory:transfers.history")}
          actions={
            <Button type="button" variant="outline" onClick={cycleLoc} aria-label={t("inventory:transfers.filterLocation")}>
              {locF === "all" ? t("inventory:transfers.allLocations") : nameOf(locF)} ▾
            </Button>
          }
        >
          <Toolbar className="mb-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="tr-hist-search" className="sr-only">{t("inventory:transfers.searchLabel")}</Label>
              <Input id="tr-hist-search" type="search" value={hq} onChange={(e) => { setHq(e.target.value); setPage(1) }} placeholder={t("inventory:transfers.searchHistPh")} />
            </div>
            <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(1) }}>
              <SelectTrigger aria-label={t("common:fields.status")} className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("inventory:transfers.statusAll")}</SelectItem><SelectItem value="completed">{t("common:orderStatus.completed")}</SelectItem><SelectItem value="cancelled">{t("common:orderStatus.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </Toolbar>
          <div className="mb-3 text-sm text-muted-foreground">{t("inventory:transfers.statsCount", { count: stats.count })} · {t("inventory:transfers.unitsMoved", { count: stats.unitsMoved })}</div>

          {histLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState title={hqDebounced || statusF !== "all" || locF !== "all" ? t("inventory:transfers.empty.filtered") : t("inventory:transfers.empty.first")} />
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((d) => {
                const isOpen = open.has(d.id)
                return (
                  <Card key={d.id} className="gap-0 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{d.transferNo}</span>
                      <StatusBadge
                        status={d.status === "completed" ? "completed" : "cancelled"}
                        label={d.status !== "completed" ? t("common:orderStatus.cancelled") : d.isReversal ? t("inventory:transfers.status.reversal") : t("common:orderStatus.completed")}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm"><strong>{d.from.name}</strong><span aria-hidden>→</span><strong>{d.to.name}</strong></div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{d.itemsSummary}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString(localeTag(i18n.language), { month: "short", day: "numeric", year: "numeric" })} · {[reasonLabel(d.reason), d.sentWith && t("inventory:transfers.sentWithName", { name: d.sentWith }), d.reversedBy && t("inventory:transfers.returnedVia", { number: d.reversedBy }), d.createdBy].filter(Boolean).join(" · ")}
                      </span>
                      <div className="flex gap-2">
                        {d.canCancel && <Button type="button" variant="destructive" size="sm" onClick={() => cancel(d)}>{t("inventory:transfers.cancelReturn")}</Button>}
                        <Button type="button" variant="outline" size="sm" aria-expanded={isOpen} onClick={() => setOpen((p) => { const n = new Set(p); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n })}>{isOpen ? t("inventory:transfers.hideDetails") : t("common:extra.details")}</Button>
                      </div>
                    </div>
                    {isOpen && (
                      <>
                      <Separator className="my-3" />
                      <InfoList className="gap-1">
                        {d.lines.map((x, i) => <InfoRow key={i} label={x.name} value={`×${x.quantity}`} />)}
                      </InfoList>
                      <div className="mt-2 text-sm text-muted-foreground">{[d.sentWith && t("inventory:transfers.sentWithName", { name: d.sentWith }), d.reversedBy && t("inventory:transfers.returnedVia", { number: d.reversedBy }), d.note].filter(Boolean).join(" · ") || t("inventory:transfers.noNote")}</div>
                      </>
                    )}
                  </Card>
                )
              })}
            </div>
          )}

          {!histLoading && total > 0 && (
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
