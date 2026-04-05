"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Search, ArrowRightLeft, Printer, QrCode, Package, Eye, AlertTriangle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { useWarehouse } from "@/contexts/warehouse-context"
import Link from "next/link"
import { PaginationControl } from "@/components/ui/pagination-control"
import { Skeleton } from "@/components/ui/skeleton"
import { inventoryApi, type InventoryItem } from "@/lib/inventoryApi"
import { StatsCards } from "@/components/ui/stats-card"
import productApi from "@/lib/productApi"

const ITEMS_PER_PAGE = 10

export default function InventoryPage() {
  const { warehouses } = useWarehouse()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [stats, setStats] = useState<{
    total: number
    published: number
    unpublished: number
  } | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>("all")
  const [isLoading, setIsLoading] = useState(true)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE)

  const rowKey = (item: InventoryItem) =>
    item.type === 'variant' ? `v-${item.id}` : `p-${item.id}`

  const fetchInventory = useCallback(async () => {
    try {
      setIsLoading(true)
      const params: Record<string, any> = {}
      if (searchQuery) params.search = searchQuery
      if (selectedWarehouse !== "all") params.warehouse_id = Number(selectedWarehouse)
      const res = await inventoryApi.getAll(params)
      setItems(res.data ?? [])
    } catch (err) {
      console.error("Failed to fetch inventory:", err)
    } finally {
      setIsLoading(false)
    }
  }, [searchQuery, selectedWarehouse])

  useEffect(() => {
    setCurrentPage(1)
    fetchInventory()
  }, [fetchInventory])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsLoading(true)
        const statsData = await productApi.getStats()
        setStats(statsData)
      } catch (err) {
        console.error("Failed to fetch product stats:", err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [])

  // Client-side pagination
  const totalItems = items.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return items.slice(start, start + itemsPerPage)
  }, [items, currentPage, itemsPerPage])

  const handleSelectRow = (key: string) => {
    const next = new Set(selectedRows)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelectedRows(next)
  }

  const handleSelectAll = () => setSelectedRows(new Set(currentRows.map(rowKey)))
  const handleDeselectAll = () => setSelectedRows(new Set())

  const handlePrintSelectedBarcodes = () => {
    const selected = items.filter(item => selectedRows.has(rowKey(item)))
    if (selected.length === 0) {
      alert("Please select at least one product to print")
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert("Please allow popups to print barcodes")
      return
    }

    const barcodeHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcodes</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
          <style>
            body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
            .barcode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 20px; }
            .barcode-item { border: 2px dashed #ccc; padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; aspect-ratio: 3/2; page-break-inside: avoid; }
            .product-name { font-weight: bold; font-size: 14px; margin-bottom: 8px; text-align: center; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .variant-name { font-size: 12px; color: #666; margin-bottom: 8px; }
            .sku { font-size: 12px; margin-top: 4px; }
            @media print { body { padding: 0; } .barcode-grid { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${selected.map((item, index) => `
              <div class="barcode-item">
                <div class="product-name">${item.productName}</div>
                ${item.variantName ? `<div class="variant-name">${item.variantName}</div>` : ''}
                <svg id="barcode-${index}"></svg>
                <div class="sku">${item.sku}</div>
              </div>
            `).join('')}
          </div>
          <script>
            window.onload = function() {
              ${selected.map((item, index) => `
                JsBarcode("#barcode-${index}", "${item.barcode || item.sku}", {
                  width: 1.5, height: 40, fontSize: 12, format: "CODE128"
                });
              `).join('\n')}
              setTimeout(() => { window.print(); }, 500);
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.write(barcodeHTML)
    printWindow.document.close()
  }

  const allOnPageSelected = currentRows.length > 0 && currentRows.every(item => selectedRows.has(rowKey(item)))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
          <p className="text-gray-600 mt-1">Track stock levels across all locations</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedRows.size > 0 && (
            <Button onClick={handlePrintSelectedBarcodes} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              Print Selected ({selectedRows.size})
            </Button>
          )}
          <Link href="/dashboard/inventory/transfer">
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Stock Transfer
            </Button>
          </Link>
        </div>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-8 w-12" />
            </Card>
          ))}
        </div>
      ) : stats ? (
        <StatsCards stats={[
          { label: "Total Products", value: stats.total, icon: <Package className="w-5 h-5" />, color: "blue" },
          { label: "Published", value: stats.published, icon: <Eye className="w-5 h-5" />, color: "green" },
          { label: "Unpublished", value: stats.unpublished, icon: <AlertTriangle className="w-5 h-5" />, color: "yellow" },
        ]} />
      ) : null}

      <Card className="p-6">
        <div className="flex items-center gap-4 mb-4">
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
                <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isLoading && currentRows.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleSelectAll}>Select All on Page</Button>
            <Button variant="outline" size="sm" onClick={handleDeselectAll}>Deselect All</Button>
            {selectedRows.size > 0 && (
              <span className="text-sm text-gray-600 ml-2">{selectedRows.size} item(s) selected</span>
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase w-12">
                  <Checkbox
                    checked={allOnPageSelected}
                    onCheckedChange={(checked) => checked ? handleSelectAll() : handleDeselectAll()}
                  />
                </th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Product</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-700 uppercase">SKU</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Total Stock</th>
                {warehouses.map(w =>
                  (selectedWarehouse === "all" || selectedWarehouse === String(w.id)) && (
                    <th key={w.id} className="text-center py-3 px-4 text-xs font-semibold text-emerald-700 uppercase bg-emerald-50">
                      {w.name}
                    </th>
                  )
                )}
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: itemsPerPage }).map((_, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4"><Skeleton className="h-4 w-4 mx-auto" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-12 mx-auto" /></td>
                    {warehouses.map(w =>
                      (selectedWarehouse === "all" || selectedWarehouse === String(w.id)) && (
                        <td key={w.id} className="py-3 px-4"><Skeleton className="h-4 w-8 mx-auto" /></td>
                      )
                    )}
                    <td className="py-3 px-4"><Skeleton className="h-4 w-8 mx-auto" /></td>
                  </tr>
                ))
              ) : currentRows.map(item => {
                const key = rowKey(item)
                return (
                  <tr key={key} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 text-center">
                      <Checkbox
                        checked={selectedRows.has(key)}
                        onCheckedChange={() => handleSelectRow(key)}
                      />
                    </td>
                    <td className="py-3 px-4">
                      {item.variantName ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{item.productName}</span>
                          <span className="text-xs text-gray-500">{item.variantName}</span>
                        </div>
                      ) : (
                        <span className="font-medium text-gray-900">{item.productName}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{item.sku}</td>
                    <td className="py-3 px-4 text-center font-bold text-gray-900">{item.stock}</td>
                    {warehouses.map(w => {
                      if (selectedWarehouse !== "all" && selectedWarehouse !== String(w.id)) return null
                      const loc = item.inventory?.find(inv => inv.locationId === w.id)
                      return (
                        <td key={w.id} className="py-3 px-4 text-center text-sm text-gray-600">
                          {loc ? loc.quantity : 0}
                        </td>
                      )
                    })}
                    <td className="py-3 px-4 text-center">
                      <Link href={`/dashboard/products/${item.productId}/barcode`}>
                        <Button variant="ghost" size="sm" title="Print Barcode">
                          <QrCode className="w-4 h-4 text-gray-600 hover:text-emerald-600" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {!isLoading && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No inventory found</p>
          </div>
        )}
      </Card>

      {!isLoading && (
        <PaginationControl
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1) }}
          totalItems={totalItems}
        />
      )}
    </div>
  )
}
