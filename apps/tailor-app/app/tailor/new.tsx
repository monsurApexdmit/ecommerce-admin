import React, { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
  findTailorCustomerByPhone,
  createTailorOrder,
} from "@/services/tailor"
import type { TailorCustomer } from "@/types/tailor"
import { PRODUCT_TYPES } from "@/types/tailor"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

interface OrderItem {
  productType: string
  fabricName: string
  fabricQuantity: string
  fabricUnitPrice: string
}

const PAYMENT_METHODS = ["Cash", "Card", "Bank", "Mobile Banking"]
const TODAY = new Date().toISOString().slice(0, 10)

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={s.label}>{label}</Text>
}

export default function NewTailorOrderScreen() {
  const { canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  // Section 1 — Customer
  const [phone, setPhone] = useState("")
  const [searchingCustomer, setSearchingCustomer] = useState(false)
  const [foundCustomer, setFoundCustomer] = useState<TailorCustomer | null>(null)
  const [confirmedCustomer, setConfirmedCustomer] = useState<TailorCustomer | null>(null)
  const [newName, setNewName] = useState("")
  const [newAddress, setNewAddress] = useState("")
  const [customerNotFound, setCustomerNotFound] = useState(false)

  // Section 2 — Items
  const [items, setItems] = useState<OrderItem[]>([
    { productType: PRODUCT_TYPES[0], fabricName: "", fabricQuantity: "1", fabricUnitPrice: "0" },
  ])

  // Section 3 — Charges
  const [orderDate, setOrderDate] = useState(TODAY)
  const [deliveryDate, setDeliveryDate] = useState("")
  const [stitchingCharge, setStitchingCharge] = useState("0")
  const [extraCharge, setExtraCharge] = useState("0")
  const [discount, setDiscount] = useState("0")

  // Section 4 — Advance Payment
  const [advancePayment, setAdvancePayment] = useState("0")
  const [advanceMethod, setAdvanceMethod] = useState("Cash")

  // Notes
  const [notes, setNotes] = useState("")

  const [submitting, setSubmitting] = useState(false)

  if (!canWrite("TailorOrders")) return <AccessDenied />

  const handleSearchCustomer = async () => {
    if (!phone.trim()) {
      Alert.alert("Enter phone number first")
      return
    }
    setSearchingCustomer(true)
    setFoundCustomer(null)
    setConfirmedCustomer(null)
    setCustomerNotFound(false)
    try {
      const result = await findTailorCustomerByPhone(phone.trim())
      if (result) {
        setFoundCustomer(result)
      } else {
        setCustomerNotFound(true)
      }
    } finally {
      setSearchingCustomer(false)
    }
  }

  const handleConfirmCustomer = () => {
    if (foundCustomer) setConfirmedCustomer(foundCustomer)
  }

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { productType: PRODUCT_TYPES[0], fabricName: "", fabricQuantity: "1", fabricUnitPrice: "0" },
    ])
  }

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateItem = (index: number, field: keyof OrderItem, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const fabricTotal = items.reduce((sum, item) => {
    const qty = parseFloat(item.fabricQuantity) || 0
    const price = parseFloat(item.fabricUnitPrice) || 0
    return sum + qty * price
  }, 0)

  const stitching = parseFloat(stitchingCharge) || 0
  const extra = parseFloat(extraCharge) || 0
  const disc = parseFloat(discount) || 0
  const liveTotal = Math.max(0, fabricTotal + stitching + extra - disc)

  const handleSubmit = async () => {
    // Validate
    if (!confirmedCustomer && !customerNotFound) {
      Alert.alert("Validation", "Search and confirm a customer first")
      return
    }
    if (customerNotFound && !newName.trim()) {
      Alert.alert("Validation", "Enter customer name")
      return
    }
    if (items.length === 0) {
      Alert.alert("Validation", "Add at least one item")
      return
    }
    for (const item of items) {
      if (!item.productType) {
        Alert.alert("Validation", "Select product type for all items")
        return
      }
    }

    setSubmitting(true)
    try {
      const customer = confirmedCustomer

      const payload: Record<string, any> = {
        customer_name: customer ? customer.name : newName.trim(),
        customer_phone: customer ? customer.phone : phone.trim(),
        customer_address: customer ? customer.address || undefined : newAddress.trim() || undefined,
        order_date: orderDate,
        delivery_date: deliveryDate || undefined,
        stitching_charge: stitching,
        extra_charge: extra,
        discount: disc,
        notes: notes.trim() || undefined,
        advance_payment: parseFloat(advancePayment) || 0,
        advance_payment_method: advanceMethod,
        items: items.map((item) => ({
          product_type: item.productType,
          fabric_quantity: parseFloat(item.fabricQuantity) || 0,
          fabric_unit_price: parseFloat(item.fabricUnitPrice) || 0,
        })),
      }

      await createTailorOrder(payload)
      Alert.alert("Success", "Order created successfully", [
        { text: "OK", onPress: () => router.replace("/tailor") },
      ])
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Failed to create order")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle}>New Order</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* ── Section 1: Customer ── */}
        <View style={s.card}>
          <SectionHeader title="Customer" />

          <FieldLabel label="Phone" />
          <View style={s.phoneRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              placeholder="e.g. 01712345678"
              placeholderTextColor={colors.muted}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={(v) => {
                setPhone(v)
                setFoundCustomer(null)
                setConfirmedCustomer(null)
                setCustomerNotFound(false)
              }}
            />
            <TouchableOpacity
              style={s.searchBtn}
              onPress={() => void handleSearchCustomer()}
              disabled={searchingCustomer}
              activeOpacity={0.8}
            >
              {searchingCustomer ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.searchBtnText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {foundCustomer && !confirmedCustomer && (
            <View style={s.foundBox}>
              <View style={{ flex: 1 }}>
                <Text style={s.foundName}>{foundCustomer.name}</Text>
                <Text style={s.foundPhone}>{foundCustomer.phone}</Text>
              </View>
              <TouchableOpacity style={s.confirmBtn} onPress={handleConfirmCustomer} activeOpacity={0.8}>
                <Text style={s.confirmBtnText}>Use This</Text>
              </TouchableOpacity>
            </View>
          )}

          {confirmedCustomer && (
            <View style={[s.foundBox, { borderColor: "#7c3aed" }]}>
              <Ionicons name="checkmark-circle" size={18} color="#7c3aed" />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={[s.foundName, { color: "#7c3aed" }]}>{confirmedCustomer.name}</Text>
                <Text style={s.foundPhone}>{confirmedCustomer.phone}</Text>
              </View>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  setConfirmedCustomer(null)
                  setFoundCustomer(null)
                  setCustomerNotFound(false)
                  setPhone("")
                }}
              >
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </TouchableOpacity>
            </View>
          )}

          {customerNotFound && !confirmedCustomer && (
            <>
              <Text style={s.notFoundText}>No customer found. Enter details below:</Text>
              <FieldLabel label="Name *" />
              <TextInput
                style={s.input}
                placeholder="Full name"
                placeholderTextColor={colors.muted}
                value={newName}
                onChangeText={setNewName}
              />
              <FieldLabel label="Address" />
              <TextInput
                style={s.input}
                placeholder="Address (optional)"
                placeholderTextColor={colors.muted}
                value={newAddress}
                onChangeText={setNewAddress}
              />
            </>
          )}
        </View>

        {/* ── Section 2: Items ── */}
        <View style={s.card}>
          <View style={s.sectionRow}>
            <SectionHeader title="Items" />
            <TouchableOpacity style={s.addItemBtn} onPress={addItem} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.addItemText}>Add</Text>
            </TouchableOpacity>
          </View>

          {items.map((item, index) => (
            <View key={index} style={s.itemCard}>
              <View style={s.itemCardHeader}>
                <Text style={s.itemIndex}>Item {index + 1}</Text>
                {items.length > 1 && (
                  <TouchableOpacity onPress={() => removeItem(index)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  </TouchableOpacity>
                )}
              </View>

              <FieldLabel label="Product Type" />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.typeChipRow}
              >
                {PRODUCT_TYPES.map((pt) => (
                  <TouchableOpacity
                    key={pt}
                    style={[s.typeChip, item.productType === pt && s.typeChipActive]}
                    onPress={() => updateItem(index, "productType", pt)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.typeChipText, item.productType === pt && s.typeChipTextActive]}>
                      {pt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <FieldLabel label="Fabric Name" />
              <TextInput
                style={s.input}
                placeholder="e.g. Cotton White"
                placeholderTextColor={colors.muted}
                value={item.fabricName}
                onChangeText={(v) => updateItem(index, "fabricName", v)}
              />

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Quantity" />
                  <TextInput
                    style={s.input}
                    placeholder="1"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={item.fabricQuantity}
                    onChangeText={(v) => updateItem(index, "fabricQuantity", v)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Unit Price" />
                  <TextInput
                    style={s.input}
                    placeholder="0.00"
                    placeholderTextColor={colors.muted}
                    keyboardType="decimal-pad"
                    value={item.fabricUnitPrice}
                    onChangeText={(v) => updateItem(index, "fabricUnitPrice", v)}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── Section 3: Charges ── */}
        <View style={s.card}>
          <SectionHeader title="Charges & Dates" />

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Order Date" />
              <TextInput
                style={s.input}
                value={orderDate}
                onChangeText={setOrderDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Delivery Date" />
              <TextInput
                style={s.input}
                value={deliveryDate}
                onChangeText={setDeliveryDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Stitching" />
              <TextInput
                style={s.input}
                value={stitchingCharge}
                onChangeText={setStitchingCharge}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <FieldLabel label="Extra Charge" />
              <TextInput
                style={s.input}
                value={extraCharge}
                onChangeText={setExtraCharge}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <FieldLabel label="Discount" />
          <TextInput
            style={s.input}
            value={discount}
            onChangeText={setDiscount}
            keyboardType="decimal-pad"
            placeholderTextColor={colors.muted}
          />

          {/* Live total */}
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Estimated Total</Text>
            <Text style={s.totalValue}>{formatCurrency(liveTotal)}</Text>
          </View>
        </View>

        {/* ── Section 4: Advance Payment ── */}
        <View style={s.card}>
          <SectionHeader title="Advance Payment" />

          <FieldLabel label="Amount" />
          <TextInput
            style={s.input}
            value={advancePayment}
            onChangeText={setAdvancePayment}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={colors.muted}
          />

          <FieldLabel label="Method" />
          <View style={s.methodRow}>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.methodChip, advanceMethod === m && s.methodChipActive]}
                onPress={() => setAdvanceMethod(m)}
                activeOpacity={0.75}
              >
                <Text style={[s.methodChipText, advanceMethod === m && s.methodChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notes */}
        <View style={s.card}>
          <SectionHeader title="Notes" />
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

        {/* Submit */}
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
              <Text style={s.submitBtnText}>Create Order</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
    </KeyboardAvoidingView>
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
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  sectionHeader: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 2 },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
  phoneRow: { flexDirection: "row", gap: 8 },
  searchBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 72,
  },
  searchBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  foundBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  foundName: { fontSize: 14, fontWeight: "700", color: colors.text },
  foundPhone: { fontSize: 12, color: colors.muted, marginTop: 2 },
  confirmBtn: {
    backgroundColor: "#7c3aed",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  notFoundText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    padding: 12,
    gap: 8,
    marginTop: 4,
  },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemIndex: { fontSize: 13, fontWeight: "700", color: colors.text },
  typeChipRow: { gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  typeChipText: { fontSize: 12, fontWeight: "600", color: colors.muted },
  typeChipTextActive: { color: "#fff" },
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
  methodRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  methodChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  methodChipActive: { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
  methodChipText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  methodChipTextActive: { color: "#fff" },
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
