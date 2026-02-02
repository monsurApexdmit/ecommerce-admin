"use client"

import React, { createContext, useContext, useState } from "react"

export interface Category {
  id: number
  category_name: string
  parent_id: number | null
  Parent: Category | null
  Children: Category[] | null
  status: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

interface CategoryContextType {
  categories: Category[]
  addCategory: (category: Category) => void
  updateCategory: (category: Category) => void
  deleteCategory: (id: number) => void
  getCategoryById: (id: number) => Category | undefined
  getParentCategories: () => Category[]
  getChildCategories: (parentId: number) => Category[]
  getAllCategoriesFlat: () => Category[]
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined)

// Mock data matching backend structure
const initialCategories: Category[] = [
  {
    id: 1,
    category_name: "Electronics",
    parent_id: null,
    Parent: null,
    Children: [
      {
        id: 2,
        category_name: "Mobile Phones",
        parent_id: 1,
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:56:56Z",
        updated_at: "2026-01-27T12:56:56Z",
        deleted_at: null,
      },
      {
        id: 3,
        category_name: "Laptops",
        parent_id: 1,
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
    id: 4,
    category_name: "Clothing",
    parent_id: null,
    Parent: null,
    Children: [
      {
        id: 5,
        category_name: "Men",
        parent_id: 4,
        Parent: null,
        Children: null,
        status: true,
        created_at: "2026-01-27T12:58:00Z",
        updated_at: "2026-01-27T12:58:00Z",
        deleted_at: null,
      },
      {
        id: 6,
        category_name: "Women",
        parent_id: 4,
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
    id: 7,
    category_name: "Fresh Vegetable",
    parent_id: null,
    Parent: null,
    Children: null,
    status: true,
    created_at: "2026-01-27T12:59:00Z",
    updated_at: "2026-01-27T12:59:00Z",
    deleted_at: null,
  },
  {
    id: 8,
    category_name: "Fresh Fruits",
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

  const addCategory = (category: Category) => {
    setCategories((prev) => [...prev, category])
  }

  const updateCategory = (category: Category) => {
    setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)))
  }

  const deleteCategory = (id: number) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }

  const getCategoryById = (id: number) => {
    // Search in parent categories
    const parent = categories.find((c) => c.id === id)
    if (parent) return parent

    // Search in children
    for (const cat of categories) {
      if (cat.Children) {
        const child = cat.Children.find((c) => c.id === id)
        if (child) return child
      }
    }
    return undefined
  }

  const getParentCategories = () => {
    return categories.filter((c) => c.parent_id === null)
  }

  const getChildCategories = (parentId: number) => {
    const parent = categories.find((c) => c.id === parentId)
    return parent?.Children || []
  }

  const getAllCategoriesFlat = () => {
    const flat: Category[] = []
    categories.forEach((cat) => {
      flat.push(cat)
      if (cat.Children) {
        flat.push(...cat.Children)
      }
    })
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
