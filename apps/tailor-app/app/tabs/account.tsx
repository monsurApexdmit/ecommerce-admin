import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"
import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import { colors } from "@/constants/theme"

export default function AccountTab() {
  const { user, company, signOut } = useAuth()

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
    ])
  }

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Text style={s.title}>Account</Text>
      </View>

      <View style={s.profileCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {user?.fullName?.slice(0, 2).toUpperCase() ?? "TM"}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user?.fullName ?? "Tailor User"}</Text>
          <Text style={s.email}>{user?.email ?? ""}</Text>
          <Text style={s.role}>{user?.role?.toUpperCase()}</Text>
        </View>
      </View>

      {company && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Shop</Text>
          <View style={s.infoCard}>
            <Ionicons name="storefront-outline" size={20} color="#7c3aed" style={{ marginRight: 12 }} />
            <Text style={s.infoText}>{company.name}</Text>
          </View>
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Quick Links</Text>
        {[
          { icon: "receipt-outline", label: "Orders", route: "/tailor" },
          { icon: "resize-outline", label: "Measurements", route: "/tailor/measurements" },
          { icon: "layers-outline", label: "Fabrics", route: "/tailor/fabrics" },
          { icon: "person-outline", label: "Dorjis", route: "/tailor/dorjis" },
          { icon: "wallet-outline", label: "Payments", route: "/tailor/payments" },
        ].map(item => (
          <TouchableOpacity
            key={item.route}
            style={s.linkRow}
            onPress={() => (require("expo-router").router.push(item.route as any))}
            activeOpacity={0.75}
          >
            <Ionicons name={item.icon as any} size={18} color="#7c3aed" style={{ marginRight: 12 }} />
            <Text style={s.linkText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
        <Ionicons name="log-out-outline" size={20} color="#dc2626" style={{ marginRight: 8 }} />
        <Text style={s.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingVertical: 14 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 16, margin: 16,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "#ede9fe", alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "900", color: "#7c3aed" },
  name: { fontSize: 17, fontWeight: "800", color: colors.text },
  email: { fontSize: 13, color: colors.muted, marginTop: 2 },
  role: { fontSize: 11, fontWeight: "700", color: "#7c3aed", marginTop: 4 },
  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: "700", color: colors.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  infoCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  infoText: { fontSize: 15, fontWeight: "600", color: colors.text },
  linkRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8,
  },
  linkText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.text },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginTop: 8, padding: 16,
    backgroundColor: "#fee2e2", borderRadius: 14,
    borderWidth: 1, borderColor: "#fecaca",
  },
  signOutText: { fontSize: 15, fontWeight: "800", color: "#dc2626" },
})
