import React, { useCallback, useEffect, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
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
  assignTailorWork,
  deleteTailorAssignment,
  getTailorAssignmentBoard,
  getTailorAssignmentOptions,
  patchTailorAssignment,
  tailorApiError,
  transitionTailorOrder,
} from "@/services/tailor"
import type {
  TailorAssignmentDorjiOption, TailorAssignmentOrderOption, TailorAssignmentRow, TailorWorkStatus,
} from "@/types/tailor"
import { WORK_STATUS_LABELS } from "@/types/tailor"
import { askPrintOrShare, assignmentCardsHtml, fmtDate, isIsoDate, todayIso } from "@/components/tailor/tailorHelpers"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const WORK_STATUS_COLORS: Record<TailorWorkStatus, string> = {
  assigned: "#8b5cf6",
  in_progress: "#f59e0b",
  completed: "#22c55e",
  returned: "#ef4444",
  paid: "#0d9488",
}

type FilterKey = "all" | TailorWorkStatus
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "assigned", label: "Assigned" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Done" },
  { key: "returned", label: "Returned" },
  { key: "paid", label: "Paid" },
]
/** Statuses a person may set here; "paid" only comes from a dorji payout. */
const EDITABLE: TailorWorkStatus[] = ["assigned", "in_progress", "completed", "returned"]

interface FormState { orderId: number | null; dorjiId: number | null; task: string; qty: string; rate: string; given: string; back: string; notes: string; status: TailorWorkStatus }
const blank = (): FormState => ({ orderId: null, dorjiId: null, task: "", qty: "", rate: "", given: todayIso(), back: "", notes: "", status: "assigned" })

