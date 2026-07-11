import { api } from "@/lib/api";
import type { DashboardStats, DashboardStatsResponse } from "@/types/dashboard";
import type { Order } from "@/types/order";

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await api.get<DashboardStatsResponse>("/sells/stats");
  const data = response.data.data as any;

  return {
    totalSells: Number(data?.totalSells ?? data?.total_sells ?? 0),
    totalRevenue: Number(data?.totalRevenue ?? data?.total_revenue ?? 0),
    pendingCount: Number(data?.pendingCount ?? data?.pending_count ?? 0),
    processingCount: Number(data?.processingCount ?? data?.processing_count ?? 0),
    deliveredCount: Number(data?.deliveredCount ?? data?.delivered_count ?? 0),
  };
}

export async function getRecentOrders(limit = 5): Promise<Order[]> {
  const response = await api.get("/sells", { params: { page: 1, limit } });
  const raw = response.data?.data ?? {};
  const items: any[] = Array.isArray(raw) ? raw : raw.data ?? [];

  return items.map((item) => ({
    id: item.id,
    invoiceNo: item.invoiceNo ?? item.invoice_no ?? String(item.id),
    orderTime: item.orderTime ?? item.order_time ?? item.created_at ?? "",
    customerId: item.customerId ?? item.customer_id,
    customerName: item.customerName ?? item.customer_name ?? "Customer",
    method: item.method ?? "",
    amount: Number(item.amount ?? 0),
    discount: Number(item.discount ?? 0),
    shippingCost: Number(item.shippingCost ?? item.shipping_cost ?? 0),
    status: item.status ?? "Pending",
    paymentStatus: item.paymentStatus ?? item.payment_status,
    fulfillmentStatus: item.fulfillmentStatus ?? item.fulfillment_status,
    trackingNumber: item.trackingNumber ?? item.tracking_number,
    carrier: item.carrier,
    shippedAt: item.shippedAt ?? item.shipped_at,
    notes: item.notes,
    items: [],
    shipments: [],
    createdAt: item.createdAt ?? item.created_at,
    updatedAt: item.updatedAt ?? item.updated_at,
  }));
}
