"use client"

import { useEffect, useState, useCallback } from "react"
import { Search, Plus, ChevronDown, ChevronUp, Edit2, Ruler } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  tailorApi, TailorCustomer, TailorMeasurement, PRODUCT_TYPES,
} from "@/lib/tailorApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { toast } from "sonner"

const EMPTY_FORM = {
  product_type: "",
  chest: "", waist: "", hip: "", shoulder: "", sleeve: "",
  length: "", neck: "", bottom_length: "", inseam: "",
  pajama_waist: "", pajama_length: "", notes: "", measured_at: "",
}

type MeasurementForm = typeof EMPTY_FORM

function toPayload(f: MeasurementForm, customerId: number) {
  const num = (v: string) => v !== "" ? parseFloat(v) : undefined
  return {
    customer_id:   customerId,
    product_type:  f.product_type,
    chest:         num(f.chest),
    waist:         num(f.waist),
    hip:           num(f.hip),
    shoulder:      num(f.shoulder),
    sleeve:        num(f.sleeve),
    length:        num(f.length),
    neck:          num(f.neck),
    bottom_length: num(f.bottom_length),
    inseam:        num(f.inseam),
    pajama_waist:  num(f.pajama_waist),
    pajama_length: num(f.pajama_length),
    notes:         f.notes || undefined,
    measured_at:   f.measured_at || undefined,
  }
}

function MeasurementSummary({ m }: { m: TailorMeasurement }) {
  const parts: string[] = []
  if (m.chest) parts.push(`Chest: ${m.chest}`)
  if (m.waist) parts.push(`Waist: ${m.waist}`)
  if (m.shoulder) parts.push(`Shldr: ${m.shoulder}`)
  return <span className="text-gray-400">{parts.slice(0, 3).join(" · ") || "No key measurements"}</span>
}

