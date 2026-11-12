"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck2, Lock, LockOpen } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
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
import { FIN_NS } from "./i18n"

type Pending = { kind: "close" | "reopen"; month: string; label: string }

/**
 * RPT-1 / RPT-3 month-end close: status line ("Everything up to 31 August 2026 is closed." / "No months closed yet."),
 * the suggested month to close, "Close an older month instead" only when the server says one exists, and the
 * month list with close / reopen (reason required). Closed months lock everything dated in them (server 422).
 */
export function MonthClosePanel({ onChanged }: { onChanged?: () => void }) {
  const f = useFinanceFormat()
  const { t } = useTranslation(FIN_NS)
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
    try { setData(await financeApi.getClose()) } catch (e) { setError(financeError(e, t("finance:close.loadFailed"))) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (p: Pending) => { setPending(p); setText(""); setDlgErr(""); setBusy(false) }

  const submit = async () => {
    if (!pending) return
    if (pending.kind === "reopen" && !text.trim()) { setDlgErr(t("finance:close.reasonRequired")); return }
    setBusy(true); setDlgErr("")
    try {
      if (pending.kind === "close") await financeApi.closeMonth(pending.month, text.trim())
      else await financeApi.reopenMonth(pending.month, text.trim())
      toast.success(pending.kind === "close" ? t("finance:close.closedToast", { month: pending.label }) : t("finance:close.reopenedToast", { month: pending.label }))
      setPending(null)
      await load()
      onChanged?.()
    } catch (e) {
      setDlgErr(financeError(e, pending.kind === "close" ? t("finance:close.closeFailed") : t("finance:close.reopenFailed")))
    } finally {
      setBusy(false)
    }
  }

  if (error) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
  if (!data) return <Skeleton className="h-64" />

  const st = data.status
  const monthOf = (m: { month: string; label: string }) => f.bucket(m.month, m.label)
  const statusText = st.closedThrough ? t("finance:close.closedThrough", { date: f.longDate(st.closedThrough) }) : t("finance:close.noneClosed")
  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title={t("finance:close.title")}
        description={t("finance:close.description")}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("flex size-9 items-center justify-center rounded-full", st.closedThrough ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
            {st.closedThrough ? <Lock className="size-4" aria-hidden /> : <CalendarCheck2 className="size-4" aria-hidden />}
          </span>
          <p className="min-w-0 flex-1 font-medium">{statusText}</p>
          {writable && st.suggestion && (
            <Button type="button" onClick={() => open({ kind: "close", month: st.suggestion!.month, label: monthOf(st.suggestion!) })}>
              <Lock className="size-4" aria-hidden /> {t("finance:close.closeMonth", { month: monthOf(st.suggestion) })}
            </Button>
          )}
        </div>
        {writable && st.olderOpenMonth && (
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" onClick={() => open({ kind: "close", month: st.olderOpenMonth!.month, label: monthOf(st.olderOpenMonth!) })}>
            {t("finance:close.olderInstead")} ({monthOf(st.olderOpenMonth)})
          </Button>
        )}
        {!st.suggestion && <p className="mt-2 text-sm text-muted-foreground">{t("finance:close.allClosed")}</p>}
      </SectionCard>

      <SectionCard title={t("finance:close.months")} contentClassName="px-2">
        {data.months.length === 0 ? (
          <EmptyState icon={CalendarCheck2} title={t("finance:close.noMonthsTitle")} description={t("finance:close.noMonthsDesc")} />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("finance:col.month")}</TableHead><TableHead>{t("common:fields.status")}</TableHead><TableHead className="text-right">{t("finance:close.netAtClose")}</TableHead>
                  <TableHead className="text-right">{t("finance:close.netNow")}</TableHead><TableHead>{t("common:extra.details")}</TableHead><TableHead className="w-28"><span className="sr-only">{t("common:fields.actions")}</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((m: CloseMonth) => {
                  const closed = m.status === "closed"
                  return (
                    <TableRow key={m.month}>
                      <TableCell className="font-medium">{monthOf(m)}</TableCell>
                      <TableCell>
                        <Badge variant={closed ? "default" : "outline"}>{closed ? t("finance:close.closed") : m.canClose ? t("finance:close.open") : t("finance:close.inProgress")}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{m.netAtClose != null ? <SignedMoney value={m.netAtClose} format={f.money} /> : "—"}</TableCell>
                      <TableCell className="text-right">
                        {m.liveNet != null ? <SignedMoney value={m.liveNet} format={f.money} /> : "—"}
                        {m.drift != null && Math.abs(m.drift) >= 0.005 && (
                          <div className="text-xs text-amber-600">{t("finance:close.changedBy")} <SignedMoney value={m.drift} format={f.money} /> {t("finance:close.sinceClose")}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[260px] text-xs text-muted-foreground">
                        {closed && <div>{m.closedByName ? t("finance:close.closedAtBy", { at: f.dateTime(m.closedAt), name: m.closedByName }) : t("finance:close.closedAt", { at: f.dateTime(m.closedAt) })}</div>}
                        {m.note && <div className="truncate">{t("finance:close.noteText", { note: m.note })}</div>}
                        {m.reopenedAt && <div>{m.reopenedByName ? t("finance:close.reopenedAtBy", { at: f.dateTime(m.reopenedAt), name: m.reopenedByName }) : t("finance:close.reopenedAt", { at: f.dateTime(m.reopenedAt) })}{m.reopenReason ? ` — ${m.reopenReason}` : ""}</div>}
                        {!closed && !m.reopenedAt && !m.note && "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {writable && (closed ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => open({ kind: "reopen", month: m.month, label: monthOf(m) })}>
                            <LockOpen className="size-4" aria-hidden /> {t("finance:close.reopen")}
                          </Button>
                        ) : m.canClose ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => open({ kind: "close", month: m.month, label: monthOf(m) })}>
                            <Lock className="size-4" aria-hidden /> {t("finance:close.close")}
                          </Button>
                        ) : (
                          <WithTooltip content={t("finance:close.afterEnds")}>
                            <span tabIndex={0} className="inline-flex"><Button type="button" size="sm" variant="outline" disabled>{t("finance:close.close")}</Button></span>
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
            <DialogTitle>{pending?.kind === "reopen" ? t("finance:close.reopenQ", { month: pending?.label ?? "" }) : t("finance:close.closeQ", { month: pending?.label ?? "" })}</DialogTitle>
            <DialogDescription>
              {pending?.kind === "reopen" ? t("finance:close.reopenDesc") : t("finance:close.closeDesc")}
            </DialogDescription>
          </DialogHeader>
          <FormField label={pending?.kind === "reopen" ? t("common:extra.reason") : t("finance:form.noteOptional")} htmlFor="close-text" required={pending?.kind === "reopen"} error={dlgErr || undefined}>
            <Textarea id="close-text" rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={pending?.kind === "reopen" ? t("finance:close.reasonPh") : t("finance:close.notePh")} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={busy}>{t("common:actions.cancel")}</Button>
            <Button type="button" onClick={submit} disabled={busy}>
              {busy ? t("common:actions.saving") : pending?.kind === "reopen" ? t("finance:close.reopenMonth") : t("finance:close.closeMonthBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
