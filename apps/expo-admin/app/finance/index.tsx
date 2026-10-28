import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { getFinanceOverviewV2 } from "@/services/finance";
import type { FinanceOverview, FinanceOverviewV2 } from "@/types/finance";
import {
  Bar,
  Card,
  EmptyState,
  FinanceHeader,
  Kpi,
  KpiGrid,
  KeyValue,
  Loading,
  NowTag,
  SectionTitle,
  fs,
  titleCase,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";
import { TransactionRow } from "@/components/finance/TransactionRow";
import { ProductsWithoutCostSheet } from "@/components/finance/v2";

const LINKS: { label: string; route: string; icon: keyof typeof Ionicons.glyphMap; hint: string; bg: string }[] = [
  { label: "Transactions", route: "/finance/transactions", icon: "swap-vertical-outline", hint: "Ledger, entries, transfers", bg: "#ecfdf5" },
  { label: "Accounts", route: "/finance/accounts", icon: "wallet-outline", hint: "Cash, bank & wallets", bg: "#f0fdfa" },
  { label: "Payments", route: "/finance/payments", icon: "card-outline", hint: "Money received", bg: "#eff6ff" },
  { label: "Receivables", route: "/finance/receivables", icon: "hourglass-outline", hint: "Owed to and from you", bg: "#fffbeb" },
  { label: "Payouts", route: "/finance/payouts", icon: "arrow-up-circle-outline", hint: "Money you pay", bg: "#fef2f2" },
  { label: "Inventory", route: "/finance/inventory", icon: "layers-outline", hint: "Stock value & ledger", bg: "#fef9c3" },
  { label: "Reports", route: "/finance/reports", icon: "stats-chart-outline", hint: "P&L, tax, month close", bg: "#f5f3ff" },
];

const ALERT_ROUTES: Record<string, string> = {
  overdue_receivables: "/finance/receivables",
  cod_to_record: "/finance/receivables",
  overdue_payables: "/finance/payouts",
  unpaid_salaries: "/finance/payouts",
  dorji_owed: "/finance/payouts",
  negative_balance: "/finance/accounts",
  opening_stock: "/finance/inventory?tab=opening",
  stock_gap: "/finance/inventory",
  supplier_owes_you: "/finance/receivables?tab=suppliers",
  month_to_close: "/finance/reports?tab=close",
};

/** Web hrefs like `/dashboard/finance/receivables` → app routes. */
function alertRoute(href: string | null, type: string): string | null {
  // Keep the web query (e.g. `?tab=opening`): the app screens read the same params.
  const m = href?.match(/\/finance\/([a-z-]+)(\?[^#]*)?/);
  if (m) return `/finance/${m[1]}${m[2] ?? ""}`;
  return ALERT_ROUTES[type] ?? null;
}

function change(pct: number | null): string | null {
  if (pct === null) return null;
  return `${pct >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}% vs prev.`;
}

export default function FinanceOverviewScreen() {
  const { canRead } = useAuth();
  const { formatCurrency } = useCurrency();
  const { period, noteTimezone } = useFinanceFilters();
  const fq = useFinanceQuery();
  const [data, setData] = useState<FinanceOverview | null>(null);
  const [v2, setV2] = useState<FinanceOverviewV2 | null>(null);
  const [costsOpen, setCostsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  const load = useCallback(async (spinner = true) => {
    if (spinner) setLoading(true);
    try {
      const res = await getFinanceOverviewV2(fq);
      noteTimezone(res.v2.meta.tz);
      setData(res);
      setV2(res.v2);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load the finance overview."));
    } finally {
      setLoading(false);
      loadedOnce.current = true;
    }
  }, [fq, noteTimezone]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (loadedOnce.current) void load(false);
    }, [load]),
  );

  if (!canRead("Finance")) return <AccessDenied />;

  const onRefresh = async () => {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  };

  const fc = (n: number) => formatCurrency(n);
  const series = data?.cashFlow.points ?? [];
  const k = data?.kpis;
  const seriesMax = Math.max(1, ...series.map((p) => Math.max(p.moneyIn, p.moneyOut)));
  const shownSeries = series.slice(-14);
  const cats = (data?.expensesByCategory ?? []).slice().sort((a, b) => b.amount - a.amount).slice(0, 6);
  const catMax = Math.max(1, ...cats.map((c) => c.amount));
  const flowMax = Math.max(1, k?.moneyIn.value ?? 0, k?.moneyOut.value ?? 0);

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader title="Finance" subtitle="Money in, money out, profit" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
      >
        <View style={{ paddingTop: 10 }}>
          <FinanceFilterBar currencyCode={v2?.meta.currency?.code} />
        </View>

        {loading && !data ? (
          <Loading />
        ) : error && !data ? (
          <EmptyState error title="Couldn't load finance" text={error} onRetry={() => void load()} />
        ) : data ? (
          <View style={styles.body}>
            {data.alerts.length > 0 ? (
              <View style={{ gap: 8 }}>
                {data.alerts.map((a, i) => (
                  <Pressable
                    key={`${a.type}-${i}`}
                    style={styles.alert}
                    onPress={() => {
                      const target = alertRoute(a.href, a.type);
                      if (target) router.push(target as any);
                    }}
                  >
                    <Ionicons
                      name={a.severity === "danger" ? "alert-circle-outline" : a.severity === "warning" ? "warning-outline" : "information-circle-outline"}
                      size={18}
                      color={a.severity === "danger" ? colors.danger : a.severity === "warning" ? colors.warning : colors.info}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{a.title}</Text>
                      {a.message ? <Text style={styles.alertText}>{a.message}</Text> : null}
                    </View>
                    {a.amount !== null ? <Text style={styles.alertAmount}>{fc(a.amount)}</Text> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            {k ? (
              <KpiGrid>
                <Kpi label="Revenue" value={fc(k.revenue.value)} icon="trending-up-outline" tone="info" hint={change(k.revenue.changePct)} onPress={() => router.push("/finance/reports" as any)} />
                <Kpi label="Net profit" value={fc(k.netProfit.value)} icon="sparkles-outline" tone={k.netProfit.value >= 0 ? "in" : "out"} hint={`Gross ${fc(k.grossProfit.value)}`} onPress={() => router.push("/finance/reports" as any)} />
                <Kpi label="Money in" value={fc(k.moneyIn.value)} icon="arrow-down-circle-outline" tone="in" hint={change(k.moneyIn.changePct)} onPress={() => router.push("/finance/transactions?direction=in" as any)} />
                <Kpi label="Money out" value={fc(k.moneyOut.value)} icon="arrow-up-circle-outline" tone="out" hint={change(k.moneyOut.changePct)} onPress={() => router.push("/finance/transactions?direction=out" as any)} />
                <Kpi label="Net cash flow" value={fc(k.netCashFlow.value)} icon="pulse-outline" tone={k.netCashFlow.value >= 0 ? "in" : "out"} hint={change(k.netCashFlow.changePct)} />
                <Kpi label="Gross profit" value={fc(k.grossProfit.value)} icon="podium-outline" hint={`COGS ${fc(k.cogs.value)}`} />
                <Kpi label="Expenses" value={fc(k.expenses.value)} icon="receipt-outline" tone="warn" hint={change(k.expenses.changePct)} />
                {v2?.fees ? (
                  <Kpi
                    label="Payment fees"
                    value={fc(v2.fees.total)}
                    icon="cut-outline"
                    tone="warn"
                    hint={v2.fees.count ? `${v2.fees.count} payments` : "From method fee settings"}
                    onPress={() => router.push("/finance/transactions" as any)}
                  />
                ) : null}
                {v2?.orderVolume ? (
                  <Kpi
                    label="Order volume"
                    value={fc(v2.orderVolume.amount)}
                    icon="bag-handle-outline"
                    hint={`${v2.orderVolume.orders} orders`}
                    onPress={() => router.push("/finance/payments" as any)}
                  />
                ) : null}
                {v2?.refunds ? (
                  <Kpi
                    label={`Refunds · ${period.preset === "all_time" ? "all time" : "this period"}`}
                    value={fc(v2.refunds.refunded)}
                    icon="return-down-back-outline"
                    tone="out"
                    hint={v2.refunds.awaiting ? `Awaiting ${fc(v2.refunds.awaiting)}` : null}
                    onPress={() => router.push("/finance/payments" as any)}
                  />
                ) : null}
              </KpiGrid>
            ) : null}

            {k ? (
              <Card>
                <View style={styles.nowHead}>
                  <Text style={styles.nowTitle}>Balances</Text>
                  <NowTag />
                </View>
                <KpiGrid>
                  <Kpi label="Cash on hand" value={fc(k.cashOnHand.value)} icon="wallet-outline" onPress={() => router.push("/finance/accounts" as any)} />
                  <Kpi label="Owed to you" value={fc(k.receivables.value)} icon="hourglass-outline" tone="warn" hint={data.receivables.codWithCouriers ? `COD ${fc(data.receivables.codWithCouriers)}` : null} onPress={() => router.push("/finance/receivables" as any)} />
                  <Kpi label="You owe" value={fc(k.payables.value)} icon="alert-circle-outline" tone="out" hint={data.payables.supplierDues ? `Suppliers ${fc(data.payables.supplierDues)}` : null} onPress={() => router.push("/finance/payouts" as any)} />
                  {v2?.storeCredit ? (
                    <Kpi
                      label="Store credit"
                      value={fc(v2.storeCredit.total)}
                      icon="gift-outline"
                      tone="info"
                      hint={v2.storeCredit.customers ? `Owed to ${v2.storeCredit.customers} customers` : "Owed to customers"}
                    />
                  ) : null}
                </KpiGrid>
              </Card>
            ) : null}

            {v2?.coverage ? (
              <Card>
                <SectionTitle
                  title="Product profit coverage"
                  action={v2.coverage.productsWithoutCost > 0 ? "Set costs" : undefined}
                  onAction={() => setCostsOpen(true)}
                />
                <View style={styles.coverBar}>
                  <View style={{ flex: Math.max(0.0001, v2.coverage.costed), backgroundColor: colors.primary }} />
                  <View style={{ flex: Math.max(0.0001, v2.coverage.uncosted), backgroundColor: "#fbbf24" }} />
                  {v2.coverage.excluded ? (
                    <View style={{ flex: Math.max(0.0001, Math.abs(v2.coverage.excluded)), backgroundColor: "#cbd5e1" }} />
                  ) : null}
                </View>
                <KeyValue label="Costed sales" value={fc(v2.coverage.costed)} tone="in" />
                <KeyValue label="Uncosted sales (product has no cost)" value={fc(v2.coverage.uncosted)} tone="warn" />
                {v2.coverage.excluded ? (
                  <KeyValue label="Not included (custom lines without a product)" value={fc(v2.coverage.excluded)} tone="muted" />
                ) : null}
                <View style={fs.divider} />
                <KeyValue label="Product sales" value={fc(v2.coverage.productSales)} bold />
                <Text style={fs.muted}>
                  {v2.coverage.costedPct !== null ? `${v2.coverage.costedPct.toFixed(1)}% of product sales have a cost. ` : ""}
                  {v2.coverage.productsWithoutCost > 0
                    ? `${v2.coverage.productsWithoutCost} product${v2.coverage.productsWithoutCost === 1 ? "" : "s"} without a cost: their profit is not counted.`
                    : "Every product sold has a cost."}
                </Text>
              </Card>
            ) : null}

            {v2?.closeText ? (
              <Pressable style={styles.closeNote} onPress={() => router.push("/finance/reports?tab=close" as any)}>
                <Ionicons name="lock-closed-outline" size={14} color={colors.muted} />
                <Text style={[fs.muted, { flex: 1 }]}>{v2.closeText}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.muted} />
              </Pressable>
            ) : null}

            <Card>
              <SectionTitle title="Money in vs out" />
              <View style={{ gap: 8 }}>
                <View style={styles.flowRow}>
                  <Text style={styles.flowLabel}>In</Text>
                  <Bar ratio={(k?.moneyIn.value ?? 0) / flowMax} color={colors.primary} height={12} />
                  <Text style={[styles.flowValue, { color: colors.primaryDark }]}>{fc(k?.moneyIn.value ?? 0)}</Text>
                </View>
                <View style={styles.flowRow}>
                  <Text style={styles.flowLabel}>Out</Text>
                  <Bar ratio={(k?.moneyOut.value ?? 0) / flowMax} color={colors.danger} height={12} />
                  <Text style={[styles.flowValue, { color: colors.danger }]}>{fc(k?.moneyOut.value ?? 0)}</Text>
                </View>
              </View>
              {shownSeries.length > 0 ? (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <View style={styles.chart}>
                    {shownSeries.map((p) => (
                      <View key={p.key || p.label} style={styles.chartCol}>
                        <View style={styles.chartBars}>
                          <View style={[styles.chartBar, { height: `${(p.moneyIn / seriesMax) * 100}%`, backgroundColor: colors.primary }]} />
                          <View style={[styles.chartBar, { height: `${(p.moneyOut / seriesMax) * 100}%`, backgroundColor: "#f87171" }]} />
                        </View>
                        <Text style={styles.chartLabel} numberOfLines={1}>
                          {p.label.split(" ")[0]}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.legend}>
                    <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                    <Text style={fs.muted}>Money in</Text>
                    <View style={[styles.dot, { backgroundColor: "#f87171", marginLeft: 10 }]} />
                    <Text style={fs.muted}>Money out</Text>
                  </View>
                </View>
              ) : null}
            </Card>

            {cats.length > 0 ? (
              <Card>
                <SectionTitle title="Expenses by category" />
                {cats.map((c) => (
                  <View key={c.name} style={{ gap: 4 }}>
                    <View style={styles.catHead}>
                      <Text style={styles.catName} numberOfLines={1}>{titleCase(c.name)}</Text>
                      <Text style={styles.catAmount}>{fc(c.amount)}</Text>
                    </View>
                    <Bar ratio={c.amount / catMax} color={colors.warning} />
                  </View>
                ))}
              </Card>
            ) : null}

            <Card>
              <SectionTitle title="Account balances" action="Manage" onAction={() => router.push("/finance/accounts" as any)} />
              {data.accountBalances.length === 0 ? (
                <Text style={fs.muted}>No accounts yet.</Text>
              ) : (
                data.accountBalances.map((a, i) => (
                  <Pressable
                    key={a.accountId}
                    style={[styles.acctRow, i > 0 && styles.acctBorder]}
                    onPress={() => router.push(`/finance/transactions?accountId=${a.accountId}` as any)}
                  >
                    <View style={styles.acctIcon}>
                      <Ionicons name={a.type === "cash" ? "cash-outline" : a.type === "bank" ? "business-outline" : a.type === "mobile_wallet" ? "phone-portrait-outline" : "card-outline"} size={16} color={colors.primaryDark} />
                    </View>
                    <Text style={styles.acctName} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={[styles.acctBal, a.balance < 0 && { color: colors.danger }]}>{fc(a.balance)}</Text>
                  </Pressable>
                ))
              )}
            </Card>

            <View style={{ gap: 8 }}>
              <SectionTitle title="Recent transactions" action="See all" onAction={() => router.push("/finance/transactions" as any)} />
              {data.recentTransactions.length === 0 ? (
                <Text style={fs.muted}>No money movements in this period.</Text>
              ) : (
                data.recentTransactions.slice(0, 10).map((t) => <TransactionRow key={t.id} item={t} />)
              )}
            </View>

            <View style={{ gap: 8 }}>
              <SectionTitle title="More in Finance" />
              <View style={styles.linkGrid}>
                {LINKS.map((l) => (
                  <Pressable key={l.route} style={styles.linkCard} onPress={() => router.push(l.route as any)}>
                    <View style={[styles.linkIcon, { backgroundColor: l.bg }]}>
                      <Ionicons name={l.icon} size={18} color={colors.primaryDark} />
                    </View>
                    <Text style={styles.linkLabel}>{l.label}</Text>
                    <Text style={styles.linkHint} numberOfLines={1}>{l.hint}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </ScrollView>
      <ProductsWithoutCostSheet visible={costsOpen} onClose={() => setCostsOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  alert: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a", borderRadius: 14, padding: 12,
  },
  alertTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  alertText: { color: colors.muted, fontSize: 12 },
  alertAmount: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  flowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  flowLabel: { width: 28, color: colors.muted, fontSize: 12, fontWeight: "700" },
  flowValue: { minWidth: 90, textAlign: "right", fontSize: 13, fontWeight: "800" },
  chart: { flexDirection: "row", alignItems: "flex-end", height: 110, gap: 4 },
  chartCol: { flex: 1, alignItems: "center", gap: 3, height: "100%" },
  chartBars: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 1, width: "100%", justifyContent: "center" },
  chartBar: { width: "40%", borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 1 },
  chartLabel: { color: colors.muted, fontSize: 9 },
  legend: { flexDirection: "row", alignItems: "center", gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  catHead: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  catName: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  catAmount: { color: colors.text, fontSize: 13, fontWeight: "800" },
  acctRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  acctBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  acctIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  acctName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  acctBal: { color: colors.text, fontSize: 14, fontWeight: "800" },
  nowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  nowTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  closeNote: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 10,
  },
  coverBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#f1f5f9" },
  linkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  linkCard: {
    width: "48%", flexGrow: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 12, gap: 4,
  },
  linkIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  linkLabel: { color: colors.text, fontSize: 14, fontWeight: "800" },
  linkHint: { color: colors.muted, fontSize: 11 },
});
