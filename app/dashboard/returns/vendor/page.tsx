"use client"

import { useState, useEffect, useCallback } from "react"
import { vendorReturnsApi, VendorReturnResponse, VendorReturnStatus } from "@/lib/vendorReturnsApi"
import { productApi, ProductResponse, ProductVariantResponse } from "@/lib/productApi"
import { useVendor } from "@/contexts/vendor-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Search, Eye, Download, TruckIcon, Plus, Trash2, ChevronsUpDown } from "lucide-react"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

const fmt = (val: unknown) => Number(val ?? 0).toFixed(2)

function formatDate(dateString?: string) {
  if (!dateString) return "N/A"
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function VendorReturnStatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", label: "Pending" },
    shipped: { color: "bg-blue-100 text-blue-800 border-blue-200", label: "Shipped" },
    received_by_vendor: { color: "bg-purple-100 text-purple-800 border-purple-200", label: "Received" },
    completed: { color: "bg-green-100 text-green-800 border-green-200", label: "Completed" },
  }
  const cfg = config[status] || config.pending
  return (
    <Badge variant="outline" className={cfg.color}>
      {cfg.label}
    </Badge>
  )
}

const STATUS_ORDER: VendorReturnStatus[] = ["pending", "shipped", "received_by_vendor", "completed"]

const RETURN_REASONS = [
  "Defective/Damaged",
  "Expired products",
  "Overstocked items",
  "Wrong items received",
  "Quality issues",
  "Recall",
  "Other",
]

const ITEMS_PER_PAGE = 10

