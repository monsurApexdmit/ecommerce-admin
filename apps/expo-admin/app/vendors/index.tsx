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
  createVendor,
  deleteVendor,
  getVendorStats,
  getVendors,
  type Vendor,
} from "@/services/vendors";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

export default function VendorsScreen() {
  const { formatCurrency } = useCurrency();
  const [vendors, setVendors] = useState<Vendor[]>([]);
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
        getVendors({ page: 1, limit: 20, search: debouncedSearch || undefined }),
        getVendorStats(),
      ]);
      if (res.status === "fulfilled") {
        setVendors(res.value.data);
        setTotal(res.value.total);
        setPage(1);
      }
      if (st.status === "fulfilled") setStats(st.value);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => { void load(); }, [load]);

  const { canRead } = useAuth();
  if (!canRead('Vendors')) return <AccessDenied />;

  const loadMore = async () => {
    if (loadingMore || vendors.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await getVendors({ page: next, limit: 20, search: debouncedSearch || undefined });
      setVendors((prev) => [...prev, ...res.data]);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const openMenu = (v: Vendor) => {
    Alert.alert(v.name, undefined, [
      { text: "View Details", onPress: () => router.push(`/vendors/${v.id}`) },
      {
        text: "Delete", style: "destructive", onPress: () =>
          Alert.alert("Delete vendor", `Delete ${v.name}? This cannot be undone.`, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => {
              await deleteVendor(v.id);
              load();
            }},
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
        <Text style={styles.title}>Vendors</Text>
        <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatChip label="Total" value={stats.total} bg="#eff6ff" text="#1d4ed8" />
        <StatChip label="Active" value={stats.active} bg="#dcfce7" text="#16a34a" />
        <StatChip label="Inactive" value={stats.inactive} bg="#f1f5f9" text="#64748b" />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search vendors..."
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
          data={vendors}
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
              onPress={() => router.push(`/vendors/${item.id}`)}
              onLongPress={() => openMenu(item)}
            >
              <View style={[styles.avatar, { backgroundColor: avatarColor(item.id) }]}>
                <Text style={styles.avatarText}>{initials(item.name)}</Text>
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                  <View style={[styles.badge, item.status === "active" ? styles.badgeActive : styles.badgeInactive]}>
                    <Text style={[styles.badgeText, item.status === "active" ? styles.badgeTextActive : styles.badgeTextInactive]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                {item.email ? <Text style={styles.cardMeta} numberOfLines={1}>{item.email}</Text> : null}
                {item.phone ? <Text style={styles.cardMeta}>{item.phone}</Text> : null}
                <View style={styles.financialRow}>
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Total Paid</Text>
                    <Text style={styles.financialValue}>{formatCurrency(item.totalPaid)}</Text>
                  </View>
                  <View style={styles.financialDivider} />
                  <View style={styles.financialItem}>
                    <Text style={styles.financialLabel}>Payable</Text>
                    <Text style={[styles.financialValue, item.amountPayable > 0 && styles.payableWarning]}>
                      {formatCurrency(item.amountPayable)}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="storefront-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No vendors found</Text>
              <Text style={styles.emptyText}>{search ? "Try a different search term." : "Add your first vendor."}</Text>
            </View>
          }
        />
      )}

      <AddVendorModal
        visible={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

function StatChip({ label, value, bg, text }: { label: string; value: number; bg: string; text: string }) {
  return (
    <View style={[statStyles.chip, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color: text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

function AddVendorModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setAddress(""); setDescription(""); };

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert("Error", "Vendor name is required."); return; }
    setSaving(true);
    try {
      await createVendor({ name: name.trim(), email: email.trim(), phone: phone.trim(), address: address.trim(), description: description.trim() });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create vendor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={modalStyles.kav}
      >
        <View style={modalStyles.sheet}>
          <View style={modalStyles.sheetHeader}>
            <Text style={modalStyles.sheetTitle}>Add Vendor</Text>
            <Pressable onPress={() => { reset(); onClose(); }} style={modalStyles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={modalStyles.fields} keyboardShouldPersistTaps="handled">
            <Field label="Vendor Name *" value={name} onChange={setName} placeholder="Enter vendor name" />
            <Field label="Email" value={email} onChange={setEmail} placeholder="vendor@example.com" keyboardType="email-address" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 234 567 8900" keyboardType="phone-pad" />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />
            <Field label="Description" value={description} onChange={setDescription} placeholder="Optional notes..." multiline />
            <Pressable
              style={[modalStyles.saveBtn, saving && { opacity: 0.55 }]}
              onPress={handleCreate}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={modalStyles.saveBtnText}>Create Vendor</Text>
              }
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={modalStyles.fieldLabel}>{label}</Text>
      <TextInput
        style={[modalStyles.input, multiline && modalStyles.inputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        autoCapitalize="none"
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "700" },
});

const modalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center",
  },
  fields: { padding: 20, gap: 14, paddingBottom: 32 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, color: colors.text, fontSize: 14,
    backgroundColor: "#f8fafc",
  },
  inputMulti: { height: 80, paddingTop: 12 },
  saveBtn: {
    borderRadius: 14, backgroundColor: colors.primaryDark,
    paddingVertical: 15, alignItems: "center", marginTop: 6,
  },
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
  addBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 8, padding: 16, paddingBottom: 8 },
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
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cardInfo: { flex: 1, gap: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#f1f5f9" },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: "#f1f5f9" },
  badgeText: { fontSize: 11, fontWeight: "700", color: colors.muted },
  badgeTextActive: { color: "#16a34a" },
  badgeTextInactive: { color: "#64748b" },
  cardMeta: { color: colors.muted, fontSize: 12 },
  financialRow: {
    flexDirection: "row", marginTop: 6,
    backgroundColor: "#f8fafc", borderRadius: 10, overflow: "hidden",
  },
  financialItem: { flex: 1, alignItems: "center", paddingVertical: 6 },
  financialDivider: { width: 1, backgroundColor: colors.border },
  financialLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  financialValue: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 2 },
  payableWarning: { color: "#d97706" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13 },
});
