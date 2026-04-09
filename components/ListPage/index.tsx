"use client"

import type React from "react"
import { useState, useCallback, useMemo, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Search, Upload, Download, Edit2, Trash2, Plus, Loader2, FilePen } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { PaginationControl } from "@/components/ui/pagination-control"
import { StatusBadge } from "@/components/ui/status-badge"
import { Badge } from "@/components/ui/badge"
import { exportToCSV } from "@/lib/export-import-utils"

export interface Column {
  key: string
  label: string
  sortable?: boolean
  render?: (value: any, item: any) => React.ReactNode
  width?: string
}

export interface FilterOption {
  id: string
  label: string
  options: { value: string; label: string }[]
  value?: string
  onChange?: (value: string) => void
  predicate?: (item: any, value: string) => boolean
}

export interface SortOption {
  value: string
  label: string
  sortFn?: (a: any, b: any) => number
}

export interface BulkAction {
  id: string
  label: string
  icon?: React.ReactNode
  onExecute: (selectedIds: string[]) => Promise<void> | void
  confirmMessage?: string
}

export interface Action {
  id: string
  label: string
  icon: React.ReactNode
  onClick: (item: any) => void
  variant?: "default" | "destructive" | "outline"
  show?: (item: any) => boolean
  className?: string
}

export interface StatsCard {
  icon: React.ReactNode
  label: string
  value: string | number
  subtext?: string
}

export interface ListPageProps {
  // Core
  title: string
  description?: string
  data: any[]
  isLoading?: boolean
  columns: Column[]

  // Search & Filter
  searchPlaceholder?: string
  searchFields?: string[]
  filters?: FilterOption[]
  sortOptions?: SortOption[]
  sortValue?: string
  onSortChange?: (value: string) => void
  onSearch?: (query: string) => void
  onFilterChange?: () => void

  // Actions
  actions?: Action[]
  onAddClick?: () => void
  addButtonLabel?: string

  // Bulk Actions
  bulkActions?: BulkAction[]
  enableCheckboxes?: boolean

  // Import/Export
  onExport?: (data: any[]) => void
  onImport?: (callback: (data: any[]) => void) => void
  exportFileName?: string

  // Pagination
  pageSize?: number
  currentPage?: number
  totalItems?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void

  // Stats
  stats?: StatsCard[]
  statsLoading?: boolean

  // Customization
  emptyMessage?: string
  rowClassName?: (item: any) => string
}

