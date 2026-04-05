"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { categoryApi, type CategoryResponse } from "@/lib/categoryApi"

export interface Category {
  id: string
  category_name: string
  parent_id: string | null
  Parent: Category | null
  Children: Category[] | null
  status: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface CategoryContextType {
  categories: Category[]
  isLoading: boolean
  error: string | null
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'Children' | 'Parent'>) => Promise<void>
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  getCategoryById: (id: string) => Category | undefined
  getParentCategories: () => Category[]
  getChildCategories: (parentId: string) => Category[]
  getAllCategoriesFlat: () => Category[]
  refreshCategories: () => Promise<void>
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

// Convert backend response to frontend Category interface
function convertToCategory(backendCategory: CategoryResponse): Category {
  return {
    id: backendCategory.id.toString(),
    category_name: backendCategory.categoryName || '',
    parent_id: backendCategory.parentId?.toString() || null,
    Parent: backendCategory.parent ? convertToCategory(backendCategory.parent) : null,
    Children: backendCategory.children?.map(convertToCategory) || null,
    status: backendCategory.status,
    created_at: backendCategory.createdAt || '',
    updated_at: backendCategory.updatedAt || '',
    deleted_at: null,
  }
}

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch categories from backend
  const refreshCategories = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await categoryApi.getAll({
        view: 'flat',
        limit: 100,
        include_inactive: true,
      })

      const convertedCategories = response.data.map(convertToCategory)
      setCategories(convertedCategories)
    } catch (err: any) {
      console.error('Error fetching categories:', err)
      setError(err.response?.data?.error || 'Failed to fetch categories')
    } finally {
      setIsLoading(false)
    }
  }

  // Load categories on mount
  useEffect(() => {
    refreshCategories()
  }, [])

  const addCategory = async (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'Children' | 'Parent'>) => {
    try {
      await categoryApi.create({
        category_name: category.category_name,
        parent_id: category.parent_id ? parseInt(category.parent_id) : null,
        status: category.status,
      })

      // Refresh categories to get updated tree structure
      await refreshCategories()
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to create category')
    }
  }

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const updateData: any = {}

      if (updates.category_name !== undefined) {
        updateData.category_name = updates.category_name
      }
      if (updates.parent_id !== undefined) {
        updateData.parent_id = updates.parent_id ? parseInt(updates.parent_id) : null
      }
      if (updates.status !== undefined) {
        updateData.status = updates.status
      }

      await categoryApi.update(parseInt(id), updateData)

      // Refresh categories to get updated tree structure
      await refreshCategories()
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to update category')
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      await categoryApi.delete(parseInt(id))

      // Refresh categories to get updated tree structure
      await refreshCategories()
    } catch (err: any) {
      throw new Error(err.response?.data?.message || err.response?.data?.error || 'Failed to delete category')
    }
  }

  const getCategoryById = (id: string): Category | undefined => {
    const findCategory = (categories: Category[]): Category | undefined => {
      for (const cat of categories) {
        if (cat.id === id) return cat
        if (cat.Children) {
          const found = findCategory(cat.Children)
          if (found) return found
        }
      }
      return undefined
    }
    return findCategory(categories)
  }

  const getParentCategories = (): Category[] => {
    return categories.filter((cat) => cat.parent_id === null)
  }

  const getChildCategories = (parentId: string): Category[] => {
    const getAllChildren = (categories: Category[]): Category[] => {
      const result: Category[] = []
      for (const cat of categories) {
        if (cat.parent_id === parentId) {
          result.push(cat)
        }
        if (cat.Children) {
          result.push(...getAllChildren(cat.Children))
        }
      }
      return result
    }
    return getAllChildren(categories)
  }

  const getAllCategoriesFlat = (): Category[] => {
    const flattenCategories = (categories: Category[]): Category[] => {
      const result: Category[] = []
      for (const cat of categories) {
        result.push(cat)
        if (cat.Children) {
          result.push(...flattenCategories(cat.Children))
        }
      }
      return result
    }
    return flattenCategories(categories)
  }

  return (
    <CategoryContext.Provider
      value={{
        categories,
        isLoading,
        error,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryById,
        getParentCategories,
        getChildCategories,
        getAllCategoriesFlat,
        refreshCategories,
      }}
    >
      {children}
    </CategoryContext.Provider>
  )
}

export function useCategory() {
  const context = useContext(CategoryContext)
  if (context === undefined) {
    throw new Error("useCategory must be used within a CategoryProvider")
  }
  return context
}
