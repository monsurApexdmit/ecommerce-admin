import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  approveCustomerReturn,
  createCustomerReturn,
  createVendorReturn,
  deleteCustomerReturn,
  deleteVendorReturn,
  getCustomerReturns,
  getCustomerReturnStats,
  getVendorReturns,
  getVendorReturnStats,
  rejectCustomerReturn,
  updateVendorReturnStatus,
  type CustomerReturn,
  type CustomerReturnStats,
  type VendorReturn,
  type VendorReturnStats,
} from "@/services/returns";
import { getProducts } from "@/services/products";
import { getVendors } from "@/services/vendors";
import { getCustomers } from "@/services/customers";
import type { Product } from "@/types/product";

// ─── Status helpers ───────────────────────────────────────────────────────────

const CUSTOMER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#d97706" },
  approved: { bg: "#dcfce7", text: "#16a34a" },
  rejected: { bg: "#fee2e2", text: "#dc2626" },
  completed: { bg: "#eff6ff", text: "#1d4ed8" },
};

const VENDOR_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#d97706" },
  shipped: { bg: "#dbeafe", text: "#1d4ed8" },
  received_by_vendor: { bg: "#ede9fe", text: "#7c3aed" },
  completed: { bg: "#dcfce7", text: "#16a34a" },
};

function StatusPill({ status, type }: { status: string; type: "customer" | "vendor" }) {
  const map = type === "customer" ? CUSTOMER_STATUS_COLORS : VENDOR_STATUS_COLORS;
  const tone = map[status] ?? { bg: "#f1f5f9", text: "#64748b" };
  return (
    <View style={[pillStyles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[pillStyles.text, { color: tone.text }]}>{status.replace(/_/g, " ")}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: "700" },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

type Tab = "customer" | "vendor";

export default function ReturnsScreen() {
  const [tab, setTab] = useState<Tab>("customer");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Returns</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === "customer" && styles.tabActive]}
          onPress={() => setTab("customer")}
        >
          <Text style={[styles.tabText, tab === "customer" && styles.tabTextActive]}>Customer Returns</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, tab === "vendor" && styles.tabActive]}
          onPress={() => setTab("vendor")}
        >
          <Text style={[styles.tabText, tab === "vendor" && styles.tabTextActive]}>Vendor Returns</Text>
        </Pressable>
      </View>

      {tab === "customer" ? <CustomerReturnsTab /> : <VendorReturnsTab />}
    </SafeAreaView>
  );
}

// ─── Customer Returns Tab ─────────────────────────────────────────────────────

