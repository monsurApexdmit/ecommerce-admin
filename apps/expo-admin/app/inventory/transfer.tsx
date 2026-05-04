import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import {
  cancelTransfer,
  createTransfer,
  getProductsByLocation,
  getTransfers,
  type LocationProduct,
  type TransferItem,
} from "@/services/inventory";
import { getWarehouses } from "@/services/catalog";
import type { Warehouse } from "@/types/catalog";

type Tab = "create" | "history";

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  Pending:   { bg: "#fef3c7", text: "#d97706" },
  Completed: { bg: "#dcfce7", text: "#16a34a" },
  Cancelled: { bg: "#fee2e2", text: "#dc2626" },
};

export default function TransferScreen() {
  const [tab, setTab] = useState<Tab>("create");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);

  // Form state
  const [fromWh, setFromWh] = useState("");
  const [toWh, setToWh] = useState("");
  const [locationProducts, setLocationProducts] = useState<LocationProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<LocationProduct | null>(null);
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    getWarehouses().then(setWarehouses);
  }, []);

  useEffect(() => {
    if (!fromWh) { setLocationProducts([]); setSelectedProduct(null); return; }
    setProductsLoading(true);
    setSelectedProduct(null);
    getProductsByLocation(Number(fromWh))
      .then(setLocationProducts)
      .catch(() => setLocationProducts([]))
      .finally(() => setProductsLoading(false));
  }, [fromWh]);

  const loadTransfers = useCallback(async () => {
    setTransfersLoading(true);
    try { setTransfers(await getTransfers()); }
    finally { setTransfersLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "history") void loadTransfers();
  }, [tab, loadTransfers]);

  const handleSubmit = async () => {
    if (!fromWh || !toWh || !selectedProduct || !quantity) {
      Alert.alert("Missing fields", "Fill in all required fields.");
      return;
    }
    if (fromWh === toWh) {
      Alert.alert("Invalid", "Source and destination warehouses must differ.");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      Alert.alert("Invalid quantity", "Enter a positive number.");
      return;
    }
    if (qty > selectedProduct.stock) {
      Alert.alert("Insufficient stock", `Only ${selectedProduct.stock} units available.`);
      return;
    }

    setSubmitting(true);
    try {
      await createTransfer({
        productId: selectedProduct.productId,
        variantId: selectedProduct.type === "variant" ? selectedProduct.id : undefined,
        fromLocationId: Number(fromWh),
        toLocationId: Number(toWh),
        quantity: qty,
        notes: notes.trim() || undefined,
      });
      Alert.alert("Transfer created", "Stock transfer submitted successfully.", [
        { text: "OK", onPress: () => {
          setFromWh(""); setToWh(""); setSelectedProduct(null);
          setQuantity(""); setNotes("");
          setTab("history");
        }},
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Transfer failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = (id: number) => {
    Alert.alert("Cancel transfer", "Cancel this stock transfer?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, cancel",
        style: "destructive",
        onPress: async () => {
          await cancelTransfer(id);
          await loadTransfers();
        },
      },
    ]);
  };

  const filteredProducts = locationProducts.filter((p) =>
    productSearch.length === 0 ||
    p.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Stock Transfer</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, tab === "create" && styles.tabActive]}
          onPress={() => setTab("create")}
        >
          <Text style={[styles.tabText, tab === "create" && styles.tabTextActive]}>New Transfer</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "history" && styles.tabActive]}
          onPress={() => setTab("history")}
        >
          <Text style={[styles.tabText, tab === "history" && styles.tabTextActive]}>History</Text>
        </Pressable>
      </View>

      {tab === "create" ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {/* From warehouse */}
            <View style={styles.field}>
              <Text style={styles.label}>From Warehouse *</Text>
              <View style={styles.selectRow}>
                {warehouses.map((wh) => (
                  <Pressable
                    key={wh.id}
                    style={[styles.whChip, fromWh === String(wh.id) && styles.whChipActive]}
                    onPress={() => setFromWh(String(wh.id))}
                  >
                    <Text style={[styles.whChipText, fromWh === String(wh.id) && styles.whChipTextActive]}>
                      {wh.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* To warehouse */}
            <View style={styles.field}>
              <Text style={styles.label}>To Warehouse *</Text>
              <View style={styles.selectRow}>
                {warehouses.filter((wh) => String(wh.id) !== fromWh).map((wh) => (
                  <Pressable
                    key={wh.id}
                    style={[styles.whChip, toWh === String(wh.id) && styles.whChipActive]}
                    onPress={() => setToWh(String(wh.id))}
                  >
                    <Text style={[styles.whChipText, toWh === String(wh.id) && styles.whChipTextActive]}>
                      {wh.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Product picker */}
            <View style={styles.field}>
              <Text style={styles.label}>Product *</Text>
              <Pressable
                style={[styles.pickerBtn, !fromWh && styles.pickerBtnDisabled]}
                onPress={() => fromWh && setPickerVisible(true)}
              >
                <Ionicons name="cube-outline" size={16} color={selectedProduct ? colors.primaryDark : colors.muted} />
                <Text style={[styles.pickerBtnText, selectedProduct && styles.pickerBtnTextSelected]} numberOfLines={1}>
                  {selectedProduct
                    ? `${selectedProduct.productName}${selectedProduct.variantName ? ` — ${selectedProduct.variantName}` : ""}`
                    : fromWh ? "Select a product" : "Select source warehouse first"}
                </Text>
                {productsLoading
                  ? <ActivityIndicator size="small" color={colors.muted} />
                  : <Ionicons name="chevron-down" size={16} color={colors.muted} />}
              </Pressable>
              {selectedProduct && (
                <Text style={styles.stockHint}>
                  Available: {selectedProduct.stock} units · SKU: {selectedProduct.sku}
                </Text>
              )}
            </View>

            {/* Quantity */}
            <View style={styles.field}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#94a3b8"
                value={quantity}
                onChangeText={setQuantity}
              />
            </View>

            {/* Notes */}
            <View style={styles.field}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                placeholder="Reason for transfer..."
                placeholderTextColor="#94a3b8"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Create Transfer</Text>
                  </>
              }
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        /* History tab */
        transfersLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primaryDark} size="large" />
          </View>
        ) : (
          <FlatList
            data={transfers}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
            refreshing={transfersLoading}
            onRefresh={loadTransfers}
            renderItem={({ item }) => {
              const sc = STATUS_CONFIG[item.status] ?? { bg: "#f1f5f9", text: colors.muted };
              return (
                <View style={styles.transferCard}>
                  <View style={styles.transferTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.transferProduct} numberOfLines={1}>
                        {item.productName}{item.variantName ? ` — ${item.variantName}` : ""}
                      </Text>
                      <Text style={styles.transferRoute}>
                        {item.fromLocationName} → {item.toLocationName}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusText, { color: sc.text }]}>{item.status}</Text>
                    </View>
                  </View>
                  <View style={styles.transferMeta}>
                    <View style={styles.qtyBadge}>
                      <Text style={styles.qtyText}>× {item.quantity}</Text>
                    </View>
                    <Text style={styles.transferDate}>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  {item.notes ? (
                    <Text style={styles.transferNotes}>{item.notes}</Text>
                  ) : null}
                  {item.status === "Pending" && (
                    <Pressable
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item.id)}
                    >
                      <Text style={styles.cancelBtnText}>Cancel Transfer</Text>
                    </Pressable>
                  )}
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="swap-horizontal-outline" size={40} color={colors.muted} />
                <Text style={styles.emptyTitle}>No transfers yet</Text>
                <Text style={styles.emptyText}>Created transfers will appear here.</Text>
              </View>
            }
          />
        )
      )}

      {/* Product picker modal */}
      <Modal visible={pickerVisible} transparent animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.handle} />
          <Text style={styles.modalTitle}>Select Product</Text>
          <View style={styles.modalSearch}>
            <Ionicons name="search" size={15} color={colors.muted} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search..."
              placeholderTextColor="#94a3b8"
              value={productSearch}
              onChangeText={setProductSearch}
            />
          </View>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            style={styles.modalList}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <Pressable
                style={[
                  styles.productRow,
                  selectedProduct?.id === item.id && selectedProduct?.type === item.type
                    && styles.productRowActive,
                  item.stock <= 0 && styles.productRowDisabled,
                ]}
                onPress={() => {
                  if (item.stock > 0) {
                    setSelectedProduct(item);
                    setPickerVisible(false);
                    setProductSearch("");
                  }
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {item.productName}{item.variantName ? ` — ${item.variantName}` : ""}
                  </Text>
                  <Text style={styles.productSku}>SKU: {item.sku}</Text>
                </View>
                <View style={[
                  styles.stockPill,
                  { backgroundColor: item.stock <= 0 ? "#fee2e2" : "#dcfce7" },
                ]}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: item.stock <= 0 ? "#dc2626" : "#16a34a" }}>
                    {item.stock <= 0 ? "Out" : item.stock}
                  </Text>
                </View>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: colors.muted, fontSize: 14 }}>No products found</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: "center",
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.primaryDark },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: colors.primaryDark },
  formContent: { padding: 16, gap: 18, paddingBottom: 40 },
  field: { gap: 8 },
  label: { color: colors.text, fontSize: 14, fontWeight: "700" },
  selectRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  whChip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 8,
  },
  whChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  whChipText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  whChipTextActive: { color: colors.primaryDark },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: 14, height: 50,
  },
  pickerBtnDisabled: { opacity: 0.5 },
  pickerBtnText: { flex: 1, color: colors.muted, fontSize: 14 },
  pickerBtnTextSelected: { color: colors.text, fontWeight: "600" },
  stockHint: { color: colors.muted, fontSize: 12, marginLeft: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    backgroundColor: colors.surface, paddingHorizontal: 14,
    height: 50, color: colors.text, fontSize: 16,
  },
  inputMulti: { height: 90, paddingTop: 14, textAlignVertical: "top" },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 54, borderRadius: 16, backgroundColor: colors.primary,
  },
  submitBtnDisabled: { opacity: 0.55 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  listContent: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  transferCard: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
  },
  transferTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  transferProduct: { color: colors.text, fontSize: 14, fontWeight: "700" },
  transferRoute: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "800" },
  transferMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBadge: {
    backgroundColor: "#eff6ff", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  qtyText: { color: "#1d4ed8", fontSize: 13, fontWeight: "800" },
  transferDate: { color: colors.muted, fontSize: 12 },
  transferNotes: {
    color: colors.muted, fontSize: 12,
    backgroundColor: "#f8fafc", borderRadius: 8, padding: 8,
  },
  cancelBtn: {
    borderWidth: 1, borderColor: "#fca5a5", borderRadius: 10,
    paddingVertical: 8, alignItems: "center", backgroundColor: "#fff5f5",
  },
  cancelBtnText: { color: "#dc2626", fontSize: 13, fontWeight: "700" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "75%",
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 12,
  },
  handle: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: colors.border, marginBottom: 4,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  modalSearch: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: "#f8fafc", paddingHorizontal: 12, height: 42,
  },
  modalSearchInput: { flex: 1, color: colors.text, fontSize: 14 },
  modalList: { flexGrow: 0 },
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, padding: 12,
  },
  productRowActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  productRowDisabled: { opacity: 0.45 },
  productName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  productSku: { color: colors.muted, fontSize: 12, marginTop: 2 },
  stockPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
});
