"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Download, Upload, Edit, Trash2, Eye, Plus, FilePen } from "lucide-react"
import { exportToCSV, parseCSV, generateId } from "@/lib/export-import-utils"

interface Category {
  id: string
  icon: string
  name: string
  description: string
  published: boolean
}

const initialCategories: Category[] = [
  {
    id: "0C24",
    icon: "🐟",
    name: "Fish & Meat",
    description: "Fish & Meat",
    published: false,
  },
  {
    id: "0BE8",
    icon: "🥬",
    name: "Fruits & Vegetable",
    description: "Fruits & Vegetable",
    published: true,
  },
  {
    id: "0BC4",
    icon: "🫐",
    name: "Cooking Essentials",
    description: "Cooking Essentials",
    published: true,
  },
  {
    id: "0BA0",
    icon: "🍪",
    name: "Biscuits & Cakes",
    description: "Biscuits & Cakes",
    published: true,
  },
  {
    id: "0B49",
    icon: "🧃",
    name: "Household Tools",
    description: "Household Tools",
    published: true,
  },
  {
    id: "0B0E",
    icon: "🐱",
    name: "Pet Care",
    description: "Pet Care",
    published: true,
  },
  {
    id: "0A8A",
    icon: "💆",
    name: "Beauty & Healths",
    description: "Beauty & Healths",
    published: true,
  },
  {
    id: "0A6A",
    icon: "🍓",
    name: "Jam & Jelly",
    description: "Jam & Jelly",
    published: true,
  },
  {
    id: "0A29",
    icon: "🥛",
    name: "Milk & Dairy",
    description: "Milk & Dairy",
    published: true,
  },
  {
    id: "09C1",
    icon: "🧋",
    name: "Drinks",
    description: "Drinks",
    published: true,
  },
  {
    id: "0945",
    icon: "🍊",
    name: "Breakfast",
    description: "Breakfast",
    published: true,
  },
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [parentsOnly, setParentsOnly] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [formData, setFormData] = useState({
    icon: "",
    name: "",
    description: "",
    published: true,
  })
  const [isBulkActionDialogOpen, setIsBulkActionDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState("")

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredCategories.map((c) => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id])
    } else {
      setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
    }
  }

  const togglePublished = (id: string) => {
    setCategories(categories.map((c) => (c.id === id ? { ...c, published: !c.published } : c)))
  }

  const handleAdd = () => {
    if (!formData.name) return

    const newCategory: Category = {
      id: Math.random().toString(36).substring(2, 6).toUpperCase(),
      icon: formData.icon || "📦",
      name: formData.name,
      description: formData.description,
      published: formData.published,
    }

    setCategories([...categories, newCategory])
    closeDialog()
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      icon: category.icon,
      name: category.name,
      description: category.description,
      published: category.published,
    })
    setIsDialogOpen(true)
  }

  const handleUpdate = () => {
    if (!editingCategory || !formData.name) return

    const updatedCategories = categories.map((c) =>
      c.id === editingCategory.id
        ? {
            ...c,
            icon: formData.icon,
            name: formData.name,
            description: formData.description,
            published: formData.published,
          }
        : c,
    )

    setCategories(updatedCategories)
    closeDialog()
  }

  const handleDelete = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id))
    setSelectedIds(selectedIds.filter((selectedId) => selectedId !== id))
  }

  const handleBulkDelete = () => {
    setCategories(categories.filter((c) => !selectedIds.includes(c.id)))
    setSelectedIds([])
  }

  const handleExport = () => {
    const exportData = filteredCategories.map((category) => ({
      id: category.id,
      icon: category.icon,
      name: category.name,
      description: category.description,
      published: category.published ? "Yes" : "No",
    }))

    const headers = ["ID", "Icon", "Name", "Description", "Published"]
    exportToCSV(exportData, "categories", headers)
  }

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const importedData = parseCSV(text)

      const newCategories = importedData.map((item) => ({
        id: item.id || generateId(),
        icon: item.icon || "📦",
        name: item.name,
        description: item.description,
        published: item.published === "Yes",
      }))

      setCategories([...categories, ...newCategories])
      setIsImportDialogOpen(false)
    }
    reader.readAsText(file)
  }

  const handleBulkAction = () => {
    if (!bulkAction || selectedIds.length === 0) return

    if (bulkAction === "delete") {
      handleBulkDelete()
    } else if (bulkAction === "publish") {
      setCategories(categories.map((c) => (selectedIds.includes(c.id) ? { ...c, published: true } : c)))
      setSelectedIds([])
    } else if (bulkAction === "unpublish") {
      setCategories(categories.map((c) => (selectedIds.includes(c.id) ? { ...c, published: false } : c)))
      setSelectedIds([])
    }

    setIsBulkActionDialogOpen(false)
    setBulkAction("")
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setEditingCategory(null)
    setFormData({ icon: "", name: "", description: "", published: true })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Category</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-gray-700 bg-transparent" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-gray-700 bg-transparent"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-orange-600 border-orange-200 bg-orange-50"
            disabled={selectedIds.length === 0}
            onClick={() => setIsBulkActionDialogOpen(true)}
          >
            <FilePen className="w-4 h-4 mr-2" />
            Bulk Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:bg-red-50 bg-transparent"
            disabled={selectedIds.length === 0}
            onClick={handleBulkDelete}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600" onClick={() => setIsDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Category
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by Category name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button className="bg-emerald-500 hover:bg-emerald-600">Filter</Button>
          <Button variant="outline">Reset</Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={parentsOnly}
              onCheckedChange={setParentsOnly}
              className="data-[state=checked]:bg-emerald-500"
            />
            <span className="text-sm font-medium">Parents Only</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredCategories.length && filteredCategories.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="text-left p-3 font-semibold text-gray-700">ID</th>
                <th className="text-left p-3 font-semibold text-gray-700">ICON</th>
                <th className="text-left p-3 font-semibold text-gray-700">NAME</th>
                <th className="text-left p-3 font-semibold text-gray-700">DESCRIPTION</th>
                <th className="text-left p-3 font-semibold text-gray-700">PUBLISHED</th>
                <th className="text-left p-3 font-semibold text-gray-700">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((category) => (
                <tr key={category.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(category.id)}
                      onChange={(e) => handleSelectOne(category.id, e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="p-3 text-gray-600">{category.id}</td>
                  <td className="p-3">
                    <div className="w-10 h-10 flex items-center justify-center text-2xl">{category.icon}</div>
                  </td>
                  <td className="p-3 text-gray-900">{category.name}</td>
                  <td className="p-3 text-gray-600">{category.description}</td>
                  <td className="p-3">
                    <Switch
                      checked={category.published}
                      onCheckedChange={() => togglePublished(category.id)}
                      className="data-[state=checked]:bg-emerald-500"
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button className="text-gray-500 hover:text-gray-700">
                        <Eye className="w-5 h-5" />
                      </button>
                      <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEdit(category)}>
                        <Edit className="w-5 h-5" />
                      </button>
                      <button className="text-gray-500 hover:text-red-600" onClick={() => handleDelete(category.id)}>
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No categories found</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add New Category"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="icon">Icon (Emoji)</Label>
              <Input
                id="icon"
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="Enter emoji icon (e.g., 🍎)"
                maxLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Category Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter category name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter category description"
                rows={3}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.published}
                onCheckedChange={(checked) => setFormData({ ...formData, published: checked })}
                className="data-[state=checked]:bg-emerald-500"
              />
              <Label>Published</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={editingCategory ? handleUpdate : handleAdd}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingCategory ? "Update" : "Add"} Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleImport} />
              <p className="text-sm text-gray-500">
                Upload a CSV file with columns: ID, Icon, Name, Description, Published
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkActionDialogOpen} onOpenChange={setIsBulkActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Actions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Action Type</Label>
              <Select value={bulkAction} onValueChange={setBulkAction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Publish</SelectItem>
                  <SelectItem value="unpublish">Unpublish</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAction} className="bg-emerald-600 hover:bg-emerald-700" disabled={!bulkAction}>
              Apply Action
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
