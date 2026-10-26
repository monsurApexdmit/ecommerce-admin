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
export type TailorDorjiStatus  = "active" | "on_leave" | "inactive"
export type TailorPaymentStatus = "unpaid" | "partial" | "paid"
export type TailorOrderStatus =
  | "pending" | "measurement_taken" | "assigned"
  | "cutting" | "stitching" | "ready" | "delivered" | "cancelled"
export type TailorWorkStatus = "assigned" | "in_progress" | "completed" | "returned" | "paid"

export interface TailorFabric {
  id: number
  companyId: number
  name: string
  fabricType?: string
  color?: string
  pattern?: string
  unit: "goj" | "gaj" | "m"
  code?: string
  hexColor?: string
  reorderLevel?: number
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

// ─── Dashboard / Reports payloads (GET /tailor/dashboard, GET /tailor/reports) ──

export type TailorTone = "blue" | "teal" | "purple" | "amber" | "red"
export interface TailorKpi {
  label: string; value: number | string; kind: "money" | "int" | "text"
  sub: string; tone: TailorTone; subTone?: "muted" | "red" | "amber" | "teal"
}
export type TailorBoardStage = "new" | "cutting" | "stitching" | "trial" | "ready" | "delivered" | "cancelled"
export interface TailorBoardOrder {
  id: number; order_no: string; customer: string; items: string; dorji: string | null
  delivery_date: string | null; days_left: number | null; urgent: boolean
}
export interface TailorDashboardData {
  kpis: TailorKpi[]
  board: { key: TailorBoardStage; label: string; count: number; orders: TailorBoardOrder[] }[]
  dues: { id: number; order_no: string; customer: string; stage: TailorBoardStage; stage_label: string; phone: string | null; due: number }[]
  workload: { id: number; name: string; open: number; percent: number }[]
  advice: { head: string; body: string } | null
  fabric_alerts: { id: number; name: string; color: string | null; hex_color: string | null; unit: string | null; stock: number; reorder_level: number; out: boolean }[]
  fabrics_count: number
  recent_orders: { id: number; order_no: string; customer: string; total: number; stage: TailorBoardStage; stage_label: string; payment: TailorPaymentStatus | null }[]
  due_soon: TailorBoardOrder[]
  has_orders: boolean
}
export type TailorReportType = "orders" | "fabrics" | "dorjis"
export interface TailorReportCell { t: "text" | "money" | "int" | "pct"; v: string | number; bold?: boolean; tone?: string }
export interface TailorReport {
  type: TailorReportType
  period: { from: string | null; to: string | null }
  subtitle: string
  kpis: TailorKpi[]
  chart: { title: string; signed: boolean; kind: "money" | "int" | "num"; unit: string | null; bars: { label: string; value: number }[] } | null
  mixes: { title: string; kind: "money" | "int" | "num"; unit: string | null; items: { label: string; value: number }[] }[]
  tables: { title: string; empty: string; columns: string[]; rows: TailorReportCell[][]; totalRow?: TailorReportCell[] | null }[]
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
}


// ─── Fabric inventory screen (overview + restock) ───────────────────────────

export type TailorFabricStockState = "ok" | "low" | "out" | "inactive"

export interface TailorFabricRow extends TailorFabric {
  vendorName?: string
  stockState: TailorFabricStockState
  stockValue: number
  marginPct: number | null
  ordersCount: number
}

export interface TailorFabricStats {
  fabricsCount: number
  inactiveCount: number
  typesCount: number
  stockValue: number
  totalStock: number
  /** single unit across all fabrics, or null when mixed */
  unit: string | null
  lowCount: number
  lowNames: string[]
  usedThisMonth: number
  topFabric: string | null
}

export interface TailorFabricOverview {
  data: TailorFabricRow[]
  total: number
  counts: Record<"all" | "ok" | "low" | "out" | "inactive", number>
  types: string[]
  stats: TailorFabricStats
}

// ─── Payments ledger screen ─────────────────────────────────────────────────

export type TailorLedgerKind = "customer" | "dorji"

export interface TailorLedgerRow {
  id: number
  kind: TailorLedgerKind
  paymentDate: string
  who: string
  orderId?: number | null
  orderNumber?: string | null
  dorjiId?: number | null
  type: "advance" | "payment" | "final" | "payout"
  typeLabel: string
  method: string
  methodLabel: string
  amount: number
  reference?: string | null
  notes?: string | null
  refLabel: string
  createdAt?: string | null
}

export interface TailorLedgerStats {
  collectedMonth: number
  collectedMonthCount: number
  toCollect: number
  toCollectOrders: number
  paidDorjisMonth: number
  paidDorjisCount: number
  owedDorjis: number
}

export interface TailorLedger {
  data: TailorLedgerRow[]
  total: number
  totalAmount: number
  counts: Record<TailorLedgerKind, number>
  stats: TailorLedgerStats
}

export interface TailorPayableOption {
  id: number
  /** order number (customer kind) */
  orderNumber?: string
  name?: string
  balance: number
}

export interface TailorRecordPaymentInput {
  kind: TailorLedgerKind
  orderId?: number
  dorjiId?: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
  expectedBalance?: number
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
    code:          d.code ?? undefined,
    hexColor:      d.hex_color ?? undefined,
    reorderLevel:  d.reorder_level != null ? Number(d.reorder_level) : undefined,
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
    code:           d.code,
    hex_color:      d.hexColor,
    reorder_level:  d.reorderLevel,
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
  getFabricOverview: (params?: Record<string, any>): Promise<TailorFabricOverview> =>
    client.get("/tailor/fabrics/overview", { params }).then(r => {
      const d = r.data?.data ?? {}
      const st = d.stats ?? {}
      return {
        data: (d.data ?? []).map((x: any): TailorFabricRow => ({
          ...fabricFromSnake(x),
          vendorName: x.vendor_name ?? undefined,
          stockState: x.stock_state,
          stockValue: Number(x.stock_value ?? 0),
          marginPct: x.margin_pct ?? null,
          ordersCount: Number(x.orders_count ?? 0),
        })),
        total: d.total ?? 0,
        counts: d.counts ?? { all: 0, ok: 0, low: 0, out: 0, inactive: 0 },
        types: d.types ?? [],
        stats: {
          fabricsCount: st.fabrics_count ?? 0, inactiveCount: st.inactive_count ?? 0, typesCount: st.types_count ?? 0,
          stockValue: st.stock_value ?? 0, totalStock: st.total_stock ?? 0, unit: st.unit ?? null,
          lowCount: st.low_count ?? 0, lowNames: st.low_names ?? [], usedThisMonth: st.used_this_month ?? 0, topFabric: st.top_fabric ?? null,
        },
      }
    }),
  restockFabric: (id: number, data: { quantity: number; vendorId?: number | null; note?: string }) =>
    client.post(`/tailor/fabrics/${id}/restock`, { quantity: data.quantity, vendor_id: data.vendorId || undefined, note: data.note }),

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