export function ListPage({
  title,
  description,
  data,
  isLoading = false,
  columns,
  searchPlaceholder = "Search...",
  searchFields = [],
  filters = [],
  sortOptions = [],
  sortValue,
  onSortChange,
  onSearch,
  onFilterChange,
  actions = [],
  onAddClick,
  addButtonLabel = "Add",
  bulkActions = [],
  enableCheckboxes = false,
  onExport,
  onImport,
  exportFileName = "export",
  pageSize = 10,
  currentPage = 1,
  totalItems,
  onPageChange,
  onPageSizeChange,
  stats,
  statsLoading = false,
  emptyMessage = "No items found",
  rowClassName,
}: ListPageProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkActionDialog, setBulkActionDialog] = useState<{ open: boolean; action?: BulkAction; showSelector?: boolean }>({ open: false })
  const [bulkLoading, setBulkLoading] = useState(false)
  const [sortBy, setSortBy] = useState<string>(sortValue ?? (sortOptions[0]?.value || ""))
  const [importDialogOpen, setImportDialogOpen] = useState(false)

  // Initialize and sync localFilters with filter values
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map(f => [f.id, f.value || "all"]))
  )

  // Update localFilters when filter values change (from parent)
  useEffect(() => {
    const newFilters: Record<string, string> = {}
    filters.forEach(f => {
      newFilters[f.id] = f.value || "all"
    })
    setLocalFilters(newFilters)
  }, [filters])

  useEffect(() => {
    if (sortValue !== undefined) {
      setSortBy(sortValue)
    }
  }, [sortValue])

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }, [onSearch])

  // Handle filter change
  const handleFilterChange = (filterId: string, value: string) => {
    setLocalFilters(prev => ({ ...prev, [filterId]: value }))

    // Call the filter's onChange handler if it exists
    const filter = filters.find(f => f.id === filterId)
    if (filter && filter.onChange) {
      filter.onChange(value)
    }

    onFilterChange?.()
  }

  const handleSortChange = (value: string) => {
    setSortBy(value)
    onSortChange?.(value)
  }

  // Apply filters and sorting
  const filteredAndSortedData = useMemo(() => {
    let result = [...data]

    // Apply search
    if (searchQuery && searchFields.length > 0) {
      result = result.filter(item =>
        searchFields.some(field =>
          String(item[field]).toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    }

    // Apply filters - must match filter key in data
    Object.entries(localFilters).forEach(([filterId, filterValue]) => {
      if (filterValue === "all") return

      const filter = filters.find(f => f.id === filterId)
      if (!filter) return

      if (filter.predicate) {
        result = result.filter(item => filter.predicate?.(item, filterValue))
        return
      }

      // Find the data key to filter by
      // Try common patterns: filterId, filterId + 'Id', filter key name
      const possibleKeys = [
        filterId,
        filterId + 'Id',
        filterId + '_id',
        filters.find(f => f.id === filterId)?.id
      ]

      result = result.filter(item => {
        for (const key of possibleKeys) {
          if (item[key] === filterValue || String(item[key]) === filterValue) {
            return true
          }
        }
        return false
      })
    })

    // Apply sorting
    if (sortBy && sortBy !== "default" && sortOptions.length > 0) {
      const sortOption = sortOptions.find(s => s.value === sortBy)
      if (sortOption?.sortFn) {
        result.sort(sortOption.sortFn)
      }
    }

    return result
  }, [data, searchQuery, searchFields, localFilters, filters, sortBy, sortOptions])

  // Pagination
  const totalPages = Math.ceil((totalItems || filteredAndSortedData.length) / pageSize)
  const startIdx = (currentPage - 1) * pageSize
  const endIdx = startIdx + pageSize
  const currentData = filteredAndSortedData.slice(startIdx, endIdx)

  // Checkbox handlers
  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return
    setSelectedIds(checked ? currentData.map(item => item.id) : [])
  }

  const handleSelectItem = (id: string, checked: boolean | "indeterminate") => {
    if (checked === "indeterminate") return
    setSelectedIds(prev =>
      checked
        ? [...prev, id]
        : prev.filter(selectedId => selectedId !== id)
    )
  }

  const isAllSelected = currentData.length > 0 && currentData.every(item => selectedIds.includes(item.id))

  // Bulk action
  const handleBulkAction = async (action: BulkAction) => {
    if (!selectedIds.length) return
    setBulkActionDialog({ open: true, action })
  }

  const confirmBulkAction = async () => {
    if (!bulkActionDialog.action) return
    setBulkLoading(true)
    try {
      await bulkActionDialog.action.onExecute(selectedIds)
      setSelectedIds([])
      setBulkActionDialog({ open: false })
    } finally {
      setBulkLoading(false)
    }
  }

  // Export
  const handleExport = () => {
    if (onExport) {
      onExport(filteredAndSortedData)
    } else {
      exportToCSV(filteredAndSortedData, exportFileName)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          {description && <p className="text-gray-600 mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {onExport && (
            <Button onClick={handleExport} variant="outline" size="sm">
              <Download size={16} className="mr-2" />
              Export
            </Button>
          )}
          {onImport && (
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" size="sm">
              <Upload size={16} className="mr-2" />
              Import
            </Button>
          )}
          {enableCheckboxes && bulkActions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-orange-600 border-orange-200 bg-orange-50"
              onClick={() => {
                if (selectedIds.length === 0) return
                setBulkActionDialog({ open: true, showSelector: true })
              }}
              disabled={selectedIds.length === 0}
            >
              <FilePen size={16} className="mr-2" />
              Bulk Action
            </Button>
          )}
          {enableCheckboxes && bulkActions.find(a => a.id === "delete") && (
            <Button
              onClick={() => {
                if (selectedIds.length === 0) return
                const deleteAction = bulkActions.find(a => a.id === "delete")
                if (deleteAction) handleBulkAction(deleteAction)
              }}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-200"
              disabled={selectedIds.length === 0}
            >
              <Trash2 size={16} className="mr-2" />
              Delete
            </Button>
          )}
          {onAddClick && (
            <Button onClick={onAddClick} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Plus size={16} className="mr-2" />
              {addButtonLabel}
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, idx) => (
            <Card key={idx} className="p-4">
              {statsLoading ? (
                <Skeleton className="h-20" />
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-sm font-medium">{stat.label}</span>
                    <div className="text-emerald-600">{stat.icon}</div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  {stat.subtext && <p className="text-xs text-gray-500">{stat.subtext}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <Card className="p-4 lg:p-6">
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" size={18} />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              className="pl-10 h-10"
            />
          </div>

          {/* Filters & Sort */}
          {(filters.length > 0 || sortOptions.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => (
                <Select
                  key={filter.id}
                  value={filter.value || "all"}
                  onValueChange={value => handleFilterChange(filter.id, value)}
                >
                  <SelectTrigger className="w-[140px] h-10">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {filter.label}</SelectItem>
                    {filter.options.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}

              {sortOptions.length > 0 && (
                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-[160px] h-10">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Data Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : currentData.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">{emptyMessage}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  {enableCheckboxes && (
                    <th className="px-4 py-3 w-12 whitespace-nowrap">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                  )}
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap ${col.width || "min-w-[150px]"}`}
                    >
                      {col.label}
                    </th>
                  ))}
                  {actions.length > 0 && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 w-20 whitespace-nowrap sticky right-0 bg-gray-50">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {currentData.map(item => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 transition-colors ${rowClassName?.(item) || ""}`}
                  >
                    {enableCheckboxes && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked)}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={`${item.id}-${col.key}`} className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                        {col.render ? col.render(item[col.key], item) : item[col.key]}
                      </td>
                    ))}
                    {actions.length > 0 && (
                      <td className="px-4 py-3 sticky right-0 bg-white">
                        <div className="flex gap-1 justify-center">
                          {actions
                            .filter(a => !a.show || a.show(item))
                            .map(action => (
                              <Button
                                key={action.id}
                                onClick={() => action.onClick(item)}
                                variant={action.variant || "ghost"}
                                size="sm"
                                title={action.label}
                                className={action.className}
                              >
                                {action.icon}
                              </Button>
                            ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {!isLoading && currentData.length > 0 && (
        <PaginationControl
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={pageSize}
          totalItems={totalItems || filteredAndSortedData.length}
          onPageChange={onPageChange || (() => {})}
          onItemsPerPageChange={onPageSizeChange || (() => {})}
        />
      )}

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import {title}</DialogTitle>
            <DialogDescription>Upload a CSV file to import {title.toLowerCase()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">CSV File</label>
              <Input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && onImport) {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      const text = event.target?.result as string
                      const lines = text.split("\n")
                      const headers = lines[0].split(",")
                      const data = lines.slice(1).map(line => {
                        const values = line.split(",")
                        return Object.fromEntries(
                          headers.map((header, i) => [header.trim(), values[i]?.trim() || ""])
                        )
                      })
                      onImport((importedData) => importedData)
                      setImportDialogOpen(false)
                    }
                    reader.readAsText(file)
                  }
                }}
              />
              <p className="text-sm text-gray-500">
                Upload a CSV file with the required columns
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setImportDialogOpen(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Selection Dialog */}
      <Dialog open={bulkActionDialog.open && bulkActionDialog.showSelector} onOpenChange={open => setBulkActionDialog({ open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
            <DialogDescription>
              Apply actions to {selectedIds.length} selected item{selectedIds.length !== 1 ? "s" : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Select Action</label>
              <Select
                onValueChange={(actionId) => {
                  const action = bulkActions.find(a => a.id === actionId)
                  if (action) {
                    setBulkActionDialog({ open: true, action })
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an action..." />
                </SelectTrigger>
                <SelectContent>
                  {bulkActions.map(action => (
                    <SelectItem key={action.id} value={action.id}>
                      {action.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkActionDialog({ open: false })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={bulkActionDialog.open && !!bulkActionDialog.action} onOpenChange={open => setBulkActionDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm {bulkActionDialog.action?.label}</DialogTitle>
            <DialogDescription>
              {bulkActionDialog.action?.confirmMessage ||
                `Are you sure you want to ${bulkActionDialog.action?.label.toLowerCase()} ${selectedIds.length} item${selectedIds.length !== 1 ? "s" : ""}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkActionDialog({ open: false })}
              disabled={bulkLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmBulkAction}
              disabled={bulkLoading}
              variant={bulkActionDialog.action?.id === "delete" ? "destructive" : "default"}
            >
              {bulkLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Confirm ${bulkActionDialog.action?.label}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
