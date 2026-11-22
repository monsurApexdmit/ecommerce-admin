import type { ShipmentCourier } from "@/types/courier";

const str = (v: unknown): string | null => (v == null || v === "" ? null : String(v));
const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const optFlag = (v: unknown): boolean | undefined =>
  v == null ? undefined : v === true || v === 1 || v === "1" || v === "true";

/**
 * The `courierBooking` block of a shipment DTO (on `/shipments*` and on each `sell.shipments[]`).
 * Named `courierBooking` because `sell.shipments[].courier` is a legacy string. Returns null for manual shipments.
 */
export function normalizeShipmentCourier(item: any): ShipmentCourier | null {
  if (!item || typeof item !== "object") return null;
  const c = item.courierBooking ?? item.courier_booking;
  if (!c || typeof c !== "object") return null;
  const provider = str(c.provider);
  if (!provider) return null;
  const pathao = c.pathao && typeof c.pathao === "object" ? c.pathao : null;

  return {
    provider: provider.toLowerCase(),
    accountId: numOrNull(c.accountId),
    consignmentId: str(c.consignmentId),
    trackingCode: str(c.trackingCode),
    status: str(c.status),
    rawStatus: str(c.rawStatus),
    statusAt: str(c.statusAt),
    trackingUrl: str(c.trackingUrl),
    deliveryFee: numOrNull(c.deliveryFee),
    codAmount: numOrNull(c.codAmount),
    codCollected: numOrNull(c.codCollected),
    isFinal: optFlag(c.isFinal),
    canCancel: optFlag(c.canCancel),
    canSync: optFlag(c.canSync),
    bookedAt: str(c.bookedAt),
    lastSyncedAt: str(c.lastSyncedAt),
    syncError: str(c.syncError),
    cityName: str(pathao?.cityName),
    zoneName: str(pathao?.zoneName),
    areaName: str(pathao?.areaName),
  };
}
