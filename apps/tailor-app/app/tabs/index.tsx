import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getTailorDashboard } from "@/services/tailor";
import type { TailorDashboardStats } from "@/types/tailor";
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/types/tailor";
import { TailorStatusBadge } from "@/components/tailor/TailorStatusBadge";
import { AccessDenied } from "@/components/AccessDenied";
import { colors } from "@/constants/theme";

const STAT_ITEMS = (stats: TailorDashboardStats, fmt: (n: number) => string) => [
  { icon: "today-outline",            label: "Today",       value: String(stats.todayOrders),        accent: "#7c3aed", bg: "#ede9fe" },
  { icon: "time-outline",             label: "Pending",     value: String(stats.pendingOrders),      accent: "#d97706", bg: "#fef3c7" },
  { icon: "checkmark-circle-outline", label: "Ready",       value: String(stats.readyForDelivery),   accent: "#16a34a", bg: "#dcfce7" },
  { icon: "car-outline",              label: "Delivered",   value: String(stats.deliveredOrders),    accent: "#059669", bg: "#d1fae5" },
  { icon: "trending-up-outline",      label: "Total Due",   value: fmt(stats.totalDue),              accent: "#dc2626", bg: "#fee2e2" },
  { icon: "warning-outline",          label: "Low Stock",   value: String(stats.lowStockFabrics),    accent: "#d97706", bg: "#fef3c7" },
  { icon: "people-outline",           label: "Dorjis",      value: String(stats.activeDorjis),       accent: "#7c3aed", bg: "#ede9fe" },
];

const NAV_ITEMS = [
  { icon: "layers-outline",     label: "Fabrics",      route: "/tailor/fabrics",      accent: "#7c3aed", bg: "#ede9fe" },
  { icon: "resize-outline",     label: "Measure",      route: "/tailor/measurements", accent: "#2563eb", bg: "#dbeafe" },
  { icon: "person-outline",     label: "Dorjis",       route: "/tailor/dorjis",       accent: "#16a34a", bg: "#dcfce7" },
  { icon: "git-branch-outline", label: "Assign",       route: "/tailor/assignments",  accent: "#d97706", bg: "#fef3c7" },
  { icon: "wallet-outline",     label: "Payments",     route: "/tailor/payments",     accent: "#dc2626", bg: "#fee2e2" },
  { icon: "list-outline",       label: "All Orders",   route: "/tailor",              accent: "#0891b2", bg: "#e0f2fe" },
] as const;

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const ini = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : name.slice(0, 2);
  return (
    <View style={s.avatar}>
      <Text style={s.avatarText}>{ini.toUpperCase()}</Text>
    </View>
  );
}

