import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
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
import * as Print from "expo-print"
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import {
  getTailorOrder,
  updateTailorOrderStatus,
  createTailorPayment,
  getMeasurementsByCustomer,
  getTailorDorjis,
  createTailorAssignment,
} from "@/services/tailor"
import type {
  TailorOrder,
  TailorOrderStatus,
  TailorMeasurement,
  TailorDorji,
} from "@/types/tailor"
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  PAYMENT_STATUS_COLORS,
  WORK_STATUS_LABELS,
} from "@/types/tailor"
import { TailorStatusBadge } from "@/components/tailor/TailorStatusBadge"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const ALL_STATUSES: TailorOrderStatus[] = [
  "pending", "measurement_taken", "assigned", "cutting", "stitching", "ready", "delivered", "cancelled",
]
const PAYMENT_METHODS = ["Cash", "Card", "Bank Transfer", "Mobile Banking"]

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueStyle]}>{value}</Text>
    </View>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

export default function TailorOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { canRead, canWrite } = useAuth()
  const { formatCurrency } = useCurrency()

  const [order, setOrder] = useState<TailorOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [itemsExpanded, setItemsExpanded] = useState(false)
  const [payModalVisible, setPayModalVisible] = useState(false)
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [paySubmitting, setPaySubmitting] = useState(false)

  // Measurements
  const [measurements, setMeasurements] = useState<TailorMeasurement[]>([])
  const [measurementsExpanded, setMeasurementsExpanded] = useState(false)

  // Assign dorji
  const [dorjis, setDorjis] = useState<TailorDorji[]>([])
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [assignDorjiId, setAssignDorjiId] = useState<number | null>(null)
  const [assignDate, setAssignDate] = useState(new Date().toISOString().slice(0, 10))
  const [assignCharge, setAssignCharge] = useState("")
  const [assignSubmitting, setAssignSubmitting] = useState(false)
  const [dorjiPickerVisible, setDorjiPickerVisible] = useState(false)

  const orderId = Number(id)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTailorOrder(orderId)
      setOrder(data)
      if (data.customerId) {
        getMeasurementsByCustomer(data.customerId)
          .then(setMeasurements)
          .catch(() => {})
      }
    } catch {
      Alert.alert("Error", "Failed to load order")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
    getTailorDorjis({ status: "active" }).then(setDorjis).catch(() => {})
  }, [load])

  if (!canRead("TailorOrders")) return <AccessDenied />

  if (loading || !order) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.topBarTitle}>Order Detail</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
        </View>
      </SafeAreaView>
    )
  }

  const isOverdue =
    order.deliveryDate &&
    order.orderStatus !== "delivered" &&
    order.orderStatus !== "cancelled" &&
    new Date(order.deliveryDate) < new Date()

  const handleStatusUpdate = async (newStatus: TailorOrderStatus) => {
    if (newStatus === order.orderStatus) return
    try {
      setStatusLoading(true)
      const updated = await updateTailorOrderStatus(orderId, newStatus)
      setOrder(updated)
    } catch {
      Alert.alert("Error", "Failed to update status")
    } finally {
      setStatusLoading(false)
    }
  }

  const handleRecordPayment = async () => {
    const amt = parseFloat(payAmount)
    if (!amt || amt <= 0) {
      Alert.alert("Invalid amount")
      return
    }
    try {
      setPaySubmitting(true)
      await createTailorPayment({
        orderId,
        amount: amt,
        paymentMethod: payMethod,
        paymentDate: payDate,
      })
      setPayModalVisible(false)
      setPayAmount("")
      setPayDate(new Date().toISOString().slice(0, 10))
      await load()
    } catch {
      Alert.alert("Error", "Failed to record payment")
    } finally {
      setPaySubmitting(false)
    }
  }

  const handleAssign = async () => {
    if (!assignDorjiId) { Alert.alert("Select a dorji"); return }
    if (!assignDate) { Alert.alert("Enter assigned date"); return }
    setAssignSubmitting(true)
    try {
      await createTailorAssignment({
        orderId,
        dorjiId: assignDorjiId,
        assignedDate: assignDate,
        dorjiCharge: parseFloat(assignCharge) || 0,
        workStatus: "assigned",
      })
      setAssignModalVisible(false)
      setAssignDorjiId(null)
      setAssignCharge("")
      await load()
    } catch {
      Alert.alert("Error", "Failed to assign dorji")
    } finally {
      setAssignSubmitting(false)
    }
  }

  const handlePrintInvoice = async () => {
    const fabricTotal = (order.items ?? []).reduce((s, i) => s + (i.fabricQuantity ?? 0) * (i.fabricUnitPrice ?? 0), 0)
    const itemsHtml = (order.items ?? []).map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${(item.productType ?? "").replace(/_/g, " ")}</td>
        <td>${item.fabric?.name ?? "—"}</td>
        <td style="text-align:center">${item.fabricQuantity} ${item.fabric?.unit ?? ""}</td>
        <td style="text-align:right">${formatCurrency(item.fabricUnitPrice ?? 0)}</td>
        <td style="text-align:right;font-weight:600">${formatCurrency((item.fabricQuantity ?? 0) * (item.fabricUnitPrice ?? 0))}</td>
      </tr>`).join("")
    const trackingUrl = order.trackingToken
      ? `https://yourdomain.com/track/tailor/${order.trackingToken}`
      : null
    const qrSection = trackingUrl ? `
      <div style="display:flex;flex-direction:column;align-items:center;margin-top:32px;padding:20px;border:1px dashed #d8b4fe;border-radius:12px;background:#faf5ff;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(trackingUrl)}" width="120" height="120" />
        <p style="margin-top:10px;font-size:12px;font-weight:700;color:#7c3aed;">Scan to track your order</p>
        <p style="font-size:10px;color:#9ca3af;">${trackingUrl}</p>
      </div>` : ""
    const html = `
      <html><head><style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:Arial,sans-serif; padding:32px; color:#374151; }
        .header { display:flex; justify-content:space-between; border-bottom:2px solid #7c3aed; padding-bottom:20px; margin-bottom:24px; }
        .title { font-size:28px; font-weight:900; color:#111; }
        .num { font-size:13px; color:#6b7280; margin-top:4px; }
        .cname { font-size:18px; font-weight:800; color:#7c3aed; text-align:right; }
        .meta { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:24px; }
        .mbox { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px; }
        .mbox h3 { font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; margin-bottom:6px; }
        .mbox p { font-size:13px; font-weight:700; }
        table { width:100%; border-collapse:collapse; margin-bottom:16px; }
        thead { background:#7c3aed; }
        th { padding:10px 12px; text-align:left; font-size:11px; font-weight:600; text-transform:uppercase; color:#fff; }
        td { padding:10px 12px; border-bottom:1px solid #f3f4f6; font-size:13px; }
        .totals { margin-left:auto; width:260px; }
        .trow { display:flex; justify-content:space-between; font-size:13px; padding:3px 0; }
        .grand { font-size:15px; font-weight:800; border-top:2px solid #7c3aed; margin-top:6px; padding-top:8px; }
        .footer { margin-top:32px; border-top:1px solid #e5e7eb; padding-top:12px; text-align:center; font-size:11px; color:#9ca3af; }
      </style></head><body>
        <div class="header">
          <div><div class="title">INVOICE</div><div class="num">${order.orderNumber}</div></div>
          <div><div class="cname">Tailor Shop</div></div>
        </div>
        <div class="meta">
          <div class="mbox"><h3>Customer</h3><p>${order.customer?.name ?? "—"}</p><p style="font-weight:400;font-size:12px">${order.customer?.phone ?? ""}</p></div>
          <div class="mbox"><h3>Order Date</h3><p>${order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "—"}</p></div>
          <div class="mbox"><h3>Delivery Date</h3><p>${order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "—"}</p></div>
        </div>
        <table>
          <thead><tr><th>#</th><th>Type</th><th>Fabric</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amount</th></tr></thead>
          <tbody>${itemsHtml || '<tr><td colspan="6" style="text-align:center;color:#9ca3af">No items</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div class="trow"><span>Fabric Total</span><span>${formatCurrency(fabricTotal)}</span></div>
          <div class="trow"><span>Stitching</span><span>+ ${formatCurrency(order.stitchingCharge ?? 0)}</span></div>
          ${(order.extraCharge ?? 0) > 0 ? `<div class="trow"><span>Extra</span><span>+ ${formatCurrency(order.extraCharge ?? 0)}</span></div>` : ""}
          ${(order.discount ?? 0) > 0 ? `<div class="trow"><span>Discount</span><span>− ${formatCurrency(order.discount ?? 0)}</span></div>` : ""}
          <div class="trow grand"><span>Grand Total</span><span>${formatCurrency(order.totalAmount ?? 0)}</span></div>
          <div class="trow" style="color:#16a34a"><span>Paid</span><span>${formatCurrency(order.paidAmount ?? 0)}</span></div>
          ${(order.dueAmount ?? 0) > 0 ? `<div class="trow" style="color:#dc2626;font-weight:700"><span>Due</span><span>${formatCurrency(order.dueAmount ?? 0)}</span></div>` : ""}
        </div>
        ${qrSection}
        <div class="footer">Thank you for your business</div>
      </body></html>`
    try {
      await Print.printAsync({ html })
    } catch {
      Alert.alert("Print failed", "Could not open print dialog")
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.topBarTitle} numberOfLines={1}>{order.orderNumber}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <TailorStatusBadge
            label={ORDER_STATUS_LABELS[order.orderStatus]}
            color={ORDER_STATUS_COLORS[order.orderStatus]}
            small
          />
          <TouchableOpacity style={s.printBtn} onPress={() => void handlePrintInvoice()} hitSlop={8}>
            <Ionicons name="print-outline" size={16} color="#7c3aed" />
          </TouchableOpacity>
          {canWrite("TailorOrders") && (
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => router.push(`/tailor/edit/${order.id}` as any)}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={18} color="#7c3aed" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        {/* Customer card */}
        <SectionCard title="Customer">
          <InfoRow label="Name" value={order.customer?.name ?? "-"} />
          <InfoRow label="Phone" value={order.customer?.phone ?? "-"} />
          <InfoRow label="Address" value={order.customer?.address ?? "-"} />
        </SectionCard>

        {/* Summary card */}
        <SectionCard title="Summary">
          <InfoRow label="Order Date" value={order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "-"} />
          <InfoRow
            label="Delivery Date"
            value={order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString() : "Not set"}
            valueStyle={isOverdue ? s.overdueText : undefined}
          />
          <InfoRow label="Stitching" value={formatCurrency(order.stitchingCharge)} />
          <InfoRow label="Extra Charge" value={formatCurrency(order.extraCharge)} />
          <InfoRow label="Discount" value={formatCurrency(order.discount)} />
          <View style={s.divider} />
          <InfoRow label="Total" value={formatCurrency(order.totalAmount)} valueStyle={s.totalText} />
          <InfoRow label="Paid" value={formatCurrency(order.paidAmount)} valueStyle={s.paidText} />
          <InfoRow
            label="Due"
            value={formatCurrency(order.dueAmount)}
            valueStyle={order.dueAmount > 0 ? s.dueText : s.paidText}
          />
          <View style={{ alignSelf: "flex-end", marginTop: 4 }}>
            <TailorStatusBadge
              label={order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
              color={PAYMENT_STATUS_COLORS[order.paymentStatus]}
              small
            />
          </View>
        </SectionCard>

        {/* Items collapsible */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.collapsibleHeader}
            onPress={() => setItemsExpanded((v) => !v)}
            activeOpacity={0.75}
          >
            <Text style={s.cardTitle}>Items ({order.items?.length ?? 0})</Text>
            <Ionicons
              name={itemsExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.muted}
            />
          </TouchableOpacity>
          {itemsExpanded && (
            <>
              {(order.items ?? []).length === 0 ? (
                <Text style={s.mutedText}>No items</Text>
              ) : (
                order.items!.map((item) => (
                  <View key={item.id} style={s.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.itemType}>{item.productType}</Text>
                      <Text style={s.itemFabric}>
                        {item.fabric?.name ?? "No fabric"} · Qty {item.fabricQuantity}
                      </Text>
                    </View>
                    <Text style={s.itemPrice}>{formatCurrency(item.fabricUnitPrice * item.fabricQuantity)}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>

        {/* Status update */}
        {canWrite("TailorOrders") && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Update Status</Text>
            {statusLoading && <ActivityIndicator color="#7c3aed" style={{ marginBottom: 8 }} />}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusRow}>
              {ALL_STATUSES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[
                    s.statusBtn,
                    order.orderStatus === st && { backgroundColor: "#7c3aed", borderColor: "#7c3aed" },
                  ]}
                  onPress={() => void handleStatusUpdate(st)}
                  disabled={statusLoading}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[s.statusBtnText, order.orderStatus === st && { color: "#fff" }]}
                  >
                    {ORDER_STATUS_LABELS[st]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Customer Measurements */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.collapsibleHeader}
            onPress={() => setMeasurementsExpanded(v => !v)}
            activeOpacity={0.75}
          >
            <Text style={s.cardTitle}>Measurements ({measurements.length})</Text>
            <Ionicons name={measurementsExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          </TouchableOpacity>
          {measurementsExpanded && (
            measurements.length === 0 ? (
              <Text style={s.mutedText}>No measurements for this customer</Text>
            ) : measurements.map(m => (
              <View key={m.id} style={s.measurementCard}>
                <View style={s.measurementHeader}>
                  <Text style={s.measurementType}>{m.productType?.replace(/_/g, " ")}</Text>
                  <Text style={s.measurementDate}>{new Date(m.measuredAt).toLocaleDateString()}</Text>
                </View>
                <View style={s.measurementFields}>
                  {m.chest ? <Text style={s.mField}>Chest: {m.chest}</Text> : null}
                  {m.waist ? <Text style={s.mField}>Waist: {m.waist}</Text> : null}
                  {m.hip ? <Text style={s.mField}>Hip: {m.hip}</Text> : null}
                  {m.shoulder ? <Text style={s.mField}>Shoulder: {m.shoulder}</Text> : null}
                  {m.sleeve ? <Text style={s.mField}>Sleeve: {m.sleeve}</Text> : null}
                  {m.length ? <Text style={s.mField}>Length: {m.length}</Text> : null}
                  {m.neck ? <Text style={s.mField}>Neck: {m.neck}</Text> : null}
                  {m.inseam ? <Text style={s.mField}>Inseam: {m.inseam}</Text> : null}
                  {m.bottomLength ? <Text style={s.mField}>Bottom L: {m.bottomLength}</Text> : null}
                  {m.pajamaWaist ? <Text style={s.mField}>Paj.Waist: {m.pajamaWaist}</Text> : null}
                  {m.pajamaLength ? <Text style={s.mField}>Paj.Length: {m.pajamaLength}</Text> : null}
                </View>
                {m.notes ? <Text style={s.mNotes}>{m.notes}</Text> : null}
              </View>
            ))
          )}
        </View>

        {/* Assignments */}
        <View style={s.card}>
          <View style={s.collapsibleHeader}>
            <Text style={s.cardTitle}>Assignments</Text>
            {canWrite("TailorOrders") && (
              <TouchableOpacity
                style={s.recordPayBtn}
                onPress={() => setAssignModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={s.recordPayText}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
          {(order.assignments ?? []).length === 0 ? (
            <Text style={s.mutedText}>No assignments</Text>
          ) : (
            order.assignments!.map((a) => (
              <View key={a.id} style={s.assignmentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.assignmentName}>{a.dorji?.name ?? `Dorji #${a.dorjiId}`}</Text>
                  <TailorStatusBadge
                    label={WORK_STATUS_LABELS[a.workStatus]}
                    color="#8b5cf6"
                    small
                  />
                </View>
                <Text style={s.assignmentCharge}>{formatCurrency(a.dorjiCharge)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Payments */}
        <View style={s.card}>
          <View style={s.collapsibleHeader}>
            <Text style={s.cardTitle}>Payments</Text>
            {canWrite("TailorOrders") && (
              <TouchableOpacity
                style={s.recordPayBtn}
                onPress={() => setPayModalVisible(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={14} color="#fff" />
                <Text style={s.recordPayText}>Record</Text>
              </TouchableOpacity>
            )}
          </View>
          {(order.payments ?? []).length === 0 ? (
            <Text style={s.mutedText}>No payments recorded</Text>
          ) : (
            order.payments!.map((p) => (
              <View key={p.id} style={s.paymentRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.paymentMethod}>{p.paymentMethod}</Text>
                  <Text style={s.paymentDate}>{new Date(p.paymentDate).toLocaleDateString()}</Text>
                </View>
                <Text style={s.paymentAmount}>{formatCurrency(p.amount)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Status Log */}
        <SectionCard title="Status Log">
          {(order.statusLogs ?? []).length === 0 ? (
            <Text style={s.mutedText}>No log entries</Text>
          ) : (
            order.statusLogs!.map((log, i) => (
              <View key={log.id} style={s.logRow}>
                <View style={s.logDotCol}>
                  <View style={[s.logDot, i === 0 && s.logDotActive]} />
                  {i < order.statusLogs!.length - 1 && <View style={s.logLine} />}
                </View>
                <View style={s.logContent}>
                  <Text style={s.logStatus}>
                    {log.fromStatus ? `${log.fromStatus} → ` : ""}{log.toStatus}
                  </Text>
                  {log.note ? <Text style={s.logNote}>{log.note}</Text> : null}
                  <Text style={s.logDate}>{new Date(log.createdAt).toLocaleString()}</Text>
                </View>
              </View>
            ))
          )}
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Payment Modal */}
      <Modal
        visible={payModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayModalVisible(false)}
      >
        <Pressable style={s.modalOverlay} onPress={() => setPayModalVisible(false)} />
        <View style={s.bottomSheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Record Payment</Text>

          <Text style={s.inputLabel}>Amount</Text>
          <TextInput
            style={s.input}
            placeholder="0.00"
            placeholderTextColor={colors.muted}
            keyboardType="decimal-pad"
            value={payAmount}
            onChangeText={setPayAmount}
          />

          <Text style={s.inputLabel}>Payment Method</Text>
          <View style={s.methodRow}>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.methodChip, payMethod === m && s.methodChipActive]}
                onPress={() => setPayMethod(m)}
                activeOpacity={0.75}
              >
                <Text style={[s.methodChipText, payMethod === m && s.methodChipTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={s.inputLabel}>Date (YYYY-MM-DD)</Text>
          <TextInput
            style={s.input}
            value={payDate}
            onChangeText={setPayDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
          />

          <TouchableOpacity
            style={[s.submitBtn, paySubmitting && s.submitBtnDisabled]}
            onPress={() => void handleRecordPayment()}
            disabled={paySubmitting}
            activeOpacity={0.85}
          >
            {paySubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.submitBtnText}>Submit Payment</Text>
            )}
          </TouchableOpacity>
        </View>
      </Modal>
      {/* Assign Dorji Modal */}
      <Modal visible={assignModalVisible} transparent animationType="slide" onRequestClose={() => setAssignModalVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setAssignModalVisible(false)} />
        <View style={s.bottomSheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Assign Dorji</Text>

          <Text style={s.inputLabel}>Dorji *</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setDorjiPickerVisible(true)} activeOpacity={0.8}>
            <Text style={assignDorjiId ? s.pickerText : s.pickerPlaceholder}>
              {dorjis.find(d => d.id === assignDorjiId)?.name ?? "Select a dorji..."}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </TouchableOpacity>

          <Text style={s.inputLabel}>Assigned Date</Text>
          <TextInput style={s.input} value={assignDate} onChangeText={setAssignDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />

          <Text style={s.inputLabel}>Dorji Charge</Text>
          <TextInput
            style={s.input} placeholder="0.00" placeholderTextColor={colors.muted}
            keyboardType="decimal-pad" value={assignCharge} onChangeText={setAssignCharge}
          />

          <TouchableOpacity
            style={[s.submitBtn, assignSubmitting && s.submitBtnDisabled]}
            onPress={handleAssign} disabled={assignSubmitting} activeOpacity={0.85}
          >
            {assignSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Assign Dorji</Text>}
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Dorji Picker Modal */}
      <Modal visible={dorjiPickerVisible} transparent animationType="fade" onRequestClose={() => setDorjiPickerVisible(false)}>
        <Pressable style={s.modalOverlay} onPress={() => setDorjiPickerVisible(false)} />
        <View style={[s.bottomSheet, { maxHeight: "60%" }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Select Dorji</Text>
          {dorjis.map(d => (
            <TouchableOpacity
              key={d.id}
              style={s.dorjiPickerItem}
              onPress={() => { setAssignDorjiId(d.id); setDorjiPickerVisible(false) }}
              activeOpacity={0.75}
            >
              <Text style={s.dorjiPickerName}>{d.name}</Text>
              <Text style={s.dorjiPickerMeta}>{d.phone}{d.activeOrders != null ? ` · ${d.activeOrders} active` : ""}</Text>
            </TouchableOpacity>
          ))}
          {dorjis.length === 0 && <Text style={s.mutedText}>No active dorjis found</Text>}
        </View>
      </Modal>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: 13, color: colors.muted, flex: 1 },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1, textAlign: "right" },
  overdueText: { color: "#ef4444", fontWeight: "700" },
  totalText: { fontSize: 16, fontWeight: "800", color: colors.text },
  paidText: { color: "#16a34a", fontWeight: "700" },
  dueText: { color: "#ef4444", fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  collapsibleHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  itemType: { fontSize: 14, fontWeight: "700", color: colors.text },
  itemFabric: { fontSize: 12, color: colors.muted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  statusRow: { gap: 8, paddingVertical: 4 },
  statusBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  statusBtnText: { fontSize: 12, fontWeight: "600", color: colors.text },
  assignmentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  assignmentName: { fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 4 },
  assignmentCharge: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  recordPayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7c3aed",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recordPayText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paymentMethod: { fontSize: 14, fontWeight: "600", color: colors.text },
  paymentDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
  paymentAmount: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  logRow: { flexDirection: "row", gap: 10 },
  logDotCol: { alignItems: "center", width: 16, paddingTop: 4 },
  logDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.muted,
  },
  logDotActive: { backgroundColor: "#7c3aed" },
  logLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  logContent: { flex: 1, paddingBottom: 16 },
  logStatus: { fontSize: 13, fontWeight: "700", color: colors.text },
  logNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
  logDate: { fontSize: 11, color: colors.muted, marginTop: 4 },
  mutedText: { fontSize: 13, color: colors.muted },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  bottomSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
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
    backgroundColor: "#7c3aed",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 6,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  editBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  printBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  measurementCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    padding: 10, backgroundColor: colors.background, gap: 6,
  },
  measurementHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  measurementType: { fontSize: 13, fontWeight: "700", color: colors.text, textTransform: "capitalize" },
  measurementDate: { fontSize: 11, color: colors.muted },
  measurementFields: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  mField: { fontSize: 11, color: colors.text, backgroundColor: "#f3f4f6", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  mNotes: { fontSize: 11, color: colors.muted, fontStyle: "italic" },
  pickerBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.background, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 12,
  },
  pickerText: { fontSize: 13, color: colors.text, flex: 1 },
  pickerPlaceholder: { fontSize: 13, color: colors.muted, flex: 1 },
  dorjiPickerItem: {
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dorjiPickerName: { fontSize: 14, fontWeight: "700", color: colors.text },
  dorjiPickerMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
