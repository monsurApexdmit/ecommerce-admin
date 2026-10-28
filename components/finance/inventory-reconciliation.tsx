"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Scale } from "lucide-react"
import type { Reconciliation } from "@/lib/financeApi"
import { formatNumber } from "@/lib/finance-format"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { SectionCard } from "@/components/common/SectionCard"
import { StatTile } from "@/components/common/StatTile"
import { AsOfNowLabel } from "./finance-filters"
import { CurrencyTag, SignedMoney, TileSkeletons, useFinanceFormat } from "./finance-ui"

/**
 * INV-3: stock value vs the value the stock movements explain. "Show the math" lists the lines that make up the
 * difference (they add up to it exactly) with an action per line.
 */
export function ReconciliationCard({ data, error, onMoveIn, onBackfill, writable }: {
  data: Reconciliation | null
  error?: string
  onMoveIn: () => void
  onBackfill: () => void
  writable: boolean
}) {
  const fmt = useFinanceFormat()
  const [open, setOpen] = useState(false)
  const money = fmt.money

  const action = (a: NonNullable<Reconciliation["lines"][number]["action"]>) => {
    if (a.type === "move_in_opening_stock") return writable ? <Button type="button" size="sm" variant="outline" onClick={onMoveIn}>{a.label}</Button> : null
    if (a.type === "backfill_sale_movements") return writable ? <Button type="button" size="sm" variant="outline" onClick={onBackfill}>{a.label}</Button> : null
    return a.href ? <Button asChild size="sm" variant="outline"><Link href={a.href}>{a.label}</Link></Button> : null
  }

  return (
    <SectionCard
      title="Stock value vs movements"
      description="What your stock is worth at cost against what the recorded stock movements add up to."
      actions={<><AsOfNowLabel /><CurrencyTag code={data?.context.currency?.code} /></>}
      contentClassName="flex flex-col gap-4"
    >
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        {!data ? <TileSkeletons n={3} /> : <>
          <StatTile label="Stock value" value={money(data.stockValue)} hint="On hand today, at cost" />
          <StatTile label="Movement value" value={money(data.movementValue)} hint="Σ movements × their unit cost" />
          <StatTile label="Difference" icon={<Scale />} value={<SignedMoney value={data.difference} format={money} />}
            hint={data.difference === 0 ? "They match" : "Stock value − movement value"} />
        </>}
      </div>
      {data && (
        <Alert className={cn(data.difference !== 0 && "border-amber-300 dark:border-amber-700")}>
          <AlertTitle>{data.difference === 0 ? "Stock and movements agree" : "There is a gap"}</AlertTitle>
          <AlertDescription>{data.text || (data.difference === 0 ? "Every unit on hand is explained by a movement." : `Off by ${money(Math.abs(data.difference))}.`)}</AlertDescription>
        </Alert>
      )}
      {!data ? <Skeleton className="h-10" /> : data.difference !== 0 || data.lines.length > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-fit">
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden /> {open ? "Hide the math" : "Show the math"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 flex flex-col gap-5">
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow><TableHead>Reason</TableHead><TableHead className="text-right">Products</TableHead><TableHead className="text-right">Value</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.byKind.map((k) => (
                    <TableRow key={k.kind}>
                      <TableCell className="font-medium">{k.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(k.count)}</TableCell>
                      <TableCell className="text-right"><SignedMoney value={k.value} format={money} /></TableCell>
                    </TableRow>
                  ))}
                  {data.unexplained !== 0 && (
                    <TableRow>
                      <TableCell className="font-medium text-destructive">Not explained</TableCell>
                      <TableCell />
                      <TableCell className="text-right"><SignedMoney value={data.unexplained} format={money} /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Difference</TableCell>
                    <TableCell className="text-right text-xs font-normal text-muted-foreground">Explained {money(data.explained)} · not explained {money(data.unexplained)}</TableCell>
                    <TableCell className="text-right font-bold"><SignedMoney value={data.difference} format={money} /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {data.missingSaleMovements.lines > 0 && (
              <Alert>
                <AlertTitle>{formatNumber(data.missingSaleMovements.lines)} sale line{data.missingSaleMovements.lines === 1 ? " has" : "s have"} no stock movement</AlertTitle>
                <AlertDescription>
                  <span>Worth {money(data.missingSaleMovements.value)} at cost. Creating them makes the History match the cost of goods sold.</span>
                  {writable && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onBackfill}>Create missing sale movements</Button>}
                </AlertDescription>
              </Alert>
            )}
            {data.lines.length > 0 && (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Value</TableHead><TableHead className="w-48"><span className="sr-only">Action</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.lines.map((l, i) => (
                      <TableRow key={`${l.kind}-${l.productId ?? i}-${i}`}>
                        <TableCell className="max-w-[240px]">
                          <div className="truncate font-medium">{l.name}</div>
                          {l.explanation && <div className="text-xs text-muted-foreground">{l.explanation}</div>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{l.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(l.quantity)}</TableCell>
                        <TableCell className="text-right"><SignedMoney value={l.value} format={money} /></TableCell>
                        <TableCell className="text-right">{l.action ? action(l.action) : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {data.lines.length >= 200 && <p className="mt-2 text-xs text-muted-foreground">Showing the 200 largest lines; the totals above include every line.</p>}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </SectionCard>
  )
}
