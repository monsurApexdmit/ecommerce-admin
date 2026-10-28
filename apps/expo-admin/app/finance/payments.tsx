import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { router } from "expo-router";
import { getFinancePayments, getPaymentsSummary, getUnpaidSales, recordSalePayment } from "@/services/finance";
import type { FinancePaymentList, FinancePaymentsSummary, FinanceTransaction, FinanceUnpaidSale } from "@/types/finance";
import {
  Bar,
  Card,
  Chip,
  ChipRow,
  KeyValue,
  NowTag,
  EmptyState,
  FinanceHeader,
  HeaderButton,
  Loading,
  SearchBox,
  Sheet,
  fmtDate,
  fmtShortDate,
  fs,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";
import { TransactionRow } from "@/components/finance/TransactionRow";
import { PaymentSheet, type PaymentSheetValues } from "@/components/finance/forms";

const PAGE_SIZE = 25;

const TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sale", label: "Sales" },
  { value: "cod", label: "COD" },
  { value: "tailor_payment", label: "Tailor" },
  { value: "supplier_refund", label: "Supplier refunds" },
  { value: "refund", label: "Refunds" },
];

export default function FinancePaymentsScreen() {
  const { canRead, canWrite } = useAuth();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);

  const { period, noteTimezone } = useFinanceFilters();
  const fq = useFinanceQuery();
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [list, setList] = useState<FinancePaymentList | null>(null);
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const [summary, setSummary] = useState<FinancePaymentsSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sale, setSale] = useState<FinanceUnpaidSale | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(
    () => ({ ...fq, type: type === "all" ? undefined : type, search: debounced || undefined, perPage: PAGE_SIZE }),
    [fq, type, debounced],
  );

  const load = useCallback(
    async (spinner = true) => {
      const id = ++reqId.current;
      if (spinner) setLoading(true);
      try {
        const res = await getFinancePayments({ ...query, page: 1 });
        if (id !== reqId.current) return;
        setList(res);
        setRows(res.data);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, "Could not load payments."));
        setRows([]);
        setList(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [query],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getPaymentsSummary(fq);
      noteTimezone(res.meta.tz);
      setSummary(res);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(apiErrorMessage(err, "Could not load the payments summary."));
    }
  }, [fq, noteTimezone]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (!canRead("Finance")) return <AccessDenied />;

  const loadMore = async () => {
    if (!list || loading || loadingMore || list.page >= list.totalPages) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await getFinancePayments({ ...query, page: list.page + 1 });
      if (id !== reqId.current) return;
      setRows((prev) => [...prev, ...res.data.filter((r) => !prev.some((p) => p.id === r.id))]);
      setList((cur) => (cur ? { ...cur, page: res.page, totalPages: res.totalPages } : res));
    } catch {
      // keep
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(false), loadSummary()]);
    setRefreshing(false);
  };

  const submitPayment = async (v: PaymentSheetValues) => {
    if (!sale) return;
    await recordSalePayment(sale.sellId, { amount: v.amount, method: v.method, date: v.date, reference: v.reference, notes: v.notes });
    Alert.alert("Payment recorded", `${fc(v.amount)} for ${sale.invoiceNo}.`);
    setSale(null);
    void Promise.all([load(false), loadSummary()]);
  };

  const showRow = (row: FinanceTransaction) => {
    Alert.alert(
      row.sourceLabel || "Payment",
      [
        `${row.signedAmount < 0 ? "Refunded" : "Received"} ${fc(row.amount)}`,
        row.fee > 0 ? `Fee ${fc(row.fee)} · net ${fc(row.net)}` : null,
        row.channel ? `Channel: ${row.channel === "pos" ? "POS" : row.channel === "online" ? "Online store" : "Manual"}` : null,
        `Date: ${fmtDate(row.date)}`,
        row.party ? `From: ${row.party}` : null,
        row.reference ? `Reference: ${row.reference}` : null,
        row.accountName ? `Account: ${row.accountName}` : null,
        row.methodLabel ? `Method: ${row.methodLabel}` : null,
        row.note ? `Note: ${row.note}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  };

  const header = (
    <View style={{ gap: 6, paddingBottom: 8 }}>
      <View style={{ height: 8 }} />
      <FinanceFilterBar currencyCode={summary?.meta.currency?.code} />
      {summaryError && !summary ? <Text style={[fs.muted, { color: colors.danger, paddingHorizontal: 18 }]}>{summaryError}</Text> : null}
      {summary ? <SummaryCards s={summary} periodLabel={period.preset === "all_time" ? "all time" : "this period"} /> : null}
      <Text style={styles.listTitle}>Payments received</Text>
      <SearchBox value={search} onChange={setSearch} placeholder="Search customer, invoice, method…" />
      <ChipRow>
        {TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </ChipRow>
      {list ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Received</Text>
            <Text style={[fs.totalValue, { color: colors.primaryDark }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.received)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Refunded</Text>
            <Text style={[fs.totalValue, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.refunded)}</Text>
          </View>
          {list.totals.fees !== null ? (
            <View style={fs.totalBox}>
              <Text style={fs.totalLabel}>Fees</Text>
              <Text style={[fs.totalValue, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.fees)}</Text>
            </View>
          ) : null}
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Net · {list.totals.count}</Text>
            <Text style={fs.totalValue} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.netAfterFees ?? list.totals.net)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader
        title="Payments"
        subtitle="Money received and refunds"
        right={canWrite("Dues") ? <HeaderButton icon="add" onPress={() => setPickerOpen(true)} /> : null}
      />
      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <TransactionRow item={item} onPress={() => showRow(item)} showFee />
          </View>
        )}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={fs.footer} /> : null}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <EmptyState error title="Couldn't load payments" text={error} onRetry={() => void load()} />
          ) : (
            <EmptyState icon="card-outline" title="No payments" text={search || type !== "all" ? "Try different filters." : "Payments you receive will appear here."} />
          )
        }
      />

      <UnpaidSalePicker
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(s) => {
          setPickerOpen(false);
          setSale(s);
        }}
      />
      <PaymentSheet
        visible={sale !== null}
        title="Record payment"
        subtitle={sale ? `${sale.invoiceNo}${sale.customerName ? ` · ${sale.customerName}` : ""} · due ${fc(sale.due)}` : null}
        defaultAmount={sale?.due}
        maxAmount={sale?.due}
        submitLabel="Record payment"
        onClose={() => setSale(null)}
        onSubmit={submitPayment}
      />
    </SafeAreaView>
  );
}

function SummaryCards({ s, periodLabel }: { s: FinancePaymentsSummary; periodLabel: string }) {
  const { formatCurrency: fc } = useCurrency();
  const paidRatio = s.orderVolume.amount > 0 ? s.paidVolume.recorded / s.orderVolume.amount : 0;
  const estRatio = s.orderVolume.amount > 0 ? s.paidVolume.estimated / s.orderVolume.amount : 0;
  const nl = s.needsALook;
  const look = [
    { key: "online", item: nl.onlineUnconfirmed, fallback: "online payments not confirmed", route: "/orders" },
    { key: "cod", item: nl.codAwaitingCollection, fallback: "COD orders awaiting collection", route: "/finance/receivables?tab=customers&cod=true" },
    { key: "refunds", item: nl.refundsAwaiting, fallback: "refunds awaiting settlement", route: "/returns" },
  ];
  return (
    <View style={{ paddingHorizontal: 16, gap: 10, paddingTop: 4 }}>
      <Card>
        <Text style={styles.cardTitle}>Orders in {periodLabel}</Text>
        <KeyValue label={`Order volume · ${s.orderVolume.count} orders`} value={fc(s.orderVolume.amount)} bold />
        <View style={styles.stack}>
          <View style={{ flex: Math.max(0.0001, paidRatio), backgroundColor: colors.primary }} />
          <View style={{ flex: Math.max(0.0001, estRatio), backgroundColor: "#93c5fd" }} />
          <View style={{ flex: Math.max(0.0001, 1 - paidRatio - estRatio), backgroundColor: "#f1f5f9" }} />
        </View>
        <KeyValue label="Paid (recorded payments)" value={fc(s.paidVolume.recorded)} tone="in" />
        {s.paidVolume.estimated ? (
          <KeyValue label={`+ Estimated · ${s.paidVolume.estimatedCount} older orders`} value={fc(s.paidVolume.estimated)} tone="muted" />
        ) : null}
        <KeyValue label="Still unpaid" value={fc(Math.max(0, s.orderVolume.amount - s.paidVolume.total))} tone="warn" />
        {s.paidVolume.estimated && s.paidVolume.estimatedNote ? <Text style={fs.muted}>{s.paidVolume.estimatedNote}</Text> : null}
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Money received</Text>
        <KeyValue label={`Received · ${s.received.count} payments`} value={fc(s.received.amount)} tone="in" />
        <KeyValue label="Payment fees (estimated)" value={s.received.fees ? `−${fc(s.received.fees)}` : fc(0)} tone="muted" />
        <View style={fs.divider} />
        <KeyValue label="Net after fees" value={fc(s.received.net)} bold />
        <View style={fs.divider} />
        <Text style={styles.cardSub}>{s.refunds.label ?? `Refunds in ${periodLabel}`}</Text>
        <Text style={styles.refundLine}>
          Refunded <Text style={{ color: colors.danger, fontWeight: "800" }}>{fc(s.refunds.refunded)}</Text>
          {" · "}Awaiting settlement <Text style={{ color: colors.warning, fontWeight: "800" }}>{fc(s.refunds.awaiting)}</Text>
        </Text>
      </Card>

      <Card>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>Needs a look</Text>
          <NowTag label={nl.label ?? "As things stand now"} />
        </View>
        {look.map((l) => (
          <Pressable key={l.key} style={styles.lookRow} onPress={() => router.push(l.route as any)}>
            <Text style={styles.lookText}>{l.item.label ?? `${l.item.count} ${l.fallback}`}</Text>
            <Text style={styles.lookAmount}>{fc(l.item.amount)}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.muted} />
          </Pressable>
        ))}
      </Card>

      <Card>
        <View style={styles.headRow}>
          <Text style={styles.cardTitle}>To suppliers</Text>
          <Pressable onPress={() => router.push("/finance/payouts?type=supplier" as any)} hitSlop={8}>
            <Text style={styles.link}>Payouts</Text>
          </Pressable>
        </View>
        <View style={styles.triple}>
          <Mini label="Owed" value={fc(s.toSuppliers.owed)} hint="now" />
          <Mini label="Payable now" value={fc(s.toSuppliers.payableNow)} hint="now" />
          <Mini label="Paid" value={fc(s.toSuppliers.paidInPeriod)} hint={periodLabel} />
        </View>
        {s.toSuppliers.credits ? (
          <Pressable onPress={() => router.push("/finance/receivables?tab=suppliers" as any)}>
            <Text style={[fs.muted, { color: colors.primaryDark }]}>Supplier credits {fc(s.toSuppliers.credits)} · see Receivables</Text>
          </Pressable>
        ) : null}
        <Bar ratio={s.toSuppliers.owed > 0 ? s.toSuppliers.payableNow / s.toSuppliers.owed : 0} color={colors.danger} />
      </Card>
    </View>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={fs.muted} numberOfLines={1}>{hint}</Text>
    </View>
  );
}

function UnpaidSalePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (s: FinanceUnpaidSale) => void;
}) {
  const { formatCurrency } = useCurrency();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<FinanceUnpaidSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await getUnpaidSales({ search: search.trim(), limit: 30 });
        if (!cancelled) {
          setItems(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err, "Could not load unpaid sales."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [visible, search]);

  useEffect(() => {
    if (!visible) setSearch("");
  }, [visible]);

  return (
    <Sheet visible={visible} title="Pick an unpaid sale" onClose={onClose}>
      <View style={styles.pickSearch}>
        <Ionicons name="search" size={16} color={colors.muted} />
        <TextInput
          style={{ flex: 1, color: colors.text, fontSize: 14 }}
          value={search}
          onChangeText={setSearch}
          placeholder="Invoice, customer name or phone"
          placeholderTextColor="#94a3b8"
          autoCorrect={false}
        />
      </View>
      {loading ? <ActivityIndicator color={colors.primaryDark} /> : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {!loading && !error && items.length === 0 ? <Text style={fs.muted}>No unpaid sales found.</Text> : null}
      {items.map((s) => (
        <Pressable key={s.sellId} style={styles.pickRow} onPress={() => onPick(s)}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={fs.rowTitle}>{s.invoiceNo}</Text>
            <Text style={fs.rowMeta} numberOfLines={1}>
              {[s.customerName, s.customerPhone, s.orderDate ? fmtShortDate(s.orderDate) : null, s.status].filter(Boolean).join(" · ")}
            </Text>
            <Text style={fs.rowMeta}>Total {formatCurrency(s.total)} · paid {formatCurrency(s.paid)}</Text>
          </View>
          <Text style={[fs.amount, { color: colors.warning }]}>{formatCurrency(s.due)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  listTitle: { color: colors.text, fontSize: 15, fontWeight: "800", paddingHorizontal: 16, marginTop: 8 },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  cardSub: { color: colors.text, fontSize: 13, fontWeight: "700" },
  refundLine: { color: colors.muted, fontSize: 13 },
  stack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden" },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  lookRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  lookText: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "600" },
  lookAmount: { color: colors.text, fontSize: 13, fontWeight: "800" },
  link: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  triple: { flexDirection: "row", gap: 8 },
  mini: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 2 },
  miniLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  miniValue: { color: colors.text, fontSize: 13, fontWeight: "900" },
  pickSearch: {
    flexDirection: "row", alignItems: "center", gap: 8, height: 44,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#f8fafc", paddingHorizontal: 12,
  },
  pickRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
  },
});
