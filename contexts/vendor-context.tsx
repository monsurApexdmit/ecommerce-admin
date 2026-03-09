"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { vendorApi, type VendorResponse } from "@/lib/vendorApi"

export interface Vendor {
  id: string
  name: string
  email: string
  phone: string
  address: string
  logo: string
  status: string
  description: string
  totalPaid: number
  amountPayable: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface VendorContextType {
  vendors: Vendor[]
  isLoading: boolean
  error: string | null
  getVendorById: (id: string) => Vendor | undefined
  addVendor: (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<void>
  updateVendor: (id: string, updates: Partial<Vendor>) => Promise<void>
  deleteVendor: (id: string) => Promise<void>
  refreshVendors: () => Promise<void>
}

const VendorContext = createContext<VendorContextType | undefined>(undefined)

// Convert backend response to frontend Vendor interface
function convertToVendor(backendVendor: VendorResponse): Vendor {
  return {
    id: backendVendor.id.toString(),
    name: backendVendor.name,
    email: backendVendor.email,
    phone: backendVendor.phone,
    address: backendVendor.address || '',
    logo: backendVendor.logo || '',
    status: backendVendor.status || 'Active',
    description: backendVendor.description || '',
    totalPaid: backendVendor.totalPaid || 0,
    amountPayable: backendVendor.amountPayable || 0,
    created_at: backendVendor.created_at,
    updated_at: backendVendor.updated_at,
    deleted_at: backendVendor.deleted_at || null,
  }
}

export function VendorProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch vendors from backend
  const refreshVendors = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await vendorApi.getAll({
        limit: 100,
      })

      const convertedVendors = response.data.map(convertToVendor)
      setVendors(convertedVendors)
    } catch (err: any) {
      console.error('Error fetching vendors:', err)
      setError(err.response?.data?.error || 'Failed to fetch vendors')
    } finally {
      setIsLoading(false)
    }
  }

  // Load vendors on mount
  useEffect(() => {
    refreshVendors()
  }, [])

  const addVendor = async (vendor: Omit<Vendor, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
    try {
      await vendorApi.create({
        name: vendor.name,
        email: vendor.email,
        phone: vendor.phone,
        address: vendor.address,
        logo: vendor.logo,
        status: vendor.status,
        description: vendor.description,
        totalPaid: vendor.totalPaid,
        amountPayable: vendor.amountPayable,
      })

      // Refresh vendors to get updated list
      await refreshVendors()
    } catch (err: any) {
      console.error('Error creating vendor:', err)
      throw new Error(err.response?.data?.error || 'Failed to create vendor')
    }
  }

  const updateVendor = async (id: string, updates: Partial<Vendor>) => {
    try {
      const updateData: any = {}

      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.email !== undefined) updateData.email = updates.email
      if (updates.phone !== undefined) updateData.phone = updates.phone
      if (updates.address !== undefined) updateData.address = updates.address
      if (updates.logo !== undefined) updateData.logo = updates.logo
      if (updates.status !== undefined) updateData.status = updates.status
      if (updates.description !== undefined) updateData.description = updates.description
      if (updates.totalPaid !== undefined) updateData.totalPaid = updates.totalPaid
      if (updates.amountPayable !== undefined) updateData.amountPayable = updates.amountPayable

      await vendorApi.update(parseInt(id), updateData)

      // Refresh vendors to get updated list
      await refreshVendors()
    } catch (err: any) {
      console.error('Error updating vendor:', err)
      throw new Error(err.response?.data?.error || 'Failed to update vendor')
    }
  }

  const getVendorById = (id: string) => vendors.find(v => v.id === id)

  const deleteVendor = async (id: string) => {
    try {
      await vendorApi.delete(parseInt(id))

      // Refresh vendors to get updated list
      await refreshVendors()
    } catch (err: any) {
      console.error('Error deleting vendor:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete vendor')
    }
  }

  return (
    <VendorContext.Provider
      value={{
        vendors,
        isLoading,
        error,
        getVendorById,
        addVendor,
        updateVendor,
        deleteVendor,
        refreshVendors,
      }}
    >
      {children}
    </VendorContext.Provider>
  )
}

export function useVendor() {
  const context = useContext(VendorContext)
  if (context === undefined) {
    throw new Error("useVendor must be used within a VendorProvider")
  }
  return context
}
