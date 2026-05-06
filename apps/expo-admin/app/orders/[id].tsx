import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import { printInvoice, shareInvoicePdf } from "@/lib/invoice";
import {
  deleteOrder,
  getOrderById,
  updateOrder,
  updateOrderStatus,
} from "@/services/order-service";
import type { Order } from "@/types/order";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";

function itemPrice(item: Order["items"][number]) {
  return Number(item.unitPrice ?? item.price ?? 0);
}

function itemTotal(item: Order["items"][number]) {
  return Number(item.totalPrice ?? itemPrice(item) * item.quantity);
}

function paymentStatusTone(status?: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) return "neutral";
  if (["paid", "completed", "success"].includes(normalized)) return "success";
  if (["pending", "partial", "authorized"].includes(normalized)) return "warning";
  if (["failed", "cancelled", "canceled", "refunded", "unpaid"].includes(normalized)) return "danger";
  return "neutral";
}

function fulfillmentStatusTone(status?: string): "neutral" | "success" | "warning" | "danger" | "info" {
  const normalized = status?.trim().toLowerCase();

  if (!normalized) return "neutral";
  if (["delivered", "fulfilled", "shipped"].includes(normalized)) return "success";
  if (["processing", "packed", "picked", "pending"].includes(normalized)) return "warning";
  if (["cancelled", "canceled", "failed", "returned"].includes(normalized)) return "danger";
  if (["unfulfilled", "ready_to_ship"].includes(normalized)) return "info";
  return "neutral";
}

