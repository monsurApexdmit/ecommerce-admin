import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { apiErrorMessage, apiFieldErrors, formatCompactDate, formatDateTime } from "@/lib/format";
import { useCurrency } from "@/context/CurrencyContext";
import {
  deleteCustomer,
  getCustomerById,
  getCustomerOrders,
  updateCustomer,
  validateCustomer,
  type Customer,
} from "@/services/customers";
import {
  CustomerFormFields,
  customerToForm,
  emptyCustomerForm,
  formToInput,
  type CustomerFormValues,
} from "@/components/customers/CustomerForm";
import { OrderStatusPill } from "@/components/orders/OrderStatusPill";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

const AVATAR_COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function avatarInitials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

export default function CustomerDetailScreen() {
  const { formatCurrency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form
  const [form, setForm] = useState<CustomerFormValues>(emptyCustomerForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = await getCustomerById(Number(id));
      setCustomer(c);
      setForm(customerToForm(c));
      setErrors({});
      // detail carries the 5 newest orders; fall back to the sales list for older servers
      if (c.recentOrders) {
        setOrders(c.recentOrders.map((o) => ({ id: o.id, invoiceNo: o.invoiceNo, orderTime: o.date, amount: o.amount, status: o.status })));
      } else {
        setOrders(await getCustomerOrders(Number(id)).catch(() => []));
      }
    } catch (err) {
      Alert.alert("Could not load customer", apiErrorMessage(err));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const { canRead, canWrite, canDelete } = useAuth();
  if (!canRead('Customers')) return <AccessDenied />;

  const onFormChange = (patch: Partial<CustomerFormValues>) => {
    setForm((v) => ({ ...v, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  };

  const handleSave = async () => {
    if (!customer) return;
    const input = formToInput(form, "update");
    const local = validateCustomer(input, "update");
    setErrors(local);
    if (Object.keys(local).length) {
      Alert.alert("Check the form", Object.values(local)[0]);
      return;
    }
    setSaving(true);
    try {
      const updated = await updateCustomer(customer.id, input);
      setCustomer({ ...updated, recentOrders: customer.recentOrders });
      setForm(customerToForm(updated));
      setEditing(false);
    } catch (err: any) {
      const fields = apiFieldErrors(err);
      if (Object.keys(fields).length) setErrors(fields);
      Alert.alert("Could not save", apiErrorMessage(err, "Update failed."));
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!customer) return;
    Alert.alert("Delete customer", `Delete ${customer.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteCustomer(customer.id);
          router.replace("/customers/");
        } catch (err) {
          // blocked when the customer has sales or returns
          Alert.alert("Could not delete", apiErrorMessage(err));
        }
      }},
    ]);
  };

  if (loading || !customer) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Customer</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  const bg = avatarColor(customer.id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{customer.name}</Text>
        <Pressable
          style={[styles.editBtn, !canWrite("Customers") && { opacity: 0 }]}
          disabled={!canWrite("Customers")}
          onPress={() => editing ? handleSave() : setEditing(true)}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name={editing ? "checkmark" : "create-outline"} size={18} color="#fff" />
          }
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {editing ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit customer</Text>
            <CustomerFormFields values={form} onChange={onFormChange} errors={errors} mode="update" />
          </View>
        ) : (
          <>
            {/* Profile card */}
            <View style={styles.profileCard}>
              <View style={[styles.avatar, { backgroundColor: bg }]}>
                <Text style={styles.avatarText}>{avatarInitials(customer.name)}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{customer.name}</Text>
                {customer.type === "business" && customer.businessName ? (
                  <Text style={styles.profileMeta}>{customer.businessName}{customer.licenceBin ? ` · BIN ${customer.licenceBin}` : ""}</Text>
                ) : null}
                {customer.phone ? <Text style={styles.profileMeta}>{customer.phone}</Text> : null}
                {customer.email ? <Text style={styles.profileEmail}>{customer.email}</Text> : null}
                <View style={styles.profileBadges}>
                  <View style={[styles.badge, customer.status === "active" ? styles.badgeActive : styles.badgeInactive]}>
                    <Text style={[styles.badgeText, customer.status === "active" ? styles.badgeTextActive : styles.badgeTextInactive]}>
                      {customer.status}
                    </Text>
                  </View>
                  <View style={[styles.badge, customer.customerGroup === "vip" && { backgroundColor: "#fae8ff" }]}>
                    <Text style={[styles.badgeText, customer.customerGroup === "vip" && { color: "#a21caf" }]}>
                      {customer.customerGroup === "vip" ? "VIP" : customer.customerGroup}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{customer.type}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{customer.totalOrders ?? orders.length}</Text>
                <Text style={styles.statLabel}>Orders</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatCurrency(customer.totalSpent ?? 0)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statValue, Number(customer.dueAmount ?? 0) > 0 && { color: "#dc2626" }]}>
                  {formatCurrency(Number(customer.dueAmount ?? 0))}
                </Text>
                <Text style={styles.statLabel}>Due</Text>
              </View>
            </View>

            {/* Account */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account</Text>
              <InfoRow label="Credit limit" value={customer.creditLimit > 0 ? formatCurrency(customer.creditLimit) : "No limit"} />
              {customer.creditLimit > 0 ? (
                <InfoRow label="Credit used" value={`${formatCurrency(customer.creditUsed)} (${Math.round(customer.creditUsedPercent)}%)`} />
              ) : null}
              {customer.openingBalance > 0 ? <InfoRow label="Opening balance" value={formatCurrency(customer.openingBalance)} /> : null}
              <InfoRow label="Store credit" value={formatCurrency(customer.storeCredit)} />
              <InfoRow label="Birthday" value={customer.birthday ? formatCompactDate(customer.birthday) : "—"} />
              <InfoRow label="SMS opt-in" value={customer.smsOptIn ? "Yes" : "No"} />
              {customer.lastOrderAt ? <InfoRow label="Last order" value={formatDateTime(customer.lastOrderAt)} /> : null}
              {customer.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {customer.tags.map((t) => (
                    <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Address */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Address</Text>
              <InfoRow label="Address" value={customer.address || "—"} />
              <InfoRow label="Area" value={customer.area || "—"} />
              <InfoRow label="District" value={customer.district || "—"} />
              <InfoRow label="City" value={customer.city || "—"} />
              <InfoRow label="Country" value={customer.country || "—"} />
            </View>

            {/* Notes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Notes</Text>
              <Text style={styles.notesText}>{customer.notes || "No notes."}</Text>
            </View>
          </>
        )}

        {/* Recent orders */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Orders</Text>
          {orders.length === 0 ? (
            <Text style={styles.emptyText}>No orders found.</Text>
          ) : (
            orders.slice(0, 5).map((o, i) => (
              <Pressable
                key={o.id ?? i}
                style={styles.orderRow}
                onPress={() => router.push(`/orders/${o.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderInvoice}>#{o.invoiceNo ?? o.invoice_no ?? o.id}</Text>
                  <Text style={styles.orderDate}>{formatDateTime(o.orderTime ?? o.order_time ?? o.createdAt)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.orderAmount}>{formatCurrency(Number(o.amount ?? 0))}</Text>
                  <OrderStatusPill status={o.status} />
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Delete */}
        {!editing && canDelete("Customers") && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={17} color="#dc2626" />
            <Text style={styles.deleteBtnText}>Delete Customer</Text>
          </Pressable>
        )}

        {editing && (
          <View style={styles.editActions}>
            <Pressable style={styles.cancelBtn} onPress={() => { setEditing(false); setForm(customerToForm(customer)); setErrors({}); }}>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
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
  profileInfo: { flex: 1, gap: 3 },
  editFields: { flex: 1, gap: 8 },
  profileName: { color: colors.text, fontSize: 17, fontWeight: "800" },
  profileEmail: { color: colors.muted, fontSize: 13 },
  profileMeta: { color: colors.muted, fontSize: 13 },
  profileBadges: { flexDirection: "row", gap: 6, marginTop: 4 },
  badge: {
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    backgroundColor: "#f1f5f9",
  },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: "#f1f5f9" },
  badgeText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  badgeTextActive: { color: "#16a34a" },
  badgeTextInactive: { color: "#64748b" },
  statsRow: {
    flexDirection: "row", backgroundColor: colors.surface,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 16,
  },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  statLabel: { color: colors.muted, fontSize: 11 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tag: { borderRadius: 999, backgroundColor: "#f1f5f9", paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { color: colors.text, fontSize: 12, fontWeight: "600" },
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
  notesText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  orderRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  orderInvoice: { color: colors.text, fontSize: 14, fontWeight: "700" },
  orderDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  orderAmount: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13 },
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
