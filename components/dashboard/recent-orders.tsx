"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { CHANNEL_LABEL, isKnownChannel } from "./channels"
import { ageDays, ageLabel } from "./format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const PAYMENT_LABEL = {
  paid: "common:payment.paid",
  partially_paid: "dashboard:recent.partial",
  pending: "common:payment.unpaid",
} as const
const isKnownPayment = (s: string): s is keyof typeof PAYMENT_LABEL => Object.prototype.hasOwnProperty.call(PAYMENT_LABEL, s)

/** Order statuses the API sends; "Processing" reads as "Confirmed" in the admin. Unknown statuses show as-is. */
const STATUS_LABEL = {
  Pending: "common:orderStatus.pending",
  Processing: "common:orderStatus.confirmed",
  Confirmed: "common:orderStatus.confirmed",
  Packed: "dashboard:pipeline.packed",
  Shipped: "common:orderStatus.shipped",
  Delivered: "common:orderStatus.delivered",
  Completed: "common:orderStatus.completed",
  Cancelled: "common:orderStatus.cancelled",
  Returned: "common:orderStatus.returned",
  Refunded: "common:orderStatus.refunded",
} as const
const isKnownStatus = (s: string): s is keyof typeof STATUS_LABEL => Object.prototype.hasOwnProperty.call(STATUS_LABEL, s)

const COLUMNS = [
  { id: "invoice", label: "dashboard:recent.invoice" },
  { id: "customer", label: "common:fields.customer" },
  { id: "channel", label: "dashboard:recent.channel" },
  { id: "payment", label: "dashboard:recent.payment" },
  { id: "amount", label: "common:money.amount" },
  { id: "status", label: "common:fields.status" },
  { id: "age", label: "dashboard:recent.age" },
] as const

export function RecentOrders() {
  const { t } = useTranslation(["dashboard", "common"])
  const paymentLabel = (s: string) => (isKnownPayment(s) ? t(PAYMENT_LABEL[s]) : s.charAt(0).toUpperCase() + s.slice(1))
  const { formatCurrency } = useCompanySettings()
  const { data, loading, error, retry } = useDashboardSection("recent-orders", { limit: 6 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <div className="mt-3"><EmptyNote>{t("dashboard:recent.empty")}</EmptyNote></div>
    return (
      <div className="mt-3 overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              {COLUMNS.map((h) => (
                <TableHead key={h.id} scope="col" className={cn(h.id === "amount" && "text-right")}>{t(h.label)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((o) => {
              const days = ageDays(o.orderTime)
              const open = !["Delivered", "Completed", "Cancelled"].includes(o.status)
              const ageTone = !open || days < 1 ? "text-muted-foreground" : days >= 3 ? "text-destructive" : "text-dash-warn-fg"
              return (
                <TableRow key={o.id}>
                  <TableCell>#{o.invoiceNo}</TableCell>
                  <TableCell>{o.customerName}</TableCell>
                  <TableCell>{isKnownChannel(o.channel) ? t(CHANNEL_LABEL[o.channel]) : o.channel} · {o.method}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.paymentStatus} label={paymentLabel(o.paymentStatus)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(o.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} label={isKnownStatus(o.status) ? t(STATUS_LABEL[o.status]) : o.status} />
                  </TableCell>
                  <TableCell className={ageTone}>{ageLabel(o.orderTime, t)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <DashCard className="flex-[2_1_560px]">
      <CardTitle
        title={t("dashboard:recent.title")}
        action={
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/dashboard/orders">{t("common:actions.viewAll")} →</Link>
          </Button>
        }
      />
      {body()}
    </DashCard>
  )
}
