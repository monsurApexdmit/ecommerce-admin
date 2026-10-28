export type TailorFabricStatus = "active" | "inactive"
export type TailorDorjiStatus = "active" | "on_leave" | "inactive"
export type TailorPaymentStatus = "unpaid" | "partial" | "paid"
export type TailorOrderStatus =
  | "pending" | "measurement_taken" | "assigned"
  | "cutting" | "stitching" | "trial" | "ready" | "delivered" | "cancelled"
export type TailorWorkStatus = "assigned" | "in_progress" | "completed" | "returned" | "paid"

export interface TailorVendor {
  id: number
  name: string
  phone?: string
}

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
  vendor?: TailorVendor
  imagePath?: string
  status: TailorFabricStatus
}

export interface TailorCustomer {
  id: number
  name: string
  phone: string
  address?: string
  notes?: string
}

export interface TailorMeasurement {
  id: number
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
  notes?: string
  measuredAt: string
}

export interface TailorDorji {
  id: number
  name: string
  phone: string
  address?: string
  speciality?: string[]
  commissionType: "fixed" | "percentage" | "salary"
  commissionValue: number
  status: TailorDorjiStatus
  notes?: string
  activeOrders?: number
  maxPieces?: number | null
}

export interface TailorOrderItem {
  id: number
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
  orderId: number
  dorjiId: number
  dorji?: TailorDorji
  assignedDate: string
  expectedCompletion?: string
  dorjiCharge: number
  workStatus: TailorWorkStatus
  adminNotes?: string
  task?: string
  pieces?: number
  ratePerPiece?: number
  paidAmount?: number
}

export interface TailorPayment {
  id: number
  orderId: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
  paymentType?: string
  order?: Partial<TailorOrder>
}

export interface TailorStatusLog {
  id: number
  fromStatus?: string
  toStatus: string
  note?: string
  createdAt: string
}

