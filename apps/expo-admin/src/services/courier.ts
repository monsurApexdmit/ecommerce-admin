import { api } from "@/lib/api";
import { normalizeShipment } from "@/services/order-service";
import type { Shipment } from "@/types/order";
import type {
  CourierAccount,
  CourierBookingData,
  CourierLocation,
  CourierLocationType,
  CourierQuote,
  CourierRisk,
  CourierStore,
  CourierTestResult,
  CourierTracking,
  CourierTrackingEvent,
} from "@/types/courier";

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const flag = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
/** Unwraps `{ data: … }` (and a nested Laravel paginator) to the payload. */
const payload = (res: any) => res?.data?.data ?? res?.data;
const list = (raw: any): any[] => (Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : []);

export const COURIER_PROVIDER_LABEL: Record<string, string> = {
  pathao: "Pathao",
  steadfast: "Steadfast",
  redx: "RedX",
  paperfly: "Paperfly",
};

export function courierProviderLabel(provider?: string | null): string {
  if (!provider) return "Courier";
  return COURIER_PROVIDER_LABEL[provider.toLowerCase()] ?? provider.charAt(0).toUpperCase() + provider.slice(1);
}

/** Providers the server can book with (others are stored for reference only). */
export const API_COURIERS = ["pathao", "steadfast"];

