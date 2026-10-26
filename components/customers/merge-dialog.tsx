"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { customerApi, type CustomerResponse, type DuplicateGroup } from "@/lib/customerApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useToast } from "@/hooks/use-toast"
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
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[720px] flex-col gap-0 overflow-hidden border-dash-border bg-dash-card p-0 font-dash-body text-dash-ink sm:max-w-[720px]">
        <DialogHeader className="border-b border-dash-border px-6 py-4 text-left">
          <DialogTitle className="font-dash-display text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>
            Pick the record to keep. Sales, payments, addresses and tags move to it, then the others are removed.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
          {loading ? (
            [1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)
          ) : local.length === 0 ? (
            <p className="py-8 text-center text-sm text-dash-muted">No duplicates found.</p>
          ) : (
            local.map((g) => (
              <div key={g.key} className="rounded-xl border border-dash-border">
                <div className="flex items-center justify-between gap-3 border-b border-dash-border-soft px-4 py-2.5">
                  <span className="text-xs font-bold uppercase tracking-[0.06em] text-dash-muted">
                    {g.reason === "phone" ? "Same phone number" : "Same name and email"} · {g.customers.length} records
                  </span>
                  <button type="button" disabled={busy === g.key} onClick={() => merge(g)}
                    className="h-9 rounded-lg bg-dash-accent px-3.5 text-[13px] font-semibold text-white disabled:opacity-40">
                    {busy === g.key ? "Merging…" : "Merge"}
                  </button>
                </div>
                <div role="radiogroup" aria-label="Record to keep" className="flex flex-col">
                  {g.customers.map((c) => {
                    const on = primary[g.key] === c.id
                    return (
                      <button key={c.id} type="button" role="radio" aria-checked={on}
                        onClick={() => setPrimary((p) => ({ ...p, [g.key]: c.id }))}
                        className={cn("flex items-center gap-3 border-b border-dash-border-soft px-4 py-2.5 text-left last:border-b-0", on && "bg-dash-accent-soft/40")}>
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-dash-accent" : "border-dash-border")}>
                          {on && <span className="size-2 rounded-full bg-dash-accent" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{c.name}{on && <span className="ml-2 text-xs font-bold text-dash-accent-fg">Keep</span>}</span>
                          <span className="block truncate text-xs text-dash-muted">{c.phone || "—"} · {c.email || "no email"}</span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-dash-muted">
                          {c.totalOrders ?? 0} orders · {formatCurrency(Number(c.totalSpent) || 0)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
