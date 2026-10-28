import React, { useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { useAuth } from "@/context/AuthContext"
import { useCurrency } from "@/context/CurrencyContext"
import {
  assignTailorWork,
  getTailorAssignmentOptions,
  getTailorOrderDetail,
  recordTailorOrderPayment,
  tailorApiError,
  transitionTailorOrder,
} from "@/services/tailor"
import type { TailorAssignmentDorjiOption, TailorOrderDetail, TailorStage } from "@/types/tailor"
import {
  PAYMENT_STATUS_COLORS,
  TAILOR_PAY_METHODS,
  TAILOR_STAGES,
  TAILOR_STAGE_COLORS,
  TAILOR_STAGE_LABEL,
  WORK_STATUS_LABELS,
  tailorMethodLabel,
  tailorPayLabel,
} from "@/types/tailor"
import { TailorStatusBadge } from "@/components/tailor/TailorStatusBadge"
import {
  ago, askPrintOrShare, fmtDate, invoiceHtml, isIsoDate, jobCardHtml, measurementText, stageName, todayIso, whenText,
} from "@/components/tailor/tailorHelpers"
import { AccessDenied } from "@/components/AccessDenied"
import { colors } from "@/constants/theme"

const WORK_COLORS: Record<string, string> = {
  assigned: "#8b5cf6", in_progress: "#f59e0b", completed: "#22c55e", returned: "#ef4444", paid: "#0d9488",
}

function InfoRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: object }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, valueStyle]}>{value}</Text>
    </View>
  )
}

function SectionCard({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <Text style={s.cardTitle}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  )
}

