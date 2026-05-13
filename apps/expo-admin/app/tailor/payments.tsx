import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
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
  getTailorPayments, getTailorOrders, createTailorPayment,
} from "@/services/tailor"
import type { TailorPayment, TailorOrder } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Mobile Banking"]

export default function TailorPaymentsScreen() {
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [payments, setPayments] = useState<TailorPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [orders, setOrders] = useState<TailorOrder[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("Cash")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [reference, setReference] = useState("")
  const [saving, setSaving] = useState(false)
  const [orderPickerVisible, setOrderPickerVisible] = useState(false)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTailorPayments()
      setPayments(data)
    } catch {
      Alert.alert("Error", "Failed to load payments")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openModal = async () => {
    setSelectedOrderId(null)
    setAmount("")
    setMethod("Cash")
    setDate(new Date().toISOString().slice(0, 10))
    setReference("")
    try {
      const result = await getTailorOrders({ limit: 200 })
      setOrders(result.data)
    } catch { /* ignore */ }
    setModalVisible(true)
  }

  const handleSelectOrder = (o: TailorOrder) => {
    setSelectedOrderId(o.id)
    if (o.dueAmount > 0) setAmount(String(o.dueAmount))
    setOrderPickerVisible(false)
  }

  const handleSave = async () => {
    if (!selectedOrderId) { Alert.alert("Select an order"); return }
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { Alert.alert("Enter a valid amount"); return }
    if (!date) { Alert.alert("Enter payment date"); return }
    setSaving(true)
    try {
      await createTailorPayment({
        orderId: selectedOrderId,
        amount: amt,
        paymentMethod: method,
        paymentDate: date,
        reference: reference || undefined,
      })
      setModalVisible(false)
      await load()
    } catch {
      Alert.alert("Error", "Failed to record payment")
    } finally {
      setSaving(false)
    }
  }

  if (!canRead("TailorPayments")) return <AccessDenied />

  const selectedOrder = orders.find(o => o.id === selectedOrderId)

  const totalCollected = payments.reduce((s, p) => s + p.amount, 0)

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Payments</Text>
        {canWrite("TailorPayments") ? (
          <TouchableOpacity style={s.addBtn} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}
      </View>

      {/* Stats */}
      <View style={s.statsRow}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Total Collected</Text>
          <Text style={s.statValue}>{formatCurrency(totalCollected)}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Transactions</Text>
          <Text style={s.statValue}>{payments.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : payments.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="wallet-outline" size={48} color={colors.muted} />
          <Text style={s.emptyText}>No payments recorded</Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={s.list}
          renderItem={({ item: p }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => p.orderId && router.push(`/tailor/${p.orderId}` as any)}
            >
              <View style={s.cardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.orderNum}>{p.order?.orderNumber ?? `Order #${p.orderId}`}</Text>
                  {p.order?.customer?.name && (
                    <Text style={s.customerName}>{p.order.customer.name}</Text>
                  )}
                  <Text style={s.meta}>
                    {p.paymentMethod} · {p.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : "—"}
                  </Text>
                  {p.reference ? <Text style={s.reference}>Ref: {p.reference}</Text> : null}
                </View>
                <Text style={s.amount}>{formatCurrency(p.amount)}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Record Payment Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setModalVisible(false)} />
        <View style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Record Payment</Text>

          {/* Order picker */}
          <Text style={s.inputLabel}>Order *</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setOrderPickerVisible(true)} activeOpacity={0.8}>
            <Text style={selectedOrderId ? s.pickerText : s.pickerPlaceholder}>
              {selectedOrder
                ? `${selectedOrder.orderNumber} — ${selectedOrder.customer?.name ?? ""} (Due: ${formatCurrency(selectedOrder.dueAmount)})`
                : "Select an order..."}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </TouchableOpacity>

          {/* Amount */}
          <Text style={s.inputLabel}>Amount *</Text>
          <TextInput
            style={s.input}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          {/* Method */}
          <Text style={s.inputLabel}>Payment Method</Text>
          <View style={s.methodRow}>
            {PAYMENT_METHODS.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.chip, method === m && s.chipActive]}
                onPress={() => setMethod(m)}
                activeOpacity={0.75}
              >
                <Text style={[s.chipText, method === m && s.chipTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date */}
          <Text style={s.inputLabel}>Date *</Text>
          <TextInput
            style={s.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />

          {/* Reference */}
          <Text style={s.inputLabel}>Reference (optional)</Text>
          <TextInput
            style={s.input}
            value={reference}
            onChangeText={setReference}
            placeholder="Transaction ID / ref"
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            style={[s.submitBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Record Payment</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Order Picker Modal */}
      <Modal visible={orderPickerVisible} transparent animationType="fade" onRequestClose={() => setOrderPickerVisible(false)}>
        <Pressable style={s.overlay} onPress={() => setOrderPickerVisible(false)} />
        <View style={[s.sheet, { maxHeight: "70%" }]}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Select Order</Text>
          <FlatList
            data={orders}
            keyExtractor={o => String(o.id)}
            renderItem={({ item: o }) => (
              <TouchableOpacity style={s.orderPickerItem} onPress={() => handleSelectOrder(o)} activeOpacity={0.75}>
                <Text style={s.orderPickerNum}>{o.orderNumber}</Text>
                <Text style={s.orderPickerMeta}>
                  {o.customer?.name ?? "—"} · Due: {formatCurrency(o.dueAmount)} [{o.paymentStatus}]
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={[s.emptyText, { textAlign: "center", padding: 20 }]}>No orders found</Text>}
          />
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
  statsRow: {
    flexDirection: "row", gap: 12, padding: 16,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statBox: {
    flex: 1, backgroundColor: colors.background,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  statLabel: { fontSize: 11, color: colors.muted, fontWeight: "600", textTransform: "uppercase" },
  statValue: { fontSize: 20, fontWeight: "900", color: "#16a34a", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { fontSize: 14, color: colors.muted, marginTop: 8 },
  list: { padding: 16, gap: 10 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  cardRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  orderNum: { fontSize: 14, fontWeight: "800", color: "#7c3aed" },
  customerName: { fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 2 },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  reference: { fontSize: 11, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: "900", color: "#16a34a" },
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
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background,
  },
  chipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  chipTextActive: { color: "#fff" },
  submitBtn: {
    backgroundColor: "#7c3aed", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginTop: 6,
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  orderPickerItem: {
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  orderPickerNum: { fontSize: 14, fontWeight: "700", color: colors.text },
  orderPickerMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
