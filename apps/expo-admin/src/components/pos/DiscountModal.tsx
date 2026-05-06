import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";

type DiscountType = "percentage" | "fixed";

type Props = {
  visible: boolean;
  subtotal: number;
  currentDiscount: number;
  onApply: (amount: number) => void;
  onClose: () => void;
};

export function DiscountModal({ visible, subtotal, currentDiscount, onApply, onClose }: Props) {
  const { formatCurrency } = useCurrency();
  const [type, setType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setValue(currentDiscount > 0 ? String(currentDiscount) : "");
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [visible]);

  const discountAmount = (() => {
    const n = parseFloat(value) || 0;
    if (type === "percentage") return Math.min((subtotal * n) / 100, subtotal);
    return Math.min(n, subtotal);
  })();

  const afterDiscount = subtotal - discountAmount;

  const handleApply = () => {
    onApply(discountAmount);
    onClose();
  };

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

          <View style={styles.headerRow}>
            <Text style={styles.title}>Apply Discount</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {/* Type toggle */}
          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typeBtn, type === "percentage" && styles.typeBtnActive]}
              onPress={() => setType("percentage")}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: type === "percentage" ? colors.primaryDark : colors.muted }}>%</Text>
              <Text style={[styles.typeBtnText, type === "percentage" && styles.typeBtnTextActive]}>
                Percentage
              </Text>
            </Pressable>
            <Pressable
              style={[styles.typeBtn, type === "fixed" && styles.typeBtnActive]}
              onPress={() => setType("fixed")}
            >
              <Ionicons name="cash-outline" size={16} color={type === "fixed" ? colors.primaryDark : colors.muted} />
              <Text style={[styles.typeBtnText, type === "fixed" && styles.typeBtnTextActive]}>
                Fixed Amount
              </Text>
            </Pressable>
          </View>

          {/* Input */}
          <View style={styles.inputWrap}>
            <Text style={styles.inputPrefix}>{type === "percentage" ? "%" : "$"}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder={type === "percentage" ? "e.g. 10" : "e.g. 20.00"}
              placeholderTextColor="#94a3b8"
              value={value}
              onChangeText={setValue}
              returnKeyType="done"
              onSubmitEditing={handleApply}
            />
          </View>

          {/* Preview */}
          <View style={styles.preview}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Subtotal</Text>
              <Text style={styles.previewValue}>{formatCurrency(subtotal)}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Discount</Text>
              <Text style={[styles.previewValue, styles.discountValue]}>
                − {formatCurrency(discountAmount)}
              </Text>
            </View>
            <View style={[styles.previewRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>After Discount</Text>
              <Text style={styles.totalValue}>{formatCurrency(afterDiscount)}</Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={() => { onApply(0); onClose(); }}>
              <Text style={styles.cancelBtnText}>Remove</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>Apply Discount</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  typeRow: {
    flexDirection: "row",
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  typeBtnActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  typeBtnText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "700",
  },
  typeBtnTextActive: {
    color: colors.primaryDark,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    height: 54,
    gap: 10,
  },
  inputPrefix: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: "700",
    width: 20,
    textAlign: "center",
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  preview: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  previewLabel: {
    color: colors.muted,
    fontSize: 14,
  },
  previewValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  discountValue: {
    color: "#dc2626",
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 2,
  },
  totalLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  totalValue: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 15,
    alignItems: "center",
  },
  cancelBtnText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 2,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 15,
    alignItems: "center",
  },
  applyBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
