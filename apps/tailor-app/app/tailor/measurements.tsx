import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { router } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import {
  getTailorMeasurements,
  createTailorMeasurement,
  updateTailorMeasurement,
  getTailorCustomers,
} from "@/services/tailor"
import type { TailorMeasurement, TailorCustomer } from "@/types/tailor"
import { PRODUCT_TYPES } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const MEASURE_FIELDS: { key: keyof TailorMeasurement; label: string }[] = [
  { key: "chest", label: "Chest" },
  { key: "waist", label: "Waist" },
  { key: "hip", label: "Hip" },
  { key: "shoulder", label: "Shoulder" },
  { key: "sleeve", label: "Sleeve" },
  { key: "length", label: "Length" },
  { key: "neck", label: "Neck" },
  { key: "bottomLength", label: "Bottom L." },
  { key: "inseam", label: "Inseam" },
  { key: "pajamaWaist", label: "Paj. Waist" },
  { key: "pajamaLength", label: "Paj. Length" },
]

const SNAKE: Record<string, string> = {
  chest: "chest",
  waist: "waist",
  hip: "hip",
  shoulder: "shoulder",
  sleeve: "sleeve",
  length: "length",
  neck: "neck",
  bottomLength: "bottom_length",
  inseam: "inseam",
  pajamaWaist: "pajama_waist",
  pajamaLength: "pajama_length",
}

type FormState = {
  customerId: number | null
  productType: string
  chest: string
  waist: string
  hip: string
  shoulder: string
  sleeve: string
  length: string
  neck: string
  bottomLength: string
  inseam: string
  pajamaWaist: string
  pajamaLength: string
  notes: string
  measuredAt: string
}

const emptyForm = (): FormState => ({
  customerId: null,
  productType: PRODUCT_TYPES[0],
  chest: "",
  waist: "",
  hip: "",
  shoulder: "",
  sleeve: "",
  length: "",
  neck: "",
  bottomLength: "",
  inseam: "",
  pajamaWaist: "",
  pajamaLength: "",
  notes: "",
  measuredAt: new Date().toISOString().slice(0, 10),
})

