import React, { useCallback, useEffect, useMemo, useState } from "react"
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
import { useCurrency } from "@/context/CurrencyContext"
import {
  getTailorFabrics,
  createTailorFabric,
  updateTailorFabric,
  deleteTailorFabric,
} from "@/services/tailor"
import type { TailorFabric } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const LOW_STOCK_THRESHOLD = 5
const UNITS: Array<"goj" | "gaj"> = ["goj", "gaj"]
const STATUSES: Array<"active" | "inactive"> = ["active", "inactive"]

interface FormState {
  name: string
  fabricType: string
  color: string
  unit: "goj" | "gaj"
  purchasePrice: string
  sellingPrice: string
  stockQuantity: string
  status: "active" | "inactive"
}

const BLANK_FORM: FormState = {
  name: "",
  fabricType: "",
  color: "",
  unit: "goj",
  purchasePrice: "",
  sellingPrice: "",
  stockQuantity: "",
  status: "active",
}

function fabricToForm(f: TailorFabric): FormState {
  return {
    name: f.name,
    fabricType: f.fabricType ?? "",
    color: f.color ?? "",
    unit: f.unit,
    purchasePrice: f.purchasePrice ? String(f.purchasePrice) : "",
    sellingPrice: f.sellingPrice ? String(f.sellingPrice) : "",
    stockQuantity: f.stockQuantity ? String(f.stockQuantity) : "",
    status: f.status,
  }
}

