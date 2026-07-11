import axios from "axios"

const client = axios.create({ baseURL: "/api/proxy" })

client.interceptors.request.use((config) => {
  const token     = typeof window !== "undefined" ? localStorage.getItem("token") : null
  const companyId = typeof window !== "undefined" ? localStorage.getItem("company_id") : null
  if (token)     config.headers.Authorization = `Bearer ${token}`
  if (companyId) config.params = { ...config.params, company_id: companyId }
  return config
})

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

// ─── Types ───────────────────────────────────────────────────────────────────

export type TailorFabricStatus = "active" | "inactive"
export type TailorDorjiStatus  = "active" | "inactive"
export type TailorPaymentStatus = "unpaid" | "partial" | "paid"
export type TailorOrderStatus =
  | "pending" | "measurement_taken" | "assigned"
  | "cutting" | "stitching" | "ready" | "delivered" | "cancelled"
export type TailorWorkStatus = "assigned" | "in_progress" | "completed" | "returned"

export interface TailorFabric {
  id: number
  companyId: number
  name: string
  fabricType?: string
  color?: string
  pattern?: string
  unit: "goj" | "gaj"
  purchasePrice: number
  sellingPrice: number
  stockQuantity: number
  vendorId?: number
  vendor?: { id: number; name: string; phone?: string }
  imagePath?: string
  status: TailorFabricStatus
  createdAt: string
  updatedAt: string
}

export interface TailorCustomer {
  id: number
  companyId: number
  name: string
  phone: string
  address?: string
  notes?: string
}

export interface TailorMeasurement {
  id: number
  companyId: number
  customerId: number
  customer?: TailorCustomer
  productType: string
  chest?: number
  waist?: number
  hip?: number
  shoulder?: number
  sleeve?: number
  length?: number
  neck?: number
  bottomLength?: number
  inseam?: number
  pajamaWaist?: number
  pajamaLength?: number
  customFields?: Record<string, string>
  notes?: string
  measuredAt: string
}

export interface TailorDorji {
  id: number
  companyId: number
  name: string
  phone: string
  address?: string
  speciality?: string[]
  commissionType: "fixed" | "percentage"
  commissionValue: number
  status: TailorDorjiStatus
  notes?: string
  activeOrders?: number
}

export interface TailorOrderItem {
  id: number
  orderId: number
  productType: string
  fabricId?: number
  fabric?: TailorFabric
  fabricQuantity: number
  fabricUnitPrice: number
  measurementId?: number
  measurement?: TailorMeasurement
  notes?: string
}

export interface TailorAssignment {
  id: number
  companyId: number
  orderId: number
  order?: Partial<TailorOrder>
  dorjiId: number
  dorji?: TailorDorji
  assignedDate: string
  expectedCompletion?: string
  dorjiCharge: number
  workStatus: TailorWorkStatus
  adminNotes?: string
}

export interface TailorPayment {
  id: number
  companyId: number
  orderId: number
  order?: Partial<TailorOrder>
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
}

export interface TailorStatusLog {
  id: number
  orderId: number
  fromStatus?: string
  toStatus: string
  changedBy?: number
  note?: string
  createdAt: string
}

export interface TailorOrder {
  id: number
  companyId: number
  orderNumber: string
  trackingToken?: string
  customerId: number
  customer?: TailorCustomer
  orderDate: string
  deliveryDate?: string
  stitchingCharge: number
  extraCharge: number
  discount: number
  totalAmount: number
  paidAmount: number
  dueAmount: number
  paymentStatus: TailorPaymentStatus
  orderStatus: TailorOrderStatus
  notes?: string
  items?: TailorOrderItem[]
  assignments?: TailorAssignment[]
  payments?: TailorPayment[]
  statusLogs?: TailorStatusLog[]
  createdAt: string
}

