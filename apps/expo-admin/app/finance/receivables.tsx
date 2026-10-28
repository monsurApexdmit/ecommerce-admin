import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import {
  collectTailorBalance,
  getCustomerReceivables,
  getFinanceReceivableSummary,
  getSupplierBalances,
  receiveFromSupplier,
  recordCodCollection,
  recordSalePayment,
} from "@/services/finance";
import type {
  FinanceCodRow,
  FinanceCustomerReceivable,
  FinanceCustomerReceivables,
  FinanceReceivableSummary,
  FinanceSupplierBalance,
  FinanceSupplierBalances,
  FinanceTailorBalance,
} from "@/types/finance";
import {
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FinanceHeader,
  Loading,
  NowTag,
  SearchBox,
  fmtShortDate,
  fs,
  titleCase,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters } from "@/components/finance/filters";
import { PaymentSheet, type PaymentSheetValues } from "@/components/finance/forms";

const PAGE_SIZE = 25;
type Tab = "customers" | "suppliers" | "cod" | "tailor";
type Sort = "age" | "amount" | "name";
type Direction = "all" | "we_owe" | "they_owe";

type CollectTarget =
  | { kind: "sale"; row: FinanceCustomerReceivable }
  | { kind: "supplier"; row: FinanceSupplierBalance }
  | { kind: "tailor"; row: FinanceTailorBalance };

const BUCKET_COLORS = ["#059669", "#d97706", "#dc2626", "#7f1d1d"];

