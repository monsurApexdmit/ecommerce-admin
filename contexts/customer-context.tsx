"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { customerApi, type CustomerResponse } from "@/lib/customerApi"

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
  isLoading: boolean
  error: string | null
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>
  deleteCustomer: (id: string) => Promise<void>
  refreshCustomers: () => Promise<void>
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

function convertToCustomer(c: CustomerResponse): Customer {
  return {
    id: c.id.toString(),
    name: c.name,
    email: c.email,
    phone: c.phone || '',
    address: c.address || '',
    city: c.city || '',
    state: c.state || '',
    zipCode: c.zipCode || '',
    country: c.country || '',
    customerType: c.customerType || 'retail',
    status: c.status || 'active',
    totalOrders: c.totalOrders || 0,
    totalSpent: c.totalSpent || 0,
    storeCredit: c.storeCredit || 0,
    notes: c.notes || '',
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCustomers = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await customerApi.getAll({ limit: 100 })
      setCustomers(response.data.map(convertToCustomer))
    } catch (err: any) {
      console.error('Error fetching customers:', err)
      setError(err.response?.data?.error || 'Failed to fetch customers')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshCustomers()
  }, [])

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await customerApi.create({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone,
        address: customerData.address,
        city: customerData.city,
        state: customerData.state,
        zipCode: customerData.zipCode,
        country: customerData.country,
        customerType: customerData.customerType,
        status: customerData.status,
        notes: customerData.notes,
        storeCredit: customerData.storeCredit,
      })
      await refreshCustomers()
    } catch (err: any) {
      console.error('Error creating customer:', err)
      throw new Error(err.response?.data?.error || 'Failed to create customer')
    }
  }

  const updateCustomer = async (id: string, updates: Partial<Customer>) => {
    try {
      const updateData: any = {}
      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.phone !== undefined) updateData.phone = updates.phone
      if (updates.address !== undefined) updateData.address = updates.address
      if (updates.city !== undefined) updateData.city = updates.city
      if (updates.state !== undefined) updateData.state = updates.state
      if (updates.zipCode !== undefined) updateData.zipCode = updates.zipCode
      if (updates.country !== undefined) updateData.country = updates.country
      if (updates.customerType !== undefined) updateData.customerType = updates.customerType
      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.notes !== undefined) updateData.notes = updates.notes
      if (updates.storeCredit !== undefined) updateData.storeCredit = updates.storeCredit

      await customerApi.update(parseInt(id), updateData)
      await refreshCustomers()
    } catch (err: any) {
      console.error('Error updating customer:', err)
      throw new Error(err.response?.data?.error || 'Failed to update customer')
    }
  }

  const deleteCustomer = async (id: string) => {
    try {
      await customerApi.delete(parseInt(id))
      await refreshCustomers()
    } catch (err: any) {
      console.error('Error deleting customer:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete customer')
    }
  }

  const getCustomerById = (id: string) => customers.find(c => c.id === id)

  const getActiveCustomers = () => customers.filter(c => c.status === 'active')

  const getCustomerStats = () => ({
    total: customers.length,
    active: customers.filter(c => c.status === 'active').length,
    inactive: customers.filter(c => c.status === 'inactive').length,
    retail: customers.filter(c => c.customerType === 'retail').length,
    wholesale: customers.filter(c => c.customerType === 'wholesale').length,
  })

  return (
    <CustomerContext.Provider
      value={{
        customers,
        isLoading,
        error,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        refreshCustomers,
        getCustomerById,
        getActiveCustomers,
        getCustomerStats,
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