  // Payments ledger (Payments screen)
  getPaymentLedger: (params?: Record<string, any>): Promise<TailorLedger> =>
    client.get("/tailor/payments/ledger", { params }).then(r => {
      const d = r.data?.data ?? {}
      const st = d.stats ?? {}
      return {
        data: (d.data ?? []).map((x: any): TailorLedgerRow => ({
          id: x.id, kind: x.kind, paymentDate: x.payment_date, who: x.who,
          orderId: x.order_id, orderNumber: x.order_number, dorjiId: x.dorji_id,
          type: x.type, typeLabel: x.type_label, method: x.method, methodLabel: x.method_label,
          amount: Number(x.amount), reference: x.reference, notes: x.notes, refLabel: x.ref_label, createdAt: x.created_at,
        })),
        total: d.total ?? 0,
        totalAmount: d.total_amount ?? 0,
        counts: d.counts ?? { customer: 0, dorji: 0 },
        stats: {
          collectedMonth: st.collected_month ?? 0, collectedMonthCount: st.collected_month_count ?? 0,
          toCollect: st.to_collect ?? 0, toCollectOrders: st.to_collect_orders ?? 0,
          paidDorjisMonth: st.paid_dorjis_month ?? 0, paidDorjisCount: st.paid_dorjis_count ?? 0, owedDorjis: st.owed_dorjis ?? 0,
        },
      }
    }),
  getPayableOptions: (kind: TailorLedgerKind): Promise<TailorPayableOption[]> =>
    client.get("/tailor/payments/options", { params: { kind } }).then(r =>
      (r.data?.data ?? []).map((x: any): TailorPayableOption => ({ id: x.id, orderNumber: x.order_number, name: x.name, balance: Number(x.balance) }))),
  recordPayment: (d: TailorRecordPaymentInput) => client.post("/tailor/payments/record", {
    kind: d.kind, order_id: d.orderId, dorji_id: d.dorjiId, amount: d.amount,
    payment_method: d.paymentMethod, payment_date: d.paymentDate, reference: d.reference || undefined, notes: d.notes || undefined,
    expected_balance: d.expectedBalance,
  }),

