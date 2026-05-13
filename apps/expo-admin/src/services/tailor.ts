import { api } from "@/lib/api"
import type {
  TailorFabric, TailorCustomer, TailorMeasurement, TailorDorji,
  TailorOrder, TailorAssignment, TailorPayment, TailorDashboardStats,
  TailorOrderStatus, TailorWorkStatus,
} from "@/types/tailor"

// ── Normalizers ────────────────────────────────────────────────────────────

function normFabric(d: any): TailorFabric {
  return {
    id: d.id, companyId: d.company_id, name: d.name,
    fabricType: d.fabric_type, color: d.color, pattern: d.pattern, unit: d.unit,
    purchasePrice: d.purchase_price ?? 0, sellingPrice: d.selling_price ?? 0,
    stockQuantity: d.stock_quantity ?? 0, vendorId: d.vendor_id,
    vendor: d.vendor ? { id: d.vendor.id, name: d.vendor.name, phone: d.vendor.phone } : undefined,
    imagePath: d.image_path, status: d.status,
  }
}

function normCustomer(d: any): TailorCustomer {
  return { id: d.id, name: d.name, phone: d.phone, address: d.address, notes: d.notes }
}

function normMeasurement(d: any): TailorMeasurement {
  return {
    id: d.id, customerId: d.customer_id,
    customer: d.customer ? normCustomer(d.customer) : undefined,
    productType: d.product_type,
    chest: d.chest, waist: d.waist, hip: d.hip, shoulder: d.shoulder,
    sleeve: d.sleeve, length: d.length, neck: d.neck,
    bottomLength: d.bottom_length, inseam: d.inseam,
    pajamaWaist: d.pajama_waist, pajamaLength: d.pajama_length,
    notes: d.notes, measuredAt: d.measured_at,
  }
}

function normDorji(d: any): TailorDorji {
  return {
    id: d.id, name: d.name, phone: d.phone, address: d.address,
    speciality: d.speciality ?? [], commissionType: d.commission_type,
    commissionValue: d.commission_value, status: d.status,
    notes: d.notes, activeOrders: d.active_orders,
  }
}

function normAssignment(d: any): TailorAssignment {
  return {
    id: d.id, orderId: d.order_id, dorjiId: d.dorji_id,
    dorji: d.dorji ? normDorji(d.dorji) : undefined,
    assignedDate: d.assigned_date, expectedCompletion: d.expected_completion,
    dorjiCharge: d.dorji_charge ?? 0, workStatus: d.work_status, adminNotes: d.admin_notes,
  }
}

function normPayment(d: any): TailorPayment {
  return {
    id: d.id, orderId: d.order_id, amount: d.amount ?? 0,
    paymentMethod: d.payment_method, paymentDate: d.payment_date,
    reference: d.reference, notes: d.notes,
    order: d.order ? { id: d.order.id, orderNumber: d.order.order_number, customer: d.order.customer ? normCustomer(d.order.customer) : undefined } as any : undefined,
  }
}

function normOrder(d: any): TailorOrder {
  return {
    id: d.id, orderNumber: d.order_number, trackingToken: d.tracking_token,
    customerId: d.customer_id,
    customer: d.customer ? normCustomer(d.customer) : undefined,
    orderDate: d.order_date, deliveryDate: d.delivery_date,
    stitchingCharge: d.stitching_charge ?? 0, extraCharge: d.extra_charge ?? 0,
    discount: d.discount ?? 0, totalAmount: d.total_amount ?? 0,
    paidAmount: d.paid_amount ?? 0, dueAmount: d.due_amount ?? 0,
    paymentStatus: d.payment_status, orderStatus: d.order_status,
    notes: d.notes,
    items: d.items?.map((i: any) => ({
      id: i.id, productType: i.product_type,
      fabricId: i.fabric_id, fabric: i.fabric ? normFabric(i.fabric) : undefined,
      fabricQuantity: i.fabric_quantity ?? 0, fabricUnitPrice: i.fabric_unit_price ?? 0,
      measurementId: i.measurement_id,
      measurement: i.measurement ? normMeasurement(i.measurement) : undefined,
      notes: i.notes,
    })),
    assignments: d.assignments?.map(normAssignment),
    payments: d.payments?.map(normPayment),
    statusLogs: d.status_logs?.map((s: any) => ({
      id: s.id, fromStatus: s.from_status, toStatus: s.to_status,
      note: s.note, createdAt: s.created_at,
    })),
    createdAt: d.created_at,
  }
}

