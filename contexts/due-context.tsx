"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { dueApi, type CustomerDueResponse, type VendorDueResponse, type AgingBucket, type DueSummary } from "@/lib/dueApi"
import { paymentApi, type RecordPaymentData, type DuePaymentResponse } from "@/lib/paymentApi"

export interface CustomerDue {
  customerId: string
  customerName: string
  totalDue: number
  oldestUnpaidDate: string
  agingBucket: AgingBucket
  sellCount: number
}

export interface VendorDue {
  vendorId: string
  vendorName: string
  poNumber: string
  totalAmount: number
  paidAmount: number
  dueAmount: number
  paymentStatus: string
  agingBucket: AgingBucket
  daysOld: number
}

interface DuePagination {
  total: number
  page: number
  limit: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

interface DueContextType {
  customerDues: CustomerDue[]
  isLoading: boolean
  error: string | null
  pagination: DuePagination | null
  customerDuesSummary: DueSummary | null
  fetchCustomerDues: (params?: { page?: number; limit?: number; search?: string; aging?: string }) => Promise<void>
  recordPayment: (sellId: number, data: RecordPaymentData) => Promise<DuePaymentResponse>
  vendorDues: VendorDue[]
  isLoadingVendorDues: boolean
  vendorError: string | null
  vendorPagination: DuePagination | null
  vendorDuesSummary: DueSummary | null
  fetchVendorDues: (params?: { page?: number; limit?: number; search?: string; aging?: string }) => Promise<void>
  recordVendorPayment: (poId: number, data: RecordPaymentData) => Promise<DuePaymentResponse>
}

const DueContext = createContext<DueContextType | undefined>(undefined)

function convertToCustomerDue(backend: CustomerDueResponse): CustomerDue {
  return {
    customerId: backend.customerId?.toString() ?? '',
    customerName: backend.customerName,
    totalDue: backend.totalDue || 0,
    oldestUnpaidDate: backend.oldestUnpaidDate,
    agingBucket: backend.agingBucket,
    sellCount: backend.sellCount || 0,
  }
}

function convertToVendorDue(backend: VendorDueResponse): VendorDue {
  return {
    vendorId: backend.vendorId?.toString() ?? '',
    vendorName: backend.vendorName,
    poNumber: backend.poNumber,
    totalAmount: backend.totalAmount || 0,
    paidAmount: backend.paidAmount || 0,
    dueAmount: backend.dueAmount || 0,
    paymentStatus: backend.paymentStatus,
    agingBucket: backend.agingBucket,
    daysOld: backend.daysOld || 0,
  }
}

export function DueProvider({ children }: { children: React.ReactNode }) {
  const [customerDues, setCustomerDues] = useState<CustomerDue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<DuePagination | null>(null)
  const [customerDuesSummary, setCustomerDuesSummary] = useState<DueSummary | null>(null)
  const [lastParams, setLastParams] = useState<{ page?: number; limit?: number; search?: string; aging?: string }>({})

  const [vendorDues, setVendorDues] = useState<VendorDue[]>([])
  const [isLoadingVendorDues, setIsLoadingVendorDues] = useState(true)
  const [vendorError, setVendorError] = useState<string | null>(null)
  const [vendorPagination, setVendorPagination] = useState<DuePagination | null>(null)
  const [vendorDuesSummary, setVendorDuesSummary] = useState<DueSummary | null>(null)
  const [lastVendorParams, setLastVendorParams] = useState<{ page?: number; limit?: number; search?: string; aging?: string }>({})

  const fetchCustomerDues = async (params?: { page?: number; limit?: number; search?: string; aging?: string }) => {
    try {
      setIsLoading(true)
      setError(null)
      setLastParams(params || {})

      const response = await dueApi.getCustomerDues({
        limit: 100,
        ...params,
      })

      const converted = response.data.map(convertToCustomerDue)
      setCustomerDues(converted)
      setPagination(response.pagination || null)
      setCustomerDuesSummary(response.summary || null)
    } catch (err: any) {
      if (err.response?.status !== 403) {
        console.error('Error fetching customer dues:', err)
        setError(err.response?.data?.error || 'Failed to fetch customer dues')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchVendorDues = async (params?: { page?: number; limit?: number; search?: string; aging?: string }) => {
    try {
      setIsLoadingVendorDues(true)
      setVendorError(null)
      setLastVendorParams(params || {})

      const response = await dueApi.getVendorDues({
        limit: 100,
        ...params,
      })

      const converted = response.data.map(convertToVendorDue)
      setVendorDues(converted)
      setVendorPagination(response.pagination || null)
      setVendorDuesSummary(response.summary || null)
    } catch (err: any) {
      if (err.response?.status !== 403) {
        console.error('Error fetching vendor dues:', err)
        setVendorError(err.response?.data?.error || 'Failed to fetch vendor dues')
      }
    } finally {
      setIsLoadingVendorDues(false)
    }
  }

  useEffect(() => {
    fetchCustomerDues()
    fetchVendorDues()
  }, [])

  const recordPayment: DueContextType['recordPayment'] = async (sellId, data) => {
    try {
      const response = await paymentApi.recordPayment('sells', sellId, data)
      await fetchCustomerDues(lastParams)
      return response.data
    } catch (err: any) {
      console.error('Error recording payment:', err)
      throw new Error(err.response?.data?.error || 'Failed to record payment')
    }
  }

  const recordVendorPayment: DueContextType['recordVendorPayment'] = async (poId, data) => {
    try {
      const response = await paymentApi.recordPayment('purchase-orders', poId, data)
      await fetchVendorDues(lastVendorParams)
      return response.data
    } catch (err: any) {
      console.error('Error recording vendor payment:', err)
      throw new Error(err.response?.data?.error || 'Failed to record payment')
    }
  }

  return (
    <DueContext.Provider
      value={{
        customerDues,
        isLoading,
        error,
        pagination,
        customerDuesSummary,
        fetchCustomerDues,
        recordPayment,
        vendorDues,
        isLoadingVendorDues,
        vendorError,
        vendorPagination,
        vendorDuesSummary,
        fetchVendorDues,
        recordVendorPayment,
      }}
    >
      {children}
    </DueContext.Provider>
  )
}

export function useDue() {
  const context = useContext(DueContext)
  if (context === undefined) {
    throw new Error("useDue must be used within a DueProvider")
  }
  return context
}
