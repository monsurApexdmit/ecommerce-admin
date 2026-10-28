import { api } from "@/lib/api";
import type {
  CreateShipmentDraft,
  FollowUpOutcome,
  LogFollowUpData,
  Order,
  OrderFollowUp,
  OrderKpis,
  OrderTabCounts,
  OrderItem,
  OrderListParams,
  OrderListResult,
  OrderStats,
  Shipment,
  ShipmentListParams,
  ShipmentListResult,
  ShipmentStats,
  ShipmentStatus,
  TrackingEvent,
} from "@/types/order";

type SellItemResponse = {
  id?: number;
  sellId?: number;
  sell_id?: number;
  productId?: number;
  product_id?: number;
  variantId?: number;
  variant_id?: number;
  inventoryId?: number;
  inventory_id?: number;
  productName?: string;
  product_name?: string;
  quantity: number;
  price?: number;
  unit_price?: number;
  unitPrice?: number;
  total_price?: number;
  totalPrice?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type SellShipmentResponse = {
  id: number;
  sellId?: number;
  sell_id?: number;
  trackingNumber?: string;
  tracking_number?: string;
  carrier?: string;
  shippingMethod?: string;
  shipping_method?: string;
  status: string;
  estimatedDelivery?: string;
  estimated_delivery?: string;
  shippingCost?: number;
  shipping_cost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type ShippingAddressResponse = {
  id: number;
  customerId?: number;
  customer_id?: number;
  fullName?: string;
  full_name?: string;
  phone: string;
  email?: string;
  addressLine1?: string;
  address_line_1?: string;
  addressLine2?: string;
  address_line_2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  postal_code?: string;
  country: string;
  isDefault?: boolean;
  is_default?: boolean;
  addressType?: string;
  address_type?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type SellResponse = {
  id: number;
  invoiceNo?: string;
  invoice_no?: string;
  orderTime?: string;
  order_time?: string;
  customerId?: number;
  customer_id?: number;
  customerName?: string;
  customer_name?: string;
  customer?: { id?: number; name?: string; email?: string; phone?: string; address?: string; city?: string; country?: string } | null;
  shippingAddressId?: number;
  shipping_address_id?: number;
  shippingAddress?: ShippingAddressResponse;
  shipping_address?: ShippingAddressResponse;
  shippingFullName?: string;
  shipping_full_name?: string;
  shippingPhone?: string;
  shipping_phone?: string;
  shippingEmail?: string;
  shipping_email?: string;
  shippingAddressLine1?: string;
  shipping_address_line_1?: string;
  shippingAddressLine2?: string;
  shipping_address_line_2?: string;
  shippingCity?: string;
  shipping_city?: string;
  shippingState?: string;
  shipping_state?: string;
  shippingPostalCode?: string;
  shipping_postal_code?: string;
  shippingCountry?: string;
  shipping_country?: string;
  shippingAddressType?: string;
  shipping_address_type?: string;
  method: string;
  amount: number;
  discount?: number;
  couponId?: number;
  couponCode?: string;
  shippingCost?: number;
  shipping_cost?: number;
  status: Order["status"];
  paymentStatus?: string;
  payment_status?: string;
  fulfillmentStatus?: string;
  fulfillment_status?: string;
  trackingNumber?: string;
  tracking_number?: string;
  carrier?: string;
  shippedAt?: string;
  shipped_at?: string;
  notes?: string;
  items?: SellItemResponse[];
  shipments?: SellShipmentResponse[] | null;
  source?: Order["source"];
  paidAmount?: number;
  dueAmount?: number;
  shippingMethodName?: string;
  transactionId?: string | null;
  paymentTransactionId?: string | null;
  courier?: string | null;
  zoneName?: string | null;
  deliveryNote?: string | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  locationId?: number | null;
  locationName?: string | null;
  followUpCount?: number;
  lastFollowUpAt?: string | null;
  lastFollowUpOutcome?: FollowUpOutcome | null;
  nextFollowUpAt?: string | null;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

type ShipmentSellResponse = {
  id: number;
  invoiceNo?: string;
  invoice_no?: string;
  customerName?: string;
  customer_name?: string;
  customerPhone?: string;
  customerAddress?: string;
  area?: string;
  paymentStatus?: string;
  dueAmount?: number;
  method: string;
  amount: number;
  status: string;
  shippedAt?: string;
  shipped_at?: string;
};

type TrackingEventResponse = {
  id: number;
  shipmentId?: number;
  shipment_id?: number;
  status: ShipmentStatus;
  location?: string;
  description: string;
  eventTime?: string;
  event_time?: string;
  createdAt?: string;
  created_at?: string;
};

type ShipmentResponse = {
  id: number;
  sellId?: number;
  sell_id?: number;
  sell?: ShipmentSellResponse;
  trackingNumber?: string;
  tracking_number?: string;
  carrier?: string;
  shippingMethod?: string;
  shipping_method?: string;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  estimated_delivery?: string;
  shippingCost?: number;
  shipping_cost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  shippedAt?: string;
  shipped_at?: string;
  deliveredAt?: string;
  delivered_at?: string;
  rider?: string | null;
  package?: string | null;
  codAmount?: number | string | null;
  codCollected?: boolean | number | null;
  codCollectedAmount?: number | string | null;
  codCollectedAt?: string | null;
  codState?: Shipment["codState"];
  deliveryPayer?: string | null;
  deliverySpeed?: string | null;
  pickupDate?: string | null;
  trackingHistory?: TrackingEventResponse[];
  tracking_history?: TrackingEventResponse[];
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

function normalizeOrderItem(item: SellItemResponse): OrderItem {
  return {
    id: item.id,
    sellId: item.sellId ?? item.sell_id,
    productId: item.productId ?? item.product_id,
    variantId: item.variantId ?? item.variant_id,
    inventoryId: item.inventoryId ?? item.inventory_id,
    productName: item.productName ?? item.product_name ?? "Item",
    quantity: Number(item.quantity ?? 0),
    price: item.price,
    unitPrice: item.unitPrice ?? item.unit_price,
    totalPrice: item.totalPrice ?? item.total_price,
    createdAt: item.createdAt ?? item.created_at,
    updatedAt: item.updatedAt ?? item.updated_at,
  };
}

function normalizeSellShipment(item: SellShipmentResponse) {
  return {
    id: item.id,
    sellId: item.sellId ?? item.sell_id ?? 0,
    trackingNumber: item.trackingNumber ?? item.tracking_number,
    carrier: item.carrier,
    shippingMethod: item.shippingMethod ?? item.shipping_method,
    status: item.status,
    estimatedDelivery: item.estimatedDelivery ?? item.estimated_delivery,
    shippingCost: item.shippingCost ?? item.shipping_cost,
    weight: item.weight,
    dimensions: item.dimensions,
    notes: item.notes,
    createdAt: item.createdAt ?? item.created_at ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? "",
  };
}

function normalizeOrder(order: SellResponse): Order {
  const shippingAddress = order.shippingAddress ?? order.shipping_address;
  const cust = order.customer;

  return {
    id: order.id,
    invoiceNo: order.invoiceNo ?? order.invoice_no ?? String(order.id),
    orderTime: order.orderTime ?? order.order_time ?? order.createdAt ?? order.created_at ?? "",
    customerId: order.customerId ?? order.customer_id,
    customerName: order.customerName ?? order.customer_name ?? cust?.name ?? "Customer",
    customerPhone: order.shippingPhone ?? order.shipping_phone ?? cust?.phone,
    customerEmail: order.shippingEmail ?? order.shipping_email ?? cust?.email,
    customerAddress: order.shippingAddressLine1 ?? order.shipping_address_line_1 ?? cust?.address,
    customerCity: order.shippingCity ?? order.shipping_city ?? cust?.city,
    customerCountry: order.shippingCountry ?? order.shipping_country ?? cust?.country,
    shippingAddressId: order.shippingAddressId ?? order.shipping_address_id,
    shippingAddress: shippingAddress
      ? {
          id: shippingAddress.id,
          customerId: shippingAddress.customerId ?? shippingAddress.customer_id ?? 0,
          fullName: shippingAddress.fullName ?? shippingAddress.full_name ?? "",
          phone: shippingAddress.phone,
          email: shippingAddress.email,
          addressLine1: shippingAddress.addressLine1 ?? shippingAddress.address_line_1 ?? "",
          addressLine2: shippingAddress.addressLine2 ?? shippingAddress.address_line_2,
          city: shippingAddress.city,
          state: shippingAddress.state,
          postalCode: shippingAddress.postalCode ?? shippingAddress.postal_code,
          country: shippingAddress.country,
          isDefault: Boolean(shippingAddress.isDefault ?? shippingAddress.is_default),
          addressType: shippingAddress.addressType ?? shippingAddress.address_type ?? "",
          createdAt: shippingAddress.createdAt ?? shippingAddress.created_at ?? "",
          updatedAt: shippingAddress.updatedAt ?? shippingAddress.updated_at ?? "",
        }
      : undefined,
    shippingFullName: order.shippingFullName ?? order.shipping_full_name,
    shippingPhone: order.shippingPhone ?? order.shipping_phone,
    shippingEmail: order.shippingEmail ?? order.shipping_email,
    shippingAddressLine1: order.shippingAddressLine1 ?? order.shipping_address_line_1,
    shippingAddressLine2: order.shippingAddressLine2 ?? order.shipping_address_line_2,
    shippingCity: order.shippingCity ?? order.shipping_city,
    shippingState: order.shippingState ?? order.shipping_state,
    shippingPostalCode: order.shippingPostalCode ?? order.shipping_postal_code,
    shippingCountry: order.shippingCountry ?? order.shipping_country,
    shippingAddressType: order.shippingAddressType ?? order.shipping_address_type,
    method: order.method,
    amount: Number(order.amount ?? 0),
    discount: Number(order.discount ?? 0),
    couponId: order.couponId,
    couponCode: order.couponCode,
    shippingCost: Number(order.shippingCost ?? order.shipping_cost ?? 0),
    status: order.status,
    paymentStatus: order.paymentStatus ?? order.payment_status,
    fulfillmentStatus: order.fulfillmentStatus ?? order.fulfillment_status,
    trackingNumber: order.trackingNumber ?? order.tracking_number,
    carrier: order.carrier,
    shippedAt: order.shippedAt ?? order.shipped_at,
    notes: order.notes,
    items: Array.isArray(order.items) ? order.items.map(normalizeOrderItem) : [],
    shipments: Array.isArray(order.shipments) ? order.shipments.map(normalizeSellShipment) : [],
    source: order.source ?? null,
    paidAmount: order.paidAmount != null ? Number(order.paidAmount) : undefined,
    dueAmount: order.dueAmount != null ? Number(order.dueAmount) : undefined,
    shippingMethodName: order.shippingMethodName,
    transactionId: order.transactionId ?? order.paymentTransactionId ?? null,
    courier: order.courier ?? null,
    zoneName: order.zoneName ?? null,
    deliveryNote: order.deliveryNote ?? null,
    taxRate: order.taxRate != null ? Number(order.taxRate) : null,
    taxAmount: order.taxAmount != null ? Number(order.taxAmount) : null,
    locationId: order.locationId ?? null,
    locationName: order.locationName ?? null,
    followUpCount: Number(order.followUpCount ?? 0),
    lastFollowUpAt: order.lastFollowUpAt ?? null,
    lastFollowUpOutcome: order.lastFollowUpOutcome ?? null,
    nextFollowUpAt: order.nextFollowUpAt ?? null,
    createdAt: order.createdAt ?? order.created_at,
    updatedAt: order.updatedAt ?? order.updated_at,
  };
}

function normalizeTrackingEvent(event: TrackingEventResponse): TrackingEvent {
  return {
    id: event.id,
    shipmentId: event.shipmentId ?? event.shipment_id ?? 0,
    status: event.status,
    location: event.location,
    description: event.description,
    eventTime: event.eventTime ?? event.event_time ?? "",
    createdAt: event.createdAt ?? event.created_at ?? "",
  };
}

function normalizeShipment(item: ShipmentResponse): Shipment {
  return {
    id: item.id,
    sellId: item.sellId ?? item.sell_id ?? 0,
    sell: item.sell
      ? {
          id: item.sell.id,
          invoiceNo: item.sell.invoiceNo ?? item.sell.invoice_no ?? String(item.sell.id),
          customerName: item.sell.customerName ?? item.sell.customer_name ?? "Customer",
          customerPhone: item.sell.customerPhone,
          customerAddress: item.sell.customerAddress,
          area: item.sell.area,
          paymentStatus: item.sell.paymentStatus,
          dueAmount: item.sell.dueAmount != null ? Number(item.sell.dueAmount) : undefined,
          method: item.sell.method,
          amount: Number(item.sell.amount ?? 0),
          status: item.sell.status,
          shippedAt: item.sell.shippedAt ?? item.sell.shipped_at,
        }
      : undefined,
    trackingNumber: item.trackingNumber ?? item.tracking_number,
    carrier: item.carrier,
    shippingMethod: item.shippingMethod ?? item.shipping_method,
    status: item.status,
    estimatedDelivery: item.estimatedDelivery ?? item.estimated_delivery,
    shippingCost: Number(item.shippingCost ?? item.shipping_cost ?? 0),
    weight: item.weight,
    dimensions: item.dimensions,
    notes: item.notes,
    shippedAt: item.shippedAt ?? item.shipped_at,
    deliveredAt: item.deliveredAt ?? item.delivered_at,
    rider: item.rider ?? null,
    package: item.package ?? null,
    codAmount: Number(item.codAmount ?? 0) || 0,
    codCollected: item.codCollected === true || item.codCollected === 1,
    codCollectedAmount: item.codCollectedAmount != null ? Number(item.codCollectedAmount) : null,
    codCollectedAt: item.codCollectedAt ?? null,
    codState: item.codState ?? null,
    deliveryPayer: item.deliveryPayer ?? null,
    deliverySpeed: item.deliverySpeed ?? null,
    pickupDate: item.pickupDate ?? null,
    trackingHistory: (item.trackingHistory ?? item.tracking_history ?? []).map(normalizeTrackingEvent),
    createdAt: item.createdAt ?? item.created_at ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? "",
  };
}

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function getOrders(params?: OrderListParams): Promise<OrderListResult> {
  // `per_page` pages the list; `limit` would return a capped, unpaginated list without meta.
  const perPage = params?.perPage ?? (params?.limit && params?.page ? params.limit : undefined);
  const response = await api.get("/sells", {
    params: {
      page: params?.page,
      per_page: perPage,
      limit: perPage ? undefined : params?.limit,
      search: params?.search,
      status: params?.status && params.status !== "all" ? params.status : undefined,
      method: params?.method,
      payment: params?.payment,
      source: params?.source,
      followUp: params?.followUp,
      start_date: params?.startDate,
      end_date: params?.endDate,
    },
  });

  const rawData = response.data?.data || [];
  const meta = response.data?.meta ?? {};
  const isArray = Array.isArray(rawData);
  const items = isArray ? rawData : rawData.data || [];
  const pagination = meta.pagination ?? (isArray ? {} : {
    page: rawData.current_page, per_page: rawData.per_page, total: rawData.total, last_page: rawData.last_page,
  });

  const tc = meta.tabCounts;
  const k = meta.kpis;
  const tabCounts: OrderTabCounts | undefined = tc
    ? Object.fromEntries(Object.entries(tc).map(([key, v]) => [key, num(v)]))
    : undefined;
  const kpis: OrderKpis | undefined = k
    ? {
        totalOrders: num(k.totalOrders), last30Days: num(k.last30Days), pending: num(k.pending),
        confirmedOrPacked: num(k.confirmedOrPacked), shipped: num(k.shipped), delivered: num(k.delivered),
        revenue: num(k.revenue), dueToCollect: num(k.dueToCollect), unpaidCount: num(k.unpaidCount),
      }
    : undefined;

  return {
    data: items.map(normalizeOrder),
    total: num(pagination.total) || items.length || 0,
    page: num(pagination.page) || params?.page || 1,
    limit: num(pagination.per_page) || perPage || params?.limit || 10,
    lastPage: pagination.last_page != null ? num(pagination.last_page) : undefined,
    tabCounts,
    kpis,
  };
}

export async function getOrderStats(): Promise<OrderStats> {
  const response = await api.get("/sells/stats");
  const data = response.data?.data ?? {};
  return {
    totalSells: Number(data.totalSells ?? 0),
    totalRevenue: Number(data.totalRevenue ?? 0),
    pendingOrders: Number(data.pendingOrders ?? 0),
    processingOrders: Number(data.processingOrders ?? 0),
    deliveredOrders: Number(data.deliveredOrders ?? 0),
    packedOrders: data.packedOrders != null ? Number(data.packedOrders) : undefined,
    shippedOrders: data.shippedOrders != null ? Number(data.shippedOrders) : undefined,
    cancelledOrders: data.cancelledOrders != null ? Number(data.cancelledOrders) : undefined,
    totalDue: data.totalDue != null ? Number(data.totalDue) : undefined,
    unpaidCount: data.unpaidCount != null ? Number(data.unpaidCount) : undefined,
  };
}

export async function getOrderById(id: number): Promise<Order> {
  const response = await api.get(`/sells/${id}`);
  return normalizeOrder(response.data?.data ?? response.data);
}

export async function getOrderByInvoice(invoiceNo: string): Promise<Order> {
  const clean = invoiceNo.startsWith("#") ? invoiceNo.slice(1) : invoiceNo;
  const response = await api.get(`/sells/invoice/${encodeURIComponent(clean)}`);
  return normalizeOrder(response.data?.data ?? response.data);
}

export async function updateOrderStatus(id: number, status: Order["status"], reason?: string) {
  const response = await api.patch(`/sells/${id}/status`, reason ? { status, reason } : { status });
  return normalizeOrder(response.data?.data ?? response.data);
}

/** Mark an open order packed or shipped (shipped links/creates a shipment), or put it back to unfulfilled. */
export async function updateOrderFulfillment(id: number, fulfillment: "packed" | "shipped" | "unfulfilled") {
  const response = await api.patch(`/sells/${id}/fulfillment`, { fulfillment });
  return normalizeOrder(response.data?.data ?? response.data);
}

function normalizeFollowUp(f: any): OrderFollowUp {
  return {
    id: Number(f.id),
    sellId: Number(f.sellId ?? f.sell_id ?? 0),
    userId: f.userId ?? f.user_id ?? null,
    staffName: f.staffName ?? f.staff_name ?? null,
    outcome: f.outcome,
    channel: f.channel ?? "call",
    note: f.note ?? null,
    nextFollowUpAt: f.nextFollowUpAt ?? f.next_follow_up_at ?? null,
    createdAt: f.createdAt ?? f.created_at ?? "",
  };
}

/** Follow-up (confirmation call) history of an order, newest first. */
export async function getOrderFollowUps(id: number): Promise<OrderFollowUp[]> {
  const response = await api.get(`/sells/${id}/follow-ups`);
  const raw = response.data?.data;
  return Array.isArray(raw) ? raw.map(normalizeFollowUp) : [];
}

/** Log a follow-up; confirmed moves Pending to Processing, customer_cancelled cancels the order. */
export async function logOrderFollowUp(id: number, data: LogFollowUpData): Promise<{ followUp: OrderFollowUp; order: Order }> {
  const response = await api.post(`/sells/${id}/follow-ups`, data);
  const d = response.data?.data ?? {};
  return { followUp: normalizeFollowUp(d.followUp ?? {}), order: normalizeOrder(d.order) };
}

export async function updateOrder(id: number, updates: { notes?: string }) {
  const response = await api.put(`/sells/${id}`, updates);
  return normalizeOrder(response.data?.data ?? response.data);
}

export async function deleteOrder(id: number) {
  await api.delete(`/sells/${id}`);
}

export async function getShipments(params?: ShipmentListParams): Promise<ShipmentListResult> {
  const response = await api.get("/shipments", {
    params: {
      page: params?.page,
      per_page: params?.perPage ?? params?.limit,
      cod: params?.cod ? 1 : undefined,
      search: params?.search,
      status: params?.status,
      carrier: params?.carrier,
    },
  });
  const data = response.data?.data ?? {};
  return {
    data: (data.data ?? []).map(normalizeShipment),
    page: data.current_page ?? params?.page ?? 1,
    perPage: data.per_page ?? params?.limit ?? 10,
    total: data.total ?? 0,
  };
}

export async function getShipmentStats(): Promise<ShipmentStats> {
  const response = await api.get("/shipments/stats");
  const data = response.data?.data ?? {};
  return {
    readyToShip: Number(data.readyToShip ?? 0),
    codWithCouriers: Number(data.codWithCouriers ?? 0),
    total: Number(data.total ?? 0),
    pending: Number(data.pending ?? 0),
    inTransit: Number(data.inTransit ?? data.in_transit ?? 0),
    delivered: Number(data.delivered ?? 0),
    failed: Number(data.failed ?? 0),
    pickedUp: Number(data.pickedUp ?? data.picked_up ?? 0),
    outForDelivery: Number(data.outForDelivery ?? data.out_for_delivery ?? 0),
    returned: Number(data.returned ?? 0),
  };
}

export async function getShipmentById(id: number): Promise<Shipment> {
  const response = await api.get(`/shipments/${id}`);
  return normalizeShipment(response.data?.data ?? response.data);
}

export async function createShipment(draft: CreateShipmentDraft): Promise<Shipment> {
  const response = await api.post("/shipments", draft);
  return normalizeShipment(response.data?.data ?? response.data);
}

export async function updateShipmentStatus(
  id: number,
  data: { status: ShipmentStatus; location?: string; description?: string; rider?: string },
): Promise<Shipment> {
  const response = await api.patch(`/shipments/${id}/status`, {
    status: data.status,
    location: data.location?.trim() || undefined,
    description: data.description?.trim() || undefined,
    rider: data.rider?.trim() || undefined,
  });
  return normalizeShipment(response.data?.data ?? response.data);
}

/** Record the cash a courier collected for a delivered COD shipment (codState delivered_record_payment). */
export async function recordShipmentCodPayment(id: number, data?: { paymentMethod?: string; notes?: string }): Promise<Shipment> {
  const response = await api.post(`/shipments/${id}/cod-payment`, data ?? {});
  return normalizeShipment(response.data?.data ?? response.data);
}

/**
 * Next statuses the server accepts: forward-only along the delivery flow, `failed` only once the courier has it
 * (picked up / in transit / out for delivery), and from `failed` only `returned`. Delivered/returned are final.
 */
export function nextShipmentStatuses(current: ShipmentStatus): ShipmentStatus[] {
  const flow: ShipmentStatus[] = ["pending", "picked_up", "in_transit", "out_for_delivery", "delivered"];
  if (current === "failed") return ["returned"];
  if (current === "delivered" || current === "returned") return [];
  const i = flow.indexOf(current);
  const ahead = flow.slice(Math.max(0, i + 1));
  return current === "pending" ? ahead : [...ahead, "failed"];
}
