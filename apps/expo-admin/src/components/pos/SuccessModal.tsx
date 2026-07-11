import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import type { CompletedSale } from "@/types/pos";

type Props = {
  visible: boolean;
  sale: CompletedSale | null;
  onNewOrder: () => void;
};

export function SuccessModal({ visible, sale, onNewOrder }: Props) {
  const { formatCurrency } = useCurrency();
  if (!sale) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNewOrder}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Success icon */}
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={64} color={colors.primary} />
          </View>

          <Text style={styles.title}>Payment Successful!</Text>

          {/* Invoice badge */}
          <View style={styles.invoiceBadge}>
            <Ionicons name="receipt-outline" size={14} color="#1d4ed8" />
            <Text style={styles.invoiceText}>#{sale.invoiceNo}</Text>
          </View>

          {/* Customer + items summary */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Ionicons name="person-outline" size={14} color={colors.muted} />
              <Text style={styles.summaryText}>{sale.customerName}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="cube-outline" size={14} color={colors.muted} />
              <Text style={styles.summaryText}>
                {sale.itemCount} item{sale.itemCount !== 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Ionicons name="card-outline" size={14} color={colors.muted} />
              <Text style={styles.summaryText}>{sale.method}</Text>
            </View>
          </View>

          {/* Price breakdown */}
          <View style={styles.breakdown}>
            <BreakdownRow label="Subtotal" value={formatCurrency(sale.subtotal)} />
            {sale.discount > 0 && (
              <BreakdownRow label="Discount" value={`− ${formatCurrency(sale.discount)}`} valueColor="#dc2626" />
            )}
            {sale.couponDiscount > 0 && (
              <BreakdownRow label="Coupon" value={`− ${formatCurrency(sale.couponDiscount)}`} valueColor="#dc2626" />
            )}
            {sale.tax > 0 && (
              <BreakdownRow label="Tax" value={formatCurrency(sale.tax)} />
            )}
            {sale.method === "Cash" && sale.tendered != null && sale.change != null && (
              <>
                <BreakdownRow label="Tendered" value={formatCurrency(sale.tendered)} />
                <BreakdownRow label="Change" value={formatCurrency(sale.change)} valueColor="#16a34a" />
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValue}>{formatCurrency(sale.total)}</Text>
            </View>
          </View>

          {/* Action */}
          <Pressable style={styles.newOrderBtn} onPress={onNewOrder}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.newOrderText}>New Order</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function BreakdownRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={breakdownStyles.row}>
      <Text style={breakdownStyles.label}>{label}</Text>
      <Text style={[breakdownStyles.value, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

const breakdownStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 13, fontWeight: "600" },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    gap: 14,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  invoiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  invoiceText: {
    color: "#1d4ed8",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  breakdown: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalLabel: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  totalValue: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "800",
  },
  newOrderBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 54,
  },
  newOrderText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
});
