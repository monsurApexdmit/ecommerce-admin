import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { getImageUrl } from "@/lib/images";
import { formatCompactDate, formatCurrency } from "@/lib/format";
import { deleteProduct, getProductById, updateProductStatus } from "@/services/products";
import type { Product } from "@/types/product";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";

export default function ProductDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  const productId = Number(params.id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const nextProduct = await getProductById(productId);
      setProduct(nextProduct);
      navigation.setOptions({ title: nextProduct.name });
    } finally {
      setLoading(false);
    }
  }, [navigation, productId]);

  useEffect(() => {
    if (!Number.isFinite(productId)) return;
    void load();
  }, [load, productId]);

  const handleDelete = () => {
    if (!product) return;

    Alert.alert("Delete product", `Delete ${product.name}? This action cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProduct(product.id);
          router.replace("/(tabs)/products");
        },
      },
    ]);
  };

  if (loading || !product) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
    <ScrollView contentContainerStyle={styles.content}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gallery}>
        {(product.images.length > 0 ? product.images : [{ path: product.image ?? "" }]).map((image, index) => {
          const uri = getImageUrl(image.path);
          if (!uri) return null;
          return <Image key={`${image.path}-${index}`} source={{ uri }} style={styles.image} />;
        })}
      </ScrollView>

      <View style={styles.header}>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.description}>
          {product.description || "No description added for this product yet."}
        </Text>
        <View style={styles.badges}>
          <ProductStatusPill
            label={product.published ? "Published" : "Draft"}
            tone={product.published ? "info" : "neutral"}
          />
          <ProductStatusPill
            label={product.status}
            tone={
              product.status === "Selling"
                ? "success"
                : product.status === "Out of Stock"
                  ? "warning"
                  : "danger"
            }
          />
          {product.isFeatured ? <ProductStatusPill label="Featured" tone="success" /> : null}
          {product.isBestSeller ? <ProductStatusPill label="Best seller" tone="warning" /> : null}
          {product.isHotDeal ? <ProductStatusPill label={product.dealLabel || "Hot deal"} tone="danger" /> : null}
        </View>
      </View>

      <View style={styles.actions}>
        <ActionButton label="Edit" icon="create-outline" onPress={() => router.push(`/products/${product.id}/edit`)} />
        <ActionButton label="Reviews" icon="chatbubble-ellipses-outline" onPress={() => router.push(`/products/${product.id}/reviews`)} />
        <ActionButton label="Barcode" icon="barcode-outline" onPress={() => router.push(`/products/${product.id}/barcode`)} />
      </View>

      <View style={styles.card}>
        <InfoRow label="Category" value={product.category || "-"} />
        <InfoRow label="Vendor" value={product.vendorName || "-"} />
        <InfoRow label="Location" value={product.locationName || "-"} />
        <InfoRow label="Price" value={formatCurrency(product.price)} />
        <InfoRow label="Sale price" value={formatCurrency(product.salePrice || product.price)} />
        <InfoRow label="Stock" value={`${product.stock}`} />
        <InfoRow label="SKU" value={product.sku || "-"} />
        <InfoRow label="Barcode" value={product.barcode || "-"} />
        <InfoRow label="Receipt number" value={product.receiptNumber || "-"} />
        <InfoRow label="Created" value={formatCompactDate(product.createdAt)} />
        <InfoRow label="Updated" value={formatCompactDate(product.updatedAt)} />
      </View>

      {product.attributes.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attributes</Text>
          <View style={styles.attributeWrap}>
            {product.attributes.map((attribute) => (
              <View key={attribute.id} style={styles.attributeItem}>
                <Text style={styles.attributeName}>{attribute.name}</Text>
                <Text style={styles.attributeValue}>
                  {Array.isArray(attribute.value) ? attribute.value.join(", ") : attribute.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {product.variants.length > 0 ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Variants</Text>
          <View style={styles.variantList}>
            {product.variants.map((variant) => (
              <View key={variant.id} style={styles.variantCard}>
                <Text style={styles.variantName}>{variant.name}</Text>
                <Text style={styles.variantMeta}>SKU {variant.sku || "-"}</Text>
                <Text style={styles.variantMeta}>Stock {variant.stock}</Text>
                <Text style={styles.variantPrice}>
                  {formatCurrency(variant.salePrice || variant.price)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.bottomActions}>
        <Pressable
          style={styles.secondaryButton}
          onPress={async () => {
            await updateProductStatus(product.id, !product.published);
            await load();
          }}
        >
          <Text style={styles.secondaryButtonText}>
            {product.published ? "Unpublish" : "Publish"}
          </Text>
        </Pressable>
        <Pressable style={styles.dangerButton} onPress={handleDelete}>
          <Text style={styles.dangerButtonText}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
  gallery: {
    gap: 12,
  },
  image: {
    width: 240,
    height: 220,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  header: {
    gap: 10,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  description: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  badges: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    alignItems: "center",
    gap: 6,
  },
  actionButtonText: {
    color: colors.primaryDark,
    fontWeight: "800",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 14,
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
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  attributeWrap: {
    gap: 12,
  },
  attributeItem: {
    gap: 4,
  },
  attributeName: {
    color: colors.muted,
    fontSize: 13,
  },
  attributeValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
  },
  variantList: {
    gap: 10,
  },
  variantCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 14,
    gap: 5,
  },
  variantName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  variantMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  variantPrice: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  dangerButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.danger,
    paddingVertical: 16,
    alignItems: "center",
  },
  dangerButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
