import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "@/constants/theme"
import type { TailorBoardRow } from "@/types/tailor"
import { PAYMENT_STATUS_COLORS, TAILOR_STAGE_COLORS, TAILOR_STAGE_LABEL } from "@/types/tailor"
import { whenText } from "@/components/tailor/tailorHelpers"

interface Props { order: TailorBoardRow; onPress: () => void; formatCurrency: (n: number) => string }

export function TailorOrderCard({ order, onPress, formatCurrency }: Props) {
  const open = order.stage !== "delivered" && order.stage !== "cancelled"
  const when = whenText(order.daysLeft, order.stage)
  const statusColor = TAILOR_STAGE_COLORS[order.stage] ?? "#94a3b8"
  const payColor = PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "#94a3b8"
  const initials = (order.customer?.name ?? "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.72}>
      {/* Left accent bar */}
      <View style={[s.accent, { backgroundColor: statusColor }]} />

      <View style={s.body}>
        {/* Top row */}
        <View style={s.row}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.customerName} numberOfLines={1}>
              {order.customer?.name ?? "—"}
            </Text>
            <Text style={s.orderNum}>{order.orderNumber}{order.isUrgent ? "  · URGENT" : ""}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusColor + "22" }]}>
            <Text style={[s.statusText, { color: statusColor }]}>
              {TAILOR_STAGE_LABEL[order.stage]}
            </Text>
          </View>
        </View>

        {order.itemsSummary ? (
          <Text style={s.summary} numberOfLines={1}>
            {order.itemsSummary}{order.dorjiNames.length ? ` · ${order.dorjiNames.join(", ")}` : ""}
          </Text>
        ) : null}

        {/* Stage bar */}
        <View style={s.stageBar}>
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <View
              key={j}
              style={[s.stageSeg, {
                backgroundColor: order.stage === "cancelled" ? "#fecaca" : j <= order.stageIndex ? statusColor : colors.border,
              }]}
            />
          ))}
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Bottom row */}
        <View style={s.row}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.muted} />
            <Text style={[s.metaText, open && { color: when.color }]}>
              {order.deliveryDate
                ? new Date(order.deliveryDate + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                : "No date"}
              {open && order.daysLeft != null ? ` · ${when.text}` : ""}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[s.payPill, { backgroundColor: payColor + "22" }]}>
            <Text style={[s.payText, { color: payColor }]}>
              {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
            </Text>
          </View>
          <Text style={s.amount}>{formatCurrency(order.totalAmount)}</Text>
        </View>
        {open && order.dueAmount > 0 ? (
          <Text style={s.dueText}>Due {formatCurrency(order.dueAmount)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accent: { width: 4, borderRadius: 0 },
  body: { flex: 1, padding: 14, gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 13, fontWeight: "900", color: "#7c3aed" },
  customerName: { fontSize: 14, fontWeight: "800", color: colors.text },
  orderNum: { fontSize: 11, color: "#7c3aed", fontWeight: "600", marginTop: 1 },
  statusPill: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  overdueText: { color: "#ef4444", fontWeight: "700" },
  payPill: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6,
  },
  payText: { fontSize: 11, fontWeight: "700" },
  summary: { fontSize: 12, color: colors.muted, marginTop: 8 },
  stageBar: { flexDirection: "row", gap: 3, marginTop: 8 },
  stageSeg: { flex: 1, height: 4, borderRadius: 2 },
  dueText: { fontSize: 11, color: "#d97706", fontWeight: "700", textAlign: "right", marginTop: 4 },
  amount: { fontSize: 14, fontWeight: "900", color: "#7c3aed" },
})
