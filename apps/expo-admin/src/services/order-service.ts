import { api } from "@/lib/api";
import type {
  CreateShipmentDraft,
  Order,
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
  shipments?: SellShipmentResponse[];
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
    trackingHistory: (item.trackingHistory ?? item.tracking_history ?? []).map(normalizeTrackingEvent),
    createdAt: item.createdAt ?? item.created_at ?? "",
    updatedAt: item.updatedAt ?? item.updated_at ?? "",
  };
}

export async function getOrders(params?: OrderListParams): Promise<OrderListResult> {
  const response = await api.get("/sells", {
    params: {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      status: params?.status,
      method: params?.method,
      start_date: params?.startDate,
      end_date: params?.endDate,
    },
  });

  const rawData = response.data?.data || [];
  const isArray = Array.isArray(rawData);
  const items = isArray ? rawData : rawData.data || [];
  const pagination = isArray ? {} : rawData;

  return {
    data: items.map(normalizeOrder),
    total: pagination.total || items.length || 0,
    page: pagination.current_page || params?.page || 1,
    limit: pagination.per_page || params?.limit || 10,
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

export async function updateOrderStatus(id: number, status: Order["status"]) {
  const response = await api.patch(`/sells/${id}/status`, { status });
  return normalizeOrder(response.data?.data ?? response.data);
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
      limit: params?.limit,
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
    total: Number(data.total ?? 0),
    pending: Number(data.pending ?? 0),
    inTransit: Number(data.inTransit ?? data.in_transit ?? 0),
    delivered: Number(data.delivered ?? 0),
    failed: Number(data.failed ?? 0),
    pickedUp: Number(data.picked_up ?? 0),
    outForDelivery: Number(data.out_for_delivery ?? 0),
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
  data: { status: ShipmentStatus; location?: string; description?: string },
): Promise<Shipment> {
  const response = await api.patch(`/shipments/${id}/status`, data);
  return normalizeShipment(response.data?.data ?? response.data);
}
