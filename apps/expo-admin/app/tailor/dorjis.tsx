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
import { useCurrency } from "@/context/CurrencyContext"
import {
  getTailorDorjis,
  createTailorDorji,
  updateTailorDorji,
  deleteTailorDorji,
  tailorApiError,
} from "@/services/tailor"
import type { TailorDorji, TailorDorjiStatus } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

type Comm = "fixed" | "percentage" | "salary"
const COMMISSION_TYPES: Comm[] = ["fixed", "percentage", "salary"]
const COMMISSION_LABEL: Record<Comm, string> = { fixed: "Per piece", percentage: "Percentage (%)", salary: "Salary" }
const STATUS_OPTIONS: TailorDorjiStatus[] = ["active", "on_leave", "inactive"]
const STATUS_LABEL: Record<TailorDorjiStatus, string> = { active: "Active", on_leave: "On leave", inactive: "Inactive" }

/** Bangladesh local digits (no +880 / leading 0) for the phone field; other numbers keep their digits. */
function localPhone(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "")
  if ((raw ?? "").startsWith("+880") || digits.startsWith("880")) return digits.replace(/^880/, "")
  return digits.replace(/^0+/, "")
}

const emptyForm = (): {
  name: string
  phone: string
  address: string
  commissionType: Comm
  commissionValue: string
  maxPieces: string
  status: TailorDorjiStatus
  notes: string
} => ({
  name: "",
  phone: "",
  address: "",
  commissionType: "fixed",
  commissionValue: "",
  maxPieces: "",
  status: "active",
  notes: "",
})

