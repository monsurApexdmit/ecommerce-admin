import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { StatCard } from "@/components/StatCard";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { getDashboardStats, getRecentOrders } from "@/services/dashboard";
import { formatCurrency, formatCompactDate } from "@/lib/format";
import type { DashboardStats } from "@/types/dashboard";
import type { Order } from "@/types/order";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const QUICK_LINKS: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  tone: string;
  bg: string;
}[] = [
  { label: "Products",  icon: "cube-outline",    route: "/(tabs)/products",  tone: colors.primaryDark, bg: "#ecfdf5" },
  { label: "Orders",    icon: "receipt-outline",  route: "/(tabs)/orders",    tone: "#1d4ed8",          bg: "#eff6ff" },
  { label: "Inventory", icon: "layers-outline",   route: "/inventory/",       tone: "#92400e",          bg: "#fffbeb" },
  { label: "Customers", icon: "people-outline",   route: "/customers/",       tone: "#6d28d9",          bg: "#f5f3ff" },
];

export default function DashboardTab() {
  const router = useRouter();
  const { user, company } = useAuth();
  const { unreadCount } = useNotifications();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async () => {
    const [nextStats, nextOrders] = await Promise.allSettled([
      getDashboardStats(),
      getRecentOrders(5),
    ]);
    if (nextStats.status === "fulfilled") setStats(nextStats.value);
    if (nextOrders.status === "fulfilled") setRecentOrders(nextOrders.value);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }, [loadAll]);

  const firstName = user?.fullName?.split(" ")[0] ?? "Admin";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primaryDark}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.kicker}>{company?.name ?? "Dashboard"}</Text>
            <Text style={styles.greeting}>
              {getGreeting()}, {firstName} 👋
            </Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <Pressable
            style={styles.notifButton}
            onPress={() => router.push("/notifications")}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {unreadCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primaryDark} size="large" />
          </View>
        ) : (
          <>
            {/* ── Stats grid ── */}
            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <StatCard
                  label="Revenue"
                  value={stats ? formatCurrency(stats.totalRevenue) : "—"}
                  tone="primary"
                  icon="cash-outline"
                />
                <StatCard
                  label="Total Orders"
                  value={stats ? String(stats.totalSells) : "—"}
                  tone="info"
                  icon="receipt-outline"
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  label="Pending"
                  value={stats ? String(stats.pendingCount) : "—"}
                  tone="warning"
                  icon="time-outline"
                />
                <StatCard
                  label="Delivered"
                  value={stats ? String(stats.deliveredCount) : "—"}
                  tone="primary"
                  icon="checkmark-circle-outline"
                />
              </View>
            </View>

            {/* ── Processing alert ── */}
            {stats && stats.processingCount > 0 ? (
              <Pressable
                style={styles.alertBanner}
                onPress={() => router.push("/(tabs)/orders")}
              >
                <View style={styles.alertDot} />
                <Text style={styles.alertText}>
                  {stats.processingCount} order{stats.processingCount > 1 ? "s" : ""} currently processing
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#92400e" />
              </Pressable>
            ) : null}

            {/* ── Quick access ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Access</Text>
              <View style={styles.quickGrid}>
                {QUICK_LINKS.map((link) => (
                  <Pressable
                    key={link.label}
                    style={[styles.quickCard, { backgroundColor: link.bg }]}
                    onPress={() => router.push(link.route as any)}
                  >
                    <View style={[styles.quickIconWrap, { backgroundColor: link.tone + "22" }]}>
                      <Ionicons name={link.icon} size={22} color={link.tone} />
                    </View>
                    <Text style={[styles.quickLabel, { color: link.tone }]}>{link.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* ── Recent Orders ── */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Orders</Text>
                <Pressable onPress={() => router.push("/(tabs)/orders")} hitSlop={8}>
                  <Text style={styles.seeAll}>See all →</Text>
                </Pressable>
              </View>

              {recentOrders.length === 0 ? (
                <View style={styles.emptyOrders}>
                  <Ionicons name="receipt-outline" size={28} color={colors.muted} />
                  <Text style={styles.emptyText}>No recent orders</Text>
                </View>
              ) : (
                <View style={styles.orderList}>
                  {recentOrders.map((order, idx) => (
                    <Pressable
                      key={order.id}
                      style={[
                        styles.orderCard,
                        idx === recentOrders.length - 1 ? styles.orderCardLast : null,
                      ]}
                      onPress={() => router.push(`/orders/${order.id}` as any)}
                    >
                      {/* Left: invoice + customer */}
                      <View style={styles.orderLeft}>
                        <Text style={styles.orderInvoice}>#{order.invoiceNo}</Text>
                        <Text style={styles.orderCustomer} numberOfLines={1}>
                          {order.customerName}
                        </Text>
                        <Text style={styles.orderDate}>{formatCompactDate(order.orderTime)}</Text>
                      </View>

                      {/* Right: amount + status */}
                      <View style={styles.orderRight}>
                        <Text style={styles.orderAmount}>{formatCurrency(order.amount)}</Text>
                        <OrderStatusPill status={order.status} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
    gap: 20,
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  greeting: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  date: {
    color: colors.muted,
    fontSize: 13,
  },
  notifButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    position: "relative",
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },

  // ── Loading ──
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Stats ──
  statsGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },

  // ── Alert banner ──
  alertBanner: {
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#d97706",
  },
  alertText: {
    flex: 1,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Sections ──
  section: {
    paddingHorizontal: 20,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
  },
  seeAll: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },

  // ── Quick access ──
  quickGrid: {
    flexDirection: "row",
    gap: 12,
  },
  quickCard: {
    flex: 1,
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 10,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Recent orders ──
  orderList: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  orderCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  orderCardLast: {
    borderBottomWidth: 0,
  },
  orderLeft: {
    flex: 1,
    gap: 3,
  },
  orderInvoice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  orderCustomer: {
    color: colors.muted,
    fontSize: 13,
  },
  orderDate: {
    color: colors.muted,
    fontSize: 12,
  },
  orderRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  orderAmount: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyOrders: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 14,
  },
});
