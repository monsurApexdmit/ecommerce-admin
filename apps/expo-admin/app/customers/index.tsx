import { useCallback, useEffect, useMemo, useState } from "react";
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
  createCustomer,
  deleteCustomer,
  getCustomers,
  getCustomerStats,
  type Customer,
  type CustomerStats,
} from "@/services/customers";

type StatusFilter = "" | "active" | "inactive";

function avatarInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }

export default function CustomersScreen() {
  const { formatCurrency } = useCurrency();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadCustomers = useCallback(async (nextPage: number, mode: "reset" | "append") => {
    const result = await getCustomers({
      page: nextPage, limit: 20,
      search: debouncedSearch || undefined,
      status: statusFilter || undefined,
    });
    setCustomers((prev) => mode === "append" ? [...prev, ...result.data] : result.data);
    setPage(result.page);
    setTotal(result.total);
    setHasNext(result.page * result.limit < result.total);
  }, [debouncedSearch, statusFilter]);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try { await Promise.all([loadCustomers(1, "reset"), getCustomerStats().then(setStats)]); }
    finally { setLoading(false); }
  }, [loadCustomers]);

  useEffect(() => { void bootstrap(); }, [bootstrap]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCustomers(1, "reset"), getCustomerStats().then(setStats)]);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasNext || loadingMore || loading) return;
    setLoadingMore(true);
    await loadCustomers(page + 1, "append");
    setLoadingMore(false);
  };

  const handleDelete = (c: Customer) => {
    Alert.alert("Delete customer", `Delete ${c.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteCustomer(c.id);
        await loadCustomers(1, "reset");
        getCustomerStats().then(setStats);
      }},
    ]);
  };

  const filtersApplied = Boolean(statusFilter);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Customers</Text>
        <Pressable style={styles.addBtn} onPress={() => setAddVisible(true)}>
          <Ionicons name="person-add-outline" size={18} color="#fff" />
        </Pressable>
      </View>

      {/* Stats */}
      {!search && (
        <View style={styles.statsRow}>
          <StatChip label="Total" value={stats ? String(stats.total) : "—"} bg="#eff6ff" text="#1d4ed8" />
          <StatChip label="Active" value={stats ? String(stats.active) : "—"} bg="#dcfce7" text="#16a34a" />
          <StatChip label="Inactive" value={stats ? String(stats.inactive) : "—"} bg="#f1f5f9" text="#64748b" />
        </View>
      )}

      {/* Search + filter */}
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email..."
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
        <Pressable
          style={[styles.filterBtn, filtersApplied && styles.filterBtnActive]}
          onPress={() => setFilterVisible(true)}
        >
          <Ionicons name="options-outline" size={18} color={filtersApplied ? colors.primaryDark : colors.text} />
        </Pressable>
      </View>

      {/* Count */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{total} customer{total !== 1 ? "s" : ""}</Text>
        {filtersApplied && (
          <Pressable onPress={() => setStatusFilter("")}>
            <Text style={styles.clearText}>Clear filters</Text>
          </Pressable>
        )}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primaryDark} size="large" />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={{ padding: 16 }} /> : <View style={{ height: 16 }} />}
          renderItem={({ item }) => (
            <CustomerCard
              customer={item}
              onPress={() => router.push(`/customers/${item.id}`)}
              onDelete={() => handleDelete(item)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.muted} />
              <Text style={styles.emptyTitle}>No customers found</Text>
              <Text style={styles.emptyText}>
                {search || filtersApplied ? "Try adjusting search or filters." : "Add your first customer."}
              </Text>
            </View>
          }
        />
      )}

      {/* Filter modal */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setFilterVisible(false)} />
        <View style={styles.modalSheet}>
          <View style={styles.handle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter</Text>
            <Pressable onPress={() => setFilterVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.filterOptions}>
            {(["", "active", "inactive"] as StatusFilter[]).map((s) => (
              <Pressable
                key={s || "all"}
                style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                onPress={() => setStatusFilter(s)}
              >
                <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                  {s || "All"}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.applyBtn} onPress={() => setFilterVisible(false)}>
            <Text style={styles.applyBtnText}>Apply</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Add customer modal */}
      <AddCustomerModal
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        onCreated={async () => {
          setAddVisible(false);
          await loadCustomers(1, "reset");
          getCustomerStats().then(setStats);
        }}
      />
    </SafeAreaView>
  );
}

function CustomerCard({ customer, onPress, onDelete }: {
  customer: Customer;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { formatCurrency } = useCurrency();
  const bg = avatarColor(customer.id);
  return (
    <Pressable style={cardStyles.card} onPress={onPress}>
      <View style={[cardStyles.avatar, { backgroundColor: bg }]}>
        <Text style={cardStyles.avatarText}>{avatarInitials(customer.name)}</Text>
      </View>
      <View style={cardStyles.info}>
        <View style={cardStyles.nameRow}>
          <Text style={cardStyles.name} numberOfLines={1}>{customer.name}</Text>
          <View style={[cardStyles.statusDot, { backgroundColor: customer.status === "active" ? "#16a34a" : "#94a3b8" }]} />
        </View>
        <Text style={cardStyles.email} numberOfLines={1}>{customer.email}</Text>
        {customer.phone ? <Text style={cardStyles.meta}>{customer.phone}</Text> : null}
        <View style={cardStyles.bottomRow}>
          <View style={[cardStyles.typeBadge, customer.customerType === "wholesale" ? cardStyles.typeBadgeWholesale : null]}>
            <Text style={[cardStyles.typeText, customer.customerType === "wholesale" ? cardStyles.typeTextWholesale : null]}>
              {customer.customerType}
            </Text>
          </View>
          {customer.totalOrders != null && (
            <Text style={cardStyles.meta}>{customer.totalOrders} orders</Text>
          )}
          {customer.totalSpent != null && (
            <Text style={cardStyles.spent}>{formatCurrency(customer.totalSpent)}</Text>
          )}
        </View>
      </View>
      <Pressable
        style={cardStyles.menuBtn}
        hitSlop={8}
        onPress={() => Alert.alert(customer.name, "Choose action", [
          { text: "Cancel", style: "cancel" },
          { text: "View", onPress },
          { text: "Delete", style: "destructive", onPress: onDelete },
        ])}
      >
        <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

function AddCustomerModal({ visible, onClose, onCreated }: {
  visible: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [type, setType] = useState<"retail" | "wholesale">("retail");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => { setName(""); setEmail(""); setPhone(""); setAddress(""); setCity(""); setCountry(""); setType("retail"); };

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim()) { Alert.alert("Required", "Name and email are required."); return; }
    setSubmitting(true);
    try {
      await createCustomer({ name: name.trim(), email: email.trim(), phone: phone || undefined, address: address || undefined, city: city || undefined, country: country || undefined, customerType: type });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to create customer.");
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.addKav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.addSheet}>
          {/* Sticky header */}
          <View style={styles.handle} />
          <View style={styles.addHeader}>
            <Text style={styles.modalTitle}>New Customer</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Scrollable fields */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.addForm}
          >
            <Field label="Name *" value={name} onChange={setName} placeholder="Full name" />
            <Field label="Email *" value={email} onChange={setEmail} placeholder="email@example.com" keyboardType="email-address" />
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 234 567 8900" keyboardType="phone-pad" />
            <Field label="Address" value={address} onChange={setAddress} placeholder="Street address" />
            <Field label="City" value={city} onChange={setCity} placeholder="City" />
            <Field label="Country" value={country} onChange={setCountry} placeholder="Country" />
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Customer Type</Text>
              <View style={styles.typeRow}>
                {(["retail", "wholesale"] as const).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.typeChip, type === t && styles.typeChipActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable style={[styles.submitBtn, submitting && { opacity: 0.55 }]} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Create Customer</Text>}
            </Pressable>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, value, onChange, placeholder, keyboardType }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
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

function StatChip({ label, value, bg, text }: { label: string; value: string; bg: string; text: string }) {
  return (
    <View style={[statStyles.chip, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color: text }]}>{value}</Text>
      <Text style={[statStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  chip: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "700" },
});

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 12,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  info: { flex: 1, gap: 3 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { color: colors.text, fontSize: 15, fontWeight: "700", flex: 1 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  email: { color: colors.muted, fontSize: 12 },
  meta: { color: colors.muted, fontSize: 12 },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  typeBadge: {
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: "#eff6ff",
  },
  typeBadgeWholesale: { backgroundColor: "#fef3c7" },
  typeText: { color: "#1d4ed8", fontSize: 11, fontWeight: "700" },
  typeTextWholesale: { color: "#d97706" },
  spent: { color: colors.primaryDark, fontSize: 12, fontWeight: "700", marginLeft: "auto" },
  menuBtn: { padding: 4 },
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
  statsRow: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 6 },
  toolbar: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 4 },
  searchWrap: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    height: 44, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  filterBtn: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface,
    alignItems: "center", justifyContent: "center",
  },
  filterBtnActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  countRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 6 },
  countText: { color: colors.muted, fontSize: 13 },
  clearText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  listContent: { padding: 16, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.4)" },
  modalSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36, gap: 14,
  },
  addKav: {
    flex: 1,
    justifyContent: "flex-end",
  },
  addSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  addHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  handle: {
    alignSelf: "center", width: 40, height: 4,
    borderRadius: 2, backgroundColor: colors.border, marginBottom: 4, marginTop: 8,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "800" },
  filterLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  filterOptions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  filterChip: {
    borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, paddingVertical: 8,
  },
  filterChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  filterChipText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  filterChipTextActive: { color: colors.primaryDark },
  applyBtn: {
    backgroundColor: colors.primaryDark, borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 8,
  },
  applyBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  addForm: { gap: 14, paddingBottom: 40 },
  fieldWrap: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  fieldInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    backgroundColor: "#f8fafc", paddingHorizontal: 14,
    height: 48, color: colors.text, fontSize: 15,
  },
  typeRow: { flexDirection: "row", gap: 10 },
  typeChip: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingVertical: 12, alignItems: "center",
  },
  typeChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  typeChipText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  typeChipTextActive: { color: colors.primaryDark },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    height: 52, alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
