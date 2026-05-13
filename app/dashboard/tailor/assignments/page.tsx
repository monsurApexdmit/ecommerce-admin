"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  tailorApi, TailorAssignment, TailorWorkStatus,
  WORK_STATUS_LABELS,
} from "@/lib/tailorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { toast } from "sonner"

const WORK_STATUS_COLORS: Record<TailorWorkStatus, string> = {
  assigned:    "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed:   "bg-green-100 text-green-700",
  returned:    "bg-red-100 text-red-700",
}

const WORK_STATUSES: TailorWorkStatus[] = ["assigned", "in_progress", "completed", "returned"]

function isOverdue(expected?: string, workStatus?: TailorWorkStatus) {
  if (!expected) return false
  if (workStatus === "completed") return false
  return new Date(expected) < new Date()
}

export default function TailorAssignmentsPage() {
  const { canRead, canWrite } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()

  const [assignments, setAssignments] = useState<TailorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("all")
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  if (!canRead("TailorOrders")) return <AccessDenied />

  const load = () => {
    setLoading(true)
    tailorApi.getAssignments({ limit: 100 })
      .then(r => setAssignments(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load assignments"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleStatusChange = async (id: number, work_status: TailorWorkStatus) => {
    setUpdatingId(id)
    try {
      await tailorApi.updateAssignment(id, { workStatus: work_status })
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, workStatus: work_status } : a))
      toast.success("Status updated")
    } catch {
      toast.error("Failed to update status")
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = statusFilter === "all"
    ? assignments
    : assignments.filter(a => a.workStatus === statusFilter)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Assignments</h1>
          <p className="text-sm text-gray-500">{assignments.length} total</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {WORK_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{WORK_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Order #</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Dorji</th>
                <th className="px-4 py-3">Assigned Date</th>
                <th className="px-4 py-3">Expected Completion</th>
                <th className="px-4 py-3">Dorji Charge</th>
                <th className="px-4 py-3">Work Status</th>
                {canWrite("TailorOrders") && <th className="px-4 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={canWrite("TailorOrders") ? 8 : 7} className="px-4 py-3">
                      <Skeleton className="h-8" />
                    </td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={canWrite("TailorOrders") ? 8 : 7} className="px-4 py-16 text-center">
                    <ClipboardList className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                    <p className="text-gray-400">No assignments found</p>
                  </td>
                </tr>
              ) : filtered.map(a => {
                const overdue = isOverdue(a.expectedCompletion, a.workStatus)
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/dashboard/tailor/orders/${a.orderId}`}
                        className="text-purple-600 hover:underline"
                      >
                        {a.order?.orderNumber ?? `#${a.orderId}`}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.order?.customer?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {a.dorji?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {a.assignedDate ? new Date(a.assignedDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {a.expectedCompletion ? (
                        <span className={overdue ? "text-red-600 font-semibold" : "text-gray-500"}>
                          {new Date(a.expectedCompletion).toLocaleDateString()}
                          {overdue && " (Overdue)"}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {formatCurrency(a.dorjiCharge)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={WORK_STATUS_COLORS[a.workStatus]}>
                        {WORK_STATUS_LABELS[a.workStatus]}
                      </Badge>
                    </td>
                    {canWrite("TailorOrders") && (
                      <td className="px-4 py-3">
                        <Select
                          value={a.workStatus}
                          onValueChange={v => handleStatusChange(a.id, v as TailorWorkStatus)}
                          disabled={updatingId === a.id}
                        >
                          <SelectTrigger className="h-7 text-xs w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {WORK_STATUSES.map(s => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {WORK_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