export default function OrderDetailScreen() {
  const { formatCurrency } = useCurrency();
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const orderId = Number(params.id);

  const copyOrderNo = (invoiceNo: string) => {
    void Clipboard.setStringAsync(invoiceNo);
    if (Platform.OS === "android") {
      ToastAndroid.show("Order number copied", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", `#${invoiceNo} copied to clipboard`);
    }
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const next = await getOrderById(orderId);
      setOrder(next);
      setNotes(next.notes ?? "");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!Number.isFinite(orderId)) return;
    void load();
  }, [load, orderId]);

  const saveNotes = async () => {
    if (!order || notes === (order.notes ?? "")) return;
    try {
      setSaving(true);
      const updated = await updateOrder(order.id, { notes });
      setOrder(updated);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !order) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Order</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>#{order.invoiceNo}</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.headerTitleBlock}>
            <View style={styles.invoiceRow}>
              <Text style={styles.invoice}>#{order.invoiceNo}</Text>
              <Pressable
                onPress={() => copyOrderNo(order.invoiceNo)}
                hitSlop={10}
                style={styles.copyBtn}
              >
                <Ionicons name="copy-outline" size={16} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.orderTime}>{formatDateTime(order.orderTime)}</Text>
          </View>
          <View style={styles.headerStatus}>
            <OrderStatusPill status={order.status} />
          </View>
        </View>
        <View style={styles.badges}>
          <ProductStatusPill label={order.method} tone="warning" />
          {order.paymentStatus ? (
            <ProductStatusPill label={order.paymentStatus} tone={paymentStatusTone(order.paymentStatus)} />
          ) : null}
          {order.fulfillmentStatus ? (
            <ProductStatusPill label={order.fulfillmentStatus} tone={fulfillmentStatusTone(order.fulfillmentStatus)} />
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <InfoRow label="Name" value={order.customerName || "-"} />
        <InfoRow label="Phone" value={order.customerPhone || order.shippingPhone || "-"} />
        <InfoRow label="Email" value={order.customerEmail || order.shippingEmail || "-"} />
        <InfoRow
          label="Address"
          value={order.customerAddress || `${order.shippingAddressLine1 ?? ""} ${order.shippingAddressLine2 ?? ""}`.trim() || "-"}
        />
        <InfoRow
          label="City"
          value={order.customerCity || [order.shippingCity, order.shippingState, order.shippingPostalCode].filter(Boolean).join(", ") || "-"}
        />
        <InfoRow label="Country" value={order.customerCountry || order.shippingCountry || "-"} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Items</Text>
        {order.items.length > 0 ? (
          order.items.map((item, index) => (
            <View key={`${item.id ?? index}-${item.productName}`} style={styles.itemRow}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.itemName}>{item.productName}</Text>
                <Text style={styles.itemMeta}>
                  Qty {item.quantity} · {formatCurrency(itemPrice(item))}
                </Text>
              </View>
              <Text style={styles.itemTotal}>{formatCurrency(itemTotal(item))}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No item details available.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Summary</Text>
        <InfoRow label="Payment Method" value={order.method} />
        <InfoRow label="Shipping Cost" value={formatCurrency(Number(order.shippingCost ?? 0))} />
        <InfoRow label="Discount" value={formatCurrency(Number(order.discount ?? 0))} />
        <InfoRow label="Total Amount" value={formatCurrency(Number(order.amount ?? 0))} highlight />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Status</Text>
        <View style={styles.actionsRow}>
          {(["Pending", "Processing", "Delivered"] as Order["status"][]).map((status) => (
            <Pressable
              key={status}
              style={[styles.statusButton, order.status === status ? styles.statusButtonActive : null]}
              onPress={async () => {
                const updated = await updateOrderStatus(order.id, status);
                setOrder(updated);
              }}
            >
              <Text style={[styles.statusButtonText, order.status === status ? styles.statusButtonTextActive : null]}>
                {status}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Note</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => void saveNotes()}
          placeholder="Add a note to this order..."
          style={styles.noteInput}
          multiline
        />
        {saving ? <Text style={styles.noteHint}>Saving…</Text> : <Text style={styles.noteHint}>Saves when you leave the field.</Text>}
      </View>

      {/* Action buttons */}
      <View style={styles.actionsBlock}>
        {/* Download — full width primary */}
        <Pressable style={styles.primaryButton} onPress={() => void shareInvoicePdf(order)}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Download Invoice</Text>
        </Pressable>

        {/* Print + Shipments — side by side */}
        <View style={styles.rowButtons}>
          <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => void printInvoice(order)}>
            <Ionicons name="print-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.secondaryButtonText}>Print</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => router.push("/orders/shipments")}>
            <Ionicons name="cube-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.secondaryButtonText}>Shipments</Text>
          </Pressable>
        </View>

        {/* Delete — outlined danger, full width, less prominent */}
        <Pressable
          style={styles.dangerButton}
          onPress={() =>
            Alert.alert("Delete order", `Delete #${order.invoiceNo}? This cannot be undone.`, [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  await deleteOrder(order.id);
                  router.replace("/(tabs)/orders");
                },
              },
            ])
          }
        >
          <Ionicons name="trash-outline" size={17} color="#dc2626" />
          <Text style={styles.dangerButtonText}>Delete Order</Text>
        </Pressable>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight ? styles.infoValueHighlight : null]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
    backgroundColor: colors.background,
  },
  headerCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  headerStatus: {
    alignSelf: "flex-start",
    maxWidth: "100%",
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoice: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  copyBtn: {
    padding: 2,
  },
  orderTime: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 13,
    flex: 1,
  },
  infoValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    textAlign: "right",
  },
  infoValueHighlight: {
    color: colors.primaryDark,
    fontSize: 16,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 4,
  },
  itemName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  itemTotal: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  statusButton: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusButtonActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  statusButtonText: {
    color: colors.text,
    fontWeight: "700",
  },
  statusButtonTextActive: {
    color: colors.primaryDark,
  },
  noteInput: {
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    textAlignVertical: "top",
  },
  noteHint: {
    color: colors.muted,
    fontSize: 12,
  },
  actionsBlock: {
    gap: 10,
    paddingBottom: 8,
  },
  rowButtons: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  dangerButtonText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
});
