import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";

export function AccessDenied() {
  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Ionicons name="shield-outline" size={36} color="#ef4444" />
      </View>
      <Text style={s.title}>Access Denied</Text>
      <Text style={s.body}>You don't have permission to view this screen.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.background },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, marginBottom: 8 },
  body: { fontSize: 14, color: colors.muted, textAlign: "center", lineHeight: 20 },
});
