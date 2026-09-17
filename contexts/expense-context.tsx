"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { expenseApi, type ExpenseResponse, type ExpenseStatsResponse, type PaymentMethod, type RecurringFrequency } from "@/lib/expenseApi"

export interface Expense {
  id: string
  companyId: string
  expenseCategoryId: string
  categoryName: string
  vendorId: string | null
  vendorName: string | null
  title: string
  amount: number
  expenseDate: string
  paymentMethod: PaymentMethod
  referenceNo: string | null
  notes: string | null
  receiptPath: string | null
  isRecurring: boolean
  recurringFrequency: RecurringFrequency | null
  recurringEndDate: string | null
  createdAt: string
  updatedAt: string
}

interface ExpenseContextType {
  expenses: Expense[]
  isLoading: boolean
  error: string | null
  stats: ExpenseStatsResponse | null
  statsLoading: boolean
  getExpenseById: (id: string) => Expense | undefined
  addExpense: (expense: {
    expenseCategoryId: string
    vendorId?: string | null
    title: string
    amount: number
    expenseDate: string
    paymentMethod: PaymentMethod
    referenceNo?: string
    notes?: string
    receipt?: File | null
    isRecurring?: boolean
    recurringFrequency?: RecurringFrequency | null
    recurringEndDate?: string | null
  }) => Promise<void>
  updateExpense: (id: string, updates: Partial<{
    expenseCategoryId: string
    vendorId: string | null
    title: string
    amount: number
    expenseDate: string
    paymentMethod: PaymentMethod
    referenceNo: string
    notes: string
    receipt: File | null
    isRecurring: boolean
    recurringFrequency: RecurringFrequency | null
    recurringEndDate: string | null
  }>) => Promise<void>
  deleteExpense: (id: string) => Promise<void>
  refreshExpenses: () => Promise<void>
  fetchStats: () => Promise<void>
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined)

function convertToExpense(backend: ExpenseResponse): Expense {
  return {
    id: backend.id.toString(),
    companyId: backend.companyId?.toString() ?? '',
    expenseCategoryId: backend.expenseCategoryId?.toString() ?? '',
    categoryName: backend.categoryName || '',
    vendorId: backend.vendorId != null ? backend.vendorId.toString() : null,
    vendorName: backend.vendorName || null,
    title: backend.title,
    amount: backend.amount || 0,
    expenseDate: backend.expenseDate,
    paymentMethod: backend.paymentMethod || 'cash',
    referenceNo: backend.referenceNo || null,
    notes: backend.notes || null,
    receiptPath: backend.receiptPath || null,
    isRecurring: backend.isRecurring || false,
    recurringFrequency: backend.recurringFrequency || null,
    recurringEndDate: backend.recurringEndDate || null,
    createdAt: backend.createdAt,
    updatedAt: backend.updatedAt,
  }
}

export function ExpenseProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<ExpenseStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const refreshExpenses = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await expenseApi.getAll({
        limit: 100,
      })

      const converted = response.data.map(convertToExpense)
      setExpenses(converted)
    } catch (err: any) {
      if (err.response?.status !== 403) {
        console.error('Error fetching expenses:', err)
        setError(err.response?.data?.error || 'Failed to fetch expenses')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      setStatsLoading(true)
      const statsData = await expenseApi.getStats()
      setStats(statsData)
    } catch (err) {
      console.error('Failed to fetch expense stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    refreshExpenses()
    fetchStats()
  }, [])

  const addExpense: ExpenseContextType['addExpense'] = async (expense) => {
    try {
      await expenseApi.create({
        expenseCategoryId: parseInt(expense.expenseCategoryId),
        vendorId: expense.vendorId ? parseInt(expense.vendorId) : null,
        title: expense.title,
        amount: expense.amount,
        expenseDate: expense.expenseDate,
        paymentMethod: expense.paymentMethod,
        referenceNo: expense.referenceNo,
        notes: expense.notes,
        receipt: expense.receipt,
        isRecurring: expense.isRecurring,
        recurringFrequency: expense.recurringFrequency,
        recurringEndDate: expense.recurringEndDate,
      })

      await refreshExpenses()
      await fetchStats()
    } catch (err: any) {
      console.error('Error creating expense:', err)
      throw new Error(err.response?.data?.error || 'Failed to create expense')
    }
  }

  const updateExpense: ExpenseContextType['updateExpense'] = async (id, updates) => {
    try {
      const updateData: any = {}

      if (updates.expenseCategoryId !== undefined) updateData.expenseCategoryId = parseInt(updates.expenseCategoryId)
      if (updates.vendorId !== undefined) updateData.vendorId = updates.vendorId ? parseInt(updates.vendorId) : null
      if (updates.title !== undefined) updateData.title = updates.title
      if (updates.amount !== undefined) updateData.amount = updates.amount
      if (updates.expenseDate !== undefined) updateData.expenseDate = updates.expenseDate
      if (updates.paymentMethod !== undefined) updateData.paymentMethod = updates.paymentMethod
      if (updates.referenceNo !== undefined) updateData.referenceNo = updates.referenceNo
      if (updates.notes !== undefined) updateData.notes = updates.notes
      if (updates.receipt !== undefined) updateData.receipt = updates.receipt
      if (updates.isRecurring !== undefined) updateData.isRecurring = updates.isRecurring
      if (updates.recurringFrequency !== undefined) updateData.recurringFrequency = updates.recurringFrequency
      if (updates.recurringEndDate !== undefined) updateData.recurringEndDate = updates.recurringEndDate

      await expenseApi.update(parseInt(id), updateData)

      await refreshExpenses()
      await fetchStats()
    } catch (err: any) {
      console.error('Error updating expense:', err)
      throw new Error(err.response?.data?.error || 'Failed to update expense')
    }
  }

  const getExpenseById = (id: string) => expenses.find(e => e.id === id)

  const deleteExpense = async (id: string) => {
    try {
      await expenseApi.delete(parseInt(id))

      await refreshExpenses()
      await fetchStats()
    } catch (err: any) {
      console.error('Error deleting expense:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete expense')
    }
  }

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        isLoading,
        error,
        stats,
        statsLoading,
        getExpenseById,
        addExpense,
        updateExpense,
        deleteExpense,
        refreshExpenses,
        fetchStats,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  )
}

export function useExpense() {
  const context = useContext(ExpenseContext)
  if (context === undefined) {
    throw new Error("useExpense must be used within an ExpenseProvider")
  }
  return context
}