export interface TailorDashboardStats {
  todayOrders: number
  pendingOrders: number
  readyForDelivery: number
  deliveredOrders: number
  totalDue: number
  lowStockFabrics: number
  activeDorjis: number
  recentOrders: TailorOrder[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
}

// ─── API ─────────────────────────────────────────────────────────────────────

export function fabricFromSnake(d: any): TailorFabric {
  return {
    id:            d.id,
    companyId:     d.company_id,
    name:          d.name,
    fabricType:    d.fabric_type,
    color:         d.color,
    pattern:       d.pattern,
    unit:          d.unit,
    purchasePrice: d.purchase_price,
    sellingPrice:  d.selling_price,
    stockQuantity: d.stock_quantity,
    vendorId:      d.vendor_id,
    vendor:        d.vendor ? { id: d.vendor.id, name: d.vendor.name, phone: d.vendor.phone } : undefined,
    imagePath:     d.image_path,
    status:        d.status,
    createdAt:     d.created_at,
    updatedAt:     d.updated_at,
  }
}

function customerFromSnake(d: any): TailorCustomer {
  return { id: d.id, companyId: d.company_id, name: d.name, phone: d.phone, address: d.address, notes: d.notes }
}

function measurementFromSnake(d: any): TailorMeasurement {
  return {
    id: d.id, companyId: d.company_id, customerId: d.customer_id,
    customer: d.customer ? customerFromSnake(d.customer) : undefined,
    productType: d.product_type,
    chest: d.chest, waist: d.waist, hip: d.hip, shoulder: d.shoulder,
    sleeve: d.sleeve, length: d.length, neck: d.neck,
    bottomLength: d.bottom_length, inseam: d.inseam,
    pajamaWaist: d.pajama_waist, pajamaLength: d.pajama_length,
    customFields: d.custom_fields, notes: d.notes,
    measuredAt: d.measured_at,
  }
}

function dorjiFromSnake(d: any): TailorDorji {
  return {
    id: d.id, companyId: d.company_id, name: d.name, phone: d.phone,
    address: d.address, speciality: d.speciality ?? [],
    commissionType: d.commission_type, commissionValue: d.commission_value,
    status: d.status, notes: d.notes, activeOrders: d.active_orders,
  }
}

function assignmentFromSnake(d: any): TailorAssignment {
  return {
    id: d.id, companyId: d.company_id, orderId: d.order_id,
    order: d.order ? { orderNumber: d.order.order_number, id: d.order.id } : undefined,
    dorjiId: d.dorji_id, dorji: d.dorji ? dorjiFromSnake(d.dorji) : undefined,
    assignedDate: d.assigned_date, expectedCompletion: d.expected_completion,
    dorjiCharge: d.dorji_charge, workStatus: d.work_status, adminNotes: d.admin_notes,
  }
}

function paymentFromSnake(d: any): TailorPayment {
  return {
    id: d.id, companyId: d.company_id, orderId: d.order_id,
    order: d.order ? { orderNumber: d.order.order_number, id: d.order.id } : undefined,
    amount: d.amount, paymentMethod: d.payment_method,
    paymentDate: d.payment_date, reference: d.reference, notes: d.notes,
  }
}

function orderItemFromSnake(d: any): TailorOrderItem {
  return {
    id: d.id, orderId: d.order_id, productType: d.product_type,
    fabricId: d.fabric_id, fabric: d.fabric ? fabricFromSnake(d.fabric) : undefined,
    fabricQuantity: d.fabric_quantity, fabricUnitPrice: d.fabric_unit_price,
    measurementId: d.measurement_id,
    measurement: d.measurement ? measurementFromSnake(d.measurement) : undefined,
    notes: d.notes,
  }
}

export function orderFromSnake(d: any): TailorOrder {
  return {
    id: d.id, companyId: d.company_id, orderNumber: d.order_number,
    trackingToken: d.tracking_token,
    customerId: d.customer_id, customer: d.customer ? customerFromSnake(d.customer) : undefined,
    orderDate: d.order_date, deliveryDate: d.delivery_date,
    stitchingCharge: d.stitching_charge, extraCharge: d.extra_charge,
    discount: d.discount, totalAmount: d.total_amount,
    paidAmount: d.paid_amount, dueAmount: d.due_amount,
    paymentStatus: d.payment_status, orderStatus: d.order_status,
    notes: d.notes,
    items: d.items ? d.items.map(orderItemFromSnake) : undefined,
    assignments: d.assignments ? d.assignments.map(assignmentFromSnake) : undefined,
    payments: d.payments ? d.payments.map(paymentFromSnake) : undefined,
    statusLogs: d.status_logs ? d.status_logs.map((s: any) => ({
      id: s.id, orderId: s.order_id, fromStatus: s.from_status, toStatus: s.to_status,
      changedBy: s.changed_by, note: s.note, createdAt: s.created_at,
    })) : undefined,
    createdAt: d.created_at,
  }
}

function fabricToSnake(d: Partial<TailorFabric>) {
  return {
    name:           d.name,
    fabric_type:    d.fabricType,
    color:          d.color,
    pattern:        d.pattern,
    unit:           d.unit,
    purchase_price: d.purchasePrice,
    selling_price:  d.sellingPrice,
    stock_quantity: d.stockQuantity,
    vendor_id:      d.vendorId,
    image_path:     d.imagePath,
    status:         d.status,
  }
}

export const tailorApi = {
  // Fabrics
  getFabrics:    (params?: Record<string, any>) => client.get("/tailor/fabrics", { params }).then(r => {
    const raw = r.data?.data?.data ?? r.data?.data ?? []
    const mapped = Array.isArray(raw) ? raw.map(fabricFromSnake) : raw
    return { ...r, data: { ...r.data, data: { ...r.data?.data, data: mapped } } }
  }),
  createFabric:  (data: Partial<TailorFabric>)  => client.post("/tailor/fabrics", fabricToSnake(data)),
  updateFabric:  (id: number, data: Partial<TailorFabric>) => client.put(`/tailor/fabrics/${id}`, fabricToSnake(data)),
  deleteFabric:  (id: number)                   => client.delete(`/tailor/fabrics/${id}`),

  // Customers
  getCustomers:       (params?: Record<string, any>) => client.get("/tailor/customers", { params }).then(r => ({
    ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(customerFromSnake) : r.data?.data }
  })),
  findCustomerByPhone:(phone: string) => client.get("/tailor/customers/search", { params: { phone } }).then(r => ({
    ...r, data: { ...r.data, data: r.data?.data ? customerFromSnake(r.data.data) : null }
  })),
  saveCustomer: (data: Partial<TailorCustomer>) => client.post("/tailor/customers", {
    name: data.name, phone: data.phone, address: data.address, notes: data.notes,
  }),

