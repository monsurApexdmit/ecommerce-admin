import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage, apiFieldErrors } from "@/lib/format";
import {
  bookableAccounts,
  courierProviderLabel,
  getBookingCourierAccounts,
  getCourierLocations,
  getCourierQuote,
  getCourierStores,
  getCourierRisk,
  sendOrderToCourier,
} from "@/services/courier";
import type { Order, Shipment } from "@/types/order";
import type { CourierAccount, CourierLocation, CourierLocationType, CourierQuote, CourierRisk, CourierStore } from "@/types/courier";
import { orderPhone } from "./order-utils";

type Props = {
  order: Order | null;
  onClose: () => void;
  /** Called with the booked shipment. */
  onBooked?: (shipment: Shipment) => void;
};

const DELIVERY_TYPES = [
  { value: 48, label: "Normal" },
  { value: 12, label: "On-demand" },
];
const ITEM_TYPES = [
  { value: 2, label: "Parcel" },
  { value: 1, label: "Document" },
];

/** Amount the courier should collect: the order's due, 0 when fully paid. */
export function defaultCodAmount(order: Order): number {
  if (order.dueAmount != null) return Math.max(0, Number(order.dueAmount) || 0);
  if (String(order.paymentStatus ?? "").toLowerCase() === "paid") return 0;
  return Math.max(0, Number(order.amount ?? 0) - Number(order.paidAmount ?? 0));
}

function orderAddress(order: Order): string {
  const line = [order.shippingAddressLine1, order.shippingAddressLine2].filter(Boolean).join(", ") || order.customerAddress || "";
  const city = [order.shippingCity || order.customerCity, order.zoneName].filter(Boolean).join(", ");
  return [line, city && !line.includes(city) ? city : ""].filter(Boolean).join(", ");
}

function itemSummary(order: Order): string {
  return order.items.map((i) => `${i.productName} x${i.quantity}`).join(", ").slice(0, 250);
}

