export type TailorFabricStatus = "active" | "inactive"
export type TailorDorjiStatus = "active" | "inactive"
export type TailorPaymentStatus = "unpaid" | "partial" | "paid"
export type TailorOrderStatus =
  | "pending" | "measurement_taken" | "assigned"
  | "cutting" | "stitching" | "ready" | "delivered" | "cancelled"
export type TailorWorkStatus = "assigned" | "in_progress" | "completed" | "returned"

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
  unit: "goj" | "gaj"
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
  commissionType: "fixed" | "percentage"
  commissionValue: number
  status: TailorDorjiStatus
  notes?: string
  activeOrders?: number
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
}

export interface TailorPayment {
  id: number
  orderId: number
  amount: number
  paymentMethod: string
  paymentDate: string
  reference?: string
  notes?: string
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
  returned: "Returned",
}

export const PRODUCT_TYPES = [
  "Pajama", "Jama", "Panjabi", "Shirt", "Pants",
  "Blouse", "Shalwar Kameez", "Kurta", "Coat", "Other",
]
