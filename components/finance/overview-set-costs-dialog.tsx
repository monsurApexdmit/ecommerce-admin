"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Package, Search } from "lucide-react"
import financeApi, { financeError, type PageMeta, type PeriodParams, type ProductWithoutCost } from "@/lib/financeApi"
import { formatNumber } from "@/lib/finance-format"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { EmptyState } from "@/components/common/EmptyState"
import { useFinanceFormat } from "./finance-ui"

/** OV-1 "Set costs": products with stock or sales but no cost price (point in time), with their uncosted sales. */
export function SetCostsDialog({ open, onClose, period }: { open: boolean; onClose: () => void; period: PeriodParams }) {
  const { money } = useFinanceFormat()
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [rows, setRows] = useState<ProductWithoutCost[] | null>(null)
  const [totals, setTotals] = useState<{ products: number; uncostedSales: number } | null>(null)
  const [meta, setMeta] = useState<PageMeta | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 300); return () => clearTimeout(t) }, [q])
  useEffect(() => { setPage(1) }, [qD])

  const periodKey = JSON.stringify(period)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const r = await financeApi.getProductsWithoutCost({ ...period, search: qD || undefined, page, perPage })
      setRows(r.rows); setTotals(r.totals); setMeta(r.meta)
    } catch (e) {
      setError(financeError(e, "Could not load products without a cost."))
    } finally {
      setLoading(false)
    }
  }, [periodKey, qD, page, perPage]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) load() }, [open, load])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Set costs</DialogTitle>
          <DialogDescription>
            Products with stock or sales but no cost price. Their sales count as uncosted, so profit can't be worked out for them.
            {totals && ` ${formatNumber(totals.products)} product${totals.products === 1 ? "" : "s"} · ${money(totals.uncostedSales)} uncosted sales in the period.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput aria-label="Search products" placeholder="Product or SKU…" value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          {!rows ? (
            <div className="flex flex-col gap-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState icon={Package} title="Every product has a cost" description={qD ? "Nothing matches this search." : "Profit is worked out on all product sales."} />
          ) : (
            <div className={`max-h-[50vh] overflow-auto ${loading ? "opacity-60" : ""}`}>
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead><TableHead className="text-right">In stock</TableHead><TableHead className="text-right">Units sold</TableHead>
                    <TableHead className="text-right">Uncosted sales</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="w-24"><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.productId}>
                      <TableCell><div className="font-medium">{r.name}</div>{r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.stock)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.unitsSold)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.uncostedSales)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{money(r.price)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline"><Link href={r.editHref ?? `/dashboard/products/${r.productId}`}>Set cost</Link></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {meta && meta.total > 0 && (
            <PaginationControl currentPage={page} totalPages={Math.max(1, meta.lastPage)} itemsPerPage={perPage} totalItems={meta.total}
              onPageChange={setPage} onItemsPerPageChange={(n) => { setPerPage(n); setPage(1) }} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
