import React from "react"
import { View, Text, StyleSheet } from "react-native"

interface Props { label: string; color: string; small?: boolean }

export function TailorStatusBadge({ label, color, small }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.label, { color }, small && styles.small]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  label: { fontSize: 12, fontWeight: "600" },
  small: { fontSize: 10 },
})
