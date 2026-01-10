"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Search, Eye, Mail, Phone, MapPin, Calendar, ShoppingBag } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"

interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address: string
  joinDate: string
  totalOrders: number
  totalSpent: number
  status: "Active" | "Inactive"
  recentOrders: Array<{
    id: string
    date: string
    amount: number
    status: string
  }>
}

const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    phone: "+1 (555) 123-4567",
    address: "123 Main St, New York, NY 10001",
    joinDate: "2023-06-15",
    totalOrders: 24,
    totalSpent: 2450.0,
    status: "Active",
    recentOrders: [
      { id: "#ORD-001", date: "2024-01-15", amount: 69.97, status: "Completed" },
      { id: "#ORD-045", date: "2024-01-10", amount: 125.5, status: "Completed" },
      { id: "#ORD-032", date: "2024-01-05", amount: 89.99, status: "Completed" },
    ],
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+1 (555) 234-5678",
    address: "456 Oak Ave, Los Angeles, CA 90001",
    joinDate: "2023-08-22",
    totalOrders: 18,
    totalSpent: 1890.5,
    status: "Active",
    recentOrders: [
      { id: "#ORD-002", date: "2024-01-15", amount: 99.99, status: "Processing" },
      { id: "#ORD-038", date: "2024-01-08", amount: 156.0, status: "Completed" },
    ],
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob@example.com",
    phone: "+1 (555) 345-6789",
    address: "789 Elm St, Chicago, IL 60601",
    joinDate: "2023-04-10",
    totalOrders: 32,
    totalSpent: 3200.75,
    status: "Active",
    recentOrders: [
      { id: "#ORD-003", date: "2024-01-14", amount: 54.98, status: "Pending" },
      { id: "#ORD-041", date: "2024-01-12", amount: 234.5, status: "Completed" },
    ],
  },
  {
    id: "4",
    name: "Alice Brown",
    email: "alice@example.com",
    phone: "+1 (555) 456-7890",
    address: "321 Pine Rd, Houston, TX 77001",
    joinDate: "2023-09-18",
    totalOrders: 15,
    totalSpent: 1567.25,
    status: "Active",
    recentOrders: [{ id: "#ORD-004", date: "2024-01-14", amount: 119.98, status: "Completed" }],
  },
  {
    id: "5",
    name: "Charlie Wilson",
    email: "charlie@example.com",
    phone: "+1 (555) 567-8901",
    address: "654 Maple Dr, Phoenix, AZ 85001",
    joinDate: "2023-02-05",
    totalOrders: 8,
    totalSpent: 456.0,
    status: "Inactive",
    recentOrders: [{ id: "#ORD-005", date: "2024-01-13", amount: 44.97, status: "Cancelled" }],
  },
  {
    id: "6",
    name: "David Lee",
    email: "david@example.com",
    phone: "+1 (555) 678-9012",
    address: "987 Cedar Ln, Philadelphia, PA 19101",
    joinDate: "2023-11-28",
    totalOrders: 12,
    totalSpent: 1234.5,
    status: "Active",
    recentOrders: [{ id: "#ORD-006", date: "2024-01-13", amount: 79.99, status: "Processing" }],
  },
]

export default function CustomersPage() {
  const router = useRouter()
  const [customers] = useState<Customer[]>(initialCustomers)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery),
  )

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

  const handleViewDetails = (customer: Customer) => {
    setSelectedCustomer(customer)
    setIsDetailsOpen(true)
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
        <p className="text-gray-600 mt-1">Manage your customer base and view their activity</p>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                handleFilterChange()
              }}
              className="pl-10"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Contact</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Orders</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Spent</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentCustomers.map((customer) => (
                <tr key={customer.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback className="bg-emerald-100 text-emerald-700 font-medium">
                          {getInitials(customer.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-gray-900">{customer.name}</p>
                        <p className="text-sm text-gray-500">Joined {customer.joinDate}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        {customer.email}
                      </p>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        {customer.phone}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/orders?customer=${encodeURIComponent(customer.name)}`}
                      className="font-medium text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                    >
                      {customer.totalOrders}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900">${customer.totalSpent.toFixed(2)}</p>
                  </td>
                  <td className="py-3 px-4">
                    <StatusBadge status={customer.status} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleViewDetails(customer)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No customers found</p>
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

      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>Complete customer information and order history</DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 font-semibold text-xl">
                    {getInitials(selectedCustomer.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedCustomer.name}</h3>
                  <StatusBadge status={selectedCustomer.status} className="mt-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">{selectedCustomer.email}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">{selectedCustomer.phone}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4 md:col-span-2">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Address</p>
                      <p className="font-medium">{selectedCustomer.address}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Join Date</p>
                      <p className="font-medium">{selectedCustomer.joinDate}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <ShoppingBag className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-600">Total Orders</p>
                      <p className="font-medium">{selectedCustomer.totalOrders}</p>
                    </div>
                  </div>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Order Statistics</h4>
                <Card className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Total Spent</p>
                      <p className="text-2xl font-bold text-emerald-600">${selectedCustomer.totalSpent.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Average Order</p>
                      <p className="text-2xl font-bold text-gray-900">
                        ${(selectedCustomer.totalSpent / selectedCustomer.totalOrders).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Recent Orders</h4>
                <Card className="p-4">
                  <div className="space-y-3">
                    {selectedCustomer.recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex justify-between items-center pb-3 last:pb-0 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{order.id}</p>
                          <p className="text-sm text-gray-500">{order.date}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">${order.amount.toFixed(2)}</p>
                          <StatusBadge status={order.status} className="text-xs" />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      onClick={() => {
                        setIsDetailsOpen(false)
                        router.push(`/dashboard/orders?customer=${encodeURIComponent(selectedCustomer.name)}`)
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                    >
                      View All Orders
                    </Button>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
