"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import financeApi, { financeError, type MethodFee } from "@/lib/financeApi"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Row = MethodFee & { pctText: string; fixedText: string }

/**
 * TXN-1: payment-method fee settings (percent + fixed per method). Fees are estimates worked out when figures are
 * read (nothing is stored on payments): fee = amount × percent / 100 + fixed, on sale, COD and tailor money in.
 */
export function PaymentFeesDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")

  useEffect(() => {
    if (!open) return
    setErr(""); setBusy(false); setLoading(true)
    financeApi.getFees()
      .then((r) => setRows(r.fees.map((f) => ({ ...f, pctText: f.percent ? String(f.percent) : "", fixedText: f.fixed ? String(f.fixed) : "" }))))
      .catch((e) => setErr(financeError(e, "Could not load the payment fees.")))
      .finally(() => setLoading(false))
  }, [open])

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.methodKey === key ? { ...r, ...patch } : r)))

  const save = async () => {
    const out: { methodKey: string; percent: number; fixed: number }[] = []
    for (const r of rows) {
      const pct = r.pctText.trim() === "" ? 0 : Number(r.pctText)
      const fixed = r.fixedText.trim() === "" ? 0 : Number(r.fixedText)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setErr(`${r.label}: fee percent must be between 0 and 100.`); return }
      if (!Number.isFinite(fixed) || fixed < 0) { setErr(`${r.label}: fixed fee cannot be negative.`); return }
      out.push({ methodKey: r.methodKey, percent: pct, fixed })
    }
    setBusy(true); setErr("")
    try {
      await financeApi.saveFees(out)
      toast.success("Payment fees saved")
      onSaved(); onClose()
    } catch (e) {
      setErr(financeError(e, "Could not save the payment fees."))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment fees</DialogTitle>
          <DialogDescription>
            Estimated fees per payment method, taken off money received from sales, COD and tailor payments.
            Fee = amount × percent + fixed; net = gross − fee. Account balances stay gross.
          </DialogDescription>
        </DialogHeader>
        {loading ? <Skeleton className="h-48" /> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payment methods yet.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Method</TableHead><TableHead className="w-32">Percent</TableHead><TableHead className="w-32">Fixed</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.methodKey}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell>
                      <Input type="number" inputMode="decimal" min={0} max={100} step="0.01" placeholder="0" className="tabular-nums" aria-label={`${r.label} fee percent`}
                        value={r.pctText} onChange={(e) => set(r.methodKey, { pctText: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" inputMode="decimal" min={0} step="0.01" placeholder="0" className="tabular-nums" aria-label={`${r.label} fixed fee`}
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
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={save} disabled={busy || loading || rows.length === 0}>{busy ? "Saving…" : "Save fees"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