/** CourierAccount DTO (contract §2.1). Secrets are never sent — only masked values and `has*` / `isConfigured` flags. */
export function normalizeCourierAccount(raw: any): CourierAccount {
  const settings = raw?.settings && typeof raw.settings === "object" ? raw.settings : {};
  const provider = String(raw?.provider ?? "").toLowerCase();
  const creds = raw?.credentials && typeof raw.credentials === "object" ? raw.credentials : {};
  return {
    id: Number(raw?.id),
    provider,
    name: str(raw?.label) ?? courierProviderLabel(provider),
    isActive: raw?.isActive != null ? flag(raw.isActive) : true,
    isDefault: flag(raw?.isDefault),
    environment: str(raw?.environment),
    storeId: creds.storeId ?? null,
    storeName: null,
    username: str(creds.username),
    // Legacy rows without `isConfigured` fall back to "has any key".
    hasCredentials: raw?.isConfigured != null ? flag(raw.isConfigured) : flag(raw?.hasKey),
    maskedKey: str(creds.apiKey ?? creds.clientId ?? raw?.apiKey),
    connectionStatus: str(raw?.connectionStatus),
    isIntegrated: raw?.isIntegrated != null ? flag(raw.isIntegrated) : API_COURIERS.includes(provider),
    needsStore: raw?.needsStore != null ? flag(raw.needsStore) : undefined,
    settings: {
      deliveryType: numOrNull(settings.deliveryType),
      itemType: numOrNull(settings.itemType),
      weightKg: numOrNull(settings.weightKg),
      note: str(settings.note),
      itemDescription: str(settings.itemDescription),
    },
    lastCheckedAt: str(raw?.lastCheckedAt),
    lastError: str(raw?.lastError),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

/** All courier accounts of the company (Shipping Methods.read) — settings list. Set-up happens on the web admin. */
export async function getCourierAccounts(): Promise<CourierAccount[]> {
  const res = await api.get("/courier-accounts");
  return list(payload(res)).map(normalizeCourierAccount);
}

/** Active + configured accounts for booking (Orders.read; no Shipping Methods permission needed). */
export async function getBookingCourierAccounts(): Promise<CourierAccount[]> {
  const res = await api.get("/courier/accounts");
  return list(payload(res)).map(normalizeCourierAccount);
}

/** Accounts that can book parcels: active, an API courier and fully configured. Default first. */
export function bookableAccounts(accounts: CourierAccount[]): CourierAccount[] {
  return accounts
    .filter((a) => a.isActive && a.isIntegrated && a.hasCredentials)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
}

/**
 * Checks the stored credentials with the courier (Steadfast returns the balance). Always 200: `ok:false` + message on
 * failure (the server also saves it to `lastError`). Books nothing.
 */
export async function testCourierAccount(id: number): Promise<CourierTestResult> {
  const res = await api.post(`/courier-accounts/${id}/test`);
  const d = payload(res) ?? {};
  return {
    ok: flag(d.ok),
    message: str(d.message) ?? (flag(d.ok) ? "Connected" : "Connection failed"),
    balance: numOrNull(d.balance),
    account: d.account ? normalizeCourierAccount(d.account) : null,
  };
}

/** Pathao stores of the merchant account (booking route, Orders.read). */
export async function getCourierStores(accountId: number): Promise<CourierStore[]> {
  const res = await api.get(`/courier/accounts/${accountId}/stores`);
  return list(payload(res)).map((s: any) => ({
    id: Number(s.id),
    name: String(s.name ?? `Store ${s.id}`),
    isDefault: flag(s.isDefault),
  }));
}

/** Pathao city / zone / area list (server-cached 24h; booking route, Orders.read). */
export async function getCourierLocations(accountId: number, type: CourierLocationType, parentId?: number | null): Promise<CourierLocation[]> {
  const res = await api.get(`/courier/accounts/${accountId}/locations`, {
    params: { type, parentId: parentId ?? undefined },
  });
  return list(payload(res))
    .map((l: any) => ({
      id: Number(l.id),
      name: String(l.name ?? ""),
      homeDeliveryAvailable: l.homeDeliveryAvailable != null ? flag(l.homeDeliveryAvailable) : null,
    }))
    .filter((l) => Number.isFinite(l.id) && l.name);
}

/** Delivery charge quote (Pathao price plan). Steadfast has no price API → price null with a reason. */
export async function getCourierQuote(params: {
  courierAccountId: number;
  sellId: number;
  weightKg?: number;
  deliveryType?: number;
  itemType?: number;
  cityId?: number;
  zoneId?: number;
}): Promise<CourierQuote> {
  const res = await api.get("/courier/quote", { params });
  const d = payload(res) ?? {};
  return {
    available: flag(d.available),
    deliveryFee: numOrNull(d.deliveryFee),
    codFeePercent: numOrNull(d.codFeePercent),
    currency: str(d.currency),
    message: str(d.message),
  };
}

/** Optional: customer's delivery record at the courier (Pathao only). Resolves null when unavailable or on any error. */
export async function getCourierRisk(phone: string, courierAccountId?: number): Promise<CourierRisk | null> {
  try {
    const res = await api.get("/courier/customer-risk", { params: { phone, courierAccountId } });
    const d = payload(res);
    if (!d || typeof d !== "object" || !flag(d.available)) return null;
    return {
      available: true,
      provider: str(d.provider),
      phone,
      successRate: numOrNull(d.successRate),
      totalParcels: numOrNull(d.totalParcels),
      delivered: numOrNull(d.delivered),
      returned: numOrNull(d.returned),
      rating: str(d.rating),
      message: str(d.message),
    };
  } catch {
    return null;
  }
}

/**
 * Sends one order to the courier; returns the booked shipment (201). Fills an existing un-booked manual shipment if
 * there is one. 409 when already booked; 422 cancelled/delivered order, bad phone, missing address, courier error.
 */
export async function sendOrderToCourier(sellId: number, data: CourierBookingData): Promise<Shipment> {
  const res = await api.post(`/sells/${sellId}/courier`, data);
  return normalizeShipment(payload(res));
}

/** Pulls the latest status from the courier for one shipment. */
export async function syncShipmentCourier(shipmentId: number): Promise<Shipment> {
  const res = await api.post(`/shipments/${shipmentId}/courier/sync`);
  return normalizeShipment(payload(res));
}

/** Cancels the parcel at the courier (Pathao only). */
export async function cancelShipmentCourier(shipmentId: number): Promise<Shipment> {
  const res = await api.post(`/shipments/${shipmentId}/courier/cancel`);
  return normalizeShipment(payload(res));
}

function normalizeTrackingEvent(e: any): CourierTrackingEvent {
  return {
    status: str(e?.status ?? e?.rawStatus ?? e?.raw_status),
    text: String(e?.message ?? e?.text ?? e?.status ?? ""),
    at: str(e?.time ?? e?.at),
  };
}

/** Courier tracking events, newest first (as the server orders them). */
export async function getShipmentCourierTracking(shipmentId: number): Promise<CourierTracking> {
  const res = await api.get(`/shipments/${shipmentId}/courier/tracking`);
  const d = payload(res);
  const rawEvents = Array.isArray(d) ? d : list(d?.events ?? []);
  const events = rawEvents.map(normalizeTrackingEvent).filter((e) => e.text);
  return {
    status: Array.isArray(d) ? null : str(d?.status),
    rawStatus: Array.isArray(d) ? null : str(d?.rawStatus),
    events,
  };
}
