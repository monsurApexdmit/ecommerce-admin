import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import type { CompletedSale, PaymentMethod } from "@/types/pos";

type Props = {
  visible: boolean;
  total: number;
  subtotal: number;
  discount: number;
  couponDiscount: number;
  tax: number;
  customerName: string;
  itemCount: number;
  onConfirm: (method: PaymentMethod, tendered: number, change: number) => void;
  onClose: () => void;
  submitting: boolean;
};

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: string }[] = [
  { id: "Cash",  label: "Cash",  icon: "cash-outline" },
  { id: "Card",  label: "Card",  icon: "card-outline" },
  { id: "Online", label: "Online", icon: "globe-outline" },
];

export function CheckoutModal({
  visible, total, subtotal, discount, couponDiscount, tax,
  customerName, itemCount, onConfirm, onClose, submitting,
}: Props) {
  const { formatCurrency } = useCurrency();
  const [method, setMethod] = useState<PaymentMethod>("Cash");
  const [tendered, setTendered] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setMethod("Cash");
      setTendered("");
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [visible]);

  const tenderedNum = parseFloat(tendered) || 0;
  const change = method === "Cash" && tenderedNum >= total ? tenderedNum - total : 0;
  const canConfirm = method !== "Cash" || tenderedNum >= total;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Gradient-style header */}
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.lockBadge}>
                <Ionicons name="lock-closed" size={12} color="#fff" />
                <Text style={styles.lockText}>Secure Payment</Text>
              </View>
            </View>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            <Text style={styles.headerSub}>
              {itemCount} item{itemCount !== 1 ? "s" : ""} · {customerName}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
            {/* Payment method */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Payment Method</Text>
              <View style={styles.methodRow}>
                {PAYMENT_METHODS.map((m) => (
                  <Pressable
                    key={m.id}
                    style={[styles.methodBtn, method === m.id && styles.methodBtnActive]}
                    onPress={() => setMethod(m.id)}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={22}
                      color={method === m.id ? colors.primaryDark : colors.muted}
                    />
                    <Text style={[styles.methodLabel, method === m.id && styles.methodLabelActive]}>
                      {m.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Cash tendered */}
            {method === "Cash" && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Amount Tendered</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>$</Text>
                  <TextInput
                    ref={inputRef}
                    style={styles.input}
                    keyboardType="decimal-pad"
                    placeholder={formatCurrency(total).replace("$", "")}
                    placeholderTextColor="#94a3b8"
                    value={tendered}
                    onChangeText={setTendered}
                    returnKeyType="done"
                  />
                </View>
                {tenderedNum >= total && tenderedNum > 0 && (
                  <View style={styles.changeRow}>
                    <Text style={styles.changeLabel}>Change</Text>
                    <Text style={styles.changeValue}>{formatCurrency(change)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Order summary */}
            <View style={styles.summaryCard}>
              <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
              {discount > 0 && (
                <SummaryRow label="Discount" value={`− ${formatCurrency(discount)}`} valueColor="#dc2626" />
              )}
              {couponDiscount > 0 && (
                <SummaryRow label="Coupon" value={`− ${formatCurrency(couponDiscount)}`} valueColor="#dc2626" />
              )}
              {tax > 0 && (
                <SummaryRow label="Tax" value={formatCurrency(tax)} />
              )}
              <View style={styles.divider} />
              <SummaryRow label="Total" value={formatCurrency(total)} bold />
            </View>
          </ScrollView>

          {/* Confirm button */}
          <Pressable
            style={[styles.confirmBtn, (!canConfirm || submitting) && styles.confirmBtnDisabled]}
            onPress={() => canConfirm && !submitting && onConfirm(method, tenderedNum, change)}
            disabled={!canConfirm || submitting}
          >
            {submitting ? (
              <Text style={styles.confirmText}>Processing...</Text>
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.confirmText}>Confirm Payment</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SummaryRow({
  label, value, bold, valueColor,
}: {
  label: string; value: string; bold?: boolean; valueColor?: string;
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={[summaryStyles.label, bold && summaryStyles.bold]}>{label}</Text>
      <Text style={[summaryStyles.value, bold && summaryStyles.bold, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { color: colors.muted, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: "600" },
  bold: { color: colors.text, fontSize: 16, fontWeight: "800" },
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.45)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
    maxHeight: "90%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  // Header card
  headerCard: {
    borderRadius: 20,
    backgroundColor: colors.primaryDark,
    padding: 20,
    gap: 4,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  lockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  totalLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
  totalValue: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  headerSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    marginTop: 2,
  },
  // Sections
  section: {
    gap: 10,
    marginBottom: 4,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  methodRow: {
    flexDirection: "row",
    gap: 10,
  },
  methodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  methodBtnActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  methodLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  methodLabelActive: {
    color: colors.primaryDark,
  },
  // Tendered input
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    height: 56,
    gap: 8,
  },
  inputPrefix: {
    color: colors.muted,
    fontSize: 20,
    fontWeight: "700",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
  },
  changeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  changeLabel: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "600",
  },
  changeValue: {
    color: "#16a34a",
    fontSize: 16,
    fontWeight: "800",
  },
  // Summary
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 6,
  },
  // Confirm
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 56,
    marginTop: 4,
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },
});
