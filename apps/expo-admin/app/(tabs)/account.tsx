import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { ListCard } from "@/components/ListCard";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";

export default function AccountTab() {
  const { user, company, session, signOut, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert("Logout failed", "Unable to complete logout.");
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Account</Text>
        <Text style={styles.subtitle}>Current session details for the signed-in admin user.</Text>
      </View>

      <ListCard title={user?.fullName ?? "User"} subtitle={user?.email} rightText={user?.role?.toUpperCase()}>
        <Text style={styles.meta}>Company: {company?.name ?? session?.companyName ?? "—"}</Text>
        <Text style={styles.meta}>Status: {company?.status ?? "—"}</Text>
        <Text style={styles.meta}>Company ID: {session?.companyId ?? "—"}</Text>
      </ListCard>

      <ListCard title="API Configuration" subtitle="Expo connects directly to Laravel, not the Next proxy.">
        <Text style={styles.meta}>Base URL: {process.env.EXPO_PUBLIC_API_BASE_URL ?? "Not configured"}</Text>
      </ListCard>

      <Pressable style={[styles.button, loading && styles.buttonDisabled]} onPress={() => void handleLogout()} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing out..." : "Sign Out"}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
  },
  meta: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  button: {
    backgroundColor: colors.danger,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 16,
  },
});
