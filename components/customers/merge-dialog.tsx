"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { customerApi, type CustomerResponse, type DuplicateGroup } from "@/lib/customerApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/common/EmptyState"
import { SectionTitle } from "@/components/common/SectionTitle"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  groups: DuplicateGroup[]
  loading?: boolean
  title?: string
  onMerged: () => void
}

const best = (cs: CustomerResponse[]) =>
  [...cs].sort((a, b) => (b.totalOrders ?? 0) - (a.totalOrders ?? 0) || a.id - b.id)[0]?.id

export function MergeDialog({ open, onOpenChange, groups, loading, title = "Review & merge duplicates", onMerged }: Props) {
  const { formatCurrency } = useCompanySettings()
  const { toast } = useToast()
  const [local, setLocal] = useState<DuplicateGroup[]>([])
  const [primary, setPrimary] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    setLocal(groups)
    setPrimary(Object.fromEntries(groups.map((g) => [g.key, best(g.customers) as number])))
  }, [groups, open])

  const merge = async (g: DuplicateGroup) => {
    const pid = primary[g.key]
    const others = g.customers.filter((c) => c.id !== pid).map((c) => c.id)
    if (!pid || !others.length) return
    setBusy(g.key)
    try {
      const r = await customerApi.merge(pid, others)
      toast({ title: "Merged", description: `${r.merged} duplicate${r.merged === 1 ? "" : "s"} merged into ${r.customer?.name ?? "the primary record"}` })
      setLocal((prev) => prev.filter((x) => x.key !== g.key))
      onMerged()
    } catch (e: any) {
      toast({ variant: "destructive", title: "Could not merge", description: e?.response?.data?.message || e?.message || "Please try again" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[720px]">
        <DialogHeader className="px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pick the record to keep. Sales, payments, addresses and tags move to it, then the others are removed.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {loading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-28" />)
          ) : local.length === 0 ? (
            <EmptyState title="No duplicates found." className="p-4 md:p-6" />
          ) : (
            local.map((g) => (
              <Card key={g.key} className="gap-0 overflow-hidden py-0">
                <SectionTitle
                  className="gap-3 px-4 py-2.5"
                  action={
                    <Button type="button" disabled={busy === g.key} onClick={() => merge(g)}>
                      {busy === g.key ? "Merging…" : "Merge"}
                    </Button>
                  }
                >
                  {g.reason === "phone" ? "Same phone number" : "Same name and email"} · {g.customers.length} records
                </SectionTitle>
                <Separator />
                <RadioGroup aria-label="Record to keep" className="flex flex-col gap-0"
                  value={primary[g.key] != null ? String(primary[g.key]) : undefined}
                  onValueChange={(v) => setPrimary((p) => ({ ...p, [g.key]: Number(v) }))}>
                  {g.customers.map((c) => {
                    const on = primary[g.key] === c.id
                    const rid = `merge-${g.key}-${c.id}`
                    return (
                      <Label key={c.id} htmlFor={rid}
                        className={cn("flex cursor-pointer items-center gap-3 border-b px-4 py-2.5 text-left font-normal last:border-b-0", on && "bg-muted/50")}>
                        <RadioGroupItem id={rid} value={String(c.id)} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{c.name}{on && <Badge variant="secondary" className="ml-2">Keep</Badge>}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.phone || "—"} · {c.email || "no email"}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                          {c.totalOrders ?? 0} orders · {formatCurrency(Number(c.totalSpent) || 0)}
                        </span>
                      </Label>
                    )
                  })}
                </RadioGroup>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
