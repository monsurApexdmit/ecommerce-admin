import { api } from "@/lib/api";

// ─── Customer Returns ─────────────────────────────────────────────────────────

export type CustomerReturnStatus = "pending" | "approved" | "rejected" | "completed";

/** Refund methods accepted by the API (store credit / none need no refund permission). */
export const CUSTOMER_REFUND_METHODS: Array<{ value: string; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "original_payment", label: "Original payment" },
  { value: "store_credit", label: "Store credit" },
  { value: "none", label: "No refund" },
];

export function refundMethodLabel(value?: string): string {
  if (!value) return "—";
  const v = value === "original" ? "original_payment" : value === "credit" ? "store_credit" : value;
  return CUSTOMER_REFUND_METHODS.find((m) => m.value === v)?.label ?? value.replace(/_/g, " ");
}

export interface CustomerReturnItem {
  id?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  price?: number;
  reason: string;
}

export interface CustomerReturn {
  id: number;
  returnNumber?: string;
  customerId: number;
  customerName?: string;
  sellId?: number;
  orderNumber?: string;
  status: CustomerReturnStatus;
  refundMethod?: string;
  totalAmount?: number;
  notes?: string;
  processedBy?: string;
  processedAt?: string;
  rejectionReason?: string;
  items?: CustomerReturnItem[];
  createdAt: string;
}

export interface CustomerReturnStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  completed: number;
  totalRefundAmount: number;
}

export interface CustomerReturnListResult {
  data: CustomerReturn[];
  total: number;
  page: number;
}

function toAmount(...values: unknown[]): number | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== "") return Number(v);
  }
  return undefined;
}

function normalizeCustomerReturn(r: any): CustomerReturn {
  // List rows use `amount` / `lines` / `invoiceNo` / `note`; the detail adds the legacy fields.
  const items: CustomerReturnItem[] | undefined = Array.isArray(r.items)
    ? r.items.map((i: any) => ({
        id: i.id,
        productId: i.productId ?? i.product_id,
        productName: i.productName ?? i.product_name,
        variantId: i.variantId ?? i.variant_id,
        variantName: i.variantName ?? i.variant_name,
        quantity: Number(i.quantity ?? 0),
        price: toAmount(i.price),
        reason: i.reason ?? "",
      }))
    : Array.isArray(r.lines)
      ? r.lines.map((l: any) => ({
          productId: 0,
          productName: l.name,
          quantity: Number(l.quantity ?? 0),
          price: toAmount(l.price),
          reason: l.reason ?? "",
        }))
      : undefined;
  const status = r.status === "approved" ? "completed" : r.status ?? "pending";
  return {
    id: r.id,
    returnNumber: r.returnNumber ?? r.return_number,
    customerId: r.customerId ?? r.customer_id,
    customerName: r.customerName ?? r.customer_name,
    sellId: r.sellId ?? r.sell_id ?? r.orderId,
    orderNumber: r.orderNumber ?? r.order_number ?? r.invoiceNo,
    status,
    refundMethod: r.refundMethod ?? r.refund_method,
    totalAmount: toAmount(r.totalAmount, r.total_amount, r.amount),
    notes: r.notes ?? r.note,
    processedBy: r.processedBy ?? r.processed_by,
    processedAt: r.processedAt ?? r.processed_at,
    rejectionReason: r.rejectionReason ?? r.rejection_reason,
    items,
    createdAt: r.createdAt ?? r.created_at ?? "",
  };
}

export async function getCustomerReturns(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<CustomerReturnListResult> {
  const response = await api.get("/customer-returns", {
    params: { ...params, status: params?.status === "approved" ? "completed" : params?.status },
  });
  const d = response.data?.data ?? {};
  const meta = response.data?.meta ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeCustomerReturn),
    total: meta.total ?? d.total ?? items.length,
    page: meta.current_page ?? d.current_page ?? params?.page ?? 1,
  };
}