  // Dashboard & Reports
  getDashboard:      ()                          => client.get("/tailor/dashboard"),
  getOrdersReport:   (params?: Record<string, any>) => client.get("/tailor/reports/orders", { params }),
  getFabricsReport:  ()                          => client.get("/tailor/reports/fabrics"),
  getDorjisReport:   (params?: Record<string, any>) => client.get("/tailor/reports/dorjis", { params }),

  // Dashboard + UI reports (typed cells, same shape as the generic Reports page)
  getDashboardData:  async (): Promise<TailorDashboardData> => (await client.get("/tailor/dashboard")).data.data,
  getReport:         async (type: TailorReportType, params?: { from?: string; to?: string }): Promise<TailorReport> =>
    (await client.get("/tailor/reports", { params: { type, ...params } })).data.data,
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

/** Starter garment list: default stitching price and suggested fabric per piece (metres). History overrides these. */
export const GARMENT_DEFAULTS: { name: string; price: number; fabric: number }[] = [
  { name: "Shirt", price: 450, fabric: 1.8 }, { name: "Panjabi", price: 650, fabric: 2.5 },
  { name: "Pant", price: 500, fabric: 1.5 }, { name: "Pajama", price: 300, fabric: 2 },
  { name: "Jama", price: 900, fabric: 3.5 }, { name: "Kurta", price: 550, fabric: 2.2 },
  { name: "Blouse", price: 350, fabric: 1 }, { name: "Salwar Kameez", price: 800, fabric: 4 },
  { name: "Coat", price: 2500, fabric: 3.2 }, { name: "Other", price: 0, fabric: 0 },
]
export const PRODUCT_TYPES = GARMENT_DEFAULTS.map((g) => g.name)

export const WORK_STATUS_LABELS: Record<TailorWorkStatus, string> = {
  assigned:   "Assigned",
  in_progress:"In Progress",
  completed:  "Completed",
  returned:   "Returned for Fixing",
  paid:       "Paid",
}

// ─── Dorjis / Assignments / Measurements screens ─────────────────────────────

export interface Pagination { page: number; per_page: number; total: number; last_page: number }

export interface DorjiRow {
  id: number; name: string; phone: string; address: string | null; notes: string | null
  speciality: string[]; commissionType: "fixed" | "percentage" | "salary"; commissionValue: number
  status: TailorDorjiStatus; maxPieces: number | null
  piecesInHand: number; activeOrders: number; workloadPct: number
  earnedMonth: number; unpaid: number; onTimeRate: number | null; totalJobs: number
}
export interface DorjiStats {
  active: number; onLeave: number; inactive: number; total: number
  piecesInHand: number; capacity: number; unpaid: number; onTimeRate: number | null
}
export interface DorjiPayload {
  name: string; phone: string; address?: string; notes?: string; speciality?: string[]
  commissionType?: "fixed" | "percentage" | "salary"; commissionValue?: number
  status?: TailorDorjiStatus; maxPieces?: number | null
}

export interface AssignmentRow {
  id: number; orderId: number; dorjiId: number
  orderNumber: string | null; customerName: string | null; orderStatus: string | null
  dorjiName: string | null; dorjiStatus: string | null
  task: string | null; pieces: number; ratePerPiece: number; dorjiCharge: number; paidAmount: number; payable: number
  assignedDate: string | null; expectedCompletion: string | null; dueDate: string | null; completedAt: string | null
  workStatus: TailorWorkStatus; adminNotes: string | null
}
export interface AssignmentStats {
  counts: Record<"all" | TailorWorkStatus, number>
  payPending: number; payPendingJobs: number; unassignedOrders: number
  firstUnassigned: AssignmentOrderOption | null
}
export interface AssignmentOrderOption {
  id: number; orderNumber: string; customerName: string | null; deliveryDate: string | null
  garments: string; task: string; pieces: number; unassigned: boolean
}
export interface AssignmentDorjiOption {
  id: number; name: string; status: TailorDorjiStatus; maxPieces: number | null; ratePerPiece: number; piecesInHand: number
}
export interface AssignmentPayload {
  orderId?: number; dorjiId?: number; assignedDate?: string; expectedCompletion?: string | null
  task?: string; pieces?: number; ratePerPiece?: number; adminNotes?: string | null
  workStatus?: TailorWorkStatus; force?: boolean
}

export interface MeasurementCustomer {
  id: number; name: string; phone: string; address: string | null
  garments: string[]; setsCount: number; lastMeasuredAt: string | null
}
export interface MeasurementSet {
  id: number; customerId: number; productType: string; label: string; unit: "in" | "cm"
  fitPreference: string; notes: string; measuredAt: string
  values: Record<string, number>; customFields: Record<string, string>
  history: { at: string; values: Record<string, number> }[]
  usedByOrders?: number
}
export interface MeasurementPayload {
  customerId?: number; productType: string; label?: string; unit: "in" | "cm"; fitPreference: string
  notes?: string; measuredAt: string; values: Record<string, number>; customFields: Record<string, string>
}

const n0 = (v: any) => Number(v) || 0

function dorjiRow(d: any): DorjiRow {
  return {
    id: d.id, name: d.name, phone: d.phone, address: d.address ?? null, notes: d.notes ?? null,
    speciality: d.speciality ?? [], commissionType: d.commission_type, commissionValue: n0(d.commission_value),
    status: d.status, maxPieces: d.max_pieces ?? null, piecesInHand: n0(d.pieces_in_hand), activeOrders: n0(d.active_orders),
    workloadPct: n0(d.workload_pct), earnedMonth: n0(d.earned_month), unpaid: n0(d.unpaid),
    onTimeRate: d.on_time_rate ?? null, totalJobs: n0(d.total_jobs),
  }
}

function assignmentRow(a: any): AssignmentRow {
  return {
    id: a.id, orderId: a.order_id, dorjiId: a.dorji_id,
    orderNumber: a.order?.order_number ?? null, customerName: a.order?.customer_name ?? null, orderStatus: a.order?.order_status ?? null,
    dorjiName: a.dorji?.name ?? null, dorjiStatus: a.dorji?.status ?? null,
    task: a.task ?? null, pieces: n0(a.pieces) || 1, ratePerPiece: n0(a.rate_per_piece), dorjiCharge: n0(a.dorji_charge),
    paidAmount: n0(a.paid_amount), payable: n0(a.payable),
    assignedDate: a.assigned_date ? String(a.assigned_date).slice(0, 10) : null,
    expectedCompletion: a.expected_completion ? String(a.expected_completion).slice(0, 10) : null,
    dueDate: a.due_date ?? null, completedAt: a.completed_at ?? null,
    workStatus: a.work_status, adminNotes: a.admin_notes ?? null,
  }
}

function orderOption(o: any): AssignmentOrderOption {
  return {
    id: o.id, orderNumber: o.order_number, customerName: o.customer_name ?? null, deliveryDate: o.delivery_date ?? null,
    garments: o.garments ?? "", task: o.task ?? "", pieces: n0(o.pieces), unassigned: !!o.unassigned,
  }
}

function measurementSet(m: any): MeasurementSet {
  return {
    id: m.id, customerId: m.customer_id, productType: m.product_type, label: m.label ?? "", unit: m.unit === "cm" ? "cm" : "in",
    fitPreference: m.fit_preference ?? "Regular", notes: m.notes ?? "", measuredAt: String(m.measured_at ?? "").slice(0, 10),
    values: m.values ?? {}, customFields: m.custom_fields ?? {}, history: m.history ?? [], usedByOrders: m.used_by_orders ?? 0,
  }
}

const dorjiBody = (d: Partial<DorjiPayload>) => ({
  name: d.name, phone: d.phone, address: d.address ?? null, notes: d.notes ?? null, speciality: d.speciality,
  commission_type: d.commissionType, commission_value: d.commissionValue, status: d.status, max_pieces: d.maxPieces ?? null,
})

const assignmentBody = (a: AssignmentPayload) => ({
  order_id: a.orderId, dorji_id: a.dorjiId, assigned_date: a.assignedDate, expected_completion: a.expectedCompletion,
  task: a.task, pieces: a.pieces, rate_per_piece: a.ratePerPiece, admin_notes: a.adminNotes, work_status: a.workStatus, force: a.force,
})

export const tailorWorkshopApi = {
  // Dorjis
  getDorjiOverview: (params?: Record<string, any>) => client.get("/tailor/dorjis/overview", { params }).then((r) => {
    const st = r.data?.meta?.stats ?? {}
    return {
      rows: (r.data?.data ?? []).map(dorjiRow) as DorjiRow[],
      pagination: (r.data?.meta?.pagination ?? { page: 1, per_page: 12, total: 0, last_page: 1 }) as Pagination,
      stats: {
        active: n0(st.active), onLeave: n0(st.on_leave), inactive: n0(st.inactive), total: n0(st.total),
        piecesInHand: n0(st.pieces_in_hand), capacity: n0(st.capacity), unpaid: n0(st.unpaid), onTimeRate: st.on_time_rate ?? null,
      } as DorjiStats,
    }
  }),
  saveDorji: (id: number | null, data: DorjiPayload) =>
    (id ? client.put(`/tailor/dorjis/${id}`, dorjiBody(data)) : client.post("/tailor/dorjis", dorjiBody(data))).then((r) => dorjiRow(r.data?.data)),
  patchDorji: (id: number, data: Partial<DorjiPayload>) => client.put(`/tailor/dorjis/${id}`, dorjiBody(data)).then((r) => dorjiRow(r.data?.data)),
  deleteDorji: (id: number) => client.delete(`/tailor/dorjis/${id}`),

  // Assignments
  getBoard: (params?: Record<string, any>) => client.get("/tailor/assignments/board", { params }).then((r) => {
    const st = r.data?.meta?.stats ?? {}
    const c = st.counts ?? {}
    return {
      rows: (r.data?.data ?? []).map(assignmentRow) as AssignmentRow[],
      pagination: (r.data?.meta?.pagination ?? { page: 1, per_page: 10, total: 0, last_page: 1 }) as Pagination,
      stats: {
        counts: { all: n0(c.all), assigned: n0(c.assigned), in_progress: n0(c.in_progress), completed: n0(c.completed), returned: n0(c.returned), paid: n0(c.paid) },
        payPending: n0(st.pay_pending), payPendingJobs: n0(st.pay_pending_jobs), unassignedOrders: n0(st.unassigned_orders),
        firstUnassigned: st.first_unassigned ? orderOption(st.first_unassigned) : null,
      } as AssignmentStats,
    }
  }),
  getAssignmentOptions: () => client.get("/tailor/assignments/options").then((r) => ({
    orders: (r.data?.data?.orders ?? []).map(orderOption) as AssignmentOrderOption[],
    dorjis: (r.data?.data?.dorjis ?? []).map((d: any): AssignmentDorjiOption => ({
      id: d.id, name: d.name, status: d.status, maxPieces: d.max_pieces ?? null, ratePerPiece: n0(d.rate_per_piece), piecesInHand: n0(d.pieces_in_hand),
    })),
  })),
  assign: (data: AssignmentPayload) => client.post("/tailor/assignments", assignmentBody(data)),
  patchAssignment: (id: number, data: AssignmentPayload) => {
    const b: Record<string, any> = {}
    const src = assignmentBody(data) as Record<string, any>
    for (const k of Object.keys(src)) if (src[k] !== undefined && !["order_id", "assigned_date", "force"].includes(k)) b[k] = src[k]
    return client.put(`/tailor/assignments/${id}`, b).then((r) => ({
      row: assignmentRow(r.data?.data),
      orderAllDone: !!r.data?.meta?.order_all_done, orderId: r.data?.meta?.order_id as number | undefined,
      orderNumber: r.data?.meta?.order_number as string | undefined, orderMovedBack: !!r.data?.meta?.order_moved_back,
    }))
  },
  deleteAssignment: (id: number) => client.delete(`/tailor/assignments/${id}`),

  // Measurements
  getMeasurementCustomers: (params?: Record<string, any>) => client.get("/tailor/measurements/customers", { params }).then((r) => ({
    rows: ((r.data?.data ?? []) as any[]).map((c: any): MeasurementCustomer => ({
      id: c.id, name: c.name, phone: c.phone, address: c.address ?? null, garments: c.garments ?? [], setsCount: n0(c.sets_count), lastMeasuredAt: c.last_measured_at ?? null,
    })),
    pagination: (r.data?.meta?.pagination ?? { page: 1, per_page: 10, total: 0, last_page: 1 }) as Pagination,
  })),
  getMeasurementSets: (customerId: number) => client.get(`/tailor/measurements/customer/${customerId}/sets`).then((r) => (r.data?.data ?? []).map(measurementSet) as MeasurementSet[]),
  saveMeasurement: (id: number | null, d: MeasurementPayload) => {
    const body = {
      customer_id: d.customerId, product_type: d.productType, label: d.label || null, unit: d.unit, fit_preference: d.fitPreference,
      notes: d.notes || null, measured_at: d.measuredAt, values: d.values, custom_fields: d.customFields,
    }
    return (id ? client.put(`/tailor/measurements/${id}`, body) : client.post("/tailor/measurements", body)).then((r) => measurementSet(r.data?.data))
  },
  deleteMeasurement: (id: number) => client.delete(`/tailor/measurements/${id}`),
  addCustomer: (data: { name: string; phone: string }) => client.post("/tailor/customers", data).then((r) => r.data?.data as { id: number; name: string; phone: string }),
}

// ─── Orders board / new order (Tailor orders screens) ────────────────────────

export type TailorStage = "new" | "cutting" | "stitching" | "trial" | "ready" | "delivered" | "cancelled"

export const TAILOR_STAGES: { id: Exclude<TailorStage, "cancelled">; label: string }[] = [
  { id: "new", label: "Received" }, { id: "cutting", label: "Cutting" }, { id: "stitching", label: "Stitching" },
  { id: "trial", label: "Trial" }, { id: "ready", label: "Ready" }, { id: "delivered", label: "Delivered" },
]
export const TAILOR_STAGE_LABEL: Record<TailorStage, string> = {
  new: "Received", cutting: "Cutting", stitching: "Stitching", trial: "Trial", ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
}
export const TAILOR_PAY_METHODS: { id: string; label: string }[] = [
  { id: "cash", label: "Cash" }, { id: "bank", label: "Bank transfer" }, { id: "bkash", label: "bKash" },
  { id: "nagad", label: "Nagad" }, { id: "card", label: "Card" },
]
export const tailorMethodLabel = (m?: string) =>
  TAILOR_PAY_METHODS.find((x) => x.id === (m ?? "").toLowerCase())?.label ?? (m ? m.charAt(0).toUpperCase() + m.slice(1) : "—")

export interface TailorBoardRow {
  id: number
  orderNumber: string
  trackingToken?: string
  isUrgent: boolean
  customer: { id: number; name: string; phone: string; address?: string } | null
  itemsSummary: string
  itemsCount: number
  orderStatus: string
  stage: TailorStage
  /** 0..5 position in the pipeline, -1 when cancelled */
  stageIndex: number
  nextStage: TailorStage | null
  progress: { done: number; total: number }
  dorjiNames: string[]
  orderDate?: string
  deliveryDate?: string
  daysLeft: number | null
  totalAmount: number
  paidAmount: number
  dueAmount: number
  paymentStatus: TailorPaymentStatus
  notes?: string
}

export interface TailorBoardStats {
  openOrders: number
  readyForPickup: number
  dueIn7Days: number
  overdue: number
  balanceToCollect: number
  balanceOrders: number
}

export interface TailorBoardResponse {
  orders: TailorBoardRow[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
  stats: TailorBoardStats
  statusCounts: Record<"open" | TailorStage, number>
}

export interface TailorDetailItem {
  id: number
  productType: string
  quantity: number
  stitchingPrice: number
  fabricSource: "own" | "shop"
  ownFabricNote?: string
  fabric: { id: number; name: string; unit: string } | null
  fabricQuantity: number
  fabricUnitPrice: number
  fabricCharge: number
  lineTotal: number
  styleOptions: string[]
  notes?: string
  measurement: TailorMeasurement | null
}

export interface TailorOrderDetail extends TailorBoardRow {
  notes?: string
  /** shop fabric already taken out of stock (order moved past Received) */
  fabricDeducted: boolean
  charges: { stitching: number; stitchingOrderLevel: number; fabric: number; urgent: number; extra: number; discount: number; total: number; paid: number; due: number }
  items: TailorDetailItem[]
  assignments: { id: number; dorjiId: number; dorjiName?: string; workStatus: TailorWorkStatus; dorjiCharge: number; expectedCompletion?: string; adminNotes?: string; task?: string; pieces?: number }[]
  payments: { id: number; amount: number; paymentMethod: string; paymentDate: string; reference?: string; notes?: string; paymentType?: string }[]
  statusLogs: { id: number; fromStatus?: string; toStatus: string; note?: string; createdAt: string }[]
}

export interface TailorOrderFormOptions {
  garments: { productType: string; lastPrice: number; avgFabricEach: number }[]
  dorjis: { id: number; name: string; phone?: string; speciality: string[]; open: number }[]
  urgentFee: number
  dueByDate: Record<string, number>
}

export interface PlaceTailorOrderPayload {
  customerId?: number
  customerName?: string
  customerPhone?: string
  customerAddress?: string
  orderDate: string
  deliveryDate: string
  isUrgent: boolean
  dorjiId?: number
  notes?: string
  extraCharge: number
  discount: number
  advancePayment: number
  advancePaymentMethod: string
  items: {
    productType: string
    quantity: number
    stitchingPrice: number
    fabricSource: "own" | "shop"
    fabricId?: number
    fabricQuantity?: number
    fabricUnitPrice?: number
    ownFabricNote?: string
    measurementId?: number
    styleOptions?: string[]
    notes?: string
  }[]
}

const boardRowFromSnake = (d: any): TailorBoardRow => ({
  id: d.id, orderNumber: d.order_number, trackingToken: d.tracking_token, isUrgent: !!d.is_urgent,
  customer: d.customer ?? null, itemsSummary: d.items_summary ?? "", itemsCount: d.items_count ?? 0,
  orderStatus: d.order_status, stage: d.stage, stageIndex: d.stage_index ?? 0, nextStage: d.next_stage ?? null,
  progress: d.progress ?? { done: 0, total: 0 }, dorjiNames: d.dorji_names ?? [],
  orderDate: d.order_date ?? undefined, deliveryDate: d.delivery_date ?? undefined, daysLeft: d.days_left ?? null,
  totalAmount: Number(d.total_amount ?? 0), paidAmount: Number(d.paid_amount ?? 0), dueAmount: Number(d.due_amount ?? 0),
  paymentStatus: d.payment_status, notes: d.notes ?? undefined,
})

const orderDetailFromSnake = (d: any): TailorOrderDetail => ({
  ...boardRowFromSnake(d),
  notes: d.notes ?? undefined,
  fabricDeducted: !!d.fabric_deducted,
  charges: {
    stitching: d.charges.stitching, stitchingOrderLevel: d.charges.stitching_order_level, fabric: d.charges.fabric,
    urgent: d.charges.urgent, extra: d.charges.extra, discount: d.charges.discount,
    total: d.charges.total, paid: d.charges.paid, due: d.charges.due,
  },
  items: (d.items ?? []).map((i: any): TailorDetailItem => ({
    id: i.id, productType: i.product_type, quantity: i.quantity, stitchingPrice: i.stitching_price,
    fabricSource: i.fabric_source, ownFabricNote: i.own_fabric_note ?? undefined, fabric: i.fabric,
    fabricQuantity: i.fabric_quantity, fabricUnitPrice: i.fabric_unit_price, fabricCharge: i.fabric_charge,
    lineTotal: i.line_total, styleOptions: i.style_options ?? [], notes: i.notes ?? undefined,
    measurement: i.measurement ? measurementFromSnake(i.measurement) : null,
  })),
  assignments: (d.assignments ?? []).map((a: any) => ({
    id: a.id, dorjiId: a.dorji_id, dorjiName: a.dorji_name, workStatus: a.work_status, dorjiCharge: a.dorji_charge,
    expectedCompletion: a.expected_completion ?? undefined, adminNotes: a.admin_notes ?? undefined,
    task: a.task ?? undefined, pieces: a.pieces ?? undefined,
  })),
  payments: (d.payments ?? []).map((p: any) => ({
    id: p.id, amount: p.amount, paymentMethod: p.payment_method, paymentDate: p.payment_date,
    reference: p.reference ?? undefined, notes: p.notes ?? undefined, paymentType: p.payment_type ?? undefined,
  })),
  statusLogs: (d.status_logs ?? []).map((s: any) => ({
    id: s.id, fromStatus: s.from_status ?? undefined, toStatus: s.to_status, note: s.note ?? undefined, createdAt: s.created_at,
  })),
})

export const tailorOrdersApi = {
  board: (params: Record<string, any>): Promise<TailorBoardResponse> =>
    client.get("/tailor/orders/board", { params }).then((r) => {
      const d = r.data?.data ?? {}
      const s = d.stats ?? {}
      return {
        orders: (d.orders ?? []).map(boardRowFromSnake),
        pagination: { page: d.pagination?.page ?? 1, perPage: d.pagination?.per_page ?? 10, total: d.pagination?.total ?? 0, lastPage: d.pagination?.last_page ?? 1 },
        stats: {
          openOrders: s.open_orders ?? 0, readyForPickup: s.ready_for_pickup ?? 0, dueIn7Days: s.due_in_7_days ?? 0,
          overdue: s.overdue ?? 0, balanceToCollect: s.balance_to_collect ?? 0, balanceOrders: s.balance_orders ?? 0,
        },
        statusCounts: d.status_counts ?? {},
      }
    }),
  detail: (id: number): Promise<TailorOrderDetail> =>
    client.get(`/tailor/orders/${id}/detail`).then((r) => orderDetailFromSnake(r.data?.data)),
  formOptions: (): Promise<TailorOrderFormOptions> =>
    client.get("/tailor/orders/form-options").then((r) => {
      const d = r.data?.data ?? {}
      return {
        garments: (d.garments ?? []).map((g: any) => ({ productType: g.product_type, lastPrice: g.last_price, avgFabricEach: g.avg_fabric_each })),
        dorjis: (d.dorjis ?? []).map((x: any) => ({ id: x.id, name: x.name, phone: x.phone, speciality: x.speciality ?? [], open: x.open_orders ?? 0 })),
        urgentFee: d.urgent_fee ?? 0,
        dueByDate: d.due_by_date ?? {},
      }
    }),
  place: (p: PlaceTailorOrderPayload) =>
    client.post("/tailor/orders/place", {
      customer_id: p.customerId, customer_name: p.customerName, customer_phone: p.customerPhone, customer_address: p.customerAddress,
      order_date: p.orderDate, delivery_date: p.deliveryDate, is_urgent: p.isUrgent, dorji_id: p.dorjiId, notes: p.notes,
      extra_charge: p.extraCharge, discount: p.discount, advance_payment: p.advancePayment, advance_payment_method: p.advancePaymentMethod,
      items: p.items.map((i) => ({
        product_type: i.productType, quantity: i.quantity, stitching_price: i.stitchingPrice, fabric_source: i.fabricSource,
        fabric_id: i.fabricId, fabric_quantity: i.fabricQuantity, fabric_unit_price: i.fabricUnitPrice, own_fabric_note: i.ownFabricNote,
        measurement_id: i.measurementId, style_options: i.styleOptions, notes: i.notes,
      })),
    }).then((r) => r.data?.data as { id: number; order_number: string }),
  /** Delivering always collects the remaining balance in cash (server side). */
  transition: (id: number, status: TailorStage, note?: string) =>
    client.patch(`/tailor/orders/${id}/transition`, { status, note: note || undefined }),
  recordPayment: (id: number, p: { amount: number; paymentMethod: string; paymentDate: string; reference?: string; notes?: string }) =>
    client.post(`/tailor/orders/${id}/payments`, {
      amount: p.amount, payment_method: p.paymentMethod, payment_date: p.paymentDate, reference: p.reference || undefined, notes: p.notes || undefined,
    }),
}

/** Per-customer order history used by the new-order screen (count + outstanding balance). */
export const tailorCustomerSummary = (customerId: number): Promise<{ orders: number; due: number }> =>
  client.get(`/tailor/customers/${customerId}/orders`).then((r) => {
    const list: any[] = Array.isArray(r.data?.data) ? r.data.data : []
    return {
      orders: list.length,
      due: list.filter((o) => o.order_status !== "cancelled").reduce((a, o) => a + Math.max(0, Number(o.total_amount ?? 0) - Number(o.paid_amount ?? 0)), 0),
    }
  })
