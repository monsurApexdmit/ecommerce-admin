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
import { getTailorAssignments, updateTailorAssignment } from "@/services/tailor"
import type { TailorAssignment, TailorWorkStatus } from "@/types/tailor"
import { WORK_STATUS_LABELS } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const WORK_STATUS_COLORS: Record<TailorWorkStatus, string> = {
  assigned: "#8b5cf6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  returned: "#ef4444",
}

type FilterKey = "all" | TailorWorkStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "returned", label: "Returned" },
]

export default function TailorAssignmentsScreen() {
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [assignments, setAssignments] = useState<TailorAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>("all")

  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState<TailorAssignment | null>(null)
  const [workStatus, setWorkStatus] = useState<TailorWorkStatus>("assigned")
  const [dorjiCharge, setDorjiCharge] = useState("")
  const [expectedCompletion, setExpectedCompletion] = useState("")
  const [adminNotes, setAdminNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTailorAssignments()
      setAssignments(data)
    } catch {
      Alert.alert("Error", "Failed to load assignments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openEdit = (item: TailorAssignment) => {
    setEditing(item)
    setWorkStatus(item.workStatus)
    setDorjiCharge(String(item.dorjiCharge))
    setExpectedCompletion(item.expectedCompletion ?? "")
    setAdminNotes(item.adminNotes ?? "")
    setModalVisible(true)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await updateTailorAssignment(editing.id, {
        workStatus,
        dorjiCharge: parseFloat(dorjiCharge) || 0,
        expectedCompletion: expectedCompletion || undefined,
        adminNotes: adminNotes || undefined,
      })
      setModalVisible(false)
      await load()
    } catch {
      Alert.alert("Error", "Failed to update assignment")
    } finally {
      setSaving(false)
    }
  }

  if (!canRead("TailorAssignments")) return <AccessDenied />

  const filtered = filter === "all"
    ? assignments
    : assignments.filter(a => a.workStatus === filter)

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Assignments</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter chips */}
      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[s.chip, filter === f.key && s.chipActive]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipText, filter === f.key && s.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="clipboard-outline" size={48} color={colors.muted} />
          <Text style={s.emptyText}>No assignments found</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => String(a.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: a }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => canWrite("TailorAssignments") ? openEdit(a) : undefined}
            >
              {/* Card header */}
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.dorjiName}>{a.dorji?.name ?? `Dorji #${a.dorjiId}`}</Text>
                  <TouchableOpacity
                    onPress={() => router.push(`/tailor/${a.orderId}` as any)}
                    activeOpacity={0.7}
                    hitSlop={6}
                  >
                    <Text style={s.orderLink}>Order #{a.orderId}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[s.badge, { backgroundColor: WORK_STATUS_COLORS[a.workStatus] }]}>
                  <Text style={s.badgeText}>{WORK_STATUS_LABELS[a.workStatus]}</Text>
                </View>
              </View>

              {/* Dates */}
              <View style={s.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                <Text style={s.metaText}>
                  Assigned: {new Date(a.assignedDate).toLocaleDateString()}
                </Text>
                {a.expectedCompletion ? (
                  <>
                    <Text style={s.metaDot}>·</Text>
                    <Text style={s.metaText}>
                      Due: {new Date(a.expectedCompletion).toLocaleDateString()}
                    </Text>
                  </>
                ) : null}
              </View>

              {/* Charge */}
              <View style={s.chargeRow}>
                <Text style={s.chargeLabel}>Dorji Charge</Text>
                <Text style={s.chargeValue}>{formatCurrency(a.dorjiCharge)}</Text>
              </View>

              {/* Admin notes */}
              {a.adminNotes ? (
                <Text style={s.notes} numberOfLines={2}>{a.adminNotes}</Text>
              ) : null}

              {canWrite("TailorAssignments") && (
                <View style={s.editHint}>
                  <Ionicons name="pencil-outline" size={12} color={colors.muted} />
                  <Text style={s.editHintText}>Tap to edit</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      {/* Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={s.overlay} onPress={() => setModalVisible(false)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Edit Assignment</Text>
          {editing && (
            <Text style={s.sheetSub}>
              {editing.dorji?.name ?? `Dorji #${editing.dorjiId}`} · Order #{editing.orderId}
            </Text>
          )}

          {/* Work status */}
          <Text style={s.inputLabel}>Work Status</Text>
          <View style={s.statusRow}>
            {(Object.keys(WORK_STATUS_LABELS) as TailorWorkStatus[]).map(ws => (
              <TouchableOpacity
                key={ws}
                style={[
                  s.statusChip,
                  workStatus === ws && { backgroundColor: WORK_STATUS_COLORS[ws], borderColor: WORK_STATUS_COLORS[ws] },
                ]}
                onPress={() => setWorkStatus(ws)}
                activeOpacity={0.75}
              >
                <Text style={[s.statusChipText, workStatus === ws && s.statusChipTextActive]}>
                  {WORK_STATUS_LABELS[ws]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dorji charge */}
          <Text style={s.inputLabel}>Dorji Charge</Text>
          <TextInput
            style={s.input}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={dorjiCharge}
            onChangeText={setDorjiCharge}
          />

          {/* Expected completion */}
          <Text style={s.inputLabel}>Expected Completion (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={expectedCompletion}
            onChangeText={setExpectedCompletion}
          />

          {/* Admin notes */}
          <Text style={s.inputLabel}>Admin Notes (optional)</Text>
          <TextInput
            style={[s.input, s.textarea]}
            placeholder="Add notes..."
            placeholderTextColor={colors.muted}
            value={adminNotes}
            onChangeText={setAdminNotes}
            multiline
            numberOfLines={3}
          />

          <TouchableOpacity
            style={[s.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitText}>Save Changes</Text>}
          </TouchableOpacity>
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
  filterWrap: {
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
  list: { padding: 16, gap: 12 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8,
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  dorjiName: { fontSize: 15, fontWeight: "800", color: colors.text },
  orderLink: { fontSize: 13, fontWeight: "600", color: "#7c3aed", marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted },
  metaDot: { fontSize: 12, color: colors.muted },
  chargeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chargeLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  chargeValue: { fontSize: 15, fontWeight: "900", color: "#16a34a" },
  notes: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  editHint: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  editHintText: { fontSize: 11, color: colors.muted },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40, gap: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: "center", marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 13, color: colors.muted, marginTop: -4 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  statusChipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  statusChipTextActive: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#7c3aed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 6,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