export interface TailorOrder {
  id: number
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

export const ORDER_STATUS_LABELS: Record<TailorOrderStatus, string> = {
  pending: "Pending",
  measurement_taken: "Measurement Taken",
  assigned: "Assigned",
  cutting: "Cutting",
  stitching: "Stitching",
  trial: "Trial",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

export const ORDER_STATUS_COLORS: Record<TailorOrderStatus, string> = {
  pending: "#94a3b8",
  measurement_taken: "#3b82f6",
  assigned: "#8b5cf6",
  cutting: "#f59e0b",
  stitching: "#f97316",
  trial: "#0891b2",
  ready: "#22c55e",
  delivered: "#10b981",
  cancelled: "#ef4444",
}

export const PAYMENT_STATUS_COLORS: Record<TailorPaymentStatus, string> = {
  unpaid: "#ef4444",
  partial: "#f59e0b",
  paid: "#22c55e",
}

export const WORK_STATUS_LABELS: Record<TailorWorkStatus, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  completed: "Completed",
  returned: "Returned for fixing",
  paid: "Paid",
}

/** Starter garment list: default stitching price and suggested fabric per piece. Learned history (form options) overrides these. */
export const GARMENT_DEFAULTS: { name: string; price: number; fabric: number }[] = [
  { name: "Shirt", price: 450, fabric: 1.8 }, { name: "Panjabi", price: 650, fabric: 2.5 },
  { name: "Pant", price: 500, fabric: 1.5 }, { name: "Pajama", price: 300, fabric: 2 },
  { name: "Jama", price: 900, fabric: 3.5 }, { name: "Kurta", price: 550, fabric: 2.2 },
  { name: "Blouse", price: 350, fabric: 1 }, { name: "Salwar Kameez", price: 800, fabric: 4 },
  { name: "Coat", price: 2500, fabric: 3.2 }, { name: "Other", price: 0, fabric: 0 },
]
export const PRODUCT_TYPES = GARMENT_DEFAULTS.map((g) => g.name)

/** Loose garment-name match ("Pants" = "Pant", "Shalwar" = "Salwar"). */
export const sameGarment = (a: string, b: string) => {
  const n = (x: string) => x.toLowerCase().replace(/[^a-z]/g, "").replace(/^sh/, "s").replace(/s$/, "")
  return n(a) === n(b)
}

// ─── Order board / detail / new order (stage pipeline) ──────────────────────

export type TailorStage = "new" | "cutting" | "stitching" | "trial" | "ready" | "delivered" | "cancelled"

export const TAILOR_STAGES: { id: Exclude<TailorStage, "cancelled">; label: string }[] = [
  { id: "new", label: "Received" }, { id: "cutting", label: "Cutting" }, { id: "stitching", label: "Stitching" },
  { id: "trial", label: "Trial" }, { id: "ready", label: "Ready" }, { id: "delivered", label: "Delivered" },
]

export const TAILOR_STAGE_LABEL: Record<TailorStage, string> = {
  new: "Received", cutting: "Cutting", stitching: "Stitching", trial: "Trial",
  ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
}

export const TAILOR_STAGE_COLORS: Record<TailorStage, string> = {
  new: "#3b82f6", cutting: "#f59e0b", stitching: "#f97316", trial: "#0891b2",
  ready: "#22c55e", delivered: "#10b981", cancelled: "#ef4444",
}

/** Raw order_status → board stage (pending / measurement_taken / assigned are all "Received"). */
export function stageOf(status?: string | null): TailorStage {
  if (!status || ["pending", "measurement_taken", "assigned"].includes(status)) return "new"
  return (status in TAILOR_STAGE_LABEL ? status : "new") as TailorStage
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

export interface TailorBoardResponse {
  orders: TailorBoardRow[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
  stats: { openOrders: number; readyForPickup: number; dueIn7Days: number; overdue: number; balanceToCollect: number; balanceOrders: number }
  statusCounts: Partial<Record<"open" | TailorStage, number>>
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

/** "Advance" / "Final payment" / "Payment" for a customer payment row. */
export function tailorPayLabel(p: { paymentType?: string; notes?: string }): string {
  if (p.paymentType === "advance" || (!p.paymentType && /advance/i.test(p.notes ?? ""))) return "Advance"
  if (p.paymentType === "final" || (!p.paymentType && /final/i.test(p.notes ?? ""))) return "Final payment"
  return "Payment"
}

// ─── Dashboard (GET /tailor/dashboard) ───────────────────────────────────────

export type TailorTone = "blue" | "teal" | "purple" | "amber" | "red"
export interface TailorKpi {
  label: string; value: number | string; kind: "money" | "int" | "text"
  sub: string; tone: TailorTone; subTone?: "muted" | "red" | "amber" | "teal"
}
export interface TailorDashboardBoardOrder {
  id: number; order_no: string; customer: string; items: string; dorji: string | null
  delivery_date: string | null; days_left: number | null; urgent: boolean
}
export interface TailorDashboardData {
  kpis: TailorKpi[]
  board: { key: TailorStage; label: string; count: number; orders: TailorDashboardBoardOrder[] }[]
  dues: { id: number; order_no: string; customer: string; stage: TailorStage; stage_label: string; phone: string | null; due: number }[]
  workload: { id: number; name: string; open: number; percent: number }[]
  advice: { head: string; body: string } | null
  fabric_alerts: { id: number; name: string; color: string | null; hex_color: string | null; unit: string | null; stock: number; reorder_level: number; out: boolean }[]
  recent_orders: { id: number; order_no: string; customer: string; total: number; stage: TailorStage; stage_label: string; payment: TailorPaymentStatus | null }[]
  due_soon: TailorDashboardBoardOrder[]
  has_orders: boolean
}

// ─── Assignments board ───────────────────────────────────────────────────────

export interface TailorAssignmentRow {
  id: number; orderId: number; dorjiId: number
  orderNumber: string | null; customerName: string | null; orderStatus: string | null
  dorjiName: string | null; dorjiStatus: string | null
  task: string | null; pieces: number; ratePerPiece: number; dorjiCharge: number; paidAmount: number; payable: number
  assignedDate: string | null; expectedCompletion: string | null; dueDate: string | null; completedAt: string | null
  workStatus: TailorWorkStatus; adminNotes: string | null
}
export interface TailorAssignmentOrderOption {
  id: number; orderNumber: string; customerName: string | null; deliveryDate: string | null
  garments: string; task: string; pieces: number; unassigned: boolean
}
export interface TailorAssignmentDorjiOption {
  id: number; name: string; status: TailorDorjiStatus; maxPieces: number | null; ratePerPiece: number; piecesInHand: number
}
export interface TailorAssignmentPayload {
  orderId?: number; dorjiId?: number; assignedDate?: string; expectedCompletion?: string | null
  task?: string; pieces?: number; ratePerPiece?: number; adminNotes?: string | null
  workStatus?: TailorWorkStatus; force?: boolean
}

// ─── Payments ledger ─────────────────────────────────────────────────────────

export type TailorLedgerKind = "customer" | "dorji"
export interface TailorLedgerRow {
  id: number; kind: TailorLedgerKind; paymentDate: string; who: string
  orderId?: number | null; orderNumber?: string | null; dorjiId?: number | null
  type: "advance" | "payment" | "final" | "payout"; typeLabel: string
  method: string; methodLabel: string; amount: number
  reference?: string | null; notes?: string | null; refLabel: string
}
export interface TailorLedger {
  data: TailorLedgerRow[]
  total: number
  totalAmount: number
  counts: Record<TailorLedgerKind, number>
  stats: { collectedMonth: number; collectedMonthCount: number; toCollect: number; toCollectOrders: number; paidDorjisMonth: number; paidDorjisCount: number; owedDorjis: number }
}
export interface TailorPayableOption { id: number; orderNumber?: string; name?: string; balance: number }
export interface TailorRecordPaymentInput {
  kind: TailorLedgerKind; orderId?: number; dorjiId?: number; amount: number
  paymentMethod: string; paymentDate: string; reference?: string; notes?: string
  /** balance the form showed; server answers 409 when it changed meanwhile */
  expectedBalance?: number
}
