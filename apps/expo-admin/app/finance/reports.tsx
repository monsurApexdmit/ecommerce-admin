import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { useLocalSearchParams } from "expo-router";
import { getAgingReport, getCashflowReport, getHealthChecks, getPnlReport, getTaxReport } from "@/services/finance";
import { HealthChecksPanel, MonthClosePanel } from "@/components/finance/v2";
import type { FinanceHealth, FinanceAgingBucket, FinanceAgingReport, FinanceCashflow, FinancePnl, FinanceTaxReport } from "@/types/finance";
import {
  Bar,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FinanceHeader,
  KeyValue,
  Loading,
  fmtDate,
  fs,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";

type Tab = "pnl" | "cashflow" | "tax" | "aging" | "close" | "health";

const TABS: { value: Tab; label: string }[] = [
  { value: "pnl", label: "Profit & loss" },
  { value: "cashflow", label: "Cash flow" },
  { value: "tax", label: "Tax" },
  { value: "aging", label: "Aging" },
  { value: "close", label: "Month close" },
  { value: "health", label: "Health checks" },
];

type Result =
  | { tab: "pnl"; data: FinancePnl }
  | { tab: "cashflow"; data: FinanceCashflow }
  | { tab: "tax"; data: FinanceTaxReport }
  | { tab: "aging"; data: FinanceAgingReport }
  | { tab: "health"; data: FinanceHealth };

export default function FinanceReportsScreen() {
  const { canRead, canWrite } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [closeKey, setCloseKey] = useState(0);
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.value === params.tab) ? (params.tab as Tab) : "pnl");
  const { noteTimezone } = useFinanceFilters();
  const fq = useFinanceQuery();
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (spinner = true) => {
      const id = ++reqId.current;
      if (tab === "close") {
        setLoading(false);
        return;
      }
      if (spinner) setLoading(true);
      try {
        const q = fq;
        let r: Result;
        if (tab === "pnl") r = { tab, data: await getPnlReport({ ...q, compare: "previous" }) };
        else if (tab === "cashflow") r = { tab, data: await getCashflowReport(q) };
        else if (tab === "tax") r = { tab, data: await getTaxReport(q) };
        else if (tab === "health") r = { tab, data: await getHealthChecks(q) };
        else r = { tab, data: await getAgingReport() };
        if (id !== reqId.current) return;
        if ("meta" in r.data && r.data.meta) noteTimezone(r.data.meta.tz);
        setResult(r);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, "Could not load the report."));
        setResult(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [tab, fq, noteTimezone],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead("Finance")) return <AccessDenied />;

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === "close") setCloseKey((k) => k + 1);
    await load(false);
    setRefreshing(false);
  };

  const periodLabel = (p: { label: string; from: string | null; to: string | null } | null) =>
    p ? `${p.label}${p.from && p.to ? ` · ${fmtDate(p.from)} – ${fmtDate(p.to)}` : ""}` : null;

  const change = (pct: number | null | undefined) =>
    pct === null || pct === undefined ? "" : `  ${pct >= 0 ? "▲" : "▼"}${Math.abs(pct).toFixed(1)}%`;

  const renderPnl = (d: FinancePnl) => {
    const c = d.current;
    const p = d.previous;
    const ch = d.changes ?? {};
    const catMax = Math.max(1, ...c.expensesByCategory.map((e) => e.amount));
    return (
      <>
        <Text style={styles.period}>{periodLabel(d.period)}</Text>
        {d.closeText ? (
          <Pressable onPress={() => setTab("close")}>
            <Text style={[styles.period, { color: colors.primaryDark }]}>{d.closeText}</Text>
          </Pressable>
        ) : null}
        <View style={[styles.hero, { backgroundColor: c.netProfit >= 0 ? colors.primaryDark : colors.danger }]}>
          <Text style={styles.heroLabel}>Net profit</Text>
          <Text style={styles.heroValue}>{fc(c.netProfit)}</Text>
          <Text style={styles.heroSub}>
            {c.netMarginPct !== null ? `${c.netMarginPct.toFixed(1)}% net margin` : ""}
            {p ? ` · previous ${fc(p.netProfit)}${change(ch.netProfit)}` : ""}
          </Text>
        </View>
        <Card>
          <KeyValue label={`Revenue${change(ch.revenue)}`} value={fc(c.revenue)} bold />
          <KeyValue label={`Cost of goods sold${change(ch.cogs)}`} value={`− ${fc(c.cogs)}`} tone="out" />
          <View style={fs.divider} />
          <KeyValue
            label={`Gross profit${c.grossMarginPct !== null ? ` (${c.grossMarginPct.toFixed(1)}%)` : ""}${change(ch.grossProfit)}`}
            value={fc(c.grossProfit)}
            tone={c.grossProfit >= 0 ? "in" : "out"}
            bold
          />
          <KeyValue label={`Expenses${change(ch.expenses)}`} value={`− ${fc(c.expenses)}`} tone="out" />
          {c.voidedExpenses ? <Text style={fs.muted}>Expenses are net of {fc(c.voidedExpenses)} voided in this period.</Text> : null}
          {c.paymentFees ? <KeyValue label="Payment fees (estimated)" value={`− ${fc(c.paymentFees)}`} tone="out" /> : null}
          {c.otherIncome ? <KeyValue label="Other income" value={`+ ${fc(c.otherIncome)}`} tone="in" /> : null}
          {c.otherExpenses ? <KeyValue label="Other expenses" value={`− ${fc(c.otherExpenses)}`} tone="out" /> : null}
          <View style={fs.divider} />
          <KeyValue label="Net profit" value={fc(c.netProfit)} tone={c.netProfit >= 0 ? "in" : "out"} bold />
        </Card>
        {p ? (
          <Card>
            <Text style={styles.cardTitle}>Previous period</Text>
            <KeyValue label="Revenue" value={fc(p.revenue)} />
            <KeyValue label="Gross profit" value={fc(p.grossProfit)} />
            <KeyValue label="Expenses" value={fc(p.expenses)} />
            <KeyValue label="Net profit" value={fc(p.netProfit)} bold />
          </Card>
        ) : null}
        {c.expensesByCategory.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Expenses by category</Text>
            {c.expensesByCategory.map((e, i) => (
              <View key={`${e.categoryId ?? e.name}-${i}`} style={{ gap: 4 }}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineName} numberOfLines={1}>{e.name}</Text>
                  <Text style={styles.lineValue}>{fc(e.amount)}</Text>
                </View>
                <Bar ratio={e.amount / catMax} color={e.color ?? colors.warning} />
              </View>
            ))}
          </Card>
        ) : null}
        {c.info ? (
          <Card>
            <Text style={styles.cardTitle}>Included in revenue</Text>
            <KeyValue label="Orders" value={String(c.info.orders)} />
            <KeyValue label="Tax" value={fc(c.info.tax)} />
            <KeyValue label="Shipping" value={fc(c.info.shipping)} />
            <KeyValue label="Discounts" value={fc(c.info.discounts)} />
            <KeyValue label="Refunds paid" value={fc(c.info.refunds)} />
          </Card>
        ) : null}
      </>
    );
  };

  const renderCashflow = (d: FinanceCashflow) => {
    const inRows = d.bySource.filter((r) => r.moneyIn > 0);
    const outRows = d.bySource.filter((r) => r.moneyOut > 0);
    const max = Math.max(1, ...d.bySource.map((r) => Math.max(r.moneyIn, r.moneyOut)));
    return (
      <>
        <Text style={styles.period}>{periodLabel(d.period)}</Text>
        <Card>
          <KeyValue label="Opening balance" value={fc(d.openingBalance)} />
          <KeyValue label="Money in" value={`+ ${fc(d.moneyIn)}`} tone="in" />
          <KeyValue label="Money out" value={`− ${fc(d.moneyOut)}`} tone="out" />
          <View style={fs.divider} />
          <KeyValue label="Net cash flow" value={fc(d.net)} tone={d.net >= 0 ? "in" : "out"} bold />
          <KeyValue label="Closing balance" value={fc(d.closingBalance)} bold />
        </Card>
        {inRows.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Money in by source</Text>
            {inRows.map((r) => (
              <View key={`in-${r.sourceType}`} style={{ gap: 4 }}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineName}>{r.label} · {r.count}</Text>
                  <Text style={[styles.lineValue, { color: colors.primaryDark }]}>{fc(r.moneyIn)}</Text>
                </View>
                <Bar ratio={r.moneyIn / max} color={colors.primary} />
              </View>
            ))}
          </Card>
        ) : null}
        {outRows.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Money out by source</Text>
            {outRows.map((r) => (
              <View key={`out-${r.sourceType}`} style={{ gap: 4 }}>
                <View style={styles.lineHead}>
                  <Text style={styles.lineName}>{r.label} · {r.count}</Text>
                  <Text style={[styles.lineValue, { color: colors.danger }]}>{fc(r.moneyOut)}</Text>
                </View>
                <Bar ratio={r.moneyOut / max} color="#f87171" />
              </View>
            ))}
          </Card>
        ) : null}
        {d.byAccount.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>By account</Text>
            {d.byAccount.map((a, i) => (
              <View key={a.accountId} style={[{ gap: 2, paddingTop: i ? 8 : 0 }, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <View style={styles.lineHead}>
                  <Text style={[styles.lineName, { fontWeight: "800" }]}>{a.name}</Text>
                  <Text style={styles.lineValue}>{fc(a.closingBalance)}</Text>
                </View>
                <Text style={fs.muted}>
                  Open {fc(a.openingBalance)} · in {fc(a.moneyIn)} · out {fc(a.moneyOut)}
                  {a.transfersIn || a.transfersOut ? ` · transfers +${fc(a.transfersIn)} / −${fc(a.transfersOut)}` : ""}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}
      </>
    );
  };

  const renderTax = (d: FinanceTaxReport) => (
    <>
      <Text style={styles.period}>{periodLabel(d.period)}</Text>
      <Card>
        <KeyValue label="Tax collected" value={fc(d.taxCollected)} bold />
        <KeyValue label="Taxable sales (excl. tax)" value={fc(d.taxableSales)} />
        <KeyValue label="All sales" value={fc(d.salesTotal)} />
        <KeyValue label="Taxed orders" value={`${d.taxedOrders} of ${d.orders}`} />
        {d.effectiveRatePct !== null ? <KeyValue label="Effective rate" value={`${d.effectiveRatePct.toFixed(2)}%`} /> : null}
      </Card>
      {d.v2.rates.length > 0 || d.v2.notBrokenDown ? (
        <Card>
          <Text style={styles.cardTitle}>By tax rate</Text>
          {d.v2.rates.map((r) => (
            <View key={r.key} style={{ gap: 2 }}>
              <KeyValue label={r.name} value={fc(r.tax)} />
              <Text style={fs.muted}>
                {r.orders} order{r.orders === 1 ? "" : "s"} · on {fc(r.taxableAmount)}
              </Text>
            </View>
          ))}
          {d.v2.notBrokenDown ? (
            <View style={{ gap: 2 }}>
              <KeyValue label={d.v2.notBrokenDown.label} value={fc(d.v2.notBrokenDown.tax)} tone="muted" />
              <Text style={fs.muted}>
                {d.v2.notBrokenDown.orders} order{d.v2.notBrokenDown.orders === 1 ? "" : "s"} · on {fc(d.v2.notBrokenDown.taxableAmount)}
              </Text>
            </View>
          ) : null}
          <View style={fs.divider} />
          <KeyValue label="Tax collected" value={fc(d.taxCollected)} bold />
          {d.v2.reconciles === false ? (
            <Text style={{ color: colors.danger, fontSize: 12 }}>The rates don't add up to tax collected. See Health checks.</Text>
          ) : null}
        </Card>
      ) : null}
    </>
  );

  const buckets = (title: string, total: number, list: FinanceAgingBucket[], extras: { label: string; value: number }[]) => {
    const max = Math.max(1, ...list.map((b) => b.amount));
    return (
      <Card>
        <View style={styles.lineHead}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={[styles.lineValue, { fontSize: 15 }]}>{fc(total)}</Text>
        </View>
        {list.map((b) => (
          <View key={b.key} style={{ gap: 4 }}>
            <View style={styles.lineHead}>
              <Text style={styles.lineName}>{b.label} · {b.count}</Text>
              <Text style={styles.lineValue}>{fc(b.amount)}</Text>
            </View>
            <Bar ratio={b.amount / max} color={["#059669", "#d97706", "#ea580c", "#dc2626"][b.key] ?? colors.muted} />
          </View>
        ))}
        {extras.map((e) => (
          <KeyValue key={e.label} label={e.label} value={fc(e.value)} />
        ))}
      </Card>
    );
  };

  const renderAging = (d: FinanceAgingReport) => (
    <>
      <Text style={styles.period}>{d.asOf ? `As of ${fmtDate(d.asOf)}` : ""}</Text>
      {buckets("Receivables", d.receivables.total, d.receivables.buckets, [
        { label: "of which COD with couriers", value: d.receivables.codWithCouriers },
        { label: "Tailor balances", value: d.receivables.tailorBalances },
      ])}
      {buckets("Payables", d.payables.total, d.payables.buckets, [
        { label: "Unpaid salaries", value: d.payables.unpaidSalaries },
        { label: "Dorji owed", value: d.payables.dorjiOwed },
      ])}
    </>
  );

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader title="Reports" subtitle="Profit, tax, month close, health checks" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
      >
        <View style={{ paddingTop: 10, gap: 6 }}>
          <ChipRow>
            {TABS.map((t) => (
              <Chip key={t.value} label={t.label} active={tab === t.value} onPress={() => setTab(t.value)} />
            ))}
          </ChipRow>
          {tab === "aging" || tab === "close" ? null : <FinanceFilterBar />}
        </View>
        {tab === "close" ? (
          <View style={fs.scroll}>
            <MonthClosePanel canWrite={canWrite("Finance")} refreshKey={closeKey} />
          </View>
        ) : loading && (!result || result.tab !== tab) ? (
          <Loading />
        ) : error ? (
          <EmptyState error title="Couldn't load report" text={error} onRetry={() => void load()} />
        ) : result && result.tab === tab ? (
          <View style={fs.scroll}>
            {result.tab === "pnl"
              ? renderPnl(result.data)
              : result.tab === "cashflow"
                ? renderCashflow(result.data)
                : result.tab === "tax"
                  ? renderTax(result.data)
                  : result.tab === "health"
                    ? <HealthChecksPanel health={result.data} />
                    : renderAging(result.data)}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  period: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  hero: { borderRadius: 18, padding: 18, gap: 4 },
  heroLabel: { color: "#e2e8f0", fontSize: 12, fontWeight: "700" },
  heroValue: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  heroSub: { color: "#e2e8f0", fontSize: 12 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  lineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lineName: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  lineValue: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
