"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Download } from "lucide-react"
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

const REASONS = ["Restock store", "Rebalance stock", "Customer order pickup", "Return to warehouse"]


interface Line { key: string; productId: number; variantId: number | null; name: string; avail: number; qty: number }

export default function TransferPage() {
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
    setTo((t) => t || String((warehouses.find((w) => w.id !== def.id) ?? def).id))
  }, [warehouses])

  useEffect(() => {
    const t = setTimeout(() => setHqDebounced(hq.trim()), 250)
    return () => clearTimeout(t)
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
    if (!from || !to) { setErr("Choose both locations."); return }
    if (from === to) { setErr("From and To must be different locations."); return }
    if (lines.length === 0) { setErr("Add at least one product."); return }
    setBusy(true); setErr("")
    try {
      const doc = await transferApi.createDocument({
        fromLocationId: Number(from), toLocationId: Number(to), reason,
        sentWith: sentWith.trim() || undefined, note: note.trim() || undefined,
        items: lines.map((l) => ({ productId: l.productId, variantId: l.variantId ?? undefined, quantity: l.qty })),
      })
      toast({ title: `Transfer ${doc.transferNo} done`, description: `${units} units moved to ${nameOf(to)}` })
      setLines([]); setSentWith(""); setNote("")
      setPage(1)
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      setErr(e?.response?.data?.message || "Could not complete the transfer.")
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (t: TransferDocument) => {
    if (!window.confirm(`Cancel ${t.transferNo} and return ${t.units} units to ${t.from.name}?`)) return
    try {
      await transferApi.cancelDocument(t.id)
      toast({ title: `${t.transferNo} cancelled`, description: "Stock returned to the source location" })
      await Promise.all([loadStock(), loadHistory()])
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not cancel", description: e?.response?.data?.message })
    }
  }

  const cycleLoc = () => {
    const opts = ["all", ...warehouses.map((w) => String(w.id))]
    setLocF(opts[(opts.indexOf(locF) + 1) % opts.length])
    setPage(1)
  }

  const handleExport = () => {
    const rows = history.flatMap((t) => {
      const base = {
        no: t.transferNo, date: t.createdAt, from: t.from.name, to: t.to.name,
        reason: t.reason, sentWith: t.sentWith ?? "", status: t.isReversal ? "reversal" : t.status,
        note: [t.reversedBy ? `Returned via ${t.reversedBy}` : "", t.note ?? ""].filter(Boolean).join(" · "), by: t.createdBy ?? "",
      }
      return t.lines.length
        ? t.lines.map((l) => ({ ...base, product: l.name, quantity: l.quantity }))
        : [{ ...base, product: "", quantity: t.units }]
    })
    exportToCSV(rows, "stock-transfers", ["no", "date", "from", "to", "product", "quantity", "reason", "sentWith", "status", "note", "by"])
  }

  if (blocked) return blocked

  return (
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader
        title="Stock transfers"
        description="Move stock between your warehouse and shops."
        actions={<Button type="button" variant="outline" onClick={handleExport}><Download className="size-4" aria-hidden /> Export</Button>}
      />

      <div className="flex flex-col items-start gap-5 xl:flex-row">
        <SectionCard
          className="w-full shrink-0 xl:w-[520px]"
          title="New transfer"
          description="Move stock between locations. Stock moves immediately and is logged in the history."
        >
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <FormField label="From" htmlFor="tr-from">
                <Select value={from || undefined} onValueChange={changeFrom}>
                  <SelectTrigger id="tr-from" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
              <WithTooltip content="Swap locations"><Button type="button" variant="outline" size="icon" onClick={swap} aria-label="Swap locations">⇄</Button></WithTooltip>
              <FormField label="To" htmlFor="tr-to">
                <Select value={to || undefined} onValueChange={(v) => { setTo(v); setErr("") }}>
                  <SelectTrigger id="tr-to" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Products</p>
              <Label htmlFor="tr-search" className="sr-only">Search products</Label>
              <Input id="tr-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search or scan a product in ${fromName}…`} />
              {results.length > 0 && (
                <Card className="gap-0 overflow-hidden py-0">
                  {results.map((r) => (
                    <Button key={`${r.type}-${r.id}`} type="button" variant="ghost" onClick={() => addLine(r)}
                      className="h-auto w-full justify-between gap-3 rounded-none text-left whitespace-normal">
                      <span className="text-sm font-semibold">{r.variantName ? `${r.productName} · ${r.variantName}` : r.productName}</span>
                      <span className="text-xs text-muted-foreground">{r.stock} available</span>
                    </Button>
                  ))}
                </Card>
              )}
              {noResults && !stockLoading && <div className="text-xs text-muted-foreground">No matching product with stock in {fromName}.</div>}

              <Card className="gap-0 py-0">
                {lines.length === 0 ? (
                  <EmptyState title="Add products to move." className="p-4 md:p-6" />
                ) : lines.map((l, i) => (
                  <div key={l.key}>
                  {i > 0 && <ItemSeparator />}
                  <Item size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full truncate">{l.name}</ItemTitle>
                      <ItemDescription>{l.avail} available in {fromName}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                    <div className="flex items-center">
                      <WithTooltip content="Decrease quantity"><Button type="button" variant="outline" size="icon" aria-label="Decrease quantity" onClick={() => setQty(l.key, l.qty - 1)}>−</Button></WithTooltip>
                      <Input type="number" min={1} max={l.avail} aria-label="Quantity" value={l.qty} onChange={(e) => setQty(l.key, Number(e.target.value))}
                        className="mx-1 w-16 text-center tabular-nums" />
                      <WithTooltip content="Increase quantity"><Button type="button" variant="outline" size="icon" aria-label="Increase quantity" onClick={() => setQty(l.key, l.qty + 1)}>+</Button></WithTooltip>
                    </div>
                    <WithTooltip content="Remove"><Button type="button" variant="ghost" size="icon" aria-label="Remove" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>×</Button></WithTooltip>
                    </ItemActions>
                  </Item>
                  </div>
                ))}
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Reason" htmlFor="tr-reason">
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger id="tr-reason" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </FormField>
              <FormField label="Sent with" htmlFor="tr-sent-with">
                <Input id="tr-sent-with" className="w-full" value={sentWith} onChange={(e) => setSentWith(e.target.value)} placeholder="e.g. Rafiq / van" />
              </FormField>
            </div>
            <FormField label="Note" htmlFor="tr-note">
              <Textarea id="tr-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
            </FormField>

            {err && <p role="alert" className="text-sm font-medium text-destructive">{err}</p>}
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">{units} units · {fromName} → {nameOf(to)}</span>
              <Button type="button" disabled={lines.length === 0 || busy} onClick={submit}>
                {busy ? "Moving…" : `Move ${units} units now`}
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          className="w-full min-w-0 flex-1"
          title="Transfer history"
          actions={
            <Button type="button" variant="outline" onClick={cycleLoc} aria-label="Filter by location">
              {locF === "all" ? "All locations" : nameOf(locF)} ▾
            </Button>
          }
        >
          <Toolbar className="mb-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="tr-hist-search" className="sr-only">Search transfers</Label>
              <Input id="tr-hist-search" type="search" value={hq} onChange={(e) => { setHq(e.target.value); setPage(1) }} placeholder="Search no. or product…" />
            </div>
            <Select value={statusF} onValueChange={(v) => { setStatusF(v); setPage(1) }}>
              <SelectTrigger aria-label="Status" className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Status: All</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </Toolbar>
          <div className="mb-3 text-sm text-muted-foreground">{stats.count} transfer{stats.count === 1 ? "" : "s"} · {stats.unitsMoved} units moved</div>

          {histLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : history.length === 0 ? (
            <EmptyState title={hqDebounced || statusF !== "all" || locF !== "all" ? "No transfers match these filters." : "No transfers yet. Move stock with the form."} />
          ) : (
            <div className="flex flex-col gap-3">
              {history.map((t) => {
                const isOpen = open.has(t.id)
                return (
                  <Card key={t.id} className="gap-0 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold">{t.transferNo}</span>
                      <StatusBadge
                        status={t.status === "completed" ? "completed" : "cancelled"}
                        label={t.status !== "completed" ? "Cancelled" : t.isReversal ? "Reversal" : "Completed"}
                      />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-sm"><strong>{t.from.name}</strong><span aria-hidden>→</span><strong>{t.to.name}</strong></div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{t.itemsSummary}</div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {[t.reason, t.sentWith && `sent with ${t.sentWith}`, t.reversedBy && `Returned via ${t.reversedBy}`, t.createdBy].filter(Boolean).join(" · ")}
                      </span>
                      <div className="flex gap-2">
                        {t.canCancel && <Button type="button" variant="destructive" size="sm" onClick={() => cancel(t)}>Cancel &amp; return stock</Button>}
                        <Button type="button" variant="outline" size="sm" aria-expanded={isOpen} onClick={() => setOpen((p) => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })}>{isOpen ? "Hide details" : "Details"}</Button>
                      </div>
                    </div>
                    {isOpen && (
                      <>
                      <Separator className="my-3" />
                      <InfoList className="gap-1">
                        {t.lines.map((x, i) => <InfoRow key={i} label={x.name} value={`×${x.quantity}`} />)}
                      </InfoList>
                      <div className="mt-2 text-sm text-muted-foreground">{[t.sentWith && `Sent with ${t.sentWith}`, t.reversedBy && `Returned via ${t.reversedBy}`, t.note].filter(Boolean).join(" · ") || "No note."}</div>
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
