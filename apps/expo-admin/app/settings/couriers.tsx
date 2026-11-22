import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage, formatDateTime } from "@/lib/format";
import { courierProviderLabel, getCourierAccounts, testCourierAccount } from "@/services/courier";
import type { CourierAccount, CourierTestResult } from "@/types/courier";

const PROVIDER_TINT: Record<string, { color: string; bg: string }> = {
  pathao: { color: "#dc2626", bg: "#fee2e2" },
  steadfast: { color: "#0f766e", bg: "#ccfbf1" },
  redx: { color: "#b91c1c", bg: "#fde8e6" },
};

const DELIVERY_TYPE_LABEL: Record<number, string> = { 48: "Normal", 12: "On-demand" };
const ITEM_TYPE_LABEL: Record<number, string> = { 1: "Document", 2: "Parcel" };

/** Read-only list of connected couriers with "Test connection". Connecting / editing stays on the web admin. */
export default function CourierAccountsScreen() {
  const { canRead, canWrite } = useAuth();
  const { formatCurrency } = useCurrency();
  const [accounts, setAccounts] = useState<CourierAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState<number | null>(null);
  const [results, setResults] = useState<Record<number, CourierTestResult>>({});

  const load = useCallback(async () => {
    try {
      setError("");
      setAccounts(await getCourierAccounts());
    } catch (e) {
      setError(apiErrorMessage(e, "Could not load courier accounts."));
    }
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  if (!canRead("Shipping Methods")) return <AccessDenied />;

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const test = async (a: CourierAccount) => {
    setTesting(a.id);
    try {
      const r = await testCourierAccount(a.id);
      setResults((x) => ({ ...x, [a.id]: r }));
      // The server saves lastCheckedAt / lastError and returns the fresh row.
      if (r.account) setAccounts((list) => list.map((row) => (row.id === r.account!.id ? r.account! : row)));
    } catch (e) {
      setResults((x) => ({ ...x, [a.id]: { ok: false, message: apiErrorMessage(e, "Connection failed.") } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.headerTitle}>Courier accounts</Text>
        <View style={{ width: 38 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.primaryDark} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primaryDark} />}
        >
          <View style={s.note}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <Text style={s.noteText}>
              Connect or edit Pathao and Steadfast on the web admin (Shipping methods → Courier integrations). Booking and tracking work here once connected.
            </Text>
          </View>

          {error ? (
            <View style={s.empty}>
              <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
              <Text style={s.emptyText}>{error}</Text>
            </View>
          ) : accounts.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="bicycle-outline" size={36} color={colors.muted} />
              <Text style={s.emptyTitle}>No courier connected</Text>
              <Text style={s.emptyText}>Add your Pathao or Steadfast merchant account on the web admin.</Text>
            </View>
          ) : (
            accounts.map((a) => {
              const tint = PROVIDER_TINT[a.provider] ?? { color: colors.primaryDark, bg: "#ecfdf5" };
              const result = results[a.id];
              const apiCourier = a.isIntegrated;
              const conn = a.connectionStatus ?? (a.lastError ? "error" : a.lastCheckedAt ? "connected" : "untested");
              const status = !a.isActive
                ? { label: "Off", color: colors.muted, bg: "#f1f5f9" }
                : !apiCourier
                  ? { label: "Coming soon", color: colors.muted, bg: "#f1f5f9" }
                  : !a.hasCredentials
                    ? { label: "Not set up", color: "#92400e", bg: "#fef3c7" }
                    : conn === "error"
                      ? { label: "Error", color: "#991b1b", bg: "#fee2e2" }
                      : conn === "connected"
                        ? { label: "Connected", color: "#166534", bg: "#dcfce7" }
                        : { label: "Not tested", color: "#1d4ed8", bg: "#dbeafe" };
              const defaults = [
                a.settings.deliveryType ? DELIVERY_TYPE_LABEL[a.settings.deliveryType] : null,
                a.settings.itemType ? ITEM_TYPE_LABEL[a.settings.itemType] : null,
                a.settings.weightKg ? `${a.settings.weightKg} kg` : null,
              ].filter(Boolean).join(" · ");
              return (
                <View key={a.id} style={[s.card, !a.isActive && { opacity: 0.65 }]}>
                  <View style={s.cardTop}>
                    <View style={[s.logo, { backgroundColor: tint.bg }]}>
                      <Ionicons name="bicycle" size={20} color={tint.color} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <View style={s.nameRow}>
                        <Text style={s.name}>{courierProviderLabel(a.provider)}</Text>
                        {a.isDefault ? <Text style={s.defaultTag}>Default</Text> : null}
                        {a.environment === "sandbox" ? <Text style={s.sandboxTag}>Sandbox</Text> : null}
                      </View>
                      {a.name && a.name.toLowerCase() !== a.provider ? <Text style={s.meta}>{a.name}</Text> : null}
                    </View>
                    <View style={[s.statusPill, { backgroundColor: status.bg }]}>
                      <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  </View>

                  <View style={s.rows}>
                    {a.username ? <Row label="Merchant" value={a.username} /> : null}
                    {a.storeName || a.storeId ? <Row label="Pickup store" value={a.storeName || `#${a.storeId}`} /> : null}
                    {a.maskedKey ? <Row label={a.provider === "pathao" ? "Client ID" : "API key"} value={a.maskedKey} /> : null}
                    {defaults ? <Row label="Defaults" value={defaults} /> : null}
                    {a.lastCheckedAt ? <Row label="Last checked" value={formatDateTime(a.lastCheckedAt)} /> : null}
                  </View>

                  {a.needsStore && a.hasCredentials ? (
                    <View style={s.warnBox}>
                      <Ionicons name="storefront-outline" size={14} color="#92400e" />
                      <Text style={s.warnText}>No pickup store saved — pick one on the web admin, or choose it each time you book.</Text>
                    </View>
                  ) : null}

                  {a.lastError && !result ? (
                    <View style={s.errorBox}>
                      <Ionicons name="alert-circle-outline" size={14} color="#b91c1c" />
                      <Text style={s.errorText}>{a.lastError}</Text>
                    </View>
                  ) : null}

                  {result ? (
                    <View style={[s.resultBox, result.ok ? s.resultOk : s.resultBad]}>
                      <Ionicons
                        name={result.ok ? "checkmark-circle-outline" : "close-circle-outline"}
                        size={15}
                        color={result.ok ? "#15803d" : "#b91c1c"}
                      />
                      <Text style={[s.resultText, { color: result.ok ? "#166534" : "#991b1b" }]}>
                        {result.message}
                        {result.balance != null ? ` · Balance ${formatCurrency(result.balance)}` : ""}
                      </Text>
                    </View>
                  ) : null}

                  {apiCourier && a.hasCredentials && canWrite("Shipping Methods") ? (
                    <Pressable
                      style={[s.testBtn, testing === a.id && { opacity: 0.6 }]}
                      onPress={() => void test(a)}
                      disabled={testing !== null}
                    >
                      {testing === a.id ? (
                        <ActivityIndicator size="small" color={colors.primaryDark} />
                      ) : (
                        <Ionicons name="pulse-outline" size={15} color={colors.primaryDark} />
                      )}
                      <Text style={s.testBtnText}>{testing === a.id ? "Testing…" : conn === "error" ? "Test again" : "Test connection"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontSize: 17, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  note: {
    flexDirection: "row", gap: 8, alignItems: "flex-start",
    borderRadius: 14, borderWidth: 1, borderColor: "#bfdbfe", backgroundColor: "#eff6ff", padding: 12,
  },
  noteText: { flex: 1, color: "#1e3a8a", fontSize: 12, lineHeight: 18 },
  empty: { alignItems: "center", gap: 8, paddingVertical: 48, paddingHorizontal: 20 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 14, gap: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  name: { color: colors.text, fontSize: 16, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12 },
  defaultTag: { color: colors.primaryDark, fontSize: 11, fontWeight: "800", backgroundColor: "#ecfdf5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  sandboxTag: { color: "#b45309", fontSize: 11, fontWeight: "800", backgroundColor: "#fef3c7", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  rows: { gap: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 13 },
  rowValue: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "right" },
  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderRadius: 10, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", padding: 8,
  },
  errorText: { flex: 1, color: "#991b1b", fontSize: 12, lineHeight: 17 },
  warnBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderRadius: 10, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", padding: 8,
  },
  warnText: { flex: 1, color: "#92400e", fontSize: 12, lineHeight: 17 },
  resultBox: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, padding: 8 },
  resultOk: { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" },
  resultBad: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  resultText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  testBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 12, borderWidth: 1, borderColor: colors.primaryDark + "44", backgroundColor: "#ecfdf5", paddingVertical: 10,
  },
  testBtnText: { color: colors.primaryDark, fontSize: 13, fontWeight: "800" },
});
