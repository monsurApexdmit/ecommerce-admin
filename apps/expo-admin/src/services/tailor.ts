import { api } from "@/lib/api"
import type {
  TailorFabric, TailorCustomer, TailorMeasurement, TailorDorji,
  TailorOrder, TailorAssignment, TailorPayment, TailorDashboardStats,
  TailorOrderStatus, TailorWorkStatus,
  TailorBoardRow, TailorBoardResponse, TailorOrderDetail, TailorOrderFormOptions, PlaceTailorOrderPayload,
  TailorStage, TailorDashboardData, TailorAssignmentRow, TailorAssignmentOrderOption, TailorAssignmentDorjiOption,
  TailorAssignmentPayload, TailorLedger, TailorLedgerKind, TailorLedgerRow, TailorPayableOption, TailorRecordPaymentInput,
} from "@/types/tailor"

// ── Normalizers ────────────────────────────────────────────────────────────

function normFabric(d: any): TailorFabric {
  return {
    id: d.id, companyId: d.company_id, name: d.name,
    fabricType: d.fabric_type, color: d.color, pattern: d.pattern, unit: d.unit || "m",
    code: d.code ?? undefined, hexColor: d.hex_color ?? undefined,
    reorderLevel: d.reorder_level != null ? Number(d.reorder_level) : undefined,
    purchasePrice: Number(d.purchase_price ?? 0), sellingPrice: Number(d.selling_price ?? 0),
    stockQuantity: Number(d.stock_quantity ?? 0), vendorId: d.vendor_id,
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
    notes: d.notes, activeOrders: d.active_orders, maxPieces: d.max_pieces ?? null,
  }
}

function normAssignment(d: any): TailorAssignment {
  return {
    id: d.id, orderId: d.order_id, dorjiId: d.dorji_id,
    dorji: d.dorji ? normDorji(d.dorji) : undefined,
    assignedDate: d.assigned_date, expectedCompletion: d.expected_completion,
    dorjiCharge: Number(d.dorji_charge ?? 0), workStatus: d.work_status, adminNotes: d.admin_notes,
    task: d.task ?? undefined, pieces: d.pieces ?? undefined,
    ratePerPiece: d.rate_per_piece != null ? Number(d.rate_per_piece) : undefined,
    paidAmount: d.paid_amount != null ? Number(d.paid_amount) : undefined,
  }
}

