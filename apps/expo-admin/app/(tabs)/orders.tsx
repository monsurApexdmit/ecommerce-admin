import { useCallback, useEffect, useMemo, useState } from "react";
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
  ToastAndroid,
  Platform,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { deleteOrder, getOrders, getOrderStats, updateOrderStatus } from "@/services/order-service";
import type { Order, OrderStats } from "@/types/order";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";

type MethodFilter = "" | "Cash" | "Card" | "Online";

export default function OrdersTab() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [methodFilter, setMethodFilter] = useState<MethodFilter>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const searchActive = search.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadStats = useCallback(async () => {
    setStats(await getOrderStats());
  }, []);

  const loadOrders = useCallback(
    async (nextPage: number, mode: "reset" | "append") => {
      const result = await getOrders({
        page: nextPage,
        limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || undefined,
        method: methodFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      setOrders((current) => (mode === "append" ? [...current, ...result.data] : result.data));
      setPage(result.page);
      setTotal(result.total);
      setHasNext(result.page * result.limit < result.total);
    },
    [debouncedSearch, statusFilter, methodFilter, startDate, endDate],
  );

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadStats(), loadOrders(1, "reset")]);
    } finally {
      setLoading(false);
    }
  }, [loadOrders, loadStats]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useFocusEffect(
    useCallback(() => {
      void loadOrders(1, "reset");
    }, [loadOrders])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await Promise.all([loadStats(), loadOrders(1, "reset")]);
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders, loadStats]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;

    try {
      setLoadingMore(true);
      await loadOrders(page + 1, "append");
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadingMore, loading, loadOrders, page]);

  const filtersApplied = useMemo(
    () => Boolean(statusFilter || methodFilter || startDate || endDate),
    [statusFilter, methodFilter, startDate, endDate],
  );

  const copyOrderNo = (invoiceNo: string) => {
    void Clipboard.setStringAsync(invoiceNo);
    if (Platform.OS === "android") {
      ToastAndroid.show("Order number copied", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", `#${invoiceNo} copied to clipboard`);
    }
  };

  const openOrderMenu = (order: Order) => {
    Alert.alert(`#${order.invoiceNo}`, "Choose an action", [
      { text: "Cancel", style: "cancel" },
      { text: "Copy Order #", onPress: () => copyOrderNo(order.invoiceNo) },
      { text: "View", onPress: () => router.push(`/orders/${order.id}`) },
      {
        text: order.status === "Delivered" ? "Mark Processing" : "Mark Delivered",
        onPress: async () => {
          const nextStatus = order.status === "Delivered" ? "Processing" : "Delivered";
          await updateOrderStatus(order.id, nextStatus);
          await loadOrders(1, "reset");
          await loadStats();
        },
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteOrder(order.id);
          await loadOrders(1, "reset");
          await loadStats();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.header, searchActive && { paddingTop: 12 }]}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Orders</Text>
          {!searchActive && (
            <Text style={styles.subtitle} numberOfLines={1}>
              Track &amp; manage orders, status, shipments
            </Text>
          )}
        </View>
        <Pressable style={styles.primaryAction} onPress={() => router.push("/orders/shipments")}>
          <Ionicons name="cube-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>Shipments</Text>
        </Pressable>
      </View>

      {!searchActive && (
        <View style={styles.statsRow}>
          <ScrollViewRow>
            <StatChip label="Total" value={stats ? String(stats.totalSells) : "—"} tone="info" />
            <StatChip label="Pending" value={stats ? String(stats.pendingOrders) : "—"} tone="danger" />
            <StatChip label="Processing" value={stats ? String(stats.processingOrders) : "—"} tone="warning" />
            <StatChip label="Delivered" value={stats ? String(stats.deliveredOrders) : "—"} tone="success" />
            <StatChip label="Revenue" value={stats ? formatCurrency(stats.totalRevenue) : "—"} tone="neutral" />
          </ScrollViewRow>
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by customer"
            style={styles.searchInput}
          />
          {searchActive ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.iconButton} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={18} color={colors.text} />
        </Pressable>
      </View>

      {!searchActive && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsScroll} alwaysBounceHorizontal={false}>
          <ProductStatusPill label={`${total} total`} tone="neutral" />
          {statusFilter ? <ProductStatusPill label={statusFilter} tone="info" /> : null}
          {methodFilter ? <ProductStatusPill label={methodFilter} tone="warning" /> : null}
          {startDate ? <ProductStatusPill label={`From ${startDate}`} tone="neutral" /> : null}
          {endDate ? <ProductStatusPill label={`To ${endDate}`} tone="neutral" /> : null}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const statusAccent =
              item.status === "Delivered" ? "#10b981"
              : item.status === "Processing" ? "#f59e0b"
              : "#6366f1";
            return (
              <Pressable
                style={[styles.card, { borderLeftColor: statusAccent }]}
                onPress={() => router.push(`/orders/${item.id}`)}
              >
                {/* Top: invoice + amount + menu */}
                <View style={styles.cardTop}>
                  <View style={styles.invoiceRow}>
                    <Text style={styles.invoice}>#{item.invoiceNo}</Text>
                    <Pressable onPress={() => copyOrderNo(item.invoiceNo)} hitSlop={8} style={styles.copyBtn}>
                      <Ionicons name="copy-outline" size={13} color={colors.muted} />
                    </Pressable>
                  </View>
                  <View style={styles.cardTopRight}>
                    <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                    <Pressable style={styles.menuButton} onPress={() => openOrderMenu(item)}>
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>

                {/* Customer + time */}
                <View style={styles.cardMeta}>
                  <Ionicons name="person-outline" size={13} color={colors.muted} />
                  <Text style={styles.customer} numberOfLines={1}>{item.customerName}</Text>
                  <Text style={styles.dot}>·</Text>
                  <Text style={styles.time}>{formatDateTime(item.orderTime)}</Text>
                </View>

                {/* Status pills */}
                <View style={styles.pillRow}>
                  <OrderDot status={item.status} accent={statusAccent} />
                  {item.paymentStatus ? (
                    <StatusPill
                      label={item.paymentStatus}
                      bg={item.paymentStatus === "paid" ? "#dcfce7" : "#fef3c7"}
                      color={item.paymentStatus === "paid" ? "#166534" : "#92400e"}
                    />
                  ) : null}
                  <StatusPill label={item.method} bg="#ede9fe" color="#6d28d9" />
                  {item.shipments.length > 0 && (
                    <StatusPill
                      label={`${item.shipments.length} shipment${item.shipments.length > 1 ? "s" : ""}`}
                      bg="#fef3c7"
                      color="#92400e"
                    />
                  )}
                </View>
              </Pressable>
            );
          }}
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
              <Ionicons name="receipt-outline" size={36} color={colors.muted} />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptyText}>
                {filtersApplied ? "Try adjusting the filters." : "Recent sells will appear here."}
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
              <Text style={styles.modalTitle}>Order Filters</Text>
              <Pressable onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <FilterGroup
              title="Status"
              options={["", "Pending", "Processing", "Delivered"]}
              value={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterGroup
              title="Method"
              options={["", "Cash", "Card", "Online"]}
              value={methodFilter}
              onChange={(value) => setMethodFilter(value as MethodFilter)}
            />

            <View style={styles.dateGroup}>
              <Text style={styles.filterLabel}>Start date</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
              />
            </View>
            <View style={styles.dateGroup}>
              <Text style={styles.filterLabel}>End date</Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                style={styles.dateInput}
              />
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setStatusFilter("");
                  setMethodFilter("");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={async () => {
                  setFilterVisible(false);
                  await loadOrders(1, "reset");
                  await loadStats();
                }}
              >
                <Text style={styles.applyButtonText}>Apply</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function OrderDot({ status, accent }: { status: string; accent: string }) {
  return (
    <View style={[orderStyles.pill, { backgroundColor: accent + "22" }]}>
      <View style={[orderStyles.dot, { backgroundColor: accent }]} />
      <Text style={[orderStyles.pillText, { color: accent }]}>{status}</Text>
    </View>
  );
}

function StatusPill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <View style={[orderStyles.pill, { backgroundColor: bg }]}>
      <Text style={[orderStyles.pillText, { color }]}>{label}</Text>
    </View>
  );
}

const orderStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700" },
});

function ScrollViewRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", gap: 8 }}>
      {children}
    </ScrollView>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  return <ProductStatusPill label={`${label}: ${value}`} tone={tone} />;
}

function FilterGroup({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={styles.filterLabel}>{title}</Text>
      <View style={styles.filterOptions}>
        {options.map((option) => {
          const label = option || "All";
          const active = option === value;
          return (
            <Pressable
              key={`${title}-${label}`}
              style={[styles.filterChip, active ? styles.filterChipActive : null]}
              onPress={() => onChange(option)}
            >
              <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>
                {label}
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
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    fontWeight: "800",
  },
  statsRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
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
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
  },
  iconButton: {
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    padding: 16,
    paddingTop: 10,
    paddingBottom: 100,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
  },
  invoice: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
  },
  copyBtn: { padding: 2 },
  amount: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },
  menuButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  customer: {
    color: colors.muted,
    fontSize: 12,
    flex: 1,
  },
  dot: {
    color: colors.muted,
    fontSize: 12,
  },
  time: {
    color: colors.muted,
    fontSize: 11,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  meta: {
    color: colors.text,
    fontSize: 13,
  },
  statusRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
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
  filterGroup: {
    gap: 10,
  },
  filterLabel: {
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
    backgroundColor: colors.background,
    paddingHorizontal: 12,
    paddingVertical: 9,
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
  dateGroup: {
    gap: 8,
  },
  dateInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: colors.text,
    fontWeight: "800",
  },
  applyButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  applyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