export default function TailorFabricsScreen() {
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [fabrics, setFabrics] = useState<TailorFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [modalVisible, setModalVisible] = useState(false)
  const [editingFabric, setEditingFabric] = useState<TailorFabric | null>(null)
  const [form, setForm] = useState<FormState>(BLANK_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTailorFabrics()
      setFabrics(data)
    } catch {
      Alert.alert("Error", "Failed to load fabrics")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return fabrics
    return fabrics.filter(f => f.name.toLowerCase().includes(q))
  }, [fabrics, search])

  const openAdd = () => {
    setEditingFabric(null)
    setForm(BLANK_FORM)
    setModalVisible(true)
  }

  const openEdit = (fabric: TailorFabric) => {
    setEditingFabric(fabric)
    setForm(fabricToForm(fabric))
    setModalVisible(true)
  }

  const handleDelete = (fabric: TailorFabric) => {
    Alert.alert(
      "Delete Fabric",
      `Delete "${fabric.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTailorFabric(fabric.id)
              await load()
            } catch {
              Alert.alert("Error", "Failed to delete fabric")
            }
          },
        },
      ]
    )
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Name is required")
      return
    }
    setSaving(true)
    try {
      const payload: Partial<TailorFabric> = {
        name: form.name.trim(),
        fabricType: form.fabricType.trim() || undefined,
        color: form.color.trim() || undefined,
        unit: form.unit,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : 0,
        sellingPrice: form.sellingPrice ? parseFloat(form.sellingPrice) : 0,
        stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity, 10) : 0,
        status: form.status,
      }
      if (editingFabric) {
        await updateTailorFabric(editingFabric.id, payload)
      } else {
        await createTailorFabric(payload)
      }
      setModalVisible(false)
      await load()
    } catch {
      Alert.alert("Error", "Failed to save fabric")
    } finally {
      setSaving(false)
    }
  }

  if (!canRead("TailorFabrics")) return <AccessDenied />

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Fabrics</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.muted} style={s.searchIcon} />
        <TextInput
          style={s.searchInput}
          placeholder="Search by name..."
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="layers-outline" size={48} color={colors.muted} />
          <Text style={s.emptyText}>{search ? "No fabrics match your search" : "No fabrics found"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={f => String(f.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => canWrite("TailorFabrics") && openEdit(f)}
              onLongPress={() => canWrite("TailorFabrics") && handleDelete(f)}
              delayLongPress={500}
            >
              <View style={s.cardHeader}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.fabricName}>{f.name}</Text>
                  {f.fabricType ? (
                    <Text style={s.fabricMeta}>{f.fabricType}</Text>
                  ) : null}
                </View>
                <View style={[s.statusBadge, f.status === "active" ? s.statusActive : s.statusInactive]}>
                  <Text style={[s.statusText, f.status === "active" ? s.statusTextActive : s.statusTextInactive]}>
                    {f.status === "active" ? "Active" : "Inactive"}
                  </Text>
                </View>
              </View>

              <View style={s.cardMeta}>
                {f.color ? (
                  <View style={s.metaChip}>
                    <Ionicons name="color-palette-outline" size={12} color={colors.muted} />
                    <Text style={s.metaChipText}>{f.color}</Text>
                  </View>
                ) : null}
                <View style={s.metaChip}>
                  <Ionicons name="resize-outline" size={12} color={colors.muted} />
                  <Text style={s.metaChipText}>{f.unit}</Text>
                </View>
                <View style={[s.metaChip, f.stockQuantity < LOW_STOCK_THRESHOLD && s.metaChipWarn]}>
                  <Ionicons
                    name={f.stockQuantity < LOW_STOCK_THRESHOLD ? "warning-outline" : "cube-outline"}
                    size={12}
                    color={f.stockQuantity < LOW_STOCK_THRESHOLD ? colors.warning : colors.muted}
                  />
                  <Text style={[s.metaChipText, f.stockQuantity < LOW_STOCK_THRESHOLD && s.metaChipTextWarn]}>
                    {f.stockQuantity} in stock
                    {f.stockQuantity < LOW_STOCK_THRESHOLD ? " · Low" : ""}
                  </Text>
                </View>
              </View>

              <View style={s.cardPriceRow}>
                <Text style={s.priceLabel}>Buy: <Text style={s.priceValue}>{formatCurrency(f.purchasePrice)}</Text></Text>
                <Text style={s.priceLabel}>Sell: <Text style={[s.priceValue, { color: "#16a34a" }]}>{formatCurrency(f.sellingPrice)}</Text></Text>
                {f.vendor ? (
                  <Text style={s.vendorText} numberOfLines={1}>
                    <Ionicons name="person-outline" size={11} color={colors.muted} /> {f.vendor.name}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      {canWrite("TailorFabrics") && (
        <TouchableOpacity style={s.fab} onPress={openAdd} activeOpacity={0.85}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setModalVisible(false)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>{editingFabric ? "Edit Fabric" : "Add Fabric"}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={s.inputLabel}>Name *</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Cotton Twill"
              placeholderTextColor={colors.muted}
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
            />

            {/* Fabric Type */}
            <Text style={s.inputLabel}>Fabric Type</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Cotton, Silk, Linen"
              placeholderTextColor={colors.muted}
              value={form.fabricType}
              onChangeText={v => setForm(p => ({ ...p, fabricType: v }))}
            />

            {/* Color */}
            <Text style={s.inputLabel}>Color</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. White, Navy Blue"
              placeholderTextColor={colors.muted}
              value={form.color}
              onChangeText={v => setForm(p => ({ ...p, color: v }))}
            />

            {/* Unit */}
            <Text style={s.inputLabel}>Unit</Text>
            <View style={s.chipRow}>
              {UNITS.map(u => (
                <TouchableOpacity
                  key={u}
                  style={[s.chip, form.unit === u && s.chipActive]}
                  onPress={() => setForm(p => ({ ...p, unit: u }))}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, form.unit === u && s.chipTextActive]}>{u}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Purchase Price */}
            <Text style={s.inputLabel}>Purchase Price</Text>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.purchasePrice}
              onChangeText={v => setForm(p => ({ ...p, purchasePrice: v }))}
            />

            {/* Selling Price */}
            <Text style={s.inputLabel}>Selling Price</Text>
            <TextInput
              style={s.input}
              placeholder="0.00"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.sellingPrice}
              onChangeText={v => setForm(p => ({ ...p, sellingPrice: v }))}
            />

            {/* Stock Quantity */}
            <Text style={s.inputLabel}>Stock Quantity</Text>
            <TextInput
              style={s.input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={form.stockQuantity}
              onChangeText={v => setForm(p => ({ ...p, stockQuantity: v }))}
            />

            {/* Status */}
            <Text style={s.inputLabel}>Status</Text>
            <View style={s.chipRow}>
              {STATUSES.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[s.chip, form.status === st && s.chipActive]}
                  onPress={() => setForm(p => ({ ...p, status: st }))}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, form.status === st && s.chipTextActive]}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{editingFabric ? "Save Changes" : "Add Fabric"}</Text>}
            </TouchableOpacity>

            <View style={{ height: 24 }} />
          </ScrollView>
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
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    margin: 16, marginBottom: 8,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
  list: { padding: 16, paddingTop: 8, gap: 10 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  fabricName: { fontSize: 15, fontWeight: "800", color: colors.text },
  fabricMeta: { fontSize: 12, color: colors.muted },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusActive: { backgroundColor: "#dcfce7" },
  statusInactive: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextActive: { color: "#16a34a" },
  statusTextInactive: { color: colors.muted },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: colors.background, borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  metaChipWarn: { borderColor: colors.warning, backgroundColor: "#fffbeb" },
  metaChipText: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  metaChipTextWarn: { color: colors.warning },
  cardPriceRow: { flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" },
  priceLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  priceValue: { fontSize: 13, fontWeight: "800", color: colors.text },
  vendorText: { fontSize: 11, color: colors.muted, flex: 1 },
  fab: {
    position: "absolute", bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 8,
  },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 0, maxHeight: "85%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 6 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 4 },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#7c3aed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 16,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