function normPayment(d: any): TailorPayment {
  return {
    id: d.id, orderId: d.order_id, amount: d.amount ?? 0,
    paymentMethod: d.payment_method, paymentDate: d.payment_date,
    reference: d.reference, notes: d.notes, paymentType: d.payment_type ?? undefined,
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

/** First validation message, else the server message, else the fallback. */
export function tailorApiError(e: any, fallback: string): string {
  const errs = e?.response?.data?.errors
  if (errs && typeof errs === "object") {
    const first = Object.values(errs)[0] as any
    if (Array.isArray(first) && first[0]) return String(first[0])
    if (typeof first === "string" && first) return first
  }
  return e?.response?.data?.message ?? fallback
}

export async function getTailorDashboardData(): Promise<TailorDashboardData> {
  const r = await api.get("/tailor/dashboard")
  const d = r.data?.data ?? {}
  return {
    kpis: d.kpis ?? [], board: d.board ?? [], dues: d.dues ?? [], workload: d.workload ?? [],
    advice: d.advice ?? null, fabric_alerts: d.fabric_alerts ?? [], recent_orders: d.recent_orders ?? [],
    due_soon: d.due_soon ?? [], has_orders: !!d.has_orders,
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
    code: data.code, hex_color: data.hexColor, reorder_level: data.reorderLevel,
  })
  return normFabric(r.data?.data ?? r.data)
}

export async function updateTailorFabric(id: number, data: Partial<TailorFabric>): Promise<TailorFabric> {
  const r = await api.put(`/tailor/fabrics/${id}`, {
    name: data.name, fabric_type: data.fabricType, color: data.color,
    pattern: data.pattern, unit: data.unit,
    purchase_price: data.purchasePrice, selling_price: data.sellingPrice,
    stock_quantity: data.stockQuantity, vendor_id: data.vendorId, status: data.status,
    code: data.code, hex_color: data.hexColor, reorder_level: data.reorderLevel,
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

export async function updateTailorOrder(id: number, data: Record<string, any>): Promise<TailorOrder> {
  const r = await api.put(`/tailor/orders/${id}`, data)
  return normOrder(r.data?.data ?? r.data)
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
    max_pieces: data.maxPieces ?? null,
  })
  return normDorji(r.data?.data ?? r.data)
}

export async function updateTailorDorji(id: number, data: Partial<TailorDorji>): Promise<TailorDorji> {
  const r = await api.put(`/tailor/dorjis/${id}`, {
    name: data.name, phone: data.phone, address: data.address,
    speciality: data.speciality, commission_type: data.commissionType,
    commission_value: data.commissionValue, status: data.status, notes: data.notes,
    max_pieces: data.maxPieces ?? null,
  })
  return normDorji(r.data?.data ?? r.data)
}

export async function deleteTailorDorji(id: number): Promise<void> {
  await api.delete(`/tailor/dorjis/${id}`)
}

export async function deleteTailorMeasurement(id: number): Promise<void> {
  await api.delete(`/tailor/measurements/${id}`)
}

/** Measurement sets of one customer, each with how many orders use it. */
export async function getMeasurementSetUsage(customerId: number): Promise<Record<number, number>> {
  const r = await api.get(`/tailor/measurements/customer/${customerId}/sets`)
  const out: Record<number, number> = {}
  for (const m of (r.data?.data ?? []) as any[]) out[m.id] = Number(m.used_by_orders ?? 0)
  return out
}

// ── Orders board / detail / new order ─────────────────────────────────────

function normBoardRow(d: any): TailorBoardRow {
  return {
    id: d.id, orderNumber: d.order_number, trackingToken: d.tracking_token ?? undefined, isUrgent: !!d.is_urgent,
    customer: d.customer ?? null, itemsSummary: d.items_summary ?? "", itemsCount: d.items_count ?? 0,
    orderStatus: d.order_status, stage: d.stage ?? "new", stageIndex: d.stage_index ?? 0, nextStage: d.next_stage ?? null,
    progress: d.progress ?? { done: 0, total: 0 }, dorjiNames: d.dorji_names ?? [],
    orderDate: d.order_date ?? undefined, deliveryDate: d.delivery_date ?? undefined, daysLeft: d.days_left ?? null,
    totalAmount: Number(d.total_amount ?? 0), paidAmount: Number(d.paid_amount ?? 0), dueAmount: Number(d.due_amount ?? 0),
    paymentStatus: d.payment_status ?? "unpaid", notes: d.notes ?? undefined,
  }
}

export async function getTailorBoard(params: Record<string, any>): Promise<TailorBoardResponse> {
  const r = await api.get("/tailor/orders/board", { params })
  const d = r.data?.data ?? {}
  const st = d.stats ?? {}
  return {
    orders: (d.orders ?? []).map(normBoardRow),
    pagination: { page: d.pagination?.page ?? 1, perPage: d.pagination?.per_page ?? 10, total: d.pagination?.total ?? 0, lastPage: d.pagination?.last_page ?? 1 },
    stats: {
      openOrders: st.open_orders ?? 0, readyForPickup: st.ready_for_pickup ?? 0, dueIn7Days: st.due_in_7_days ?? 0,
      overdue: st.overdue ?? 0, balanceToCollect: Number(st.balance_to_collect ?? 0), balanceOrders: st.balance_orders ?? 0,
    },
    statusCounts: d.status_counts ?? {},
  }
}

export async function getTailorOrderDetail(id: number): Promise<TailorOrderDetail> {
  const r = await api.get(`/tailor/orders/${id}/detail`)
  const d = r.data?.data ?? {}
  const c = d.charges ?? {}
  const n = (v: any) => Number(v ?? 0)
  return {
    ...normBoardRow(d),
    fabricDeducted: !!d.fabric_deducted,
    charges: {
      stitching: n(c.stitching), stitchingOrderLevel: n(c.stitching_order_level), fabric: n(c.fabric), urgent: n(c.urgent),
      extra: n(c.extra), discount: n(c.discount), total: n(c.total), paid: n(c.paid), due: n(c.due),
    },
    items: (d.items ?? []).map((i: any) => ({
      id: i.id, productType: i.product_type, quantity: i.quantity ?? 1, stitchingPrice: n(i.stitching_price),
      fabricSource: i.fabric_source === "shop" ? "shop" : "own", ownFabricNote: i.own_fabric_note ?? undefined, fabric: i.fabric ?? null,
      fabricQuantity: n(i.fabric_quantity), fabricUnitPrice: n(i.fabric_unit_price), fabricCharge: n(i.fabric_charge),
      lineTotal: n(i.line_total), styleOptions: i.style_options ?? [], notes: i.notes ?? undefined,
      measurement: i.measurement ? normMeasurement(i.measurement) : null,
    })),
    assignments: (d.assignments ?? []).map((a: any) => ({
      id: a.id, dorjiId: a.dorji_id, dorjiName: a.dorji_name ?? undefined, workStatus: a.work_status, dorjiCharge: n(a.dorji_charge),
      expectedCompletion: a.expected_completion ?? undefined, adminNotes: a.admin_notes ?? undefined,
      task: a.task ?? undefined, pieces: a.pieces ?? undefined,
    })),
    payments: (d.payments ?? []).map((p: any) => ({
      id: p.id, amount: n(p.amount), paymentMethod: p.payment_method, paymentDate: p.payment_date,
      reference: p.reference ?? undefined, notes: p.notes ?? undefined, paymentType: p.payment_type ?? undefined,
    })),
    statusLogs: (d.status_logs ?? []).map((l: any) => ({
      id: l.id, fromStatus: l.from_status ?? undefined, toStatus: l.to_status, note: l.note ?? undefined, createdAt: l.created_at,
    })),
  }
}

export async function getTailorOrderFormOptions(): Promise<TailorOrderFormOptions> {
  const r = await api.get("/tailor/orders/form-options")
  const d = r.data?.data ?? {}
  return {
    garments: (d.garments ?? []).map((g: any) => ({ productType: g.product_type, lastPrice: Number(g.last_price ?? 0), avgFabricEach: Number(g.avg_fabric_each ?? 0) })),
    dorjis: (d.dorjis ?? []).map((x: any) => ({ id: x.id, name: x.name, phone: x.phone, speciality: x.speciality ?? [], open: x.open_orders ?? 0 })),
    urgentFee: Number(d.urgent_fee ?? 0),
    dueByDate: d.due_by_date ?? {},
  }
}

/** Creates the order. Shop fabric is NOT taken from stock here — that happens when the order first moves past Received. */
export async function placeTailorOrder(p: PlaceTailorOrderPayload): Promise<{ id: number; order_number: string }> {
  const r = await api.post("/tailor/orders/place", {
    customer_id: p.customerId, customer_name: p.customerName, customer_phone: p.customerPhone, customer_address: p.customerAddress,
    order_date: p.orderDate, delivery_date: p.deliveryDate, is_urgent: p.isUrgent, dorji_id: p.dorjiId, notes: p.notes,
    extra_charge: p.extraCharge, discount: p.discount, advance_payment: p.advancePayment, advance_payment_method: p.advancePaymentMethod,
    items: p.items.map((i) => ({
      product_type: i.productType, quantity: i.quantity, stitching_price: i.stitchingPrice, fabric_source: i.fabricSource,
      fabric_id: i.fabricId, fabric_quantity: i.fabricQuantity, fabric_unit_price: i.fabricUnitPrice, own_fabric_note: i.ownFabricNote,
      measurement_id: i.measurementId, style_options: i.styleOptions, notes: i.notes,
    })),
  })
  return r.data?.data
}

/**
 * Move an order to a stage. Delivering always collects the remaining balance in cash (server side).
 * Moving past Received can fail with 422 "Not enough <fabric>: need X, only Y in stock".
 */
export async function transitionTailorOrder(id: number, status: TailorStage, note?: string): Promise<void> {
  await api.patch(`/tailor/orders/${id}/transition`, { status, note: note || undefined })
}

export async function recordTailorOrderPayment(
  id: number,
  p: { amount: number; paymentMethod: string; paymentDate: string; reference?: string; notes?: string },
): Promise<void> {
  await api.post(`/tailor/orders/${id}/payments`, {
    amount: p.amount, payment_method: p.paymentMethod, payment_date: p.paymentDate,
    reference: p.reference || undefined, notes: p.notes || undefined,
  })
}

// ── Assignments board (one job per line: task × pieces @ rate) ────────────

const n0 = (v: any) => Number(v) || 0

function normAssignmentRow(a: any): TailorAssignmentRow {
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

function normOrderOption(o: any): TailorAssignmentOrderOption {
  return {
    id: o.id, orderNumber: o.order_number, customerName: o.customer_name ?? null, deliveryDate: o.delivery_date ?? null,
    garments: o.garments ?? "", task: o.task ?? "", pieces: n0(o.pieces), unassigned: !!o.unassigned,
  }
}

export async function getTailorAssignmentBoard(params?: Record<string, any>): Promise<{
  rows: TailorAssignmentRow[]
  pagination: { page: number; perPage: number; total: number; lastPage: number }
  counts: Record<"all" | TailorWorkStatus, number>
  payPending: number
  unassignedOrders: number
}> {
  const r = await api.get("/tailor/assignments/board", { params })
  const st = r.data?.meta?.stats ?? {}
  const c = st.counts ?? {}
  const pg = r.data?.meta?.pagination ?? {}
  return {
    rows: (r.data?.data ?? []).map(normAssignmentRow),
    pagination: { page: pg.page ?? 1, perPage: pg.per_page ?? 20, total: pg.total ?? 0, lastPage: pg.last_page ?? 1 },
    counts: { all: n0(c.all), assigned: n0(c.assigned), in_progress: n0(c.in_progress), completed: n0(c.completed), returned: n0(c.returned), paid: n0(c.paid) },
    payPending: n0(st.pay_pending),
    unassignedOrders: n0(st.unassigned_orders),
  }
}

export async function getTailorAssignmentOptions(): Promise<{ orders: TailorAssignmentOrderOption[]; dorjis: TailorAssignmentDorjiOption[] }> {
  const r = await api.get("/tailor/assignments/options")
  return {
    orders: (r.data?.data?.orders ?? []).map(normOrderOption),
    dorjis: (r.data?.data?.dorjis ?? []).map((d: any) => ({
      id: d.id, name: d.name, status: d.status, maxPieces: d.max_pieces ?? null, ratePerPiece: n0(d.rate_per_piece), piecesInHand: n0(d.pieces_in_hand),
    })),
  }
}

const assignmentBody = (a: TailorAssignmentPayload) => ({
  order_id: a.orderId, dorji_id: a.dorjiId, assigned_date: a.assignedDate, expected_completion: a.expectedCompletion,
  task: a.task, pieces: a.pieces, rate_per_piece: a.ratePerPiece, admin_notes: a.adminNotes, work_status: a.workStatus, force: a.force,
})

/** Throws with status 409 when the dorji is over capacity — confirm, then resend with force: true. */
export async function assignTailorWork(data: TailorAssignmentPayload): Promise<void> {
  await api.post("/tailor/assignments", assignmentBody(data))
}

export async function patchTailorAssignment(id: number, data: TailorAssignmentPayload): Promise<{
  orderAllDone: boolean; orderId?: number; orderNumber?: string; orderMovedBack: boolean
}> {
  const src = assignmentBody(data) as Record<string, any>
  const body: Record<string, any> = {}
  for (const k of Object.keys(src)) if (src[k] !== undefined && !["order_id", "assigned_date", "force"].includes(k)) body[k] = src[k]
  const r = await api.put(`/tailor/assignments/${id}`, body)
  const m = r.data?.meta ?? {}
  return { orderAllDone: !!m.order_all_done, orderId: m.order_id, orderNumber: m.order_number, orderMovedBack: !!m.order_moved_back }
}

/** Paid jobs cannot be deleted (422). */
export async function deleteTailorAssignment(id: number): Promise<void> {
  await api.delete(`/tailor/assignments/${id}`)
}

// ── Payments ledger ────────────────────────────────────────────────────────

export async function getTailorPaymentLedger(params?: Record<string, any>): Promise<TailorLedger> {
  const r = await api.get("/tailor/payments/ledger", { params })
  const d = r.data?.data ?? {}
  const st = d.stats ?? {}
  return {
    data: (d.data ?? []).map((x: any): TailorLedgerRow => ({
      id: x.id, kind: x.kind, paymentDate: x.payment_date, who: x.who,
      orderId: x.order_id, orderNumber: x.order_number, dorjiId: x.dorji_id,
      type: x.type, typeLabel: x.type_label, method: x.method, methodLabel: x.method_label,
      amount: Number(x.amount ?? 0), reference: x.reference, notes: x.notes, refLabel: x.ref_label ?? "",
    })),
    total: d.total ?? 0,
    totalAmount: Number(d.total_amount ?? 0),
    counts: d.counts ?? { customer: 0, dorji: 0 },
    stats: {
      collectedMonth: n0(st.collected_month), collectedMonthCount: n0(st.collected_month_count),
      toCollect: n0(st.to_collect), toCollectOrders: n0(st.to_collect_orders),
      paidDorjisMonth: n0(st.paid_dorjis_month), paidDorjisCount: n0(st.paid_dorjis_count), owedDorjis: n0(st.owed_dorjis),
    },
  }
}

export async function getTailorPayableOptions(kind: TailorLedgerKind): Promise<TailorPayableOption[]> {
  const r = await api.get("/tailor/payments/options", { params: { kind } })
  return (r.data?.data ?? []).map((x: any) => ({ id: x.id, orderNumber: x.order_number, name: x.name, balance: Number(x.balance ?? 0) }))
}

/** 409 "This … balance changed. Review and retry." when expectedBalance no longer matches. */
export async function recordTailorLedgerPayment(d: TailorRecordPaymentInput): Promise<void> {
  await api.post("/tailor/payments/record", {
    kind: d.kind, order_id: d.orderId, dorji_id: d.dorjiId, amount: d.amount,
    payment_method: d.paymentMethod, payment_date: d.paymentDate,
    reference: d.reference || undefined, notes: d.notes || undefined, expected_balance: d.expectedBalance,
  })
}

/** Reverse a dorji payout (only that dorji's most recent one; also removes its Salaries expense). */
export async function reverseTailorPayout(id: number): Promise<void> {
  await api.delete(`/tailor/payments/${id}`)
}
