"use client"

import { useState, useMemo } from "react"
import { Search, ArrowRightLeft } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProduct } from "@/contexts/product-context"
import { useWarehouse } from "@/contexts/warehouse-context"
import Link from "next/link"
import { usePagination } from "@/hooks/use-pagination"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { useEffect } from "react"

type InventoryRow = {
  type: 'variant' | 'product'
  id: string
  productName: string
  variantName: string | null
  sku: string
  stock: number
  inventory?: any[] // Replace 'any[]' with your actual inventory type if you have one
  product: any // Replace 'any' with your actual Product type if you have one
}

export default function InventoryPage() {
  const { products } = useProduct()
  const { warehouses } = useWarehouse()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
        setIsLoading(false)
    }, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Flatten products into rows BEFORE pagination
  const allRows = useMemo(() => {
const rows: InventoryRow[] = []
    
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    )

    filtered.forEach(product => {
      if (product.variants && product.variants.length > 0) {
        product.variants.forEach(variant => {
          rows.push({
            type: 'variant',
            id: variant.id,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            stock: variant.stock,
            inventory: variant.inventory,
            product: product
          })
        })
      } else {
        rows.push({
          type: 'product',
          id: product.id,
          productName: product.name,
          variantName: null,
          sku: product.sku,
          stock: product.stock,
          inventory: product.inventory,
          product: product
        })
      }
    })
    
    return rows
  }, [products, searchQuery])

  const {
    currentItems: currentRows,
    currentPage,
    totalPages,
    itemsPerPage,
    goToPage,
    setCurrentPage,
    handleItemsPerPageChange,
  } = usePagination(allRows, 10)

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedWarehouse, setCurrentPage])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track stock levels across all locations</p>
        </div>
        <Link href="/dashboard/inventory/transfer">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
            <ArrowRightLeft className="w-4 h-4 mr-2" />
            Stock Transfer
            </Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by Name or SKU"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedWarehouse} onValueChange={setSelectedWarehouse}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Warehouses</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">SKU</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Total Stock</th>
                {warehouses.map(w => (
                     (selectedWarehouse === "all" || selectedWarehouse === w.id) && (
                        <th key={w.id} className="text-center py-3 px-4 text-xs font-semibold text-emerald-700 uppercase bg-emerald-50">
                            {w.name}
                        </th>
                     )
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                          <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                          {warehouses.map(w => (
                              (selectedWarehouse === "all" || selectedWarehouse === w.id) && (
                                  <td key={w.id} className="py-3 px-4"><Skeleton className="h-4 w-8 mx-auto" /></td>
                              )
                          ))}
                      </tr>
                  ))
              ) : (
                currentRows.map(row => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {row.type === 'variant' ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{row.productName}</span>
                          <span className="text-xs text-gray-500">{row.variantName}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">{row.productName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{row.sku}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{row.stock}</td>
                    {warehouses.map(w => {
                      if (selectedWarehouse !== "all" && selectedWarehouse !== w.id) return null;
                      
                      const inv = row.inventory?.find(i => i.warehouseId === w.id)
                      const qty = inv ? inv.quantity : (w.isDefault ? row.stock : 0)

                      return (
                        <td key={w.id} className="py-3 px-4 text-center text-sm text-gray-600">
                          {qty}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!isLoading && allRows.length === 0 && (
             <div className="text-center py-12">
               <p className="text-gray-500">No products found</p>
             </div>
        )}
      </Card>
      
      {!isLoading && (
        <PaginationControl
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            onItemsPerPageChange={handleItemsPerPageChange}
            totalItems={allRows.length}
        />
      )}
    </div>
  )
}