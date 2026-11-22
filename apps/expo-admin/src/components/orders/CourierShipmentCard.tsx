import { useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage, formatDateTime } from "@/lib/format";
import { copyText, shareText } from "@/components/marketing/link-share";
import {
  cancelShipmentCourier,
  courierProviderLabel,
  getShipmentCourierTracking,
  syncShipmentCourier,
} from "@/services/courier";
import type { ShipmentCourier, CourierTracking } from "@/types/courier";
import type { Shipment } from "@/types/order";
import { CourierStatusBadge, canCancelAtCourier, canSyncCourier, courierStatusMeta } from "./CourierStatusBadge";

type Props = {
  shipmentId: number;
  courier: ShipmentCourier;
  invoiceNo?: string;
  /** Shipments.write — refresh / cancel buttons */
  canManage?: boolean;
  /** Shipments.read — tracking timeline */
  canTrack?: boolean;
  /** Called after a refresh or cancel with the updated shipment (reload the parent). */
  onChanged?: (shipment: Shipment) => void;
  /** Compact = no outer card border (inside another card / sheet). */
  compact?: boolean;
};

/** Courier parcel status: tracking code copy / share, refresh, cancel (Pathao) and the courier's tracking timeline. */
export function CourierShipmentCard({ shipmentId, courier, invoiceNo, canManage = true, canTrack = true, onChanged, compact }: Props) {
  const { formatCurrency } = useCurrency();
  const [busy, setBusy] = useState<"sync" | "cancel" | null>(null);
  const [tracking, setTracking] = useState<CourierTracking | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState("");

  const provider = courierProviderLabel(courier.provider);
  const code = courier.trackingCode || courier.consignmentId || "";
  const meta = courierStatusMeta(courier.status);

  const loadTracking = async () => {
    setTrackingLoading(true);
    setTrackingError("");
    try {
      setTracking(await getShipmentCourierTracking(shipmentId));
    } catch (e) {
      setTrackingError(apiErrorMessage(e, "Could not load tracking."));
    } finally {
      setTrackingLoading(false);
    }
  };

  const refresh = async () => {
    setBusy("sync");
    try {
      const updated = await syncShipmentCourier(shipmentId);
      onChanged?.(updated);
      if (trackingOpen) void loadTracking();
    } catch (e) {
      Alert.alert("Could not refresh", apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const cancel = () => {
    Alert.alert(
      `Cancel at ${provider}?`,
      `The parcel${invoiceNo ? ` for #${invoiceNo}` : ""} is cancelled at the courier. The order itself is not cancelled.`,
      [
        { text: "Back", style: "cancel" },
        {
          text: "Cancel parcel",
          style: "destructive",
          onPress: async () => {
            setBusy("cancel");
            try {
              const updated = await cancelShipmentCourier(shipmentId);
              onChanged?.(updated);
            } catch (e) {
              Alert.alert("Could not cancel", apiErrorMessage(e));
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const share = () => {
    const lines = [
      `Your parcel${invoiceNo ? ` for order #${invoiceNo}` : ""} is with ${provider}.`,
      code ? `Tracking code: ${code}` : "",
      courier.trackingUrl ? `Track: ${courier.trackingUrl}` : "",
    ].filter(Boolean);
    void shareText(lines.join("\n"));
  };

  const toggleTracking = () => {
    const next = !trackingOpen;
    setTrackingOpen(next);
    if (next && !tracking && !trackingLoading) void loadTracking();
  };

  return (
    <View style={[s.wrap, !compact && s.card]}>
      <View style={s.topRow}>
        <View style={[s.iconWell, { backgroundColor: meta.bg }]}>
          <Ionicons name="bicycle-outline" size={18} color={meta.color} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.provider}>{provider}</Text>
          <CourierStatusBadge courier={courier} showProvider={false} size="md" />
        </View>
        {canManage && canSyncCourier(courier) ? (
          <Pressable style={[s.iconBtn, busy && { opacity: 0.5 }]} onPress={() => void refresh()} disabled={!!busy} hitSlop={6}>
            {busy === "sync" ? <ActivityIndicator size="small" color={colors.primaryDark} /> : <Ionicons name="refresh" size={17} color={colors.primaryDark} />}
          </Pressable>
        ) : null}
      </View>

      {code ? (
        <View style={s.codeBox}>
          <View style={{ flex: 1 }}>
            <Text style={s.codeLabel}>Tracking code</Text>
            <Text style={s.code} selectable>{code}</Text>
          </View>
          <Pressable style={s.codeBtn} onPress={() => void copyText(code, "Tracking code copied")} hitSlop={6}>
            <Ionicons name="copy-outline" size={16} color={colors.primaryDark} />
          </Pressable>
          <Pressable style={s.codeBtn} onPress={share} hitSlop={6}>
            <Ionicons name="share-social-outline" size={16} color={colors.primaryDark} />
          </Pressable>
        </View>
      ) : null}

      <View style={s.rows}>
        {courier.consignmentId && courier.consignmentId !== code ? <Row label="Consignment" value={courier.consignmentId} /> : null}
        {courier.rawStatus ? <Row label="Courier status" value={courier.rawStatus.replace(/_/g, " ")} /> : null}
        {courier.statusAt ? <Row label="Status updated" value={formatDateTime(courier.statusAt)} /> : null}
        {courier.codAmount != null ? <Row label="COD" value={courier.codAmount > 0 ? formatCurrency(courier.codAmount) : "Prepaid"} /> : null}
        {courier.codCollected != null ? <Row label="COD collected" value={formatCurrency(courier.codCollected)} /> : null}
        {courier.deliveryFee != null ? <Row label="Delivery charge" value={formatCurrency(courier.deliveryFee)} /> : null}
        {courier.cityName || courier.zoneName ? (
          <Row label="Location" value={[courier.areaName, courier.zoneName, courier.cityName].filter(Boolean).join(", ")} />
        ) : null}
        {courier.bookedAt ? <Row label="Booked" value={formatDateTime(courier.bookedAt)} /> : null}
        <Row label="Last checked" value={courier.lastSyncedAt ? formatDateTime(courier.lastSyncedAt) : "Not yet"} />
      </View>

      {courier.syncError ? (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
          <Text style={s.errorText}>{courier.syncError}</Text>
        </View>
      ) : null}

      <View style={s.btnRow}>
        {canTrack ? (
          <Pressable style={s.ghostBtn} onPress={toggleTracking}>
            <Ionicons name={trackingOpen ? "chevron-up" : "git-commit-outline"} size={15} color={colors.primaryDark} />
            <Text style={s.ghostBtnText}>{trackingOpen ? "Hide tracking" : "Tracking"}</Text>
          </Pressable>
        ) : null}
        {courier.trackingUrl ? (
          <Pressable
            style={s.ghostBtn}
            onPress={() => Linking.openURL(courier.trackingUrl!).catch(() => Alert.alert("Cannot open link", courier.trackingUrl!))}
          >
            <Ionicons name="open-outline" size={15} color={colors.primaryDark} />
            <Text style={s.ghostBtnText}>Track page</Text>
          </Pressable>
        ) : null}
        {canManage && canCancelAtCourier(courier) ? (
          <Pressable style={[s.ghostBtn, s.dangerBtn, busy && { opacity: 0.5 }]} onPress={cancel} disabled={!!busy}>
            {busy === "cancel" ? <ActivityIndicator size="small" color="#dc2626" /> : <Ionicons name="close-circle-outline" size={15} color="#dc2626" />}
            <Text style={[s.ghostBtnText, { color: "#dc2626" }]}>Cancel at courier</Text>
          </Pressable>
        ) : null}
      </View>

      {trackingOpen ? (
        trackingLoading ? (
          <ActivityIndicator color={colors.primaryDark} style={{ paddingVertical: 10 }} />
        ) : trackingError ? (
          <Text style={s.muted}>{trackingError}</Text>
        ) : tracking && tracking.events.length > 0 ? (
          <View style={s.timeline}>
            {tracking.events.map((e, i) => (
              <View key={`${e.at}-${i}`} style={s.tlItem}>
                <View style={s.tlLine}>
                  <View style={[s.tlDot, i === 0 && { backgroundColor: meta.color }]} />
                  {i < tracking.events.length - 1 ? <View style={s.tlConnector} /> : null}
                </View>
                <View style={s.tlContent}>
                  <Text style={[s.tlText, i === 0 && { fontWeight: "800" }]}>{e.text}</Text>
                  {e.at ? <Text style={s.tlTime}>{formatDateTime(e.at)}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.muted}>No tracking events from {provider} yet.</Text>
        )
      ) : null}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 14 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWell: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  provider: { color: colors.text, fontSize: 15, fontWeight: "800" },
  iconBtn: {
    width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: "#ecfdf5", borderWidth: 1, borderColor: colors.primaryDark + "33",
  },
  codeBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primaryDark + "66",
    backgroundColor: "#f0fdf4", paddingHorizontal: 12, paddingVertical: 10,
  },
  codeLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  code: { color: colors.text, fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  codeBtn: {
    width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  rows: { gap: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: "700", flex: 1.4, textAlign: "right", textTransform: "none" },
  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderRadius: 10, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", padding: 8,
  },
  errorText: { flex: 1, color: "#991b1b", fontSize: 12, lineHeight: 17 },
  btnRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 10, borderWidth: 1, borderColor: colors.primaryDark + "44", backgroundColor: "#ecfdf5",
    paddingHorizontal: 10, paddingVertical: 7,
  },
  ghostBtnText: { color: colors.primaryDark, fontSize: 12, fontWeight: "700" },
  dangerBtn: { borderColor: "#fca5a5", backgroundColor: "#fff5f5" },
  muted: { color: colors.muted, fontSize: 12 },
  timeline: { paddingTop: 2 },
  tlItem: { flexDirection: "row", gap: 10 },
  tlLine: { alignItems: "center", width: 14 },
  tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, backgroundColor: colors.border },
  tlConnector: { flex: 1, width: 2, backgroundColor: colors.border, marginTop: 3 },
  tlContent: { flex: 1, paddingBottom: 12, gap: 2 },
  tlText: { color: colors.text, fontSize: 13, lineHeight: 18 },
  tlTime: { color: colors.muted, fontSize: 11 },
});
