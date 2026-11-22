import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CourierStatus, ShipmentCourier } from "@/types/courier";
import { courierProviderLabel } from "@/services/courier";

type IconName = keyof typeof Ionicons.glyphMap;

export interface CourierStatusMeta {
  label: string;
  icon: IconName;
  color: string;
  bg: string;
}

export const COURIER_STATUS_META: Record<CourierStatus, CourierStatusMeta> = {
  booked:            { label: "Booked",            icon: "bookmark-outline",          color: "#475569", bg: "#f1f5f9" },
  pickup_pending:    { label: "Pickup pending",    icon: "time-outline",              color: "#92400e", bg: "#fef3c7" },
  picked:            { label: "Picked up",         icon: "archive-outline",           color: "#1d4ed8", bg: "#dbeafe" },
  in_transit:        { label: "In transit",        icon: "car-outline",               color: "#6d28d9", bg: "#ede9fe" },
  out_for_delivery:  { label: "Out for delivery",  icon: "bicycle-outline",           color: "#0f766e", bg: "#ccfbf1" },
  delivered:         { label: "Delivered",         icon: "checkmark-circle-outline",  color: "#166534", bg: "#dcfce7" },
  partial_delivered: { label: "Partially delivered",  icon: "remove-circle-outline",     color: "#166534", bg: "#ecfccb" },
  returned:          { label: "Returned",          icon: "return-down-back-outline",  color: "#991b1b", bg: "#fee2e2" },
  cancelled:         { label: "Cancelled",         icon: "close-circle-outline",      color: "#991b1b", bg: "#fee2e2" },
  on_hold:           { label: "On hold",           icon: "pause-circle-outline",      color: "#b45309", bg: "#ffedd5" },
  failed:            { label: "Delivery failed",   icon: "alert-circle-outline",      color: "#991b1b", bg: "#fee2e2" },
};

/** Filter chips for the shipments list (order follows the delivery flow). */
export const COURIER_STATUS_FILTERS: CourierStatus[] = [
  "booked", "pickup_pending", "picked", "in_transit", "out_for_delivery", "delivered", "partial_delivered", "on_hold", "returned", "cancelled", "failed",
];

const FINAL: string[] = ["delivered", "partial_delivered", "returned", "cancelled"];

export function courierStatusMeta(status?: string | null): CourierStatusMeta {
  const key = String(status ?? "").toLowerCase() as CourierStatus;
  return (
    COURIER_STATUS_META[key] ?? {
      label: status ? status.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Booked",
      icon: "cube-outline",
      color: "#475569",
      bg: "#f1f5f9",
    }
  );
}

/** Delivered / partially delivered / returned / cancelled — no more courier updates expected. */
export function isFinalCourierStatus(status?: string | null) {
  return FINAL.includes(String(status ?? "").toLowerCase());
}

/** Server flag `canCancel` (Pathao, not final); Steadfast has no cancel API. */
export function canCancelAtCourier(courier?: ShipmentCourier | null) {
  if (!courier) return false;
  if (courier.canCancel != null) return courier.canCancel;
  return courier.provider === "pathao" && !(courier.isFinal ?? isFinalCourierStatus(courier.status));
}

/** Server flag `canSync` (not final), else derived from the status. */
export function canSyncCourier(courier?: ShipmentCourier | null) {
  if (!courier) return false;
  if (courier.canSync != null) return courier.canSync;
  return !(courier.isFinal ?? isFinalCourierStatus(courier.status));
}

/** Cancelled / returned parcels free the order for a new booking; anything else is still with the courier. */
export function isLiveCourierBooking(courier?: ShipmentCourier | null) {
  if (!courier) return false;
  return !["cancelled", "returned"].includes(String(courier.status ?? "").toLowerCase());
}

/** Provider + normalized courier status, e.g. "Pathao · In transit". */
export function CourierStatusBadge({
  courier,
  size = "sm",
  showProvider = true,
}: {
  courier?: ShipmentCourier | null;
  size?: "sm" | "md";
  showProvider?: boolean;
}) {
  if (!courier) return null;
  const meta = courierStatusMeta(courier.status);
  const md = size === "md";
  return (
    <View style={[s.pill, { backgroundColor: meta.bg }, md && s.pillMd]}>
      <Ionicons name={meta.icon} size={md ? 13 : 11} color={meta.color} />
      <Text style={[s.text, { color: meta.color }, md && s.textMd]} numberOfLines={1}>
        {showProvider ? `${courierProviderLabel(courier.provider)} · ${meta.label}` : meta.label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    flexShrink: 1,
  },
  pillMd: { paddingHorizontal: 10, paddingVertical: 4, gap: 5 },
  text: { fontSize: 11, fontWeight: "700", flexShrink: 1 },
  textMd: { fontSize: 12 },
});
