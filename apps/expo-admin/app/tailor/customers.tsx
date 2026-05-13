import React, { useCallback, useEffect, useState } from "react"
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Modal,
  ScrollView, KeyboardAvoidingView, Platform, RefreshControl,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import {
  getTailorCustomers, saveTailorCustomer, updateTailorCustomer, deleteTailorCustomer, getCustomerOrders,
} from "@/services/tailor"
import type { TailorCustomer, TailorOrder } from "@/types/tailor"
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from "@/types/tailor"
import { colors } from "@/constants/theme"

// ── Create Modal ──────────────────────────────────────────────────────────────

function CreateModal({
  onClose, onCreated,
}: { onClose: () => void; onCreated: (c: TailorCustomer) => void }) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Validation", "Name and phone are required")
      return
    }
    setSaving(true)
    try {
      const created = await saveTailorCustomer({
        name: name.trim(), phone: phone.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onCreated(created)
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to create customer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={m.sheet}>
          <View style={m.sheetHeader}>
            <Text style={m.sheetTitle}>New Customer</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={m.form}>
            <Text style={m.label}>Name *</Text>
            <TextInput style={m.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} placeholder="Full name" autoFocus />

            <Text style={m.label}>Phone *</Text>
            <TextInput style={m.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.muted} placeholder="Phone number" />

            <Text style={m.label}>Address</Text>
            <TextInput style={m.input} value={address} onChangeText={setAddress} placeholderTextColor={colors.muted} placeholder="Address (optional)" />

            <Text style={m.label}>Notes</Text>
            <TextInput style={[m.input, m.textArea]} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" placeholderTextColor={colors.muted} placeholder="Notes (optional)" />

            <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="person-add-outline" size={18} color="#fff" />
                  <Text style={m.saveBtnText}>Add Customer</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Edit Modal ────────────────────────────────────────────────────────────────

function EditModal({
  customer, onClose, onSaved,
}: { customer: TailorCustomer; onClose: () => void; onSaved: (c: TailorCustomer) => void }) {
  const [name, setName] = useState(customer.name)
  const [phone, setPhone] = useState(customer.phone)
  const [address, setAddress] = useState(customer.address ?? "")
  const [notes, setNotes] = useState(customer.notes ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Validation", "Name and phone are required")
      return
    }
    setSaving(true)
    try {
      const updated = await updateTailorCustomer(customer.id, {
        name: name.trim(), phone: phone.trim(),
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved(updated)
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update customer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={m.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={m.sheet}>
          <View style={m.sheetHeader}>
            <Text style={m.sheetTitle}>Edit Customer</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={m.form}>
            <Text style={m.label}>Name *</Text>
            <TextInput style={m.input} value={name} onChangeText={setName} placeholderTextColor={colors.muted} placeholder="Full name" />

            <Text style={m.label}>Phone *</Text>
            <TextInput style={m.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.muted} placeholder="Phone number" />

            <Text style={m.label}>Address</Text>
            <TextInput style={m.input} value={address} onChangeText={setAddress} placeholderTextColor={colors.muted} placeholder="Address (optional)" />

            <Text style={m.label}>Notes</Text>
            <TextInput style={[m.input, m.textArea]} value={notes} onChangeText={setNotes} multiline textAlignVertical="top" placeholderTextColor={colors.muted} placeholder="Notes (optional)" />

            <TouchableOpacity style={[m.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving} activeOpacity={0.85}>
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={m.saveBtnText}>Save Changes</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ── Orders Modal ──────────────────────────────────────────────────────────────

function OrdersModal({
  customer, onClose,
}: { customer: TailorCustomer; onClose: () => void }) {
  const { formatCurrency } = useCurrency()
  const [orders, setOrders] = useState<TailorOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCustomerOrders(customer.id)
      .then(setOrders)
      .catch(() => Alert.alert("Error", "Failed to load orders"))
      .finally(() => setLoading(false))
  }, [customer.id])

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <View style={o.overlay}>
        <SafeAreaView style={o.sheet} edges={["bottom"]}>
          <View style={o.header}>
            <View>
              <Text style={o.title}>{customer.name}</Text>
              <Text style={o.sub}>Order History</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={o.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
          ) : orders.length === 0 ? (
            <View style={o.center}>
              <Ionicons name="cut-outline" size={40} color={colors.muted} />
              <Text style={o.empty}>No orders yet</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              keyExtractor={item => String(item.id)}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              renderItem={({ item }) => {
                const statusColor = ORDER_STATUS_COLORS[item.orderStatus] ?? "#94a3b8"
                return (
                  <TouchableOpacity
                    style={o.orderCard}
                    activeOpacity={0.75}
                    onPress={() => { onClose(); router.push(`/tailor/${item.id}` as any) }}
                  >
                    <View style={[o.accent, { backgroundColor: statusColor }]} />
                    <View style={o.orderBody}>
                      <View style={o.orderRow}>
                        <Text style={o.orderNum}>{item.orderNumber}</Text>
                        <View style={[o.statusPill, { backgroundColor: statusColor + "22" }]}>
                          <Text style={[o.statusText, { color: statusColor }]}>
                            {ORDER_STATUS_LABELS[item.orderStatus]}
                          </Text>
                        </View>
                      </View>
                      <View style={o.orderRow}>
                        <Text style={o.orderDate}>
                          {item.deliveryDate
                            ? new Date(item.deliveryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                            : "No delivery date"}
                        </Text>
                        <Text style={o.orderAmount}>{formatCurrency(item.totalAmount)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              }}
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function TailorCustomersScreen() {
  const { canWrite } = useAuth()
  const [customers, setCustomers] = useState<TailorCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [editTarget, setEditTarget] = useState<TailorCustomer | null>(null)
  const [ordersTarget, setOrdersTarget] = useState<TailorCustomer | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await getTailorCustomers()
      setCustomers(data)
    } catch {
      Alert.alert("Error", "Failed to load customers")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  const handleDelete = (c: TailorCustomer) => {
    Alert.alert(
      "Delete Customer",
      `Delete "${c.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await deleteTailorCustomer(c.id)
              setCustomers(prev => prev.filter(x => x.id !== c.id))
            } catch (err: any) {
              Alert.alert("Error", err?.message ?? "Failed to delete customer")
            }
          },
        },
      ]
    )
  }

  const handleCreated = (created: TailorCustomer) => {
    setCustomers(prev => [created, ...prev])
    setShowCreate(false)
  }

  const handleSaved = (updated: TailorCustomer) => {
    setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
    setEditTarget(null)
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.topTitle}>Customers</Text>
          <Text style={s.topSub}>{customers.length} total</Text>
        </View>
        {canWrite("TailorOrders") && (
          <TouchableOpacity style={s.newBtn} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={s.newBtnText}>New</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name or phone..."
          placeholderTextColor={colors.muted}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color="#7c3aed" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true) }} tintColor="#7c3aed" />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.card}
              activeOpacity={0.75}
              onPress={() => setOrdersTarget(item)}
            >
              <View style={s.avatar}>
                <Text style={s.avatarText}>
                  {item.name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{item.name}</Text>
                <View style={s.metaRow}>
                  <Ionicons name="call-outline" size={12} color={colors.muted} />
                  <Text style={s.phone}>{item.phone}</Text>
                </View>
                {item.address ? (
                  <View style={s.metaRow}>
                    <Ionicons name="location-outline" size={12} color={colors.muted} />
                    <Text style={s.address} numberOfLines={1}>{item.address}</Text>
                  </View>
                ) : null}
              </View>
              <View style={s.actions}>
                {canWrite("TailorOrders") && (
                  <TouchableOpacity style={s.actionBtn} onPress={() => setEditTarget(item)} hitSlop={6}>
                    <Ionicons name="create-outline" size={18} color="#7c3aed" />
                  </TouchableOpacity>
                )}
                {canWrite("TailorOrders") && (
                  <TouchableOpacity style={[s.actionBtn, s.deleteBtn]} onPress={() => handleDelete(item)} hitSlop={6}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <Ionicons name="chevron-forward" size={16} color={colors.muted} />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Ionicons name="people-outline" size={48} color={colors.muted} />
              <Text style={s.empty}>No customers found</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      {canWrite("TailorOrders") && (
        <TouchableOpacity style={s.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {editTarget && (
        <EditModal customer={editTarget} onClose={() => setEditTarget(null)} onSaved={handleSaved} />
      )}
      {ordersTarget && (
        <OrdersModal customer={ordersTarget} onClose={() => setOrdersTarget(null)} />
      )}
    </SafeAreaView>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  topBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#7c3aed", paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 20, fontWeight: "900", color: "#fff" },
  topSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 1 },
  newBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)",
  },
  newBtnText: { fontSize: 13, fontWeight: "800", color: "#fff" },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 9,
    margin: 14, marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text },
  list: { padding: 14, gap: 10 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14,
    shadowColor: "#7c3aed", shadowOpacity: 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "900", color: "#7c3aed" },
  name: { fontSize: 15, fontWeight: "800", color: colors.text },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  phone: { fontSize: 12, color: colors.muted },
  address: { fontSize: 12, color: colors.muted, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  deleteBtn: { backgroundColor: "#fee2e2" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 12 },
  empty: { textAlign: "center", color: colors.muted, fontSize: 14, fontWeight: "600" },
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center",
    shadowColor: "#7c3aed", shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
})

const m = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.text },
  form: { padding: 20, gap: 4, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted, marginTop: 10, marginBottom: 2 },
  input: {
    backgroundColor: colors.background, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: colors.text,
  },
  textArea: { minHeight: 72 },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})

const o = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#f1f5f9", borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "85%", flex: 0,
  },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#7c3aed", paddingHorizontal: 20, paddingVertical: 16,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  title: { fontSize: 17, fontWeight: "900", color: "#fff" },
  sub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  empty: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  orderCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14,
    overflow: "hidden", borderWidth: 1, borderColor: colors.border,
  },
  accent: { width: 4 },
  orderBody: { flex: 1, padding: 12, gap: 6 },
  orderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  orderNum: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: "700" },
  orderDate: { fontSize: 12, color: colors.muted },
  orderAmount: { fontSize: 14, fontWeight: "900", color: "#7c3aed" },
})
