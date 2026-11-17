"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown, Scale } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { FIN_NS, type FinKey } from "./i18n"

/** Reconciliation action types from the API → label keys (server label is the fallback). */
const ACTION_KEY: Record<string, FinKey> = {
  move_in_opening_stock: "finance:opening.title",
  backfill_sale_movements: "finance:inventory.createMissing",
}

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
  const { t } = useTranslation(FIN_NS)
  const [open, setOpen] = useState(false)
  const money = fmt.money

  const action = (a: NonNullable<Reconciliation["lines"][number]["action"]>) => {
    const label = ACTION_KEY[a.type] ? t(ACTION_KEY[a.type]) : a.label
    if (a.type === "move_in_opening_stock") return writable ? <Button type="button" size="sm" variant="outline" onClick={onMoveIn}>{label}</Button> : null
    if (a.type === "backfill_sale_movements") return writable ? <Button type="button" size="sm" variant="outline" onClick={onBackfill}>{label}</Button> : null
    return a.href ? <Button asChild size="sm" variant="outline"><Link href={a.href}>{label}</Link></Button> : null
  }

  return (
    <SectionCard
      title={t("finance:recon.title")}
      description={t("finance:recon.description")}
      actions={<><AsOfNowLabel /><CurrencyTag code={data?.context.currency?.code} /></>}
      contentClassName="flex flex-col gap-4"
    >
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-4 sm:grid-cols-3">
        {!data ? <TileSkeletons n={3} /> : <>
          <StatTile label={t("finance:recon.stockValue")} value={money(data.stockValue)} hint={t("finance:recon.stockValueHint")} />
          <StatTile label={t("finance:recon.movementValue")} value={money(data.movementValue)} hint={t("finance:recon.movementValueHint")} />
          <StatTile label={t("finance:health.difference")} icon={<Scale />} value={<SignedMoney value={data.difference} format={money} />}
            hint={data.difference === 0 ? t("finance:recon.match") : t("finance:recon.diffHint")} />
        </>}
      </div>
      {data && (
        <Alert className={cn(data.difference !== 0 && "border-amber-300 dark:border-amber-700")}>
          <AlertTitle>{data.difference === 0 ? t("finance:recon.agree") : t("finance:recon.gap")}</AlertTitle>
          <AlertDescription>{data.text || (data.difference === 0 ? t("finance:recon.explained") : t("finance:recon.offBy", { amount: money(Math.abs(data.difference)) }))}</AlertDescription>
        </Alert>
      )}
      {!data ? <Skeleton className="h-10" /> : data.difference !== 0 || data.lines.length > 0 ? (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="w-fit">
              <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden /> {open ? t("finance:recon.hideMath") : t("finance:recon.showMath")}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 flex flex-col gap-5">
            <div className="overflow-x-auto">
              <Table className="min-w-[480px]">
                <TableHeader>
                  <TableRow><TableHead>{t("common:extra.reason")}</TableHead><TableHead className="text-right">{t("common:fields.products")}</TableHead><TableHead className="text-right">{t("finance:col.value")}</TableHead></TableRow>
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
                      <TableCell className="font-medium text-destructive">{t("finance:recon.notExplained")}</TableCell>
                      <TableCell />
                      <TableCell className="text-right"><SignedMoney value={data.unexplained} format={money} /></TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">{t("finance:health.difference")}</TableCell>
                    <TableCell className="text-right text-xs font-normal text-muted-foreground">{t("finance:recon.explainedSplit", { explained: money(data.explained), unexplained: money(data.unexplained) })}</TableCell>
                    <TableCell className="text-right font-bold"><SignedMoney value={data.difference} format={money} /></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {data.missingSaleMovements.lines > 0 && (
              <Alert>
                <AlertTitle>{t("finance:recon.missingTitle", { count: data.missingSaleMovements.lines, n: formatNumber(data.missingSaleMovements.lines) })}</AlertTitle>
                <AlertDescription>
                  <span>{t("finance:recon.missingDesc", { amount: money(data.missingSaleMovements.value) })}</span>
                  {writable && <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onBackfill}>{t("finance:inventory.createMissing")}</Button>}
                </AlertDescription>
              </Alert>
            )}
            {data.lines.length > 0 && (
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("common:fields.product")}</TableHead><TableHead>{t("common:extra.reason")}</TableHead><TableHead className="text-right">{t("common:fields.quantity")}</TableHead>
                      <TableHead className="text-right">{t("finance:col.value")}</TableHead><TableHead className="w-48"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
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
                {data.lines.length >= 200 && <p className="mt-2 text-xs text-muted-foreground">{t("finance:recon.top200")}</p>}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </SectionCard>
  )
}
