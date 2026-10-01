"use client"

import { useState, useEffect } from "react"
import { Search, DollarSign, AlertTriangle, Users, CreditCard, Download } from "lucide-react"
import { exportToCSV } from "@/lib/export-import-utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDue, type VendorDue } from "@/contexts/due-context"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatsCards } from "@/components/ui/stats-card"
import { useModuleGuard } from "@/hooks/use-module-guard"

const AGING_FILTERS = [
  { value: "all", label: "All" },
  { value: "current", label: "Current" },
  { value: "30", label: "30+ days" },
  { value: "60", label: "60+ days" },
  { value: "90+", label: "90+ days" },
]

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

function agingBadge(bucket: string) {
  switch (bucket) {
    case "current":
      return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Current</Badge>
    case "30":
      return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">30-60 days</Badge>
    case "60":
      return <Badge className="bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100">60-90 days</Badge>
    case "90+":
      return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">90+ days</Badge>
    default:
      return <Badge variant="outline">{bucket}</Badge>
  }
}

interface PaymentFormData {
  poId: string
  amount: string
  paymentMethod: string
  paymentDate: string
  referenceNo: string
  notes: string
}

const emptyPaymentForm: PaymentFormData = {
  poId: "",
  amount: "",
  paymentMethod: "cash",
  paymentDate: new Date().toISOString().slice(0, 10),
  referenceNo: "",
  notes: "",
}

export default function VendorDuesPage() {
  const {
    vendorDues,
    isLoadingVendorDues: contextLoading,
    recordVendorPayment,
    fetchVendorDues,
  } = useDue()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [agingFilter, setAgingFilter] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<VendorDue | null>(null)
  const [formData, setFormData] = useState<PaymentFormData>(emptyPaymentForm)
  const [isSaving, setIsSaving] = useState(false)

  const filteredDues = vendorDues.filter((due) => {
    const matchesSearch =
      due.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      due.poNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesAging = agingFilter === "all" || due.agingBucket === agingFilter
    return matchesSearch && matchesAging
  })

  const {
    currentItems: currentDues,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredDues, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  useEffect(() => {
    if (!contextLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [contextLoading])

  const blocked = useModuleGuard('Dues')
  if (blocked) return blocked

  const totalPayable = vendorDues.reduce((sum, d) => sum + d.dueAmount, 0)
  const overdue30Plus = vendorDues
    .filter((d) => d.agingBucket !== "current")
    .reduce((sum, d) => sum + d.dueAmount, 0)
  const vendorsWithDues = vendorDues.length

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)

  const handleExportCSV = () => {
    const rows = filteredDues.map((due) => ({
      vendor: due.vendorName,
      po_number: due.poNumber,
      total: formatCurrency(due.totalAmount),
      due: formatCurrency(due.dueAmount),
      aging: due.agingBucket,
    }))
    exportToCSV(rows, "vendor_dues", ["Vendor", "PO Number", "Total", "Due", "Aging"])
  }

  const openPaymentDialog = (due: VendorDue) => {
    setSelectedVendor(due)
    setFormData({
      ...emptyPaymentForm,
      amount: due.dueAmount.toString(),
    })
    setIsDialogOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!selectedVendor) return

    if (!formData.poId || isNaN(parseInt(formData.poId))) {
      toast({ variant: "destructive", title: "Error", description: "A valid Purchase Order ID is required" })
      return
    }
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      toast({ variant: "destructive", title: "Error", description: "A valid payment amount is required" })
      return
    }

    setIsSaving(true)
    try {
      await recordVendorPayment(parseInt(formData.poId), {
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        paymentDate: formData.paymentDate,
        referenceNo: formData.referenceNo || undefined,
        notes: formData.notes || undefined,
      })
      toast({ title: "Success", description: "Payment recorded successfully" })
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to record payment",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Dues</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <StatsCards
            stats={[
              {
                label: "Total Payable",
                value: formatCurrency(totalPayable),
                icon: <DollarSign className="w-5 h-5" />,
                color: "blue",
              },
              {
                label: "Overdue 30+ Days",
                value: formatCurrency(overdue30Plus),
                icon: <AlertTriangle className="w-5 h-5" />,
                color: "red",
              },
              {
                label: "Vendors With Dues",
                value: vendorsWithDues,
                icon: <Users className="w-5 h-5" />,
                color: "purple",
              },
            ]}
          />
        </div>
      )}

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by vendor name or PO number"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  handleFilterChange()
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={agingFilter}
              onValueChange={(value) => {
                setAgingFilter(value)
                handleFilterChange()
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All aging buckets" />
              </SelectTrigger>
              <SelectContent>
                {AGING_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="gap-2" onClick={handleExportCSV}>
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">VENDOR</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">PO NUMBER</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">TOTAL</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">DUE</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">AGING</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">ACTION</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-8 w-28 rounded" /></td>
                    </tr>
                  ))
                : currentDues.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">
                      No vendors with outstanding dues
                    </td>
                  </tr>
                ) : currentDues.map((due) => (
                    <tr key={`${due.vendorId}-${due.poNumber}`} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{due.vendorName}</td>
                      <td className="py-3 px-4 text-gray-600">{due.poNumber}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{formatCurrency(due.totalAmount)}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{formatCurrency(due.dueAmount)}</td>
                      <td className="py-3 px-4">{agingBadge(due.agingBucket)}</td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          className="gap-2 bg-emerald-500 hover:bg-emerald-600"
                          onClick={() => openPaymentDialog(due)}
                        >
                          <CreditCard className="w-4 h-4" />
                          Record Payment
                        </Button>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <div className="mx-4 pb-4">
          <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={filteredDues.length}
          />
        </div>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment {selectedVendor ? `— ${selectedVendor.vendorName}` : ""}</DialogTitle>
          </DialogHeader>

          {/*
            NOTE (per-PO vs. vendor-aggregate tension):
            The backend payment endpoint (POST /payments/purchase-orders/{poId}) records a
            payment against ONE specific purchase order. This page, however, shows dues
            aggregated per vendor/PO row from /dues/vendors, which may not map 1:1 to a
            single open PO per vendor. As a functional stand-in, we surface a "Purchase
            Order ID" input (pre-filled from the row's PO when unambiguous) so the payment
            can still be recorded against a specific PO today. The amount defaults to the
            row's due amount as a convenience starting point, but is editable. TODO: replace
            this with a PO picker once a vendor-level PO due list endpoint exists.
          */}
          <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
            This page shows dues aggregated per vendor/PO, but payments are recorded against a
            specific purchase order. Confirm or enter the Purchase Order ID to apply this payment to.
          </div>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="poId">Purchase Order ID *</Label>
              <Input
                id="poId"
                type="number"
                value={formData.poId}
                onChange={(e) => setFormData({ ...formData, poId: e.target.value })}
                placeholder="Enter the purchase order ID to apply payment to"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Method *</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm.value} value={pm.value}>
                      {pm.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="referenceNo">Reference No.</Label>
              <Input
                id="referenceNo"
                value={formData.referenceNo}
                onChange={(e) => setFormData({ ...formData, referenceNo: e.target.value })}
                placeholder="Optional reference number"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} className="bg-emerald-600 hover:bg-emerald-700" disabled={isSaving}>
              {isSaving ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