export default function VendorReturnsPage() {
  const { vendors } = useVendor()
  const { toast } = useToast()

  const [returns, setReturns] = useState<VendorReturnResponse[]>([])
  const [stats, setStats] = useState({ total: 0, pending: 0, shipped: 0, received_by_vendor: 0, completed: 0, total_credit_amount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [vendorFilter, setVendorFilter] = useState("all")

  const [selectedReturn, setSelectedReturn] = useState<VendorReturnResponse | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<number | null>(null)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [formData, setFormData] = useState({
    vendorId: "",
    returnDate: new Date().toISOString().split("T")[0],
    creditType: "credit_note",
    notes: "",
    items: [] as { productId: string; productName?: string; variantId?: number; quantity: number; unitPrice: string; reason: string }[],
  })

  // Vendor product state
  const [vendorProducts, setVendorProducts] = useState<ProductResponse[]>([])
  const [vendorProductsLoading, setVendorProductsLoading] = useState(false)
  const [productSearchOpen, setProductSearchOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [listRes, statsRes] = await Promise.all([
        vendorReturnsApi.getAll({
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: searchQuery || undefined,
          status: statusFilter !== "all" ? statusFilter : undefined,
          vendorId: vendorFilter !== "all" ? Number(vendorFilter) : undefined,
        }),
        vendorReturnsApi.getStats(),
      ])
      setReturns(listRes.data ?? [])
      setTotalItems(listRes.pagination?.total ?? listRes.total ?? listRes.data?.length ?? 0)
      if (statsRes.data) setStats({ ...statsRes.data, total_credit_amount: statsRes.data.totalCreditAmount ?? statsRes.data.total_credit_amount ?? 0 })
    } catch {
      setReturns([])
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, searchQuery, statusFilter, vendorFilter])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleViewDetails = async (ret: VendorReturnResponse) => {
    try {
      const res = await vendorReturnsApi.getById(ret.id)
      setSelectedReturn(res.data)
    } catch {
      setSelectedReturn(ret)
    }
    setIsDetailsOpen(true)
  }

  const handleStatusUpdate = async (ret: VendorReturnResponse, newStatus: VendorReturnStatus) => {
    setStatusUpdateLoading(ret.id)
    try {
      await vendorReturnsApi.updateStatus(ret.id, newStatus)
      toast({ title: "Status updated" })
      fetchData()
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" })
    } finally {
      setStatusUpdateLoading(null)
    }
  }

  const allowedNextStatuses = (current: VendorReturnStatus) => {
    const idx = STATUS_ORDER.indexOf(current)
    return STATUS_ORDER.slice(idx)
  }

  const handleDownloadReport = () => {
    const csvContent = [
      ["Return #", "Vendor", "Amount", "Status", "Date"],
      ...returns.map((ret) => [
        ret.returnNumber ?? ret.id,
        ret.vendorName ?? ret.vendorId,
        `$${fmt(ret.totalAmount)}`,
        ret.status,
        formatDate(ret.createdAt),
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `vendor-returns-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const handleVendorSelect = useCallback(async (vendorId: string) => {
    setFormData((prev) => ({ ...prev, vendorId, items: [] }))
    setVendorProducts([])
    if (!vendorId) return
    setVendorProductsLoading(true)
    try {
      const res = await productApi.getAll({ vendor_id: Number(vendorId), limit: 200 })
      setVendorProducts(res.data ?? [])
    } catch {
      toast({ title: "Failed to load vendor products", variant: "destructive" })
    } finally {
      setVendorProductsLoading(false)
    }
  }, [toast])

  const handleSelectProduct = (product: ProductResponse, variant?: ProductVariantResponse) => {
    const unitPrice = variant
      ? String(variant.sale_price || variant.price)
      : String(product.sale_price || product.price)
    const newItem = {
      productId: String(product.id),
      productName: variant ? `${product.name} — ${variant.name}` : product.name,
      variantId: variant?.id,
      quantity: 1,
      unitPrice,
      reason: "",
    }
    setFormData((prev) => ({ ...prev, items: [...prev.items, newItem] }))
    setProductSearchOpen(false)
    setProductSearch("")
  }

  const handleRemoveItem = (index: number) => {
    setFormData((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const handleItemChange = (index: number, field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    }))
  }

  const handleCreateReturn = async () => {
    if (!formData.vendorId) {
      toast({ title: "Please select a vendor", variant: "destructive" })
      return
    }
    if (formData.items.length === 0) {
      toast({ title: "Please add at least one item", variant: "destructive" })
      return
    }
    if (formData.items.some((item) => !item.productId || !item.quantity || !item.reason)) {
      toast({ title: "Please fill in all item details", variant: "destructive" })
      return
    }

    const selectedVendor = vendors.find((v) => v.id === formData.vendorId)
    const totalAmount = formData.items.reduce((sum, item) => {
      const price = item.unitPrice ? parseFloat(item.unitPrice) : 0
      return sum + (price * item.quantity)
    }, 0)

    setCreateLoading(true)
    try {
      await vendorReturnsApi.create({
        vendorId: Number(formData.vendorId),
        vendorName: selectedVendor?.name,
        creditType: formData.creditType,
        notes: formData.notes || undefined,
        returnDate: formData.returnDate ? `${formData.returnDate.split("T")[0]}T00:00:00Z` : undefined,
        totalAmount: totalAmount > 0 ? totalAmount : undefined,
        items: formData.items.map((item) => ({
          productId: Number(item.productId),
          productName: item.productName,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
          totalPrice: item.unitPrice ? Number(item.unitPrice) * item.quantity : undefined,
          reason: item.reason,
        })),
      })
      toast({ title: "Return created successfully" })
      setIsCreateDialogOpen(false)
      fetchData()
    } catch {
      toast({ title: "Failed to create return", variant: "destructive" })
    } finally {
      setCreateLoading(false)
    }
  }

  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Returns</h1>
          <p className="text-gray-600 mt-1">Manage returns to suppliers and vendors</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setFormData({ vendorId: "", returnDate: new Date().toISOString().split("T")[0], creditType: "credit_note", notes: "", items: [] })
              setVendorProducts([])
              setProductSearch("")
              setProductSearchOpen(false)
              setIsCreateDialogOpen(true)
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Return
          </Button>
          <Button onClick={handleDownloadReport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Total Returns", value: stats.total, color: "text-gray-900", icon: <TruckIcon className="w-8 h-8 text-gray-400" /> },
          { label: "Pending", value: stats.pending, color: "text-yellow-600" },
          { label: "Shipped", value: stats.shipped, color: "text-blue-600" },
          { label: "Total Credit", value: `$${fmt(stats.total_credit_amount)}`, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
              {s.icon}
            </div>
          </Card>
        ))}
      </div>

      {/* Filters + Table */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by return # or vendor"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              className="pl-10"
            />
          </div>
          <Select value={vendorFilter} onValueChange={(v) => { setVendorFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Vendors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vendors</SelectItem>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1) }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="shipped">Shipped</SelectItem>
              <SelectItem value="received_by_vendor">Received</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Return #</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Vendor</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Amount</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Status</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Date</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">No vendor returns found</td>
                </tr>
              ) : (
                returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium text-gray-900">{ret.returnNumber ?? `#${ret.id}`}</td>
                    <td className="py-3 px-4 text-sm text-gray-900">{ret.vendorName ?? ret.vendorId}</td>
                    <td className="py-3 px-4 text-right font-semibold text-gray-900">${fmt(ret.totalAmount)}</td>
                    <td className="py-3 px-4 text-center"><VendorReturnStatusBadge status={ret.status} /></td>
                    <td className="py-3 px-4 text-sm text-gray-600">{formatDate(ret.createdAt)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleViewDetails(ret)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {ret.status !== "completed" && (
                          <Select
                            value={ret.status}
                            onValueChange={(v) => handleStatusUpdate(ret, v as VendorReturnStatus)}
                            disabled={statusUpdateLoading === ret.id}
                          >
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {allowedNextStatuses(ret.status).map((s) => (
                                <SelectItem key={s} value={s}>
                                  {s === "pending" ? "Pending" : s === "shipped" ? "Shipped" : s === "received_by_vendor" ? "Received" : "Completed"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && totalItems > 0 && (
          <div className="mt-4">
            <PaginationControl
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              onItemsPerPageChange={() => {}}
              totalItems={totalItems}
            />
          </div>
        )}
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vendor Return Details — {selectedReturn?.returnNumber ?? `#${selectedReturn?.id}`}</DialogTitle>
            <DialogDescription>Complete information about this vendor return</DialogDescription>
          </DialogHeader>
          {selectedReturn && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm font-medium text-gray-700">Vendor</p><p className="text-sm text-gray-900">{selectedReturn.vendorName ?? selectedReturn.vendorId}</p></div>
                <div><p className="text-sm font-medium text-gray-700">Status</p><div className="mt-1"><VendorReturnStatusBadge status={selectedReturn.status} /></div></div>
                <div><p className="text-sm font-medium text-gray-700">Credit Type</p><p className="text-sm text-gray-900 capitalize">{(selectedReturn.creditType ?? "N/A").replace("_", " ")}</p></div>
                <div><p className="text-sm font-medium text-gray-700">Return Date</p><p className="text-sm text-gray-900">{formatDate(selectedReturn.returnDate ?? selectedReturn.createdAt)}</p></div>
                {selectedReturn.completedDate && (
                  <div><p className="text-sm font-medium text-gray-700">Completed Date</p><p className="text-sm text-gray-900">{formatDate(selectedReturn.completedDate)}</p></div>
                )}
                {selectedReturn.createdBy && (
                  <div><p className="text-sm font-medium text-gray-700">Created By</p><p className="text-sm text-gray-900">{selectedReturn.createdBy}</p></div>
                )}
              </div>

              {selectedReturn.items && selectedReturn.items.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Return Items</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Product</th>
                          <th className="text-center py-2 px-3 text-xs font-semibold text-gray-700">Qty</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Unit Price</th>
                          <th className="text-right py-2 px-3 text-xs font-semibold text-gray-700">Total</th>
                          <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700">Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedReturn.items.map((item, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 text-sm">
                              <p className="font-medium text-gray-900">{item.productName ?? `Product #${item.productId}`}</p>
                              {item.variantName && <p className="text-xs text-gray-500">{item.variantName}</p>}
                            </td>
                            <td className="py-2 px-3 text-center text-sm">{item.quantity}</td>
                            <td className="py-2 px-3 text-right text-sm">${fmt(item.unitPrice)}</td>
                            <td className="py-2 px-3 text-right text-sm font-medium">${fmt(item.totalPrice ?? Number(item.unitPrice ?? 0) * item.quantity)}</td>
                            <td className="py-2 px-3 text-sm text-gray-600">{item.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Credit Amount</p>
                  <p className="text-2xl font-bold text-gray-900">${fmt(selectedReturn.totalAmount)}</p>
                </div>
              </div>

              {selectedReturn.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Notes</p>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{selectedReturn.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open)
        if (!open) {
          setVendorProducts([])
          setProductSearch("")
          setProductSearchOpen(false)
        }
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Vendor Return</DialogTitle>
            <DialogDescription>Select a vendor to load their products, then add items to return</DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {/* Vendor + Date + Credit Type */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Vendor *</Label>
                <Select value={formData.vendorId} onValueChange={handleVendorSelect}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Return Date *</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={formData.returnDate}
                  onChange={(e) => setFormData({ ...formData, returnDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Credit Type *</Label>
                <Select value={formData.creditType} onValueChange={(v) => setFormData({ ...formData, creditType: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="refund">Refund</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                    <SelectItem value="replacement">Replacement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Product autocomplete (only after vendor selected) */}
            <div className="border rounded-lg p-4 bg-gray-50 space-y-2">
              <p className="text-sm font-medium text-gray-700">Add Product</p>
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={!formData.vendorId || vendorProductsLoading}
                    className="w-full justify-between bg-white font-normal"
                  >
                    {vendorProductsLoading
                      ? "Loading products..."
                      : !formData.vendorId
                      ? "Select a vendor first"
                      : `Search product... (${vendorProducts.length} available)`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[560px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search by product name or SKU..."
                      value={productSearch}
                      onValueChange={setProductSearch}
                    />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No products found.</CommandEmpty>
                      {vendorProducts
                        .filter((p) =>
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.sku ?? "").toLowerCase().includes(productSearch.toLowerCase())
                        )
                        .map((product) => (
                          <CommandGroup key={product.id} heading={product.name}>
                            {/* Base product (no variants) */}
                            {(!product.variants || product.variants.length === 0) && (
                              <CommandItem
                                value={`${product.id}-base-${product.name}`}
                                onSelect={() => handleSelectProduct(product)}
                              >
                                <div className="flex justify-between w-full">
                                  <div>
                                    <span className="font-medium">{product.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">SKU: {product.sku}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">${fmt(product.sale_price || product.price)}</span>
                                </div>
                              </CommandItem>
                            )}
                            {/* Variants */}
                            {product.variants?.map((v) => (
                              <CommandItem
                                key={v.id}
                                value={`${product.id}-${v.id}-${v.name}`}
                                onSelect={() => handleSelectProduct(product, v)}
                              >
                                <div className="flex justify-between w-full pl-3">
                                  <div>
                                    <span>{v.name}</span>
                                    <span className="text-xs text-gray-500 ml-2">SKU: {v.sku}</span>
                                  </div>
                                  <span className="text-sm font-medium text-gray-700">${fmt(v.sale_price || v.price)}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Return Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <Label>Return Items *</Label>
                {formData.items.length > 0 && (
                  <p className="text-xs text-gray-500">{formData.items.length} item{formData.items.length > 1 ? "s" : ""} added</p>
                )}
              </div>

              {formData.items.length === 0 ? (
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-sm text-gray-400">
                  Select a vendor and search for products to add return items
                </div>
              ) : (
                <div className="space-y-3">
                  {formData.items.map((item, index) => (
                    <Card key={index} className="p-3">
                      <div className="grid grid-cols-12 gap-3 items-start">
                        {/* Product info */}
                        <div className="col-span-4">
                          <Label className="text-xs">Product</Label>
                          <p className="text-sm font-medium text-gray-900 mt-1 leading-tight">{item.productName}</p>
                          <p className="text-xs text-gray-500">ID: {item.productId}</p>
                        </div>
                        {/* Unit Price */}
                        <div className="col-span-2">
                          <Label className="text-xs">Unit Price</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        {/* Qty */}
                        <div className="col-span-2">
                          <Label className="text-xs">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", parseInt(e.target.value) || 1)}
                            className="mt-1"
                          />
                        </div>
                        {/* Reason */}
                        <div className="col-span-3">
                          <Label className="text-xs">Reason *</Label>
                          <Select value={item.reason} onValueChange={(v) => handleItemChange(index, "reason", v)}>
                            <SelectTrigger className="mt-1"><SelectValue placeholder="Select reason" /></SelectTrigger>
                            <SelectContent>
                              {RETURN_REASONS.map((r) => (
                                <SelectItem key={r} value={r}>{r}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {/* Remove */}
                        <div className="col-span-1 flex justify-end pt-5">
                          <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700 px-2">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}

                  {/* Total */}
                  <div className="flex justify-end pt-1">
                    <p className="text-sm font-semibold text-gray-900">
                      Total: ${fmt(formData.items.reduce((sum, i) => sum + (Number(i.unitPrice) * i.quantity), 0))}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateReturn} disabled={createLoading} className="bg-emerald-600 hover:bg-emerald-700">
              {createLoading ? "Creating..." : "Create Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