export default function TailorMeasurementsScreen() {
  const { canRead, canWrite } = useAuth()

  const [measurements, setMeasurements] = useState<TailorMeasurement[]>([])
  const [customers, setCustomers] = useState<TailorCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modalVisible, setModalVisible] = useState(false)
  const [editTarget, setEditTarget] = useState<TailorMeasurement | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [customerPickerVisible, setCustomerPickerVisible] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [mData, cData] = await Promise.allSettled([
        getTailorMeasurements(),
        getTailorCustomers(),
      ])
      if (mData.status === "fulfilled") setMeasurements(mData.value)
      if (cData.status === "fulfilled") setCustomers(cData.value)
      else Alert.alert("Error", `Failed to load customers: ${(cData as any).reason?.message ?? "unknown"}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openAdd = async () => {
    setEditTarget(null)
    setForm(emptyForm())
    if (customers.length === 0) {
      try {
        const cData = await getTailorCustomers()
        setCustomers(cData)
      } catch (e: any) {
        Alert.alert("Error", `Could not load customers: ${e?.message ?? "unknown"}`)
      }
    }
    setModalVisible(true)
  }

  const openEdit = async (m: TailorMeasurement) => {
    if (customers.length === 0) {
      try {
        const cData = await getTailorCustomers()
        setCustomers(cData)
      } catch (e: any) {
        Alert.alert("Error", `Could not load customers: ${e?.message ?? "unknown"}`)
      }
    }
    setEditTarget(m)
    setForm({
      customerId: m.customerId,
      productType: m.productType,
      chest: m.chest != null ? String(m.chest) : "",
      waist: m.waist != null ? String(m.waist) : "",
      hip: m.hip != null ? String(m.hip) : "",
      shoulder: m.shoulder != null ? String(m.shoulder) : "",
      sleeve: m.sleeve != null ? String(m.sleeve) : "",
      length: m.length != null ? String(m.length) : "",
      neck: m.neck != null ? String(m.neck) : "",
      bottomLength: m.bottomLength != null ? String(m.bottomLength) : "",
      inseam: m.inseam != null ? String(m.inseam) : "",
      pajamaWaist: m.pajamaWaist != null ? String(m.pajamaWaist) : "",
      pajamaLength: m.pajamaLength != null ? String(m.pajamaLength) : "",
      notes: m.notes ?? "",
      measuredAt: m.measuredAt ? m.measuredAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!form.customerId) { Alert.alert("Select a customer"); return }
    if (!form.productType) { Alert.alert("Select a product type"); return }

    const payload: Record<string, any> = {
      customer_id: form.customerId,
      product_type: form.productType,
      notes: form.notes || undefined,
      measured_at: form.measuredAt || undefined,
    }
    MEASURE_FIELDS.forEach(({ key }) => {
      const raw = (form as any)[key as string]
      if (raw !== "") {
        const n = parseFloat(raw)
        if (!isNaN(n)) payload[SNAKE[key as string]] = n
      }
    })

    setSaving(true)
    try {
      if (editTarget) {
        await updateTailorMeasurement(editTarget.id, payload)
      } else {
        await createTailorMeasurement(payload)
      }
      setModalVisible(false)
      await load()
    } catch {
      Alert.alert("Error", "Failed to save measurement")
    } finally {
      setSaving(false)
    }
  }

  const setField = (key: keyof FormState, value: string | number | null) =>
    setForm(prev => ({ ...prev, [key]: value }))

  if (!canRead("TailorMeasurements")) return <AccessDenied />

  const filtered = search.trim()
    ? measurements.filter(m =>
        m.customer?.name?.toLowerCase().includes(search.toLowerCase())
      )
    : measurements

  const selectedCustomer = customers.find(c => c.id === form.customerId)

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Measurements</Text>
        {canWrite("TailorMeasurements") ? (
          <TouchableOpacity style={s.addBtn} onPress={() => void openAdd()} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by customer name…"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="body-outline" size={48} color={colors.muted} />
          <Text style={s.emptyText}>No measurements found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: m }) => {
            const nonNull = MEASURE_FIELDS.filter(f => m[f.key] != null)
            return (
              <TouchableOpacity
                style={s.card}
                activeOpacity={canWrite("TailorMeasurements") ? 0.75 : 1}
                onPress={() => { if (canWrite("TailorMeasurements")) void openEdit(m) }}
              >
                <View style={s.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.customerName}>{m.customer?.name ?? `Customer #${m.customerId}`}</Text>
                    {m.customer?.phone ? (
                      <Text style={s.customerPhone}>{m.customer.phone}</Text>
                    ) : null}
                  </View>
                  <View style={s.typeBadge}>
                    <Text style={s.typeBadgeText}>{m.productType}</Text>
                  </View>
                </View>
                {m.measuredAt ? (
                  <Text style={s.dateText}>
                    {new Date(m.measuredAt).toLocaleDateString()}
                  </Text>
                ) : null}
                {nonNull.length > 0 && (
                  <View style={s.gridContainer}>
                    {nonNull.map(f => (
                      <View key={String(f.key)} style={s.gridCell}>
                        <Text style={s.gridLabel}>{f.label}</Text>
                        <Text style={s.gridValue}>{String(m[f.key])}"</Text>
                      </View>
                    ))}
                  </View>
                )}
                {m.notes ? <Text style={s.noteText} numberOfLines={2}>{m.notes}</Text> : null}
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* FAB */}
      {canWrite("TailorMeasurements") && (
        <TouchableOpacity style={s.fab} onPress={() => void openAdd()} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalContainer}>
          <Pressable style={s.modalOverlay} onPress={() => setModalVisible(false)} />
          <View style={s.sheetWrap}>
          <ScrollView
            style={s.sheet}
            contentContainerStyle={s.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{editTarget ? "Edit Measurement" : "Add Measurement"}</Text>

            {/* Customer picker */}
            <Text style={s.inputLabel}>Customer *</Text>
            <TouchableOpacity
              style={s.pickerBtn}
              onPress={() => setCustomerPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={form.customerId ? s.pickerText : s.pickerPlaceholder} numberOfLines={1}>
                {selectedCustomer
                  ? `${selectedCustomer.name} · ${selectedCustomer.phone}`
                  : "Select a customer…"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </TouchableOpacity>

            {/* Product type chips */}
            <Text style={s.inputLabel}>Product Type</Text>
            <View style={s.chipRow}>
              {PRODUCT_TYPES.map(pt => (
                <TouchableOpacity
                  key={pt}
                  style={[s.chip, form.productType === pt && s.chipActive]}
                  onPress={() => setField("productType", pt)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, form.productType === pt && s.chipTextActive]}>{pt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Measurement fields 2-column grid */}
            <Text style={s.inputLabel}>Measurements (inches, optional)</Text>
            <View style={s.measureGrid}>
              {MEASURE_FIELDS.map(f => (
                <View key={String(f.key)} style={s.measureCell}>
                  <Text style={s.measureCellLabel}>{f.label}</Text>
                  <TextInput
                    style={s.measureInput}
                    placeholder="—"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={(form as any)[f.key as string]}
                    onChangeText={v => setField(f.key as keyof FormState, v)}
                  />
                </View>
              ))}
            </View>

            {/* Notes */}
            <Text style={s.inputLabel}>Notes</Text>
            <TextInput
              style={[s.input, { minHeight: 72, textAlignVertical: "top" }]}
              placeholder="Optional notes…"
              placeholderTextColor={colors.muted}
              value={form.notes}
              onChangeText={v => setField("notes", v)}
              multiline
            />

            {/* measuredAt */}
            <Text style={s.inputLabel}>Measured At</Text>
            <TextInput
              style={s.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={form.measuredAt}
              onChangeText={v => setField("measuredAt", v)}
            />

            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{editTarget ? "Save Changes" : "Add Measurement"}</Text>
              }
            </TouchableOpacity>
          </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Customer picker modal */}
      <Modal
        visible={customerPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCustomerPickerVisible(false)}
      >
        <View style={s.modalContainer}>
          <Pressable style={s.modalOverlay} onPress={() => setCustomerPickerVisible(false)} />
          <View style={s.pickerSheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Select Customer</Text>
            <FlatList
              data={customers}
              keyExtractor={c => String(c.id)}
              style={{ maxHeight: 380 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: c }) => (
                <TouchableOpacity
                  style={s.pickerItem}
                  onPress={() => {
                    setField("customerId", c.id)
                    setCustomerPickerVisible(false)
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={s.pickerItemName}>{c.name}</Text>
                  <Text style={s.pickerItemMeta}>{c.phone}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[s.emptyText, { textAlign: "center", padding: 20 }]}>
                  No customers found
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
  },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginVertical: 10,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  searchIcon: { marginRight: 2 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
  list: { padding: 16, gap: 12, paddingBottom: 100 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  customerName: { fontSize: 14, fontWeight: "800", color: colors.text },
  customerPhone: { fontSize: 12, color: colors.muted, marginTop: 1 },
  typeBadge: {
    backgroundColor: "#ede9fe", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  typeBadgeText: { fontSize: 12, fontWeight: "700", color: "#7c3aed" },
  dateText: { fontSize: 12, color: colors.muted },
  gridContainer: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2,
  },
  gridCell: {
    backgroundColor: colors.background, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 4, alignItems: "center",
    minWidth: "22%",
  },
  gridLabel: { fontSize: 10, color: colors.muted, fontWeight: "600" },
  gridValue: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 1 },
  noteText: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  fab: {
    position: "absolute", right: 20, bottom: 28,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheetWrap: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetContent: { padding: 24, paddingBottom: 48, gap: 10 },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { fontSize: 13, color: colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: 13, color: colors.muted, flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  measureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  measureCell: { width: "47%", gap: 4 },
  measureCellLabel: { fontSize: 12, fontWeight: "600", color: colors.muted },
  measureInput: {
    backgroundColor: colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: colors.text,
  },
  submitBtn: {
    backgroundColor: "#7c3aed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 6,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  pickerItem: {
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerItemName: { fontSize: 14, fontWeight: "700", color: colors.text },
  pickerItemMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  modalContainer: {
    flex: 1, justifyContent: "flex-end",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
})
