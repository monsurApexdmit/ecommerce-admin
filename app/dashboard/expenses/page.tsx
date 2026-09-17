"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Search, Plus, Edit2, Trash2, DollarSign, CalendarDays, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useExpense, type Expense } from "@/contexts/expense-context"
import { useExpenseCategory } from "@/contexts/expense-category-context"
import { useVendor } from "@/contexts/vendor-context"
import { useToast } from "@/hooks/use-toast"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatsCards } from "@/components/ui/stats-card"
import { useModuleGuard } from "@/hooks/use-module-guard"

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
]

const RECURRING_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
]

interface ExpenseFormData {
  expenseCategoryId: string
  vendorId: string
  title: string
  amount: string
  expenseDate: string
  paymentMethod: string
  referenceNo: string
  notes: string
  receipt: File | null
  isRecurring: boolean
  recurringFrequency: string
  recurringEndDate: string
}

const emptyFormData: ExpenseFormData = {
  expenseCategoryId: "",
  vendorId: "",
  title: "",
  amount: "",
  expenseDate: new Date().toISOString().slice(0, 10),
  paymentMethod: "cash",
  referenceNo: "",
  notes: "",
  receipt: null,
  isRecurring: false,
  recurringFrequency: "monthly",
  recurringEndDate: "",
}

