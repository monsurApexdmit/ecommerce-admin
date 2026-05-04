import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { getImageUrl } from "@/lib/images";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types/product";

type ProductListItemProps = {
  product: Product;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress?: () => void;
};

const STATUS_ACCENT: Record<string, string> = {
  Selling: "#10b981",
  "Out of Stock": "#f59e0b",
  Discontinued: "#ef4444",
};

export function ProductListItem({
  product,
  selected = false,
  selectionMode = false,
  onPress,
  onLongPress,
  onMenuPress,
}: ProductListItemProps) {
  const imageUrl = getImageUrl(product.image);
  const price = product.salePrice > 0 ? product.salePrice : product.price;
  const accent = STATUS_ACCENT[product.status] ?? colors.border;

  return (
    <Pressable
      style={[styles.card, selected && styles.cardSelected, { borderLeftColor: accent }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={styles.row}>
        {selectionMode && (
          <View style={[styles.check, selected && styles.checkSelected]}>
            {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        )}

        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: accent + "22" }]}>
            <Text style={[styles.imageFallbackText, { color: accent }]}>
              {product.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.main}>
          {/* Top row: name + menu */}
          <View style={styles.topRow}>
            <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
            {!selectionMode && onMenuPress && (
              <View onStartShouldSetResponder={() => true}>
                <Pressable style={styles.menuBtn} onPress={onMenuPress} hitSlop={8}>
                  <Ionicons name="ellipsis-horizontal" size={16} color={colors.muted} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Category + vendor */}
          <Text style={styles.category} numberOfLines={1}>
            {[product.category, product.vendorName].filter(Boolean).join(" · ") || "Uncategorized"}
          </Text>

          {/* Price + Stock + SKU */}
          <View style={styles.metaRow}>
            <Text style={styles.price}>{formatCurrency(price)}</Text>
            <View style={styles.stockBadge}>
              <Ionicons name="layers-outline" size={11} color={colors.muted} />
              <Text style={styles.stockText}>Stock {product.stock ?? 0}</Text>
            </View>
            {product.sku ? (
              <Text style={styles.sku} numberOfLines={1}>SKU: {product.sku}</Text>
            ) : null}
          </View>

          {/* Status pills */}
          <View style={styles.pillRow}>
            <StatusDot
              label={product.published ? "Published" : "Draft"}
              bg={product.published ? "#dbeafe" : "#f1f5f9"}
              color={product.published ? "#1d4ed8" : "#64748b"}
            />
            <StatusDot
              label={product.status}
              bg={
                product.status === "Selling" ? "#dcfce7"
                  : product.status === "Out of Stock" ? "#fef3c7"
                  : "#fee2e2"
              }
              color={
                product.status === "Selling" ? "#166534"
                  : product.status === "Out of Stock" ? "#92400e"
                  : "#991b1b"
              }
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function StatusDot({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    padding: 14,
  },
  cardSelected: {
    borderColor: colors.primaryDark,
    borderLeftColor: colors.primaryDark,
    backgroundColor: "#f0fdf4",
  },
  row: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  checkSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.primaryDark,
  },
  image: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.border,
  },
  imageFallback: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  imageFallbackText: {
    fontSize: 22,
    fontWeight: "800",
  },
  main: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  price: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 0,
  },
  category: {
    color: colors.muted,
    fontSize: 12,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 2,
  },
  stockBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stockText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  sku: {
    color: colors.muted,
    fontSize: 11,
    flexShrink: 1,
  },
  pillRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
});
