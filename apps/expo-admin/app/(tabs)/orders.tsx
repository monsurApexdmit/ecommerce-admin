import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { apiErrorMessage, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import { deleteOrder, getOrders } from "@/services/order-service";
import type { Order, OrderKpis, OrderTab, OrderTabCounts } from "@/types/order";
import { ProductStatusPill } from "@/components/products/ProductStatusPill";
import { FollowUpSheet } from "@/components/orders/FollowUpSheet";
import {
  ORDER_TABS,
  STAGE_COLOR,
  canFollowUp,
  followUpSummary,
  orderPhone,
  orderStage,
  runStageAction,
  stageActions,
  telUrl,
} from "@/components/orders/order-utils";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

const METHOD_OPTIONS = ["", "Cash", "Card", "Online", "COD", "bKash", "Nagad", "Bank"];
const PAYMENT_OPTIONS = ["", "paid", "partial", "unpaid"];
const SOURCE_OPTIONS = ["", "sales", "pos", "online"];
const PAGE_SIZE = 20;

const optionLabel = (v: string) =>
  v === "" ? "All" : v === "pos" ? "POS" : v.charAt(0).toUpperCase() + v.slice(1);

export default function OrdersTab() {
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const { canRead, canWrite, canDelete } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [kpis, setKpis] = useState<OrderKpis | null>(null);
  const [tabCounts, setTabCounts] = useState<OrderTabCounts>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<OrderTab>("all");
  const [dueOnly, setDueOnly] = useState(false);
  const [methodFilter, setMethodFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<Order | null>(null);
  const searchActive = search.trim().length > 0;
  const requestId = useRef(0);
  const params = useLocalSearchParams<{ followUp?: string; status?: string }>();

  // Deep links from the dashboard: ?followUp=due or ?status=pending
  useEffect(() => {
    if (params.followUp === "due") setDueOnly(true);
    const st = String(params.status ?? "").toLowerCase();
    if (st && ORDER_TABS.some((t) => t.value === st)) setTab(st as OrderTab);
  }, [params.followUp, params.status]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const loadOrders = useCallback(
    async (nextPage: number, mode: "reset" | "append") => {
      const id = ++requestId.current;
      const result = await getOrders({
        page: nextPage,
        perPage: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: tab !== "all" ? tab : undefined,
        followUp: dueOnly ? "due" : undefined,
        method: methodFilter || undefined,
        payment: paymentFilter || undefined,
        source: sourceFilter || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (id !== requestId.current) return; // a newer filter won

      setOrders((current) => (mode === "append" ? [...current, ...result.data] : result.data));
      setPage(result.page);
      setTotal(result.total);
      setHasNext(result.lastPage != null ? result.page < result.lastPage : result.page * result.limit < result.total);
      if (result.tabCounts) setTabCounts(result.tabCounts);
      if (result.kpis) setKpis(result.kpis);
    },
    [debouncedSearch, tab, dueOnly, methodFilter, paymentFilter, sourceFilter, startDate, endDate],
  );

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await loadOrders(1, "reset");
    } catch (err) {
      Alert.alert("Could not load orders", apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [loadOrders]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) { firstFocus.current = false; return; }
      void loadOrders(1, "reset").catch(() => undefined);
    }, [loadOrders])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadOrders(1, "reset");
    } catch (err) {
      Alert.alert("Could not load orders", apiErrorMessage(err));
    } finally {
      setRefreshing(false);
    }
  }, [loadOrders]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;

    try {
      setLoadingMore(true);
      await loadOrders(page + 1, "append");
    } catch {
      // keep what is shown; pull to refresh retries
    } finally {
      setLoadingMore(false);
    }
  }, [hasNext, loadingMore, loading, loadOrders, page]);

  const filtersApplied = useMemo(
    () => Boolean(methodFilter || paymentFilter || sourceFilter || startDate || endDate),
    [methodFilter, paymentFilter, sourceFilter, startDate, endDate],
  );

  if (!canRead('Orders')) return <AccessDenied />;

  const refreshAfterChange = () => { void loadOrders(1, "reset").catch(() => undefined); };

  const copyOrderNo = (invoiceNo: string) => {
    void Clipboard.setStringAsync(invoiceNo);
    if (Platform.OS === "android") {
      ToastAndroid.show("Order number copied", ToastAndroid.SHORT);
    } else {
      Alert.alert("Copied", `#${invoiceNo} copied to clipboard`);
    }
  };

  const callCustomer = (order: Order) => {
    const phone = orderPhone(order);
    if (!phone) return;
    Linking.openURL(telUrl(phone)).catch(() => Alert.alert("Cannot start a call", `Dial ${phone} manually.`));
  };

  const confirmDelete = (order: Order) => {
    Alert.alert("Delete order", `Delete #${order.invoiceNo}? Only cancelled orders without payments or returns can be deleted.`, [
      { text: "Back", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteOrder(order.id);
            refreshAfterChange();
          } catch (err) {
            Alert.alert("Could not delete", apiErrorMessage(err));
          }
        },
      },
    ]);
  };

  const openOrderMenu = (order: Order) => {
    const buttons: { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[] = [
      { text: "View", onPress: () => router.push(`/orders/${order.id}`) },
    ];
    if (canWrite("Orders") && canFollowUp(order)) {
      buttons.push({ text: "Follow up", onPress: () => setFollowUpTarget(order) });
    }
    if (canWrite("Orders")) {
      for (const action of stageActions(order)) {
        buttons.push({
          text: action.label,
          style: action.destructive ? "destructive" : "default",
          onPress: () => { void runStageAction(order, action).then((r) => { if (r) refreshAfterChange(); }); },
        });
      }
    }
    buttons.push({ text: "Copy order #", onPress: () => copyOrderNo(order.invoiceNo) });
    if (canDelete("Orders") && order.status === "Cancelled") {
      buttons.push({ text: "Delete", style: "destructive", onPress: () => confirmDelete(order) });
    }
    buttons.push({ text: "Close", style: "cancel" });
    Alert.alert(`#${order.invoiceNo}`, "Choose an action", buttons);
  };

  const changeTab = (next: OrderTab) => { setTab(next); };
  const followUpDue = tabCounts.followUpDue;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={[styles.header, searchActive && { paddingTop: 12 }]}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Orders</Text>
          {!searchActive && (
            <Text style={styles.subtitle} numberOfLines={1}>
              Confirm, follow up, pack and ship orders
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
            <StatChip label="Total" value={kpis ? String(kpis.totalOrders) : "—"} tone="info" />
            <StatChip label="Pending" value={kpis ? String(kpis.pending) : "—"} tone="warning" />
            <StatChip label="Confirmed/packed" value={kpis ? String(kpis.confirmedOrPacked) : "—"} tone="info" />
            <StatChip label="Shipped" value={kpis ? String(kpis.shipped) : "—"} tone="neutral" />
            <StatChip label="Delivered" value={kpis ? String(kpis.delivered) : "—"} tone="success" />
            <StatChip label="Revenue" value={kpis ? formatCurrency(kpis.revenue) : "—"} tone="neutral" />
            <StatChip label="Due" value={kpis ? formatCurrency(kpis.dueToCollect) : "—"} tone="danger" />
          </ScrollViewRow>
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Customer, phone or invoice"
            style={styles.searchInput}
          />
          {searchActive ? (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable style={[styles.iconButton, filtersApplied && styles.iconButtonActive]} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={18} color={filtersApplied ? colors.primaryDark : colors.text} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsScroll} alwaysBounceHorizontal={false}>
        <Pressable
          style={[styles.tabChip, dueOnly && styles.dueChipActive]}
          onPress={() => setDueOnly((v) => !v)}
        >
          <Ionicons name="call-outline" size={13} color={dueOnly ? "#fff" : (followUpDue ?? 0) > 0 ? colors.danger : colors.muted} />
          <Text style={[styles.tabChipText, dueOnly && { color: "#fff" }]}>Follow-up due</Text>
          {followUpDue != null ? (
            <View style={[styles.countBadge, dueOnly ? { backgroundColor: "rgba(255,255,255,0.25)" } : (followUpDue > 0 ? { backgroundColor: "#fee2e2" } : null)]}>
              <Text style={[styles.countBadgeText, dueOnly ? { color: "#fff" } : followUpDue > 0 ? { color: colors.danger } : null]}>{followUpDue}</Text>
            </View>
          ) : null}
        </Pressable>
        {ORDER_TABS.map((t) => {
          const active = tab === t.value;
          const count = tabCounts[t.value];
          return (
            <Pressable key={t.value} style={[styles.tabChip, active && styles.tabChipActive]} onPress={() => changeTab(t.value)}>
              <Text style={[styles.tabChipText, active && styles.tabChipTextActive]}>{t.label}</Text>
              {count != null ? (
                <View style={[styles.countBadge, active && { backgroundColor: "#d1fae5" }]}>
                  <Text style={[styles.countBadgeText, active && { color: colors.primaryDark }]}>{count}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {filtersApplied ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterPills} contentContainerStyle={styles.chipsScroll}>
          <ProductStatusPill label={`${total} found`} tone="neutral" />
          {methodFilter ? <ProductStatusPill label={methodFilter} tone="warning" /> : null}
          {paymentFilter ? <ProductStatusPill label={optionLabel(paymentFilter)} tone="info" /> : null}
          {sourceFilter ? <ProductStatusPill label={optionLabel(sourceFilter)} tone="info" /> : null}
          {startDate ? <ProductStatusPill label={`From ${startDate}`} tone="neutral" /> : null}
          {endDate ? <ProductStatusPill label={`To ${endDate}`} tone="neutral" /> : null}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const stage = orderStage(item);
            const statusAccent = STAGE_COLOR[stage];
            const followable = canFollowUp(item);
            const fu = followable || (Number(item.followUpCount) || 0) > 0 ? followUpSummary(item) : null;
            const phone = orderPhone(item);
            const paid = String(item.paymentStatus ?? "").toLowerCase();
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
                    <Pressable style={styles.menuButton} onPress={() => openOrderMenu(item)} hitSlop={6}>
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
                  <OrderDot status={stage} accent={statusAccent} />
                  {item.paymentStatus ? (
                    <StatusPill
                      label={item.paymentStatus}
                      bg={paid === "paid" ? "#dcfce7" : "#fef3c7"}
                      color={paid === "paid" ? "#166534" : "#92400e"}
                    />
                  ) : null}
                  <StatusPill label={item.method} bg="#ede9fe" color="#6d28d9" />
                  {item.source === "pos" ? <StatusPill label="POS" bg="#e0f2fe" color="#0369a1" /> : null}
                  {item.shipments.length > 0 && (
                    <StatusPill
                      label={`${item.shipments.length} shipment${item.shipments.length > 1 ? "s" : ""}`}
                      bg="#fef3c7"
                      color="#92400e"
                    />
                  )}
                </View>

                {/* Follow-up line + quick actions */}
                {fu || followable ? (
                  <View style={styles.followRow}>
                    {fu ? (
                      <Text style={[styles.followText, fu.overdue && styles.followTextOverdue]} numberOfLines={1}>
                        {fu.text}{fu.overdue ? " (overdue)" : ""}
                      </Text>
                    ) : <View style={{ flex: 1 }} />}
                    {followable && phone ? (
                      <Pressable style={styles.followIconBtn} onPress={() => callCustomer(item)} hitSlop={6}>
                        <Ionicons name="call-outline" size={15} color={colors.primaryDark} />
                      </Pressable>
                    ) : null}
                    {followable && canWrite("Orders") ? (
                      <Pressable style={styles.followBtn} onPress={() => setFollowUpTarget(item)}>
                        <Ionicons name="chatbox-ellipses-outline" size={13} color={colors.primaryDark} />
                        <Text style={styles.followBtnText}>Follow up</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
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
                {dueOnly ? "No calls are due right now." : filtersApplied || tab !== "all" ? "Try another tab or adjust the filters." : "Recent sells will appear here."}
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <FollowUpSheet
        order={followUpTarget}
        onClose={() => setFollowUpTarget(null)}
        onSaved={() => refreshAfterChange()}
      />

      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)}>
          <Pressable style={styles.modalSheet} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Filters</Text>
              <Pressable onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 18 }}>
              <FilterGroup
                title="Payment"
                options={PAYMENT_OPTIONS}
                value={paymentFilter}
                onChange={setPaymentFilter}
              />
              <FilterGroup
                title="Source"
                options={SOURCE_OPTIONS}
                value={sourceFilter}
                onChange={setSourceFilter}
              />
              <FilterGroup
                title="Method"
                options={METHOD_OPTIONS}
                value={methodFilter}
                onChange={setMethodFilter}
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
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => {
                  setMethodFilter("");
                  setPaymentFilter("");
                  setSourceFilter("");
                  setStartDate("");
                  setEndDate("");
                }}
              >
                <Text style={styles.secondaryButtonText}>Reset</Text>
              </Pressable>
              <Pressable
                style={styles.applyButton}
                onPress={() => setFilterVisible(false)}
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
          const label = optionLabel(option);
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
  iconButtonActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabChipActive: {
    borderColor: colors.primaryDark,
    backgroundColor: "#ecfdf5",
  },
  dueChipActive: {
    borderColor: colors.danger,
    backgroundColor: colors.danger,
  },
  tabChipText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
  tabChipTextActive: {
    color: colors.primaryDark,
  },
  countBadge: {
    minWidth: 20,
    borderRadius: 999,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 1,
    alignItems: "center",
  },
  countBadgeText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  filterPills: {
    height: 36,
    flexGrow: 0,
  },
  followRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  followText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
  },
  followTextOverdue: {
    color: colors.danger,
    fontWeight: "700",
  },
  followIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryDark + "44",
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primaryDark + "44",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  followBtnText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "700",
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
