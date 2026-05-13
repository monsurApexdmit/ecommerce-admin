import React from "react"
import { View, Text, StyleSheet } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { colors } from "@/constants/theme"

interface Props { icon: string; label: string; value: string | number; color: string; bg: string }

export function TailorStatCard({ icon, label, value, color, bg }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconBox, { backgroundColor: bg }]}>
        <Ionicons name={icon as any} size={22} color={color} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1, minWidth: "46%", backgroundColor: colors.surface,
    borderRadius: 14, padding: 14, margin: 4,
    shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  value: { fontSize: 22, fontWeight: "800", color: colors.text },
  label: { fontSize: 12, color: colors.muted, marginTop: 2 },
})