export default function ExpensesPage() {
  const {
    expenses,
    isLoading: contextLoading,
    stats,
    statsLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useExpense()
  const { categories } = useExpenseCategory()
  const { vendors } = useVendor()
  const { toast } = useToast()

  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [paymentFilter, setPaymentFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState<ExpenseFormData>(emptyFormData)

  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch =
      expense.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.vendorName?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === "all" || expense.expenseCategoryId === categoryFilter
    const matchesPayment = paymentFilter === "all" || expense.paymentMethod === paymentFilter
    const matchesDateFrom = !dateFrom || expense.expenseDate >= dateFrom
    const matchesDateTo = !dateTo || expense.expenseDate <= dateTo

    return matchesSearch && matchesCategory && matchesPayment && matchesDateFrom && matchesDateTo
  })

  const {
    currentItems: currentExpenses,
    currentPage,
    totalPages,
    itemsPerPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredExpenses, 10)

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

  const blocked = useModuleGuard('Expenses')
  if (blocked) return blocked

  const openAddDialog = () => {
    setEditingExpense(null)
    setFormData(emptyFormData)
    setIsDialogOpen(true)
  }

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense)
    setFormData({
      expenseCategoryId: expense.expenseCategoryId,
      vendorId: expense.vendorId ?? "",
      title: expense.title,
      amount: expense.amount.toString(),
      expenseDate: expense.expenseDate?.slice(0, 10) ?? "",
      paymentMethod: expense.paymentMethod,
      referenceNo: expense.referenceNo ?? "",
      notes: expense.notes ?? "",
      receipt: null,
      isRecurring: expense.isRecurring,
      recurringFrequency: expense.recurringFrequency ?? "monthly",
      recurringEndDate: expense.recurringEndDate?.slice(0, 10) ?? "",
    })
    setIsDialogOpen(true)
  }

  const handleSaveExpense = async () => {
    if (!formData.title.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Expense title is required" })
      return
    }
    if (!formData.expenseCategoryId) {
      toast({ variant: "destructive", title: "Error", description: "Category is required" })
      return
    }
    if (!formData.amount || isNaN(parseFloat(formData.amount))) {
      toast({ variant: "destructive", title: "Error", description: "A valid amount is required" })
      return
    }

    const payload = {
      expenseCategoryId: formData.expenseCategoryId,
      vendorId: formData.vendorId || null,
      title: formData.title,
      amount: parseFloat(formData.amount),
      expenseDate: formData.expenseDate,
      paymentMethod: formData.paymentMethod as any,
      referenceNo: formData.referenceNo || undefined,
      notes: formData.notes || undefined,
      receipt: formData.receipt,
      isRecurring: formData.isRecurring,
      recurringFrequency: formData.isRecurring ? (formData.recurringFrequency as any) : null,
      recurringEndDate: formData.isRecurring ? (formData.recurringEndDate || null) : null,
    }

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload)
        toast({ title: "Success", description: "Expense updated successfully" })
      } else {
        await addExpense(payload)
        toast({ title: "Success", description: "Expense created successfully" })
      }
      setIsDialogOpen(false)
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || `Failed to ${editingExpense ? "update" : "create"} expense`,
      })
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      try {
        await deleteExpense(id)
        toast({ title: "Success", description: "Expense deleted successfully" })
      } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message || "Failed to delete expense" })
      }
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" className="gap-2 bg-emerald-500 hover:bg-emerald-600" onClick={openAddDialog}>
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="mb-6">
          <StatsCards
            stats={[
              { label: "This Month", value: formatCurrency(stats.totalThisMonth), icon: <CalendarDays className="w-5 h-5" />, color: "blue" },
              { label: "This Year", value: formatCurrency(stats.totalThisYear), icon: <DollarSign className="w-5 h-5" />, color: "green" },
              { label: "Total Count", value: stats.count, icon: <Hash className="w-5 h-5" />, color: "red" },
            ]}
          />
        </div>
      ) : null}

      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search expenses by title, category, or vendor"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  handleFilterChange()
                }}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value)
                handleFilterChange()
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={paymentFilter}
              onValueChange={(value) => {
                setPaymentFilter(value)
                handleFilterChange()
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All payment methods" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All payment methods</SelectItem>
                {PAYMENT_METHODS.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value}>
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                handleFilterChange()
              }}
              className="w-[160px]"
            />
            <span className="text-gray-400 text-sm">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                handleFilterChange()
              }}
              className="w-[160px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">TITLE</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">CATEGORY</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">VENDOR</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">AMOUNT</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">DATE</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">PAYMENT</th>
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
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-16" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-8 w-8 rounded" />
                          <Skeleton className="h-8 w-8 rounded" />
                        </div>
                      </td>
                    </tr>
                  ))
                : currentExpenses.map((expense) => (
                    <tr key={expense.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{expense.title}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.categoryName || "-"}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.vendorName || "-"}</td>
                      <td className="py-3 px-4 text-gray-900 font-medium">{formatCurrency(expense.amount)}</td>
                      <td className="py-3 px-4 text-gray-600">{expense.expenseDate?.slice(0, 10)}</td>
                      <td className="py-3 px-4 text-gray-600 capitalize">{expense.paymentMethod}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditDialog(expense)}
                            className="p-2 hover:bg-gray-100 rounded inline-block"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </button>
                          <button onClick={() => handleDelete(expense.id)} className="p-2 hover:bg-gray-100 rounded">
                            <Trash2 className="w-4 h-4 text-gray-600" />
                          </button>
                        </div>
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
            totalItems={filteredExpenses.length}
          />
        </div>
      </div>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter expense title"
              />
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={formData.expenseCategoryId}
                onValueChange={(value) => setFormData({ ...formData, expenseCategoryId: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {vendors.length > 0 && (
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={formData.vendorId || "none"}
                  onValueChange={(value) => setFormData({ ...formData, vendorId: value === "none" ? "" : value })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Label htmlFor="expenseDate">Expense Date *</Label>
              <Input
                id="expenseDate"
                type="date"
                value={formData.expenseDate}
                onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
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

            <div className="col-span-2 space-y-2">
              <Label htmlFor="receipt">Receipt</Label>
              <Input
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFormData({ ...formData, receipt: e.target.files?.[0] ?? null })}
              />
            </div>

            <div className="col-span-2 flex items-center gap-3">
              <Switch
                id="isRecurring"
                checked={formData.isRecurring}
                onCheckedChange={(checked) => setFormData({ ...formData, isRecurring: checked })}
              />
              <Label htmlFor="isRecurring">Recurring expense</Label>
            </div>

            {formData.isRecurring && (
              <>
                <div className="space-y-2">
                  <Label>Recurring Frequency</Label>
                  <Select
                    value={formData.recurringFrequency}
                    onValueChange={(value) => setFormData({ ...formData, recurringFrequency: value })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRING_FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recurringEndDate">Recurring End Date</Label>
                  <Input
                    id="recurringEndDate"
                    type="date"
                    value={formData.recurringEndDate}
                    onChange={(e) => setFormData({ ...formData, recurringEndDate: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveExpense} className="bg-emerald-600 hover:bg-emerald-700">
              {editingExpense ? "Update Expense" : "Add Expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
