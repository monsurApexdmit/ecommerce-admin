import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { formatCurrency } from "@/lib/format";
import type { CartItem } from "@/types/pos";

type Props = {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

export function PosCartItem({ item, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        {item.variantName ? (
          <Text style={styles.variant}>{item.variantName}</Text>
        ) : null}
        <Text style={styles.unitPrice}>{formatCurrency(item.price)} each</Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.lineTotal}>{formatCurrency(item.price * item.quantity)}</Text>

        <View style={styles.qtyRow}>
          <Pressable
            style={[styles.qtyBtn, item.quantity <= 1 && styles.qtyBtnDisabled]}
            onPress={onDecrement}
            hitSlop={6}
          >
            <Ionicons
              name={item.quantity <= 1 ? "trash-outline" : "remove"}
              size={14}
              color={item.quantity <= 1 ? "#dc2626" : colors.text}
            />
          </Pressable>

          <Text style={styles.qty}>{item.quantity}</Text>

          <Pressable
            style={[styles.qtyBtn, item.quantity >= item.stock && styles.qtyBtnDisabled]}
            onPress={item.quantity < item.stock ? onIncrement : undefined}
            hitSlop={6}
          >
            <Ionicons
              name="add"
              size={14}
              color={item.quantity >= item.stock ? colors.muted : colors.text}
            />
          </Pressable>

          <Pressable style={styles.removeBtn} onPress={onRemove} hitSlop={6}>
            <Ionicons name="close" size={14} color={colors.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  left: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  variant: {
    color: colors.muted,
    fontSize: 12,
  },
  unitPrice: {
    color: colors.muted,
    fontSize: 12,
  },
  right: {
    alignItems: "flex-end",
    gap: 6,
  },
  lineTotal: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyBtnDisabled: {
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
  },
  qty: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    minWidth: 22,
    textAlign: "center",
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
});