export default function FinanceReceivablesScreen() {
  const params = useLocalSearchParams<{ tab?: string; cod?: string }>();
  const { canRead, canWrite } = useAuth();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);
  const { channel, noteTimezone } = useFinanceFilters();

  const [summary, setSummary] = useState<FinanceReceivableSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(
    params.tab === "suppliers" || params.tab === "cod" || params.tab === "tailor" ? params.tab : "customers",
  );
  const [bucket, setBucket] = useState<number | "all">("all");
  const [codOnly, setCodOnly] = useState(params.cod === "true");
  const [sort, setSort] = useState<Sort>("age");
  const [direction, setDirection] = useState<Direction>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [list, setList] = useState<FinanceCustomerReceivables | null>(null);
  const [rows, setRows] = useState<FinanceCustomerReceivable[]>([]);
  const [suppliers, setSuppliers] = useState<FinanceSupplierBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const [collect, setCollect] = useState<CollectTarget | null>(null);
  const [recordingCod, setRecordingCod] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await getFinanceReceivableSummary());
      setSummaryError(null);
    } catch (err) {
      setSummaryError(apiErrorMessage(err, "Could not load the receivables summary."));
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const query = useMemo(
    () => ({
      bucket,
      sort,
      cod: codOnly ? true : undefined,
      channel: channel !== "all" ? channel : undefined,
      search: debounced || undefined,
      perPage: PAGE_SIZE,
    }),
    [bucket, sort, codOnly, channel, debounced],
  );

  const load = useCallback(
    async (spinner = true) => {
      if (tab !== "customers" && tab !== "suppliers") {
        setLoading(false);
        return;
      }
      const id = ++reqId.current;
      if (spinner) setLoading(true);
      try {
        if (tab === "customers") {
          const res = await getCustomerReceivables({ ...query, page: 1 });
          if (id !== reqId.current) return;
          noteTimezone(res.meta?.tz);
          setList(res);
          setRows(res.data);
        } else {
          const res = await getSupplierBalances({ search: debounced || undefined, direction });
          if (id !== reqId.current) return;
          noteTimezone(res.meta.tz);
          setSuppliers(res);
        }
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, tab === "customers" ? "Could not load customer dues." : "Could not load supplier balances."));
        if (tab === "customers") {
          setRows([]);
          setList(null);
        } else setSuppliers(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [tab, query, debounced, direction, noteTimezone],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!canRead("Finance")) return <AccessDenied />;

  const loadMore = async () => {
    if (tab !== "customers" || !list || loading || loadingMore || list.page >= list.totalPages) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await getCustomerReceivables({ ...query, page: list.page + 1 });
      if (id !== reqId.current) return;
      setRows((prev) => [...prev, ...res.data.filter((r) => !prev.some((p) => p.sellId === r.sellId))]);
      setList((cur) => (cur ? { ...cur, page: res.page, totalPages: res.totalPages } : res));
    } catch {
      // keep
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshAll = () => Promise.all([load(false), loadSummary()]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const submitCollect = async (v: PaymentSheetValues) => {
    if (!collect) return;
    if (collect.kind === "sale") {
      await recordSalePayment(collect.row.sellId, { amount: v.amount, method: v.method, date: v.date, reference: v.reference, notes: v.notes });
    } else if (collect.kind === "supplier") {
      await receiveFromSupplier(collect.row.vendorId, { amount: v.amount, method: v.method, date: v.date, reference: v.reference, note: v.notes });
    } else {
      await collectTailorBalance(collect.row.orderId, { amount: v.amount, method: v.method, date: v.date, notes: v.notes });
    }
    setCollect(null);
    Alert.alert("Payment recorded", `${fc(v.amount)} received.`);
    void refreshAll();
  };

  const recordCod = (row: FinanceCodRow) => {
    Alert.alert(
      "Record COD collection",
      `Mark ${fc(row.amount)} from ${row.carrier ?? "the courier"} for ${row.invoiceNo ?? "this order"} as collected?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Record",
          onPress: async () => {
            setRecordingCod(row.shipmentId);
            try {
              await recordCodCollection(row.shipmentId, { notes: "Recorded from Finance" });
              void refreshAll();
            } catch (err) {
              Alert.alert("Couldn't record", apiErrorMessage(err));
            } finally {
              setRecordingCod(null);
            }
          },
        },
      ],
    );
  };

  const owedByCustomers = summary ? summary.customerDues.total : null;
  const aging = list?.aging ?? [];
  const agingTotal = Math.max(1, aging.reduce((a, b) => a + b.amount, 0));

  const header = (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <Card>
          <View style={styles.sumHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sumLabel}>Owed to you</Text>
              <Text style={styles.sumValue}>{summary ? fc(summary.total + (summary.suppliers?.theyOweYou ?? 0)) : "—"}</Text>
            </View>
            <NowTag />
          </View>
          {summaryError ? <Text style={{ color: colors.danger, fontSize: 12 }}>{summaryError}</Text> : null}
          {summary ? (
            <View style={styles.split}>
              <SplitBox label="By customers" value={fc(owedByCustomers ?? 0)} sub={`incl. COD ${fc(summary.codWithCouriers.total)}`} />
              <SplitBox label="Tailor balances" value={fc(summary.tailorBalances.total)} sub={`${summary.tailorBalances.count} orders`} />
              <SplitBox
                label="Suppliers owe you"
                value={fc(summary.suppliers?.theyOweYou ?? 0)}
                sub={summary.suppliers ? `you owe them ${fc(summary.suppliers.owed)}` : "—"}
              />
            </View>
          ) : null}
        </Card>
      </View>

      <ChipRow>
        <Chip label="Customers" active={tab === "customers"} onPress={() => setTab("customers")} icon="people-outline" />
        <Chip label="Suppliers" active={tab === "suppliers"} onPress={() => setTab("suppliers")} icon="storefront-outline" />
        <Chip label={`COD couriers${summary ? ` · ${summary.codWithCouriers.count}` : ""}`} active={tab === "cod"} onPress={() => setTab("cod")} icon="bicycle-outline" />
        <Chip label={`Tailor${summary ? ` · ${summary.tailorBalances.count}` : ""}`} active={tab === "tailor"} onPress={() => setTab("tailor")} icon="cut-outline" />
      </ChipRow>

      {tab === "customers" ? (
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Search customer, phone, invoice…" />
          <FinanceFilterBar showPeriod={false} />
          {list ? (
            <View style={{ paddingHorizontal: 16, gap: 6 }}>
              <View style={styles.agingBar}>
                {aging.map((b) => (
                  <View key={b.key} style={{ flex: Math.max(0.001, b.amount / agingTotal), backgroundColor: BUCKET_COLORS[b.key] ?? colors.muted }} />
                ))}
              </View>
              <Text style={fs.muted}>
                {fc(list.totals.due)} due on {list.totals.count} order{list.totals.count === 1 ? "" : "s"} from {list.totals.customers} customer
                {list.totals.customers === 1 ? "" : "s"}
                {list.totals.codDue ? ` · COD ${fc(list.totals.codDue)}` : ""}
              </Text>
            </View>
          ) : null}
          <ChipRow>
            <Chip label="All ages" active={bucket === "all"} onPress={() => setBucket("all")} />
            {aging.map((b) => (
              <Chip key={b.key} label={`${b.label} · ${fc(b.amount)}`} active={bucket === b.key} onPress={() => setBucket(b.key)} />
            ))}
          </ChipRow>
          <ChipRow>
            <Chip label="COD only" icon="bicycle-outline" active={codOnly} onPress={() => setCodOnly((v) => !v)} />
            <Chip label="Oldest" active={sort === "age"} onPress={() => setSort("age")} />
            <Chip label="Largest due" active={sort === "amount"} onPress={() => setSort("amount")} />
            <Chip label="Name" active={sort === "name"} onPress={() => setSort("name")} />
          </ChipRow>
        </>
      ) : null}

      {tab === "suppliers" ? (
        <>
          <SearchBox value={search} onChange={setSearch} placeholder="Search supplier…" />
          <ChipRow>
            <Chip label="All" active={direction === "all"} onPress={() => setDirection("all")} />
            <Chip label="You owe them" active={direction === "we_owe"} onPress={() => setDirection("we_owe")} />
            <Chip label="They owe you" active={direction === "they_owe"} onPress={() => setDirection("they_owe")} />
          </ChipRow>
          {suppliers ? (
            <View style={fs.totalsBar}>
              <View style={fs.totalBox}>
                <Text style={fs.totalLabel}>You owe</Text>
                <Text style={[fs.totalValue, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{fc(suppliers.totals.weOwe)}</Text>
              </View>
              <View style={fs.totalBox}>
                <Text style={fs.totalLabel}>Payable now</Text>
                <Text style={fs.totalValue} numberOfLines={1} adjustsFontSizeToFit>{fc(suppliers.totals.payableNow)}</Text>
              </View>
              <View style={fs.totalBox}>
                <Text style={fs.totalLabel}>They owe you</Text>
                <Text style={[fs.totalValue, { color: colors.primaryDark }]} numberOfLines={1} adjustsFontSizeToFit>{fc(suppliers.totals.theyOweYou)}</Text>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {tab === "cod" && summary && summary.codWithCouriers.byCourier.length > 0 ? (
        <ChipRow>
          {summary.codWithCouriers.byCourier.map((c) => (
            <Badge key={c.carrier} label={`${c.carrier}: ${fc(c.amount)} (${c.count})`} color={colors.text} bg="#e2e8f0" />
          ))}
        </ChipRow>
      ) : null}
    </View>
  );

  const renderSale = (item: FinanceCustomerReceivable) => (
    <View style={fs.rowCard}>
      <View style={[styles.ageDot, { backgroundColor: BUCKET_COLORS[item.bucket] ?? colors.muted }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={fs.rowTitle} numberOfLines={1}>{item.customerName ?? "Walk-in customer"}</Text>
          {item.isCod ? <Badge label="COD" color="#b45309" bg="#fef3c7" /> : null}
          {item.paid > 0 ? <Badge label="Partly paid" color="#1d4ed8" bg="#dbeafe" /> : null}
        </View>
        <Text style={fs.rowMeta} numberOfLines={1}>
          {[item.invoiceNo, item.orderDate ? fmtShortDate(item.orderDate) : null, item.ageDays !== null ? `${item.ageDays} days` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={fs.rowMeta} numberOfLines={1}>
          {[`Total ${fc(item.total)}`, item.paid ? `paid ${fc(item.paid)}` : null, item.status, item.codState === "delivered_record_payment" ? "delivered" : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={[fs.amount, { color: colors.warning }]}>{fc(item.due)}</Text>
        {canWrite("Dues") ? (
          <Pressable style={fs.smallBtn} onPress={() => setCollect({ kind: "sale", row: item })}>
            <Text style={fs.smallBtnText}>Record payment</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  const renderSupplier = (item: FinanceSupplierBalance) => {
    const theyOwe = item.net < 0;
    const payable = item.payableNow > 0.004;
    return (
      <Pressable
        style={fs.rowCard}
        onLongPress={item.fullId ? () => Alert.alert(item.name, `Supplier id: ${item.fullId}`) : undefined}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={[fs.rowTitle, item.deleted && { color: colors.muted }]} numberOfLines={1}>{item.name}</Text>
            {theyOwe ? <Badge label={item.directionLabel ?? "They owe you"} color={colors.primaryDark} bg="#dcfce7" /> : null}
          </View>
          <Text style={fs.rowMeta} numberOfLines={1}>
            {[`Owed ${fc(item.owed)}`, item.credits ? `credits ${fc(item.credits)}` : null, item.notYetDue ? `${fc(item.notYetDue)} not yet due` : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {!theyOwe && !payable && item.payDisabledReason ? (
            <Text style={[fs.rowMeta, { color: colors.warning }]} numberOfLines={2}>{item.payDisabledReason}</Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={[fs.amount, { color: theyOwe ? colors.primaryDark : colors.danger }]}>
            {theyOwe ? `+${fc(-item.net)}` : fc(item.net)}
          </Text>
          {theyOwe ? (
            canWrite("Finance") ? (
              <Pressable style={fs.smallBtn} onPress={() => setCollect({ kind: "supplier", row: item })}>
                <Text style={fs.smallBtnText}>Collect</Text>
              </Pressable>
            ) : null
          ) : item.net > 0 && canWrite("Dues") ? (
            <Pressable
              style={[fs.smallBtn, !payable && { backgroundColor: "#94a3b8" }]}
              disabled={!payable}
              onPress={() => router.push(`/finance/payouts?type=supplier&id=${item.vendorId}&create=1` as any)}
            >
              <Text style={fs.smallBtnText}>{payable ? `Pay out ${fc(item.payableNow)}` : "Nothing payable yet"}</Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderCod = (item: FinanceCodRow) => {
    const delivered = item.codState === "delivered_record_payment";
    return (
      <View style={fs.rowCard}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={fs.rowTitle} numberOfLines={1}>{item.customerName ?? item.invoiceNo ?? "Parcel"}</Text>
          <Text style={fs.rowMeta} numberOfLines={1}>
            {[item.invoiceNo, item.carrier, item.trackingNumber].filter(Boolean).join(" · ")}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
            <Badge
              label={delivered ? "Delivered · record cash" : titleCase(item.status ?? "On the way")}
              color={delivered ? colors.primaryDark : "#b45309"}
              bg={delivered ? "#dcfce7" : "#fef3c7"}
            />
            {item.ageDays !== null ? <Text style={fs.rowMeta}>{item.ageDays}d</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Text style={fs.amount}>{fc(item.amount)}</Text>
          {canWrite("Shipments") && delivered ? (
            <Pressable style={fs.smallBtn} onPress={() => recordCod(item)} disabled={recordingCod === item.shipmentId}>
              {recordingCod === item.shipmentId ? <ActivityIndicator color="#fff" size="small" /> : <Text style={fs.smallBtnText}>Record</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const renderTailor = (item: FinanceTailorBalance) => (
    <View style={fs.rowCard}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={fs.rowTitle} numberOfLines={1}>{item.customerName ?? item.orderNumber ?? "Tailor order"}</Text>
        <Text style={fs.rowMeta} numberOfLines={1}>
          {[item.orderNumber, item.status ? titleCase(item.status) : null, item.deliveryDate ? `delivery ${fmtShortDate(item.deliveryDate)}` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <Text style={fs.rowMeta}>Total {fc(item.total)} · paid {fc(item.paid)}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 6 }}>
        <Text style={[fs.amount, { color: colors.warning }]}>{fc(item.due)}</Text>
        {canWrite("TailorPayments") ? (
          <Pressable style={fs.smallBtn} onPress={() => setCollect({ kind: "tailor", row: item })}>
            <Text style={fs.smallBtnText}>Collect</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  type Item =
    | { k: "sale"; id: string; row: FinanceCustomerReceivable }
    | { k: "sup"; id: string; row: FinanceSupplierBalance }
    | { k: "cod"; id: string; row: FinanceCodRow }
    | { k: "t"; id: string; row: FinanceTailorBalance };

  const data: Item[] =
    tab === "customers"
      ? loading
        ? []
        : rows.map((r) => ({ k: "sale" as const, id: `s${r.sellId}`, row: r }))
      : tab === "suppliers"
        ? loading
          ? []
          : (suppliers?.rows ?? []).map((r) => ({ k: "sup" as const, id: `v${r.vendorId}`, row: r }))
        : tab === "cod"
          ? (summary?.codWithCouriers.rows ?? []).map((r) => ({ k: "cod" as const, id: `c${r.shipmentId}`, row: r }))
          : (summary?.tailorBalances.rows ?? []).map((r) => ({ k: "t" as const, id: `t${r.orderId}`, row: r }));

  const listTab = tab === "customers" || tab === "suppliers";
  const collectDue =
    collect?.kind === "sale" ? collect.row.due : collect?.kind === "supplier" ? -collect.row.net : collect?.kind === "tailor" ? collect.row.due : 0;

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader title="Receivables" subtitle="Owed to and from suppliers and customers" />
      <FlatList
        data={data}
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
            {item.k === "sale"
              ? renderSale(item.row)
              : item.k === "sup"
                ? renderSupplier(item.row)
                : item.k === "cod"
                  ? renderCod(item.row)
                  : renderTailor(item.row)}
          </View>
        )}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.primaryDark} style={fs.footer} />
          ) : !listTab && data.length >= 50 ? (
            <Text style={[fs.muted, { textAlign: "center", marginTop: 10 }]}>Showing the first 50.</Text>
          ) : null
        }
        ListEmptyComponent={
          listTab && loading ? (
            <Loading />
          ) : listTab && error ? (
            <EmptyState error title="Couldn't load" text={error} onRetry={() => void load()} />
          ) : !listTab && !summary && !summaryError ? (
            <Loading />
          ) : (
            <EmptyState
              icon="checkmark-done-outline"
              title={
                tab === "customers"
                  ? "No customer dues"
                  : tab === "suppliers"
                    ? "No supplier balances"
                    : tab === "cod"
                      ? "No COD with couriers"
                      : "No tailor balances"
              }
              text={search || bucket !== "all" || codOnly || direction !== "all" ? "Try different filters." : "Nothing outstanding here."}
            />
          )
        }
      />

      <PaymentSheet
        visible={collect !== null}
        title={collect?.kind === "supplier" ? "Payment received from supplier" : collect?.kind === "tailor" ? "Collect tailor payment" : "Record payment"}
        subtitle={
          collect
            ? collect.kind === "sale"
              ? `${collect.row.invoiceNo}${collect.row.customerName ? ` · ${collect.row.customerName}` : ""} · due ${fc(collect.row.due)}`
              : collect.kind === "supplier"
                ? `${collect.row.name} owes you ${fc(-collect.row.net)}`
                : `${collect.row.customerName ?? ""} ${collect.row.orderNumber ?? ""} · due ${fc(collect.row.due)}`
            : null
        }
        extra={
          collect?.kind === "supplier" ? (
            <Text style={fs.muted}>
              Records money in from the supplier and lowers their credit. Not collecting now? Their credit is already taken off what you pay
              them next.
            </Text>
          ) : null
        }
        defaultAmount={collectDue}
        maxAmount={collectDue}
        withReference={collect?.kind !== "tailor"}
        submitLabel="Record payment"
        onClose={() => setCollect(null)}
        onSubmit={submitCollect}
      />
    </SafeAreaView>
  );
}

function SplitBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={styles.splitBox}>
      <Text style={styles.splitLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.splitValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={fs.muted} numberOfLines={1}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sumHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sumLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  sumValue: { color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  split: { flexDirection: "row", gap: 8 },
  splitBox: { flex: 1, backgroundColor: "#f8fafc", borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 8, gap: 2 },
  splitLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  splitValue: { color: colors.text, fontSize: 13, fontWeight: "900" },
  agingBar: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#f1f5f9" },
  ageDot: { width: 8, alignSelf: "stretch", borderRadius: 4 },
});
