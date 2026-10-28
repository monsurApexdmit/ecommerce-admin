import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import { getTailorBoard } from "@/services/tailor"
import type { TailorBoardRow, TailorStage } from "@/types/tailor"
import { TailorOrderCard } from "@/components/tailor/TailorOrderCard"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const STATUS_FILTERS: { label: string; value: "open" | "all" | TailorStage }[] = [
  { label: "Open", value: "open" },
  { label: "Received", value: "new" },
  { label: "Cutting", value: "cutting" },
  { label: "Stitching", value: "stitching" },
  { label: "Trial", value: "trial" },
  { label: "Ready", value: "ready" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
]

function SkeletonList() {
  return (
    <View style={s.skeletonWrap}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={s.skeletonBox} />
      ))}
    </View>
  )
}

export default function TailorOrdersScreen() {
  const { canRead } = useAuth()
  const { formatCurrency } = useCurrency()

  const [orders, setOrders] = useState<TailorBoardRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<string, number>>>({})
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"open" | "all" | TailorStage>("open")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reqId = useRef(0)

  const fetchPage = useCallback(async (p: number) => {
    const id = ++reqId.current
    const r = await getTailorBoard({ status: filter, search: search.trim() || undefined, limit: 20, page: p })
    if (id !== reqId.current) return
    setOrders((prev) => (p === 1 ? r.orders : [...prev, ...r.orders]))
    setTotal(r.pagination.total)
    setPage(r.pagination.page)
    setLastPage(r.pagination.lastPage)
    setCounts(r.statusCounts)
    setBalance(r.stats.balanceToCollect)
  }, [filter, search])

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setLoading(true)
      fetchPage(1).catch(() => {}).finally(() => setLoading(false))
    }, 350)
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current) }
  }, [fetchPage])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchPage(1).catch(() => {}).finally(() => setRefreshing(false))
  }, [fetchPage])

  const loadMore = () => {
    if (page < lastPage && !loading && !loadingMore) {
      setLoadingMore(true)
      fetchPage(page + 1).catch(() => {}).finally(() => setLoadingMore(false))
    }
  }

  if (!canRead("TailorOrders")) return <AccessDenied />

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Purple hero header */}
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.heroTitle}>Orders</Text>
            <Text style={s.heroSub}>{total} order{total === 1 ? "" : "s"}{balance > 0 ? ` · ${formatCurrency(balance)} to collect` : ""}</Text>
          </View>
          <TouchableOpacity style={s.newBtn} onPress={() => router.push("/tailor/new")} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.newBtnText}>New Order</Text>
          </TouchableOpacity>
        </View>

        {/* Quick nav chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.navRow}>
          {([
            { label: "Fabrics",      icon: "layers-outline",    route: "/tailor/fabrics" },
            { label: "Measure",      icon: "resize-outline",    route: "/tailor/measurements" },
            { label: "Dorjis",       icon: "person-outline",    route: "/tailor/dorjis" },
            { label: "Assignments",  icon: "git-branch-outline",route: "/tailor/assignments" },
            { label: "Payments",     icon: "wallet-outline",    route: "/tailor/payments" },
          ] as const).map(item => (
            <TouchableOpacity key={item.label} style={s.navChip} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
              <Ionicons name={item.icon} size={14} color="#fff" />
              <Text style={s.navChipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name, order no..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[s.filterChip, filter === f.value && s.filterChipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.75}
          >
            <Text style={[s.filterChipText, filter === f.value && s.filterChipTextActive]}>
              {f.label}{f.value !== "all" && counts[f.value] != null ? ` ${counts[f.value]}` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* List */}
      {loading && orders.length === 0 ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <TailorOrderCard
              order={item}
              onPress={() => router.push(`/tailor/${item.id}`)}
              formatCurrency={(n) => formatCurrency(n)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            page < lastPage ? (
              <ActivityIndicator color={colors.primary} style={s.footerLoader} />
            ) : null
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="cut-outline" size={48} color={colors.muted} />
              <Text style={s.emptyText}>No orders found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/tailor/new")}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  hero: {
    backgroundColor: "#7c3aed",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  heroTitle: { fontSize: 24, fontWeight: "900", color: "#fff" },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  newBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  navRow: { gap: 8, paddingBottom: 2 },
  navChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)", paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
  },
  navChipText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 12,
    marginHorizontal: 14, marginTop: 12, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  filterScroll: { flexGrow: 0, marginTop: 8, marginBottom: 4 },
  filterContent: { paddingHorizontal: 14, gap: 8, paddingBottom: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  filterChipTextActive: { color: "#fff", fontWeight: "700" },
  listContent: { padding: 14, paddingBottom: 24 },
  skeletonWrap: { padding: 14, gap: 10 },
  skeletonBox: { height: 100, borderRadius: 16, backgroundColor: "#e2e8f0" },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  footerLoader: { marginVertical: 16 },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
})
