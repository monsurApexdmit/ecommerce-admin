import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { getImageUrl } from "@/lib/images";
import { formatCurrency } from "@/lib/format";
import type { Product } from "@/types/product";

type Props = {
  product: Product;
  cartQty: number;
  onAdd: () => void;
};

export function PosProductCard({ product, cartQty, onAdd }: Props) {
  const outOfStock = product.stock <= 0 && product.variants.length === 0;
  const imageUrl = getImageUrl(product.image);
  const price = product.salePrice > 0 ? product.salePrice : product.price;

  return (
    <Pressable
      style={[styles.card, outOfStock && styles.cardDisabled]}
      onPress={outOfStock ? undefined : onAdd}
    >
      {/* Image */}
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="cube-outline" size={28} color={colors.muted} />
          </View>
        )}
        {cartQty > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{cartQty}</Text>
          </View>
        )}
        {outOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of stock</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.price}>{formatCurrency(price)}</Text>
        {product.variants.length > 0 && (
          <Text style={styles.variants}>{product.variants.length} variants</Text>
        )}
      </View>

      {/* Add button */}
      {!outOfStock && (
        <Pressable style={styles.addButton} onPress={onAdd} hitSlop={4}>
          <Ionicons name="add" size={18} color="#fff" />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cardDisabled: {
    opacity: 0.55,
  },
  imageWrap: {
    position: "relative",
    height: 110,
    backgroundColor: "#f1f5f9",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  outOfStockText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  info: {
    padding: 10,
    gap: 3,
  },
  name: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
  },
  price: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  variants: {
    color: colors.muted,
    fontSize: 11,
  },
  addButton: {
    position: "absolute",
    bottom: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});
