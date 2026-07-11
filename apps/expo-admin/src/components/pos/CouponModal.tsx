import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getActiveCoupons } from "@/services/pos";
import type { Coupon } from "@/types/pos";

type Props = {
  visible: boolean;
  subtotal: number;
  appliedCoupon: Coupon | null;
  onApply: (coupon: Coupon, discountAmount: number) => void;
  onRemove: () => void;
  onClose: () => void;
};

export function CouponModal({ visible, subtotal, appliedCoupon, onApply, onRemove, onClose }: Props) {
  const { formatCurrency } = useCurrency();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getActiveCoupons()
      .then(setCoupons)
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, [visible]);

  const calcDiscount = (coupon: Coupon) => {
    if (subtotal < coupon.minOrderAmount) return 0;
    if (coupon.type === "percentage") {
      const raw = (subtotal * coupon.discount) / 100;
      return coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
    }
    if (coupon.type === "fixed") return Math.min(coupon.discount, subtotal);
    return 0;
  };

  const handleSelect = (coupon: Coupon) => {
    const amount = calcDiscount(coupon);
    onApply(coupon, amount);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.handle} />

        <View style={styles.headerRow}>
          <Text style={styles.title}>Apply Coupon</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>

        {appliedCoupon && (
          <Pressable style={styles.appliedBanner} onPress={onRemove}>
            <Ionicons name="ticket-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.appliedText}>
              Applied: <Text style={styles.appliedCode}>{appliedCoupon.code}</Text>
            </Text>
            <Text style={styles.removeText}>Remove ✕</Text>
          </Pressable>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primaryDark} />
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.center}>
            <Ionicons name="ticket-outline" size={32} color={colors.muted} />
            <Text style={styles.emptyText}>No active coupons</Text>
          </View>
        ) : (
          <FlatList
            data={coupons}
            keyExtractor={(item) => String(item.id)}
            style={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            renderItem={({ item }) => {
              const discount = calcDiscount(item);
              const eligible = subtotal >= item.minOrderAmount;
              const isApplied = appliedCoupon?.id === item.id;

              return (
                <Pressable
                  style={[
                    styles.couponCard,
                    isApplied && styles.couponCardActive,
                    !eligible && styles.couponCardDisabled,
                  ]}
                  onPress={eligible ? () => handleSelect(item) : undefined}
                >
                  <View style={styles.couponLeft}>
                    <View style={styles.codeTag}>
                      <Text style={styles.codeText}>{item.code}</Text>
                    </View>
                    <Text style={styles.campaignName}>{item.campaignName}</Text>
                    {item.minOrderAmount > 0 && (
                      <Text style={styles.minOrder}>
                        Min. order {formatCurrency(item.minOrderAmount)}
                        {!eligible ? " — not eligible" : ""}
                      </Text>
                    )}
                  </View>
                  <View style={styles.couponRight}>
                    <Text style={styles.discountLabel}>
                      {item.type === "percentage"
                        ? `${item.discount}% OFF`
                        : item.type === "fixed"
                          ? `${formatCurrency(item.discount)} OFF`
                          : "Free Shipping"}
                    </Text>
                    {eligible && discount > 0 && (
                      <Text style={styles.savingsLabel}>
                        Save {formatCurrency(discount)}
                      </Text>
                    )}
                    {isApplied && (
                      <View style={styles.appliedDot}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 14,
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
  appliedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ecfdf5",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  appliedText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
  },
  appliedCode: {
    fontWeight: "800",
    color: colors.primaryDark,
  },
  removeText: {
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "700",
  },
  center: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 10,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
  list: {
    flexGrow: 0,
  },
  couponCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  couponCardActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  couponCardDisabled: {
    opacity: 0.5,
  },
  couponLeft: {
    flex: 1,
    gap: 4,
  },
  codeTag: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  campaignName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  minOrder: {
    color: colors.muted,
    fontSize: 12,
  },
  couponRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  discountLabel: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
  },
  savingsLabel: {
    color: "#16a34a",
    fontSize: 12,
    fontWeight: "700",
  },
  appliedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
});
