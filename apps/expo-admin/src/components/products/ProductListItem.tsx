import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getImageUrl } from "@/lib/images";
import { getDisplayPrice } from "@/services/products";
import type { Product, ProductStockState } from "@/types/product";

type ProductListItemProps = {
  product: Product;
  selected?: boolean;
  selectionMode?: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onMenuPress?: () => void;
};

export const STOCK_STATE_TONE: Record<ProductStockState, { label: string; bg: string; color: string; accent: string }> = {
  ok: { label: "In stock", bg: "#dcfce7", color: "#166534", accent: "#10b981" },
  low: { label: "Low stock", bg: "#fef3c7", color: "#92400e", accent: "#f59e0b" },
  out: { label: "Out of stock", bg: "#fee2e2", color: "#991b1b", accent: "#ef4444" },
};

export function getStockState(product: Pick<Product, "stockState" | "stock" | "reorderPoint">): ProductStockState {
  if (product.stockState) return product.stockState;
  if (product.stock <= 0) return "out";
  if ((product.reorderPoint ?? 0) > 0 && product.stock <= (product.reorderPoint ?? 0)) return "low";
  return "ok";
}

export function ProductListItem({
  product,
  selected = false,
  selectionMode = false,
  onPress,
  onLongPress,
  onMenuPress,
}: ProductListItemProps) {
  const { formatCurrency } = useCurrency();
  const imageUrl = getImageUrl(product.image);
  // Offer shown only while the server says it is active (currentPrice already applies it).
  const { price, basePrice, hasOffer } = getDisplayPrice(product);
  const stockState = getStockState(product);
  const stockTone = STOCK_STATE_TONE[stockState];
  const accent = stockTone.accent;

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
            {hasOffer && (
              <Text style={styles.priceOriginal}>{formatCurrency(basePrice)}</Text>
            )}
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
            <StatusDot label={stockTone.label} bg={stockTone.bg} color={stockTone.color} />
            {!product.published ? (
              <StatusDot label="Draft" bg="#f1f5f9" color="#64748b" />
            ) : product.visibleOnline === false ? (
              <StatusDot label="Hidden online" bg="#f1f5f9" color="#64748b" />
            ) : (
              <StatusDot label="Online" bg="#dbeafe" color="#1d4ed8" />
            )}
            {product.availableInPos === false ? (
              <StatusDot label="Not in POS" bg="#f1f5f9" color="#64748b" />
            ) : null}
            {hasOffer ? <StatusDot label="Offer" bg="#ffedd5" color="#c2410c" /> : null}
            {product.tag ? <StatusDot label={product.tag} bg="#ede9fe" color="#6d28d9" /> : null}
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
  priceOriginal: {
    color: colors.muted,
    fontSize: 12,
    textDecorationLine: "line-through",
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
