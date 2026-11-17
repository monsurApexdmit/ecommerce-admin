"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import financeApi, { financeError, type MethodFee } from "@/lib/financeApi"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FIN_NS, methodText } from "./i18n"

type Row = MethodFee & { pctText: string; fixedText: string }

/**
 * TXN-1: payment-method fee settings (percent + fixed per method). Fees are estimates worked out when figures are
 * read (nothing is stored on payments): fee = amount × percent / 100 + fixed, on sale, COD and tailor money in.
 */
export function PaymentFeesDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(FIN_NS)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setErr(""); setBusy(false); setLoading(true)
    financeApi.getFees()
      .then((r) => setRows(r.fees.map((f) => ({ ...f, pctText: f.percent ? String(f.percent) : "", fixedText: f.fixed ? String(f.fixed) : "" }))))
      .catch((e) => setErr(financeError(e, t("finance:fees.loadFailed"))))
      .finally(() => setLoading(false))
  }, [open])

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.methodKey === key ? { ...r, ...patch } : r)))

  const save = async () => {
    const out: { methodKey: string; percent: number; fixed: number }[] = []
    for (const r of rows) {
      const pct = r.pctText.trim() === "" ? 0 : Number(r.pctText)
      const fixed = r.fixedText.trim() === "" ? 0 : Number(r.fixedText)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setErr(t("finance:fees.pctRange", { method: methodText(t, r.methodKey, r.label) })); return }
      if (!Number.isFinite(fixed) || fixed < 0) { setErr(t("finance:fees.fixedNegative", { method: methodText(t, r.methodKey, r.label) })); return }
      out.push({ methodKey: r.methodKey, percent: pct, fixed })
    }
    setBusy(true); setErr("")
    try {
      await financeApi.saveFees(out)
      toast.success(t("finance:fees.saved"))
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, t("finance:fees.saveFailed")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("finance:fees.title")}</DialogTitle>
          <DialogDescription>{t("finance:fees.description")}</DialogDescription>
        </DialogHeader>
        {loading ? <Skeleton className="h-48" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("finance:fees.empty")}</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>{t("finance:col.method")}</TableHead><TableHead className="w-32">{t("finance:fees.percent")}</TableHead><TableHead className="w-32">{t("finance:fees.fixed")}</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.methodKey}>
                    <TableCell className="font-medium">{methodText(t, r.methodKey, r.label)}</TableCell>
                    <TableCell>
                      <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" placeholder="0" className="tabular-nums" aria-label={t("finance:fees.pctAria", { method: methodText(t, r.methodKey, r.label) })}
                        value={r.pctText} onChange={(e) => set(r.methodKey, { pctText: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" className="tabular-nums" aria-label={t("finance:fees.fixedAria", { method: methodText(t, r.methodKey, r.label) })}
                        value={r.fixedText} onChange={(e) => set(r.methodKey, { fixedText: e.target.value })} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {err && <p className="text-sm font-medium text-destructive" role="alert">{err}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>{t("common:actions.cancel")}</Button>
          <Button type="button" onClick={save} disabled={busy || loading || rows.length === 0}>{busy ? t("common:actions.saving") : t("finance:fees.save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
