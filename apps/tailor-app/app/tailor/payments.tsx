import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  getTailorPayableOptions,
  getTailorPaymentLedger,
  recordTailorLedgerPayment,
  reverseTailorPayout,
  tailorApiError,
} from "@/services/tailor"
import type { TailorLedger, TailorLedgerKind, TailorLedgerRow, TailorPayableOption } from "@/types/tailor"
import { TAILOR_PAY_METHODS } from "@/types/tailor"
import { fmtDate, isIsoDate, todayIso } from "@/components/tailor/tailorHelpers"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const RANGES: { id: string; label: string }[] = [
  { id: "all", label: "All time" }, { id: "month", label: "This month" }, { id: "today", label: "Today" },
]

const TYPE_COLORS: Record<string, string> = { advance: "#2563eb", payment: "#7c3aed", final: "#16a34a", payout: "#d97706" }

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.chip, active && s.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function TailorPaymentsScreen() {
  const { canRead, canWrite, canDelete: canDeletePerm } = useAuth()
  const { formatCurrency } = useCurrency()
  const fc = (n: number) => formatCurrency(n)

  const [tab, setTab] = useState<TailorLedgerKind>("customer")
  const [range, setRange] = useState("all")
  const [search, setSearch] = useState("")
  const [ledger, setLedger] = useState<TailorLedger | null>(null)
  const [rows, setRows] = useState<TailorLedgerRow[]>([])
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const reqId = useRef(0)

  // record form
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<TailorLedgerKind>("customer")
  const [opts, setOpts] = useState<TailorPayableOption[]>([])
  const [optsLoading, setOptsLoading] = useState(false)
  const [selId, setSelId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [date, setDate] = useState(todayIso())
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState("")
  const [saving, setSaving] = useState(false)

  const PER = 20
  const fetchPage = useCallback(async (p: number) => {
    const id = ++reqId.current
    const r = await getTailorPaymentLedger({ kind: tab, range, search: search.trim() || undefined, page: p, per_page: PER })
    if (id !== reqId.current) return
    setLedger(r)
    setRows((prev) => (p === 1 ? r.data : [...prev, ...r.data]))
    setPage(p)
  }, [tab, range, search])

  const reload = useCallback(async () => {
    try { await fetchPage(1) } catch (e) { Alert.alert("Error", tailorApiError(e, "Failed to load payments")) }
  }, [fetchPage])

  useEffect(() => {
    const t = setTimeout(() => { setLoading(true); void reload().finally(() => setLoading(false)) }, 300)
    return () => clearTimeout(t)
  }, [reload])

  /** Only a dorji's most recent payout can be reversed — newest id per dorji among the rows. */
  const latestPayout = useMemo(() => {
    const m: Record<number, number> = {}
    for (const r of rows) if (r.kind === "dorji" && r.dorjiId) m[r.dorjiId] = Math.max(m[r.dorjiId] ?? 0, r.id)
    return m
  }, [rows])

  const loadOpts = useCallback(async (k: TailorLedgerKind, keepSel?: number | null) => {
    setOptsLoading(true)
    try {
      const o = await getTailorPayableOptions(k)
      setOpts(o)
      const cur = o.find((x) => x.id === keepSel) ?? o[0]
      setSelId(cur?.id ?? null)
      setAmount(cur ? String(cur.balance) : "")
    } catch {
      setOpts([])
    } finally {
      setOptsLoading(false)
    }
  }, [])

  const openRecord = (k: TailorLedgerKind = tab) => {
    setKind(k); setErr(""); setReference(""); setNotes(""); setMethod("cash"); setDate(todayIso())
    setOpen(true)
    void loadOpts(k)
  }

  const current = opts.find((o) => o.id === selId)

  const record = async () => {
    const amt = Number(amount)
    if (!current) { setErr(kind === "customer" ? "No orders have a balance due." : "No dorji has unpaid finished work."); return }
    if (!(amt > 0)) { setErr("Enter an amount greater than 0."); return }
    if (amt > current.balance + 0.005) { setErr(`Amount is more than the balance (${fc(current.balance)}).`); return }
    if (!isIsoDate(date)) { setErr("Enter the date as YYYY-MM-DD."); return }
    if (date > todayIso()) { setErr("Payment date cannot be in the future."); return }
    setSaving(true); setErr("")
    try {
      await recordTailorLedgerPayment({
        kind, orderId: kind === "customer" ? current.id : undefined, dorjiId: kind === "dorji" ? current.id : undefined,
        amount: amt, expectedBalance: current.balance, paymentMethod: method, paymentDate: date,
        reference: reference.trim(), notes: notes.trim(),
      })
      setOpen(false)
      setTab(kind)
      if (kind === tab) await reload()
      Alert.alert("Payment recorded", `${fc(amt)} recorded.`)
    } catch (e: any) {
      if (e?.response?.status === 409) {
        // balance changed meanwhile: refresh the figures and let the user review
        await loadOpts(kind, current.id)
        setErr(tailorApiError(e, "This balance changed. Review and retry."))
      } else {
        setErr(tailorApiError(e, "Could not record the payment."))
      }
    } finally {
      setSaving(false)
    }
  }

  const reverse = (r: TailorLedgerRow) => {
    Alert.alert(
      "Reverse payout",
      `Reverse the ${fc(r.amount)} payout to ${r.who} on ${fmtDate(r.paymentDate)}? The jobs it paid become unpaid again and its Salaries expense is removed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reverse",
          style: "destructive",
          onPress: async () => {
            try {
              await reverseTailorPayout(r.id)
              await reload()
            } catch (e) {
              Alert.alert("Could not reverse", tailorApiError(e, "Could not reverse the payout"))
            }
          },
        },
      ],
    )
  }

  if (!canRead("TailorPayments")) return <AccessDenied />

  const st = ledger?.stats
  const canDelete = canDeletePerm("TailorPayments")

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Payments</Text>
        {canWrite("TailorPayments") ? (
          <TouchableOpacity style={s.addBtn} onPress={() => openRecord()} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {/* Stats */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsRow} style={{ flexGrow: 0 }}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Collected this month</Text>
          <Text style={[s.statValue, { color: "#16a34a" }]}>{fc(st?.collectedMonth ?? 0)}</Text>
          <Text style={s.statSub}>{st?.collectedMonthCount ?? 0} payments</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>To collect</Text>
          <Text style={[s.statValue, { color: "#d97706" }]}>{fc(st?.toCollect ?? 0)}</Text>
          <Text style={s.statSub}>{st?.toCollectOrders ?? 0} orders</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Paid dorjis this month</Text>
          <Text style={s.statValue}>{fc(st?.paidDorjisMonth ?? 0)}</Text>
          <Text style={s.statSub}>{st?.paidDorjisCount ?? 0} payouts</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Owed to dorjis</Text>
          <Text style={[s.statValue, { color: "#dc2626" }]}>{fc(st?.owedDorjis ?? 0)}</Text>
          <Text style={s.statSub}>finished work</Text>
        </View>
      </ScrollView>

      {/* Kind tabs */}
      <View style={s.tabs}>
        {([["customer", "Customer payments"], ["dorji", "Dorji payouts"]] as const).map(([k, l]) => (
          <TouchableOpacity key={k} style={[s.tab, tab === k && s.tabActive]} onPress={() => setTab(k)}>
            <Text style={[s.tabText, tab === k && s.tabTextActive]}>{l}{ledger?.counts?.[k] != null ? ` (${ledger.counts[k]})` : ""}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.muted} />
        <TextInput style={s.searchInput} value={search} onChangeText={setSearch} placeholder={tab === "customer" ? "Order, customer, reference" : "Dorji, reference"} placeholderTextColor={colors.muted} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow} style={{ flexGrow: 0 }}>
        {RANGES.map((r) => <Chip key={r.id} label={r.label} active={range === r.id} onPress={() => setRange(r.id)} />)}
      </ScrollView>

      {loading && rows.length === 0 ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p) => `${p.kind}-${p.id}`}
          contentContainerStyle={s.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void reload().finally(() => setRefreshing(false)) }} tintColor="#7c3aed" />}
          onEndReached={() => { if (ledger && rows.length < ledger.total) void fetchPage(page + 1).catch(() => {}) }}
          onEndReachedThreshold={0.3}
          ListHeaderComponent={ledger && rows.length > 0 ? (
            <Text style={s.listHead}>{ledger.total} entr{ledger.total === 1 ? "y" : "ies"} · {fc(ledger.totalAmount)}</Text>
          ) : null}
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="wallet-outline" size={48} color={colors.muted} />
              <Text style={s.emptyText}>{tab === "customer" ? "No customer payments" : "No dorji payouts"}</Text>
            </View>
          }
          renderItem={({ item: p }) => {
            const reversible = canDelete && p.kind === "dorji" && !!p.dorjiId && latestPayout[p.dorjiId] === p.id
            return (
              <TouchableOpacity
                style={s.card}
                activeOpacity={p.orderId ? 0.75 : 1}
                onPress={() => p.orderId && router.push(`/tailor/${p.orderId}` as any)}
              >
                <View style={s.cardRow}>
                  <View style={{ flex: 1 }}>
                    <View style={s.rowCenter}>
                      <Text style={s.who} numberOfLines={1}>{p.who}</Text>
                      <View style={[s.typeBadge, { backgroundColor: (TYPE_COLORS[p.type] ?? "#7c3aed") + "22" }]}>
                        <Text style={[s.typeText, { color: TYPE_COLORS[p.type] ?? "#7c3aed" }]}>{p.typeLabel}</Text>
                      </View>
                    </View>
                    <Text style={s.meta}>{p.refLabel}</Text>
                    <Text style={s.meta}>{p.methodLabel} · {fmtDate(p.paymentDate)}</Text>
                  </View>
                  <Text style={[s.amount, p.kind === "dorji" && { color: "#d97706" }]}>{fc(p.amount)}</Text>
                </View>
                {reversible && (
                  <TouchableOpacity style={s.reverseBtn} onPress={() => reverse(p)} hitSlop={6}>
                    <Ionicons name="arrow-undo-outline" size={14} color={colors.danger} />
                    <Text style={s.reverseText}>Reverse payout</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )
          }}
        />
      )}

      {/* Record payment */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={s.overlay} onPress={() => setOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Record payment</Text>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              <View style={s.tabs}>
                {([["customer", "Customer pays"], ["dorji", "Pay a dorji"]] as const).map(([k, l]) => (
                  <TouchableOpacity key={k} style={[s.tab, kind === k && s.tabActive]} onPress={() => { setKind(k); setErr(""); void loadOpts(k) }}>
                    <Text style={[s.tabText, kind === k && s.tabTextActive]}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={s.inputLabel}>{kind === "customer" ? "Order with a balance *" : "Dorji with unpaid finished work *"}</Text>
              {optsLoading ? <ActivityIndicator color="#7c3aed" /> : (
                <View style={s.optList}>
                  {opts.map((o) => (
                    <TouchableOpacity
                      key={o.id}
                      style={[s.optRow, selId === o.id && s.optRowActive]}
                      onPress={() => { setSelId(o.id); setAmount(String(o.balance)); setErr("") }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={s.optTitle}>{kind === "customer" ? o.orderNumber : o.name}</Text>
                        {kind === "customer" && o.name ? <Text style={s.meta}>{o.name}</Text> : null}
                      </View>
                      <Text style={s.optBal}>{fc(o.balance)}</Text>
                    </TouchableOpacity>
                  ))}
                  {opts.length === 0 && (
                    <Text style={s.meta}>{kind === "customer" ? "No orders have a balance due." : "No dorji has unpaid finished work."}</Text>
                  )}
                </View>
              )}
              <Text style={s.inputLabel}>Amount *{current ? ` (balance ${fc(current.balance)})` : ""}</Text>
              <TextInput style={s.input} keyboardType="decimal-pad" value={amount} onChangeText={(v) => { setAmount(v); setErr("") }} placeholder="0.00" placeholderTextColor={colors.muted} />
              <Text style={s.inputLabel}>Method</Text>
              <View style={s.wrapRow}>
                {TAILOR_PAY_METHODS.map((m) => <Chip key={m.id} label={m.label} active={method === m.id} onPress={() => setMethod(m.id)} />)}
              </View>
              <Text style={s.inputLabel}>Date *</Text>
              <TextInput style={s.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
              <Text style={s.inputLabel}>Reference</Text>
              <TextInput style={s.input} value={reference} onChangeText={setReference} placeholder="Transaction ID (optional)" placeholderTextColor={colors.muted} />
              <Text style={s.inputLabel}>Notes</Text>
              <TextInput style={s.input} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={colors.muted} />
              {kind === "dorji" ? <Text style={s.meta}>Dorji payouts are also recorded as a Salaries expense.</Text> : null}
              {err ? <Text style={s.errText}>{err}</Text> : null}
              <TouchableOpacity style={[s.submitBtn, saving && { opacity: 0.6 }]} onPress={() => void record()} disabled={saving} activeOpacity={0.85}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Record payment</Text>}
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },
  addBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center" },
  statsRow: { gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  statBox: { width: 160, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, gap: 2 },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
  statValue: { fontSize: 17, fontWeight: "800", color: "#7c3aed" },
  statSub: { fontSize: 11, color: colors.muted },
  tabs: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 3, marginHorizontal: 16, marginTop: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: "#7c3aed" },
  tabText: { fontSize: 13, fontWeight: "700", color: colors.muted },
  tabTextActive: { color: "#fff" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 10,
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 9, fontSize: 14, color: colors.text },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  chipTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 15, color: colors.muted, fontWeight: "600" },
  list: { padding: 16, paddingTop: 4, gap: 10, paddingBottom: 40 },
  listHead: { fontSize: 12, color: colors.muted, fontWeight: "600", marginBottom: 2 },
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  who: { fontSize: 14, fontWeight: "800", color: colors.text, flexShrink: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  typeText: { fontSize: 10, fontWeight: "800" },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "800", color: "#16a34a" },
  reverseBtn: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fee2e2" },
  reverseText: { fontSize: 12, fontWeight: "700", color: colors.danger },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32, gap: 8, maxHeight: "90%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optList: { gap: 6 },
  optRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
  optRowActive: { borderColor: "#7c3aed", backgroundColor: "#f5f3ff" },
  optTitle: { fontSize: 13, fontWeight: "800", color: colors.text },
  optBal: { fontSize: 13, fontWeight: "800", color: "#d97706" },
  errText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
  submitBtn: { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 4 },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
