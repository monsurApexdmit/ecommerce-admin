export type OrderStatus = "Pending" | "Processing" | "Delivered";

export interface OrderItem {
  id?: number;
  sellId?: number;
  productId?: number;
  variantId?: number;
  inventoryId?: number;
  productName: string;
  quantity: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShippingAddress {
  id: number;
  customerId: number;
  fullName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  isDefault: boolean;
  addressType: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderShipmentLite {
  id: number;
  sellId: number;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status: string;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  invoiceNo: string;
  orderTime: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  customerCountry?: string;
  shippingAddressId?: number;
  shippingAddress?: ShippingAddress;
  shippingFullName?: string;
  shippingPhone?: string;
  shippingEmail?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
  shippingAddressType?: string;
  method: string;
  amount: number;
  discount?: number;
  couponId?: number;
  couponCode?: string;
  shippingCost?: number;
  status: OrderStatus;
  paymentStatus?: string;
  fulfillmentStatus?: string;
  trackingNumber?: string;
  carrier?: string;
  shippedAt?: string;
  notes?: string;
  items: OrderItem[];
  shipments: OrderShipmentLite[];
  createdAt?: string;
  updatedAt?: string;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  method?: string;
  startDate?: string;
  endDate?: string;
}

export interface OrderListResult {
  data: Order[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderStats {
  totalSells: number;
  totalRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  deliveredOrders: number;
}

export type ShipmentStatus =
  | "pending"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed"
  | "returned";

export interface TrackingEvent {
  id: number;
  shipmentId: number;
  status: ShipmentStatus;
  location?: string;
  description: string;
  eventTime: string;
  createdAt: string;
}

export interface ShipmentSell {
  id: number;
  invoiceNo: string;
  customerName: string;
  method: string;
  amount: number;
  status: string;
  shippedAt?: string;
}

export interface Shipment {
  id: number;
  sellId: number;
  sell?: ShipmentSell;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
  shippedAt?: string;
  deliveredAt?: string;
  trackingHistory?: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  carrier?: string;
}

export interface ShipmentListResult {
  data: Shipment[];
  page: number;
  perPage: number;
  total: number;
}

export interface ShipmentStats {
  total: number;
  pending: number;
  inTransit: number;
  delivered: number;
  failed: number;
  pickedUp: number;
  outForDelivery: number;
  returned: number;
}

export interface CreateShipmentDraft {
  sellId: number;
  trackingNumber?: string;
  carrier?: string;
  shippingMethod?: string;
  status?: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
}
