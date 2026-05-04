import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useNotifications } from "@/context/NotificationContext";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import { resolveNotificationRoute } from "@/lib/notification-routing";
import {
  type Notification,
  type NotificationType,
} from "@/services/notifications";

// ─── Type metadata ────────────────────────────────────────────────────────────

const TYPE_META: Record<NotificationType, { icon: string; bg: string; color: string; label: string }> = {
  order:       { icon: "bag-handle-outline",  bg: "#dbeafe", color: "#1d4ed8", label: "Order" },
  stock_alert: { icon: "warning-outline",     bg: "#fef3c7", color: "#d97706", label: "Stock" },
  payment:     { icon: "card-outline",        bg: "#dcfce7", color: "#16a34a", label: "Payment" },
  system:      { icon: "settings-outline",    bg: "#f1f5f9", color: "#64748b", label: "System" },
  support:     { icon: "chatbubble-outline",  bg: "#ede9fe", color: "#7c3aed", label: "Support" },
  review:      { icon: "star-outline",        bg: "#fce7f3", color: "#db2777", label: "Review" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high:   "#ef4444",
  medium: "#f59e0b",
  low:    "#94a3b8",
};

type Filter = "all" | "unread" | NotificationType;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "unread",      label: "Unread" },
  { key: "order",       label: "Orders" },
  { key: "stock_alert", label: "Stock" },
  { key: "payment",     label: "Payments" },
  { key: "system",      label: "System" },
  { key: "support",     label: "Support" },
  { key: "review",      label: "Reviews" },
];

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    deleteNotification,
    bulkDelete,
  } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const filteredNotifications = useMemo(() => {
    let list = [...notifications];
    if (filter === "unread") {
      list = list.filter((item) => !item.readAt);
    } else if (filter !== "all") {
      list = list.filter((item) => item.type === filter);
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [filter, notifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleTap = async (n: Notification) => {
    if (selectMode) { toggleSelect(n.id); return; }
    if (!n.readAt) {
      await markAsRead(n.id);
    }

    const route = resolveNotificationRoute(n.actionUrl);
    if (route) {
      router.push(route as any);
    }
  };

  const handleLongPress = (n: Notification) => {
    if (selectMode) { toggleSelect(n.id); return; }
    const opts: any[] = [];
    if (!n.readAt) {
      opts.push({ text: "Mark as Read", onPress: async () => { await markAsRead(n.id); } });
    } else {
      opts.push({ text: "Mark as Unread", onPress: async () => { await markAsUnread(n.id); } });
    }
    opts.push({
      text: "Delete", style: "destructive", onPress: () =>
        Alert.alert("Delete notification?", undefined, [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => { await deleteNotification(n.id); } },
        ]),
    });
    opts.push({ text: "Select", onPress: () => { setSelectMode(true); setSelected(new Set([n.id])); } });
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert(n.title, n.message, opts);
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  };

  const handleBulkDelete = () => {
    Alert.alert("Delete selected?", `Delete ${selected.size} notification${selected.size > 1 ? "s" : ""}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await bulkDelete(Array.from(selected));
        setSelectMode(false);
        setSelected(new Set());
      }},
    ]);
  };

  const cancelSelect = () => { setSelectMode(false); setSelected(new Set()); };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => { if (selectMode) cancelSelect(); else router.back(); }}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Ionicons name={selectMode ? "close" : "arrow-back"} size={22} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {selectMode ? (
          <Pressable
            style={styles.deleteBtn}
            onPress={handleBulkDelete}
            disabled={selected.size === 0}
          >
            <Ionicons name="trash-outline" size={18} color={selected.size > 0 ? "#dc2626" : colors.muted} />
            {selected.size > 0 && <Text style={styles.deleteBtnCount}>{selected.size}</Text>}
          </Pressable>
        ) : (
          unreadCount > 0
            ? <Pressable onPress={handleMarkAllRead} hitSlop={8}><Text style={styles.markAllText}>Mark all read</Text></Pressable>
            : <View style={{ width: 70 }} />
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable
              key={f.key}
              style={[styles.chip, filter === f.key && styles.chipActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <NotificationCard
              notification={item}
              selected={selected.has(item.id)}
              selectMode={selectMode}
              onPress={() => handleTap(item)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="notifications-outline" size={36} color={colors.muted} />
              </View>
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptyText}>
                {filter !== "all"
                  ? "No notifications match this filter."
                  : "Order alerts and updates will appear here."}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function NotificationCard({ notification: n, selected, selectMode, onPress, onLongPress }: {
  notification: Notification;
  selected: boolean;
  selectMode: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const meta = TYPE_META[n.type] ?? TYPE_META.system;
  const isUnread = !n.readAt;

  return (
    <Pressable
      style={[
        cardStyles.card,
        isUnread && cardStyles.cardUnread,
        selected && cardStyles.cardSelected,
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={cardStyles.left}>
        {selectMode ? (
          <View style={[cardStyles.checkbox, selected && cardStyles.checkboxSelected]}>
            {selected && <Ionicons name="checkmark" size={12} color="#fff" />}
          </View>
        ) : (
          <View style={[cardStyles.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={18} color={meta.color} />
          </View>
        )}
      </View>

      <View style={cardStyles.content}>
        <View style={cardStyles.topRow}>
          <Text style={[cardStyles.title, isUnread && cardStyles.titleUnread]} numberOfLines={1}>
            {n.title}
          </Text>
          <View style={[cardStyles.priorityDot, { backgroundColor: PRIORITY_COLORS[n.priority] ?? colors.muted }]} />
        </View>
        <Text style={cardStyles.message} numberOfLines={2}>{n.message}</Text>
        <View style={cardStyles.bottomRow}>
          <View style={[cardStyles.typePill, { backgroundColor: meta.bg }]}>
            <Text style={[cardStyles.typePillText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={cardStyles.time}>{formatDateTime(n.createdAt)}</Text>
        </View>
      </View>

      {isUnread && !selectMode && <View style={cardStyles.unreadDot} />}
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  cardUnread: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  cardSelected: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  left: { paddingTop: 2 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center",
  },
  checkboxSelected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  content: { flex: 1, gap: 4 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  titleUnread: { fontWeight: "800" },
  priorityDot: { width: 7, height: 7, borderRadius: 3.5 },
  message: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  bottomRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  typePill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  typePillText: { fontSize: 10, fontWeight: "700" },
  time: { color: colors.muted, fontSize: 11 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.primaryDark, marginTop: 6, flexShrink: 0,
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  unreadBadge: { backgroundColor: colors.primaryDark, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  markAllText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 4, padding: 4 },
  deleteBtnCount: { color: "#dc2626", fontSize: 13, fontWeight: "800" },
  filtersWrap: { height: 46 },
  filters: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 46 },
  chip: {
    borderRadius: 999, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 7,
  },
  chipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.primaryDark },
  listContent: { padding: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 40 },
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: 24,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", marginBottom: 4,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" },
});
