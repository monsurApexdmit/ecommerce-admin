import React from "react"
import { View, Text, StyleSheet, TouchableOpacity } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "@/constants/theme"
import type { TailorOrder } from "@/types/tailor"
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "@/types/tailor"

interface Props { order: TailorOrder; onPress: () => void; formatCurrency: (n: any) => string }

const STATUS_BG: Record<string, string> = {
  pending: "#fef3c7", measurement_taken: "#dbeafe", assigned: "#ede9fe",
  cutting: "#e0f2fe", stitching: "#f3e8ff", ready: "#dcfce7",
  delivered: "#d1fae5", cancelled: "#fee2e2",
}

export function TailorOrderCard({ order, onPress, formatCurrency }: Props) {
  const isOverdue =
    order.deliveryDate &&
    order.orderStatus !== "delivered" &&
    order.orderStatus !== "cancelled" &&
    new Date(order.deliveryDate) < new Date()

  const statusColor = ORDER_STATUS_COLORS[order.orderStatus] ?? "#94a3b8"
  const statusBg = STATUS_BG[order.orderStatus] ?? "#f1f5f9"
  const payColor = PAYMENT_STATUS_COLORS[order.paymentStatus] ?? "#94a3b8"
  const initials = (order.customer?.name ?? "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.72}>
      <View style={[s.accent, { backgroundColor: statusColor }]} />

      <View style={s.body}>
        <View style={s.row}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.customerName} numberOfLines={1}>
              {order.customer?.name ?? `Customer #${order.customerId}`}
            </Text>
            <Text style={s.orderNum}>{order.orderNumber}</Text>
          </View>
          <View style={[s.statusPill, { backgroundColor: statusBg }]}>
            <Text style={[s.statusText, { color: statusColor }]}>
              {ORDER_STATUS_LABELS[order.orderStatus]}
            </Text>
          </View>
        </View>

        <View style={s.divider} />

        <View style={s.row}>
          <View style={s.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.muted} />
            <Text style={[s.metaText, isOverdue && s.overdueText]}>
              {order.deliveryDate
                ? new Date(order.deliveryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                : "No date"}
            </Text>
            {isOverdue && <Ionicons name="warning-outline" size={11} color="#ef4444" />}
          </View>
          <View style={s.metaItem}>
            <Ionicons name="shirt-outline" size={12} color={colors.muted} />
            <Text style={s.metaText}>{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <View style={[s.payPill, { backgroundColor: payColor + "22" }]}>
            <Text style={[s.payText, { color: payColor }]}>
              {order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1)}
            </Text>
          </View>
          <Text style={s.amount}>{formatCurrency(order.totalAmount)}</Text>
        </View>
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
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: "500" },
  overdueText: { color: "#ef4444", fontWeight: "700" },
  payPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  payText: { fontSize: 11, fontWeight: "700" },
  amount: { fontSize: 14, fontWeight: "900", color: "#7c3aed" },
})
