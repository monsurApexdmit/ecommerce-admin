import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { deleteFinanceAccount, getFinanceAccounts, setDefaultFinanceAccount } from "@/services/finance";
import type { FinanceAccount, FinanceAccountsResult } from "@/types/finance";
import { Badge, Card, EmptyState, FinanceHeader, HeaderButton, Loading, fmtDate, fs } from "@/components/finance/ui";
import { AccountSheet, TransferSheet } from "@/components/finance/forms";

const TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  cash: "cash-outline",
  bank: "business-outline",
  mobile_wallet: "phone-portrait-outline",
  card: "card-outline",
  other: "wallet-outline",
};

export default function FinanceAccountsScreen() {
  const { canRead, canWrite, canDelete } = useAuth();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);
  const [data, setData] = useState<FinanceAccountsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; account: FinanceAccount | null }>({ open: false, account: null });
  const [transferOpen, setTransferOpen] = useState(false);

  const load = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true);
    try {
      setData(await getFinanceAccounts());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load accounts."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead("Finance")) return <AccessDenied />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const accounts = data?.accounts ?? [];

  const takenMethods = (except: FinanceAccount | null): Record<string, string> => {
    const out: Record<string, string> = {};
    accounts.forEach((a) => {
      if (a.id === except?.id) return;
      a.methodKeys.forEach((k) => {
        out[k] = a.name;
      });
    });
    return out;
  };

  const makeDefault = async (a: FinanceAccount) => {
    try {
      await setDefaultFinanceAccount(a.id);
      void load(false);
    } catch (err) {
      Alert.alert("Couldn't update", apiErrorMessage(err));
    }
  };

  const confirmDelete = (a: FinanceAccount) => {
    Alert.alert("Delete account", `Delete "${a.name}"? Its payment methods will post to the default account.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFinanceAccount(a.id);
            void load(false);
          } catch (err) {
            Alert.alert("Delete failed", apiErrorMessage(err));
          }
        },
      },
    ]);
  };

  const openMenu = (a: FinanceAccount) => {
    const actions: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [
      { text: "View transactions", onPress: () => router.push(`/finance/transactions?accountId=${a.id}` as any) },
    ];
    if (canWrite("Finance")) {
      actions.push({ text: "Edit", onPress: () => setSheet({ open: true, account: a }) });
      if (!a.isDefault) actions.push({ text: "Set as default", onPress: () => void makeDefault(a) });
    }
    if (canDelete("Finance") && !a.isDefault) actions.push({ text: "Delete", style: "destructive", onPress: () => confirmDelete(a) });
    actions.push({ text: "Cancel", style: "cancel" });
    Alert.alert(a.name, `Balance ${fc(a.balance)}`, actions);
  };

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader
        title="Accounts"
        subtitle={data ? `${data.totals.activeCount} active` : null}
        right={
          canWrite("Finance") ? (
            <View style={{ flexDirection: "row", gap: 8 }}>
              <HeaderButton icon="swap-horizontal" tone="plain" onPress={() => setTransferOpen(true)} />
              <HeaderButton icon="add" onPress={() => setSheet({ open: true, account: null })} />
            </View>
          ) : null
        }
      />
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <EmptyState error title="Couldn't load accounts" text={error} onRetry={() => void load()} />
      ) : (
        <ScrollView
          contentContainerStyle={fs.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
        >
          <View style={styles.hero}>
            <Text style={styles.heroLabel}>Total balance</Text>
            <Text style={styles.heroValue}>{fc(data?.totals.balance ?? 0)}</Text>
            <Text style={styles.heroSub}>
              In {fc(data?.totals.moneyIn ?? 0)} · Out {fc(data?.totals.moneyOut ?? 0)}
              {data?.asOf ? ` · as of ${fmtDate(data.asOf)}` : ""}
            </Text>
          </View>

          {accounts.map((a) => (
            <Pressable key={a.id} style={[styles.acct, !a.isActive && { opacity: 0.6 }]} onPress={() => openMenu(a)}>
              <View style={styles.acctIcon}>
                <Ionicons name={TYPE_ICONS[a.type] ?? "wallet-outline"} size={20} color={colors.primaryDark} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
                  {a.isDefault ? <Badge label="Default" color={colors.primaryDark} bg="#dcfce7" /> : null}
                  {!a.isActive ? <Badge label="Inactive" /> : null}
                </View>
                <Text style={fs.muted} numberOfLines={1}>
                  {a.typeLabel}
                  {a.methodLabels.length ? ` · ${a.methodLabels.join(", ")}` : ""}
                  {a.receivesUnmapped ? " · + unmapped methods" : ""}
                </Text>
                <Text style={fs.muted}>
                  In {fc(a.moneyIn)} · Out {fc(a.moneyOut)} · {a.transactionCount} txns
                </Text>
              </View>
              <Text style={[styles.acctBal, a.balance < 0 && { color: colors.danger }]}>{fc(a.balance)}</Text>
            </Pressable>
          ))}

          {data && data.unmappedMethods.length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>Methods posting to the default account</Text>
              {data.unmappedMethods.map((m) => (
                <View key={m.key} style={styles.unmapped}>
                  <Text style={{ color: colors.text, flex: 1 }}>{m.label}</Text>
                  <Text style={fs.muted}>{m.count} · {fc(m.amount)}</Text>
                </View>
              ))}
              <Text style={fs.muted}>Map them to an account by editing it.</Text>
            </Card>
          ) : null}
        </ScrollView>
      )}

      <AccountSheet
        visible={sheet.open}
        account={sheet.account}
        takenMethods={takenMethods(sheet.account)}
        onClose={() => setSheet({ open: false, account: null })}
        onSaved={() => {
          setSheet({ open: false, account: null });
          void load(false);
        }}
      />
      <TransferSheet
        visible={transferOpen}
        accounts={accounts}
        onClose={() => setTransferOpen(false)}
        onSaved={() => {
          setTransferOpen(false);
          void load(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primaryDark, borderRadius: 18, padding: 18, gap: 4 },
  heroLabel: { color: "#d1fae5", fontSize: 12, fontWeight: "700" },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  heroSub: { color: "#d1fae5", fontSize: 12 },
  acct: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  acctIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  acctName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  acctBal: { color: colors.text, fontSize: 15, fontWeight: "900" },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  unmapped: { flexDirection: "row", alignItems: "center", gap: 8 },
});
