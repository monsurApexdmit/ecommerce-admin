import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import {
  deleteVendor,
  getVendorById,
  updateVendor,
  type Vendor,
} from "@/services/vendors";
import { getVendorReturns, type VendorReturn } from "@/services/returns";
import { getProducts } from "@/services/products";
import type { Product } from "@/types/product";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#fef3c7", text: "#d97706" },
  shipped: { bg: "#dbeafe", text: "#1d4ed8" },
  received_by_vendor: { bg: "#ede9fe", text: "#7c3aed" },
  completed: { bg: "#dcfce7", text: "#16a34a" },
};

export default function VendorDetailScreen() {
  const { formatCurrency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [returns, setReturns] = useState<VendorReturn[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [v, r, p] = await Promise.allSettled([
        getVendorById(Number(id)),
        getVendorReturns({ vendorId: Number(id), limit: 5 }),
        getProducts({ vendorId: Number(id), limit: 50 }),
      ]);
      if (v.status === "fulfilled") {
        const ven = v.value;
        setVendor(ven);
        setName(ven.name); setEmail(ven.email ?? "");
        setPhone(ven.phone ?? ""); setAddress(ven.address ?? "");
        setDescription(ven.description ?? ""); setStatus(ven.status);
      }
      if (r.status === "fulfilled") setReturns(r.value.data.slice(0, 5));
      if (p.status === "fulfilled") setProducts(p.value.data);
    } finally { setLoading(false); }
  }, [id]);

  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.price * (p.stock ?? 0), 0),
    [products]
  );

  useEffect(() => { void load(); }, [load]);

  const { canRead } = useAuth();
  if (!canRead('Vendors')) return <AccessDenied />;

  const handleSave = async () => {
    if (!vendor) return;
    setSaving(true);
    try {
      const updated = await updateVendor(vendor.id, { name, email, phone, address, description, status });
      setVendor(updated);
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Update failed.");
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!vendor) return;
    Alert.alert("Delete vendor", `Delete ${vendor.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteVendor(vendor.id);
        router.replace("/vendors");
      }},
    ]);
  };

  if (loading || !vendor) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Vendor</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  const bg = avatarColor(vendor.id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{vendor.name}</Text>
        <Pressable
          style={styles.editBtn}
          onPress={() => editing ? handleSave() : setEditing(true)}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name={editing ? "checkmark" : "create-outline"} size={18} color="#fff" />
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: bg }]}>
            <Text style={styles.avatarText}>{initials(vendor.name)}</Text>
          </View>
          {editing ? (
            <View style={styles.editFields}>
              <EditField value={name} onChange={setName} placeholder="Vendor name" />
              <EditField value={email} onChange={setEmail} placeholder="Email" keyboardType="email-address" />
              <EditField value={phone} onChange={setPhone} placeholder="Phone" keyboardType="phone-pad" />
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{vendor.name}</Text>
              {vendor.email ? <Text style={styles.profileMeta}>{vendor.email}</Text> : null}
              {vendor.phone ? <Text style={styles.profileMeta}>{vendor.phone}</Text> : null}
              <View style={[styles.badge, vendor.status === "active" ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, vendor.status === "active" ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {vendor.status}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{products.length}</Text>
            <Text style={styles.statLabel}>Total Products</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatCurrency(inventoryValue)}</Text>
            <Text style={styles.statLabel}>Inventory Value</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatCurrency(vendor.totalPaid)}</Text>
            <Text style={styles.statLabel}>Total Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, vendor.amountPayable > 0 && { color: "#d97706" }]}>
              {formatCurrency(vendor.amountPayable)}
            </Text>
            <Text style={styles.statLabel}>Payable</Text>
          </View>
        </View>

        {/* Address */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Address</Text>
          {editing ? (
            <EditField value={address} onChange={setAddress} placeholder="Street address" />
          ) : (
            <Text style={styles.bodyText}>{vendor.address || "—"}</Text>
          )}
        </View>

        {/* Status toggle (edit) */}
        {editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <View style={styles.statusRow}>
              {(["active", "inactive"] as const).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.statusChip, status === s && styles.statusChipActive]}
                  onPress={() => setStatus(s)}
                >
                  <Text style={[styles.statusChipText, status === s && styles.statusChipTextActive]}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Description</Text>
          {editing ? (
            <TextInput
              style={styles.notesInput}
              value={description}
              onChangeText={setDescription}
              placeholder="Add description..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
          ) : (
            <Text style={styles.bodyText}>{vendor.description || "No description."}</Text>
          )}
        </View>

        {/* Products */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Products ({products.length})</Text>
          {products.length === 0 ? (
            <Text style={styles.bodyText}>No products for this vendor.</Text>
          ) : (
            products.map((p, i) => (
              <View key={p.id} style={[styles.productRow, i === 0 && { borderTopWidth: 0 }]}>
                {p.image ? (
                  <Image source={{ uri: p.image }} style={styles.productImage} />
                ) : (
                  <View style={styles.productImagePlaceholder}>
                    <Ionicons name="image-outline" size={16} color={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.productCategory}>{p.category || "—"}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 3 }}>
                  <Text style={styles.productPrice}>{formatCurrency(p.price)}</Text>
                  <Text style={styles.productStock}>Stock: {p.stock ?? 0}</Text>
                  <View style={[styles.sellingBadge, p.status !== "Selling" && styles.sellingBadgeOther]}>
                    <Text style={[styles.sellingBadgeText, p.status !== "Selling" && styles.sellingBadgeTextOther]}>
                      {p.status ?? "—"}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Recent Returns */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Recent Returns</Text>
            <Pressable onPress={() => router.push("/returns")}>
              <Text style={styles.seeAll}>See all</Text>
            </Pressable>
          </View>
          {returns.length === 0 ? (
            <Text style={styles.bodyText}>No returns found.</Text>
          ) : (
            returns.map((r, i) => {
              const tone = STATUS_COLORS[r.status] ?? { bg: "#f1f5f9", text: "#64748b" };
              return (
                <View key={r.id ?? i} style={styles.returnRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.returnNumber}>#{r.returnNumber ?? r.id}</Text>
                    <Text style={styles.returnDate}>{formatDateTime(r.createdAt)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    {r.totalAmount !== undefined && (
                      <Text style={styles.returnAmount}>{formatCurrency(r.totalAmount)}</Text>
                    )}
                    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusPillText, { color: tone.text }]}>{r.status.replace(/_/g, " ")}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Delete */}
        {!editing && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={17} color="#dc2626" />
            <Text style={styles.deleteBtnText}>Delete Vendor</Text>
          </Pressable>
        )}

        {editing && (
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setEditing(false); load(); }}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.saveBtn, saving && { opacity: 0.55 }]} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
            </Pressable>
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function EditField({ value, onChange, placeholder, keyboardType }: {
  value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: any;
}) {
  return (
    <TextInput
      style={styles.editInput}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      keyboardType={keyboardType}
      autoCapitalize="none"
    />
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  editBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  content: { padding: 16, gap: 14 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, padding: 16,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  profileInfo: { flex: 1, gap: 4 },
  editFields: { flex: 1, gap: 8 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  profileMeta: { color: colors.muted, fontSize: 13 },
  badge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: "#f1f5f9" },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: "#f1f5f9" },
  badgeText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  badgeTextActive: { color: "#16a34a" },
  badgeTextInactive: { color: "#64748b" },
  statsRow: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  seeAll: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  bodyText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  statusRow: { flexDirection: "row", gap: 10 },
  statusChip: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, alignItems: "center",
  },
  statusChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  statusChipText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  statusChipTextActive: { color: colors.primaryDark },
  notesInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 12, color: colors.text, fontSize: 14,
    minHeight: 80, textAlignVertical: "top",
  },
  productRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  productImage: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#f1f5f9" },
  productImagePlaceholder: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center",
  },
  productName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  productCategory: { color: colors.muted, fontSize: 11, marginTop: 2 },
  productPrice: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
  productStock: { color: colors.muted, fontSize: 11 },
  sellingBadge: { backgroundColor: "#dcfce7", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  sellingBadgeText: { color: "#16a34a", fontSize: 10, fontWeight: "700" },
  sellingBadgeOther: { backgroundColor: "#fee2e2" },
  sellingBadgeTextOther: { color: "#dc2626" },
  returnRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  returnNumber: { color: colors.text, fontSize: 14, fontWeight: "700" },
  returnDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  returnAmount: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  editInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 12, height: 42, color: colors.text,
    fontSize: 14, backgroundColor: "#f8fafc",
  },
  editActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, alignItems: "center",
  },
  cancelBtnText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  saveBtn: {
    flex: 2, borderRadius: 14, backgroundColor: colors.primary,
    paddingVertical: 14, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  deleteBtn: {
    borderRadius: 14, borderWidth: 1.5, borderColor: "#fca5a5",
    backgroundColor: "#fff5f5", paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  deleteBtnText: { color: "#dc2626", fontSize: 14, fontWeight: "700" },
});
