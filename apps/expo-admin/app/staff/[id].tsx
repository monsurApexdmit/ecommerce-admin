import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  deleteStaff,
  getStaffById,
  getSalaryPayments,
  updateStaff,
  type SalaryPayment,
  type StaffMember,
} from "@/services/staff";
import { useAuth } from "@/context/AuthContext";
import { AccessDenied } from "@/components/AccessDenied";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

const SALARY_STATUS_COLORS = {
  Paid: { bg: "#dcfce7", text: "#16a34a" },
  Pending: { bg: "#fef3c7", text: "#d97706" },
  Partial: { bg: "#dbeafe", text: "#1d4ed8" },
};

export default function StaffDetailScreen() {
  const { formatCurrency } = useCurrency();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [member, setMember] = useState<StaffMember | null>(null);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [role, setRole] = useState("");
  const [salary, setSalary] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p] = await Promise.allSettled([
        getStaffById(Number(id)),
        getSalaryPayments({ staffId: Number(id), limit: 6 }),
      ]);
      if (m.status === "fulfilled") {
        const s = m.value;
        setMember(s);
        setName(s.name); setEmail(s.email ?? "");
        setContact(s.contact ?? ""); setRole(s.role ?? "");
        setSalary(String(s.salary)); setPaymentMethod(s.paymentMethod ?? "bank_transfer");
        setBankAccount(s.bankAccount ?? ""); setStatus(s.status);
      }
      if (p.status === "fulfilled") setPayments(p.value.data.slice(0, 6));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const { canRead } = useAuth();
  if (!canRead('Staff')) return <AccessDenied />;

  const handleSave = async () => {
    if (!member) return;
    setSaving(true);
    try {
      const updated = await updateStaff(member.id, {
        name, email, contact, role,
        salary: Number(salary), paymentMethod, bankAccount, status,
      });
      setMember(updated);
      setEditing(false);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Update failed.");
    } finally { setSaving(false); }
  };

  const handleDelete = () => {
    if (!member) return;
    Alert.alert("Delete staff", `Delete ${member.name}? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        await deleteStaff(member.id);
        router.replace("/staff");
      }},
    ]);
  };

  if (loading || !member) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Staff</Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      </SafeAreaView>
    );
  }

  const bg = avatarColor(member.id);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{member.name}</Text>
        <Pressable style={styles.editBtn} onPress={() => editing ? handleSave() : setEditing(true)}>
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
            <Text style={styles.avatarText}>{initials(member.name)}</Text>
          </View>
          {editing ? (
            <View style={styles.editFields}>
              <EF value={name} onChange={setName} placeholder="Full name" />
              <EF value={email} onChange={setEmail} placeholder="Email" keyboardType="email-address" />
              <EF value={contact} onChange={setContact} placeholder="Phone" keyboardType="phone-pad" />
            </View>
          ) : (
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{member.name}</Text>
              {member.role ? <Text style={styles.profileRole}>{member.role}</Text> : null}
              {member.email ? <Text style={styles.profileMeta}>{member.email}</Text> : null}
              {member.contact ? <Text style={styles.profileMeta}>{member.contact}</Text> : null}
              <View style={[styles.badge, member.status === "Active" ? styles.badgeActive : styles.badgeInactive]}>
                <Text style={[styles.badgeText, member.status === "Active" ? styles.badgeTextActive : styles.badgeTextInactive]}>
                  {member.status}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Salary stat */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatCurrency(member.salary)}</Text>
            <Text style={styles.statLabel}>Monthly Salary</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{member.paymentMethod?.replace(/_/g, " ") ?? "—"}</Text>
            <Text style={styles.statLabel}>Payment Method</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {member.joiningDate ? new Date(member.joiningDate).getFullYear() : "—"}
            </Text>
            <Text style={styles.statLabel}>Joined</Text>
          </View>
        </View>

        {/* Role & employment details */}
        {editing ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Details</Text>
            <View style={{ gap: 10 }}>
              <EF value={role} onChange={setRole} placeholder="Role / Position" />
              <EF value={salary} onChange={setSalary} placeholder="Monthly salary" keyboardType="decimal-pad" />
              <EF value={bankAccount} onChange={setBankAccount} placeholder="Bank account number" />
              <View>
                <Text style={styles.fieldLabel}>Payment Method</Text>
                <View style={styles.methodRow}>
                  {["bank_transfer", "cash", "cheque"].map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]}
                      onPress={() => setPaymentMethod(m)}
                    >
                      <Text style={[styles.methodChipText, paymentMethod === m && styles.methodChipTextActive]}>
                        {m.replace("_", " ")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Employment Details</Text>
            <InfoRow label="Role" value={member.role || "—"} />
            <InfoRow label="Joining Date" value={member.joiningDate ? new Date(member.joiningDate).toLocaleDateString() : "—"} />
            <InfoRow label="Bank Account" value={member.bankAccount || "—"} />
          </View>
        )}

        {/* Status (edit mode) */}
        {editing && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Status</Text>
            <View style={styles.statusRow}>
              {(["Active", "Inactive"] as const).map((s) => (
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

        {/* Salary history */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>Salary History</Text>
            <Pressable onPress={() => router.push("/salary")}>
              <Text style={styles.seeAll}>Manage →</Text>
            </Pressable>
          </View>
          {payments.length === 0 ? (
            <Text style={styles.bodyText}>No payments recorded.</Text>
          ) : (
            payments.map((p, i) => {
              const tone = SALARY_STATUS_COLORS[p.status] ?? { bg: "#f1f5f9", text: "#64748b" };
              return (
                <View key={p.id ?? i} style={styles.paymentRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.paymentMonth}>{p.month}</Text>
                    {p.paymentDate && <Text style={styles.paymentDate}>{new Date(p.paymentDate).toLocaleDateString()}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={styles.paymentAmount}>{formatCurrency(p.paidAmount)}</Text>
                    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusPillText, { color: tone.text }]}>{p.status}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Delete / Save actions */}
        {!editing && (
          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={17} color="#dc2626" />
            <Text style={styles.deleteBtnText}>Delete Staff Member</Text>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EF({ value, onChange, placeholder, keyboardType }: {
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
  profileRole: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
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
  statValue: { color: colors.text, fontSize: 13, fontWeight: "800", textAlign: "center" },
  statLabel: { color: colors.muted, fontSize: 11, textAlign: "center" },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10,
  },
  cardTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  seeAll: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  bodyText: { color: colors.muted, fontSize: 13 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, alignItems: "center",
  },
  methodChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  methodChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  methodChipTextActive: { color: colors.primaryDark },
  infoRow: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  statusRow: { flexDirection: "row", gap: 10 },
  statusChip: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 10, alignItems: "center",
  },
  statusChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  statusChipText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  statusChipTextActive: { color: colors.primaryDark },
  paymentRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paymentMonth: { color: colors.text, fontSize: 14, fontWeight: "700" },
  paymentDate: { color: colors.muted, fontSize: 12, marginTop: 2 },
  paymentAmount: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
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
