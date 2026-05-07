import { useCallback, useEffect, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { NotificationPreviewSheet } from "@/components/notifications/NotificationPreviewSheet";
import { colors } from "@/constants/theme";
import { useNotifications } from "@/context/NotificationContext";
import { resolveNotificationRoute } from "@/lib/notification-routing";
import { getAttributes, getCategories, getVendors, getWarehouses } from "@/services/catalog";
import {
  deleteProduct,
  getProducts,
  getProductStats,
  updateProductStatus,
} from "@/services/products";
import type { Attribute, Category, Vendor, Warehouse } from "@/types/catalog";
import type { Product, ProductStats } from "@/types/product";
import { ProductListItem } from "@/components/products/ProductListItem";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

type SortValue =
  | "default"
  | "price-asc"
  | "price-desc"
  | "published"
  | "unpublished"
  | "date-added"
  | "date-updated";

export default function ProductsTab() {
  const router = useRouter();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [selectedPublished, setSelectedPublished] = useState<string>("");
  const [sortValue, setSortValue] = useState<SortValue>("default");
  const [notificationVisible, setNotificationVisible] = useState(false);
  const searchActive = search.trim().length > 0;
  const notificationPreview = useMemo(() => notifications.slice(0, 5), [notifications]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadLookups = useCallback(async () => {
    const [nextCategories, nextVendors, nextWarehouses, nextAttributes, nextStats] =
      await Promise.all([
        getCategories(),
        getVendors(),
        getWarehouses(),
        getAttributes(),
        getProductStats(),
      ]);

    setCategories(nextCategories);
    setVendors(nextVendors);
    setWarehouses(nextWarehouses);
    setAttributes(nextAttributes);
    setStats(nextStats);
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, mode: "reset" | "append") => {
      const result = await getProducts({
        page: nextPage,
        limit: 20,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId ? Number(selectedCategoryId) : undefined,
        vendorId: selectedVendorId ? Number(selectedVendorId) : undefined,
        locationId: selectedWarehouseId ? Number(selectedWarehouseId) : undefined,
      });

      let items = result.data;
      if (selectedPublished) {
        items = items.filter((item) =>
          selectedPublished === "published" ? item.published : !item.published,
        );
      }

      setProducts((current) => (mode === "append" ? [...current, ...items] : items));
      setPage(result.pagination.page);
      setHasNext(result.pagination.hasNext);
    },
    [debouncedSearch, selectedCategoryId, selectedVendorId, selectedWarehouseId, selectedPublished],
  );

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadLookups(), loadPage(1, "reset")]);
    } finally {
      setLoading(false);
    }
  }, [loadLookups, loadPage]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  useFocusEffect(
    useCallback(() => {
      void loadPage(1, "reset");
    }, [loadPage])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadPage(1, "reset");
    } finally {
      setRefreshing(false);
    }
  }, [loadPage]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;

    try {
      setLoadingMore(true);
      await loadPage(page + 1, "append");
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadingMore, loading, loadPage, page]);

  const getEffectivePrice = (p: typeof products[0]) => {
    const base = p.salePrice > 0 ? p.salePrice : p.price;
    if (!p.offerPrice || p.offerPrice <= 0) return base;
    const final = p.offerType === "percentage" ? base * (1 - p.offerPrice / 100) : base - p.offerPrice;
    return final > 0 && final < base ? final : base;
  };

  const sortedProducts = useMemo(() => {
    const next = [...products];
    switch (sortValue) {
      case "price-asc":
        return next.sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
      case "price-desc":
        return next.sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
      case "published":
        return next.sort((a, b) => Number(b.published) - Number(a.published));
      case "unpublished":
        return next.sort((a, b) => Number(a.published) - Number(b.published));
      case "date-added":
        return next.sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
        );
      case "date-updated":
        return next.sort(
          (a, b) =>
            new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
        );
      default:
        return next;
    }
  }, [products, sortValue]);

  const selectedCount = selectedIds.length;

  const { canRead } = useAuth();
  if (!canRead('Products')) return <AccessDenied />;

  const handlePressProduct = (product: Product) => {
    if (selectionMode) {
      toggleSelection(product.id);
      return;
    }

    router.push(`/products/${product.id}`);
  };

  const toggleSelection = (id: number) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const clearSelection = () => {
    setSelectionMode(false);
    setSelectedIds([]);
  };

  const runBulkPublish = async (published: boolean) => {
    try {
      await Promise.all(selectedIds.map((id) => updateProductStatus(id, published)));
      clearSelection();
      await loadPage(1, "reset");
    } catch (error: any) {
      Alert.alert("Update failed", error?.message ?? "Could not update selected products.");
    }
  };

  const runBulkDelete = async () => {
    Alert.alert("Delete products", "Delete selected products? This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await Promise.all(selectedIds.map((id) => deleteProduct(id)));
            clearSelection();
            await loadPage(1, "reset");
          } catch (error: any) {
            Alert.alert("Delete failed", error?.message ?? "Could not delete selected products.");
          }
        },
      },
    ]);
  };

  const handleLongPressProduct = (product: Product) => {
    if (!selectionMode) {
      setSelectionMode(true);
      setSelectedIds([product.id]);
      return;
    }

    toggleSelection(product.id);
  };

  const openDetailMenu = (product: Product) => {
    Alert.alert(product.name, "Choose an action", [
      { text: "Cancel", style: "cancel" },
      { text: "View", onPress: () => router.push(`/products/${product.id}`) },
      { text: "Edit", onPress: () => router.push(`/products/${product.id}/edit`) },
      { text: "Reviews", onPress: () => router.push(`/products/${product.id}/reviews`) },
      { text: "Barcode", onPress: () => router.push(`/products/${product.id}/barcode`) },
      {
        text: product.published ? "Unpublish" : "Publish",
        onPress: async () => {
          await updateProductStatus(product.id, !product.published);
          await loadPage(1, "reset");
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProduct(product.id);
          await loadPage(1, "reset");
        },
      },
    ]);
  };

  const handleNotificationPress = async (notification: (typeof notifications)[number]) => {
    setNotificationVisible(false);
    if (!notification.readAt) {
      await markAsRead(notification.id);
    }

    const route = resolveNotificationRoute(notification.actionUrl);
    if (route) {
      router.push(route as any);
      return;
    }

    router.push("/notifications");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.header, searchActive && { paddingTop: 12 }]}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Products</Text>
          {!searchActive && (
            <Text style={styles.subtitle} numberOfLines={1}>
              Products · manage, create, edit &amp; barcode
            </Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.notificationButton} onPress={() => setNotificationVisible(true)}>
            <Ionicons name="notifications-outline" size={20} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => router.push("/products/barcodes")}>
            <Ionicons name="barcode-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable style={styles.primaryAction} onPress={() => router.push("/products/create")}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryActionText}>Add</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, SKU, or category"
            style={styles.searchInput}
          />
          {searchActive ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.filterButton} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={18} color={colors.text} />
        </Pressable>
        <Pressable style={styles.filterButton} onPress={() => setSortVisible(true)}>
          <Ionicons name="swap-vertical-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {!searchActive && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsScroll} alwaysBounceHorizontal={false}>
          <ProductStatusPill label={`${sortedProducts.length} loaded`} tone="neutral" />
          {stats ? <ProductStatusPill label={`Total ${stats.total}`} tone="info" /> : null}
          {stats ? <ProductStatusPill label={`Published ${stats.published}`} tone="success" /> : null}
          {stats ? <ProductStatusPill label={`Draft ${stats.unpublished}`} tone="warning" /> : null}
          {selectedCategoryId ? (
            <ProductStatusPill
              label={categories.find((item) => String(item.id) === selectedCategoryId)?.categoryName ?? "Category"}
              tone="info"
            />
          ) : null}
          {selectedVendorId ? (
            <ProductStatusPill
              label={vendors.find((item) => String(item.id) === selectedVendorId)?.name ?? "Vendor"}
              tone="success"
            />
          ) : null}
          {selectedWarehouseId ? (
            <ProductStatusPill
              label={warehouses.find((item) => String(item.id) === selectedWarehouseId)?.name ?? "Location"}
              tone="warning"
            />
          ) : null}
          {selectedPublished ? (
            <ProductStatusPill
              label={selectedPublished === "published" ? "Published only" : "Draft only"}
              tone="info"
            />
          ) : null}
          <ProductStatusPill label={`${attributes.length} attrs`} tone="neutral" />
        </ScrollView>
      )}

      {selectionMode ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionText}>{selectedCount} selected</Text>
          <View style={styles.selectionActions}>
            <Pressable style={styles.selectionAction} onPress={() => void runBulkPublish(true)}>
              <Text style={styles.selectionActionText}>Publish</Text>
            </Pressable>
            <Pressable style={styles.selectionAction} onPress={() => void runBulkPublish(false)}>
              <Text style={styles.selectionActionText}>Unpublish</Text>
            </Pressable>
            <Pressable style={styles.selectionActionDanger} onPress={runBulkDelete}>
              <Text style={styles.selectionActionDangerText}>Delete</Text>
            </Pressable>
            <Pressable style={styles.selectionAction} onPress={clearSelection}>
              <Text style={styles.selectionActionText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <FlatList
          data={sortedProducts}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <ProductListItem
              product={item}
              selected={selectedIds.includes(item.id)}
              selectionMode={selectionMode}
              onPress={() => handlePressProduct(item)}
              onLongPress={() => handleLongPressProduct(item)}
              onMenuPress={() => openDetailMenu(item)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={colors.primaryDark}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => void onEndReached()}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={colors.primaryDark} />
              </View>
            ) : <View style={{ height: 16 }} />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="cube-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptyText}>
                Adjust the filters or create a new product from mobile.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <Pressable onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FilterBlock
              title="Publish state"
              options={[
                { label: "All", value: "" },
                { label: "Published", value: "published" },
                { label: "Draft", value: "draft" },
              ]}
              value={selectedPublished}
              onChange={setSelectedPublished}
            />
            <FilterBlock
              title="Category"
              options={[{ label: "All", value: "" }, ...categories.map((item) => ({
                label: item.parentId ? `└ ${item.categoryName}` : item.categoryName,
                value: String(item.id),
              }))]}
              value={selectedCategoryId}
              onChange={setSelectedCategoryId}
            />
            <FilterBlock
              title="Vendor"
              options={[{ label: "All", value: "" }, ...vendors.map((item) => ({
                label: item.name,
                value: String(item.id),
              }))]}
              value={selectedVendorId}
              onChange={setSelectedVendorId}
            />
            <FilterBlock
              title="Location"
              options={[{ label: "All", value: "" }, ...warehouses.map((item) => ({
                label: item.name,
                value: String(item.id),
              }))]}
              value={selectedWarehouseId}
              onChange={setSelectedWarehouseId}
            />
            <Pressable
              style={styles.applyButton}
              onPress={async () => {
                setFilterVisible(false);
                await loadPage(1, "reset");
              }}
            >
              <Text style={styles.applyButtonText}>Apply filters</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sortVisible} transparent animationType="slide" onRequestClose={() => setSortVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSortVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort products</Text>
              <Pressable onPress={() => setSortVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <FilterBlock
              title="Sort by"
              options={[
                { label: "Default", value: "default" },
                { label: "Price low to high", value: "price-asc" },
                { label: "Price high to low", value: "price-desc" },
                { label: "Published first", value: "published" },
                { label: "Draft first", value: "unpublished" },
                { label: "Newest added", value: "date-added" },
                { label: "Recently updated", value: "date-updated" },
              ]}
              value={sortValue}
              onChange={(value) => setSortValue(value as SortValue)}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <NotificationPreviewSheet
        visible={notificationVisible}
        notifications={notificationPreview}
        onClose={() => setNotificationVisible(false)}
        onPressNotification={(notification) => void handleNotificationPress(notification)}
        onPressViewAll={() => {
          setNotificationVisible(false);
          router.push("/notifications");
        }}
      />
    </SafeAreaView>
  );
}

function FilterBlock({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ label: string; value: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterBlock}>
      <Text style={styles.filterTitle}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={`${title}-${option.value || "all"}`}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.primaryDark,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryAction: {
    borderRadius: 14,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 14,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  primaryActionText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
  },
  toolbar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    flexDirection: "row",
    gap: 10,
  },
  searchWrap: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: {
    height: 44,
    marginTop: 6,
  },
  chipsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  selectionBar: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 12,
  },
  selectionText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  selectionActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectionAction: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  selectionActionDanger: {
    borderRadius: 12,
    backgroundColor: "#fee2e2",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionActionDangerText: {
    color: "#991b1b",
    fontSize: 13,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rowWrap: {
    position: "relative",
  },
  rowMenu: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 100,
  },
  footerLoading: {
    paddingVertical: 16,
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingTop: 72,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "78%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  filterBlock: {
    gap: 10,
  },
  filterTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
  filterOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: colors.background,
  },
  filterChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  filterChipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: colors.primaryDark,
  },
  applyButton: {
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 6,
  },
  applyButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});
