"use client"

import React, { createContext, useContext, useState } from "react"
import { generateId } from "@/lib/export-import-utils"

export interface Category {
  id: string
  category_name: string
  icon?: string
  description?: string
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
  addCategory: (category: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'Children' | 'Parent'>) => void
  updateCategory: (id: string, updates: Partial<Category>) => void
  deleteCategory: (id: string) => void
  getCategoryById: (id: string) => Category | undefined
  getParentCategories: () => Category[]
  getChildCategories: (parentId: string) => Category[]
  getAllCategoriesFlat: () => Category[]
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

// Mock data matching backend structure
const initialCategories: Category[] = [
  {
    id: "1",
    category_name: "Electronics",
    icon: "🔌",
    description: "Electronic devices and accessories",
    parent_id: null,
    Parent: null,
    Children: [
      {
        id: "2",
        category_name: "Mobile Phones",
        icon: "📱",
        description: "Smartphones and feature phones",
        parent_id: "1",
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:56:56Z",
        updated_at: "2026-01-27T12:56:56Z",
        deleted_at: null,
      },
      {
        id: "3",
        category_name: "Laptops",
        icon: "💻",
        description: "Gaming and business laptops",
        parent_id: "1",
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:57:00Z",
        updated_at: "2026-01-27T12:57:00Z",
        deleted_at: null,
      },
    ],
    status: true,
    created_at: "2026-01-27T12:56:10Z",
    updated_at: "2026-01-27T12:57:53Z",
    deleted_at: null,
  },
  {
    id: "4",
    category_name: "Clothing",
    icon: "👕",
    description: "Apparel for men and women",
    parent_id: null,
    Parent: null,
    Children: [
      {
        id: "5",
        category_name: "Men",
        icon: "👔",
        description: "Men's fashion",
        parent_id: "4",
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:58:00Z",
        updated_at: "2026-01-27T12:58:00Z",
        deleted_at: null,
      },
      {
        id: "6",
        category_name: "Women",
        icon: "👗",
        description: "Women's fashion",
        parent_id: "4",
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:58:10Z",
        updated_at: "2026-01-27T12:58:10Z",
        deleted_at: null,
      },
    ],
    status: true,
    created_at: "2026-01-27T12:57:50Z",
    updated_at: "2026-01-27T12:57:50Z",
    deleted_at: null,
  },
  {
    id: "7",
    category_name: "Fresh Vegetable",
    icon: "🥕",
    description: "Farm fresh vegetables",
    parent_id: null,
    Parent: null,
    Children: null,
    status: true,
    created_at: "2026-01-27T12:59:00Z",
    updated_at: "2026-01-27T12:59:00Z",
    deleted_at: null,
  },
  {
    id: "8",
    category_name: "Fresh Fruits",
    icon: "🍎",
    description: "Seasonal fruits",
    parent_id: null,
    Parent: null,
    Children: null,
    status: true,
    created_at: "2026-01-27T12:59:10Z",
    updated_at: "2026-01-27T12:59:10Z",
    deleted_at: null,
  },
]

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)

  const addCategory = (categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'Children' | 'Parent'>) => {
    const parent = categoryData.parent_id 
      ? getCategoryById(categoryData.parent_id)
      : null

    const newCategory: Category = {
      ...categoryData,
      id: generateId(),
      Parent: parent || null,
      Children: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null
    }

    if (parent) {
      // Add as child to existing parent
      updateCategory(parent.id, { 
        Children: [...(parent.Children || []), newCategory] 
      })
    } else {
       // Add as new root category
       setCategories(prev => [...prev, newCategory])
    }
  }

  const updateCategory = (id: string, updates: Partial<Category>) => {
    // Helper to recursively update
    const updateRecursive = (list: Category[]): Category[] => {
      return list.map(cat => {
        if (cat.id === id) {
          return { ...cat, ...updates, updated_at: new Date().toISOString() }
        }
        if (cat.Children) {
          return { ...cat, Children: updateRecursive(cat.Children) }
        }
        return cat
      })
    }
    setCategories(prev => updateRecursive(prev))
  }

  const deleteCategory = (id: string) => {
     const deleteRecursive = (list: Category[]): Category[] => {
      return list.filter(cat => cat.id !== id).map(cat => ({
        ...cat,
        Children: cat.Children ? deleteRecursive(cat.Children) : null
      }))
    }
    setCategories(prev => deleteRecursive(prev))
  }

  const getCategoryById = (id: string): Category | undefined => {
    // Helper search
    const findRecursive = (list: Category[]): Category | undefined => {
      for (const cat of list) {
        if (cat.id === id) return cat
        if (cat.Children) {
          const found = findRecursive(cat.Children)
          if (found) return found
        }
      }
      return undefined
    }
    return findRecursive(categories)
  }

  const getParentCategories = () => {
    // Assuming 'categories' state holds the root categories
    return categories
  }

  const getChildCategories = (parentId: string) => {
    const parent = getCategoryById(parentId)
    return parent?.Children || []
  }

  const getAllCategoriesFlat = () => {
    const flat: Category[] = []
    const flattenRecursive = (list: Category[]) => {
      list.forEach(cat => {
        flat.push(cat)
        if (cat.Children) flattenRecursive(cat.Children)
      })
    }
    flattenRecursive(categories)
    return flat
  }

  return (
    <CategoryContext.Provider
      value={{
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryById,
        getParentCategories,
        getChildCategories,
        getAllCategoriesFlat,
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