export default function TailorTab() {
  const { canRead } = useAuth();
  const { formatCurrency } = useCurrency();

  const [stats, setStats] = useState<TailorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getTailorDashboard();
      setStats(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (!canRead("TailorShop")) return <AccessDenied />;

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7c3aed" />}
      >
        {/* ── Hero Header ── */}
        <View style={s.hero}>
          <View style={s.heroLeft}>
            <Text style={s.heroSub}>Welcome back</Text>
            <Text style={s.heroTitle}>Tailor Shop</Text>
          </View>
          <TouchableOpacity
            style={s.newOrderBtn}
            onPress={() => router.push("/tailor/new" as any)}
            activeOpacity={0.85}
          >
            <View style={s.newOrderIcon}>
              <Ionicons name="add" size={18} color="#7c3aed" />
            </View>
            <Text style={s.newOrderText}>New Order</Text>
          </TouchableOpacity>
        </View>

        {loading && !refreshing ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color="#7c3aed" />
            <Text style={s.loadingText}>Loading dashboard…</Text>
          </View>
        ) : error ? (
          <View style={s.center}>
            <Ionicons name="alert-circle-outline" size={40} color="#dc2626" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : stats ? (
          <>
            {/* ── Stats Grid ── */}
            <View style={s.sectionWrap}>
              <Text style={s.sectionLabel}>Overview</Text>
              <View style={s.statsGrid}>
                {STAT_ITEMS(stats, formatCurrency).map((item) => (
                  <View key={item.label} style={[s.statCard, { borderLeftColor: item.accent }]}>
                    <View style={[s.statIconBox, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon as any} size={18} color={item.accent} />
                    </View>
                    <Text style={[s.statValue, { color: item.accent }]}>{item.value}</Text>
                    <Text style={s.statLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* ── Quick Nav ── */}
            <View style={s.sectionWrap}>
              <Text style={s.sectionLabel}>Manage</Text>
              <View style={s.navGrid}>
                {NAV_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.label}
                    style={s.navCard}
                    onPress={() => router.push(item.route as any)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.navIconCircle, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon} size={20} color={item.accent} />
                    </View>
                    <Text style={s.navLabel}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* ── Recent Orders ── */}
            <View style={s.sectionWrap}>
              <View style={s.sectionRow}>
                <Text style={s.sectionLabel}>Recent Orders</Text>
                <TouchableOpacity onPress={() => router.push("/tailor" as any)} style={s.seeAllBtn}>
                  <Text style={s.seeAllText}>See all</Text>
                  <Ionicons name="arrow-forward" size={13} color="#7c3aed" />
                </TouchableOpacity>
              </View>

              {stats.recentOrders.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="cut-outline" size={32} color={colors.muted} />
                  <Text style={s.emptyText}>No recent orders</Text>
                </View>
              ) : (
                <View style={s.ordersCard}>
                  {stats.recentOrders.slice(0, 5).map((order, idx) => (
                    <View key={order.id}>
                      {idx > 0 && <View style={s.divider} />}
                      <TouchableOpacity
                        style={s.orderRow}
                        onPress={() => router.push(`/tailor/${order.id}` as any)}
                        activeOpacity={0.75}
                      >
                        <Initials name={order.customer?.name ?? "?"} />
                        <View style={s.orderInfo}>
                          <Text style={s.orderNum}>{order.orderNumber}</Text>
                          <Text style={s.orderCustomer} numberOfLines={1}>
                            {order.customer?.name ?? "—"}
                          </Text>
                          {order.deliveryDate ? (
                            <Text style={s.orderDate}>
                              Due {new Date(order.deliveryDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </Text>
                          ) : null}
                        </View>
                        <View style={s.orderRight}>
                          <Text style={s.orderAmt}>{formatCurrency(order.totalAmount)}</Text>
                          <TailorStatusBadge
                            label={ORDER_STATUS_LABELS[order.orderStatus]}
                            color={ORDER_STATUS_COLORS[order.orderStatus]}
                            small
                          />
                        </View>
                        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },

  // Hero
  hero: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#7c3aed",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  heroLeft: { gap: 2 },
  heroSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: "600", letterSpacing: 0.5 },
  heroTitle: { fontSize: 26, fontWeight: "900", color: "#fff" },
  newOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  newOrderIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#ede9fe",
    alignItems: "center", justifyContent: "center",
  },
  newOrderText: { color: "#7c3aed", fontSize: 13, fontWeight: "800" },

  center: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 10 },
  loadingText: { color: colors.muted, fontSize: 13 },
  errorText: { color: "#dc2626", fontSize: 14, textAlign: "center", marginTop: 8 },

  // Section wrapper
  sectionWrap: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: "800", color: colors.muted,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
  },
  seeAllBtn: { flexDirection: "row", alignItems: "center", gap: 3 },
  seeAllText: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 4,
  },
  statIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 22, fontWeight: "900" },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },

  // Nav grid
  navGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  navCard: {
    flex: 1,
    minWidth: "28%",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  navIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
  },
  navLabel: { fontSize: 11, fontWeight: "700", color: colors.text, textAlign: "center" },

  // Orders
  ordersCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyCard: {
    backgroundColor: "#fff", borderRadius: 16,
    alignItems: "center", justifyContent: "center",
    paddingVertical: 32, gap: 8,
  },
  emptyText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  divider: { height: 1, backgroundColor: "#f1f5f9", marginLeft: 72 },
  orderRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#ede9fe",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "800", color: "#7c3aed" },
  orderInfo: { flex: 1, gap: 2 },
  orderNum: { fontSize: 13, fontWeight: "800", color: colors.text },
  orderCustomer: { fontSize: 12, color: colors.muted },
  orderDate: { fontSize: 11, color: "#d97706", fontWeight: "600" },
  orderRight: { alignItems: "flex-end", gap: 4 },
  orderAmt: { fontSize: 13, fontWeight: "800", color: colors.text },
});
