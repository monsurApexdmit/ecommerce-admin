export type DashboardFilters = {
  from: string
  to: string
  locationId?: number
}

export interface AlertsData {
  pendingOrders: { count: number; oldestOrderTime: string | null }
  stock: { outOfStock: number; belowReorder: number }
  salaries: SalaryStatus
}

export interface SalaryStatus {
  month: string
  budget: number
  paid: number
  unpaid: number
  dueDate: string
  daysLeft: number
  /** unpaid payslips (any month) */
  payslips?: number
  /** payslips generated for the current month */
  generated?: number
  nextDue?: string | null
}

export interface KpisData {
  range: { from: string; to: string; bucket: "hour" | "day" | "month" }
  revenue: { value: number; deltaPct: number | null; orders: number; series: number[] }
  grossProfit: {
    value: number
    deltaPct: number | null
    marginPct: number | null
    costCoveragePct: number | null
    series: number[]
  }
  orders: { value: number; deltaPct: number | null; aov: number; delivered: number; pending: number; series: number[] }
  inventory: { valueAtCost: number; units: number; skus: number; series: null }
  receivable: { value: number; openInvoices: number; overdue: number; debtors?: number }
  payable: { value: number; vendors: number; vendorCount: number; salaries: number; nextDue: string | null }
}

export interface RevenueData {
  bucket: "hour" | "day" | "month"
  buckets: { key: string; revenue: number; grossProfit: number }[]
  best: { key: string; revenue: number } | null
  footer: {
    aov: number
    grossMarginPct: number | null
    returnsRatePct: number | null
    discounts: number
  }
}

export interface PipelineData {
  stages: { key: "pending" | "confirmed" | "packed" | "shipped" | "delivered"; count: number }[]
  open: number
  oldestPendingTime: string | null
}

export interface StockHealthData {
  skus: number
  units: number
  segments: { healthy: number; low: number; out: number; overstock: number }
  overstockRule: string
  turnover: number | null
  daysOfInventory: number | null
  sellThroughPct: number | null
  deadStock: { skus: number; value: number }
}

export interface ReorderItem {
  productId: number
  name: string
  sku: string | null
  onHand: number
  avgDailySales: number
  daysOfCover: number | null
  suggestedQty: number
  basis: "velocity" | "reorder_point"
  vendorId: number | null
  vendorName: string | null
  leadTimeDays: number
  leadTimeIsDefault: boolean
  safetyDays?: number
}

export interface ReorderData {
  total: number
  items: ReorderItem[]
  defaults: { leadTimeDays: number; safetyDays: number }
}

export interface TopProductsData {
  items: { productId: number | null; name: string; revenue: number; units: number }[]
  slowMovers: { skus: number; value: number }
}

export interface ChannelsData {
  channels: { key: string; orders: number; revenue: number }[]
  paymentMethods: { method: string; orders: number; revenue: number }[]
}

export interface ObligationsData {
  month: string
  cashIn: number
  dueThisMonth: number
  salaries: SalaryStatus
  vendors: { due: number; vendorCount: number; orders: number; totalOrdered: number; totalPaid: number }
  receivables: { due: number; openInvoices: number; salesTotal: number }
  expenses: { amount: number; count: number }
}

export interface RecentOrder {
  id: number
  invoiceNo: string
  customerName: string
  channel: string
  method: string
  paymentStatus: string
  amount: number
  status: string
  orderTime: string
}

export interface RecentOrdersData {
  items: RecentOrder[]
}

export interface ActivityData {
  items: { type: string; text: string; createdAt: string }[]
}

export interface SectionMap {
  alerts: AlertsData
  kpis: KpisData
  revenue: RevenueData
  pipeline: PipelineData
  "stock-health": StockHealthData
  reorder: ReorderData
  "top-products": TopProductsData
  channels: ChannelsData
  obligations: ObligationsData
  "recent-orders": RecentOrdersData
  activity: ActivityData
}

export type SectionKey = keyof SectionMap
