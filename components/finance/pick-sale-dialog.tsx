"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { type SellResponse } from "@/lib/sellsApi"
import financeApi, { type UnpaidSale } from "@/lib/financeApi"
import { RecordPaymentDialog } from "@/components/sales/record-payment-dialog"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useFinanceFormat } from "./finance-ui"
import { FIN_NS, methodText } from "./i18n"

/** Just the fields RecordPaymentDialog reads (id, invoiceNo, amount, paidAmount, status). */
function asSale(s: UnpaidSale): SellResponse {
  return {
    id: s.sellId, invoiceNo: s.invoiceNo, customerName: s.customerName ?? "", amount: s.total, paidAmount: s.paid, dueAmount: s.due,
    status: (s.status as SellResponse["status"]) ?? "Pending", paymentStatus: s.paid > 0 ? "partial" : "unpaid", method: s.method ?? "",
    orderTime: s.orderDate ?? "", createdAt: s.orderDate ?? "", updatedAt: s.orderDate ?? "",
  }
}

/**
 * "Record payment": pick an unpaid sale (GET /finance/payments/unpaid-sales), then the existing Sales
 * record-payment dialog (POST /payments/sells/{id}) takes over.
 */
export function PickSaleForPayment({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { formatCurrency } = useCompanySettings()
  const { t } = useTranslation(FIN_NS)
  const fmt = useFinanceFormat()
  const [q, setQ] = useState("")
  const [qD, setQD] = useState("")
  const [rows, setRows] = useState<UnpaidSale[]>([])
  const [loading, setLoading] = useState(false)
  const [sale, setSale] = useState<SellResponse | null>(null)

  useEffect(() => { const t = setTimeout(() => setQD(q.trim()), 250); return () => clearTimeout(t) }, [q])
  useEffect(() => { if (open) { setQ(""); setQD("") } }, [open])

  useEffect(() => {
    if (!open) return
    let live = true
    setLoading(true)
    financeApi.getUnpaidSales({ search: qD || undefined, limit: 30 })
      .then((r) => { if (live) setRows(r.filter((s) => s.due > 0)) })
      .catch(() => { if (live) setRows([]) })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [open, qD])

  return (
    <>
      <Dialog open={open && !sale} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("finance:actions.recordPayment")}</DialogTitle>
            <DialogDescription>{t("finance:pickSale.description")}</DialogDescription>
          </DialogHeader>
          <InputGroup>
            <InputGroupAddon><Search aria-hidden /></InputGroupAddon>
            <InputGroupInput autoFocus aria-label={t("finance:pickSale.search")} placeholder={t("finance:pickSale.searchPh")} value={q} onChange={(e) => setQ(e.target.value)} />
          </InputGroup>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            {loading && rows.length === 0 ? (
              <div className="flex flex-col gap-2 p-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : rows.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">{qD ? t("finance:pickSale.noMatch") : t("finance:pickSale.none")}</p>
            ) : rows.map((s) => (
              <Button
                key={s.sellId}
                type="button"
                variant="ghost"
                onClick={() => setSale(asSale(s))}
                className="h-auto w-full justify-between rounded-none border-b px-3 py-2.5 text-left last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{s.invoiceNo} · {s.customerName || t("finance:pickSale.walkIn")}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{fmt.date(s.orderDate)} · {t("finance:pickSale.total", { amount: formatCurrency(s.total) })}{s.paid > 0 ? ` · ${t("finance:pickSale.paid", { amount: formatCurrency(s.paid) })}` : ""}{s.method ? ` · ${methodText(t, s.method)}` : ""}</span>
                </span>
                <span className="font-semibold tabular-nums text-destructive">{t("finance:pickSale.due", { amount: formatCurrency(s.due) })}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <RecordPaymentDialog
        sales={sale ? [sale] : []}
        onClose={() => { setSale(null); onClose() }}
        onDone={onDone}
      />
    </>
  )
}
