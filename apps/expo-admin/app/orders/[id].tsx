import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { apiErrorMessage, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import { printInvoice, shareInvoicePdf } from "@/lib/invoice";
import {
  deleteOrder,
  getOrderById,
  updateOrder,
} from "@/services/order-service";
import type { Order } from "@/types/order";
import { OrderStagePill } from "@/components/orders/OrderStatusPill";
import { FollowUpHistory, FollowUpSheet, useFollowUps } from "@/components/orders/FollowUpSheet";
import {
  canFollowUp,
  followUpSummary,
  orderPhone,
  orderStage,
  runStageAction,
  stageActions,
  telUrl,
} from "@/components/orders/order-utils";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

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
  const [busy, setBusy] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const orderId = Number(params.id);
  const history = useFollowUps(Number.isFinite(orderId) ? orderId : null, historyKey);

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
    } catch (err) {
      Alert.alert("Could not load order", apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!Number.isFinite(orderId)) return;
    void load();
  }, [load, orderId]);

  const { canRead, canWrite, canDelete } = useAuth();
  if (!canRead('Orders')) return <AccessDenied />;

  const saveNotes = async () => {
    if (!order || notes === (order.notes ?? "")) return;
    try {
      setSaving(true);
      const updated = await updateOrder(order.id, { notes });
      setOrder(updated);
    } catch (err) {
      Alert.alert("Could not save note", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(telUrl(phone)).catch(() => Alert.alert("Cannot start a call", `Dial ${phone} manually.`));
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

  const stage = orderStage(order);
  const actions = stageActions(order);
  const followable = canFollowUp(order);
  const fu = followUpSummary(order);
  const phone = orderPhone(order);
  const itemsSubtotal = order.items.reduce((sum, item) => sum + itemTotal(item), 0);

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
            <OrderStagePill order={order} />
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
          {order.source ? (
            <ProductStatusPill label={order.source === "pos" ? "POS" : order.source === "storefront" ? "Online" : "Sales"} tone="neutral" />
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <InfoRow label="Name" value={order.customerName || "-"} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Phone</Text>
          <View style={styles.phoneValue}>
            <Text style={[styles.infoValue, { flex: 0 }]}>{phone || "-"}</Text>
            {phone ? (
              <Pressable style={styles.callChip} onPress={() => callCustomer(phone)} hitSlop={6}>
                <Ionicons name="call" size={13} color="#fff" />
                <Text style={styles.callChipText}>Call</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
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

      {order.courier || order.zoneName || order.deliveryNote || order.shippingMethodName || order.trackingNumber ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery</Text>
          {order.shippingMethodName ? <InfoRow label="Delivery option" value={order.shippingMethodName} /> : null}
          {order.courier || order.carrier ? <InfoRow label="Courier" value={order.courier || order.carrier || "-"} /> : null}
          {order.zoneName ? <InfoRow label="Zone" value={order.zoneName} /> : null}
          {order.trackingNumber ? <InfoRow label="Tracking" value={order.trackingNumber} /> : null}
          {order.shippedAt ? <InfoRow label="Shipped" value={formatDateTime(order.shippedAt)} /> : null}
          {order.deliveryNote ? (
            <View style={styles.noteBox}>
              <Ionicons name="document-text-outline" size={14} color={colors.muted} />
              <Text style={styles.noteBoxText}>{order.deliveryNote}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

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
        {order.transactionId ? <InfoRow label="Transaction ID" value={order.transactionId} /> : null}
        {order.locationName ? <InfoRow label="Sold from" value={order.locationName} /> : null}
        <InfoRow label="Subtotal" value={formatCurrency(itemsSubtotal)} />
        <InfoRow label="Shipping Cost" value={formatCurrency(Number(order.shippingCost ?? 0))} />
        <InfoRow
          label={order.couponCode ? `Discount (${order.couponCode})` : "Discount"}
          value={`${Number(order.discount ?? 0) > 0 ? "− " : ""}${formatCurrency(Number(order.discount ?? 0))}`}
        />
        {Number(order.taxAmount ?? 0) > 0 ? (
          <InfoRow
            label={order.taxRate ? `Tax (${order.taxRate}%)` : "Tax"}
            value={formatCurrency(Number(order.taxAmount ?? 0))}
          />
        ) : null}
        <InfoRow label="Total Amount" value={formatCurrency(Number(order.amount ?? 0))} highlight />
        {order.paidAmount != null ? <InfoRow label="Paid" value={formatCurrency(order.paidAmount)} /> : null}
        {Number(order.dueAmount ?? 0) > 0 ? <InfoRow label="Due" value={formatCurrency(Number(order.dueAmount))} /> : null}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Status</Text>
          <OrderStagePill order={order} />
        </View>
        {actions.length > 0 && canWrite("Orders") ? (
          <View style={styles.actionsRow}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                disabled={busy}
                style={[
                  styles.statusButton,
                  action.key === "confirm" && styles.statusButtonActive,
                  action.destructive && styles.statusButtonDanger,
                  busy && { opacity: 0.5 },
                ]}
                onPress={async () => {
                  setBusy(true);
                  try {
                    const updated = await runStageAction(order, action);
                    if (updated) { setOrder(updated); setHistoryKey((k) => k + 1); }
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Text style={[
                  styles.statusButtonText,
                  action.key === "confirm" && styles.statusButtonTextActive,
                  action.destructive && { color: "#dc2626" },
                ]}>
                  {action.key === "confirm" ? "Confirm" : action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            {stage === "Cancelled" ? "This order was cancelled." : "This order is delivered. Use a return for any changes."}
          </Text>
        )}
      </View>

      {followable || (order.followUpCount ?? 0) > 0 ? (
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Follow-ups</Text>
            {followable && canWrite("Orders") ? (
              <Pressable style={styles.smallPrimary} onPress={() => setFollowUpOpen(true)}>
                <Ionicons name="call-outline" size={14} color="#fff" />
                <Text style={styles.smallPrimaryText}>Log follow-up</Text>
              </Pressable>
            ) : null}
          </View>
          {fu ? (
            <Text style={[styles.followSummary, fu.overdue && { color: "#dc2626", fontWeight: "700" }]}>
              {fu.text}{fu.overdue ? " (overdue)" : ""}
            </Text>
          ) : null}
          <FollowUpHistory items={history.items} loading={history.loading} />
        </View>
      ) : null}

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
        <Pressable style={styles.primaryButton} onPress={() => void shareInvoicePdf(order, formatCurrency)}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Download Invoice</Text>
        </Pressable>

        {/* Print + Shipments — side by side */}
        <View style={styles.rowButtons}>
          <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => void printInvoice(order, formatCurrency)}>
            <Ionicons name="print-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.secondaryButtonText}>Print</Text>
          </Pressable>
          <Pressable style={[styles.secondaryButton, { flex: 1 }]} onPress={() => router.push("/orders/shipments")}>
            <Ionicons name="cube-outline" size={17} color={colors.primaryDark} />
            <Text style={styles.secondaryButtonText}>Shipments</Text>
          </Pressable>
        </View>

        {/* Delete — only cancelled orders without payments/returns (server enforces) */}
        {order.status === "Cancelled" && canDelete("Orders") ? (
          <Pressable
            style={styles.dangerButton}
            onPress={() =>
              Alert.alert("Delete order", `Delete #${order.invoiceNo}? This cannot be undone.`, [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteOrder(order.id);
                      router.replace("/(tabs)/orders");
                    } catch (err) {
                      Alert.alert("Could not delete", apiErrorMessage(err));
                    }
                  },
                },
              ])
            }
          >
            <Ionicons name="trash-outline" size={17} color="#dc2626" />
            <Text style={styles.dangerButtonText}>Delete Order</Text>
          </Pressable>
        ) : null}
      </View>
      </ScrollView>

      <FollowUpSheet
        order={followUpOpen ? order : null}
        onClose={() => setFollowUpOpen(false)}
        onSaved={(updated) => {
          setOrder((prev) => (prev ? { ...prev, ...updated, items: updated.items.length ? updated.items : prev.items } : updated));
          setHistoryKey((k) => k + 1);
        }}
      />
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
  statusButtonDanger: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  smallPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  followSummary: {
    color: colors.muted,
    fontSize: 13,
  },
  phoneValue: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  callChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  callChipText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  noteBox: {
    flexDirection: "row",
    gap: 8,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  noteBoxText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
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
