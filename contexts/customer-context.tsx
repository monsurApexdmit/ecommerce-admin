"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  customerType: 'retail' | 'wholesale'
  status: 'active' | 'inactive'
  totalOrders?: number
  totalSpent?: number
  storeCredit?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

interface CustomerContextType {
  customers: Customer[]
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateCustomer: (id: string, updates: Partial<Customer>) => void
  deleteCustomer: (id: string) => void
  getCustomerById: (id: string) => Customer | undefined
  getActiveCustomers: () => Customer[]
  getCustomerStats: () => {
    total: number
    active: number
    inactive: number
    retail: number
    wholesale: number
  }
}

const CustomerContext = createContext<CustomerContextType | undefined>(undefined)

// Sample data
const initialCustomers: Customer[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@example.com",
    phone: "+1-555-0101",
    address: "123 Main St",
    city: "New York",
    state: "NY",
    zipCode: "10001",
    country: "USA",
    customerType: "retail",
    status: "active",
    totalOrders: 15,
    totalSpent: 2450.50,
    storeCredit: 0,
    createdAt: "2025-01-01T10:00:00",
    updatedAt: "2025-01-20T15:30:00"
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+1-555-0102",
    address: "456 Oak Ave",
    city: "Los Angeles",
    state: "CA",
    zipCode: "90001",
    country: "USA",
    customerType: "retail",
    status: "active",
    totalOrders: 8,
    totalSpent: 1280.00,
    storeCredit: 50,
    createdAt: "2025-01-05T14:20:00",
    updatedAt: "2025-01-19T11:15:00"
  },
  {
    id: "3",
    name: "ABC Corporation",
    email: "purchasing@abccorp.com",
    phone: "+1-555-0103",
    address: "789 Business Blvd",
    city: "Chicago",
    state: "IL",
    zipCode: "60601",
    country: "USA",
    customerType: "wholesale",
    status: "active",
    totalOrders: 45,
    totalSpent: 25600.75,
    storeCredit: 200,
    createdAt: "2024-12-01T09:00:00",
    updatedAt: "2025-01-18T16:45:00"
  },
  {
    id: "4",
    name: "Robert Johnson",
    email: "robert.j@email.com",
    phone: "+1-555-0104",
    address: "321 Pine St",
    city: "Houston",
    state: "TX",
    zipCode: "77001",
    country: "USA",
    customerType: "retail",
    status: "active",
    totalOrders: 3,
    totalSpent: 450.00,
    storeCredit: 0,
    createdAt: "2025-01-15T11:30:00",
    updatedAt: "2025-01-15T11:30:00"
  },
  {
    id: "5",
    name: "Sarah Williams",
    email: "sarah.w@example.com",
    phone: "+1-555-0105",
    customerType: "retail",
    status: "inactive",
    totalOrders: 1,
    totalSpent: 89.99,
    storeCredit: 0,
    createdAt: "2024-11-20T13:00:00",
    updatedAt: "2024-11-20T13:00:00"
  }
]

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers)

  const addCustomer = (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setCustomers(prev => [newCustomer, ...prev])
  }

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers(prev => prev.map(customer => 
      customer.id === id 
        ? { ...customer, ...updates, updatedAt: new Date().toISOString() } 
        : customer
    ))
  }

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(customer => customer.id !== id))
  }

  const getCustomerById = (id: string) => {
    return customers.find(customer => customer.id === id)
  }

  const getActiveCustomers = () => {
    return customers.filter(customer => customer.status === 'active')
  }

  const getCustomerStats = () => {
    return {
      total: customers.length,
      active: customers.filter(c => c.status === 'active').length,
      inactive: customers.filter(c => c.status === 'inactive').length,
      retail: customers.filter(c => c.customerType === 'retail').length,
      wholesale: customers.filter(c => c.customerType === 'wholesale').length
    }
  }

  return (
    <CustomerContext.Provider
      value={{
        customers,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        getCustomerById,
        getActiveCustomers,
        getCustomerStats
      }}
    >
      {children}
    </CustomerContext.Provider>
  )
}

export function useCustomer() {
  const context = useContext(CustomerContext)
  if (context === undefined) {
    throw new Error("useCustomer must be used within a CustomerProvider")
  }
  return context
}