const parseNum = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** Book a parcel for one order with a connected courier (Pathao / Steadfast). */
export function SendToCourierSheet({ order, onClose, onBooked }: Props) {
  const insets = useSafeAreaInsets();
  const { formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<CourierAccount[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editRecipient, setEditRecipient] = useState(false);
  const [cod, setCod] = useState("");
  const [weight, setWeight] = useState("");
  const [deliveryType, setDeliveryType] = useState(48);
  const [itemType, setItemType] = useState(2);
  const [description, setDescription] = useState("");
  const [note, setNote] = useState("");
  const [city, setCity] = useState<CourierLocation | null>(null);
  const [zone, setZone] = useState<CourierLocation | null>(null);
  const [area, setArea] = useState<CourierLocation | null>(null);
  const [stores, setStores] = useState<CourierStore[] | null>(null);
  const [storeId, setStoreId] = useState<number | null>(null);
  const [picker, setPicker] = useState<CourierLocationType | null>(null);
  const [quote, setQuote] = useState<CourierQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [risk, setRisk] = useState<CourierRisk | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const account = useMemo(() => accounts?.find((a) => a.id === accountId) ?? null, [accounts, accountId]);
  const isPathao = account?.provider === "pathao";

  // Reset + load connected couriers whenever the sheet opens for an order.
  useEffect(() => {
    if (!order) return;
    setName(order.shippingFullName || order.shippingAddress?.fullName || order.customerName || "");
    setPhone(orderPhone(order));
    setAddress(orderAddress(order));
    setEditRecipient(false);
    setCod(String(defaultCodAmount(order)));
    setNote("");
    setCity(null); setZone(null); setArea(null);
    setQuote(null); setRisk(null); setErrors({});
    // Clearing the account re-applies its defaults below even when the same courier is picked again.
    setAccounts(null); setAccountId(null); setLoadError("");
    let live = true;
    getBookingCourierAccounts()
      .then((all) => {
        if (!live) return;
        const usable = bookableAccounts(all);
        setAccounts(usable);
        setAccountId(usable[0]?.id ?? null);
      })
      .catch((e) => { if (live) { setAccounts([]); setLoadError(apiErrorMessage(e, "Could not load couriers.")); } });
    const p = orderPhone(order);
    if (p) getCourierRisk(p).then((r) => { if (live) setRisk(r); });
    return () => { live = false; };
  }, [order?.id]);

  // Account defaults (weight, delivery type, item type, description, note).
  useEffect(() => {
    if (!account || !order) return;
    setWeight(String(account.settings.weightKg ?? 0.5));
    setDeliveryType(account.settings.deliveryType === 12 ? 12 : 48);
    setItemType(account.settings.itemType === 1 ? 1 : 2);
    setNote(account.settings.note || order.deliveryNote || "");
    setDescription(account.settings.itemDescription || itemSummary(order));
    setCity(null); setZone(null); setArea(null); setQuote(null);
    // Pathao pickup store: the account's saved store, else the merchant's default store.
    setStores(null);
    const saved = account.storeId != null && account.storeId !== "" ? Number(account.storeId) : null;
    setStoreId(saved);
    if (account.provider !== "pathao") return;
    let live = true;
    getCourierStores(account.id)
      .then((list) => {
        if (!live) return;
        setStores(list);
        if (saved == null) setStoreId(list.find((st) => st.isDefault)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => { if (live) setStores([]); });
    return () => { live = false; };
  }, [account?.id]);

  // Delivery charge quote (Pathao price plan) once city + zone are picked.
  const quoteSeq = useRef(0);
  useEffect(() => {
    if (!order || !account) return;
    const w = parseNum(weight);
    if (isPathao && (!city || !zone)) { setQuote(null); return; }
    if (!isPathao) { setQuote(null); return; }
    if (!(w > 0)) return;
    const seq = ++quoteSeq.current;
    const t = setTimeout(() => {
      setQuoting(true);
      getCourierQuote({
        courierAccountId: account.id, sellId: order.id, weightKg: w, deliveryType, itemType,
        cityId: city?.id, zoneId: zone?.id,
      })
        .then((q) => { if (seq === quoteSeq.current) setQuote(q); })
        .catch((e) => { if (seq === quoteSeq.current) setQuote({ available: false, deliveryFee: null, message: apiErrorMessage(e, "No quote") }); })
        .finally(() => { if (seq === quoteSeq.current) setQuoting(false); });
    }, 450);
    return () => clearTimeout(t);
  }, [order?.id, account?.id, isPathao, city?.id, zone?.id, weight, deliveryType, itemType]);

  const submit = async () => {
    if (!order || !account) return;
    const err: Record<string, string> = {};
    const codNum = parseNum(cod || "0");
    const w = parseNum(weight || "0");
    if (!(codNum >= 0)) err.codAmount = "Enter 0 or more.";
    if (weight && !(w > 0)) err.weightKg = "Enter the weight in kg.";
    if (!name.trim()) err.name = "Recipient name is required.";
    if (!phone.trim()) err.phone = "Recipient phone is required.";
    if (!address.trim()) err.address = "Recipient address is required.";
    if (Object.keys(err).length) {
      if (err.name || err.phone || err.address) setEditRecipient(true);
      setErrors(err);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const shipment = await sendOrderToCourier(order.id, {
        courierAccountId: account.id,
        codAmount: codNum,
        weightKg: w > 0 ? w : undefined,
        deliveryType: isPathao ? deliveryType : undefined,
        itemType: isPathao ? itemType : undefined,
        itemDescription: description.trim() || undefined,
        note: note.trim() || undefined,
        recipient: { name: name.trim(), phone: phone.trim(), address: address.trim() },
        pathao: isPathao
          ? {
              storeId: storeId ?? undefined,
              cityId: city?.id, zoneId: zone?.id, areaId: area?.id,
              cityName: city?.name, zoneName: zone?.name, areaName: area?.name,
            }
          : undefined,
      });
      onBooked?.(shipment);
      onClose();
      const code = shipment.courier?.trackingCode || shipment.courier?.consignmentId || shipment.trackingNumber;
      Alert.alert("Sent to courier", `${courierProviderLabel(account.provider)} booked #${order.invoiceNo}.${code ? `\nTracking: ${code}` : ""}`);
    } catch (e) {
      const fields = apiFieldErrors(e);
      if (Object.keys(fields).length) {
        setErrors({
          codAmount: fields.codAmount ?? "",
          weightKg: fields.weightKg ?? "",
          name: fields["recipient.name"] ?? "",
          phone: fields["recipient.phone"] ?? "",
          address: fields["recipient.address"] ?? "",
          city: fields["pathao.cityId"] ?? "",
          zone: fields["pathao.zoneId"] ?? "",
          area: fields["pathao.areaId"] ?? "",
        });
        if (fields["recipient.name"] || fields["recipient.phone"] || fields["recipient.address"]) setEditRecipient(true);
      }
      Alert.alert("Could not send to courier", apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const loading = !!order && accounts === null;
  const noAccounts = !!order && accounts !== null && accounts.length === 0;

  return (
    <Modal visible={!!order} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Send to courier</Text>
              <Text style={s.subtitle}>#{order?.invoiceNo} · the tracking code comes back automatically.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>

          {loading ? (
            <View style={s.centerBox}><ActivityIndicator color={colors.primaryDark} /></View>
          ) : noAccounts ? (
            <View style={s.emptyBox}>
              <Ionicons name="bicycle-outline" size={30} color={colors.muted} />
              <Text style={s.emptyTitle}>No courier connected</Text>
              <Text style={s.emptyText}>
                {loadError || "Connect your Pathao or Steadfast merchant account on the web admin (Shipping methods → Courier integrations), then book from here."}
              </Text>
            </View>
          ) : order ? (
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
              <Text style={s.label}>Courier</Text>
              <View style={s.chipRow}>
                {(accounts ?? []).map((a) => {
                  const active = a.id === accountId;
                  return (
                    <Pressable key={a.id} style={[s.courierChip, active && s.courierChipActive]} onPress={() => setAccountId(a.id)}>
                      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} size={16} color={active ? colors.primaryDark : colors.muted} />
                      <View>
                        <Text style={[s.courierChipText, active && { color: colors.primaryDark }]}>{courierProviderLabel(a.provider)}</Text>
                        {a.name && a.name.toLowerCase() !== a.provider ? <Text style={s.courierChipMeta} numberOfLines={1}>{a.name}</Text> : null}
                      </View>
                      {a.isDefault ? <Text style={s.defaultTag}>Default</Text> : null}
                      {a.environment === "sandbox" ? <Text style={s.sandboxTag}>Sandbox</Text> : null}
                    </Pressable>
                  );
                })}
              </View>

              {/* Recipient */}
              <View style={s.recipientCard}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={s.recipientName} numberOfLines={1}>{name || "No name"}</Text>
                  <Text style={s.recipientMeta}>{phone || "No phone"}</Text>
                  <Text style={s.recipientMeta} numberOfLines={2}>{address || "No address"}</Text>
                </View>
                <Pressable style={s.editBtn} onPress={() => setEditRecipient((v) => !v)} hitSlop={6}>
                  <Ionicons name={editRecipient ? "chevron-up" : "create-outline"} size={15} color={colors.primaryDark} />
                  <Text style={s.editBtnText}>{editRecipient ? "Done" : "Edit"}</Text>
                </Pressable>
              </View>
              {risk && risk.successRate != null ? (
                <View style={[s.riskBox, risk.successRate < 60 && s.riskBoxBad]}>
                  <Ionicons
                    name={risk.successRate < 60 ? "warning-outline" : "shield-checkmark-outline"}
                    size={15}
                    color={risk.successRate < 60 ? "#b91c1c" : "#15803d"}
                  />
                  <Text style={[s.riskText, risk.successRate < 60 && { color: "#991b1b" }]}>
                    Courier delivery success {Math.round(risk.successRate)}%
                    {risk.totalParcels != null ? ` · ${risk.totalParcels} parcel${risk.totalParcels === 1 ? "" : "s"}` : ""}
                    {risk.returned ? ` · ${risk.returned} returned` : ""}
                    {risk.rating ? ` · ${risk.rating.replace(/_/g, " ")}` : ""}
                  </Text>
                </View>
              ) : null}
              {editRecipient ? (
                <>
                  <Field label="Name *" value={name} onChange={setName} error={errors.name} placeholder="Recipient name" />
                  <Field label="Phone *" value={phone} onChange={setPhone} error={errors.phone} placeholder="01XXXXXXXXX" keyboardType="phone-pad" />
                  <Field label="Address *" value={address} onChange={setAddress} error={errors.address} placeholder="House, road, area, city" multiline />
                </>
              ) : null}

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Field label="COD amount" value={cod} onChange={setCod} error={errors.codAmount} placeholder="0" keyboardType="decimal-pad" />
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Weight (kg)" value={weight} onChange={setWeight} error={errors.weightKg} placeholder="0.5" keyboardType="decimal-pad" />
                </View>
              </View>
              <Text style={s.hint}>
                {parseNum(cod || "0") > 0
                  ? `Courier collects ${formatCurrency(parseNum(cod))} from the customer.`
                  : "Prepaid — the courier collects nothing."}
              </Text>

              {isPathao ? (
                <>
                  {stores && (stores.length > 1 || storeId == null) ? (
                    <>
                      <Text style={s.label}>Pickup store</Text>
                      {stores.length === 0 ? (
                        <Text style={s.error}>No Pathao store found. Add one in your Pathao merchant panel.</Text>
                      ) : (
                        <View style={s.storeRow}>
                          {stores.map((st) => (
                            <Pressable key={st.id} style={[s.storeChip, storeId === st.id && s.storeChipActive]} onPress={() => setStoreId(st.id)}>
                              <Text style={[s.storeChipText, storeId === st.id && { color: colors.primaryDark }]} numberOfLines={1}>{st.name}</Text>
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </>
                  ) : null}
                  <Text style={s.label}>Delivery type</Text>
                  <Segment options={DELIVERY_TYPES} value={deliveryType} onChange={setDeliveryType} />
                  <Text style={s.label}>Item type</Text>
                  <Segment options={ITEM_TYPES} value={itemType} onChange={setItemType} />

                  <Text style={s.label}>Delivery location</Text>
                  <PickerButton label="City" value={city?.name} error={errors.city} onPress={() => setPicker("city")} />
                  <PickerButton label="Zone" value={zone?.name} error={errors.zone} disabled={!city} onPress={() => setPicker("zone")} />
                  <PickerButton label="Area (optional)" value={area?.name} error={errors.area} disabled={!zone} onPress={() => setPicker("area")} />

                  <View style={s.quoteBox}>
                    <Ionicons name="pricetag-outline" size={15} color={colors.primaryDark} />
                    {quoting ? (
                      <Text style={s.quoteText}>Getting delivery charge…</Text>
                    ) : quote?.available && quote.deliveryFee != null ? (
                      <Text style={s.quoteText}>
                        Delivery charge <Text style={s.quoteAmount}>{formatCurrency(quote.deliveryFee)}</Text>
                        {quote.codFeePercent ? ` + ${quote.codFeePercent}% COD fee` : ""}
                      </Text>
                    ) : (
                      <Text style={s.quoteMuted}>{quote?.message || "Pick city and zone to see the delivery charge."}</Text>
                    )}
                  </View>
                </>
              ) : null}

              <Field label="Item description" value={description} onChange={setDescription} placeholder="What is in the parcel" multiline />
              <Field label="Note for the courier" value={note} onChange={setNote} placeholder="Call before delivery…" multiline />
            </ScrollView>
          ) : null}

          <View style={s.actions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelBtnText}>Close</Text>
            </Pressable>
            {!noAccounts ? (
              <Pressable
                style={[s.saveBtn, (saving || !account) && { opacity: 0.55 }]}
                onPress={() => void submit()}
                disabled={saving || !account}
              >
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="paper-plane-outline" size={16} color="#fff" />}
                <Text style={s.saveBtnText}>{saving ? "Sending…" : account ? `Book with ${courierProviderLabel(account.provider)}` : "Book"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>

      {account && picker ? (
        <LocationPicker
          accountId={account.id}
          type={picker}
          parentId={picker === "zone" ? city?.id : picker === "area" ? zone?.id : undefined}
          onClose={() => setPicker(null)}
          onPick={(loc) => {
            if (picker === "city") { setCity(loc); setZone(null); setArea(null); }
            else if (picker === "zone") { setZone(loc); setArea(null); }
            else setArea(loc);
            setErrors((x) => ({ ...x, [picker]: "" }));
            setPicker(null);
          }}
        />
      ) : null}
    </Modal>
  );
}

function Field({
  label, value, onChange, placeholder, error, multiline, keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  multiline?: boolean;
  keyboardType?: "default" | "decimal-pad" | "phone-pad";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        multiline={multiline}
        keyboardType={keyboardType}
        style={[s.input, multiline && s.inputMulti, error ? s.inputError : null]}
      />
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

function Segment({ options, value, onChange }: { options: { value: number; label: string }[]; value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <Pressable key={o.value} style={[s.segmentItem, value === o.value && s.segmentItemActive]} onPress={() => onChange(o.value)}>
          <Text style={[s.segmentText, value === o.value && s.segmentTextActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function PickerButton({ label, value, onPress, disabled, error }: { label: string; value?: string; onPress: () => void; disabled?: boolean; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Pressable style={[s.pickerBtn, disabled && { opacity: 0.5 }, error ? s.inputError : null]} onPress={onPress} disabled={disabled}>
        <Text style={s.pickerLabel}>{label}</Text>
        <Text style={[s.pickerValue, !value && { color: "#94a3b8" }]} numberOfLines={1}>{value || "Select"}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.muted} />
      </Pressable>
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

/** Searchable Pathao city / zone / area list. */
function LocationPicker({
  accountId, type, parentId, onClose, onPick,
}: {
  accountId: number;
  type: CourierLocationType;
  parentId?: number;
  onClose: () => void;
  onPick: (loc: CourierLocation) => void;
}) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CourierLocation[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    setItems(null); setError("");
    getCourierLocations(accountId, type, parentId)
      .then((r) => { if (live) setItems(r); })
      .catch((e) => { if (live) { setItems([]); setError(apiErrorMessage(e, "Could not load the list.")); } });
    return () => { live = false; };
  }, [accountId, type, parentId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? (items ?? []).filter((i) => i.name.toLowerCase().includes(term)) : items ?? [];
  }, [items, q]);

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[s.sheet, s.pickerSheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.handle} />
          <View style={s.headerRow}>
            <Text style={[s.title, { flex: 1 }]}>Select {type}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={s.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <View style={s.searchWrap}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput value={q} onChangeText={setQ} placeholder={`Search ${type}…`} placeholderTextColor="#94a3b8" style={s.searchInput} autoFocus />
          </View>
          {items === null ? (
            <View style={s.centerBox}><ActivityIndicator color={colors.primaryDark} /></View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(i) => String(i.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable style={s.locRow} onPress={() => onPick(item)}>
                  <Text style={s.locText}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.muted} />
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={s.locDivider} />}
              ListEmptyComponent={<Text style={[s.hint, { textAlign: "center", paddingVertical: 20 }]}>{error || "Nothing found."}</Text>}
            />
          )}
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
  pickerSheet: { height: "80%" },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 4 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { color: colors.text, fontSize: 19, fontWeight: "800", textTransform: "none" },
  subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" },
  body: { gap: 10, paddingBottom: 12 },
  centerBox: { paddingVertical: 40, alignItems: "center" },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 12 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800" },
  chipRow: { gap: 8 },
  courierChip: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  courierChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  courierChipText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  courierChipMeta: { color: colors.muted, fontSize: 11 },
  defaultTag: { marginLeft: "auto", color: colors.primaryDark, fontSize: 11, fontWeight: "800" },
  sandboxTag: { color: "#b45309", fontSize: 11, fontWeight: "800", backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  recipientCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 14,
  },
  recipientName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  recipientMeta: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, backgroundColor: "#ecfdf5", paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  riskBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: "#bbf7d0", backgroundColor: "#f0fdf4", padding: 10,
  },
  riskBoxBad: { borderColor: "#fecaca", backgroundColor: "#fef2f2" },
  riskText: { flex: 1, color: "#166534", fontSize: 12, fontWeight: "700" },
  twoCol: { flexDirection: "row", gap: 10 },
  storeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  storeChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 7, maxWidth: "100%" },
  storeChipActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  storeChipText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  input: {
    minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingHorizontal: 14, color: colors.text, fontSize: 14,
  },
  inputMulti: { minHeight: 70, paddingVertical: 10, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  hint: { color: colors.muted, fontSize: 12 },
  error: { color: colors.danger, fontSize: 12, fontWeight: "600" },
  segment: { flexDirection: "row", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, padding: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
  segmentItemActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primaryDark },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  segmentTextActive: { color: colors.primaryDark },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", gap: 10, minHeight: 46,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 14,
  },
  pickerLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", width: 96 },
  pickerValue: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  quoteBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 12, borderWidth: 1, borderColor: "#a7f3d0", backgroundColor: "#ecfdf5", padding: 10,
  },
  quoteText: { flex: 1, color: "#166534", fontSize: 13, fontWeight: "600" },
  quoteAmount: { fontWeight: "800", color: colors.primaryDark },
  quoteMuted: { flex: 1, color: colors.muted, fontSize: 12 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 44,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  locRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 13, paddingHorizontal: 4 },
  locText: { color: colors.text, fontSize: 14, fontWeight: "600" },
  locDivider: { height: 1, backgroundColor: colors.border },
  actions: { flexDirection: "row", gap: 10, paddingTop: 4 },
  cancelBtn: {
    flex: 1, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.background, paddingVertical: 14, alignItems: "center",
  },
  cancelBtnText: { color: colors.text, fontWeight: "700" },
  saveBtn: {
    flex: 2, flexDirection: "row", gap: 8, justifyContent: "center",
    borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 14, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800" },
});