export default function TailorDorjisScreen() {
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [dorjis, setDorjis] = useState<TailorDorji[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [modalVisible, setModalVisible] = useState(false)
  const [editTarget, setEditTarget] = useState<TailorDorji | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTailorDorjis()
      setDorjis(data)
    } catch {
      Alert.alert("Error", "Failed to load dorjis")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openAdd = () => {
    setEditTarget(null)
    setForm(emptyForm())
    setModalVisible(true)
  }

  const openEdit = (d: TailorDorji) => {
    setEditTarget(d)
    setForm({
      name: d.name,
      phone: localPhone(d.phone),
      address: d.address ?? "",
      commissionType: d.commissionType,
      commissionValue: String(d.commissionValue),
      maxPieces: d.maxPieces ? String(d.maxPieces) : "",
      status: d.status,
      notes: d.notes ?? "",
    })
    setModalVisible(true)
  }

  const handleDelete = (d: TailorDorji) => {
    Alert.alert(
      "Delete Dorji",
      `Remove "${d.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTailorDorji(d.id)
              await load()
            } catch (e) {
              Alert.alert("Could not delete", tailorApiError(e, "Failed to delete dorji"))
            }
          },
        },
      ]
    )
  }

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert("Name is required"); return }
    const phone = form.phone.replace(/\D/g, "")
    if (!phone) { Alert.alert("Phone is required"); return }
    if (!/^[0-9]{6,15}$/.test(phone)) { Alert.alert("Enter a valid phone number (digits only)"); return }
    const cv = form.commissionValue.trim() === "" ? 0 : parseFloat(form.commissionValue)
    if (isNaN(cv) || cv < 0) { Alert.alert("Enter a valid commission value"); return }
    if (form.commissionType === "percentage" && cv > 100) { Alert.alert("Percentage cannot be more than 100"); return }
    const cap = form.maxPieces.trim() === "" ? null : Number(form.maxPieces)
    if (cap != null && (!Number.isInteger(cap) || cap < 0)) { Alert.alert("Capacity must be a whole number"); return }

    setSaving(true)
    try {
      const payload: Partial<TailorDorji> = {
        name: form.name.trim(),
        phone,
        address: form.address.trim() || undefined,
        commissionType: form.commissionType,
        commissionValue: cv,
        status: form.status,
        notes: form.notes.trim() || undefined,
        maxPieces: cap,
      }
      if (editTarget) {
        await updateTailorDorji(editTarget.id, payload)
      } else {
        await createTailorDorji(payload)
      }
      setModalVisible(false)
      await load()
    } catch (e) {
      Alert.alert("Error", tailorApiError(e, `Failed to ${editTarget ? "update" : "create"} dorji`))
    } finally {
      setSaving(false)
    }
  }

  if (!canRead("TailorDorji")) return <AccessDenied />

  const filtered = search.trim()
    ? dorjis.filter(d => d.name.toLowerCase().includes(search.trim().toLowerCase()) || (d.phone ?? "").includes(search.trim()))
    : dorjis

  const activeDorjis = dorjis.filter(d => d.status === "active").length

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Dorjis</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Total</Text>
          <Text style={s.statValue}>{dorjis.length}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Active</Text>
          <Text style={[s.statValue, { color: "#16a34a" }]}>{activeDorjis}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Inactive / leave</Text>
          <Text style={[s.statValue, { color: colors.muted }]}>{dorjis.length - activeDorjis}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
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

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="people-outline" size={48} color={colors.muted} />
          <Text style={s.emptyText}>{search ? "No dorjis match your search" : "No dorjis yet"}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={d => String(d.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: d }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => canWrite("TailorDorji") && openEdit(d)}
              onLongPress={() => canWrite("TailorDorji") && handleDelete(d)}
              delayLongPress={500}
            >
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dorjiName}>{d.name}</Text>
                  <Text style={s.dorjiPhone}>
                    <Ionicons name="call-outline" size={12} color={colors.muted} /> {localPhone(d.phone) ? `+880 ${localPhone(d.phone)}` : d.phone}
                  </Text>
                  {d.address ? (
                    <Text style={s.dorjiAddress}>
                      <Ionicons name="location-outline" size={12} color={colors.muted} /> {d.address}
                    </Text>
                  ) : null}
                </View>
                <View style={[s.statusBadge, d.status === "active" ? s.statusActive : s.statusInactive]}>
                  <Text style={[s.statusText, d.status === "active" ? s.statusTextActive : s.statusTextInactive]}>
                    {STATUS_LABEL[d.status] ?? d.status}
                  </Text>
                </View>
              </View>

              <View style={s.cardFooter}>
                <View style={s.metaPill}>
                  <Ionicons name="briefcase-outline" size={12} color="#7c3aed" />
                  <Text style={s.metaPillText}>{d.activeOrders ?? 0} active orders</Text>
                </View>
                {d.maxPieces ? (
                  <View style={s.metaPill}>
                    <Ionicons name="speedometer-outline" size={12} color="#7c3aed" />
                    <Text style={s.metaPillText}>max {d.maxPieces} pcs</Text>
                  </View>
                ) : null}
                <View style={s.metaPill}>
                  <Ionicons name="cash-outline" size={12} color="#7c3aed" />
                  <Text style={s.metaPillText}>
                    {d.commissionType === "percentage"
                      ? `${d.commissionValue}%`
                      : formatCurrency(Number(d.commissionValue) || 0)}{" "}
                    {d.commissionType === "fixed" ? "/ piece" : d.commissionType}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* FAB */}
      {canWrite("TailorDorji") && (
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
          <Text style={s.sheetTitle}>{editTarget ? "Edit Dorji" : "Add Dorji"}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            <Text style={s.inputLabel}>Name *</Text>
            <TextInput
              style={s.input}
              placeholder="Full name"
              placeholderTextColor={colors.muted}
              value={form.name}
              onChangeText={v => setForm(f => ({ ...f, name: v }))}
            />

            <Text style={s.inputLabel}>Phone *</Text>
            <View style={s.phoneRow}>
              <View style={s.phonePrefix}><Text style={s.phonePrefixText}>+880</Text></View>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder="17XX-XXXXXX"
                placeholderTextColor={colors.muted}
                keyboardType="number-pad"
                value={form.phone}
                onChangeText={v => setForm(f => ({ ...f, phone: localPhone(v) }))}
              />
            </View>

            <Text style={s.inputLabel}>Address</Text>
            <TextInput
              style={s.input}
              placeholder="Optional"
              placeholderTextColor={colors.muted}
              value={form.address}
              onChangeText={v => setForm(f => ({ ...f, address: v }))}
            />

            <Text style={s.inputLabel}>Commission Type</Text>
            <View style={s.chipRow}>
              {COMMISSION_TYPES.map(ct => (
                <TouchableOpacity
                  key={ct}
                  style={[s.chip, form.commissionType === ct && s.chipActive]}
                  onPress={() => setForm(f => ({ ...f, commissionType: ct }))}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipText, form.commissionType === ct && s.chipTextActive]}>
                    {COMMISSION_LABEL[ct]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>
              {form.commissionType === "percentage" ? "Commission (%)" : form.commissionType === "salary" ? "Monthly salary" : "Rate per piece"}
            </Text>
            <TextInput
              style={s.input}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="decimal-pad"
              value={form.commissionValue}
              onChangeText={v => setForm(f => ({ ...f, commissionValue: v }))}
            />

            <Text style={s.inputLabel}>Capacity (max pieces in hand)</Text>
            <TextInput
              style={s.input}
              placeholder="Optional"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={form.maxPieces}
              onChangeText={v => setForm(f => ({ ...f, maxPieces: v.replace(/[^0-9]/g, "") }))}
            />

            <Text style={s.inputLabel}>Status</Text>
            <View style={s.chipRow}>
              {STATUS_OPTIONS.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[
                    s.chip,
                    form.status === st && (st === "active" ? s.chipGreen : st === "on_leave" ? s.chipAmber : s.chipGray),
                  ]}
                  onPress={() => setForm(f => ({ ...f, status: st }))}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      s.chipText,
                      form.status === st && s.chipTextActive,
                    ]}
                  >
                    {STATUS_LABEL[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.inputLabel}>Notes</Text>
            <TextInput
              style={[s.input, { height: 72, textAlignVertical: "top" }]}
              placeholder="Optional notes..."
              placeholderTextColor={colors.muted}
              multiline
              value={form.notes}
              onChangeText={v => setForm(f => ({ ...f, notes: v }))}
            />

            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitText}>{editTarget ? "Save Changes" : "Add Dorji"}</Text>}
            </TouchableOpacity>
            <View style={{ height: 20 }} />
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
  statsRow: {
    flexDirection: "row", gap: 12, padding: 16,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "600", textTransform: "uppercase" },
  statValue: { fontSize: 20, fontWeight: "900", color: colors.text, marginTop: 2 },
  searchRow: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, paddingVertical: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
  list: { padding: 16, gap: 10, paddingBottom: 96 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dorjiName: { fontSize: 15, fontWeight: "800", color: colors.text },
  dorjiPhone: { fontSize: 12, color: colors.muted, marginTop: 3 },
  dorjiAddress: { fontSize: 12, color: colors.muted, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusActive: { backgroundColor: "#dcfce7" },
  statusInactive: { backgroundColor: "#f1f5f9" },
  statusText: { fontSize: 11, fontWeight: "700" },
  statusTextActive: { color: "#16a34a" },
  statusTextInactive: { color: colors.muted },
  cardFooter: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  metaPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#f3f0ff", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  metaPillText: { fontSize: 11, fontWeight: "600", color: "#7c3aed" },
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
    padding: 24, paddingBottom: 0, maxHeight: "90%",
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted, marginBottom: 4, marginTop: 8 },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  phoneRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  phonePrefix: {
    justifyContent: "center", paddingHorizontal: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: "#f1f5f9",
  },
  phonePrefixText: { fontSize: 14, fontWeight: "700", color: colors.text },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipGreen: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  chipAmber: { backgroundColor: "#d97706", borderColor: "#d97706" },
  chipGray: { backgroundColor: colors.muted, borderColor: colors.muted },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#7c3aed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 16,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
