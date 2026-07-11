import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import type { Notification, NotificationType } from "@/services/notifications";

const TYPE_META: Record<NotificationType, { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string }> = {
  order: { icon: "time-outline", bg: "#fef3c7", color: "#f97316" },
  stock_alert: { icon: "layers-outline", bg: "#ffe4e6", color: "#fb7185" },
  payment: { icon: "card-outline", bg: "#dcfce7", color: "#16a34a" },
  system: { icon: "settings-outline", bg: "#f1f5f9", color: "#64748b" },
  support: { icon: "chatbubble-outline", bg: "#ede9fe", color: "#7c3aed" },
  review: { icon: "star-outline", bg: "#fce7f3", color: "#db2777" },
};

export function NotificationPreviewSheet({
  visible,
  notifications,
  onClose,
  onPressNotification,
  onPressViewAll,
}: {
  visible: boolean;
  notifications: Notification[];
  onClose: () => void;
  onPressNotification: (notification: Notification) => void;
  onPressViewAll: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView style={styles.sheetWrap} edges={["bottom"]}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Notifications</Text>
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {notifications.length > 0 ? (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 8) }]}
              >
                {notifications.map((notification) => {
                  const meta = TYPE_META[notification.type] ?? TYPE_META.system;
                  return (
                    <Pressable
                      key={notification.id}
                      style={styles.card}
                      onPress={() => onPressNotification(notification)}
                    >
                      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={20} color={meta.color} />
                      </View>
                      <View style={styles.cardContent}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {notification.title}
                        </Text>
                        <Text style={styles.cardTime} numberOfLines={1}>
                          {formatDateTime(notification.createdAt)}
                        </Text>
                      </View>
                      {!notification.readAt ? <View style={styles.unreadDot} /> : null}
                    </Pressable>
                  );
                })}

                <Pressable style={styles.viewAllBtn} onPress={onPressViewAll}>
                  <Text style={styles.viewAllText}>View all notifications</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.primaryDark} />
                </Pressable>
              </ScrollView>
            ) : (
              <View style={[styles.empty, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="notifications-outline" size={24} color={colors.muted} />
                </View>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptyText}>Order alerts and stock updates will appear here.</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetWrap: {
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingTop: 12,
    maxHeight: "52%",
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 18,
  },
  handle: {
    alignSelf: "center",
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    padding: 14,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  cardTime: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  viewAllBtn: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#ecfdf5",
    paddingVertical: 14,
  },
  viewAllText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800",
  },
  empty: {
    alignItems: "center",
    paddingTop: 16,
    gap: 10,
  },
  emptyIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 18,
  },
});
