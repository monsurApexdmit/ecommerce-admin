import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useNotifications } from "@/context/NotificationContext";
import { colors } from "@/constants/theme";

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:   { bg: "#fef3c7", text: "#d97706" },
  admin:   { bg: "#dbeafe", text: "#1d4ed8" },
  manager: { bg: "#ede9fe", text: "#7c3aed" },
  staff:   { bg: "#dcfce7", text: "#16a34a" },
};

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  onPress?: () => void;
  color?: string;
  badge?: string;
  iconBg?: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

export default function MoreTab() {
  const { session, user, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  const displayName = user?.fullName ?? session?.companyName ?? "User";
  const displayEmail = session?.userEmail ?? user?.email ?? "";
  const displayRole = session?.userRole ?? user?.role ?? "";
  const initial = displayName.charAt(0).toUpperCase();
  const roleTone = ROLE_COLORS[displayRole] ?? { bg: "#f1f5f9", text: "#64748b" };

  const sections: MenuSection[] = [
    {
      title: "Store",
      items: [
        { icon: "layers-outline",             label: "Inventory",  route: "/inventory",  iconBg: "#eff6ff" },
        { icon: "people-outline",             label: "Customers",  route: "/customers",  iconBg: "#ecfdf5" },
        { icon: "storefront-outline",         label: "Vendors",    route: "/vendors",    iconBg: "#fef3c7" },
        { icon: "return-down-back-outline",   label: "Returns",    route: "/returns",    iconBg: "#fce7f3" },
      ],
    },
    {
      title: "Staff",
      items: [
        { icon: "person-outline",  label: "Staff",  route: "/staff",  iconBg: "#ede9fe" },
        { icon: "cash-outline",    label: "Salary", route: "/salary", iconBg: "#dcfce7" },
      ],
    },
    {
      title: "Account",
      items: [
        { icon: "headset-outline",        label: "Support",       route: "/support",       iconBg: "#dbeafe" },
        { icon: "settings-outline",       label: "Settings",      route: "/settings",      iconBg: "#f1f5f9" },
        {
          icon: "notifications-outline",
          label: "Notifications",
          route: "/notifications",
          iconBg: "#fef3c7",
          badge: unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : undefined,
        },
      ],
    },
    {
      title: "",
      items: [
        {
          icon: "log-out-outline",
          label: "Sign Out",
          color: "#dc2626",
          iconBg: "#fee2e2",
          onPress: () => {
            Alert.alert("Sign Out", "Sign out of your account?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: () => signOut() },
            ]);
          },
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>More</Text>
        </View>

        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            {displayEmail ? <Text style={styles.profileEmail} numberOfLines={1}>{displayEmail}</Text> : null}
            <View style={styles.profileMeta}>
              {displayRole ? (
                <View style={[styles.roleBadge, { backgroundColor: roleTone.bg }]}>
                  <Text style={[styles.roleBadgeText, { color: roleTone.text }]}>{displayRole}</Text>
                </View>
              ) : null}
              {session?.companyName ? (
                <Text style={styles.companyText} numberOfLines={1}>{session.companyName}</Text>
              ) : null}
            </View>
          </View>
          <Pressable
            style={styles.settingsShortcut}
            onPress={() => router.push("/settings")}
            hitSlop={8}
          >
            <Ionicons name="settings-outline" size={18} color={colors.muted} />
          </Pressable>
        </View>

        {/* Quick actions row */}
        <View style={styles.quickRow}>
          <QuickAction icon="layers-outline" label="Inventory" onPress={() => router.push("/inventory")} />
          <QuickAction icon="people-outline" label="Customers" onPress={() => router.push("/customers")} />
          <QuickAction icon="person-outline" label="Staff" onPress={() => router.push("/staff")} />
          <QuickAction icon="return-down-back-outline" label="Returns" onPress={() => router.push("/returns")} />
        </View>

        {/* Menu sections */}
        {sections.map((section, si) => (
          <View key={si} style={styles.section}>
            {section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null}
            <View style={styles.card}>
              {section.items.map((item, ii) => (
                <View key={ii}>
                  {ii > 0 && <View style={styles.divider} />}
                  <Pressable
                    style={styles.row}
                    onPress={() => {
                      if (item.onPress) {
                        item.onPress();
                      } else if (item.route) {
                        router.push(item.route as any);
                      }
                    }}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: item.iconBg ?? "#ecfdf5" }]}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={item.color ?? colors.primaryDark}
                      />
                    </View>
                    <Text style={[styles.rowLabel, item.color ? { color: item.color } : null]}>
                      {item.label}
                    </Text>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                    {!item.onPress && (
                      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={qaStyles.btn} onPress={onPress}>
      <View style={qaStyles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.primaryDark} />
      </View>
      <Text style={qaStyles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const qaStyles = StyleSheet.create({
  btn: { flex: 1, alignItems: "center", gap: 6 },
  iconWrap: {
    width: 48, height: 48, borderRadius: 16,
    backgroundColor: "#ecfdf5",
    borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  label: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4,
  },
  topBarTitle: { color: colors.text, fontSize: 24, fontWeight: "800" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  profileEmail: { color: colors.muted, fontSize: 12 },
  profileMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  roleBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  roleBadgeText: { fontSize: 11, fontWeight: "800" },
  companyText: { color: colors.muted, fontSize: 12, flex: 1 },
  settingsShortcut: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center", justifyContent: "center",
  },
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  section: { marginHorizontal: 16, marginBottom: 12 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 66 },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 4,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
