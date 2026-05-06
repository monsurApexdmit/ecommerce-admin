import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import {
  createStaff,
  deleteStaff,
  getStaff,
  getStaffStats,
  type StaffMember,
} from "@/services/staff";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

export default function StaffScreen() {
  const { formatCurrency } = useCurrency();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0 });
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true);
    try {
      const [res, st] = await Promise.allSettled([
        getStaff({ page: 1, limit: 20, search: debouncedSearch || undefined }),
        getStaffStats(),
      ]);
      if (res.status === "fulfilled") {
        setStaff(res.value.data);
        setTotal(res.value.total);
        setPage(1);
      }
      if (st.status === "fulfilled") setStats(st.value);
    } finally { setLoading(false); }
  }, [debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (loadingMore || staff.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getStaff({ page: next, limit: 20, search: debouncedSearch || undefined });
      setStaff((prev) => [...prev, ...res.data]);
      setPage(next);
    } finally { setLoadingMore(false); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openMenu = (s: StaffMember) => {
    Alert.alert(s.name, s.role ?? "", [
      { text: "View Details", onPress: () => router.push(`/staff/${s.id}` as any) },
      {
        text: "Delete", style: "destructive", onPress: () =>
          Alert.alert("Delete staff", `Delete ${s.name}? This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => { await deleteStaff(s.id); load(); } },
          ])
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Staff</Text>
        <View style={styles.headerRight}>
          <Pressable style={styles.salaryBtn} onPress={() => router.push("/salary")}>
            <Ionicons name="cash-outline" size={16} color={colors.primaryDark} />
            <Text style={styles.salaryBtnText}>Salary</Text>
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatChip label="Total" value={stats.total} bg="#eff6ff" text="#1d4ed8" />
        <StatChip label="Active" value={stats.active} bg="#dcfce7" text="#16a34a" />
        <StatChip label="Inactive" value={stats.inactive} bg="#f1f5f9" text="#64748b" />
        <StatChip label="Salary Budget" value={staff.reduce((s, m) => s + m.salary, 0)} isCurrency bg="#fef3c7" text="#d97706" />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search staff..."
          placeholderTextColor="#94a3b8"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ marginVertical: 12 }} /> : null}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/staff/${item.id}` as any)}
              onLongPress={() => openMenu(item)}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColor(item.id) }]}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                    {item.role ? <Text style={styles.cardRole}>{item.role}</Text> : null}
                    {item.email ? <Text style={styles.cardMeta} numberOfLines={1}>{item.email}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[styles.badge, item.status === "Active" ? styles.badgeActive : styles.badgeInactive]}>
                      <Text style={[styles.badgeText, item.status === "Active" ? styles.badgeTextActive : styles.badgeTextInactive]}>
                        {item.status}
                      </Text>
                    </View>
                    <Text style={styles.salaryText}>{formatCurrency(item.salary)}/mo</Text>
                  </View>
                </View>
                {item.contact && (
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={12} color={colors.muted} />
                    <Text style={styles.cardMeta}>{item.contact}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No staff found</Text>
              <Text style={styles.emptyText}>{search ? "Try a different search." : "Add your first staff member."}</Text>
            </View>
          }
        />
      )}

      <AddStaffModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function StatChip({ label, value, bg, text, isCurrency }: {
  label: string; value: number; bg: string; text: string; isCurrency?: boolean;
}) {
  const { formatCurrency } = useCurrency();
  return (
    <View style={[statStyles.chip, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color: text }]} numberOfLines={1}>
        {isCurrency ? formatCurrency(value) : value}
      </Text>
      <Text style={[statStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

function AddStaffModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [bankAccount, setBankAccount] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(""); setEmail(""); setContact(""); setRole("");
    setSalary(""); setBankAccount("");
  };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Error", "Name is required."); return; }
    if (!email.trim()) { Alert.alert("Error", "Email is required."); return; }
    setSaving(true);
    try {
      await createStaff({
        name: name.trim(), email: email.trim(), contact: contact.trim() || undefined,
        role: role.trim() || undefined, salary: salary ? Number(salary) : undefined,
        paymentMethod, bankAccount: bankAccount.trim() || undefined,
      });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create staff member.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={mStyles.kav}>
        <View style={mStyles.sheet}>
          <View style={mStyles.sheetHeader}>
            <Text style={mStyles.sheetTitle}>Add Staff Member</Text>
            <Pressable onPress={() => { reset(); onClose(); }} style={mStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={mStyles.fields} keyboardShouldPersistTaps="handled">
            <ModalField label="Full Name *" value={name} onChange={setName} placeholder="John Doe" />
            <ModalField label="Email *" value={email} onChange={setEmail} placeholder="john@company.com" keyboardType="email-address" />
            <ModalField label="Phone" value={contact} onChange={setContact} placeholder="+1 234 567 8900" keyboardType="phone-pad" />
            <ModalField label="Role / Position" value={role} onChange={setRole} placeholder="Manager, Cashier, etc." />
            <ModalField label="Monthly Salary" value={salary} onChange={setSalary} placeholder="0.00" keyboardType="decimal-pad" />
            <View>
              <Text style={mStyles.fieldLabel}>Payment Method</Text>
              <View style={mStyles.methodRow}>
                {["bank_transfer", "cash", "cheque"].map((m) => (
                  <Pressable
                    key={m}
                    style={[mStyles.methodChip, paymentMethod === m && mStyles.methodChipActive]}
                    onPress={() => setPaymentMethod(m)}
                  >
                    <Text style={[mStyles.methodChipText, paymentMethod === m && mStyles.methodChipTextActive]}>
                      {m.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <ModalField label="Bank Account" value={bankAccount} onChange={setBankAccount} placeholder="Account number" />
            <Pressable
              style={[mStyles.saveBtn, saving && { opacity: 0.55 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Add Staff Member</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ModalField({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={mStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={mStyles.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
  value: { fontSize: 13, fontWeight: "800" },
  label: { fontSize: 10, fontWeight: "700" },
});

const mStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  fields: { padding: 20, gap: 14, paddingBottom: 32 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, color: colors.text, fontSize: 14, backgroundColor: "#f8fafc",
  },
  methodRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  methodChip: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 9, alignItems: "center",
  },
  methodChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  methodChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  methodChipTextActive: { color: colors.primaryDark },
  saveBtn: { borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 15, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  salaryBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderRadius: 10, borderWidth: 1.5, borderColor: colors.primaryDark,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  salaryBtnText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 6, padding: 12, paddingBottom: 8 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 8, height: 44,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  listContent: { padding: 16, paddingTop: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cardInfo: { flex: 1, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardRole: { color: colors.primaryDark, fontSize: 12, fontWeight: "600" },
  cardMeta: { color: colors.muted, fontSize: 12 },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#f1f5f9" },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  badgeTextActive: { color: "#16a34a" },
  badgeTextInactive: { color: "#64748b" },
  salaryText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13 },
});
