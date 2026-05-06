import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
  createSalaryPayment,
  deleteSalaryPayment,
  getStaff,
  getSalaryPayments,
  updateSalaryPayment,
  type SalaryPayment,
  type StaffMember,
} from "@/services/staff";

const AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase(); }

function buildMonthOptions(): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return d.toLocaleString("en-US", { month: "short" }) + " " + d.getFullYear();
  });
}

const MONTH_OPTIONS = buildMonthOptions();

const STATUS_COLORS = {
  Paid: { bg: "#dcfce7", text: "#16a34a" },
  Pending: { bg: "#fef3c7", text: "#d97706" },
  Partial: { bg: "#dbeafe", text: "#1d4ed8" },
};

export default function SalaryScreen() {
  const { formatCurrency } = useCurrency();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(MONTH_OPTIONS[0]);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const [payModalStaff, setPayModalStaff] = useState<StaffMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.allSettled([
        getStaff({ limit: 100 }),
        getSalaryPayments({ month: selectedMonth, limit: 100 }),
      ]);
      if (s.status === "fulfilled") setStaff(s.value.data);
      if (p.status === "fulfilled") setPayments(p.value.data);
    } finally { setLoading(false); }
  }, [selectedMonth]);

  useEffect(() => { void load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Merge staff with their payment for this month
  const staffWithPayment = useMemo(() =>
    staff.map((s) => ({
      staff: s,
      payment: payments.find((p) => p.staffId === s.id) ?? null,
    })),
    [staff, payments]
  );

  const totals = useMemo(() => {
    const budget = staff.reduce((sum, s) => sum + s.salary, 0);
    const paid = payments.filter((p) => p.status === "Paid").reduce((sum, p) => sum + p.paidAmount, 0);
    const partial = payments.filter((p) => p.status === "Partial").reduce((sum, p) => sum + p.paidAmount, 0);
    const pending = budget - paid - partial;
    return { budget, paid, partial, pending: Math.max(0, pending) };
  }, [staff, payments]);

  const handleMarkPaid = async (s: StaffMember) => {
    const existing = payments.find((p) => p.staffId === s.id);
    const paymentDate = new Date().toISOString().split("T")[0];
    try {
      if (existing) {
        await updateSalaryPayment(existing.id, {
          amount: s.salary, paidAmount: s.salary,
          status: "Paid", paymentDate, paymentMethod: s.paymentMethod,
        });
      } else {
        await createSalaryPayment({
          staffId: s.id, month: selectedMonth,
          amount: s.salary, paidAmount: s.salary,
          status: "Paid", paymentDate, paymentMethod: s.paymentMethod,
        });
      }
      load();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Payment update failed.");
    }
  };

  const handleOpenPayModal = (s: StaffMember) => {
    setPayModalStaff(s);
  };

  const openPaymentMenu = (s: StaffMember, payment: SalaryPayment | null) => {
    const opts: any[] = [];
    if (!payment || payment.status !== "Paid") {
      opts.push({ text: "Mark as Paid", onPress: () => handleMarkPaid(s) });
      opts.push({ text: "Custom Payment", onPress: () => handleOpenPayModal(s) });
    }
    if (payment) {
      opts.push({
        text: "Delete Payment", style: "destructive", onPress: () =>
          Alert.alert("Delete payment?", undefined, [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: async () => { await deleteSalaryPayment(payment.id); load(); } },
          ])
      });
    }
    opts.push({ text: "View Staff Profile", onPress: () => router.push(`/staff/${s.id}` as any) });
    opts.push({ text: "Cancel", style: "cancel" });
    Alert.alert(s.name, `Salary: ${formatCurrency(s.salary)}/mo`, opts);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Salary Management</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Month selector */}
      <Pressable style={styles.monthSelector} onPress={() => setMonthPickerOpen(true)}>
        <Ionicons name="calendar-outline" size={16} color={colors.primaryDark} />
        <Text style={styles.monthText}>{selectedMonth}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      {/* Summary cards */}
      <View style={styles.summaryRow}>
        <SumCard label="Budget" value={totals.budget} bg="#eff6ff" text="#1d4ed8" />
        <SumCard label="Paid" value={totals.paid} bg="#dcfce7" text="#16a34a" />
        <SumCard label="Pending" value={totals.pending} bg="#fef3c7" text="#d97706" />
      </View>

      {/* Progress bar */}
      {totals.budget > 0 && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(100, (totals.paid / totals.budget) * 100)}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>
            {Math.round((totals.paid / totals.budget) * 100)}% paid this month
          </Text>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <FlatList
          data={staffWithPayment}
          keyExtractor={(item) => String(item.staff.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item: { staff: s, payment } }) => {
            const tone = payment ? STATUS_COLORS[payment.status] : STATUS_COLORS.Pending;
            const isPaid = payment?.status === "Paid";
            return (
              <Pressable
                style={styles.card}
                onPress={() => openPaymentMenu(s, payment)}
              >
                <View style={[styles.avatar, { backgroundColor: avatarColor(s.id) }]}>
                  <Text style={styles.avatarText}>{initials(s.name)}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <View style={styles.cardTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardName} numberOfLines={1}>{s.name}</Text>
                      {s.role ? <Text style={styles.cardRole}>{s.role}</Text> : null}
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={styles.salaryText}>{formatCurrency(s.salary)}</Text>
                      <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.statusPillText, { color: tone.text }]}>
                          {payment?.status ?? "Pending"}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {payment && (
                    <View style={styles.paymentDetail}>
                      <Text style={styles.paymentDetailText}>
                        Paid: {formatCurrency(payment.paidAmount)}
                        {payment.paymentDate ? ` · ${new Date(payment.paymentDate).toLocaleDateString()}` : ""}
                        {payment.paymentMethod ? ` · ${payment.paymentMethod.replace(/_/g, " ")}` : ""}
                      </Text>
                    </View>
                  )}
                  {!isPaid && (
                    <Pressable
                      style={styles.payNowBtn}
                      onPress={() => handleMarkPaid(s)}
                    >
                      <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                      <Text style={styles.payNowText}>Mark as Paid</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>No staff members</Text>
              <Text style={styles.emptyText}>Add staff to manage salary.</Text>
            </View>
          }
        />
      )}

      {/* Month picker modal */}
      <Modal visible={monthPickerOpen} transparent animationType="fade" onRequestClose={() => setMonthPickerOpen(false)}>
        <Pressable style={mStyles.backdrop} onPress={() => setMonthPickerOpen(false)} />
        <View style={mStyles.pickerBox}>
          <Text style={mStyles.pickerTitle}>Select Month</Text>
          <ScrollView>
            {MONTH_OPTIONS.map((m) => (
              <Pressable
                key={m}
                style={[mStyles.pickerItem, m === selectedMonth && mStyles.pickerItemActive]}
                onPress={() => { setSelectedMonth(m); setMonthPickerOpen(false); }}
              >
                <Text style={[mStyles.pickerItemText, m === selectedMonth && mStyles.pickerItemTextActive]}>{m}</Text>
                {m === selectedMonth && <Ionicons name="checkmark" size={16} color={colors.primaryDark} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* Custom pay modal */}
      {payModalStaff && (
        <CustomPayModal
          staff={payModalStaff}
          month={selectedMonth}
          existing={payments.find((p) => p.staffId === payModalStaff.id) ?? null}
          onClose={() => setPayModalStaff(null)}
          onSaved={() => { setPayModalStaff(null); load(); }}
        />
      )}
    </SafeAreaView>
  );
}

function SumCard({ label, value, bg, text }: { label: string; value: number; bg: string; text: string }) {
  const { formatCurrency } = useCurrency();
  return (
    <View style={[sumStyles.card, { backgroundColor: bg }]}>
      <Text style={[sumStyles.value, { color: text }]}>{formatCurrency(value)}</Text>
      <Text style={[sumStyles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const sumStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  value: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 11, fontWeight: "700" },
});

function CustomPayModal({ staff: s, month, existing, onClose, onSaved }: {
  staff: StaffMember; month: string;
  existing: SalaryPayment | null;
  onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(existing?.amount ?? s.salary));
  const [paidAmount, setPaidAmount] = useState(String(existing?.paidAmount ?? s.salary));
  const [status, setStatus] = useState<"Paid" | "Pending" | "Partial">(existing?.status ?? "Paid");
  const [method, setMethod] = useState(existing?.paymentMethod ?? s.paymentMethod ?? "bank_transfer");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const paymentDate = new Date().toISOString().split("T")[0];
      if (existing) {
        await updateSalaryPayment(existing.id, {
          amount: Number(amount), paidAmount: Number(paidAmount),
          status, paymentMethod: method, paymentDate, notes: notes || undefined,
        });
      } else {
        await createSalaryPayment({
          staffId: s.id, month,
          amount: Number(amount), paidAmount: Number(paidAmount),
          status, paymentMethod: method, paymentDate, notes: notes || undefined,
        });
      }
      onSaved();
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Failed to save payment.");
    } finally { setSaving(false); }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <View style={mStyles.sheet}>
        <View style={mStyles.sheetHeader}>
          <Text style={mStyles.sheetTitle}>{existing ? "Edit Payment" : "Record Payment"}</Text>
          <Pressable onPress={onClose} style={mStyles.closeBtn}>
            <Ionicons name="close" size={18} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={mStyles.fields} keyboardShouldPersistTaps="handled">
          <Text style={mStyles.staffName}>{s.name} · {month}</Text>

          <View style={{ gap: 4 }}>
            <Text style={mStyles.fieldLabel}>Salary Amount</Text>
            <TextInput style={mStyles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={mStyles.fieldLabel}>Paid Amount</Text>
            <TextInput style={mStyles.input} value={paidAmount} onChangeText={setPaidAmount} keyboardType="decimal-pad" />
          </View>

          <View>
            <Text style={mStyles.fieldLabel}>Status</Text>
            <View style={mStyles.methodRow}>
              {(["Paid", "Partial", "Pending"] as const).map((st) => (
                <Pressable
                  key={st}
                  style={[mStyles.methodChip, status === st && mStyles.methodChipActive]}
                  onPress={() => setStatus(st)}
                >
                  <Text style={[mStyles.methodChipText, status === st && mStyles.methodChipTextActive]}>{st}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View>
            <Text style={mStyles.fieldLabel}>Payment Method</Text>
            <View style={mStyles.methodRow}>
              {["bank_transfer", "cash", "cheque"].map((m) => (
                <Pressable
                  key={m}
                  style={[mStyles.methodChip, method === m && mStyles.methodChipActive]}
                  onPress={() => setMethod(m)}
                >
                  <Text style={[mStyles.methodChipText, method === m && mStyles.methodChipTextActive]}>
                    {m.replace("_", " ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 4 }}>
            <Text style={mStyles.fieldLabel}>Notes</Text>
            <TextInput
              style={[mStyles.input, { height: 70, textAlignVertical: "top", paddingTop: 10 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes..."
              placeholderTextColor="#94a3b8"
              multiline
            />
          </View>

          <Pressable style={[mStyles.saveBtn, saving && { opacity: 0.55 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={mStyles.saveBtnText}>Save Payment</Text>}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  pickerBox: {
    position: "absolute", top: "20%", left: 32, right: 32,
    backgroundColor: colors.surface, borderRadius: 18,
    maxHeight: "60%", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  pickerTitle: { color: colors.text, fontSize: 16, fontWeight: "800", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItemActive: { backgroundColor: "#ecfdf5" },
  pickerItemText: { color: colors.text, fontSize: 15 },
  pickerItemTextActive: { color: colors.primaryDark, fontWeight: "700" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  fields: { padding: 20, gap: 14, paddingBottom: 32 },
  staffName: { color: colors.primaryDark, fontSize: 15, fontWeight: "800", marginBottom: 4 },
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
  monthSelector: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 16, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  monthText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "800" },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  progressWrap: { paddingHorizontal: 16, marginBottom: 10 },
  progressBar: { height: 6, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#16a34a", borderRadius: 999 },
  progressLabel: { color: colors.muted, fontSize: 11, marginTop: 4, textAlign: "right" },
  listContent: { padding: 16, paddingTop: 4 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cardInfo: { flex: 1, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardName: { color: colors.text, fontSize: 15, fontWeight: "700" },
  cardRole: { color: colors.muted, fontSize: 12 },
  salaryText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  paymentDetail: { backgroundColor: "#f8fafc", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  paymentDetailText: { color: colors.muted, fontSize: 12 },
  payNowBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: colors.primaryDark, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start",
  },
  payNowText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13 },
});