function Chip({ label, active, onPress, color = "#7c3aed" }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <TouchableOpacity
      style={[s.chip, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

export default function TailorOrderDetailScreen() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>()
  const { canRead, canWrite, company, session } = useAuth()
  const { formatCurrency } = useCurrency()
  const fc = (n: number) => formatCurrency(n)
  const writable = canWrite("TailorOrders")
  const businessName = company?.name ?? session?.companyName ?? ""

  const [d, setD] = useState<TailorOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")

  // status
  const [sel, setSel] = useState<TailorStage>("new")
  const [sNote, setSNote] = useState("")
  const [sErr, setSErr] = useState("")
  const [moving, setMoving] = useState(false)

  // cancel
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelErr, setCancelErr] = useState("")

  // payment
  const [payOpen, setPayOpen] = useState(false)
  const [amt, setAmt] = useState("")
  const [method, setMethod] = useState("cash")
  const [payDate, setPayDate] = useState(todayIso())
  const [ref, setRef] = useState("")
  const [payNotes, setPayNotes] = useState("")
  const [payErr, setPayErr] = useState("")
  const [paying, setPaying] = useState(false)

  // assign
  const [assignOpen, setAssignOpen] = useState(false)
  const [dorjiOpts, setDorjiOpts] = useState<TailorAssignmentDorjiOption[]>([])
  const [aDorji, setADorji] = useState<number | null>(null)
  const [aLine, setALine] = useState<number | null>(null)
  const [aTask, setATask] = useState("")
  const [aPieces, setAPieces] = useState("1")
  const [aRate, setARate] = useState("")
  const [aBack, setABack] = useState("")
  const [aErr, setAErr] = useState("")
  const [assigning, setAssigning] = useState(false)

  const orderId = Number(id)

  const load = useCallback(async () => {
    try {
      setLoadErr("")
      const o = await getTailorOrderDetail(orderId)
      setD(o)
      setSel(o.stage)
      setAmt(o.dueAmount > 0 ? String(o.dueAmount) : "")
      return o
    } catch (e) {
      setLoadErr(tailorApiError(e, "Failed to load order"))
      return null
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load().then((o) => { if (o && pay === "1" && o.dueAmount > 0 && o.stage !== "cancelled") setPayOpen(true) })
  }, [load, pay])

  if (!canRead("TailorOrders")) return <AccessDenied />

  const topBar = (
    <View style={s.topBar}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </TouchableOpacity>
      <Text style={s.topBarTitle} numberOfLines={1}>{d?.orderNumber ?? "Order Detail"}</Text>
      {d ? (
        <View style={s.topActions}>
          <TouchableOpacity
            style={s.iconBtn}
            hitSlop={6}
            onPress={() => askPrintOrShare(`Invoice ${d.orderNumber}`, () => invoiceHtml(d, businessName, fc))}
          >
            <Ionicons name="receipt-outline" size={16} color="#7c3aed" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.iconBtn}
            hitSlop={6}
            onPress={() => askPrintOrShare(`Job card ${d.orderNumber}`, () => jobCardHtml(d))}
          >
            <Ionicons name="clipboard-outline" size={16} color="#7c3aed" />
          </TouchableOpacity>
          {writable && d.stage !== "delivered" && d.stage !== "cancelled" && (
            <TouchableOpacity style={s.iconBtn} hitSlop={6} onPress={() => router.push(`/tailor/edit/${d.id}` as any)}>
              <Ionicons name="create-outline" size={17} color="#7c3aed" />
            </TouchableOpacity>
          )}
        </View>
      ) : <View style={{ width: 40 }} />}
    </View>
  )

  if (loading || !d) {
    return (
      <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
        {topBar}
        <View style={s.center}>
          {loading ? <ActivityIndicator size="large" color="#7c3aed" /> : (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
              <Text style={s.errText}>{loadErr || "Order not found"}</Text>
              <TouchableOpacity style={s.smallBtn} onPress={() => { setLoading(true); void load() }}>
                <Text style={s.smallBtnText}>Retry</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    )
  }

  const open = d.stage !== "delivered" && d.stage !== "cancelled"
  const when = whenText(d.daysLeft, d.stage)
  const c = d.charges
  const stitch = c.stitching || c.stitchingOrderLevel
  const hasShopFabric = d.items.some((i) => i.fabricSource === "shop" && i.fabricQuantity > 0)

  // ── actions ──────────────────────────────────────────────────────────────

  const applyStatus = async () => {
    if (sel === d.stage) { setSErr("Pick a different status."); return }
    setMoving(true); setSErr("")
    try {
      await transitionTailorOrder(d.id, sel, sNote.trim())
      setSNote("")
      await load()
      Alert.alert("Status updated", `${d.orderNumber} moved to ${TAILOR_STAGE_LABEL[sel].toLowerCase()}.`)
    } catch (e) {
      // e.g. 422 "Not enough Cotton: need 3, only 1.5 in stock"
      setSErr(tailorApiError(e, "Failed to update status"))
    } finally {
      setMoving(false)
    }
  }

  const cancelOrder = async () => {
    const reason = cancelReason.trim()
    if (!reason) { setCancelErr("Enter a reason for cancelling."); return }
    setMoving(true); setCancelErr("")
    try {
      await transitionTailorOrder(d.id, "cancelled", `Cancelled: ${reason}`)
      setCancelOpen(false); setCancelReason("")
      await load()
      Alert.alert("Order cancelled", `${d.orderNumber} was cancelled.`)
    } catch (e) {
      setCancelErr(tailorApiError(e, "Failed to cancel order"))
    } finally {
      setMoving(false)
    }
  }

  const recordPay = async () => {
    const a = Number(amt)
    if (!(a > 0)) { setPayErr("Enter an amount greater than 0."); return }
    if (a > d.dueAmount + 0.005) { setPayErr(`Amount is more than the balance (${fc(d.dueAmount)}).`); return }
    if (!isIsoDate(payDate)) { setPayErr("Enter the date as YYYY-MM-DD."); return }
    if (payDate > todayIso()) { setPayErr("Payment date cannot be in the future."); return }
    setPaying(true); setPayErr("")
    try {
      await recordTailorOrderPayment(d.id, { amount: a, paymentMethod: method, paymentDate: payDate, reference: ref.trim(), notes: payNotes.trim() })
      setPayOpen(false); setRef(""); setPayNotes("")
      await load()
      Alert.alert("Payment recorded", `${fc(a)} recorded for ${d.orderNumber}.`)
    } catch (e) {
      setPayErr(tailorApiError(e, "Failed to record payment"))
    } finally {
      setPaying(false)
    }
  }

  const openAssign = async () => {
    setAErr(""); setADorji(null); setARate("")
    const first = d.items[0]
    setALine(first ? first.id : null)
    setATask(first ? first.productType : "")
    setAPieces(String(first?.quantity ?? 1))
    setABack(d.deliveryDate ?? "")
    setAssignOpen(true)
    try {
      const o = await getTailorAssignmentOptions()
      setDorjiOpts(o.dorjis.filter((x) => x.status === "active"))
    } catch {
      setAErr("Could not load dorjis.")
    }
  }

  const pickLine = (itemId: number) => {
    const it = d.items.find((x) => x.id === itemId)
    setALine(itemId)
    if (it) { setATask(it.productType); setAPieces(String(it.quantity)) }
  }

  const pickDorji = (o: TailorAssignmentDorjiOption) => {
    setADorji(o.id)
    if (o.ratePerPiece) setARate(String(o.ratePerPiece))
  }

  const saveAssign = async () => {
    const dz = dorjiOpts.find((x) => x.id === aDorji)
    const pieces = Number(aPieces), rate = Number(aRate)
    if (!dz) { setAErr("Select a dorji."); return }
    if (!aTask.trim()) { setAErr("Describe the task."); return }
    if (!(pieces > 0) || !Number.isInteger(pieces)) { setAErr("Pieces must be a whole number above 0."); return }
    if (aRate === "" || !isFinite(rate) || rate < 0) { setAErr("Enter a valid rate per piece."); return }
    if (aBack && !isIsoDate(aBack)) { setAErr("Enter the back date as YYYY-MM-DD."); return }
    const today = todayIso()
    if (aBack && aBack < today) { setAErr("Expected back date cannot be before today."); return }
    const payload = {
      orderId: d.id, dorjiId: dz.id, task: aTask.trim(), pieces, ratePerPiece: rate,
      assignedDate: today, expectedCompletion: aBack || null,
    }
    const done = async () => {
      setAssignOpen(false)
      await load()
    }
    setAssigning(true); setAErr("")
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
              try { await assignTailorWork({ ...payload, force: true }); await done() } catch (er) { setAErr(tailorApiError(er, "Could not assign the work.")) }
            },
          },
        ])
      } else {
        setAErr(tailorApiError(e, "Could not assign the work."))
      }
    } finally {
      setAssigning(false)
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      {topBar}

      <ScrollView contentContainerStyle={s.content}>
        {/* Badges */}
        <View style={s.badgeRow}>
          <TailorStatusBadge label={TAILOR_STAGE_LABEL[d.stage]} color={TAILOR_STAGE_COLORS[d.stage]} />
          <TailorStatusBadge
            label={d.paymentStatus.charAt(0).toUpperCase() + d.paymentStatus.slice(1)}
            color={PAYMENT_STATUS_COLORS[d.paymentStatus] ?? "#94a3b8"}
          />
          {d.isUrgent && <TailorStatusBadge label="URGENT" color="#dc2626" />}
        </View>

        {/* Summary */}
        <SectionCard title="Summary">
          <InfoRow label="Customer" value={d.customer?.name ?? "—"} />
          {d.customer?.phone ? <InfoRow label="Phone" value={d.customer.phone} /> : null}
          {d.customer?.address ? <InfoRow label="Address" value={d.customer.address} /> : null}
          <InfoRow label="Order date" value={fmtDate(d.orderDate)} />
          <InfoRow label="Delivery" value={`${fmtDate(d.deliveryDate)}${open ? ` · ${when.text}` : ""}`} valueStyle={open ? { color: when.color } : undefined} />
          <InfoRow label="Dorji" value={d.dorjiNames.join(", ") || "Not assigned"} />
          <View style={s.divider} />
          <InfoRow label="Total" value={fc(c.total)} valueStyle={s.totalText} />
          <InfoRow label="Paid" value={fc(c.paid)} valueStyle={s.paidText} />
          <InfoRow label="Due" value={fc(c.due)} valueStyle={c.due > 0 ? s.dueText : s.paidText} />
        </SectionCard>

        {d.notes ? (
          <View style={s.noteBox}>
            <Ionicons name="document-text-outline" size={14} color="#7c3aed" />
            <Text style={s.noteText}>{d.notes}</Text>
          </View>
        ) : null}

        {/* Items */}
        <SectionCard title={`Items (${d.items.length})`}>
          {d.items.length === 0 ? <Text style={s.mutedText}>No items</Text> : d.items.map((it) => {
            const fabric = it.fabricSource === "shop" && it.fabric
              ? `${it.fabric.name} · ${it.fabricQuantity} ${it.fabric.unit}${it.fabricUnitPrice ? ` @ ${fc(it.fabricUnitPrice)}` : ""}`
              : `Customer fabric${it.ownFabricNote ? `: ${it.ownFabricNote}` : ""}`
            const sub = [fabric, measurementText(it.measurement) || "No measurement", ...it.styleOptions, it.notes].filter(Boolean).join(" — ")
            return (
              <View key={it.id} style={s.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lineTitle}>{it.productType} ×{it.quantity}</Text>
                  <Text style={s.lineSub}>{sub}</Text>
                </View>
                <Text style={s.lineAmt}>{fc(it.lineTotal)}</Text>
              </View>
            )
          })}
        </SectionCard>

        {/* Charges */}
        <SectionCard title="Charges">
          <InfoRow label="Stitching" value={fc(stitch)} />
          <InfoRow label="Fabric" value={fc(c.fabric)} />
          {c.urgent > 0 && <InfoRow label="Urgent charge" value={fc(c.urgent)} />}
          {c.extra > 0 && <InfoRow label="Extra charge" value={fc(c.extra)} />}
          {c.discount > 0 && <InfoRow label="Discount" value={`− ${fc(c.discount)}`} />}
          <View style={s.divider} />
          <InfoRow label="Grand total" value={fc(c.total)} valueStyle={s.totalText} />
        </SectionCard>

        {/* Dorji assignments */}
        <SectionCard
          title="Dorji assignments"
          right={writable && open ? (
            <TouchableOpacity style={s.smallBtn} onPress={() => void openAssign()} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.smallBtnText}>Assign</Text>
            </TouchableOpacity>
          ) : undefined}
        >
          {d.assignments.length === 0 ? (
            <Text style={s.mutedText}>No dorji assigned yet.</Text>
          ) : d.assignments.map((a) => (
            <View key={a.id} style={s.lineRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.lineTitle}>
                  {a.dorjiName ?? "Dorji"}{a.task ? ` · ${a.task} ×${a.pieces ?? 1}` : a.adminNotes ? ` · ${a.adminNotes}` : ""}
                </Text>
                <Text style={s.lineSub}>
                  {a.expectedCompletion ? `Back by ${fmtDate(a.expectedCompletion)} · ` : ""}Charge {fc(a.dorjiCharge)}
                </Text>
              </View>
              <TailorStatusBadge label={WORK_STATUS_LABELS[a.workStatus] ?? a.workStatus} color={WORK_COLORS[a.workStatus] ?? "#8b5cf6"} small />
            </View>
          ))}
        </SectionCard>

        {/* Customer payments */}
        <SectionCard
          title="Customer payments"
          right={writable && d.dueAmount > 0 && d.stage !== "cancelled" ? (
            <TouchableOpacity style={s.smallBtn} onPress={() => { setPayErr(""); setPayDate(todayIso()); setPayOpen(true) }} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={s.smallBtnText}>Record</Text>
            </TouchableOpacity>
          ) : undefined}
        >
          {d.payments.length === 0 ? (
            <Text style={s.mutedText}>No payments recorded.</Text>
          ) : d.payments.map((p) => {
            const label = tailorPayLabel(p)
            const extra = [p.reference, label !== "Payment" ? "" : p.notes].filter(Boolean).join(" · ")
            return (
              <View key={p.id} style={s.lineRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lineTitle}>{label} · {tailorMethodLabel(p.paymentMethod)}</Text>
                  <Text style={s.lineSub}>{fmtDate(p.paymentDate)}{extra ? ` · ${extra}` : ""}</Text>
                </View>
                <Text style={[s.lineAmt, { color: "#16a34a" }]}>{fc(p.amount)}</Text>
              </View>
            )
          })}
        </SectionCard>

        {/* Update status */}
        {writable && open && (
          <SectionCard title="Update status">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
              {TAILOR_STAGES.map((st) => (
                <Chip
                  key={st.id}
                  label={st.label}
                  active={sel === st.id}
                  color={TAILOR_STAGE_COLORS[st.id]}
                  onPress={() => { setSel(st.id); setSErr("") }}
                />
              ))}
            </ScrollView>
            <TextInput
              style={s.input}
              value={sNote}
              onChangeText={setSNote}
              placeholder="Note (optional), e.g. Trial done, collar to be fixed"
              placeholderTextColor={colors.muted}
            />
            {sel === "delivered" && d.dueAmount > 0 && (
              <Text style={s.hint}>Delivering collects the remaining {fc(d.dueAmount)} in cash and marks the order as paid.</Text>
            )}
            {sel !== "new" && !d.fabricDeducted && hasShopFabric && (
              <Text style={s.hint}>Shop fabric is taken out of stock when the order first moves past Received.</Text>
            )}
            {sErr ? <Text style={s.errText}>{sErr}</Text> : null}
            <View style={s.btnRow}>
              <TouchableOpacity
                style={[s.dangerOutlineBtn]}
                onPress={() => { setCancelErr(""); setCancelOpen(true) }}
                activeOpacity={0.8}
              >
                <Text style={s.dangerOutlineText}>Cancel order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.primaryBtn, moving && s.disabled]}
                onPress={() => void applyStatus()}
                disabled={moving}
                activeOpacity={0.85}
              >
                {moving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Apply status</Text>}
              </TouchableOpacity>
            </View>
          </SectionCard>
        )}

        {/* Timeline */}
        <SectionCard title="Status timeline">
          {d.statusLogs.length === 0 ? (
            <Text style={s.mutedText}>No status changes yet.</Text>
          ) : [...d.statusLogs].reverse().map((g, i, arr) => (
            <View key={g.id} style={s.logRow}>
              <View style={s.logDotCol}>
                <View style={[s.logDot, i === 0 && s.logDotActive]} />
                {i < arr.length - 1 && <View style={s.logLine} />}
              </View>
              <View style={s.logContent}>
                <Text style={s.logStatus}>
                  {g.fromStatus ? `${stageName(g.fromStatus)} → ${stageName(g.toStatus)}` : stageName(g.toStatus)}
                </Text>
                <Text style={s.logDate}>{fmtDate(g.createdAt)} · {ago(g.createdAt)}</Text>
                {g.note ? <Text style={s.logNote}>{g.note}</Text> : null}
              </View>
            </View>
          ))}
        </SectionCard>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Record payment */}
      <Modal visible={payOpen} transparent animationType="slide" onRequestClose={() => setPayOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={s.overlay} onPress={() => setPayOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Record payment · due {fc(d.dueAmount)}</Text>
            <Text style={s.inputLabel}>Amount</Text>
            <TextInput style={s.input} keyboardType="decimal-pad" value={amt} onChangeText={(v) => { setAmt(v); setPayErr("") }} placeholder="0.00" placeholderTextColor={colors.muted} />
            <Text style={s.inputLabel}>Method</Text>
            <View style={s.wrapRow}>
              {TAILOR_PAY_METHODS.map((m) => <Chip key={m.id} label={m.label} active={method === m.id} onPress={() => setMethod(m.id)} />)}
            </View>
            <Text style={s.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={payDate} onChangeText={setPayDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.muted} />
            <Text style={s.inputLabel}>Reference</Text>
            <TextInput style={s.input} value={ref} onChangeText={setRef} placeholder="Txn ID (optional)" placeholderTextColor={colors.muted} />
            <Text style={s.inputLabel}>Notes</Text>
            <TextInput style={s.input} value={payNotes} onChangeText={setPayNotes} placeholder="Optional" placeholderTextColor={colors.muted} />
            {payErr ? <Text style={s.errText}>{payErr}</Text> : null}
            <TouchableOpacity style={[s.submitBtn, paying && s.disabled]} onPress={() => void recordPay()} disabled={paying} activeOpacity={0.85}>
              {paying ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Record payment</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cancel order */}
      <Modal visible={cancelOpen} transparent animationType="slide" onRequestClose={() => !moving && setCancelOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={s.overlay} onPress={() => !moving && setCancelOpen(false)} />
          <View style={s.sheet}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Cancel {d.orderNumber}</Text>
            <Text style={s.mutedText}>This cannot be undone from here.</Text>
            {d.paidAmount > 0 && (
              <View style={s.warnBox}>
                <Ionicons name="warning-outline" size={14} color="#b45309" />
                <Text style={s.warnText}>{fc(d.paidAmount)} already paid is not refunded automatically — refund the customer separately.</Text>
              </View>
            )}
            {hasShopFabric && (
              <View style={s.warnBox}>
                <Ionicons name="layers-outline" size={14} color="#b45309" />
                <Text style={s.warnText}>
                  {d.fabricDeducted
                    ? "The fabric already taken out of stock for this order will be returned to stock."
                    : "The fabric for this order has not been cut yet, so no stock is touched."}
                </Text>
              </View>
            )}
            <Text style={s.inputLabel}>Reason *</Text>
            <TextInput
              style={[s.input, { minHeight: 70 }]}
              value={cancelReason}
              onChangeText={(v) => { setCancelReason(v); setCancelErr("") }}
              placeholder="e.g. Customer changed their mind"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
            />
            {cancelErr ? <Text style={s.errText}>{cancelErr}</Text> : null}
            <View style={s.btnRow}>
              <TouchableOpacity style={s.outlineBtn} onPress={() => setCancelOpen(false)} disabled={moving}>
                <Text style={s.outlineBtnText}>Keep order</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.dangerBtn, moving && s.disabled]} onPress={() => void cancelOrder()} disabled={moving}>
                {moving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Cancel order</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Assign work */}
      <Modal visible={assignOpen} transparent animationType="slide" onRequestClose={() => setAssignOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={s.overlay} onPress={() => setAssignOpen(false)} />
          <View style={[s.sheet, { maxHeight: "85%" }]}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Assign work</Text>
            <ScrollView contentContainerStyle={{ gap: 10 }} keyboardShouldPersistTaps="handled">
              {d.items.length > 0 && (
                <>
                  <Text style={s.inputLabel}>Garment line</Text>
                  <View style={s.wrapRow}>
                    {d.items.map((it) => (
                      <Chip key={it.id} label={`${it.productType} ×${it.quantity}`} active={aLine === it.id} onPress={() => pickLine(it.id)} />
                    ))}
                  </View>
                </>
              )}
              <Text style={s.inputLabel}>Dorji *</Text>
              <View style={s.wrapRow}>
                {dorjiOpts.map((o) => (
                  <Chip
                    key={o.id}
                    label={`${o.name}${o.maxPieces ? ` (${o.piecesInHand}/${o.maxPieces})` : o.piecesInHand ? ` (${o.piecesInHand} in hand)` : ""}`}
                    active={aDorji === o.id}
                    onPress={() => pickDorji(o)}
                  />
                ))}
                {dorjiOpts.length === 0 && <Text style={s.mutedText}>No active dorjis.</Text>}
              </View>
              <Text style={s.inputLabel}>Task *</Text>
              <TextInput style={s.input} value={aTask} onChangeText={setATask} placeholder="e.g. Blouse stitching" placeholderTextColor={colors.muted} />
              <View style={s.twoCol}>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.inputLabel}>Pieces *</Text>
                  <TextInput style={s.input} keyboardType="number-pad" value={aPieces} onChangeText={setAPieces} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={s.inputLabel}>Rate / piece *</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" value={aRate} onChangeText={setARate} placeholder="0" placeholderTextColor={colors.muted} />
                </View>
              </View>
              <Text style={s.hint}>Dorji charge: {fc((Number(aPieces) || 0) * (Number(aRate) || 0))}</Text>
              <Text style={s.inputLabel}>Expected back (YYYY-MM-DD)</Text>
              <TextInput style={s.input} value={aBack} onChangeText={setABack} placeholder="Optional" placeholderTextColor={colors.muted} />
              {aErr ? <Text style={s.errText}>{aErr}</Text> : null}
              <TouchableOpacity style={[s.submitBtn, assigning && s.disabled]} onPress={() => void saveAssign()} disabled={assigning} activeOpacity={0.85}>
                {assigning ? <ActivityIndicator color="#fff" /> : <Text style={s.submitBtnText}>Assign</Text>}
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
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  topBarTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: colors.text },
  topActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  infoRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  infoLabel: { fontSize: 13, color: colors.muted },
  infoValue: { fontSize: 14, fontWeight: "600", color: colors.text, flex: 1, textAlign: "right" },
  totalText: { fontSize: 16, fontWeight: "800", color: colors.text },
  paidText: { color: "#16a34a", fontWeight: "700" },
  dueText: { color: "#ef4444", fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  noteBox: { flexDirection: "row", gap: 8, backgroundColor: "#f5f3ff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#ddd6fe" },
  noteText: { flex: 1, fontSize: 13, color: colors.text },
  lineRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  lineTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
  lineSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  lineAmt: { fontSize: 14, fontWeight: "700", color: "#7c3aed" },
  mutedText: { fontSize: 13, color: colors.muted },
  hint: { fontSize: 12, color: colors.muted },
  errText: { fontSize: 13, color: colors.danger, fontWeight: "600" },
  chipRow: { gap: 8, paddingVertical: 2 },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.background },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.text },
  chipTextActive: { color: "#fff" },
  btnRow: { flexDirection: "row", gap: 10 },
  primaryBtn: { flex: 1, backgroundColor: "#7c3aed", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  dangerBtn: { flex: 1, backgroundColor: colors.danger, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  dangerOutlineBtn: { flex: 1, borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  dangerOutlineText: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  outlineBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  outlineBtnText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  disabled: { opacity: 0.6 },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#7c3aed", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  logRow: { flexDirection: "row", gap: 10 },
  logDotCol: { alignItems: "center", width: 16, paddingTop: 4 },
  logDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.muted },
  logDotActive: { backgroundColor: "#7c3aed" },
  logLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  logContent: { flex: 1, paddingBottom: 16 },
  logStatus: { fontSize: 13, fontWeight: "700", color: colors.text },
  logNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
  logDate: { fontSize: 11, color: colors.muted, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, gap: 10 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.text },
  inputLabel: { fontSize: 13, fontWeight: "600", color: colors.muted },
  input: {
    backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: colors.text,
  },
  twoCol: { flexDirection: "row", gap: 10 },
  warnBox: { flexDirection: "row", gap: 8, backgroundColor: "#fffbeb", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#fde68a" },
  warnText: { flex: 1, fontSize: 12, color: "#92400e" },
  submitBtn: { backgroundColor: "#7c3aed", borderRadius: 14, paddingVertical: 14, alignItems: "center", marginTop: 6 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
})
