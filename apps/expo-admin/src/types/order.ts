export type OrderStatus = "Pending" | "Processing" | "Delivered" | "Cancelled";

/** Derived list tabs (server `status` filter), built from status + fulfillment + payment. */
export type OrderTab = "all" | "pending" | "confirmed" | "packed" | "shipped" | "delivered" | "completed" | "cancelled";
export type OrderTabCounts = Partial<Record<OrderTab, number>> & { followUpDue?: number; followUpScheduled?: number };

export interface OrderKpis {
  totalOrders: number;
  last30Days: number;
  pending: number;
  confirmedOrPacked: number;
  shipped: number;
  delivered: number;
  revenue: number;
  dueToCollect: number;
  unpaidCount: number;
}

export type FollowUpOutcome = "confirmed" | "no_answer" | "call_later" | "wrong_number" | "customer_cancelled" | "other";
export type FollowUpChannel = "call" | "whatsapp" | "sms" | "other";

export interface OrderFollowUp {
  id: number;
  sellId: number;
  userId: number | null;
  staffName: string | null;
  outcome: FollowUpOutcome;
  channel: FollowUpChannel;
  note: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface LogFollowUpData {
  outcome: FollowUpOutcome;
  channel?: FollowUpChannel;
  note?: string;
  /** ISO datetime; required (and in the future) for call_later */
  nextFollowUpAt?: string;
}

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
  source?: "pos" | "storefront" | "manual" | null;
  paidAmount?: number;
  dueAmount?: number;
  shippingMethodName?: string;
  transactionId?: string | null;
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
  updatedAt?: string;
}

export interface OrderListParams {
  page?: number;
  /** Page size (server `per_page`). Sending `limit` instead returns an unpaginated list. */
  perPage?: number;
  limit?: number;
  /** due = needs a confirmation call now; scheduled = call-back booked */
  followUp?: "due" | "scheduled";
  payment?: string;
  source?: string;
  search?: string;
  /** Derived tab (pending, confirmed, packed, shipped, delivered, completed, cancelled) */
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
  lastPage?: number;
  tabCounts?: OrderTabCounts;
  kpis?: OrderKpis;
}

export interface OrderStats {
  totalSells: number;
  totalRevenue: number;
  pendingOrders: number;
  processingOrders: number;
  deliveredOrders: number;
  packedOrders?: number;
  shippedOrders?: number;
  cancelledOrders?: number;
  totalDue?: number;
  unpaidCount?: number;
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

export type ShipmentCodState = "prepaid" | "to_collect" | "collected" | "delivered_record_payment" | "returning";

export interface ShipmentSell {
  id: number;
  invoiceNo: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  area?: string;
  paymentStatus?: string;
  dueAmount?: number;
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
  rider?: string | null;
  package?: string | null;
  codAmount?: number;
  codCollected?: boolean;
  codCollectedAmount?: number | null;
  codCollectedAt?: string | null;
  codState?: ShipmentCodState | null;
  deliveryPayer?: "customer" | "us" | string | null;
  deliverySpeed?: "regular" | "express" | string | null;
  pickupDate?: string | null;
  trackingHistory?: TrackingEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface ShipmentListParams {
  page?: number;
  /** Page size (server `per_page`) */
  perPage?: number;
  limit?: number;
  cod?: boolean;
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
  readyToShip?: number;
  codWithCouriers?: number;
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
  /** Blank = generated by the server */
  trackingNumber?: string;
  carrier?: string;
  rider?: string;
  codAmount?: number;
  shippingMethod?: string;
  status?: ShipmentStatus;
  estimatedDelivery?: string;
  shippingCost?: number;
  weight?: number;
  dimensions?: string;
  notes?: string;
}
