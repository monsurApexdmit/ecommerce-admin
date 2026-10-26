"use client"

import { cn } from "@/lib/utils"
import Link from "next/link"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { ageDays, ageLabel } from "./format"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/common/StatusBadge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CardTitle, DashCard, EmptyNote, SectionError, SectionSkeleton } from "./section"
import { useDashboardSection } from "./use-dashboard-section"

const CHANNEL: Record<string, string> = { pos: "In-store POS", storefront: "Online store", online: "Online store", cod: "Cash on delivery", manual: "Manual" }
const paymentLabel = (s: string) => (s === "paid" ? "Paid" : s === "partially_paid" ? "Partial" : s === "pending" ? "Unpaid" : s.charAt(0).toUpperCase() + s.slice(1))

export function RecentOrders() {
  const { formatCurrency } = useCompanySettings()
  const { data, loading, error, retry } = useDashboardSection("recent-orders", { limit: 6 })

  const body = () => {
    if (error && !data) return <SectionError message={error} onRetry={retry} />
    if (loading && !data) return <SectionSkeleton rows={6} />
    if (!data) return null
    if (data.items.length === 0) return <div className="mt-3"><EmptyNote>No orders yet.</EmptyNote></div>
    return (
      <div className="mt-3 overflow-x-auto">
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              {["Invoice", "Customer", "Channel", "Payment", "Amount", "Status", "Age"].map((h) => (
                <TableHead key={h} scope="col" className={cn(h === "Amount" && "text-right")}>{h}</TableHead>
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
                  <TableCell>{CHANNEL[o.channel] ?? o.channel} · {o.method}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.paymentStatus} label={paymentLabel(o.paymentStatus)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(o.amount)}</TableCell>
                  <TableCell>
                    <StatusBadge status={o.status} label={o.status === "Processing" ? "Confirmed" : o.status} />
                  </TableCell>
                  <TableCell className={ageTone}>{ageLabel(o.orderTime)}</TableCell>
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
        title="Recent orders"
        action={
          <Button asChild variant="link" size="sm" className="h-auto p-0">
            <Link href="/dashboard/orders">View all →</Link>
          </Button>
        }
      />
      {body()}
    </DashCard>
  )
}
