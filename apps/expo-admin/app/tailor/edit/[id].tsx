import React, { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import { getTailorOrder, updateTailorOrder } from "@/services/tailor"
import type { TailorOrder } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

export default function EditTailorOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<TailorOrder | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [itemsExpanded, setItemsExpanded] = useState(false)

  // Editable fields
  const [deliveryDate, setDeliveryDate] = useState("")
  const [stitchingCharge, setStitchingCharge] = useState("0")
  const [extraCharge, setExtraCharge] = useState("0")
  const [discount, setDiscount] = useState("0")
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (!id) return
    setLoading(true)
    getTailorOrder(+id)
      .then((o) => {
        setOrder(o)
        setDeliveryDate(o.deliveryDate ? o.deliveryDate.slice(0, 10) : "")
        setStitchingCharge(String(o.stitchingCharge))
        setExtraCharge(String(o.extraCharge))
        setDiscount(String(o.discount))
        setNotes(o.notes ?? "")
      })
      .catch((err: any) => {
        Alert.alert("Error", err?.message ?? "Failed to load order")
      })
      .finally(() => setLoading(false))
  }, [id])

  if (!canWrite("TailorOrders")) return <AccessDenied />

  const fabricTotal =
    order?.items?.reduce((sum, item) => sum + item.fabricQuantity * item.fabricUnitPrice, 0) ?? 0
  const stitching = parseFloat(stitchingCharge) || 0
  const extra = parseFloat(extraCharge) || 0
  const disc = parseFloat(discount) || 0
  const liveTotal = Math.max(0, fabricTotal + stitching + extra - disc)

  const handleSubmit = async () => {
    if (!id) return
    setSubmitting(true)
    try {
      await updateTailorOrder(+id, {
        delivery_date: deliveryDate || undefined,
        stitching_charge: stitching,
        extra_charge: extra,
        discount: disc,
        notes: notes.trim() || undefined,
      })
      router.back()
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to update order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>Edit Order</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.loadingContainer}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={s.loadingText}>Loading order...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* ── Order number badge ── */}
          {order && (
            <View style={s.orderBadgeRow}>
              <View style={s.orderBadge}>
                <Text style={s.orderBadgeText}>#{order.orderNumber}</Text>
              </View>
              <Text style={s.orderDate}>Placed: {order.orderDate?.slice(0, 10)}</Text>
            </View>
          )}

          {/* ── Customer info (read-only) ── */}
          {order?.customer && (
            <View style={s.card}>
              <Text style={s.sectionHeader}>Customer</Text>
              <View style={s.infoCard}>
                <View style={s.infoRow}>
                  <Ionicons name="person-outline" size={15} color={colors.muted} />
                  <Text style={s.infoText}>{order.customer.name}</Text>
                </View>
                <View style={s.infoRow}>
                  <Ionicons name="call-outline" size={15} color={colors.muted} />
                  <Text style={s.infoText}>{order.customer.phone}</Text>
                </View>
                {order.customer.address ? (
                  <View style={s.infoRow}>
                    <Ionicons name="location-outline" size={15} color={colors.muted} />
                    <Text style={s.infoText}>{order.customer.address}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          {/* ── Items (read-only, collapsible) ── */}
          {order?.items && order.items.length > 0 && (
            <View style={s.card}>
              <TouchableOpacity
                style={s.collapseHeader}
                onPress={() => setItemsExpanded((v) => !v)}
                activeOpacity={0.75}
              >
                <Text style={s.sectionHeader}>
                  Items ({order.items.length})
                </Text>
                <Ionicons
                  name={itemsExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.muted}
                />
              </TouchableOpacity>

              {itemsExpanded &&
                order.items.map((item, idx) => {
                  const subtotal = item.fabricQuantity * item.fabricUnitPrice
                  return (
                    <View key={item.id ?? idx} style={s.itemRow}>
                      <View style={s.itemRowLeft}>
                        <Text style={s.itemType}>{item.productType}</Text>
                        {item.fabric ? (
                          <Text style={s.itemFabric}>{item.fabric.name}</Text>
                        ) : null}
                        <Text style={s.itemQty}>Qty: {item.fabricQuantity}</Text>
                      </View>
                      <Text style={s.itemSubtotal}>{formatCurrency(subtotal)}</Text>
                    </View>
                  )
                })}
            </View>
          )}

          {/* ── Editable: Charges & Dates ── */}
          <View style={s.card}>
            <Text style={s.sectionHeader}>Charges &amp; Dates</Text>

            <Text style={s.label}>Delivery Date</Text>
            <TextInput
              style={s.input}
              value={deliveryDate}
              onChangeText={setDeliveryDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
            />

            <View style={s.twoCol}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Stitching</Text>
                <TextInput
                  style={s.input}
                  value={stitchingCharge}
                  onChangeText={setStitchingCharge}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Extra Charge</Text>
                <TextInput
                  style={s.input}
                  value={extraCharge}
                  onChangeText={setExtraCharge}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>

            <Text style={s.label}>Discount</Text>
            <TextInput
              style={s.input}
              value={discount}
              onChangeText={setDiscount}
              keyboardType="decimal-pad"
              placeholderTextColor={colors.muted}
            />

            <View style={s.totalBox}>
              <Text style={s.totalLabel}>Estimated Total</Text>
              <Text style={s.totalValue}>{formatCurrency(liveTotal)}</Text>
            </View>
          </View>

          {/* ── Notes ── */}
          <View style={s.card}>
            <Text style={s.sectionHeader}>Notes</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional notes..."
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[s.submitBtn, submitting && s.submitBtnDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={s.submitBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "800", color: colors.text },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { fontSize: 14, color: colors.muted },
  content: { padding: 16, gap: 14 },
  orderBadgeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orderBadge: {
    backgroundColor: "#ede9fe",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  orderBadgeText: { fontSize: 13, fontWeight: "700", color: "#7c3aed" },
  orderDate: { fontSize: 13, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 2 },
  infoCard: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 8,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 14, color: colors.text, flex: 1 },
  collapseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 4,
  },
  itemRowLeft: { gap: 2, flex: 1 },
  itemType: { fontSize: 13, fontWeight: "700", color: colors.text },
  itemFabric: { fontSize: 12, color: colors.muted },
  itemQty: { fontSize: 12, color: colors.muted },
  itemSubtotal: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  label: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  notesInput: { minHeight: 80 },
  twoCol: { flexDirection: "row", gap: 10 },
  totalBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ede9fe",
    borderRadius: 10,
    padding: 12,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  totalValue: { fontSize: 18, fontWeight: "800", color: "#7c3aed" },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#7c3aed",
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
})
