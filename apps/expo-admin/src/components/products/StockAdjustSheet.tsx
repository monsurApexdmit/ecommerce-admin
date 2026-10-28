import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
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
import { colors } from "@/constants/theme";
import {
  adjustProductStock,
  getApiErrorMessage,
  STOCK_ADJUST_REASONS,
  type StockAdjustmentResult,
  type StockAdjustmentType,
} from "@/services/products";

export type StockAdjustTarget = {
  /** null = the product itself (simple product). */
  variantId: number | null;
  label: string;
  /** On-hand quantity per location id. */
  byLocation: Record<number, number>;
};

export type StockAdjustLocation = { id: number; name: string; isDefault?: boolean };

type Props = {
  visible: boolean;
  productId: number;
  productName: string;
  /** For products with real variants pass one target per variant (a variant must be chosen). */
  targets: StockAdjustTarget[];
  locations: StockAdjustLocation[];
  initialVariantId?: number | null;
  initialLocationId?: number;
  onClose: () => void;
  onDone: (result: StockAdjustmentResult) => void;
};

const TYPES: Array<{ key: StockAdjustmentType; label: string; hint: string }> = [
  { key: "increase", label: "+ Add", hint: "Add units" },
  { key: "decrease", label: "− Remove", hint: "Remove units" },
  { key: "set", label: "= Set to", hint: "After a count" },
];

export function StockAdjustSheet({
  visible,
  productId,
  productName,
  targets,
  locations,
  initialVariantId,
  initialLocationId,
  onClose,
  onDone,
}: Props) {
  const defaultLocationId = useMemo(
    () => initialLocationId ?? (locations.find((l) => l.isDefault) ?? locations[0])?.id,
    [initialLocationId, locations],
  );
  const [targetKey, setTargetKey] = useState<string>("");
  const [locationId, setLocationId] = useState<number | undefined>(defaultLocationId);
  const [type, setType] = useState<StockAdjustmentType>("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState(STOCK_ADJUST_REASONS.increase[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const needsVariant = targets.length > 1 || (targets.length === 1 && targets[0].variantId !== null);

  useEffect(() => {
    if (!visible) return;
    const initial =
      initialVariantId !== undefined
        ? targets.find((t) => t.variantId === initialVariantId)
        : targets.length === 1 ? targets[0] : undefined;
    setTargetKey(initial ? String(initial.variantId ?? "product") : "");
    setLocationId(defaultLocationId);
    setType("increase");
    setQuantity("");
    setReason(STOCK_ADJUST_REASONS.increase[0]);
    setNote("");
    setError(null);
  }, [visible, initialVariantId, defaultLocationId, targets]);

  const target = targets.find((t) => String(t.variantId ?? "product") === targetKey);
  const current = target && locationId ? target.byLocation[locationId] ?? 0 : 0;
  const qty = Number(quantity);
  const validQty = quantity.trim() !== "" && Number.isInteger(qty) && qty >= 0;
  const after = !validQty ? null : type === "increase" ? current + qty : type === "decrease" ? current - qty : qty;

  const changeType = (next: StockAdjustmentType) => {
    setType(next);
    setReason((r) => (STOCK_ADJUST_REASONS[next].includes(r) ? r : STOCK_ADJUST_REASONS[next][0]));
    setError(null);
  };

  const submit = async () => {
    if (!target) return setError(needsVariant ? "Choose a variant — this product's stock is the sum of its variants." : "Nothing to adjust.");
    if (!locationId) return setError("Choose a location.");
    if (!validQty) return setError("Enter a whole number, 0 or more.");
    if (type !== "set" && qty < 1) return setError("Quantity must be at least 1.");
    if (type === "set" && qty === current) return setError("Quantity is unchanged.");
    if (type === "decrease" && qty > current) return setError(`Cannot remove more than on hand (${current}).`);
    if (!reason.trim()) return setError("Choose a reason.");

    setSaving(true);
    setError(null);
    try {
      const result = await adjustProductStock({
        productId,
        variantId: target.variantId,
        locationId,
        type,
        quantity: qty,
        reason,
        note: note.trim() || undefined,
      });
      onDone(result);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Could not adjust the stock."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={st.kav}>
        <View style={st.sheet}>
          <View style={st.header}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>Adjust stock</Text>
              <Text style={st.subtitle} numberOfLines={1}>{productName}</Text>
            </View>
            <Pressable onPress={onClose} style={st.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
            {needsVariant ? (
              <View style={st.block}>
                <Text style={st.label}>Variant *</Text>
                <View style={st.chips}>
                  {targets.map((t) => {
                    const key = String(t.variantId ?? "product");
                    const active = key === targetKey;
                    return (
                      <Pressable key={key} onPress={() => setTargetKey(key)} style={[st.chip, active && st.chipActive]}>
                        <Text style={[st.chipText, active && st.chipTextActive]}>{t.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={st.block}>
              <Text style={st.label}>Location *</Text>
              <View style={st.chips}>
                {locations.map((l) => {
                  const active = l.id === locationId;
                  const qtyHere = target?.byLocation[l.id];
                  return (
                    <Pressable key={l.id} onPress={() => setLocationId(l.id)} style={[st.chip, active && st.chipActive]}>
                      <Text style={[st.chipText, active && st.chipTextActive]}>
                        {l.name}{qtyHere !== undefined ? ` · ${qtyHere}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={st.typeRow}>
              {TYPES.map((t) => {
                const active = t.key === type;
                return (
                  <Pressable key={t.key} onPress={() => changeType(t.key)} style={[st.typeBtn, active && st.typeBtnActive]}>
                    <Text style={[st.typeLabel, active && st.typeLabelActive]}>{t.label}</Text>
                    <Text style={st.typeHint}>{t.hint}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={st.block}>
              <Text style={st.label}>{type === "set" ? "New quantity *" : "Quantity *"}</Text>
              <TextInput
                value={quantity}
                onChangeText={(v) => setQuantity(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.muted}
                style={st.input}
              />
              {target && locationId ? (
                <Text style={[st.preview, after !== null && after < 0 && { color: colors.danger }]}>
                  On hand {current}{after !== null ? ` → ${after}` : ""}
                </Text>
              ) : null}
            </View>

            <View style={st.block}>
              <Text style={st.label}>Reason *</Text>
              <View style={st.chips}>
                {STOCK_ADJUST_REASONS[type].map((r) => {
                  const active = r === reason;
                  return (
                    <Pressable key={r} onPress={() => setReason(r)} style={[st.chip, active && st.chipActive]}>
                      <Text style={[st.chipText, active && st.chipTextActive]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={st.block}>
              <Text style={st.label}>Note</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                style={st.input}
              />
            </View>

            {error ? (
              <View style={st.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
                <Text style={st.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable style={[st.saveBtn, saving && { opacity: 0.6 }]} onPress={() => void submit()} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={st.saveText}>Save adjustment</Text>}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.45)" },
  kav: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { padding: 18, gap: 14, paddingBottom: 32 },
  block: { gap: 8 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  chipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.primaryDark, fontWeight: "800" },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    alignItems: "center",
    gap: 2,
    backgroundColor: colors.background,
  },
  typeBtnActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  typeLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  typeLabelActive: { color: colors.primaryDark },
  typeHint: { color: colors.muted, fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  preview: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  errorBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 10,
  },
  errorText: { flex: 1, color: colors.danger, fontSize: 13 },
  saveBtn: {
    backgroundColor: colors.primaryDark,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
