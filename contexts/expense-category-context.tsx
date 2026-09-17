"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { expenseCategoryApi, type ExpenseCategoryResponse } from "@/lib/expenseCategoryApi"

export interface ExpenseCategory {
  id: string
  companyId: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}

interface ExpenseCategoryContextType {
  categories: ExpenseCategory[]
  isLoading: boolean
  error: string | null
  getCategoryById: (id: string) => ExpenseCategory | undefined
  addCategory: (category: Omit<ExpenseCategory, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateCategory: (id: string, updates: Partial<ExpenseCategory>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  refreshCategories: () => Promise<void>
}

const ExpenseCategoryContext = createContext<ExpenseCategoryContextType | undefined>(undefined)

function convertToCategory(backend: ExpenseCategoryResponse): ExpenseCategory {
  return {
    id: backend.id.toString(),
    companyId: backend.companyId?.toString() ?? '',
    name: backend.name,
    description: backend.description || '',
    createdAt: backend.createdAt,
    updatedAt: backend.updatedAt,
  }
}

export function ExpenseCategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshCategories = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await expenseCategoryApi.getAll({
        limit: 100,
      })

      const converted = response.data.map(convertToCategory)
      setCategories(converted)
    } catch (err: any) {
      if (err.response?.status !== 403) {
        console.error('Error fetching expense categories:', err)
        setError(err.response?.data?.error || 'Failed to fetch expense categories')
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refreshCategories()
  }, [])

  const addCategory = async (category: Omit<ExpenseCategory, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>) => {
    try {
      await expenseCategoryApi.create({
        name: category.name,
        description: category.description,
      })

      await refreshCategories()
    } catch (err: any) {
      console.error('Error creating expense category:', err)
      throw new Error(err.response?.data?.error || 'Failed to create expense category')
    }
  }

  const updateCategory = async (id: string, updates: Partial<ExpenseCategory>) => {
    try {
      const updateData: any = {}

      if (updates.name !== undefined) updateData.name = updates.name
      if (updates.description !== undefined) updateData.description = updates.description

      await expenseCategoryApi.update(parseInt(id), updateData)

      await refreshCategories()
    } catch (err: any) {
      console.error('Error updating expense category:', err)
      throw new Error(err.response?.data?.error || 'Failed to update expense category')
    }
  }

  const getCategoryById = (id: string) => categories.find(c => c.id === id)

  const deleteCategory = async (id: string) => {
    try {
      await expenseCategoryApi.delete(parseInt(id))

      await refreshCategories()
    } catch (err: any) {
      console.error('Error deleting expense category:', err)
      throw new Error(err.response?.data?.error || 'Failed to delete expense category')
    }
  }

  return (
    <ExpenseCategoryContext.Provider
      value={{
        categories,
        isLoading,
        error,
        getCategoryById,
        addCategory,
        updateCategory,
        deleteCategory,
        refreshCategories,
      }}
    >
      {children}
    </ExpenseCategoryContext.Provider>
  )
}

export function useExpenseCategory() {
  const context = useContext(ExpenseCategoryContext)
  if (context === undefined) {
    throw new Error("useExpenseCategory must be used within an ExpenseCategoryProvider")
  }
  return context
}
