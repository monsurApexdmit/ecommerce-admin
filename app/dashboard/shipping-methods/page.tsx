"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Truck,
  Package,
  Zap,
  Box,
  Globe,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  ArrowUpDown,
} from "lucide-react"
import shippingMethodApi, { type ShippingMethod, type ShippingMethodPayload } from "@/lib/shippingMethodApi"

const ICON_OPTIONS = [
  { value: "package",  label: "Package",  Icon: Package },
  { value: "truck",    label: "Truck",    Icon: Truck },
  { value: "zap",      label: "Zap",      Icon: Zap },
  { value: "box",      label: "Box",      Icon: Box },
  { value: "globe",    label: "Globe",    Icon: Globe },
]

function MethodIcon({ icon, className }: { icon: string | null; className?: string }) {
  const found = ICON_OPTIONS.find((o) => o.value === icon)
  const Icon = found?.Icon ?? Package
  return <Icon className={className} />
}

const emptyForm: ShippingMethodPayload = {
  name: "",
  description: "",
  price: 0,
  estimatedDays: "",
  icon: "package",
  isActive: true,
  sortOrder: 0,
}

export default function ShippingMethodsPage() {
  const { toast } = useToast()
  const [methods, setMethods] = useState<ShippingMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editing, setEditing] = useState<ShippingMethod | null>(null)
  const [form, setForm] = useState<ShippingMethodPayload>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setMethods(await shippingMethodApi.getAll())
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load shipping methods" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, sortOrder: methods.length + 1 })
    setDialogOpen(true)
  }

  const openEdit = (m: ShippingMethod) => {
    setEditing(m)
    setForm({
      name: m.name,
      description: m.description ?? "",
      price: m.price,
      estimatedDays: m.estimatedDays ?? "",
      icon: m.icon ?? "package",
      isActive: m.isActive,
      sortOrder: m.sortOrder,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Name is required" })
      return
    }
    if (form.price < 0) {
      toast({ variant: "destructive", title: "Error", description: "Price must be 0 or more" })
      return
    }
    try {
      setSaving(true)
      const payload = { ...form, price: Number(form.price), sortOrder: Number(form.sortOrder) }
      if (editing) {
        await shippingMethodApi.update(editing.id, payload)
        toast({ title: "Success", description: "Shipping method updated" })
      } else {
        await shippingMethodApi.create(payload)
        toast({ title: "Success", description: "Shipping method created" })
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to save" })
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: number) => {
    try {
      setTogglingId(id)
      await shippingMethodApi.toggle(id)
      await load()
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to toggle status" })
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      setDeletingId(id)
      await shippingMethodApi.delete(id)
      toast({ title: "Success", description: "Shipping method deleted" })
      setDeleteId(null)
      await load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to delete" })
    } finally {
      setDeletingId(null)
    }
  }

  const f = (key: keyof ShippingMethodPayload, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipping Methods</h1>
          <p className="text-gray-600 mt-1">Manage shipping options shown to customers at checkout</p>
        </div>
        <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Add Method
        </Button>
      </div>

      <Card className="p-6">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-6 w-16" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : methods.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">No shipping methods yet</p>
            <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Add First Method
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-[2rem_2.5rem_1fr_8rem_10rem_6rem_7rem] gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <span></span>
              <span>Icon</span>
              <span>Method</span>
              <span>Price</span>
              <span>Est. Delivery</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {methods.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[2rem_2.5rem_1fr_8rem_10rem_6rem_7rem] gap-4 items-center px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {/* Drag handle visual */}
                <GripVertical className="w-4 h-4 text-gray-300" />

                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.isActive ? "bg-emerald-50" : "bg-gray-100"}`}>
                  <MethodIcon icon={m.icon} className={`w-5 h-5 ${m.isActive ? "text-emerald-600" : "text-gray-400"}`} />
                </div>

                {/* Name + desc */}
                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${m.isActive ? "text-gray-900" : "text-gray-400"}`}>{m.name}</p>
                  {m.description && <p className="text-xs text-gray-500 truncate">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">Sort: {m.sortOrder}</p>
                </div>

                {/* Price */}
                <p className="font-bold text-gray-900">${m.price.toFixed(2)}</p>

                {/* Est. days */}
                <p className="text-sm text-gray-600">{m.estimatedDays ?? "—"}</p>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(m.id)}
                  disabled={togglingId === m.id}
                  className="flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {m.isActive ? (
                    <><ToggleRight className="w-6 h-6 text-emerald-500" /><span className="text-emerald-600">Active</span></>
                  ) : (
                    <><ToggleLeft className="w-6 h-6 text-gray-400" /><span className="text-gray-500">Inactive</span></>
                  )}
                </button>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(m)}>
                    <Edit2 className="w-4 h-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => setDeleteId(m.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Info card */}
      <Card className="p-4 bg-blue-50 border-blue-100">
        <div className="flex gap-3">
          <ArrowUpDown className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-800">Display Order</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Methods are displayed to customers ordered by <strong>Sort Order</strong> (lowest first). Set the sort order number when adding or editing a method.
            </p>
          </div>
        </div>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Shipping Method" : "Add Shipping Method"}</DialogTitle>
            <DialogDescription>
              Configure the shipping option shown to customers at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sm-name">Name *</Label>
              <Input
                id="sm-name"
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
                placeholder="Standard Shipping"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sm-desc">Description</Label>
              <Input
                id="sm-desc"
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                placeholder="Reliable delivery at the best price"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sm-price">Price ($) *</Label>
                <Input
                  id="sm-price"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={(e) => f("price", e.target.value)}
                  placeholder="5.99"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sm-sort">Sort Order</Label>
                <Input
                  id="sm-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => f("sortOrder", e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sm-days">Estimated Delivery</Label>
              <Input
                id="sm-days"
                value={form.estimatedDays}
                onChange={(e) => f("estimatedDays", e.target.value)}
                placeholder="5–7 Business Days"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={form.icon ?? "package"} onValueChange={(v) => f("icon", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map(({ value, label, Icon }) => (
                      <SelectItem key={value} value={value}>
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" /> {label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={form.isActive ? "active" : "inactive"}
                  onValueChange={(v) => f("isActive", v === "active")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Preview */}
            <div className="rounded-lg border p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <MethodIcon icon={form.icon ?? "package"} className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{form.name || "Method Name"}</p>
                  <p className="text-xs text-gray-500">{form.description || "Description"}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">${Number(form.price || 0).toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{form.estimatedDays || "Est. days"}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? "Saving..." : editing ? "Save Changes" : "Add Method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Shipping Method</DialogTitle>
            <DialogDescription>
              This will remove the method from checkout immediately. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deletingId !== null}
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              {deletingId !== null ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
