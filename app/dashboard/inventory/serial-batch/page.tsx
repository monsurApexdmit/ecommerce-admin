"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  serialBatchApi,
  type ProductSerial,
  type ProductBatch,
  type SerialBatchStats,
} from "@/lib/serialBatchApi"
import { productApi } from "@/lib/productApi"
import { Hash, Layers, Plus, Trash2, RefreshCw, AlertTriangle, CheckCircle, Clock } from "lucide-react"

function StatCard({ label, value, sub, color = "gray" }: { label: string; value: number; sub?: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-50 border-gray-200",
    green: "bg-emerald-50 border-emerald-200",
    orange: "bg-orange-50 border-orange-200",
    red: "bg-red-50 border-red-200",
    blue: "bg-blue-50 border-blue-200",
  }
  return (
    <div className={`rounded-lg border p-4 ${colors[color]}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function statusBadge(status: ProductSerial["status"]) {
  const map: Record<string, { label: string; class: string }> = {
    available: { label: "Available", class: "bg-emerald-100 text-emerald-800" },
    sold:      { label: "Sold",      class: "bg-gray-100 text-gray-700" },
    returned:  { label: "Returned",  class: "bg-blue-100 text-blue-800" },
    damaged:   { label: "Damaged",   class: "bg-red-100 text-red-800" },
  }
  const s = map[status] || { label: status, class: "bg-gray-100 text-gray-600" }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.class}`}>{s.label}</span>
}

export default function SerialBatchPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("serials")
  const [stats, setStats] = useState<SerialBatchStats | null>(null)

  // Serials state
  const [serials, setSerials] = useState<ProductSerial[]>([])
  const [serialsTotal, setSerialsTotal] = useState(0)
  const [serialsPage, setSerialsPage] = useState(1)
  const [serialSearch, setSerialSearch] = useState("")
  const [serialStatus, setSerialStatus] = useState("")
  const [serialsLoading, setSerialsLoading] = useState(false)

  // Batches state
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [batchesTotal, setBatchesTotal] = useState(0)
  const [batchesPage, setBatchesPage] = useState(1)
  const [batchSearch, setBatchSearch] = useState("")
  const [batchesLoading, setBatchesLoading] = useState(false)

  // Add serial modal
  const [addSerialOpen, setAddSerialOpen] = useState(false)
  const [serialForm, setSerialForm] = useState({
    productId: "",
    locationId: "",
    purchaseOrderNumber: "",
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
    bulkInput: "", // one serial per line
  })
  const [serialSaving, setSerialSaving] = useState(false)

  // Add batch modal
  const [addBatchOpen, setAddBatchOpen] = useState(false)
  const [batchForm, setBatchForm] = useState({
    productId: "",
    locationId: "",
    batchNumber: "",
    quantityReceived: "",
    manufactureDate: "",
    expiryDate: "",
    purchaseOrderNumber: "",
    receivedDate: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [batchSaving, setBatchSaving] = useState(false)

  // Products for selects
  const [products, setProducts] = useState<any[]>([])

  const loadStats = useCallback(async () => {
    try { setStats(await serialBatchApi.getStats()) } catch {}
  }, [])

  const loadSerials = useCallback(async () => {
    setSerialsLoading(true)
    try {
      const res = await serialBatchApi.getSerials({
        search: serialSearch || undefined,
        status: serialStatus || undefined,
        page: serialsPage,
      })
      setSerials(res.data)
      setSerialsTotal(res.total)
    } catch { toast({ title: "Failed to load serials", variant: "destructive" }) }
    finally { setSerialsLoading(false) }
  }, [serialSearch, serialStatus, serialsPage, toast])

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true)
    try {
      const res = await serialBatchApi.getBatches({
        search: batchSearch || undefined,
        page: batchesPage,
      })
      setBatches(res.data)
      setBatchesTotal(res.total)
    } catch { toast({ title: "Failed to load batches", variant: "destructive" }) }
    finally { setBatchesLoading(false) }
  }, [batchSearch, batchesPage, toast])

  useEffect(() => {
    loadStats()
    productApi.getAll({ limit: 200 }).then(r => setProducts(r.data || [])).catch(() => {})
  }, [loadStats])

  useEffect(() => { if (tab === "serials") loadSerials() }, [tab, loadSerials])
  useEffect(() => { if (tab === "batches") loadBatches() }, [tab, loadBatches])

  const handleAddSerials = async () => {
    const lines = serialForm.bulkInput.split("\n").map(l => l.trim()).filter(Boolean)
    if (!serialForm.productId || lines.length === 0) return
    setSerialSaving(true)
    try {
      await serialBatchApi.createSerials({
        productId: parseInt(serialForm.productId),
        locationId: serialForm.locationId ? parseInt(serialForm.locationId) : undefined,
        serials: lines.map(sn => ({
          serialNumber: sn,
          purchaseOrderNumber: serialForm.purchaseOrderNumber || undefined,
          receivedDate: serialForm.receivedDate || undefined,
          notes: serialForm.notes || undefined,
        })),
      })
      toast({ title: `${lines.length} serial(s) added` })
      setAddSerialOpen(false)
      setSerialForm({ productId: "", locationId: "", purchaseOrderNumber: "", receivedDate: new Date().toISOString().split("T")[0], notes: "", bulkInput: "" })
      loadSerials()
      loadStats()
    } catch (e: any) {
      toast({ title: e?.response?.data?.message || "Failed to add serials", variant: "destructive" })
    } finally { setSerialSaving(false) }
  }

  const handleDeleteSerial = async (id: number) => {
    try {
      await serialBatchApi.deleteSerial(id)
      toast({ title: "Serial deleted" })
      loadSerials(); loadStats()
    } catch (e: any) {
      toast({ title: e?.response?.data?.message || "Cannot delete serial", variant: "destructive" })
    }
  }

  const handleAddBatch = async () => {
    if (!batchForm.productId || !batchForm.batchNumber || !batchForm.quantityReceived) return
    setBatchSaving(true)
    try {
      await serialBatchApi.createBatch({
        productId: parseInt(batchForm.productId),
        locationId: batchForm.locationId ? parseInt(batchForm.locationId) : undefined,
        batchNumber: batchForm.batchNumber,
        quantityReceived: parseInt(batchForm.quantityReceived),
        manufactureDate: batchForm.manufactureDate || undefined,
        expiryDate: batchForm.expiryDate || undefined,
        purchaseOrderNumber: batchForm.purchaseOrderNumber || undefined,
        receivedDate: batchForm.receivedDate || undefined,
        notes: batchForm.notes || undefined,
      })
      toast({ title: "Batch created" })
      setAddBatchOpen(false)
      setBatchForm({ productId: "", locationId: "", batchNumber: "", quantityReceived: "", manufactureDate: "", expiryDate: "", purchaseOrderNumber: "", receivedDate: new Date().toISOString().split("T")[0], notes: "" })
      loadBatches(); loadStats()
    } catch (e: any) {
      toast({ title: e?.response?.data?.message || "Failed to create batch", variant: "destructive" })
    } finally { setBatchSaving(false) }
  }

  const handleDeleteBatch = async (id: number) => {
    try {
      await serialBatchApi.deleteBatch(id)
      toast({ title: "Batch deleted" })
      loadBatches(); loadStats()
    } catch (e: any) {
      toast({ title: e?.response?.data?.message || "Cannot delete batch", variant: "destructive" })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Serial &amp; Batch Tracking</h1>
          <p className="text-gray-500 text-sm mt-1">Track individual units by serial number or grouped lots by batch/expiry</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadSerials(); loadBatches(); loadStats() }}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Serials" value={stats.serials.total} color="blue" />
          <StatCard label="Available Serials" value={stats.serials.available} sub={`${stats.serials.sold} sold`} color="green" />
          <StatCard label="Total Batches" value={stats.batches.total} sub={`${stats.batches.active} active`} color="blue" />
          <StatCard label="Expiring / Expired" value={stats.batches.expiringSoon + stats.batches.expired}
            sub={`${stats.batches.expiringSoon} expiring soon, ${stats.batches.expired} expired`}
            color={stats.batches.expired > 0 ? "red" : stats.batches.expiringSoon > 0 ? "orange" : "gray"} />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="serials" className="flex items-center gap-1"><Hash className="w-4 h-4" /> Serial Numbers</TabsTrigger>
          <TabsTrigger value="batches" className="flex items-center gap-1"><Layers className="w-4 h-4" /> Batches / Lots</TabsTrigger>
        </TabsList>

        {/* ── Serials Tab ── */}
        <TabsContent value="serials" className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <Input placeholder="Search serial number..." value={serialSearch} onChange={e => setSerialSearch(e.target.value)} className="max-w-xs" />
            <Select value={serialStatus || "all"} onValueChange={v => setSerialStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="sold">Sold</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="damaged">Damaged</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={loadSerials} variant="outline" size="sm">Search</Button>
            <div className="ml-auto">
              <Button onClick={() => setAddSerialOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Add Serials
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">Serial #</th>
                  <th className="p-3 text-left font-medium text-gray-600">Product</th>
                  <th className="p-3 text-left font-medium text-gray-600">Location</th>
                  <th className="p-3 text-left font-medium text-gray-600">Status</th>
                  <th className="p-3 text-left font-medium text-gray-600">Received</th>
                  <th className="p-3 text-left font-medium text-gray-600">PO #</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {serialsLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading...</td></tr>
                ) : serials.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No serial numbers found. Add serials for products with Serial Number tracking enabled.</td></tr>
                ) : serials.map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium">{s.serialNumber}</td>
                    <td className="p-3">
                      <div>{s.productName}</div>
                      {s.variantName && <div className="text-xs text-gray-400">{s.variantName}</div>}
                    </td>
                    <td className="p-3 text-gray-500">{s.locationName || "—"}</td>
                    <td className="p-3">{statusBadge(s.status)}</td>
                    <td className="p-3 text-gray-500">{s.receivedDate || "—"}</td>
                    <td className="p-3 text-gray-500">{s.purchaseOrderNumber || "—"}</td>
                    <td className="p-3">
                      {s.status !== "sold" && (
                        <button onClick={() => handleDeleteSerial(s.id)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {serialsTotal > 50 && (
              <div className="p-3 border-t flex justify-between items-center text-sm text-gray-500">
                <span>Showing {serials.length} of {serialsTotal}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={serialsPage === 1} onClick={() => setSerialsPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setSerialsPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Batches Tab ── */}
        <TabsContent value="batches" className="space-y-4 mt-4">
          <div className="flex gap-2 items-center">
            <Input placeholder="Search batch number..." value={batchSearch} onChange={e => setBatchSearch(e.target.value)} className="max-w-xs" />
            <Button onClick={loadBatches} variant="outline" size="sm">Search</Button>
            <div className="ml-auto">
              <Button onClick={() => setAddBatchOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="w-4 h-4 mr-1" /> Add Batch
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-3 text-left font-medium text-gray-600">Batch #</th>
                  <th className="p-3 text-left font-medium text-gray-600">Product</th>
                  <th className="p-3 text-left font-medium text-gray-600">Qty Received</th>
                  <th className="p-3 text-left font-medium text-gray-600">Qty Remaining</th>
                  <th className="p-3 text-left font-medium text-gray-600">Expiry Date</th>
                  <th className="p-3 text-left font-medium text-gray-600">Status</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {batchesLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">Loading...</td></tr>
                ) : batches.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-gray-400">No batches found. Add batches for products with Batch/Lot tracking enabled.</td></tr>
                ) : batches.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-3 font-mono font-medium">{b.batchNumber}</td>
                    <td className="p-3">
                      <div>{b.productName}</div>
                      {b.variantName && <div className="text-xs text-gray-400">{b.variantName}</div>}
                    </td>
                    <td className="p-3">{b.quantityReceived}</td>
                    <td className="p-3 font-medium">{b.quantityRemaining}</td>
                    <td className="p-3">
                      {b.expiryDate ? (
                        <span className={b.isExpired ? "text-red-600 font-medium" : b.isExpiringSoon ? "text-orange-600 font-medium" : "text-gray-600"}>
                          {b.expiryDate}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      {b.isExpired ? (
                        <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle className="w-3 h-3" />Expired</span>
                      ) : b.isExpiringSoon ? (
                        <span className="flex items-center gap-1 text-xs text-orange-600 font-medium"><Clock className="w-3 h-3" />Expiring Soon</span>
                      ) : b.quantityRemaining === 0 ? (
                        <span className="text-xs text-gray-400">Depleted</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3 h-3" />Active</span>
                      )}
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleDeleteBatch(b.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {batchesTotal > 50 && (
              <div className="p-3 border-t flex justify-between items-center text-sm text-gray-500">
                <span>Showing {batches.length} of {batchesTotal}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={batchesPage === 1} onClick={() => setBatchesPage(p => p - 1)}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setBatchesPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add Serials Modal ── */}
      <Dialog open={addSerialOpen} onOpenChange={setAddSerialOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Serial Numbers</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Product <span className="text-red-500">*</span></Label>
              <Select value={serialForm.productId} onValueChange={v => setSerialForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {products.filter((p: any) => p.trackingType === "serial" || p.tracking_type === "serial").map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Only products with Serial Number tracking enabled are shown.</p>
            </div>
            <div className="space-y-1">
              <Label>Serial Numbers <span className="text-red-500">*</span></Label>
              <Textarea
                value={serialForm.bulkInput}
                onChange={e => setSerialForm(f => ({ ...f, bulkInput: e.target.value }))}
                placeholder={"SN-001\nSN-002\nSN-003\n(one per line)"}
                rows={5}
                className="font-mono text-sm"
              />
              <p className="text-xs text-gray-400">{serialForm.bulkInput.split("\n").filter(l => l.trim()).length} serial(s) entered</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Received Date</Label>
                <Input type="date" value={serialForm.receivedDate} onChange={e => setSerialForm(f => ({ ...f, receivedDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>PO Number</Label>
                <Input value={serialForm.purchaseOrderNumber} onChange={e => setSerialForm(f => ({ ...f, purchaseOrderNumber: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={serialForm.notes} onChange={e => setSerialForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSerialOpen(false)}>Cancel</Button>
            <Button onClick={handleAddSerials} disabled={serialSaving || !serialForm.productId || !serialForm.bulkInput.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {serialSaving ? "Adding..." : "Add Serials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Batch Modal ── */}
      <Dialog open={addBatchOpen} onOpenChange={setAddBatchOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Batch / Lot</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Product <span className="text-red-500">*</span></Label>
              <Select value={batchForm.productId} onValueChange={v => setBatchForm(f => ({ ...f, productId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                <SelectContent>
                  {products.filter((p: any) => p.trackingType === "batch" || p.tracking_type === "batch").map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-400">Only products with Batch/Lot tracking enabled are shown.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Batch Number <span className="text-red-500">*</span></Label>
                <Input value={batchForm.batchNumber} onChange={e => setBatchForm(f => ({ ...f, batchNumber: e.target.value }))} placeholder="e.g. LOT-2026-001" />
              </div>
              <div className="space-y-1">
                <Label>Quantity Received <span className="text-red-500">*</span></Label>
                <Input type="number" min="1" value={batchForm.quantityReceived} onChange={e => setBatchForm(f => ({ ...f, quantityReceived: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Manufacture Date</Label>
                <Input type="date" value={batchForm.manufactureDate} onChange={e => setBatchForm(f => ({ ...f, manufactureDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Expiry Date</Label>
                <Input type="date" value={batchForm.expiryDate} onChange={e => setBatchForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Received Date</Label>
                <Input type="date" value={batchForm.receivedDate} onChange={e => setBatchForm(f => ({ ...f, receivedDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>PO Number</Label>
                <Input value={batchForm.purchaseOrderNumber} onChange={e => setBatchForm(f => ({ ...f, purchaseOrderNumber: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input value={batchForm.notes} onChange={e => setBatchForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBatchOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBatch} disabled={batchSaving || !batchForm.productId || !batchForm.batchNumber || !batchForm.quantityReceived} className="bg-emerald-600 hover:bg-emerald-700">
              {batchSaving ? "Saving..." : "Create Batch"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
