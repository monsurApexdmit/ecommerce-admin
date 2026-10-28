import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage, apiFieldErrors, formatDateTime } from "@/lib/format";
import { getOrderFollowUps, logOrderFollowUp } from "@/services/order-service";
import type { FollowUpChannel, FollowUpOutcome, Order, OrderFollowUp } from "@/types/order";
import {
  FOLLOW_UP_CHANNELS,
  FOLLOW_UP_OUTCOMES,
  NOTE_REQUIRED_OUTCOMES,
  followUpChannelLabel,
  followUpOutcomeLabel,
  orderPhone,
  telUrl,
} from "./order-utils";

type Props = {
  order: Order | null;
  onClose: () => void;
  /** Called with the refreshed order after a follow-up is saved. */
  onSaved?: (order: Order) => void;
};

type QuickPick = { label: string; at: () => Date };

function at(days: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

const QUICK_PICKS: QuickPick[] = [
  { label: "+1 hour", at: () => new Date(Date.now() + 60 * 60 * 1000) },
  { label: "+3 hours", at: () => new Date(Date.now() + 3 * 60 * 60 * 1000) },
  { label: "Today 6 pm", at: () => at(0, 18) },
  { label: "Tomorrow 10 am", at: () => at(1, 10) },
  { label: "Tomorrow 4 pm", at: () => at(1, 16) },
  { label: "In 2 days", at: () => at(2, 10) },
];

const pad = (n: number) => String(n).padStart(2, "0");
const toInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Parses "YYYY-MM-DD HH:mm" (local time). */
function parseInput(v: string): Date | null {
  const m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Previous follow-ups, newest first. */
export function FollowUpHistory({ items, loading }: { items: OrderFollowUp[]; loading?: boolean }) {
  if (loading) return <ActivityIndicator color={colors.primaryDark} style={{ paddingVertical: 12 }} />;
  if (items.length === 0) {
    return (
      <View style={s.historyEmpty}>
        <Ionicons name="call-outline" size={18} color={colors.muted} />
        <Text style={s.historyEmptyText}>No follow-ups yet. Calls you log appear here.</Text>
      </View>
    );
  }
  return (
    <View style={s.historyList}>
      {items.map((f, i) => {
        const meta = FOLLOW_UP_OUTCOMES.find((o) => o.value === f.outcome);
        return (
          <View key={f.id} style={[s.historyItem, i < items.length - 1 && s.historyItemBorder]}>
            <View style={s.historyTop}>
              <View style={[s.outcomePill, { backgroundColor: (meta?.color ?? colors.muted) + "1a" }]}>
                <Text style={[s.outcomePillText, { color: meta?.color ?? colors.muted }]}>{followUpOutcomeLabel(f.outcome)}</Text>
              </View>
              <Text style={s.historyMeta} numberOfLines={1}>
                {followUpChannelLabel(f.channel)} · {f.staffName || "Staff"} · {formatDateTime(f.createdAt)}
              </Text>
            </View>
            {f.note ? <Text style={s.historyNote}>{f.note}</Text> : null}
            {f.nextFollowUpAt ? <Text style={s.historyNext}>Next follow-up: {formatDateTime(f.nextFollowUpAt)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/** Loads an order's follow-up history; bump `reloadKey` to refetch. */
export function useFollowUps(sellId: number | null | undefined, reloadKey = 0) {
  const [items, setItems] = useState<OrderFollowUp[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sellId) { setItems([]); return; }
    let live = true;
    setLoading(true);
    getOrderFollowUps(sellId)
      .then((r) => { if (live) setItems(r); })
      .catch(() => { if (live) setItems([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [sellId, reloadKey]);
  return { items, loading };
}

/** Log a confirmation call for an order: outcome, channel, note, next call-back, plus the call history. */
export function FollowUpSheet({ order, onClose, onSaved }: Props) {
  const insets = useSafeAreaInsets();
  const { formatCurrency } = useCurrency();
  const history = useFollowUps(order?.id);
  const [outcome, setOutcome] = useState<FollowUpOutcome | "">("");
  const [channel, setChannel] = useState<FollowUpChannel>("call");
  const [note, setNote] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOutcome(""); setChannel("call"); setNote(""); setNext(""); setErrors({});
  }, [order?.id]);

  const phone = order ? orderPhone(order) : "";
  const isCod = order ? String(order.method).toUpperCase() === "COD" || /cash on delivery/i.test(order.method) : false;
  const noteRequired = !!outcome && NOTE_REQUIRED_OUTCOMES.includes(outcome);
  const nextDate = useMemo(() => parseInput(next), [next]);

  const call = async () => {
    if (!phone) return;
    const url = telUrl(phone);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot start a call", `Dial ${phone} manually.`);
    }
  };

  const save = async () => {
    if (!order) return;
    const err: Record<string, string> = {};
    if (!outcome) err.outcome = "Pick what happened.";
    if (noteRequired && !note.trim()) err.note = "Add a note for this outcome.";
    if (note.length > 1000) err.note = "Note must be 1000 characters or fewer.";
    if (outcome === "call_later") {
      if (!next.trim()) err.next = "Pick when to call back.";
      else if (!nextDate) err.next = "Use the format YYYY-MM-DD HH:mm.";
      else if (nextDate.getTime() <= Date.now()) err.next = "The next follow-up must be in the future.";
    }
    setErrors(err);
    if (Object.keys(err).length || !outcome) return;
    setSaving(true);
    try {
      const res = await logOrderFollowUp(order.id, {
        outcome,
        channel,
        note: note.trim() || undefined,
        nextFollowUpAt: outcome === "call_later" && nextDate ? nextDate.toISOString() : undefined,
      });
      onSaved?.(res.order);
      onClose();
    } catch (e) {
      const fields = apiFieldErrors(e);
      if (Object.keys(fields).length) {
        setErrors({ outcome: fields.outcome ?? "", note: fields.note ?? "", next: fields.nextFollowUpAt ?? "" });
      }
      Alert.alert("Could not save follow-up", apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const saveLabel = saving
    ? "Saving…"
    : outcome === "confirmed" ? "Save & confirm order"
    : outcome === "customer_cancelled" ? "Save & cancel order"
    : "Save follow-up";

  return (
    <Modal visible={!!order} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Follow up #{order?.invoiceNo}</Text>
              <Text style={s.subtitle}>Call the customer to confirm, then log what happened.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {order ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
              <View style={s.infoCard}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={s.infoName} numberOfLines={1}>{order.shippingFullName || order.customerName}</Text>
                  <Text style={s.infoMeta}>{phone || "No phone on this order"}</Text>
                  <Text style={s.infoMeta}>
                    {formatCurrency(Number(order.amount ?? 0))} · {isCod ? "Cash on delivery" : order.method}
                  </Text>
                </View>
                {phone ? (
                  <Pressable style={s.callBtn} onPress={() => void call()}>
                    <Ionicons name="call" size={16} color="#fff" />
                    <Text style={s.callBtnText}>Call</Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={s.label}>Outcome *</Text>
              <View style={s.outcomeGrid}>
                {FOLLOW_UP_OUTCOMES.map((o) => {
                  const active = outcome === o.value;
                  return (
                    <Pressable
                      key={o.value}
                      style={[s.outcomeCard, active && { borderColor: o.color, backgroundColor: o.color + "12" }]}
                      onPress={() => { setOutcome(o.value); setErrors({}); }}
                    >
                      <Ionicons name={o.icon as any} size={18} color={active ? o.color : colors.muted} />
                      <Text style={[s.outcomeTitle, active && { color: o.color }]}>{o.label}</Text>
                      <Text style={s.outcomeDesc} numberOfLines={2}>{o.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {errors.outcome ? <Text style={s.error}>{errors.outcome}</Text> : null}

              <Text style={s.label}>Channel</Text>
              <View style={s.segment}>
                {FOLLOW_UP_CHANNELS.map((c) => (
                  <Pressable key={c.value} style={[s.segmentItem, channel === c.value && s.segmentItemActive]} onPress={() => setChannel(c.value)}>
                    <Text style={[s.segmentText, channel === c.value && s.segmentTextActive]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>

              {outcome === "call_later" ? (
                <>
                  <Text style={s.label}>Next follow-up *</Text>
                  <View style={s.quickRow}>
                    {QUICK_PICKS.map((q) => {
                      const d = q.at();
                      if (d.getTime() <= Date.now()) return null;
                      const value = toInput(d);
                      const active = next === value;
                      return (
                        <Pressable key={q.label} style={[s.quickChip, active && s.quickChipActive]} onPress={() => { setNext(value); setErrors((x) => ({ ...x, next: "" })); }}>
                          <Text style={[s.quickChipText, active && s.quickChipTextActive]}>{q.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <TextInput
                    style={[s.input, errors.next ? s.inputError : null]}
                    value={next}
                    onChangeText={(v) => { setNext(v); setErrors((x) => ({ ...x, next: "" })); }}
                    placeholder="YYYY-MM-DD HH:mm"
                    placeholderTextColor="#94a3b8"
                    autoCapitalize="none"
                  />
                  {nextDate && !errors.next ? <Text style={s.hint}>Call back {formatDateTime(nextDate.toISOString())}</Text> : null}
                  {errors.next ? <Text style={s.error}>{errors.next}</Text> : null}
                </>
              ) : null}

              <Text style={s.label}>Note{noteRequired ? " *" : ""}</Text>
              <TextInput
                style={[s.input, s.inputMulti, errors.note ? s.inputError : null]}
                value={note}
                onChangeText={(v) => { setNote(v); setErrors((x) => ({ ...x, note: "" })); }}
                placeholder="What did the customer say?"
                placeholderTextColor="#94a3b8"
                multiline
              />
              {errors.note ? (
                <Text style={s.error}>{errors.note}</Text>
              ) : outcome === "customer_cancelled" ? (
                <Text style={[s.hint, { color: colors.danger }]}>The order will be cancelled and its stock returned.</Text>
              ) : (
                <Text style={[s.hint, note.length > 1000 && { color: colors.danger }]}>{note.length}/1000</Text>
              )}

              <Text style={[s.label, { marginTop: 6 }]}>Previous follow-ups</Text>
              <FollowUpHistory items={history.items} loading={history.loading} />
            </ScrollView>
          ) : null}

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Close</Text>
            </Pressable>
            <Pressable
              style={[s.saveBtn, outcome === "customer_cancelled" && { backgroundColor: colors.danger }, (saving || !order) && { opacity: 0.55 }]}
              onPress={() => void save()}
              disabled={saving || !order}
            >
              <Text style={s.saveBtnText}>{saveLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "92%", backgroundColor: colors.surface,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 18, paddingTop: 10, gap: 10,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: colors.text, fontSize: 19, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  body: { gap: 10, paddingBottom: 12 },
  infoCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 14,
  },
  infoName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  infoMeta: { color: colors.muted, fontSize: 12 },
  callBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primaryDark, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  callBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  outcomeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  outcomeCard: {
    width: "48.5%", borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.surface, padding: 10, gap: 3,
  },
  outcomeTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  outcomeDesc: { color: colors.muted, fontSize: 11, lineHeight: 15 },
  segment: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  segmentItemActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryDark },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: colors.primaryDark },
  quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quickChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 7 },
  quickChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  quickChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  quickChipTextActive: { color: colors.primaryDark },
  input: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, color: colors.text, fontSize: 14,
  },
  inputMulti: { minHeight: 84, paddingVertical: 10, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  historyList: { borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  historyItem: { padding: 12, gap: 4 },
  historyItemBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  historyTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  outcomePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  outcomePillText: { fontSize: 11, fontWeight: "800" },
  historyMeta: { flex: 1, color: colors.muted, fontSize: 11 },
  historyNote: { color: colors.text, fontSize: 13, lineHeight: 18 },
  historyNext: { color: colors.muted, fontSize: 11 },
  historyEmpty: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: colors.border, padding: 14,
  },
  historyEmptyText: { color: colors.muted, fontSize: 12, flex: 1 },
  actions: { flexDirection: "row", gap: 10, paddingTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingVertical: 14, alignItems: "center",
  },
  cancelBtnText: { color: colors.text, fontWeight: "700" },
  saveBtn: { flex: 2, borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 14, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800" },
});