function Chip({ label, active, onPress, color = "#7c3aed" }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity style={[s.chip, active && { backgroundColor: color, borderColor: color }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function TailorAssignmentsScreen() {
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()
  const fc = (n: number) => formatCurrency(n)
  const writable = canWrite("TailorOrders")

  const [rows, setRows] = useState<TailorAssignmentRow[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [payPending, setPayPending] = useState(0)
  const [unassigned, setUnassigned] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<FilterKey>("all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [lastPage, setLastPage] = useState(1)
  const reqId = useRef(0)

  // options for the create form
  const [orders, setOrders] = useState<TailorAssignmentOrderOption[]>([])
  const [dorjis, setDorjis] = useState<TailorAssignmentDorjiOption[]>([])

  const [sheet, setSheet] = useState<"create" | "edit" | null>(null)
  const [editing, setEditing] = useState<TailorAssignmentRow | null>(null)
  const [form, setForm] = useState<FormState>(blank())
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const params = useCallback((p: number) => ({
    search: search.trim() || undefined, work_status: filter !== "all" ? filter : undefined, page: p, limit: 20,
  }), [search, filter])

  const fetchPage = useCallback(async (p: number) => {
    const id = ++reqId.current
    const r = await getTailorAssignmentBoard(params(p))
    if (id !== reqId.current) return
    setRows((prev) => (p === 1 ? r.rows : [...prev, ...r.rows]))
    setCounts(r.counts)
    setPayPending(r.payPending)
    setUnassigned(r.unassignedOrders)
    setPage(r.pagination.page)
    setLastPage(r.pagination.lastPage)
  }, [params])

  const reload = useCallback(async () => {
    try { await fetchPage(1) } catch (e) { Alert.alert("Error", tailorApiError(e, "Failed to load assignments")) }
  }, [fetchPage])

  useEffect(() => {
    const t = setTimeout(() => { setLoading(true); void reload().finally(() => setLoading(false)) }, 300)
    return () => clearTimeout(t)
  }, [reload])

  const loadOptions = useCallback(async () => {
    try {
      const o = await getTailorAssignmentOptions()
      setOrders(o.orders); setDorjis(o.dorjis)
    } catch { /* form shows empty lists */ }
  }, [])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setErr("") }

  const openCreate = async (prefill?: TailorAssignmentOrderOption) => {
    setEditing(null)
    setForm(prefill ? { ...blank(), orderId: prefill.id, task: prefill.task, qty: prefill.pieces ? String(prefill.pieces) : "", back: prefill.deliveryDate ?? "" } : blank())
    setErr("")
    setSheet("create")
    await loadOptions()
  }

  const openEdit = async (r: TailorAssignmentRow) => {
    if (r.workStatus === "paid") { Alert.alert("Paid job", "Paid jobs cannot be changed."); return }
    setEditing(r)
    setForm({
      orderId: r.orderId, dorjiId: r.dorjiId, task: r.task ?? "", qty: String(r.pieces), rate: String(r.ratePerPiece),
      given: r.assignedDate ?? todayIso(), back: r.expectedCompletion ?? "", notes: r.adminNotes ?? "", status: r.workStatus,
    })
    setErr("")
    setSheet("edit")
    if (dorjis.length === 0) await loadOptions()
  }

  const pickOrder = (o: TailorAssignmentOrderOption) =>
    setForm((f) => ({ ...f, orderId: o.id, task: o.task, qty: o.pieces ? String(o.pieces) : f.qty, back: o.deliveryDate || f.back }))
  const pickDorji = (d: TailorAssignmentDorjiOption) =>
    setForm((f) => ({ ...f, dorjiId: d.id, rate: d.ratePerPiece ? String(d.ratePerPiece) : f.rate }))

  const afterPatch = async (res: { orderAllDone: boolean; orderId?: number; orderNumber?: string; orderMovedBack: boolean }, label?: string) => {
    if (res.orderMovedBack) Alert.alert("Order moved back", `${label ?? "The order"} moved back to stitching.`)
    if (res.orderAllDone && res.orderId) {
      const oid = res.orderId
      Alert.alert("All jobs done", `All jobs for ${res.orderNumber ?? "this order"} are done. Mark the order as ready?`, [
        { text: "Not now", style: "cancel" },
        {
          text: "Mark ready",
          onPress: async () => {
            try { await transitionTailorOrder(oid, "ready", "All dorji jobs finished") } catch (e) { Alert.alert("Error", tailorApiError(e, "Could not update the order")) }
          },
        },
      ])
    }
  }

  const save = async () => {
    const qty = Number(form.qty), rate = Number(form.rate)
    if (!form.task.trim()) { setErr("Describe the task."); return }
    if (!(qty > 0) || !Number.isInteger(qty)) { setErr("Pieces must be a whole number above 0."); return }
    if (form.rate === "" || !isFinite(rate) || rate < 0) { setErr("Enter a valid rate per piece."); return }
    if (form.back && !isIsoDate(form.back)) { setErr("Enter the back date as YYYY-MM-DD."); return }

    if (sheet === "edit" && editing) {
      setSaving(true); setErr("")
      try {
        const res = await patchTailorAssignment(editing.id, {
          dorjiId: form.dorjiId ?? undefined, task: form.task.trim(), pieces: qty, ratePerPiece: rate,
          expectedCompletion: form.back || null, adminNotes: form.notes.trim() || null,
          workStatus: form.status !== editing.workStatus ? form.status : undefined,
        })
        setSheet(null)
        await reload()
        await afterPatch(res, editing.orderNumber ?? undefined)
      } catch (e) {
        setErr(tailorApiError(e, "Could not update the assignment"))
      } finally {
        setSaving(false)
      }
      return
    }

    const o = orders.find((x) => x.id === form.orderId)
    const d = dorjis.find((x) => x.id === form.dorjiId)
    if (!o) { setErr("Select an order."); return }
    if (!d) { setErr("Select a dorji."); return }
    if (d.status !== "active") { setErr(`${d.name} is not active.`); return }
    if (!isIsoDate(form.given)) { setErr("Enter the given date as YYYY-MM-DD."); return }
    if (form.back && form.back < form.given) { setErr("Expected back date cannot be before the assigned date."); return }
    const payload = {
      orderId: o.id, dorjiId: d.id, task: form.task.trim(), pieces: qty, ratePerPiece: rate,
      assignedDate: form.given, expectedCompletion: form.back || null, adminNotes: form.notes.trim() || null,
    }
    const done = async () => { setSheet(null); await reload() }
    setSaving(true); setErr("")
    try {
      await assignTailorWork(payload)
      await done()
    } catch (e: any) {
      if (e?.response?.status === 409) {
        Alert.alert("Over capacity", e.response.data?.message || "This dorji is over capacity. Assign anyway?", [
          { text: "Cancel", style: "cancel" },
          {
            text: "Assign anyway",
            onPress: async () => {
              try { await assignTailorWork({ ...payload, force: true }); await done() } catch (er) { setErr(tailorApiError(er, "Could not assign the work.")) }
            },
          },
        ])
      } else {
        setErr(tailorApiError(e, "Could not assign the work."))
      }
    } finally {
      setSaving(false)
    }
  }

  const remove = (r: TailorAssignmentRow) => {
    Alert.alert("Delete assignment", `Delete this assignment (${r.orderNumber ?? "order"} · ${r.task ?? "task"})?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTailorAssignment(r.id)
            await reload()
          } catch (e) {
            Alert.alert("Could not delete", tailorApiError(e, "Could not delete the assignment"))
          }
        },
      },
    ])
  }

  const printList = () => {
    if (rows.length === 0) { Alert.alert("Nothing to print", "No assignments in this list."); return }
    askPrintOrShare("Job cards", () => assignmentCardsHtml(rows, fc))
  }

  if (!canRead("TailorOrders")) return <AccessDenied />

  const activeDorjis = dorjis.filter((d) => d.status === "active" || d.id === editing?.dorjiId)

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Assignments</Text>
        <TouchableOpacity style={s.iconBtn} onPress={printList} hitSlop={6}>
          <Ionicons name="print-outline" size={17} color="#7c3aed" />
        </TouchableOpacity>
        {writable ? (
          <TouchableOpacity style={s.addBtn} onPress={() => void openCreate()} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>To pay dorjis</Text>
          <Text style={s.statValue}>{fc(payPending)}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Unassigned orders</Text>
          <Text style={s.statValue}>{unassigned}</Text>
        </View>
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder="Order, customer, dorji or task" placeholderTextColor={colors.muted} />
      </View>

      <View style={s.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={`${f.label}${counts[f.key] != null ? ` ${counts[f.key]}` : ""}`} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>

      {loading && rows.length === 0 ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => String(a.id)}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void reload().finally(() => setRefreshing(false)) }} tintColor="#7c3aed" />}
          onEndReached={() => { if (page < lastPage) void fetchPage(page + 1).catch(() => {}) }}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="clipboard-outline" size={48} color={colors.muted} />
              <Text style={s.emptyText}>No assignments found</Text>
            </View>
          }
          renderItem={({ item: a }) => (
            <TouchableOpacity style={s.card} activeOpacity={0.75} onPress={() => (writable ? void openEdit(a) : undefined)}>
              <View style={s.cardHeader}>
                <View style={{ flex: 1 }}>
                  <TouchableOpacity onPress={() => router.push(`/tailor/${a.orderId}` as any)} hitSlop={6}>
                    <Text style={s.orderLink}>{a.orderNumber ?? `Order #${a.orderId}`}</Text>
                  </TouchableOpacity>
                  <Text style={s.taskText}>{a.task ?? "Task"} · {a.pieces} pcs</Text>
                  <Text style={s.metaText}>{a.dorjiName ?? `Dorji #${a.dorjiId}`}{a.customerName ? ` · for ${a.customerName}` : ""}</Text>
                </View>
                <View style={[s.badge, { backgroundColor: WORK_STATUS_COLORS[a.workStatus] ?? "#8b5cf6" }]}>
                  <Text style={s.badgeText}>{WORK_STATUS_LABELS[a.workStatus] ?? a.workStatus}</Text>
                </View>
              </View>

              <View style={s.metaRow}>
                <Ionicons name="calendar-outline" size={13} color={colors.muted} />
                <Text style={s.metaText}>Given {fmtDate(a.assignedDate)}{a.dueDate ? ` · back ${fmtDate(a.dueDate)}` : ""}</Text>
              </View>

              <View style={s.chargeRow}>
                <Text style={s.chargeLabel}>{a.pieces} × {fc(a.ratePerPiece)}</Text>
                <Text style={s.chargeValue}>{fc(a.dorjiCharge)}</Text>
              </View>
              {a.payable > 0 ? <Text style={s.payable}>To pay: {fc(a.payable)}</Text> : null}
              {a.adminNotes ? <Text style={s.notes} numberOfLines={2}>{a.adminNotes}</Text> : null}

              <View style={s.actions}>
                <TouchableOpacity style={s.actionBtn} onPress={() => askPrintOrShare(`Job card ${a.orderNumber ?? ""}`, () => assignmentCardsHtml([a], fc))} hitSlop={6}>
                  <Ionicons name="print-outline" size={14} color="#7c3aed" />
                  <Text style={s.actionText}>Job card</Text>
                </TouchableOpacity>
                {writable && a.workStatus !== "paid" && (
                  <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={() => remove(a)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={[s.actionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create / edit sheet */}
      <Modal visible={sheet != null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={s.overlay} onPress={() => setSheet(null)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>{sheet === "edit" ? "Edit assignment" : "Assign work"}</Text>
            {sheet === "edit" && editing ? <Text style={s.sheetSub}>{editing.orderNumber} · {editing.customerName ?? ""}</Text> : null}
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
              {sheet === "create" && (
                <>
                  <Text style={s.inputLabel}>Order *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {orders.map((o) => (
                      <TouchableOpacity key={o.id} style={[s.optCard, form.orderId === o.id && s.optCardActive]} onPress={() => pickOrder(o)}>
                        <Text style={[s.optTitle, form.orderId === o.id && { color: "#7c3aed" }]}>{o.orderNumber}{o.unassigned ? " · new" : ""}</Text>
                        <Text style={s.optSub} numberOfLines={1}>{o.customerName ?? "—"}</Text>
                        <Text style={s.optSub} numberOfLines={1}>{o.garments}</Text>
                      </TouchableOpacity>
                    ))}
                    {orders.length === 0 && <Text style={s.metaText}>No open orders.</Text>}
                  </ScrollView>
                </>
              )}
              <Text style={s.inputLabel}>Dorji *</Text>
              <View style={s.wrapRow}>
                {activeDorjis.map((d) => (
                  <Chip
                    key={d.id}
                    label={`${d.name}${d.maxPieces ? ` (${d.piecesInHand}/${d.maxPieces})` : ""}`}
                    active={form.dorjiId === d.id}
                    onPress={() => pickDorji(d)}
                  />
                ))}
                {activeDorjis.length === 0 && <Text style={s.metaText}>No active dorjis.</Text>}
              </View>
              <Text style={s.inputLabel}>Task *</Text>
              <TextInput style={s.input} value={form.task} onChangeText={(v) => set("task", v)} placeholder="e.g. Blouse stitching" placeholderTextColor={colors.muted} />
              <View style={s.twoCol}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.inputLabel}>Pieces *</Text>
                  <TextInput style={s.input} keyboardType="number-pad" value={form.qty} onChangeText={(v) => set("qty", v)} placeholder="1" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.inputLabel}>Rate / piece *</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" value={form.rate} onChangeText={(v) => set("rate", v)} placeholder="0" placeholderTextColor={colors.muted} />
                </View>
              </View>
              <Text style={s.metaText}>Dorji charge: {fc((Number(form.qty) || 0) * (Number(form.rate) || 0))}</Text>
              {sheet === "edit" && (
                <>
                  <Text style={s.inputLabel}>Work status</Text>
                  <View style={s.wrapRow}>
                    {EDITABLE.map((ws) => (
                      <Chip key={ws} label={WORK_STATUS_LABELS[ws]} active={form.status === ws} color={WORK_STATUS_COLORS[ws]} onPress={() => set("status", ws)} />
                    ))}
                  </View>
                </>
              )}
              <View style={s.twoCol}>
                {sheet === "create" && (
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={s.inputLabel}>Given</Text>
                    <TextInput style={s.input} value={form.given} onChangeText={(v) => set("given", v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.inputLabel}>Back by</Text>
                  <TextInput style={s.input} value={form.back} onChangeText={(v) => set("back", v)} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
                </View>
              </View>
              <Text style={s.inputLabel}>Notes</Text>
              <TextInput
                style={[s.input, { minHeight: 64 }]}
                value={form.notes}
                onChangeText={(v) => set("notes", v)}
                placeholder="Optional"
                placeholderTextColor={colors.muted}
                multiline
                textAlignVertical="top"
              />
              {err ? <Text style={s.errText}>{err}</Text> : null}
              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={() => void save()} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>{sheet === "edit" ? "Save changes" : "Assign"}</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 4 },
  statLabel: { fontSize: 12, color: colors.muted, fontWeight: "600" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#7c3aed" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14, color: colors.text },
  filterWrap: { paddingVertical: 10 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  chipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  orderLink: { fontSize: 13, color: "#7c3aed", fontWeight: "800" },
  taskText: { fontSize: 15, fontWeight: "800", color: colors.text, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { fontSize: 12, color: colors.muted },
  chargeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f5f3ff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  chargeLabel: { fontSize: 13, color: "#7c3aed", fontWeight: "600" },
  chargeValue: { fontSize: 15, fontWeight: "800", color: "#7c3aed" },
  payable: { fontSize: 12, color: "#d97706", fontWeight: "700" },
  notes: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#ede9fe" },
  deleteBtn: { backgroundColor: "#fee2e2" },
  actionText: { fontSize: 12, fontWeight: "700", color: "#7c3aed" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, gap: 8, maxHeight: "88%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  sheetSub: { fontSize: 13, color: colors.muted },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  twoCol: { flexDirection: "row", gap: 10 },
  optCard: { width: 170, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10, gap: 2, backgroundColor: colors.background },
  optCardActive: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  optTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
  optSub: { fontSize: 11, color: colors.muted },
  errText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
  submitBtn: { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