export async function getCustomerReturnStats(): Promise<CustomerReturnStats> {
  // The list meta carries the current counts (approved returns are reported as completed).
  const response = await api.get("/customer-returns", { params: { limit: 1 } });
  const counts = response.data?.meta?.counts ?? {};
  const stats = response.data?.meta?.stats ?? {};
  return {
    total: Number(counts.all ?? 0),
    pending: Number(counts.pending ?? 0),
    approved: Number(counts.completed ?? 0),
    rejected: Number(counts.rejected ?? 0),
    completed: Number(counts.completed ?? 0),
    totalRefundAmount: Number(stats.refundedAmount ?? 0),
  };
}

export async function getCustomerReturnById(id: number): Promise<CustomerReturn> {
  const response = await api.get(`/customer-returns/${id}`);
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

export async function createCustomerReturn(data: {
  customerId?: number;
  sellId?: number;
  orderNumber?: string;
  refundMethod?: string;
  notes?: string;
  totalAmount?: number;
  items: { productId: number; variantId?: number; quantity: number; reason: string; price?: number }[];
}): Promise<CustomerReturn> {
  const response = await api.post("/customer-returns", data);
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

/** Approving processes the return: restocks and refunds via the return's refund method. */
export async function approveCustomerReturn(id: number): Promise<CustomerReturn> {
  const response = await api.post(`/customer-returns/${id}/approve`);
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

/** A reason is required to reject a return (422 otherwise). */
export async function rejectCustomerReturn(id: number, reason: string): Promise<CustomerReturn> {
  const response = await api.post(`/customer-returns/${id}/reject`, { reason });
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

export async function deleteCustomerReturn(id: number): Promise<void> {
  await api.delete(`/customer-returns/${id}`);
}

// ─── Vendor Returns ───────────────────────────────────────────────────────────

/** pending → shipped → received (by the supplier) → credited. */
export type VendorReturnStatus = "pending" | "shipped" | "received" | "credited";
export const VENDOR_RETURN_FLOW: VendorReturnStatus[] = ["pending", "shipped", "received", "credited"];
export const VENDOR_RETURN_STATUS_LABELS: Record<VendorReturnStatus, string> = {
  pending: "Pending",
  shipped: "Shipped",
  received: "Received by supplier",
  credited: "Credited",
};

/** Credit types accepted by the API ("note" = credit note against the supplier balance). */
export const VENDOR_CREDIT_TYPES: Array<{ value: string; label: string }> = [
  { value: "note", label: "Credit note" },
  { value: "refund", label: "Refund" },
  { value: "replacement", label: "Replacement" },
];

export function vendorCreditTypeLabel(value?: string): string {
  if (!value) return "—";
  const v = value === "credit_note" ? "note" : value;
  return VENDOR_CREDIT_TYPES.find((t) => t.value === v)?.label ?? value.replace(/_/g, " ");
}

function normalizeVendorStatus(value: unknown): VendorReturnStatus {
  switch (value) {
    case "completed":
    case "credited":
      return "credited";
    case "received_by_vendor":
    case "received":
      return "received";
    case "shipped":
      return "shipped";
    default:
      return "pending";
  }
}

export interface VendorReturnItem {
  id?: number;
  productId: number;
  productName?: string;
  variantId?: number;
  variantName?: string;
  quantity: number;
  unitPrice?: number;
  totalPrice?: number;
  reason: string;
}

export interface VendorReturn {
  id: number;
  returnNumber?: string;
  vendorId: number;
  vendorName?: string;
  status: VendorReturnStatus;
  creditType?: string;
  totalAmount?: number;
  notes?: string;
  returnDate?: string;
  completedDate?: string;
  items?: VendorReturnItem[];
  createdAt: string;
}

export interface VendorReturnStats {
  total: number;
  pending: number;
  shipped: number;
  receivedByVendor: number;
  completed: number;
  totalCreditAmount: number;
}

export interface VendorReturnListResult {
  data: VendorReturn[];
  total: number;
  page: number;
}

function normalizeVendorReturn(r: any): VendorReturn {
  const items: VendorReturnItem[] | undefined = Array.isArray(r.items)
    ? r.items.map((i: any) => ({
        id: i.id,
        productId: i.productId ?? i.product_id,
        productName: i.productName ?? i.product_name,
        variantId: i.variantId ?? i.variant_id,
        variantName: i.variantName ?? i.variant_name,
        quantity: Number(i.quantity ?? 0),
        unitPrice: toAmount(i.unitCost, i.unitPrice, i.unit_price),
        totalPrice: toAmount(i.totalPrice, i.total_price),
        reason: i.reason ?? "",
      }))
    : Array.isArray(r.lines)
      ? r.lines.map((l: any) => ({
          productId: 0,
          productName: l.name,
          quantity: Number(l.quantity ?? 0),
          unitPrice: toAmount(l.unitCost),
          totalPrice: toAmount(l.total),
          reason: "",
        }))
      : undefined;
  return {
    id: r.id,
    returnNumber: r.returnNumber ?? r.return_number,
    vendorId: r.vendorId ?? r.vendor_id,
    vendorName: r.vendorName ?? r.supplierName ?? r.vendor_name,
    status: normalizeVendorStatus(r.status),
    creditType: r.creditType ?? r.credit_type,
    totalAmount: toAmount(r.totalAmount, r.total_amount, r.amount),
    notes: r.notes ?? r.note,
    returnDate: r.returnDate ?? r.return_date,
    completedDate: r.completedDate ?? r.completed_date ?? r.creditedAt,
    items,
    createdAt: r.createdAt ?? r.created_at ?? "",
  };
}

export async function getVendorReturns(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  vendorId?: number;
}): Promise<VendorReturnListResult> {
  const response = await api.get("/vendor-returns", {
    params: {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      status: params?.status,
      vendor_id: params?.vendorId,
    },
  });
  const d = response.data?.data ?? {};
  const meta = response.data?.meta ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeVendorReturn),
    total: meta.total ?? d.total ?? items.length,
    page: meta.current_page ?? d.current_page ?? params?.page ?? 1,
  };
}

/** Counts per status + credit totals (from the list endpoint's meta, which uses the new statuses). */
export async function getVendorReturnStats(): Promise<VendorReturnStats> {
  const response = await api.get("/vendor-returns", { params: { limit: 1 } });
  const counts = response.data?.meta?.counts ?? {};
  const stats = response.data?.meta?.stats ?? {};
  return {
    total: Number(counts.all ?? 0),
    pending: Number(counts.pending ?? 0),
    shipped: Number(counts.shipped ?? 0),
    receivedByVendor: Number(counts.received ?? 0),
    completed: Number(counts.credited ?? 0),
    totalCreditAmount: Number(stats.creditReceived ?? 0) + Number(stats.creditToReceive ?? 0),
  };
}

export async function getVendorReturnById(id: number): Promise<VendorReturn> {
  const response = await api.get(`/vendor-returns/${id}`);
  return normalizeVendorReturn(response.data?.data ?? response.data);
}

export async function createVendorReturn(data: {
  vendorId: number;
  vendorName?: string;
  creditType?: string;
  notes?: string;
  returnDate?: string;
  totalAmount?: number;
  items: { productId: number; productName?: string; variantId?: number; quantity: number; unitPrice?: number; totalPrice?: number; reason: string }[];
}): Promise<VendorReturn> {
  const response = await api.post("/vendor-returns", data);
  return normalizeVendorReturn(response.data?.data ?? response.data);
}

/** Status moves one step forward only (pending → shipped → received → credited). */
export async function updateVendorReturnStatus(id: number, status: VendorReturnStatus): Promise<VendorReturn> {
  const response = await api.patch(`/vendor-returns/${id}/status`, { status });
  return normalizeVendorReturn(response.data?.data ?? response.data);
}

export async function deleteVendorReturn(id: number): Promise<void> {
  await api.delete(`/vendor-returns/${id}`);
}
