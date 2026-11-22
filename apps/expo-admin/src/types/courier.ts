/** Courier API integration (Pathao, Steadfast). Accounts are set up on the web admin; mobile books and tracks. */

export type CourierProvider = "pathao" | "steadfast" | "redx" | "paperfly";

/** Courier-side status normalized by the server; the raw courier string is kept in `rawStatus`. */
export type CourierStatus =
  | "booked"
  | "pickup_pending"
  | "picked"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "partial_delivered"
  | "returned"
  | "cancelled"
  | "on_hold"
  | "failed";

export interface CourierAccountSettings {
  /** Pathao: 48 normal, 12 on-demand */
  deliveryType?: number | null;
  /** Pathao: 1 document, 2 parcel */
  itemType?: number | null;
  weightKg?: number | null;
  note?: string | null;
  itemDescription?: string | null;
}

export type CourierConnectionStatus = "connected" | "error" | "untested";

export interface CourierAccount {
  id: number;
  provider: CourierProvider | string;
  /** Display label from the server (`label`), else the provider name */
  name: string;
  isActive: boolean;
  isDefault: boolean;
  /** Pathao only */
  environment?: "live" | "sandbox" | string | null;
  storeId?: number | string | null;
  storeName?: string | null;
  /** Pathao merchant email (plain) */
  username?: string | null;
  /** All required credentials stored (`isConfigured`); secrets are never returned */
  hasCredentials: boolean;
  /** Masked key / client id hint, e.g. "••••3f2a" */
  maskedKey?: string | null;
  connectionStatus?: CourierConnectionStatus | string | null;
  /** The server can book with this provider (false for RedX/Paperfly placeholders) */
  isIntegrated: boolean;
  /** Pathao without a pickup store saved */
  needsStore?: boolean;
  settings: CourierAccountSettings;
  lastCheckedAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourierTestResult {
  ok: boolean;
  message: string;
  /** Steadfast: current balance */
  balance?: number | null;
  /** Fresh account row (lastCheckedAt / lastError updated) */
  account?: CourierAccount | null;
}

/** `courierBooking` block on a shipment (null for manual shipments). */
export interface ShipmentCourier {
  provider: CourierProvider | string;
  accountId?: number | null;
  consignmentId?: string | null;
  trackingCode?: string | null;
  status?: CourierStatus | string | null;
  rawStatus?: string | null;
  statusAt?: string | null;
  trackingUrl?: string | null;
  deliveryFee?: number | null;
  codAmount?: number | null;
  /** COD the courier reports collected */
  codCollected?: number | null;
  isFinal?: boolean;
  canCancel?: boolean;
  canSync?: boolean;
  bookedAt?: string | null;
  lastSyncedAt?: string | null;
  syncError?: string | null;
  /** Pathao recipient location */
  cityName?: string | null;
  zoneName?: string | null;
  areaName?: string | null;
}

export type CourierLocationType = "city" | "zone" | "area";

export interface CourierLocation {
  id: number;
  name: string;
  /** Pathao areas */
  homeDeliveryAvailable?: boolean | null;
}

export interface CourierStore {
  id: number;
  name: string;
  isDefault?: boolean;
}

export interface CourierRecipient {
  name?: string;
  phone?: string;
  address?: string;
}

export interface CourierBookingData {
  courierAccountId: number;
  codAmount?: number;
  weightKg?: number;
  deliveryType?: number;
  itemType?: number;
  itemDescription?: string;
  note?: string;
  recipient?: CourierRecipient;
  pathao?: {
    storeId?: number;
    cityId?: number;
    zoneId?: number;
    areaId?: number;
    cityName?: string;
    zoneName?: string;
    areaName?: string;
  };
}

export interface CourierQuote {
  available: boolean;
  /** null when the courier has no price API (Steadfast) or city/zone are missing */
  deliveryFee: number | null;
  codFeePercent?: number | null;
  currency?: string | null;
  message?: string | null;
}

export interface CourierTrackingEvent {
  status?: string | null;
  text: string;
  at?: string | null;
}

export interface CourierTracking {
  status?: CourierStatus | string | null;
  rawStatus?: string | null;
  events: CourierTrackingEvent[];
}

export interface CourierRisk {
  available: boolean;
  provider?: string | null;
  phone: string;
  /** 0–100 */
  successRate?: number | null;
  totalParcels?: number | null;
  delivered?: number | null;
  returned?: number | null;
  rating?: string | null;
  message?: string | null;
}