// ── API Functions ──────────────────────────────────────────────────────────

export async function getTailorDashboard(): Promise<TailorDashboardStats> {
  const r = await api.get("/tailor/dashboard")
  const d = r.data?.data ?? r.data
  return {
    todayOrders:      d.today_orders ?? 0,
    pendingOrders:    d.pending_orders ?? 0,
    readyForDelivery: d.ready_for_delivery ?? 0,
    deliveredOrders:  d.delivered_orders ?? 0,
    totalDue:         d.total_due ?? 0,
    lowStockFabrics:  d.low_stock_fabrics ?? 0,
    activeDorjis:     d.active_dorjis ?? 0,
    recentOrders:     (d.recent_orders ?? []).map(normOrder),
  }
}

export async function getTailorFabrics(params?: Record<string, any>): Promise<TailorFabric[]> {
  const r = await api.get("/tailor/fabrics", { params })
  const raw = r.data?.data?.data ?? r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normFabric) : []
}

export async function createTailorFabric(data: Partial<TailorFabric>): Promise<TailorFabric> {
  const r = await api.post("/tailor/fabrics", {
    name: data.name, fabric_type: data.fabricType, color: data.color,
    pattern: data.pattern, unit: data.unit,
    purchase_price: data.purchasePrice, selling_price: data.sellingPrice,
    stock_quantity: data.stockQuantity, vendor_id: data.vendorId,
    image_path: data.imagePath, status: data.status,
  })
  return normFabric(r.data?.data ?? r.data)
}

export async function updateTailorFabric(id: number, data: Partial<TailorFabric>): Promise<TailorFabric> {
  const r = await api.put(`/tailor/fabrics/${id}`, {
    name: data.name, fabric_type: data.fabricType, color: data.color,
    pattern: data.pattern, unit: data.unit,
    purchase_price: data.purchasePrice, selling_price: data.sellingPrice,
    stock_quantity: data.stockQuantity, vendor_id: data.vendorId, status: data.status,
  })
  return normFabric(r.data?.data ?? r.data)
}

export async function deleteTailorFabric(id: number): Promise<void> {
  await api.delete(`/tailor/fabrics/${id}`)
}

export async function getTailorCustomers(params?: Record<string, any>): Promise<TailorCustomer[]> {
  const r = await api.get("/tailor/customers", { params })
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normCustomer) : []
}

export async function findTailorCustomerByPhone(phone: string): Promise<TailorCustomer | null> {
  try {
    const r = await api.get("/tailor/customers/search", { params: { phone } })
    return r.data?.data ? normCustomer(r.data.data) : null
  } catch { return null }
}

export async function saveTailorCustomer(data: Partial<TailorCustomer>): Promise<TailorCustomer> {
  const r = await api.post("/tailor/customers", {
    name: data.name, phone: data.phone, address: data.address, notes: data.notes,
  })
  return normCustomer(r.data?.data ?? r.data)
}

export async function updateTailorCustomer(id: number, data: Partial<TailorCustomer>): Promise<TailorCustomer> {
  const r = await api.put(`/tailor/customers/${id}`, {
    name: data.name, phone: data.phone, address: data.address, notes: data.notes,
  })
  return normCustomer(r.data?.data ?? r.data)
}

export async function deleteTailorCustomer(id: number): Promise<void> {
  await api.delete(`/tailor/customers/${id}`)
}

export async function getCustomerOrders(customerId: number): Promise<TailorOrder[]> {
  const r = await api.get(`/tailor/customers/${customerId}/orders`)
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normOrder) : []
}

export async function getMeasurementsByCustomer(customerId: number): Promise<TailorMeasurement[]> {
  const r = await api.get(`/tailor/measurements/customer/${customerId}`)
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normMeasurement) : []
}

export async function getTailorDorjis(params?: Record<string, any>): Promise<TailorDorji[]> {
  const r = await api.get("/tailor/dorjis", { params })
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normDorji) : []
}

