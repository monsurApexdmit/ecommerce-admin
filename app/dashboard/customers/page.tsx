"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Search,
  Eye,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ShoppingBag,
  Download,
  Upload,
  FilePen,
  Trash2,
  Plus,
  MoreHorizontal,
  Edit2
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { useCustomer, type Customer } from "@/contexts/customer-context"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"

export default function CustomersPage() {
  const router = useRouter()
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomer()
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  
  // Filtering & Sorting State
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [sortOption, setSortOption] = useState<string>("default")
  
  // Bulk Actions State
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([])
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    customerType: "retail" as "retail" | "wholesale",
    status: "active" as "active" | "inactive",
    notes: ""
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Filter Logic
  const filteredCustomers = customers
    .filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone.includes(searchQuery)
      
      const matchesStatus = statusFilter === "all" || customer.status === statusFilter
      const matchesType = typeFilter === "all" || customer.customerType === typeFilter

      return matchesSearch && matchesStatus && matchesType
    })
    .sort((a, b) => {
      if (sortOption === "name-asc") return a.name.localeCompare(b.name)
      if (sortOption === "name-desc") return b.name.localeCompare(a.name)
      if (sortOption === "spent-high") return (b.totalSpent || 0) - (a.totalSpent || 0)
      if (sortOption === "spent-low") return (a.totalSpent || 0) - (b.totalSpent || 0)
      if (sortOption === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortOption === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return 0
    })

  const {
    currentItems: currentCustomers,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(filteredCustomers, 10)

  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Bulk Selection 
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds(currentCustomers.map((c) => c.id))
    } else {
      setSelectedCustomerIds([])
    }
  }

  const handleSelectCustomer = (customerId: string, checked: boolean) => {
    if (checked) {
      setSelectedCustomerIds([...selectedCustomerIds, customerId])
    } else {
      setSelectedCustomerIds(selectedCustomerIds.filter((id) => id !== customerId))
    }
  }

  // CRUD Handlers
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      zipCode: "",
      country: "",
      customerType: "retail",
      status: "active",
      notes: ""
    })
    setEditingCustomer(null)
  }

  const handleAddEditOpen = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer)
      setFormData({
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || "",
        city: customer.city || "",
        state: customer.state || "",
        zipCode: customer.zipCode || "",
        country: customer.country || "",
        customerType: customer.customerType,
        status: customer.status,
        notes: customer.notes || ""
      })
    } else {
      resetForm()
    }
    setIsAddDialogOpen(true)
  }

  const handleSaveCustomer = () => {
    if (!formData.name || !formData.email) return // Basic validation

    if (editingCustomer) {
      updateCustomer(editingCustomer.id, formData)
    } else {
      addCustomer(formData)
    }
    setIsAddDialogOpen(false)
    resetForm()
  }

  const handleDelete = (id: string) => {
    deleteCustomer(id)
    setSelectedCustomerIds(selectedCustomerIds.filter(sid => sid !== id))
  }

  // Bulk Actions
  const handleBulkDelete = () => {
    selectedCustomerIds.forEach(id => deleteCustomer(id))
    setSelectedCustomerIds([])
  }

  const handleBulkAction = () => {
    if (!bulkAction || selectedCustomerIds.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "active") {
      selectedCustomerIds.forEach(id => updateCustomer(id, { status: "active" }))
    } else if (bulkAction === "inactive") {
      selectedCustomerIds.forEach(id => updateCustomer(id, { status: "inactive" }))
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
  }

  // Import/Export
  const handleExport = () => {
     const exportData = filteredCustomers.map((c) => ({
      ...c,
      full_address: `${c.address || ''}, ${c.city || ''}, ${c.state || ''} ${c.zipCode || ''}, ${c.country || ''}`
    }))
    
    const headers = ["ID", "Name", "Email", "Phone", "Type", "Status", "Total Spent", "Total Orders", "Joined Date"]
    // Simplified export for demo
    const simplifiedData = exportData.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      type: c.customerType,
      status: c.status,
      total_spent: c.totalSpent || 0,
      total_orders: c.totalOrders || 0,
      joined: new Date(c.createdAt).toLocaleDateString()
    }))

    exportToCSV(simplifiedData, "customers", headers)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
  
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const importedData = parseCSV(text)
        
        // Basic mapping - in a real app would need more validation
        importedData.forEach(item => {
           if (item.name && item.email) {
             addCustomer({
                name: item.name,
                email: item.email,
                phone: item.phone || "",
                customerType: (item.type?.toLowerCase() === "wholesale" ? "wholesale" : "retail"),
                status: "active",
                address: item.address,
                city: item.city,
                state: item.state,
                zipCode: item.zip_code,
                country: item.country
             })
           }
        })
        setIsImportDialogOpen(false)
      }
      reader.readAsText(file)
    }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">Manage your customer base and view their activity</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button 
                variant="outline" 
                size="sm" 
                className="text-orange-600 border-orange-200 bg-orange-50"
                onClick={() => setIsBulkActionDialogOpen(true)}
                disabled={selectedCustomerIds.length === 0}
            >
              <FilePen className="w-4 h-4 mr-2" />
              Bulk Action
            </Button>
            <Button onClick={() => handleAddEditOpen()} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex flex-col xl:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search customers by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
             <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); handleFilterChange() }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
             </Select>

             <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); handleFilterChange() }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="wholesale">Wholesale</SelectItem>
                </SelectContent>
             </Select>

             <Select value={sortOption} onValueChange={(val) => { setSortOption(val); handleFilterChange() }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                  <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                  <SelectItem value="spent-high">Total Spent (High)</SelectItem>
                  <SelectItem value="spent-low">Total Spent (Low)</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                </SelectContent>
             </Select>
             
             <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                  setTypeFilter("all")
                  setSortOption("default")
                  handleFilterChange()
                }}
              >
                Reset
              </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4">
                  <Checkbox 
                     checked={currentCustomers.length > 0 && selectedCustomerIds.length === currentCustomers.length}
                     onCheckedChange={handleSelectAll}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Orders</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Spent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 px-4"><Skeleton className="h-4 w-4" /></td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full" />
                          <div className="space-y-1">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-3 w-16" />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4"><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-24" /></div></td>
                      <td className="py-3 px-4"><Skeleton className="h-5 w-16" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-8" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-4 w-12" /></td>
                      <td className="py-3 px-4"><Skeleton className="h-6 w-16" /></td>
                      <td className="py-3 px-4 text-right"><Skeleton className="h-8 w-8 ml-auto" /></td>
                    </tr>
                  ))
                : currentCustomers.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 px-4">
                         <Checkbox 
                            checked={selectedCustomerIds.includes(customer.id)}
                            onCheckedChange={(checked) => handleSelectCustomer(customer.id, !!checked)}
                         />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                              {getInitials(customer.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-gray-900">{customer.name}</p>
                            <p className="text-xs text-gray-500">Since {new Date(customer.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Mail className="w-3 h-3" />
                            {customer.email}
                          </p>
                          <p className="text-sm text-gray-600 flex items-center gap-2">
                            <Phone className="w-3 h-3" />
                            {customer.phone || "N/A"}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                         <Badge variant="outline" className="capitalize">{customer.customerType}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/dashboard/orders?customer=${encodeURIComponent(customer.name)}`}
                          className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          {customer.totalOrders || 0}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-gray-900">${(customer.totalSpent || 0).toFixed(2)}</p>
                      </td>
                      <td className="py-3 px-4">
                         <StatusBadge status={customer.status === "active" ? "Active" : "Inactive"} />
                      </td>
                      <td className="py-3 px-4 text-right">
                         <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => { setSelectedCustomer(customer); setIsDetailsOpen(true); }} title="View details">
                               <Eye className="w-4 h-4 text-gray-500" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleAddEditOpen(customer)}>
                                  <Edit2 className="mr-2 h-4 w-4" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(customer.id)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                         </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">No customers found matching your criteria.</p>
          </div>
        )}
      </Card>

      <PaginationControl
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        onItemsPerPageChange={handleItemsPerPageChange}
        totalItems={filteredCustomers.length}
      />

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>Customer profile and activity overview.</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                <Avatar className="w-16 h-16 border-2 border-white shadow-sm">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold text-xl">
                    {getInitials(selectedCustomer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                         <h3 className="text-xl font-bold text-gray-900">{selectedCustomer.name}</h3>
                         <div className="flex items-center gap-2 mt-1">
                            <StatusBadge status={selectedCustomer.status === "active" ? "Active" : "Inactive"} />
                            <Badge variant="secondary" className="capitalize">{selectedCustomer.customerType}</Badge>
                         </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setIsDetailsOpen(false); handleAddEditOpen(selectedCustomer); }}>
                        <Edit2 className="w-4 h-4 mr-2" /> Edit Profile
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Mail className="w-4 h-4" /> Contact Info</h4>
                    <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-3">
                            <span className="text-gray-500">Email:</span>
                            <span className="col-span-2 font-medium break-all">{selectedCustomer.email}</span>
                        </div>
                        <div className="grid grid-cols-3">
                            <span className="text-gray-500">Phone:</span>
                            <span className="col-span-2 font-medium">{selectedCustomer.phone || "-"}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Address</h4>
                    <div className="space-y-1 text-sm">
                        {selectedCustomer.address ? (
                            <>
                                <p>{selectedCustomer.address}</p>
                                <p>{selectedCustomer.city}, {selectedCustomer.state} {selectedCustomer.zipCode}</p>
                                <p>{selectedCustomer.country}</p>
                            </>
                        ) : (
                            <p className="text-gray-500 italic">No address provided</p>
                        )}
                    </div>
                </Card>

                <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Statistics</h4>
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Total Orders:</span>
                            <span className="font-medium">{selectedCustomer.totalOrders || 0}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Total Spent:</span>
                            <span className="font-medium text-emerald-600">${(selectedCustomer.totalSpent || 0).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Store Credit:</span>
                            <span className="font-medium">${(selectedCustomer.storeCredit || 0).toFixed(2)}</span>
                        </div>
                    </div>
                </Card>

                <Card className="p-4">
                    <h4 className="font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Other Info</h4>
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-gray-500">Joined:</span>
                            <span className="font-medium">{new Date(selectedCustomer.createdAt).toLocaleDateString()}</span>
                        </div>
                         <div className="flex justify-between">
                            <span className="text-gray-500">Last Updated:</span>
                            <span className="font-medium">{new Date(selectedCustomer.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    {selectedCustomer.notes && (
                        <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-gray-500 mb-1">Notes:</p>
                            <p className="text-sm italic">{selectedCustomer.notes}</p>
                        </div>
                    )}
                </Card>
              </div>

               <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => {
                        setIsDetailsOpen(false)
                        router.push(`/dashboard/orders?customer=${encodeURIComponent(selectedCustomer.name)}`)
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      View All Orders
                    </Button>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                <DialogDescription>
                    Fill in the details below. Required fields are marked with *
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input 
                            id="name" 
                            value={formData.name} 
                            onChange={(e) => setFormData({...formData, name: e.target.value})} 
                            placeholder="John Doe"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input 
                            id="email" 
                            type="email"
                            value={formData.email} 
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                            placeholder="john@example.com"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Phone Number</Label>
                        <Input 
                            id="phone" 
                            value={formData.phone} 
                            onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                            placeholder="+1 (555) 000-0000"
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="type">Customer Type</Label>
                        <Select 
                            value={formData.customerType} 
                            onValueChange={(val: "retail" | "wholesale") => setFormData({...formData, customerType: val})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="wholesale">Wholesale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                     <Label htmlFor="address">Street Address</Label>
                     <Input 
                        id="address" 
                        value={formData.address} 
                        onChange={(e) => setFormData({...formData, address: e.target.value})} 
                        placeholder="123 Main St"
                    />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                     <div className="space-y-2 col-span-2">
                        <Label htmlFor="city">City</Label>
                        <Input 
                            id="city" 
                            value={formData.city} 
                            onChange={(e) => setFormData({...formData, city: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="state">State</Label>
                        <Input 
                            id="state" 
                            value={formData.state} 
                            onChange={(e) => setFormData({...formData, state: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="zip">Zip Code</Label>
                        <Input 
                            id="zip" 
                            value={formData.zipCode} 
                            onChange={(e) => setFormData({...formData, zipCode: e.target.value})} 
                        />
                    </div>
                </div>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <Input 
                            id="country" 
                            value={formData.country} 
                            onChange={(e) => setFormData({...formData, country: e.target.value})} 
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select 
                            value={formData.status} 
                            onValueChange={(val: "active" | "inactive") => setFormData({...formData, status: val})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea 
                        id="notes" 
                        value={formData.notes} 
                        onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                        placeholder="Additional notes about the customer..."
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveCustomer} className="bg-emerald-600 hover:bg-emerald-700">
                    {editingCustomer ? 'Save Changes' : 'Add Customer'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Action Dialog */}
      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent>
             <DialogHeader>
                <DialogTitle>Bulk Actions</DialogTitle>
                <DialogDescription>
                    Apply action to {selectedCustomerIds.length} selected customers.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                <Label className="mb-2 block">Select Action</Label>
                <Select value={bulkAction} onValueChange={setBulkAction}>
                    <SelectTrigger>
                        <SelectValue placeholder="Choose action..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">Set Status to Active</SelectItem>
                        <SelectItem value="inactive">Set Status to Inactive</SelectItem>
                        <SelectItem value="delete" className="text-red-600">Delete Customers</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                 <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>Cancel</Button>
                 <Button 
                    onClick={handleBulkAction} 
                    disabled={!bulkAction}
                    className={bulkAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}
                 >
                    Apply
                 </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
       {/* Import Dialog */}
       <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Customers</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import customers. The CSV should have headers: Name, Email, Phone, Address, etc.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
               <Label htmlFor="csv_upload">CSV File</Label>
               <Input id="csv_upload" type="file" accept=".csv" onChange={handleImport} />
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