function CustomerReturnsTab() {
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [stats, setStats] = useState<CustomerReturnStats>({ total: 0, pending: 0, approved: 0, rejected: 0, completed: 0, totalRefundAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [detailReturn, setDetailReturn] = useState<CustomerReturn | null>(null);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    try {
      const [res, st] = await Promise.allSettled([
        getCustomerReturns({ page: 1, limit: 20, status: statusFilter }),
        getCustomerReturnStats(),
      ]);
      if (res.status === "fulfilled") {
        setReturns(res.value.data);
        setTotal(res.value.total);
        setPage(1);
      }
      if (st.status === "fulfilled") setStats(st.value);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || returns.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getCustomerReturns({ page: next, limit: 20, status: statusFilter });
      setReturns((prev) => [...prev, ...res.data]);
      setPage(next);
    } finally { setLoadingMore(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openMenu = (r: CustomerReturn) => {
    const opts: any[] = [{ text: "View Details", onPress: () => setDetailReturn(r) }];
    if (r.status === "pending") {
      opts.push(
        { text: "Approve", onPress: async () => { await approveCustomerReturn(r.id); load(); } },
        { text: "Reject", style: "destructive", onPress: () =>
          Alert.prompt?.("Reject Return", "Reason for rejection:", async (reason) => {
            if (reason) { await rejectCustomerReturn(r.id, reason); load(); }
          }) ?? Alert.alert("Reject", "Enter rejection reason", [
            { text: "Cancel", style: "cancel" },
            { text: "Reject", style: "destructive", onPress: async () => { await rejectCustomerReturn(r.id, "Rejected by admin"); load(); } },
          ])
        }
      );
    }
    opts.push(
      { text: "Delete", style: "destructive", onPress: () =>
        Alert.alert("Delete", "Delete this return?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => { await deleteCustomerReturn(r.id); load(); } },
        ])
      },
      { text: "Cancel", style: "cancel" }
    );
    Alert.alert(`Return #${r.returnNumber ?? r.id}`, r.status, opts);
  };

  const CUSTOMER_STATUS_FILTERS = [undefined, "pending", "approved", "rejected", "completed"];

  return (
    <View style={{ flex: 1 }}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <SmallStat label="Total" value={stats.total} bg="#eff6ff" text="#1d4ed8" />
        <SmallStat label="Pending" value={stats.pending} bg="#fef3c7" text="#d97706" />
        <SmallStat label="Approved" value={stats.approved} bg="#dcfce7" text="#16a34a" />
        <SmallStat label="Refunded" value={stats.completed} bg="#f3e8ff" text="#7c3aed" />
      </View>

      {/* Total refund amount */}
      <View style={styles.amountBanner}>
        <Text style={styles.amountBannerLabel}>Total Refund Amount</Text>
        <Text style={styles.amountBannerValue}>{formatCurrency(stats.totalRefundAmount)}</Text>
      </View>

      {/* Status filter chips */}
      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {CUSTOMER_STATUS_FILTERS.map((s, i) => (
            <Pressable
              key={i}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s ?? "All"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Add button */}
      <View style={styles.actionBar}>
        <Text style={styles.actionBarCount}>{total} returns</Text>
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New Return</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={returns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setDetailReturn(item)} onLongPress={() => openMenu(item)}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>#{item.returnNumber ?? item.id}</Text>
                  <Text style={styles.cardSub}>{item.customerName ?? `Customer #${item.customerId}`}</Text>
                  {item.orderNumber && <Text style={styles.cardSub}>Order: {item.orderNumber}</Text>}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {item.totalAmount !== undefined && (
                    <Text style={styles.cardAmount}>{formatCurrency(item.totalAmount)}</Text>
                  )}
                  <StatusPill status={item.status} type="customer" />
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.cardDate}>{formatDateTime(item.createdAt)}</Text>
                {item.refundMethod && (
                  <View style={styles.methodPill}>
                    <Text style={styles.methodText}>{item.refundMethod}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="return-down-back-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No returns found</Text>
            </View>
          }
        />
      )}

      {addOpen && (
        <AddCustomerReturnModal
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load(); }}
        />
      )}

      {detailReturn && (
        <CustomerReturnDetailModal
          returnData={detailReturn}
          onClose={() => setDetailReturn(null)}
          onAction={() => { setDetailReturn(null); load(); }}
        />
      )}
    </View>
  );
}

// ─── Vendor Returns Tab ───────────────────────────────────────────────────────

function VendorReturnsTab() {
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [stats, setStats] = useState<VendorReturnStats>({ total: 0, pending: 0, shipped: 0, receivedByVendor: 0, completed: 0, totalCreditAmount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [detailReturn, setDetailReturn] = useState<VendorReturn | null>(null);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    try {
      const [res, st] = await Promise.allSettled([
        getVendorReturns({ page: 1, limit: 20, status: statusFilter }),
        getVendorReturnStats(),
      ]);
      if (res.status === "fulfilled") {
        setReturns(res.value.data);
        setTotal(res.value.total);
        setPage(1);
      }
      if (st.status === "fulfilled") setStats(st.value);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || returns.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getVendorReturns({ page: next, limit: 20, status: statusFilter });
      setReturns((prev) => [...prev, ...res.data]);
      setPage(next);
    } finally { setLoadingMore(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const VENDOR_STATUS_FLOW = ["pending", "shipped", "received_by_vendor", "completed"] as const;

  const openMenu = (r: VendorReturn) => {
    const opts: any[] = [{ text: "View Details", onPress: () => setDetailReturn(r) }];
    const currentIdx = VENDOR_STATUS_FLOW.indexOf(r.status as any);
    if (currentIdx < VENDOR_STATUS_FLOW.length - 1) {
      const next = VENDOR_STATUS_FLOW[currentIdx + 1];
      opts.push({ text: `Mark as ${next.replace(/_/g, " ")}`, onPress: async () => {
        await updateVendorReturnStatus(r.id, next);
        load();
      }});
    }
    opts.push(
      { text: "Delete", style: "destructive", onPress: () =>
        Alert.alert("Delete", "Delete this return?", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => { await deleteVendorReturn(r.id); load(); } },
        ])
      },
      { text: "Cancel", style: "cancel" }
    );
    Alert.alert(`Return #${r.returnNumber ?? r.id}`, r.status.replace(/_/g, " "), opts);
  };

  const VENDOR_STATUS_FILTERS = [undefined, "pending", "shipped", "received_by_vendor", "completed"];

  return (
    <View style={{ flex: 1 }}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <SmallStat label="Total" value={stats.total} bg="#eff6ff" text="#1d4ed8" />
        <SmallStat label="Pending" value={stats.pending} bg="#fef3c7" text="#d97706" />
        <SmallStat label="Shipped" value={stats.shipped} bg="#dbeafe" text="#2563eb" />
        <SmallStat label="Done" value={stats.completed} bg="#dcfce7" text="#16a34a" />
      </View>

      <View style={styles.amountBanner}>
        <Text style={styles.amountBannerLabel}>Total Credit Amount</Text>
        <Text style={styles.amountBannerValue}>{formatCurrency(stats.totalCreditAmount)}</Text>
      </View>

      <View style={styles.chipRowWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {VENDOR_STATUS_FILTERS.map((s, i) => (
            <Pressable
              key={i}
              style={[styles.chip, statusFilter === s && styles.chipActive]}
              onPress={() => setStatusFilter(s)}
            >
              <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
                {s ? s.replace(/_/g, " ") : "All"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.actionBar}>
        <Text style={styles.actionBarCount}>{total} returns</Text>
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addBtnText}>New Return</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={returns}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setDetailReturn(item)} onLongPress={() => openMenu(item)}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>#{item.returnNumber ?? item.id}</Text>
                  <Text style={styles.cardSub}>{item.vendorName ?? `Vendor #${item.vendorId}`}</Text>
                  {item.creditType && <Text style={styles.cardSub}>Credit: {item.creditType.replace(/_/g, " ")}</Text>}
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  {item.totalAmount !== undefined && (
                    <Text style={styles.cardAmount}>{formatCurrency(item.totalAmount)}</Text>
                  )}
                  <StatusPill status={item.status} type="vendor" />
                </View>
              </View>
              <Text style={styles.cardDate}>{formatDateTime(item.createdAt)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="return-up-forward-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No returns found</Text>
            </View>
          }
        />
      )}

      {addOpen && (
        <AddVendorReturnModal
          visible={addOpen}
          onClose={() => setAddOpen(false)}
          onCreated={() => { setAddOpen(false); load(); }}
        />
      )}

      {detailReturn && (
        <VendorReturnDetailModal
          returnData={detailReturn}
          onClose={() => setDetailReturn(null)}
          onAction={(updated) => {
            setReturns((prev) => prev.map((r) => r.id === updated.id ? updated : r));
            setDetailReturn(updated);
          }}
        />
      )}
    </View>
  );
}

// ─── Add Customer Return Modal ────────────────────────────────────────────────

function AddCustomerReturnModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [customers, setCustomers] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: number; name: string } | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [refundMethod, setRefundMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: number; productName: string; quantity: number; price: number; reason: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      Promise.all([
        getCustomers({ limit: 50 }),
        getProducts({ limit: 50 }),
      ]).then(([c, p]) => {
        setCustomers(c.data.map((x) => ({ id: x.id, name: x.name })));
        setProducts(p.data);
      }).catch(() => {});
    }
  }, [visible]);

  const filteredCustomers = customers.filter((c) =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase())
  );
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItem = (product: Product) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) return prev;
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, price: 0, reason: "Defective" }];
    });
    setShowProductPicker(false);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const reset = () => {
    setSelectedCustomer(null); setOrderNumber(""); setRefundMethod("cash");
    setNotes(""); setItems([]); setCustomerSearch(""); setProductSearch("");
  };

  const handleCreate = async () => {
    if (!selectedCustomer) { Alert.alert("Error", "Select a customer."); return; }
    if (items.length === 0) { Alert.alert("Error", "Add at least one item."); return; }
    setSaving(true);
    try {
      await createCustomerReturn({
        customerId: selectedCustomer.id,
        orderNumber: orderNumber || undefined,
        refundMethod,
        notes: notes || undefined,
        totalAmount,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, reason: i.reason, price: i.price })),
      });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create return.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={mStyles.kav}>
        <View style={mStyles.sheet}>
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>New Customer Return</Text>
            <Pressable onPress={() => { reset(); onClose(); }} style={mStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={mStyles.fields} keyboardShouldPersistTaps="handled">
            {/* Customer */}
            <View>
              <Text style={mStyles.fieldLabel}>Customer *</Text>
              <Pressable style={mStyles.pickerBtn} onPress={() => setShowCustomerPicker(!showCustomerPicker)}>
                <Text style={selectedCustomer ? mStyles.pickerBtnText : mStyles.pickerBtnPlaceholder}>
                  {selectedCustomer?.name ?? "Select customer..."}
                </Text>
                <Ionicons name={showCustomerPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
              </Pressable>
              {showCustomerPicker && (
                <View style={mStyles.dropdown}>
                  <TextInput
                    style={mStyles.dropdownSearch}
                    value={customerSearch}
                    onChangeText={setCustomerSearch}
                    placeholder="Search..."
                    placeholderTextColor="#94a3b8"
                  />
                  <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                    {filteredCustomers.map((c) => (
                      <Pressable
                        key={c.id}
                        style={mStyles.dropdownItem}
                        onPress={() => { setSelectedCustomer(c); setShowCustomerPicker(false); }}
                      >
                        <Text style={mStyles.dropdownItemText}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Order number */}
            <View>
              <Text style={mStyles.fieldLabel}>Order Number</Text>
              <TextInput
                style={mStyles.input}
                value={orderNumber}
                onChangeText={setOrderNumber}
                placeholder="Optional order reference"
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Refund method */}
            <View>
              <Text style={mStyles.fieldLabel}>Refund Method</Text>
              <View style={mStyles.methodRow}>
                {["cash", "card", "store_credit"].map((m) => (
                  <Pressable
                    key={m}
                    style={[mStyles.methodChip, refundMethod === m && mStyles.methodChipActive]}
                    onPress={() => setRefundMethod(m)}
                  >
                    <Text style={[mStyles.methodChipText, refundMethod === m && mStyles.methodChipTextActive]}>
                      {m.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Items */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={mStyles.fieldLabel}>Items *</Text>
                <Pressable style={mStyles.addItemBtn} onPress={() => setShowProductPicker(!showProductPicker)}>
                  <Ionicons name="add" size={14} color={colors.primaryDark} />
                  <Text style={mStyles.addItemBtnText}>Add Item</Text>
                </Pressable>
              </View>

              {showProductPicker && (
                <View style={mStyles.dropdown}>
                  <TextInput
                    style={mStyles.dropdownSearch}
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholder="Search products..."
                    placeholderTextColor="#94a3b8"
                  />
                  <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                    {filteredProducts.map((p) => (
                      <Pressable key={p.id} style={mStyles.dropdownItem} onPress={() => addItem(p)}>
                        <Text style={mStyles.dropdownItemText}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {items.map((item, idx) => (
                <View key={idx} style={mStyles.itemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={mStyles.itemName} numberOfLines={1}>{item.productName}</Text>
                    <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                  <View style={mStyles.itemFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={mStyles.itemFieldLabel}>Qty</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={String(item.quantity)}
                        onChangeText={(v) => updateItem(idx, "quantity", Number(v) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={mStyles.itemFieldLabel}>Unit Price</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={String(item.price)}
                        onChangeText={(v) => updateItem(idx, "price", Number(v) || 0)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={mStyles.itemFieldLabel}>Reason</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={item.reason}
                        onChangeText={(v) => updateItem(idx, "reason", v)}
                        placeholder="Reason"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {items.length > 0 && (
                <View style={mStyles.totalRow}>
                  <Text style={mStyles.totalLabel}>Total Refund</Text>
                  <Text style={mStyles.totalValue}>{formatCurrency(totalAmount)}</Text>
                </View>
              )}
            </View>

            {/* Notes */}
            <View>
              <Text style={mStyles.fieldLabel}>Notes</Text>
              <TextInput
                style={[mStyles.input, { height: 70, textAlignVertical: "top", paddingTop: 10 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>

            <Pressable style={[mStyles.saveBtn, saving && { opacity: 0.55 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Submit Return</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Vendor Return Modal ──────────────────────────────────────────────────

function AddVendorReturnModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [vendorsList, setVendorsList] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<{ id: number; name: string } | null>(null);
  const [creditType, setCreditType] = useState("credit_note");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ productId: number; productName: string; quantity: number; unitPrice: number; reason: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [showVendorPicker, setShowVendorPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      Promise.all([getVendors({ limit: 50 }), getProducts({ limit: 50 })]).then(([v, p]) => {
        setVendorsList(v.data.map((x) => ({ id: x.id, name: x.name })));
        setProducts(p.data);
      }).catch(() => {});
    }
  }, [visible]);

  const filteredVendors = vendorsList.filter((v) =>
    v.name.toLowerCase().includes(vendorSearch.toLowerCase())
  );
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItem = (product: Product) => {
    setItems((prev) => {
      if (prev.find((i) => i.productId === product.id)) return prev;
      return [...prev, { productId: product.id, productName: product.name, quantity: 1, unitPrice: 0, reason: "Defective" }];
    });
    setShowProductPicker(false);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalAmount = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity), 0);

  const reset = () => {
    setSelectedVendor(null); setCreditType("credit_note"); setNotes(""); setItems([]);
    setVendorSearch(""); setProductSearch("");
  };

  const handleCreate = async () => {
    if (!selectedVendor) { Alert.alert("Error", "Select a vendor."); return; }
    if (items.length === 0) { Alert.alert("Error", "Add at least one item."); return; }
    setSaving(true);
    try {
      await createVendorReturn({
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        creditType,
        notes: notes || undefined,
        totalAmount,
        items: items.map((i) => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity,
          reason: i.reason,
        })),
      });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create return.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={mStyles.kav}>
        <View style={mStyles.sheet}>
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>New Vendor Return</Text>
            <Pressable onPress={() => { reset(); onClose(); }} style={mStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={mStyles.fields} keyboardShouldPersistTaps="handled">
            {/* Vendor picker */}
            <View>
              <Text style={mStyles.fieldLabel}>Vendor *</Text>
              <Pressable style={mStyles.pickerBtn} onPress={() => setShowVendorPicker(!showVendorPicker)}>
                <Text style={selectedVendor ? mStyles.pickerBtnText : mStyles.pickerBtnPlaceholder}>
                  {selectedVendor?.name ?? "Select vendor..."}
                </Text>
                <Ionicons name={showVendorPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
              </Pressable>
              {showVendorPicker && (
                <View style={mStyles.dropdown}>
                  <TextInput
                    style={mStyles.dropdownSearch}
                    value={vendorSearch}
                    onChangeText={setVendorSearch}
                    placeholder="Search..."
                    placeholderTextColor="#94a3b8"
                  />
                  <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                    {filteredVendors.map((v) => (
                      <Pressable key={v.id} style={mStyles.dropdownItem} onPress={() => { setSelectedVendor(v); setShowVendorPicker(false); }}>
                        <Text style={mStyles.dropdownItemText}>{v.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Credit type */}
            <View>
              <Text style={mStyles.fieldLabel}>Credit Type</Text>
              <View style={mStyles.methodRow}>
                {["credit_note", "refund", "replacement"].map((t) => (
                  <Pressable
                    key={t}
                    style={[mStyles.methodChip, creditType === t && mStyles.methodChipActive]}
                    onPress={() => setCreditType(t)}
                  >
                    <Text style={[mStyles.methodChipText, creditType === t && mStyles.methodChipTextActive]}>
                      {t.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Items */}
            <View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={mStyles.fieldLabel}>Items *</Text>
                <Pressable style={mStyles.addItemBtn} onPress={() => setShowProductPicker(!showProductPicker)}>
                  <Ionicons name="add" size={14} color={colors.primaryDark} />
                  <Text style={mStyles.addItemBtnText}>Add Item</Text>
                </Pressable>
              </View>

              {showProductPicker && (
                <View style={mStyles.dropdown}>
                  <TextInput
                    style={mStyles.dropdownSearch}
                    value={productSearch}
                    onChangeText={setProductSearch}
                    placeholder="Search products..."
                    placeholderTextColor="#94a3b8"
                  />
                  <ScrollView style={{ maxHeight: 160 }} keyboardShouldPersistTaps="handled">
                    {filteredProducts.map((p) => (
                      <Pressable key={p.id} style={mStyles.dropdownItem} onPress={() => addItem(p)}>
                        <Text style={mStyles.dropdownItemText}>{p.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {items.map((item, idx) => (
                <View key={idx} style={mStyles.itemCard}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={mStyles.itemName} numberOfLines={1}>{item.productName}</Text>
                    <Pressable onPress={() => removeItem(idx)} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                  <View style={mStyles.itemFields}>
                    <View style={{ flex: 1 }}>
                      <Text style={mStyles.itemFieldLabel}>Qty</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={String(item.quantity)}
                        onChangeText={(v) => updateItem(idx, "quantity", Number(v) || 1)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ flex: 1.5 }}>
                      <Text style={mStyles.itemFieldLabel}>Unit Price</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={String(item.unitPrice)}
                        onChangeText={(v) => updateItem(idx, "unitPrice", Number(v) || 0)}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 2 }}>
                      <Text style={mStyles.itemFieldLabel}>Reason</Text>
                      <TextInput
                        style={mStyles.itemInput}
                        value={item.reason}
                        onChangeText={(v) => updateItem(idx, "reason", v)}
                        placeholder="Reason"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>
                </View>
              ))}

              {items.length > 0 && (
                <View style={mStyles.totalRow}>
                  <Text style={mStyles.totalLabel}>Total Credit</Text>
                  <Text style={mStyles.totalValue}>{formatCurrency(totalAmount)}</Text>
                </View>
              )}
            </View>

            {/* Notes */}
            <View>
              <Text style={mStyles.fieldLabel}>Notes</Text>
              <TextInput
                style={[mStyles.input, { height: 70, textAlignVertical: "top", paddingTop: 10 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Additional notes..."
                placeholderTextColor="#94a3b8"
                multiline
              />
            </View>

            <Pressable style={[mStyles.saveBtn, saving && { opacity: 0.55 }]} onPress={handleCreate} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Submit Return</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Detail Modals ────────────────────────────────────────────────────────────

function CustomerReturnDetailModal({ returnData, onClose, onAction }: {
  returnData: CustomerReturn; onClose: () => void; onAction: () => void;
}) {
  const [processing, setProcessing] = useState(false);

  const handleApprove = async () => {
    setProcessing(true);
    try { await approveCustomerReturn(returnData.id); onAction(); }
    catch (err: any) { Alert.alert("Error", err?.response?.data?.message ?? "Action failed."); }
    finally { setProcessing(false); }
  };

  const handleReject = () => {
    Alert.alert("Reject Return", "This will reject the return.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reject", style: "destructive", onPress: async () => {
        setProcessing(true);
        try { await rejectCustomerReturn(returnData.id, "Rejected by admin"); onAction(); }
        catch (err: any) { Alert.alert("Error", err?.response?.data?.message ?? "Action failed."); }
        finally { setProcessing(false); }
      }},
    ]);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <View style={[mStyles.kav, { justifyContent: "flex-end" }]}>
        <View style={mStyles.sheet}>
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>Return #{returnData.returnNumber ?? returnData.id}</Text>
            <Pressable onPress={onClose} style={mStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={mStyles.fields}>
            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Status</Text>
              <StatusPill status={returnData.status} type="customer" />
            </View>
            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Customer</Text>
              <Text style={detailStyles.value}>{returnData.customerName ?? `#${returnData.customerId}`}</Text>
            </View>
            {returnData.orderNumber && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Order #</Text>
                <Text style={detailStyles.value}>{returnData.orderNumber}</Text>
              </View>
            )}
            {returnData.refundMethod && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Refund Method</Text>
                <Text style={detailStyles.value}>{returnData.refundMethod}</Text>
              </View>
            )}
            {returnData.totalAmount !== undefined && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Total Amount</Text>
                <Text style={[detailStyles.value, { color: colors.primaryDark, fontWeight: "800" }]}>{formatCurrency(returnData.totalAmount)}</Text>
              </View>
            )}
            {returnData.notes && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Notes</Text>
                <Text style={detailStyles.value}>{returnData.notes}</Text>
              </View>
            )}
            {returnData.rejectionReason && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Rejection Reason</Text>
                <Text style={[detailStyles.value, { color: "#dc2626" }]}>{returnData.rejectionReason}</Text>
              </View>
            )}

            {/* Items */}
            {returnData.items && returnData.items.length > 0 && (
              <View style={detailStyles.itemsCard}>
                <Text style={detailStyles.itemsTitle}>Items</Text>
                <View style={detailStyles.itemsHeader}>
                  <Text style={[detailStyles.itemCol, { flex: 2 }]}>Product</Text>
                  <Text style={detailStyles.itemCol}>Qty</Text>
                  <Text style={detailStyles.itemCol}>Price</Text>
                  <Text style={detailStyles.itemCol}>Subtotal</Text>
                </View>
                {returnData.items.map((item, i) => (
                  <View key={i} style={detailStyles.itemRow}>
                    <Text style={[detailStyles.itemCell, { flex: 2 }]} numberOfLines={1}>
                      {item.productName ?? `Product #${item.productId}`}
                    </Text>
                    <Text style={detailStyles.itemCell}>{item.quantity}</Text>
                    <Text style={detailStyles.itemCell}>{item.price ? formatCurrency(item.price) : "—"}</Text>
                    <Text style={detailStyles.itemCell}>
                      {item.price ? formatCurrency(item.price * item.quantity) : "—"}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {returnData.status === "pending" && (
              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <Pressable style={[mStyles.saveBtn, { flex: 1, backgroundColor: "#16a34a" }, processing && { opacity: 0.55 }]} onPress={handleApprove} disabled={processing}>
                  {processing ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Approve</Text>}
                </Pressable>
                <Pressable style={[mStyles.saveBtn, { flex: 1, backgroundColor: "#dc2626" }, processing && { opacity: 0.55 }]} onPress={handleReject} disabled={processing}>
                  <Text style={mStyles.saveBtnText}>Reject</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function VendorReturnDetailModal({ returnData, onClose, onAction }: {
  returnData: VendorReturn; onClose: () => void; onAction: (updated: VendorReturn) => void;
}) {
  const [processing, setProcessing] = useState(false);

  const FLOW = ["pending", "shipped", "received_by_vendor", "completed"] as const;
  const currentIdx = FLOW.indexOf(returnData.status as any);
  const nextStatus = currentIdx < FLOW.length - 1 ? FLOW[currentIdx + 1] : null;

  const handleAdvance = async () => {
    if (!nextStatus) return;
    setProcessing(true);
    try {
      const updated = await updateVendorReturnStatus(returnData.id, nextStatus);
      onAction(updated);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Action failed.");
    } finally { setProcessing(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <View style={[mStyles.kav, { justifyContent: "flex-end" }]}>
        <View style={mStyles.sheet}>
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>Return #{returnData.returnNumber ?? returnData.id}</Text>
            <Pressable onPress={onClose} style={mStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={mStyles.fields}>
            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Status</Text>
              <StatusPill status={returnData.status} type="vendor" />
            </View>
            <View style={detailStyles.row}>
              <Text style={detailStyles.label}>Vendor</Text>
              <Text style={detailStyles.value}>{returnData.vendorName ?? `#${returnData.vendorId}`}</Text>
            </View>
            {returnData.creditType && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Credit Type</Text>
                <Text style={detailStyles.value}>{returnData.creditType.replace(/_/g, " ")}</Text>
              </View>
            )}
            {returnData.totalAmount !== undefined && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Total Amount</Text>
                <Text style={[detailStyles.value, { color: colors.primaryDark, fontWeight: "800" }]}>{formatCurrency(returnData.totalAmount)}</Text>
              </View>
            )}
            {returnData.notes && (
              <View style={detailStyles.row}>
                <Text style={detailStyles.label}>Notes</Text>
                <Text style={detailStyles.value}>{returnData.notes}</Text>
              </View>
            )}

            {/* Items */}
            {returnData.items && returnData.items.length > 0 && (
              <View style={detailStyles.itemsCard}>
                <Text style={detailStyles.itemsTitle}>Items</Text>
                <View style={detailStyles.itemsHeader}>
                  <Text style={[detailStyles.itemCol, { flex: 2 }]}>Product</Text>
                  <Text style={detailStyles.itemCol}>Qty</Text>
                  <Text style={detailStyles.itemCol}>Unit Price</Text>
                  <Text style={detailStyles.itemCol}>Total</Text>
                </View>
                {returnData.items.map((item, i) => (
                  <View key={i} style={detailStyles.itemRow}>
                    <Text style={[detailStyles.itemCell, { flex: 2 }]} numberOfLines={1}>
                      {item.productName ?? `Product #${item.productId}`}
                    </Text>
                    <Text style={detailStyles.itemCell}>{item.quantity}</Text>
                    <Text style={detailStyles.itemCell}>{item.unitPrice ? formatCurrency(item.unitPrice) : "—"}</Text>
                    <Text style={detailStyles.itemCell}>{item.totalPrice ? formatCurrency(item.totalPrice) : "—"}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Status flow progression */}
            <View style={detailStyles.flowRow}>
              {FLOW.map((s, i) => {
                const done = i <= currentIdx;
                return (
                  <View key={s} style={detailStyles.flowStep}>
                    <View style={[detailStyles.flowDot, done && detailStyles.flowDotDone]} />
                    <Text style={[detailStyles.flowLabel, done && detailStyles.flowLabelDone]}>{s.replace(/_/g, " ")}</Text>
                    {i < FLOW.length - 1 && <View style={[detailStyles.flowLine, done && i < currentIdx && detailStyles.flowLineDone]} />}
                  </View>
                );
              })}
            </View>

            {nextStatus && (
              <Pressable style={[mStyles.saveBtn, processing && { opacity: 0.55 }]} onPress={handleAdvance} disabled={processing}>
                {processing
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={mStyles.saveBtnText}>Mark as {nextStatus.replace(/_/g, " ")}</Text>
                }
              </Pressable>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SmallStat({ label, value, bg, text }: { label: string; value: number; bg: string; text: string }) {
  return (
    <View style={[smallStatStyles.chip, { backgroundColor: bg }]}>
      <Text style={[smallStatStyles.value, { color: text }]}>{value}</Text>
      <Text style={[smallStatStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const smallStatStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
  value: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 10, fontWeight: "700" },
});

const detailStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.text, fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1, marginLeft: 12 },
  itemsCard: { backgroundColor: "#f8fafc", borderRadius: 12, padding: 12, gap: 6, marginTop: 6 },
  itemsTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  itemsHeader: { flexDirection: "row", paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemCol: { flex: 1, color: colors.muted, fontSize: 11, fontWeight: "700" },
  itemRow: { flexDirection: "row", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemCell: { flex: 1, color: colors.text, fontSize: 12, fontWeight: "600" },
  flowRow: { flexDirection: "row", alignItems: "flex-start", marginVertical: 12 },
  flowStep: { flex: 1, alignItems: "center", position: "relative" },
  flowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginBottom: 4 },
  flowDotDone: { backgroundColor: colors.primaryDark },
  flowLabel: { color: colors.muted, fontSize: 9, fontWeight: "700", textAlign: "center" },
  flowLabelDone: { color: colors.primaryDark },
  flowLine: { position: "absolute", top: 4, left: "50%", right: "-50%", height: 2, backgroundColor: colors.border },
  flowLineDone: { backgroundColor: colors.primaryDark },
});

const mStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "92%" },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  fields: { padding: 20, gap: 14, paddingBottom: 32 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, color: colors.text, fontSize: 14,
    backgroundColor: "#f8fafc",
  },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, backgroundColor: "#f8fafc",
  },
  pickerBtnText: { color: colors.text, fontSize: 14 },
  pickerBtnPlaceholder: { color: "#94a3b8", fontSize: 14 },
  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: colors.surface, marginTop: 4, overflow: "hidden",
  },
  dropdownSearch: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 14, height: 42, color: colors.text, fontSize: 14,
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  dropdownItemText: { color: colors.text, fontSize: 14 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 9, alignItems: "center",
  },
  methodChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  methodChipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  methodChipTextActive: { color: colors.primaryDark },
  addItemBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  addItemBtnText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  itemCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, gap: 8, backgroundColor: "#f8fafc", marginTop: 6,
  },
  itemName: { color: colors.text, fontSize: 13, fontWeight: "700", flex: 1 },
  itemFields: { flexDirection: "row", gap: 6 },
  itemFieldLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 3 },
  itemInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 8, height: 36, color: colors.text, fontSize: 13,
    backgroundColor: colors.surface,
  },
  totalRow: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: "#ecfdf5", borderRadius: 10, padding: 12, marginTop: 6,
  },
  totalLabel: { color: colors.primaryDark, fontSize: 14, fontWeight: "700" },
  totalValue: { color: colors.primaryDark, fontSize: 16, fontWeight: "800" },
  saveBtn: { borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  tabRow: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primaryDark },
  tabText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: colors.primaryDark },
  statsRow: { flexDirection: "row", gap: 6, padding: 12, paddingBottom: 6 },
  amountBanner: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginHorizontal: 12, marginBottom: 6,
    backgroundColor: "#f0fdf4", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  amountBannerLabel: { color: "#16a34a", fontSize: 13, fontWeight: "700" },
  amountBannerValue: { color: "#16a34a", fontSize: 16, fontWeight: "800" },
  chipRowWrap: { height: 46 },
  chipRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, height: 46 },
  chip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.primaryDark },
  actionBar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 8,
  },
  actionBarCount: { color: colors.muted, fontSize: 13 },
  addBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primaryDark, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  listContent: { padding: 12, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cardAmount: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardDate: { color: colors.muted, fontSize: 12 },
  methodPill: { backgroundColor: "#eff6ff", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  methodText: { color: "#1d4ed8", fontSize: 11, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
});
