"use client"

import { useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { tailorApi, TailorFabric } from "@/lib/tailorApi"
import { vendorApi, VendorResponse } from "@/lib/vendorApi"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { toast } from "sonner"

const EMPTY: Partial<TailorFabric> = {
  name: "", fabricType: "", color: "", pattern: "",
  unit: "goj", purchasePrice: 0, sellingPrice: 0,
  stockQuantity: 0, vendorId: undefined, status: "active",
}

export default function TailorFabricsPage() {
  const { canRead, canWrite, canDelete } = useSaasAuth()
  const { formatCurrency } = useCompanySettings()
  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<TailorFabric>>(EMPTY)
  const [vendors, setVendors] = useState<VendorResponse[]>([])
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  if (!canRead("TailorFabrics")) return <AccessDenied />

  const load = () => {
    setLoading(true)
    tailorApi.getFabrics({ search, status: statusFilter === "all" ? undefined : statusFilter, limit: 100 })
      .then(r => setFabrics(r.data?.data?.data ?? []))
      .catch(() => toast.error("Failed to load fabrics"))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [search, statusFilter])

  useEffect(() => {
    vendorApi.getAll({ limit: 200 })
      .then(r => setVendors(r.data ?? []))
      .catch(() => {})
  }, [])

  const openNew  = () => { setEditing(EMPTY); setModalOpen(true) }
  const openEdit = (f: TailorFabric) => { setEditing(f); setModalOpen(true) }

  const handleSave = async () => {
    if (!editing.name) { toast.error("Fabric name required"); return }
    setSaving(true)
    try {
      if (editing.id) {
        await tailorApi.updateFabric(editing.id, editing)
        toast.success("Fabric updated")
      } else {
        await tailorApi.createFabric(editing)
        toast.success("Fabric created")
      }
      setModalOpen(false)
      load()
    } catch {
      toast.error("Failed to save fabric")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await tailorApi.deleteFabric(deleteId)
      toast.success("Fabric deleted")
      setDeleteId(null)
      load()
    } catch {
      toast.error("Failed to delete fabric")
    }
  }

  const set = (field: keyof TailorFabric, value: any) =>
    setEditing(prev => ({ ...prev, [field]: value }))

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Fabric Inventory</h1>
          <p className="text-sm text-gray-500">{fabrics.length} fabrics</p>
        </div>
        {canWrite("TailorFabrics") && (
          <Button className="bg-purple-600 hover:bg-purple-700 gap-2" onClick={openNew}>
            <Plus className="w-4 h-4" /> Add Fabric
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input placeholder="Search fabrics..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3">Fabric</th>
                <th className="px-4 py-3">Type / Color</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Buy Price</th>
                <th className="px-4 py-3">Sell Price</th>
                <th className="px-4 py-3">Vendor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="px-4 py-3"><Skeleton className="h-8" /></td></tr>
                ))
              ) : fabrics.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  No fabrics found
                </td></tr>
              ) : fabrics.map(f => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {f.imagePath ? (
                        <img src={f.imagePath} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 font-bold text-sm">
                          {f.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{f.name}</p>
                        {f.pattern && <p className="text-xs text-gray-400">{f.pattern}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{[f.fabricType, f.color].filter(Boolean).join(" / ")}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${(f.stockQuantity ?? 0) < 5 ? "text-red-600" : "text-gray-900"}`}>
                      {f.stockQuantity} {f.unit}
                    </span>
                    {(f.stockQuantity ?? 0) < 5 && <p className="text-xs text-red-500">Low stock</p>}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(f.purchasePrice ?? 0)}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(f.sellingPrice ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-500">{f.vendor?.name || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge className={f.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>
                      {f.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canWrite("TailorFabrics") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(f)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDelete("TailorFabrics") && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteId(f.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing.id ? "Edit Fabric" : "Add Fabric"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1">
                <Label>Fabric Name *</Label>
                <Input value={editing.name ?? ""} onChange={e => set("name", e.target.value)} placeholder="e.g. Premium Cotton" />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Input value={editing.fabricType ?? ""} onChange={e => set("fabricType", e.target.value)} placeholder="Cotton / Silk / Linen" />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <Input value={editing.color ?? ""} onChange={e => set("color", e.target.value)} placeholder="White / Red" />
              </div>
              <div className="space-y-1">
                <Label>Pattern / Design</Label>
                <Input value={editing.pattern ?? ""} onChange={e => set("pattern", e.target.value)} placeholder="Striped / Plain" />
              </div>
              <div className="space-y-1">
                <Label>Unit</Label>
                <Select value={editing.unit ?? "goj"} onValueChange={v => set("unit", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="goj">Goj</SelectItem>
                    <SelectItem value="gaj">Gaj</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Stock Quantity</Label>
                <Input type="number" value={editing.stockQuantity ?? 0} onChange={e => set("stockQuantity", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label>Purchase Price</Label>
                <Input type="number" value={editing.purchasePrice ?? 0} onChange={e => set("purchasePrice", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="space-y-1">
                <Label>Selling Price</Label>
                <Input type="number" value={editing.sellingPrice ?? 0} onChange={e => set("sellingPrice", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Vendor / Supplier</Label>
                <Select value={editing.vendorId?.toString() ?? ""} onValueChange={v => set("vendorId", v ? parseInt(v) : undefined)}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => (
                      <SelectItem key={v.id} value={v.id.toString()}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={editing.status ?? "active"} onValueChange={v => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editing.id ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fabric?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the fabric record.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