export default function TailorMeasurementsPage() {
  const { canRead, canWrite } = useSaasAuth()

  const [customers, setCustomers] = useState<TailorCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [customerMeasurements, setCustomerMeasurements] = useState<Record<number, TailorMeasurement[]>>({})
  const [loadingMeasurements, setLoadingMeasurements] = useState<Record<number, boolean>>({})

  const [modalOpen, setModalOpen] = useState(false)
  const [editingMeasurement, setEditingMeasurement] = useState<TailorMeasurement | null>(null)
  const [modalCustomerId, setModalCustomerId] = useState<number | null>(null)
  const [form, setForm] = useState<MeasurementForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  if (!canRead("TailorMeasurements")) return <AccessDenied />

  useEffect(() => {
    tailorApi.getCustomers({ limit: 200 })
      .then(r => setCustomers(r.data?.data ?? r.data ?? []))
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false))
  }, [])

  const loadMeasurements = useCallback((customerId: number) => {
    if (customerMeasurements[customerId]) return
    setLoadingMeasurements(prev => ({ ...prev, [customerId]: true }))
    tailorApi.getMeasurementsByCustomer(customerId)
      .then(r => {
        const list: TailorMeasurement[] = r.data?.data ?? r.data ?? []
        setCustomerMeasurements(prev => ({ ...prev, [customerId]: list }))
      })
      .catch(() => toast.error("Failed to load measurements"))
      .finally(() => setLoadingMeasurements(prev => ({ ...prev, [customerId]: false })))
  }, [customerMeasurements])

  const toggleCustomer = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      loadMeasurements(id)
    }
  }

  const reloadMeasurements = (customerId: number) => {
    setCustomerMeasurements(prev => {
      const next = { ...prev }
      delete next[customerId]
      return next
    })
    loadMeasurements(customerId)
  }

  const openAdd = (customerId: number) => {
    setEditingMeasurement(null)
    setModalCustomerId(customerId)
    setForm({ ...EMPTY_FORM, measured_at: new Date().toISOString().split("T")[0] })
    setModalOpen(true)
  }

  const openEdit = (m: TailorMeasurement) => {
    setEditingMeasurement(m)
    setModalCustomerId(m.customerId)
    setForm({
      product_type: m.productType,
      chest: m.chest != null ? String(m.chest) : "",
      waist: m.waist != null ? String(m.waist) : "",
      hip: m.hip != null ? String(m.hip) : "",
      shoulder: m.shoulder != null ? String(m.shoulder) : "",
      sleeve: m.sleeve != null ? String(m.sleeve) : "",
      length: m.length != null ? String(m.length) : "",
      neck: m.neck != null ? String(m.neck) : "",
      bottom_length: m.bottomLength != null ? String(m.bottomLength) : "",
      inseam: m.inseam != null ? String(m.inseam) : "",
      pajama_waist: m.pajamaWaist != null ? String(m.pajamaWaist) : "",
      pajama_length: m.pajamaLength != null ? String(m.pajamaLength) : "",
      notes: m.notes ?? "",
      measured_at: m.measuredAt ? m.measuredAt.split("T")[0] : "",
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.product_type) { toast.error("Product type required"); return }
    if (!modalCustomerId) return
    setSaving(true)
    try {
      const payload = toPayload(form, modalCustomerId)
      if (editingMeasurement) {
        await tailorApi.updateMeasurement(editingMeasurement.id, payload)
        toast.success("Measurement updated")
      } else {
        await tailorApi.createMeasurement(payload)
        toast.success("Measurement added")
      }
      setModalOpen(false)
      reloadMeasurements(modalCustomerId)
    } catch {
      toast.error("Failed to save measurement")
    } finally {
      setSaving(false)
    }
  }

  const setField = (k: keyof MeasurementForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  const todayStr = new Date().toISOString().split("T")[0]

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Measurements</h1>
          <p className="text-sm text-gray-500">{customers.length} customers</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search by name or phone..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <Card className="overflow-hidden divide-y divide-gray-100">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3"><Skeleton className="h-8" /></div>
          ))
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Ruler className="w-10 h-10 mx-auto mb-2 text-gray-200" />
            <p className="text-gray-400">No customers found</p>
          </div>
        ) : filtered.map(customer => {
          const isOpen = expandedId === customer.id
          const measurements = customerMeasurements[customer.id] ?? []
          const isLoadingM = loadingMeasurements[customer.id] ?? false

          return (
            <div key={customer.id}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                onClick={() => toggleCustomer(customer.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{customer.name}</p>
                    <p className="text-xs text-gray-400">{customer.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isOpen && customerMeasurements[customer.id] && (
                    <Badge className="bg-purple-100 text-purple-700">{measurements.length} measurement{measurements.length !== 1 ? "s" : ""}</Badge>
                  )}
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="bg-gray-50 border-t px-4 py-4 space-y-3">
                  {isLoadingM ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12" />
                      <Skeleton className="h-12" />
                    </div>
                  ) : (
                    <>
                      {measurements.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">No measurements recorded for this customer.</p>
                      ) : (
                        <div className="space-y-2">
                          {measurements.map(m => (
                            <div key={m.id} className="flex items-center justify-between bg-white border rounded-lg px-3 py-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-800">{m.productType}</span>
                                  <span className="text-xs text-gray-400">{new Date(m.measuredAt).toLocaleDateString()}</span>
                                </div>
                                <p className="text-xs mt-0.5 truncate"><MeasurementSummary m={m} /></p>
                              </div>
                              {canWrite("TailorMeasurements") && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0 ml-2"
                                  onClick={() => openEdit(m)}
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {canWrite("TailorMeasurements") && (
                        <Button
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-700 gap-1.5"
                          onClick={() => openAdd(customer.id)}
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Measurement
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </Card>

      {/* ── MEASUREMENT MODAL ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingMeasurement ? "Edit Measurement" : "Add Measurement"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Product Type *</Label>
                <Select value={form.product_type} onValueChange={v => setField("product_type", v)}>
                  <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Chest</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.chest} onChange={e => setField("chest", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Waist</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.waist} onChange={e => setField("waist", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Hip</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.hip} onChange={e => setField("hip", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Shoulder</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.shoulder} onChange={e => setField("shoulder", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Sleeve</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.sleeve} onChange={e => setField("sleeve", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Length</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.length} onChange={e => setField("length", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Neck</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.neck} onChange={e => setField("neck", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Bottom Length</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.bottom_length} onChange={e => setField("bottom_length", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Inseam</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.inseam} onChange={e => setField("inseam", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Pajama Waist</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.pajama_waist} onChange={e => setField("pajama_waist", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs text-gray-600 mb-1 block">Pajama Length</Label>
                <Input type="number" min={0} step="0.5" placeholder="cm/inch" value={form.pajama_length} onChange={e => setField("pajama_length", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Measured At</Label>
                <Input type="date" max={todayStr} value={form.measured_at} onChange={e => setField("measured_at", e.target.value)} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-gray-600 mb-1 block">Notes</Label>
                <Input placeholder="Any additional notes..." value={form.notes} onChange={e => setField("notes", e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button className="bg-purple-600 hover:bg-purple-700" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingMeasurement ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
