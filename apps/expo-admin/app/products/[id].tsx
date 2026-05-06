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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { getImageUrl } from "@/lib/images";
import { formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import { getCategories, getVendors, getWarehouses } from "@/services/catalog";
import { deleteProduct, getProductById, updateProductStatus } from "@/services/products";
import type { Product } from "@/types/product";
import type { Category, Vendor, Warehouse } from "@/types/catalog";

const STATUS_ACCENT: Record<string, { bg: string; text: string; dot: string }> = {
  Selling:      { bg: "#dcfce7", text: "#166534", dot: "#22c55e" },
  "Out of Stock": { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b" },
  Discontinued: { bg: "#fee2e2", text: "#991b1b", dot: "#ef4444" },
};

export default function ProductDetailScreen() {
  const { formatCurrency } = useCurrency();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);

  const productId = Number(params.id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [p, nextCategories, nextVendors, nextWarehouses] = await Promise.all([
        getProductById(productId),
        getCategories(),
        getVendors(),
        getWarehouses(),
      ]);
      setProduct(p);
      setCategories(nextCategories);
      setVendors(nextVendors);
      setWarehouses(nextWarehouses);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    if (!Number.isFinite(productId)) return;
    void load();
  }, [load, productId]);

  const handleDelete = () => {
    if (!product) return;
    Alert.alert("Delete product", `Delete "${product.name}"? Cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteProduct(product.id);
          router.replace("/(tabs)/products");
        },
      },
    ]);
  };

  const handleTogglePublish = async () => {
    if (!product) return;
    try {
      setPublishing(true);
      await updateProductStatus(product.id, !product.published);
      await load();
    } finally {
      setPublishing(false);
    }
  };

  if (loading || !product) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={s.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={s.headerTitle}>Product</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const statusAccent = STATUS_ACCENT[product.status] ?? { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8" };
  const basePrice = product.salePrice > 0 ? product.salePrice : product.price;
  const displayPrice = product.offerPrice && product.offerPrice > 0 && product.offerPrice < basePrice
    ? product.offerPrice
    : basePrice;
  const hasDiscount = displayPrice < basePrice;
  const hasOffer = Boolean(product.offerPrice && product.offerPrice > 0 && product.offerPrice < basePrice);
  const allImages = product.images.length > 0
    ? product.images.map((img) => img.path)
    : product.image ? [product.image] : [];
  const mainImageUri = allImages.length > 0 ? getImageUrl(allImages[0]) : null;
  const vendorName =
    product.vendorName ||
    (product.vendorId ? vendors.find((item) => item.id === product.vendorId)?.name : undefined) ||
    "—";
  const categoryName =
    product.category ||
    (product.categoryId ? categories.find((item) => item.id === product.categoryId)?.categoryName : undefined) ||
    "—";
  const locationName =
    product.locationName ||
    (product.locationId ? warehouses.find((item) => item.id === product.locationId)?.name : undefined) ||
    "—";
  const createdLabel = product.createdAt ? formatDateTime(product.createdAt) : "—";
  const updatedLabel = product.updatedAt ? formatDateTime(product.updatedAt) : "—";

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{product.name}</Text>
        <View style={{ width: 38 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Hero Image ── */}
        <View style={s.heroWrap}>
          {mainImageUri ? (
            <Image source={{ uri: mainImageUri }} style={s.heroImage} resizeMode="cover" />
          ) : (
            <View style={[s.heroImage, s.heroFallback]}>
              <Ionicons name="cube-outline" size={64} color={colors.muted} />
            </View>
          )}
          {/* Overlay badges */}
          <View style={s.heroBadges}>
            <View style={[s.heroBadge, { backgroundColor: statusAccent.bg }]}>
              <View style={[s.heroBadgeDot, { backgroundColor: statusAccent.dot }]} />
              <Text style={[s.heroBadgeText, { color: statusAccent.text }]}>{product.status}</Text>
            </View>
            {product.published ? (
              <View style={[s.heroBadge, { backgroundColor: "#dbeafe" }]}>
                <Ionicons name="checkmark-circle" size={11} color="#1d4ed8" />
                <Text style={[s.heroBadgeText, { color: "#1d4ed8" }]}>Published</Text>
              </View>
            ) : (
              <View style={[s.heroBadge, { backgroundColor: "#f1f5f9" }]}>
                <Text style={[s.heroBadgeText, { color: "#64748b" }]}>Draft</Text>
              </View>
            )}
          </View>
          {/* Extra images strip */}
          {allImages.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.thumbScroll} contentContainerStyle={s.thumbRow}>
              {allImages.map((path, i) => {
                const uri = getImageUrl(path);
                if (!uri) return null;
                return (
                  <Image key={`${path}-${i}`} source={{ uri }} style={s.thumb} resizeMode="cover" />
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={s.body}>
          {/* ── Title + price ── */}
          <View style={s.titleBlock}>
            <Text style={s.productName}>{product.name}</Text>
            <View style={s.priceRow}>
              <Text style={s.priceMain}>{formatCurrency(displayPrice)}</Text>
              {hasDiscount && (
                <Text style={s.priceOriginal}>{formatCurrency(basePrice)}</Text>
              )}
              {hasDiscount && (
                <View style={s.discountBadge}>
                  <Text style={s.discountText}>
                    -{Math.round(((basePrice - displayPrice) / basePrice) * 100)}%
                  </Text>
                </View>
              )}
            </View>
            {product.description ? (
              <Text style={s.description}>{product.description}</Text>
            ) : null}
          </View>

          {/* ── Special flags ── */}
          {(product.isFeatured || product.isBestSeller || product.isHotDeal) ? (
            <View style={s.flagsRow}>
              {product.isFeatured && <FlagChip icon="star-outline" label="Featured" color="#7c3aed" bg="#f5f3ff" />}
              {product.isBestSeller && <FlagChip icon="trending-up-outline" label="Best Seller" color="#92400e" bg="#fffbeb" />}
              {product.isHotDeal && <FlagChip icon="flame-outline" label={product.dealLabel || "Hot Deal"} color="#991b1b" bg="#fee2e2" />}
            </View>
          ) : null}

          {/* ── Quick actions ── */}
          <View style={s.actions}>
            <ActionBtn icon="create-outline" label="Edit" onPress={() => router.push(`/products/${product.id}/edit`)} />
            <ActionBtn icon="chatbubble-ellipses-outline" label="Reviews" onPress={() => router.push(`/products/${product.id}/reviews`)} />
            <ActionBtn icon="barcode-outline" label="Barcode" onPress={() => router.push(`/products/${product.id}/barcode`)} />
          </View>

          {/* ── Info card ── */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Product Info</Text>
            <InfoRow icon="grid-outline"       label="Category"  value={categoryName} />
            <InfoRow icon="storefront-outline" label="Vendor"    value={vendorName} />
            <InfoRow icon="location-outline"   label="Location"  value={locationName} />
            <View style={s.divider} />
            <InfoRow icon="layers-outline"     label="Stock"     value={String(product.stock)} accent={product.stock < 5 ? "#ef4444" : undefined} />
            <InfoRow icon="pricetag-outline"   label="SKU"       value={product.sku || "—"} mono />
            <InfoRow icon="barcode-outline"    label="Barcode"   value={product.barcode || "—"} mono />
            <InfoRow icon="receipt-outline"    label="Receipt #" value={product.receiptNumber || "—"} mono />
            <View style={s.divider} />
            <InfoRow icon="cash-outline"       label="List price" value={formatCurrency(product.price)} />
            <InfoRow icon="cart-outline"       label="Sale price" value={formatCurrency(product.salePrice || product.price)} accent={product.salePrice < product.price ? colors.primaryDark : undefined} />
            {hasOffer && (
              <InfoRow icon="flash-outline" label="Offer price" value={formatCurrency(product.offerPrice!)} accent="#c2410c" />
            )}
            <View style={s.divider} />
            <InfoRow icon="calendar-outline"   label="Created"   value={createdLabel} />
            <InfoRow icon="time-outline"       label="Updated"   value={updatedLabel} />
          </View>

          {/* ── Attributes ── */}
          {product.attributes.length > 0 ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Attributes</Text>
              <View style={s.attrGrid}>
                {product.attributes.map((attr) => (
                  <View key={attr.id} style={s.attrChip}>
                    <Text style={s.attrName}>{attr.name}</Text>
                    <Text style={s.attrValue}>
                      {Array.isArray(attr.value) ? attr.value.join(", ") : attr.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* ── Variants ── */}
          {product.variants.length > 0 ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Variants ({product.variants.length})</Text>
              {product.variants.map((v) => (
                <View key={v.id} style={s.variantRow}>
                  <View style={s.variantLeft}>
                    <Text style={s.variantName}>{v.name}</Text>
                    <View style={s.variantMeta}>
                      <Ionicons name="layers-outline" size={11} color={colors.muted} />
                      <Text style={s.variantMetaText}>Stock {v.stock}</Text>
                      {v.sku ? (
                        <>
                          <Text style={s.variantMetaDot}>·</Text>
                          <Text style={s.variantMetaText}>{v.sku}</Text>
                        </>
                      ) : null}
                    </View>
                  </View>
                  {(() => {
                    const vBase = v.salePrice || v.price;
                    const vDisplay = v.offerPrice && v.offerPrice > 0 && v.offerPrice < vBase ? v.offerPrice : vBase;
                    const vHasOffer = vDisplay < vBase;
                    return (
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[s.variantPrice, vHasOffer && { color: "#c2410c" }]}>{formatCurrency(vDisplay)}</Text>
                        {vHasOffer && <Text style={{ color: colors.muted, fontSize: 11, textDecorationLine: "line-through" }}>{formatCurrency(vBase)}</Text>}
                      </View>
                    );
                  })()}
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Bottom actions ── */}
          <View style={s.bottomActions}>
            <Pressable
              style={[s.publishBtn, product.published && s.unpublishBtn]}
              onPress={() => void handleTogglePublish()}
              disabled={publishing}
            >
              {publishing
                ? <ActivityIndicator size="small" color={product.published ? colors.text : "#fff"} />
                : <>
                    <Ionicons
                      name={product.published ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={product.published ? colors.text : "#fff"}
                    />
                    <Text style={[s.publishBtnText, product.published && s.unpublishBtnText]}>
                      {product.published ? "Unpublish" : "Publish"}
                    </Text>
                  </>
              }
            </Pressable>
            <Pressable style={s.deleteBtn} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={s.deleteBtnText}>Delete</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FlagChip({ icon, label, color, bg }: { icon: any; label: string; color: string; bg: string }) {
  return (
    <View style={[s.flagChip, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={13} color={color} />
      <Text style={[s.flagChipText, { color }]}>{label}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress }: { icon: any; label: string; onPress: () => void }) {
  return (
    <Pressable style={s.actionBtn} onPress={onPress}>
      <View style={s.actionBtnIcon}>
        <Ionicons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <Text style={s.actionBtnText}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value, accent, mono }: {
  icon: any; label: string; value: string; accent?: string; mono?: boolean;
}) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoLeft}>
        <Ionicons name={icon} size={14} color={colors.muted} />
        <Text style={s.infoLabel}>{label}</Text>
      </View>
      <Text style={[s.infoValue, accent ? { color: accent } : null, mono ? s.infoMono : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },

  // Hero
  heroWrap: { position: "relative" },
  heroImage: { width: "100%", height: 280, backgroundColor: colors.border },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  heroBadges: {
    position: "absolute", top: 14, left: 14,
    flexDirection: "row", gap: 6,
  },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  heroBadgeText: { fontSize: 11, fontWeight: "800" },
  thumbScroll: { position: "absolute", bottom: 12, left: 0, right: 0 },
  thumbRow: { gap: 8, paddingHorizontal: 14 },
  thumb: { width: 52, height: 52, borderRadius: 12, borderWidth: 2, borderColor: "#fff" },

  // Body
  body: { padding: 16, gap: 14 },

  // Title block
  titleBlock: { gap: 6 },
  productName: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  priceMain: { color: colors.primaryDark, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  priceOriginal: { color: colors.muted, fontSize: 16, fontWeight: "600", textDecorationLine: "line-through" },
  discountBadge: { borderRadius: 999, backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 3 },
  discountText: { color: "#166534", fontSize: 12, fontWeight: "800" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 2 },

  // Flags
  flagsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  flagChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6,
  },
  flagChipText: { fontSize: 12, fontWeight: "700" },

  // Actions
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, alignItems: "center", gap: 6 },
  actionBtnIcon: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  actionBtnText: { color: colors.text, fontSize: 12, fontWeight: "700" },

  // Card
  card: {
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 2 },

  // Info rows
  infoRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  infoLeft: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "right" },
  infoMono: { fontFamily: "monospace", fontSize: 12 },

  // Attributes
  attrGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  attrChip: {
    borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
  attrName: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  attrValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  // Variants
  variantRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
    gap: 12,
  },
  variantLeft: { flex: 1, gap: 3 },
  variantName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  variantMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  variantMetaText: { color: colors.muted, fontSize: 12 },
  variantMetaDot: { color: colors.muted, fontSize: 12 },
  variantPrice: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },

  // Bottom actions
  bottomActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  publishBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, backgroundColor: colors.primaryDark, paddingVertical: 15,
  },
  publishBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  unpublishBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  unpublishBtnText: { color: colors.text },
  deleteBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, borderRadius: 16, backgroundColor: "#ef4444", paddingVertical: 15,
  },
  deleteBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
