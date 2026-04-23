"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Banknote,
  Landmark,
  CreditCard,
  Wallet,
  QrCode,
  Smartphone,
  Plus,
  Edit2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  GripVertical,
  ArrowUpDown,
} from "lucide-react"
import paymentMethodApi, { type PaymentMethod, type PaymentMethodPayload } from "@/lib/paymentMethodApi"

const ICON_OPTIONS = [
  { value: "banknote",    label: "Banknote (Cash)",   Icon: Banknote },
  { value: "landmark",    label: "Landmark (Bank)",   Icon: Landmark },
  { value: "credit-card", label: "Credit Card",       Icon: CreditCard },
  { value: "wallet",      label: "Wallet",             Icon: Wallet },
  { value: "qr-code",    label: "QR Code",            Icon: QrCode },
  { value: "smartphone",  label: "Mobile Pay",         Icon: Smartphone },
]

function MethodIcon({ icon, className }: { icon: string | null; className?: string }) {
  const found = ICON_OPTIONS.find((o) => o.value === icon)
  const Icon = found?.Icon ?? CreditCard
  return <Icon className={className} />
}

const emptyForm: PaymentMethodPayload = {
  name: "",
  description: "",
  icon: "banknote",
  isActive: true,
  sortOrder: 0,
}

export default function PaymentMethodsPage() {
  const { toast } = useToast()
  const [methods, setMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editing, setEditing] = useState<PaymentMethod | null>(null)
  const [form, setForm] = useState<PaymentMethodPayload>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setMethods(await paymentMethodApi.getAll())
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load payment methods" })
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

  const openEdit = (m: PaymentMethod) => {
    setEditing(m)
    setForm({
      name: m.name,
      description: m.description ?? "",
      icon: m.icon ?? "banknote",
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
    try {
      setSaving(true)
      const payload = { ...form, sortOrder: Number(form.sortOrder) }
      if (editing) {
        await paymentMethodApi.update(editing.id, payload)
        toast({ title: "Success", description: "Payment method updated" })
      } else {
        await paymentMethodApi.create(payload)
        toast({ title: "Success", description: "Payment method created" })
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
      await paymentMethodApi.toggle(id)
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
      await paymentMethodApi.delete(id)
      toast({ title: "Success", description: "Payment method deleted" })
      setDeleteId(null)
      await load()
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err?.response?.data?.message || "Failed to delete" })
    } finally {
      setDeletingId(null)
    }
  }

  const f = (key: keyof PaymentMethodPayload, val: any) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-600 mt-1">Manage payment options shown to customers at checkout</p>
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
            <CreditCard className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 mb-4">No payment methods yet</p>
            <Button onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Add First Method
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[2rem_2.5rem_1fr_10rem_6rem_7rem] gap-4 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              <span></span>
              <span>Icon</span>
              <span>Method</span>
              <span>Sort Order</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {methods.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-[2rem_2.5rem_1fr_10rem_6rem_7rem] gap-4 items-center px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <GripVertical className="w-4 h-4 text-gray-300" />

                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.isActive ? "bg-emerald-50" : "bg-gray-100"}`}>
                  <MethodIcon icon={m.icon} className={`w-5 h-5 ${m.isActive ? "text-emerald-600" : "text-gray-400"}`} />
                </div>

                <div className="min-w-0">
                  <p className={`font-semibold text-sm ${m.isActive ? "text-gray-900" : "text-gray-400"}`}>{m.name}</p>
                  {m.description && <p className="text-xs text-gray-500 truncate">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">Sort: {m.sortOrder}</p>
                </div>

                <p className="text-sm text-gray-500">#{m.sortOrder}</p>

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
            <DialogTitle>{editing ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
            <DialogDescription>
              Configure the payment option shown to customers at checkout.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Name *</Label>
              <Input
                id="pm-name"
                value={form.name}
                onChange={(e) => f("name", e.target.value)}
                placeholder="Cash on Delivery"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-desc">Description</Label>
              <Input
                id="pm-desc"
                value={form.description}
                onChange={(e) => f("description", e.target.value)}
                placeholder="Pay when your order arrives"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={form.icon ?? "banknote"} onValueChange={(v) => f("icon", v)}>
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
                <Label htmlFor="pm-sort">Sort Order</Label>
                <Input
                  id="pm-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) => f("sortOrder", e.target.value)}
                  placeholder="1"
                />
              </div>
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

            {/* Preview */}
            <div className="rounded-lg border p-4 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <MethodIcon icon={form.icon ?? "banknote"} className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{form.name || "Method Name"}</p>
                  <p className="text-xs text-gray-500">{form.description || "Description"}</p>
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
            <DialogTitle>Delete Payment Method</DialogTitle>
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