  // Measurements
  getMeasurementsByCustomer: (customerId: number) =>
    client.get(`/tailor/measurements/customer/${customerId}`).then(r => ({
      ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(measurementFromSnake) : r.data?.data }
    })),
  createMeasurement: (data: any) => client.post("/tailor/measurements", data),
  updateMeasurement: (id: number, data: any) => client.put(`/tailor/measurements/${id}`, data),

  // Dorjis
  getDorjis: (params?: Record<string, any>) => client.get("/tailor/dorjis", { params }).then(r => ({
    ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(dorjiFromSnake) : r.data?.data }
  })),
  createDorji:  (data: Partial<TailorDorji>)    => client.post("/tailor/dorjis", {
    name: data.name, phone: data.phone, address: data.address,
    speciality: data.speciality, status: data.status, notes: data.notes,
    commission_type:  data.commissionType,
    commission_value: data.commissionValue,
  }),
  updateDorji:  (id: number, data: Partial<TailorDorji>) => client.put(`/tailor/dorjis/${id}`, {
    name: data.name, phone: data.phone, address: data.address,
    speciality: data.speciality, status: data.status, notes: data.notes,
    commission_type:  data.commissionType,
    commission_value: data.commissionValue,
  }),
  deleteDorji:  (id: number)                    => client.delete(`/tailor/dorjis/${id}`),

  // Orders
  getOrders: (params?: Record<string, any>) => client.get("/tailor/orders", { params }).then(r => ({
    ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(orderFromSnake) : r.data?.data }
  })),
  getOrder: (id: number) => client.get(`/tailor/orders/${id}`).then(r => ({
    ...r, data: { ...r.data, data: r.data?.data ? orderFromSnake(r.data.data) : null }
  })),
  createOrder:   (data: Record<string, any>)    => client.post("/tailor/orders", data),
  updateOrder:   (id: number, data: Record<string, any>) => client.put(`/tailor/orders/${id}`, data),
  updateOrderStatus: (id: number, status: TailorOrderStatus, note?: string) =>
    client.patch(`/tailor/orders/${id}/status`, { status, note }),

  // Assignments
  getAssignments: (params?: Record<string, any>) => client.get("/tailor/assignments", { params }).then(r => ({
    ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(assignmentFromSnake) : r.data?.data }
  })),
  createAssignment: (data: Partial<TailorAssignment>)    => client.post("/tailor/assignments", {
    order_id:            data.orderId,
    dorji_id:            data.dorjiId,
    assigned_date:       data.assignedDate,
    expected_completion: data.expectedCompletion,
    dorji_charge:        data.dorjiCharge,
    work_status:         data.workStatus,
    admin_notes:         data.adminNotes,
  }),
  updateAssignment: (id: number, data: Partial<TailorAssignment>) =>
    client.put(`/tailor/assignments/${id}`, {
      expected_completion: data.expectedCompletion,
      dorji_charge:        data.dorjiCharge,
      work_status:         data.workStatus,
      admin_notes:         data.adminNotes,
    }),

  // Payments
  getPayments: (params?: Record<string, any>) => client.get("/tailor/payments", { params }).then(r => ({
    ...r, data: { ...r.data, data: Array.isArray(r.data?.data) ? r.data.data.map(paymentFromSnake) : r.data?.data }
  })),
  createPayment: (data: Partial<TailorPayment>)    => client.post("/tailor/payments", {
    order_id:       data.orderId,
    amount:         data.amount,
    payment_method: data.paymentMethod,
    payment_date:   data.paymentDate,
    reference:      data.reference,
    notes:          data.notes,
  }),

  // Dashboard & Reports
  getDashboard:      ()                          => client.get("/tailor/dashboard"),
  getOrdersReport:   (params?: Record<string, any>) => client.get("/tailor/reports/orders", { params }),
  getFabricsReport:  ()                          => client.get("/tailor/reports/fabrics"),
  getDorjisReport:   (params?: Record<string, any>) => client.get("/tailor/reports/dorjis", { params }),
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<TailorOrderStatus, string> = {
  pending:          "Pending",
  measurement_taken:"Measurement Taken",
  assigned:         "Assigned to Dorji",
  cutting:          "Cutting",
  stitching:        "Stitching",
  ready:            "Ready",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
}

export const ORDER_STATUS_COLORS: Record<TailorOrderStatus, string> = {
  pending:          "bg-gray-100 text-gray-700",
  measurement_taken:"bg-blue-100 text-blue-700",
  assigned:         "bg-purple-100 text-purple-700",
  cutting:          "bg-yellow-100 text-yellow-700",
  stitching:        "bg-orange-100 text-orange-700",
  ready:            "bg-green-100 text-green-700",
  delivered:        "bg-emerald-100 text-emerald-700",
  cancelled:        "bg-red-100 text-red-700",
}

export const PAYMENT_STATUS_COLORS: Record<TailorPaymentStatus, string> = {
  unpaid:  "bg-red-100 text-red-700",
  partial: "bg-yellow-100 text-yellow-700",
  paid:    "bg-green-100 text-green-700",
}

export const PRODUCT_TYPES = [
  "Pajama", "Jama", "Panjabi", "Shirt", "Pants",
  "Blouse", "Shalwar Kameez", "Kurta", "Coat", "Other",
]

export const WORK_STATUS_LABELS: Record<TailorWorkStatus, string> = {
  assigned:   "Assigned",
  in_progress:"In Progress",
  completed:  "Completed",
  returned:   "Returned for Fixing",
}
