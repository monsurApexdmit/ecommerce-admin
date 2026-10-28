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
import { getTailorDashboardData, tailorApiError } from "@/services/tailor";
import type { TailorDashboardData, TailorKpi } from "@/types/tailor";
import { TAILOR_STAGE_COLORS, TAILOR_STAGE_LABEL } from "@/types/tailor";
import { TailorStatusBadge } from "@/components/tailor/TailorStatusBadge";
import { TONE_COLORS, kpiIcon, whenText } from "@/components/tailor/tailorHelpers";
import { AccessDenied } from "@/components/AccessDenied";
import { colors } from "@/constants/theme";

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

  const [stats, setStats] = useState<TailorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getTailorDashboardData();
      setStats(data);
    } catch (e: any) {
      setError(tailorApiError(e, "Failed to load dashboard"));
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

  if (!canRead("TailorDashboard")) return <AccessDenied />;

  const fmtKpi = (k: TailorKpi) =>
    k.kind === "money" ? formatCurrency(Number(k.value) || 0) : k.kind === "int" ? String(Math.round(Number(k.value) || 0)) : String(k.value);

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
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
            {/* ── KPI Grid ── */}
            <View style={s.sectionWrap}>
              <Text style={s.sectionLabel}>Overview</Text>
              <View style={s.statsGrid}>
                {stats.kpis.map((k) => {
                  const tone = TONE_COLORS[k.tone] ?? TONE_COLORS.purple;
                  const subTone = k.subTone && k.subTone !== "muted" ? TONE_COLORS[k.subTone]?.fg : colors.muted;
                  return (
                    <View key={k.label} style={[s.statCard, { borderLeftColor: tone.fg }]}>
                      <View style={[s.statIconBox, { backgroundColor: tone.bg }]}>
                        <Ionicons name={kpiIcon(k.label) as any} size={18} color={tone.fg} />
                      </View>
                      <Text style={[s.statValue, { color: tone.fg }]} numberOfLines={1} adjustsFontSizeToFit>{fmtKpi(k)}</Text>
                      <Text style={s.statLabel}>{k.label}</Text>
                      {k.sub ? <Text style={[s.statSub, { color: subTone }]} numberOfLines={1}>{k.sub}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>

            {stats.advice ? (
              <View style={s.sectionWrap}>
                <View style={s.adviceCard}>
                  <Ionicons name="bulb-outline" size={18} color="#7c3aed" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.adviceHead}>{stats.advice.head}</Text>
                    <Text style={s.adviceBody}>{stats.advice.body}</Text>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Production board ── */}
            {stats.has_orders && (
              <View style={s.sectionWrap}>
                <Text style={s.sectionLabel}>Production board</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {stats.board.map((col) => (
                    <View key={col.key} style={s.boardCol}>
                      <View style={s.boardHead}>
                        <View style={[s.boardDot, { backgroundColor: TAILOR_STAGE_COLORS[col.key] ?? "#94a3b8" }]} />
                        <Text style={s.boardTitle}>{TAILOR_STAGE_LABEL[col.key] ?? col.label}</Text>
                        <Text style={s.boardCount}>{col.count}</Text>
                      </View>
                      {col.orders.length === 0 ? (
                        <Text style={s.boardEmpty}>Nothing here</Text>
                      ) : col.orders.slice(0, 5).map((o) => {
                        const w = whenText(o.days_left, col.key);
                        return (
                          <TouchableOpacity key={o.id} style={s.boardCard} onPress={() => router.push(`/tailor/${o.id}` as any)} activeOpacity={0.8}>
                            <Text style={s.boardNo}>{o.order_no}{o.urgent ? "  · URGENT" : ""}</Text>
                            <Text style={s.boardCust} numberOfLines={1}>{o.customer}</Text>
                            <Text style={s.boardMeta} numberOfLines={1}>{o.items}</Text>
                            <Text style={s.boardMeta} numberOfLines={1}>{o.dorji ? `Dorji: ${o.dorji}` : "No dorji"}</Text>
                            {o.delivery_date ? <Text style={[s.boardMeta, { color: w.color, fontWeight: "700" }]}>{w.text}</Text> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {stats.fabric_alerts.length > 0 && (
              <View style={s.sectionWrap}>
                <Text style={s.sectionLabel}>Fabric alerts</Text>
                <View style={s.ordersCard}>
                  {stats.fabric_alerts.slice(0, 5).map((f, idx) => (
                    <View key={f.id}>
                      {idx > 0 && <View style={s.divider} />}
                      <TouchableOpacity style={s.orderRow} onPress={() => router.push("/tailor/fabrics" as any)} activeOpacity={0.75}>
                        <Ionicons name="layers-outline" size={18} color={f.out ? "#dc2626" : "#d97706"} />
                        <View style={s.orderInfo}>
                          <Text style={s.orderNum}>{f.name}{f.color ? ` · ${f.color}` : ""}</Text>
                          <Text style={s.orderCustomer}>{f.out ? "Out of stock" : `${f.stock} ${f.unit ?? ""} left · reorder at ${f.reorder_level}`}</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

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

              {stats.recent_orders.length === 0 ? (
                <View style={s.emptyCard}>
                  <Ionicons name="cut-outline" size={32} color={colors.muted} />
                  <Text style={s.emptyText}>No recent orders</Text>
                </View>
              ) : (
                <View style={s.ordersCard}>
                  {stats.recent_orders.slice(0, 5).map((order, idx) => (
                    <View key={order.id}>
                      {idx > 0 && <View style={s.divider} />}
                      <TouchableOpacity
                        style={s.orderRow}
                        onPress={() => router.push(`/tailor/${order.id}` as any)}
                        activeOpacity={0.75}
                      >
                        <Initials name={order.customer || "?"} />
                        <View style={s.orderInfo}>
                          <Text style={s.orderNum}>{order.order_no}</Text>
                          <Text style={s.orderCustomer} numberOfLines={1}>
                            {order.customer || "—"}
                          </Text>
                        </View>
                        <View style={s.orderRight}>
                          <Text style={s.orderAmt}>{formatCurrency(Number(order.total) || 0)}</Text>
                          <TailorStatusBadge
                            label={TAILOR_STAGE_LABEL[order.stage] ?? order.stage_label}
                            color={TAILOR_STAGE_COLORS[order.stage] ?? "#94a3b8"}
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
  statSub: { fontSize: 10, fontWeight: "600" },
  adviceCard: { flexDirection: "row", gap: 10, backgroundColor: "#f5f3ff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#ddd6fe" },
  adviceHead: { fontSize: 13, fontWeight: "800", color: colors.text },
  adviceBody: { fontSize: 12, color: colors.muted, marginTop: 2 },
  boardCol: { width: 200, backgroundColor: "#fff", borderRadius: 14, padding: 10, gap: 8 },
  boardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  boardDot: { width: 8, height: 8, borderRadius: 4 },
  boardTitle: { flex: 1, fontSize: 13, fontWeight: "800", color: colors.text },
  boardCount: { fontSize: 12, fontWeight: "800", color: colors.muted },
  boardEmpty: { fontSize: 12, color: colors.muted, paddingVertical: 6 },
  boardCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 8, gap: 2, backgroundColor: "#f8fafc" },
  boardNo: { fontSize: 12, fontWeight: "800", color: "#7c3aed" },
  boardCust: { fontSize: 13, fontWeight: "700", color: colors.text },
  boardMeta: { fontSize: 11, color: colors.muted },

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
