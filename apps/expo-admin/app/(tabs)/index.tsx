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
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { getDashboardStats, getRecentOrders } from "@/services/dashboard";
import { formatCompactDate } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
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
  color: string;
  bg: string;
}[] = [
  { label: "Products",  icon: "cube-outline",          route: "/(tabs)/products", color: colors.primaryDark, bg: "#ecfdf5" },
  { label: "Orders",    icon: "receipt-outline",        route: "/(tabs)/orders",   color: "#1d4ed8",          bg: "#eff6ff" },
  { label: "Inventory", icon: "layers-outline",         route: "/inventory/",      color: "#92400e",          bg: "#fffbeb" },
  { label: "Customers", icon: "people-outline",         route: "/customers/",      color: "#6d28d9",          bg: "#f5f3ff" },
  { label: "POS",       icon: "cart-outline",           route: "/(tabs)/pos",      color: "#0e7490",          bg: "#ecfeff" },
  { label: "Support",   icon: "headset-outline",        route: "/support",         color: "#be185d",          bg: "#fdf2f8" },
];

export default function DashboardTab() {
  const router = useRouter();
  const { user, company } = useAuth();
  const { unreadCount } = useNotifications();
  const { formatCurrency } = useCurrency();

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
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#fff"
          />
        }
      >
        {/* ── Header Hero ── */}
        <LinearGradient
          colors={["#047857", "#065f46", "#064e3b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles for depth */}
          <View style={styles.heroBubble1} />
          <View style={styles.heroBubble2} />
          {/* Top row: company + notif */}
          <View style={styles.heroTopRow}>
            <View style={styles.companyPill}>
              <View style={styles.companyDot} />
              <Text style={styles.companyName} numberOfLines={1}>
                {company?.name ?? "Dashboard"}
              </Text>
            </View>
            <Pressable
              style={styles.notifBtn}
              onPress={() => router.push("/notifications")}
              hitSlop={8}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              {unreadCount > 0 ? (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          {/* Greeting */}
          <Text style={styles.greeting}>
            {getGreeting()}, {firstName} 👋
          </Text>
          <Text style={styles.date}>{formatDate()}</Text>

          {/* Revenue highlight */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueLeft}>
              <Text style={styles.revenueLabel}>Total Revenue</Text>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" style={{ marginTop: 4 }} />
              ) : (
                <Text style={styles.revenueValue}>
                  {stats ? formatCurrency(stats.totalRevenue) : "—"}
                </Text>
              )}
              <Text style={styles.revenueSub}>All time earnings</Text>
            </View>
            <View style={styles.revenueIconWrap}>
              <Ionicons name="trending-up-outline" size={32} color="rgba(255,255,255,0.35)" />
            </View>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primaryDark} size="large" />
          </View>
        ) : (
          <>
            {/* ── Mini stat row ── */}
            <View style={styles.miniStatRow}>
              <MiniStat
                label="Total Orders"
                value={stats ? String(stats.totalSells) : "—"}
                icon="receipt-outline"
                color="#1d4ed8"
                bg="#eff6ff"
              />
              <View style={styles.miniStatDivider} />
              <MiniStat
                label="Pending"
                value={stats ? String(stats.pendingCount) : "—"}
                icon="time-outline"
                color="#92400e"
                bg="#fffbeb"
              />
              <View style={styles.miniStatDivider} />
              <MiniStat
                label="Delivered"
                value={stats ? String(stats.deliveredCount) : "—"}
                icon="checkmark-circle-outline"
                color={colors.primaryDark}
                bg="#ecfdf5"
              />
            </View>

            {/* ── Processing alert ── */}
            {stats && stats.processingCount > 0 ? (
              <Pressable
                style={styles.alertBanner}
                onPress={() => router.push("/(tabs)/orders")}
              >
                <View style={styles.alertIconWrap}>
                  <Ionicons name="flash-outline" size={16} color="#d97706" />
                </View>
                <Text style={styles.alertText}>
                  {stats.processingCount} order{stats.processingCount > 1 ? "s" : ""} currently processing
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#92400e" />
              </Pressable>
            ) : null}

            {/* ── Quick Access ── */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Access</Text>
              <View style={styles.quickGrid}>
                {QUICK_LINKS.map((link) => (
                  <Pressable
                    key={link.label}
                    style={[styles.quickCard, { backgroundColor: link.bg }]}
                    onPress={() => router.push(link.route as any)}
                  >
                    <View style={[styles.quickIconWrap, { backgroundColor: link.color + "18" }]}>
                      <Ionicons name={link.icon} size={22} color={link.color} />
                    </View>
                    <Text style={[styles.quickLabel, { color: link.color }]} numberOfLines={1}>
                      {link.label}
                    </Text>
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
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="receipt-outline" size={28} color={colors.muted} />
                  </View>
                  <Text style={styles.emptyTitle}>No orders yet</Text>
                  <Text style={styles.emptyText}>Orders will appear here when placed</Text>
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
                      {/* Order number circle */}
                      <View style={styles.orderNumWrap}>
                        <Text style={styles.orderNum}>{String(idx + 1).padStart(2, "0")}</Text>
                      </View>

                      {/* Invoice + customer */}
                      <View style={styles.orderLeft}>
                        <Text style={styles.orderInvoice} numberOfLines={1}>
                          #{order.invoiceNo}
                        </Text>
                        <Text style={styles.orderCustomer} numberOfLines={1}>
                          {order.customerName}
                        </Text>
                        <View style={styles.orderMeta}>
                          <Ionicons name="time-outline" size={11} color={colors.muted} />
                          <Text style={styles.orderDate}>{formatCompactDate(order.orderTime)}</Text>
                        </View>
                      </View>

                      {/* Amount + status */}
                      <View style={styles.orderRight}>
                        <Text style={styles.orderAmount}>{formatCurrency(order.amount)}</Text>
                        <OrderStatusPill status={order.status} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <View style={{ height: 8 }} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── MiniStat ──────────────────────────────────────────────────────────

function MiniStat({
  label, value, icon, color, bg,
}: {
  label: string; value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; bg: string;
}) {
  return (
    <View style={styles.miniStat}>
      <View style={[styles.miniStatIcon, { backgroundColor: bg }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.miniStatValue, { color }]}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { paddingBottom: 40, gap: 0 },

  // Hero
  hero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 4,
    overflow: "hidden",
  },
  heroBubble1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -60,
    right: -50,
  },
  heroBubble2: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0,0,0,0.08)",
    bottom: -20,
    left: 30,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  companyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  companyDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#6ee7b7",
  },
  companyName: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#047857",
  },
  notifBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  greeting: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  date: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    marginBottom: 16,
  },

  // Revenue card inside hero
  revenueCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    marginTop: 4,
  },
  revenueLeft: { gap: 2 },
  revenueLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  revenueValue: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 40,
  },
  revenueSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 11,
  },
  revenueIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Mini stats
  miniStatRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    marginTop: -14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 4,
  },
  miniStat: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  miniStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  miniStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  miniStatValue: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  miniStatLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },

  // Alert
  alertBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  alertIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    alignItems: "center",
    justifyContent: "center",
  },
  alertText: {
    flex: 1,
    color: "#92400e",
    fontSize: 13,
    fontWeight: "600",
  },

  // Loading
  loadingWrap: {
    paddingVertical: 60,
    alignItems: "center",
  },

  // Sections
  section: {
    paddingHorizontal: 16,
    marginTop: 22,
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

  // Quick access — 3-column grid
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  quickCard: {
    width: "30.5%",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "transparent",
  },
  quickIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },

  // Recent orders
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 10,
  },
  orderCardLast: { borderBottomWidth: 0 },
  orderNumWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  orderNum: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
  },
  orderLeft: { flex: 1, gap: 2 },
  orderInvoice: { color: colors.text, fontSize: 13, fontWeight: "800" },
  orderCustomer: { color: colors.muted, fontSize: 12 },
  orderMeta: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  orderDate: { color: colors.muted, fontSize: 11 },
  orderRight: { alignItems: "flex-end", gap: 5 },
  orderAmount: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" },

  // Empty state
  emptyOrders: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  emptyText: { color: colors.muted, fontSize: 13 },
});
