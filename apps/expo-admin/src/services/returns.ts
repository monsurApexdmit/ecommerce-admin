import { api } from "@/lib/api";

// ─── Customer Returns ─────────────────────────────────────────────────────────

export type CustomerReturnStatus = "pending" | "approved" | "rejected" | "completed";

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

function normalizeCustomerReturn(r: any): CustomerReturn {
  return {
    id: r.id,
    returnNumber: r.returnNumber ?? r.return_number,
    customerId: r.customerId ?? r.customer_id,
    customerName: r.customerName ?? r.customer_name,
    sellId: r.sellId ?? r.sell_id,
    orderNumber: r.orderNumber ?? r.order_number,
    status: r.status ?? "pending",
    refundMethod: r.refundMethod ?? r.refund_method,
    totalAmount: r.totalAmount !== undefined ? Number(r.totalAmount) : r.total_amount !== undefined ? Number(r.total_amount) : undefined,
    notes: r.notes,
    processedBy: r.processedBy ?? r.processed_by,
    processedAt: r.processedAt ?? r.processed_at,
    rejectionReason: r.rejectionReason ?? r.rejection_reason,
    items: r.items,
    createdAt: r.createdAt ?? r.created_at ?? "",
  };
}

export async function getCustomerReturns(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<CustomerReturnListResult> {
  const response = await api.get("/customer-returns", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeCustomerReturn),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
  };
}

export async function getCustomerReturnStats(): Promise<CustomerReturnStats> {
  const response = await api.get("/customer-returns/stats");
  const d = response.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    pending: Number(d.pending ?? 0),
    approved: Number(d.approved ?? 0),
    rejected: Number(d.rejected ?? 0),
    completed: Number(d.completed ?? 0),
    totalRefundAmount: Number(d.totalRefundAmount ?? d.total_refund_amount ?? 0),
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

export async function approveCustomerReturn(id: number, notes?: string): Promise<CustomerReturn> {
  const response = await api.patch(`/customer-returns/${id}/approve`, { notes });
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

export async function rejectCustomerReturn(id: number, reason: string): Promise<CustomerReturn> {
  const response = await api.patch(`/customer-returns/${id}/reject`, { rejectionReason: reason });
  return normalizeCustomerReturn(response.data?.data ?? response.data);
}

export async function deleteCustomerReturn(id: number): Promise<void> {
  await api.delete(`/customer-returns/${id}`);
}

// ─── Vendor Returns ───────────────────────────────────────────────────────────

export type VendorReturnStatus = "pending" | "shipped" | "received_by_vendor" | "completed";

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
  return {
    id: r.id,
    returnNumber: r.returnNumber ?? r.return_number,
    vendorId: r.vendorId ?? r.vendor_id,
    vendorName: r.vendorName ?? r.vendor_name,
    status: r.status ?? "pending",
    creditType: r.creditType ?? r.credit_type,
    totalAmount: r.totalAmount !== undefined ? Number(r.totalAmount) : r.total_amount !== undefined ? Number(r.total_amount) : undefined,
    notes: r.notes,
    returnDate: r.returnDate ?? r.return_date,
    completedDate: r.completedDate ?? r.completed_date,
    items: r.items,
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
  const response = await api.get("/vendor-returns", { params });
  const d = response.data?.data ?? {};
  const items = Array.isArray(d) ? d : (d.data ?? []);
  return {
    data: items.map(normalizeVendorReturn),
    total: d.total ?? items.length,
    page: d.current_page ?? params?.page ?? 1,
  };
}

export async function getVendorReturnStats(): Promise<VendorReturnStats> {
  const response = await api.get("/vendor-returns/stats");
  const d = response.data?.data ?? {};
  return {
    total: Number(d.total ?? 0),
    pending: Number(d.pending ?? 0),
    shipped: Number(d.shipped ?? 0),
    receivedByVendor: Number(d.received_by_vendor ?? d.receivedByVendor ?? 0),
    completed: Number(d.completed ?? 0),
    totalCreditAmount: Number(d.totalCreditAmount ?? d.total_credit_amount ?? 0),
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

export async function updateVendorReturnStatus(id: number, status: VendorReturnStatus): Promise<VendorReturn> {
  const response = await api.patch(`/vendor-returns/${id}/status`, { status });
  return normalizeVendorReturn(response.data?.data ?? response.data);
}

export async function deleteVendorReturn(id: number): Promise<void> {
  await api.delete(`/vendor-returns/${id}`);
}