export async function getTailorOrders(params?: Record<string, any>): Promise<{ data: TailorOrder[], total: number, page: number, lastPage: number }> {
  const r = await api.get("/tailor/orders", { params })
  const d = r.data?.data ?? {}
  const raw = Array.isArray(d) ? d : (d.data ?? [])
  return {
    data: raw.map(normOrder),
    total: d.total ?? raw.length,
    page: d.current_page ?? 1,
    lastPage: d.last_page ?? 1,
  }
}

export async function getTailorOrder(id: number): Promise<TailorOrder> {
  const r = await api.get(`/tailor/orders/${id}`)
  return normOrder(r.data?.data ?? r.data)
}

export async function createTailorOrder(data: Record<string, any>): Promise<TailorOrder> {
  const r = await api.post("/tailor/orders", data)
  return normOrder(r.data?.data ?? r.data)
}

export async function updateTailorOrderStatus(id: number, status: TailorOrderStatus, note?: string): Promise<TailorOrder> {
  const r = await api.patch(`/tailor/orders/${id}/status`, { status, note })
  return normOrder(r.data?.data ?? r.data)
}

export async function createTailorAssignment(data: Partial<TailorAssignment>): Promise<TailorAssignment> {
  const r = await api.post("/tailor/assignments", {
    order_id: data.orderId, dorji_id: data.dorjiId,
    assigned_date: data.assignedDate, expected_completion: data.expectedCompletion,
    dorji_charge: data.dorjiCharge, work_status: data.workStatus,
  })
  return normAssignment(r.data?.data ?? r.data)
}

export async function updateTailorAssignment(id: number, data: Partial<TailorAssignment>): Promise<void> {
  await api.put(`/tailor/assignments/${id}`, {
    work_status: data.workStatus, dorji_charge: data.dorjiCharge,
    expected_completion: data.expectedCompletion, admin_notes: data.adminNotes,
  })
}

export async function createTailorPayment(data: Partial<TailorPayment>): Promise<TailorPayment> {
  const r = await api.post("/tailor/payments", {
    order_id: data.orderId, amount: data.amount,
    payment_method: data.paymentMethod, payment_date: data.paymentDate,
    reference: data.reference, notes: data.notes,
  })
  return normPayment(r.data?.data ?? r.data)
}

export async function updateTailorOrder(id: number, data: Record<string, any>): Promise<TailorOrder> {
  const r = await api.put(`/tailor/orders/${id}`, data)
  return normOrder(r.data?.data ?? r.data)
}

export async function getTailorPayments(params?: Record<string, any>): Promise<TailorPayment[]> {
  const r = await api.get("/tailor/payments", { params })
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normPayment) : []
}

export async function getTailorMeasurements(params?: Record<string, any>): Promise<TailorMeasurement[]> {
  const r = await api.get("/tailor/measurements", { params })
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normMeasurement) : []
}

export async function createTailorMeasurement(data: Record<string, any>): Promise<TailorMeasurement> {
  const r = await api.post("/tailor/measurements", data)
  return normMeasurement(r.data?.data ?? r.data)
}

export async function updateTailorMeasurement(id: number, data: Record<string, any>): Promise<TailorMeasurement> {
  const r = await api.put(`/tailor/measurements/${id}`, data)
  return normMeasurement(r.data?.data ?? r.data)
}

export async function createTailorDorji(data: Partial<TailorDorji>): Promise<TailorDorji> {
  const r = await api.post("/tailor/dorjis", {
    name: data.name, phone: data.phone, address: data.address,
    speciality: data.speciality, commission_type: data.commissionType,
    commission_value: data.commissionValue, status: data.status, notes: data.notes,
  })
  return normDorji(r.data?.data ?? r.data)
}

export async function updateTailorDorji(id: number, data: Partial<TailorDorji>): Promise<TailorDorji> {
  const r = await api.put(`/tailor/dorjis/${id}`, {
    name: data.name, phone: data.phone, address: data.address,
    speciality: data.speciality, commission_type: data.commissionType,
    commission_value: data.commissionValue, status: data.status, notes: data.notes,
  })
  return normDorji(r.data?.data ?? r.data)
}

export async function deleteTailorDorji(id: number): Promise<void> {
  await api.delete(`/tailor/dorjis/${id}`)
}

export async function getTailorAssignments(params?: Record<string, any>): Promise<TailorAssignment[]> {
  const r = await api.get("/tailor/assignments", { params })
  const raw = r.data?.data ?? []
  return Array.isArray(raw) ? raw.map(normAssignment) : []
}
