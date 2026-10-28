"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck2, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import financeApi, { financeError, type CloseMonth, type CloseState } from "@/lib/financeApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { EmptyState } from "@/components/common/EmptyState"
import { WithTooltip } from "@/components/common/WithTooltip"
import { SignedMoney, useFinanceFormat } from "./finance-ui"

type Pending = { kind: "close" | "reopen"; month: string; label: string }

/**
 * RPT-1 / RPT-3 month-end close: status line ("Everything up to 31 August 2026 is closed." / "No months closed yet."),
 * the suggested month to close, "Close an older month instead" only when the server says one exists, and the
 * month list with close / reopen (reason required). Closed months lock everything dated in them (server 422).
 */
export function MonthClosePanel({ onChanged }: { onChanged?: () => void }) {
  const f = useFinanceFormat()
  const { canWrite } = useSaasAuth()
  const writable = canWrite("Finance")
  const [data, setData] = useState<CloseState | null>(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState<Pending | null>(null)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [dlgErr, setDlgErr] = useState("")

  const load = useCallback(async () => {
    setError("")
    try { setData(await financeApi.getClose()) } catch (e) { setError(financeError(e, "Could not load month-end close.")) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (p: Pending) => { setPending(p); setText(""); setDlgErr(""); setBusy(false) }

  const submit = async () => {
    if (!pending) return
    if (pending.kind === "reopen" && !text.trim()) { setDlgErr("Give a reason for reopening."); return }
    setBusy(true); setDlgErr("")
    try {
      const res = pending.kind === "close" ? await financeApi.closeMonth(pending.month, text.trim()) : await financeApi.reopenMonth(pending.month, text.trim())
      toast.success(res.message)
      setPending(null)
      await load()
      onChanged?.()
    } catch (e) {
      setDlgErr(financeError(e, pending.kind === "close" ? "Could not close the month." : "Could not reopen the month."))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!data) return <Skeleton className="h-64" />

  const st = data.status
  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Month-end close"
        description="Closing a month locks everything dated in it — expenses, entries, transfers and payments — so the figures you filed stop moving. Later corrections post into an open month."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-full", st.closedThrough ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {st.closedThrough ? <Lock className="size-4" aria-hidden /> : <CalendarCheck2 className="size-4" aria-hidden />}
          </span>
          <p className="min-w-0 flex-1 font-medium">{st.text}</p>
          {writable && st.suggestion && (
            <Button type="button" onClick={() => open({ kind: "close", month: st.suggestion!.month, label: st.suggestion!.label })}>
              <Lock className="size-4" aria-hidden /> {st.suggestion.text}
            </Button>
          )}
        </div>
        {writable && st.olderOpenMonth && (
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => open({ kind: "close", month: st.olderOpenMonth!.month, label: st.olderOpenMonth!.label })}>
            {st.olderOpenMonth.text || "Close an older month instead"} ({st.olderOpenMonth.label})
          </Button>
        )}
        {!st.suggestion && <p className="mt-2 text-sm text-muted-foreground">Every month that has ended is closed.</p>}
      </SectionCard>

      <SectionCard title="Months" contentClassName="px-2">
        {data.months.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title="No months yet" description="Months appear once there is activity." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Net at close</TableHead>
                  <TableHead className="text-right">Net now</TableHead><TableHead>Details</TableHead><TableHead className="w-28"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((m: CloseMonth) => {
                  const closed = m.status === "closed"
                  return (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{m.label}</TableCell>
                      <TableCell>
                        <Badge variant={closed ? "default" : "outline"}>{closed ? "Closed" : m.canClose ? "Open" : "In progress"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.netAtClose != null ? <SignedMoney value={m.netAtClose} format={f.money} /> : "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.liveNet != null ? <SignedMoney value={m.liveNet} format={f.money} /> : "—"}
                        {m.drift != null && Math.abs(m.drift) >= 0.005 && (
                          <div className="text-xs text-amber-600">Changed by <SignedMoney value={m.drift} format={f.money} /> since close</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                        {closed && <div>Closed {f.dateTime(m.closedAt)}{m.closedByName ? ` by ${m.closedByName}` : ""}</div>}
                        {m.note && <div className="truncate">Note: {m.note}</div>}
                        {m.reopenedAt && <div>Reopened {f.dateTime(m.reopenedAt)}{m.reopenedByName ? ` by ${m.reopenedByName}` : ""}{m.reopenReason ? ` — ${m.reopenReason}` : ""}</div>}
                        {!closed && !m.reopenedAt && !m.note && "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {writable && (closed ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => open({ kind: "reopen", month: m.month, label: m.label })}>
                            <LockOpen className="size-4" aria-hidden /> Reopen
                          </Button>
                        ) : m.canClose ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => open({ kind: "close", month: m.month, label: m.label })}>
                            <Lock className="size-4" aria-hidden /> Close
                          </Button>
                        ) : (
                          <WithTooltip content="You can only close a month after it ends.">
                            <span tabIndex={0} className="inline-flex"><Button type="button" size="sm" variant="outline" disabled>Close</Button></span>
                          </WithTooltip>
                        ))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pending?.kind === "reopen" ? `Reopen ${pending?.label}?` : `Close ${pending?.label}?`}</DialogTitle>
            <DialogDescription>
              {pending?.kind === "reopen"
                ? "Reopening lets people change anything dated in this month again. The net at close stays on record."
                : "Nothing dated in this month can be added, edited or deleted while it is closed. Voids and corrections post into an open month. You can reopen it later with a reason."}
            </DialogDescription>
          </DialogHeader>
          <FormField label={pending?.kind === "reopen" ? "Reason" : "Note (optional)"} htmlFor="close-text" required={pending?.kind === "reopen"} error={dlgErr || undefined}>
            <Textarea id="close-text" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={pending?.kind === "reopen" ? "e.g. Late supplier bill" : "e.g. Checked by accountant"} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? "Saving…" : pending?.kind === "reopen" ? "Reopen month" : "Close month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
