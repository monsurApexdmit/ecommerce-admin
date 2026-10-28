"use client"

import { useEffect, useState } from "react"
import financeApi, { financeError, type ExpenseActivity } from "@/lib/financeApi"
import type { ExpenseResponse } from "@/lib/expenseApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { formatDateTime } from "@/lib/finance-format"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { StatusBadge } from "@/components/common/StatusBadge"
import { cn } from "@/lib/utils"

const FIELD_LABELS: Record<string, string> = {
  amount: "Amount", expenseDate: "Date", title: "What for", expenseCategoryId: "Category", categoryName: "Category", paymentMethod: "Paid from",
  paidTo: "Paid to", vendorId: "Supplier", vendorName: "Supplier", locationId: "Location", referenceNo: "Reference", notes: "Note",
  isRecurring: "Repeats", recurringFrequency: "Every", nextDueDate: "Next due", recurringEndDate: "Repeat until",
}
const fieldLabel = (k: string) => FIELD_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()).trim()

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = { created: "default", edited: "secondary", voided: "destructive", deleted: "destructive" }

/** EXP-1: activity log of one expense (created / edited / voided / deleted — who and when). */
export function ExpenseActivitySheet({ expense, onClose }: { expense: ExpenseResponse | null; onClose: () => void }) {
  const { formatCurrency, timezone } = useCompanySettings()
  const [rows, setRows] = useState<ExpenseActivity[] | null>(null)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!expense) return
    setRows(null); setErr("")
    financeApi.getExpenseActivity(expense.id).then(setRows).catch((e) => { setRows([]); setErr(financeError(e, "Could not load the activity.")) })
  }, [expense])

  const show = (k: string, v: unknown) => {
    if (v == null || v === "") return "—"
    if (k === "amount" && typeof v === "number") return formatCurrency(v)
    if (typeof v === "boolean") return v ? "Yes" : "No"
    return String(v)
  }

  return (
    <Sheet open={!!expense} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Activity</SheetTitle>
          <SheetDescription>{expense ? `${expense.title} · EXP-${expense.id}` : ""}</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {err && <p className="mb-3 text-sm font-medium text-destructive" role="alert">{err}</p>}
          {rows == null ? (
            <div className="flex flex-col gap-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <ol className="relative flex flex-col gap-5 border-l pl-5">
              {rows.map((r) => (
                <li key={r.id} className="relative">
                  <span className={cn("absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background", r.action === "voided" || r.action === "deleted" ? "bg-destructive" : r.action === "edited" ? "bg-amber-500" : "bg-primary")} aria-hidden />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.action} label={r.label || r.action} variant={ACTION_VARIANT[r.action] ?? "outline"} />
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.at, timezone)}</span>
                  </div>
                  <p className="mt-1 text-sm">by <span className="font-medium">{r.byName ?? "Someone"}</span></p>
                  {r.changes && Object.keys(r.changes).length > 0 && (
                    <dl className="mt-2 grid gap-1 rounded-md bg-muted/50 p-2 text-xs">
                      {Object.entries(r.changes).map(([k, c]) => (
                        <div key={k} className="flex flex-wrap gap-1">
                          <dt className="text-muted-foreground">{fieldLabel(k)}:</dt>
                          <dd><span className="line-through decoration-muted-foreground/60">{show(k, c?.from)}</span> → <span className="font-medium">{show(k, c?.to)}</span></dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {r.note && <p className="mt-1 text-sm text-muted-foreground">“{r.note}”</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
