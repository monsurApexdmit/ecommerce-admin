import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { playIncomingSupportMessageSound } from "@/lib/message-sound";
import { presentSupportMessageNotification } from "@/lib/mobile-notifications";
import { subscribeToSupportCompany } from "@/lib/reverb";
import {
  getTickets,
  getTicketStats,
  deleteTicket,
} from "@/services/support";
import type { SupportTicket, TicketStats, TicketStatus, TicketPriority } from "@/services/support";

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "Yesterday";
  return new Date(dateStr).toLocaleDateString();
}

const STATUS_COLOR: Record<TicketStatus, { bg: string; text: string; dot: string; label: string }> = {
  open:        { bg: "#dbeafe", text: "#1d4ed8", dot: "#3b82f6", label: "Open" },
  in_progress: { bg: "#fef3c7", text: "#92400e", dot: "#f59e0b", label: "In Progress" },
  resolved:    { bg: "#dcfce7", text: "#166534", dot: "#22c55e", label: "Resolved" },
  closed:      { bg: "#f1f5f9", text: "#475569", dot: "#94a3b8", label: "Closed" },
};

const PRIORITY_DOT: Record<TicketPriority, string> = {
  high: "#ef4444", medium: "#f97316", low: "#94a3b8",
};

const STATUS_FILTERS: { value: TicketStatus | "all"; label: string }[] = [
  { value: "all",        label: "All" },
  { value: "open",       label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved",   label: "Resolved" },
  { value: "closed",     label: "Closed" },
];

export default function SupportScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const { session } = useAuth();

  const [tickets, setTickets]         = useState<SupportTicket[]>([]);
  const [stats, setStats]             = useState<TicketStats | null>(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [page, setPage]               = useState(1);
  const [hasNext, setHasNext]         = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const searchActive = search.trim().length > 0;
  const filteredState = statusFilter !== "all";
  const compactHeader = searchActive || filteredState;

  useEffect(() => { navigation.setOptions({ title: "Support" }); }, [navigation]);

  const load = useCallback(async (nextPage: number, mode: "reset" | "append") => {
    const [listRes, statsRes] = await Promise.all([
      getTickets({ status: statusFilter, search: search || undefined, page: nextPage, per_page: 20 }),
      getTicketStats(),
    ]);
    setTickets((cur) => mode === "append" ? [...cur, ...listRes.data] : listRes.data);
    setStats(statsRes);
    setPage(listRes.page);
    setHasNext(listRes.page * listRes.perPage < listRes.total);
  }, [search, statusFilter]);

  useEffect(() => {
    const run = async () => { try { setLoading(true); await load(1, "reset"); } finally { setLoading(false); } };
    void run();
  }, [load]);

  useEffect(() => {
    if (!session?.companyId) return;

    return subscribeToSupportCompany(session.companyId, {
      onTicketCreated: (ticket) => {
        setTickets((prev) => {
          const exists = prev.some((item) => item.id === ticket.id);
          if (exists) {
            return prev.map((item) => (item.id === ticket.id ? ticket : item));
          }

          return [ticket, ...prev];
        });
        setStats((prev) => prev
          ? {
              ...prev,
              total: prev.total + 1,
              open: ticket.status === "open" ? prev.open + 1 : prev.open,
              in_progress: ticket.status === "in_progress" ? prev.in_progress + 1 : prev.in_progress,
              resolved: ticket.status === "resolved" ? prev.resolved + 1 : prev.resolved,
              closed: ticket.status === "closed" ? prev.closed + 1 : prev.closed,
            }
          : prev);
      },
      onMessageSent: (ticketId, message) => {
        if (message.senderType === "customer") {
          void playIncomingSupportMessageSound(message.id);
          void presentSupportMessageNotification({
            ticketId,
            messageId: message.id,
            senderName: message.senderName,
            body: message.body,
          });
        }

        setTickets((prev) => {
          const index = prev.findIndex((item) => item.id === ticketId);
          if (index === -1) return prev;

          const target = prev[index];
          const nextTicket = {
            ...target,
            messages: target.messages.some((item) => item.id === message.id)
              ? target.messages
              : [...target.messages, message],
          };
          const next = [...prev];
          next.splice(index, 1);
          next.unshift(nextTicket);
          return next;
        });
      },
      onStatusUpdated: (ticketId, status) => {
        setTickets((prev) => prev.map((item) => (item.id === ticketId ? { ...item, status } : item)));
        void load(1, "reset");
      },
      onPriorityUpdated: (ticketId, priority) => {
        setTickets((prev) => prev.map((item) => (item.id === ticketId ? { ...item, priority } : item)));
      },
    });
  }, [load, session?.companyId]);

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(1, "reset"); } finally { setRefreshing(false); }
  }, [load]);

  const onEndReached = useCallback(async () => {
    if (!hasNext || loadingMore || loading) return;
    try { setLoadingMore(true); await load(page + 1, "append"); } finally { setLoadingMore(false); }
  }, [hasNext, loadingMore, loading, load, page]);

  const handleDelete = (ticket: SupportTicket) => {
    Alert.alert("Delete Ticket", `Delete #${ticket.ticketNumber}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteTicket(ticket.id);
          await load(1, "reset");
        },
      },
    ]);
  };

  const statCards = stats ? [
    { label: "Total",       value: stats.total,       bg: "#f1f5f9", text: colors.text },
    { label: "Open",        value: stats.open,        bg: "#dbeafe", text: "#1d4ed8" },
    { label: "In Progress", value: stats.in_progress, bg: "#fef3c7", text: "#92400e" },
    { label: "Resolved",    value: stats.resolved,    bg: "#dcfce7", text: "#166534" },
    { label: "Closed",      value: stats.closed,      bg: "#f1f5f9", text: "#64748b" },
  ] : [];

  const listHeader = (
    <>
      <View style={[s.header, compactHeader && { paddingTop: 10 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Support</Text>
          {!compactHeader && <Text style={s.subtitle}>Manage customer support tickets</Text>}
        </View>
      </View>

      <View style={s.searchRow}>
        <View style={s.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search tickets, customer…"
            style={s.searchInput}
            placeholderTextColor="#94a3b8"
          />
          {searchActive && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {!compactHeader && statCards.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statScroll} contentContainerStyle={s.statRow}>
          {statCards.map((c) => (
            <View key={c.label} style={[s.statChip, { backgroundColor: c.bg }]}>
              <Text style={[s.statValue, { color: c.text }]}>{c.value}</Text>
              <Text style={[s.statLabel, { color: c.text }]}>{c.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {!searchActive && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabScroll} contentContainerStyle={s.tabRow}>
          {STATUS_FILTERS.map(({ value, label }) => {
            const active = value === statusFilter;
            const dot = value !== "all" ? STATUS_COLOR[value].dot : colors.muted;
            return (
              <Pressable key={value} style={[s.tab, active && s.tabActive]} onPress={() => setStatusFilter(value)}>
                {value !== "all" && <View style={[s.tabDot, { backgroundColor: dot }]} />}
                <Text style={[s.tabText, active && s.tabTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </>
  );

  return (
    <SafeAreaView style={s.root} edges={["top", "bottom"]}>
      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          style={s.list}
          data={tickets}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={listHeader}
          renderItem={({ item }) => {
            const sc = STATUS_COLOR[item.status];
            const priorityDot = PRIORITY_DOT[item.priority];
            return (
              <Pressable style={[s.card, { borderLeftColor: sc.dot }]} onPress={() => router.push(`/support/${item.id}` as any)}>
                {/* Row 1: ticket# + status */}
                <View style={s.cardTop}>
                  <View style={[s.statusIcon, { backgroundColor: sc.bg }]}>
                    <Ionicons name="headset-outline" size={16} color={sc.dot} />
                  </View>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={s.ticketNo} numberOfLines={1}>#{item.ticketNumber}</Text>
                    <Text style={s.customer} numberOfLines={1}>{item.customerName || "Unknown"}</Text>
                  </View>
                  <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[s.statusBadgeText, { color: sc.text }]}>{sc.label}</Text>
                  </View>
                </View>

                {/* Subject */}
                <Text style={s.subject} numberOfLines={2}>{item.subject}</Text>

                {/* Row 3: priority + category + time + delete */}
                <View style={s.cardBottom}>
                  <View style={s.metaRow}>
                    <View style={[s.priorityDot, { backgroundColor: priorityDot }]} />
                    <Text style={s.meta}>{item.priority}</Text>
                    <Text style={s.metaDivider}>·</Text>
                    <Text style={s.meta}>{item.category}</Text>
                  </View>
                  <View style={s.metaRow}>
                    <Ionicons name="time-outline" size={12} color={colors.muted} />
                    <Text style={s.meta}>{relativeTime(item.createdAt)}</Text>
                    <Pressable hitSlop={10} onPress={() => handleDelete(item)} style={{ marginLeft: 8 }}>
                      <Ionicons name="trash-outline" size={15} color="#ef4444" />
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primaryDark} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => void onEndReached()}
          ListFooterComponent={loadingMore ? <View style={s.footerLoader}><ActivityIndicator color={colors.primaryDark} /></View> : <View style={{ height: 24 }} />}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="headset-outline" size={40} color={colors.muted} />
              <Text style={s.emptyTitle}>No tickets found</Text>
              <Text style={s.emptyText}>Adjust filters or check back later.</Text>
            </View>
          }
          contentContainerStyle={[s.listContent, tickets.length === 0 && s.listContentEmpty]}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 14, paddingBottom: 2 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 1 },

  searchRow: { paddingHorizontal: 20, marginTop: 8 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, height: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12 },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },

  statScroll: { height: 68, marginTop: 6 },
  statRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, alignItems: "center" },
  statChip: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, alignItems: "center", minWidth: 64, gap: 2 },
  statValue: { fontSize: 16, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "600" },

  tabScroll: { height: 46, marginTop: 6 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, alignItems: "center" },
  tab: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 6 },
  tabActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  tabDot: { width: 7, height: 7, borderRadius: 4 },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: colors.primaryDark },

  list: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  listContent: { padding: 14, paddingTop: 8, paddingBottom: 32 },
  listContentEmpty: { flexGrow: 1 },
  footerLoader: { paddingVertical: 16, alignItems: "center" },
  empty: { alignItems: "center", gap: 10, paddingTop: 80 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center" },

  card: { borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ticketNo: { color: colors.text, fontSize: 13, fontWeight: "800" },
  customer: { color: colors.muted, fontSize: 12 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  subject: { color: colors.text, fontSize: 13, lineHeight: 19 },
  cardBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  priorityDot: { width: 7, height: 7, borderRadius: 4 },
  meta: { color: colors.muted, fontSize: 11, textTransform: "capitalize" },
  metaDivider: { color: colors.muted, fontSize: 11 },
});
