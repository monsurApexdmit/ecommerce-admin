import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { useLocalSearchParams } from "expo-router";
import { getInventoryCogs, getInventoryLedger, getInventoryReconciliation, getInventoryValuation } from "@/services/finance";
import type { FinanceInventoryReconciliation, FinanceCogs, FinanceMovement, FinanceMovementList, FinanceValuation, FinanceValuationGroup } from "@/types/finance";
import {
  Badge,
  Bar,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FinanceHeader,
  KeyValue,
  Kpi,
  KpiGrid,
  Loading,
  SearchBox,
  fmtShortDate,
  fs,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";
import { OpeningStockPanel, ReconciliationCard } from "@/components/finance/v2";

const PAGE_SIZE = 25;
type Tab = "valuation" | "opening" | "ledger";

const MOVE_TYPES: { value: string; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "opening", label: "Opening stock" },
  { value: "receive", label: "Receive" },
  { value: "sell", label: "Sale" },
  { value: "return", label: "Return" },
  { value: "transfer", label: "Transfer" },
  { value: "adjustment", label: "Adjustment" },
  { value: "damage", label: "Damage" },
];

const fmtQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function FinanceInventoryScreen() {
  const { canRead, canWrite } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);
  const [tab, setTab] = useState<Tab>(params.tab === "opening" || params.tab === "ledger" ? params.tab : "valuation");
  const [recon, setRecon] = useState<FinanceInventoryReconciliation | null>(null);

  // Valuation
  const [valuation, setValuation] = useState<FinanceValuation | null>(null);
  const [valLoading, setValLoading] = useState(true);
  const [valError, setValError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"location" | "category">("location");
  const [locationId, setLocationId] = useState<number | null>(null);
  const [locations, setLocations] = useState<FinanceValuationGroup[]>([]);

  // Ledger
  const { noteTimezone } = useFinanceFilters();
  const fq = useFinanceQuery({ withChannel: false });
  const [type, setType] = useState("all");
  const [direction, setDirection] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [list, setList] = useState<FinanceMovementList | null>(null);
  const [rows, setRows] = useState<FinanceMovement[]>([]);
  const [cogs, setCogs] = useState<FinanceCogs | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadValuation = useCallback(async (spinner = true) => {
    if (spinner) setValLoading(true);
    try {
      const [res, r] = await Promise.all([
        getInventoryValuation({ locationId: locationId ?? undefined }),
        getInventoryReconciliation().catch(() => null),
      ]);
      setValuation(res);
      setRecon(r);
      if (locationId === null) setLocations(res.byLocation.filter((l) => l.id !== null));
      setValError(null);
    } catch (err) {
      setValError(apiErrorMessage(err, "Could not load stock valuation."));
    } finally {
      setValLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void loadValuation();
  }, [loadValuation]);

  const query = useMemo(
    () => ({
      ...fq,
      type: type === "all" ? undefined : type,
      direction: direction === "all" ? undefined : direction,
      locationId: locationId ?? undefined,
      search: debounced || undefined,
      perPage: PAGE_SIZE,
    }),
    [fq, type, direction, locationId, debounced],
  );

  const loadLedger = useCallback(
    async (spinner = true) => {
      const id = ++reqId.current;
      if (spinner) setLoading(true);
      try {
        const [res, c] = await Promise.all([
          getInventoryLedger({ ...query, page: 1 }),
          getInventoryCogs({ ...fq, locationId: locationId ?? undefined }).catch(() => null),
        ]);
        if (id !== reqId.current) return;
        noteTimezone(res.meta?.tz);
        setList(res);
        setRows(res.data);
        setCogs(c);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, "Could not load inventory movements."));
        setRows([]);
        setList(null);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [query, fq, locationId, noteTimezone],
  );

  useEffect(() => {
    if (tab === "ledger") void loadLedger();
  }, [loadLedger, tab]);

  if (!canRead("Finance")) return <AccessDenied />;

  const loadMore = async () => {
    if (tab !== "ledger" || !list || loading || loadingMore || list.page >= list.totalPages) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await getInventoryLedger({ ...query, page: list.page + 1 });
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
    await (tab === "ledger" ? loadLedger(false) : loadValuation(false));
    setRefreshing(false);
  };

  const groups: FinanceValuationGroup[] = (groupBy === "location" ? valuation?.byLocation : valuation?.byCategory) ?? [];
  const groupMax = Math.max(1, ...groups.map((g) => g.costValue));

  const tabs = (
    <ChipRow style={{ paddingTop: 10 }}>
      <Chip label="Stock valuation" active={tab === "valuation"} onPress={() => setTab("valuation")} icon="cube-outline" />
      <Chip label="Opening stock" active={tab === "opening"} onPress={() => setTab("opening")} icon="enter-outline" />
      <Chip label="History" active={tab === "ledger"} onPress={() => setTab("ledger")} icon="list-outline" />
    </ChipRow>
  );

  const locationChips =
    locations.length > 1 || locationId !== null ? (
      <ChipRow>
        <Chip label="All locations" active={locationId === null} onPress={() => setLocationId(null)} icon="location-outline" />
        {locations.map((l) => (
          <Chip key={l.id!} label={l.name} active={locationId === l.id} onPress={() => setLocationId(l.id)} />
        ))}
      </ChipRow>
    ) : null;

  const valuationHeader = (
    <View style={{ gap: 8, paddingBottom: 8 }}>
      {tabs}
      {locationChips}
      {valLoading && !valuation ? (
        <Loading />
      ) : valError && !valuation ? (
        <EmptyState error title="Couldn't load valuation" text={valError} onRetry={() => void loadValuation()} />
      ) : valuation ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <KpiGrid>
            <Kpi label="Value at cost" value={fc(valuation.totals.costValue)} icon="pricetag-outline" tone="info" />
            <Kpi label="Value at price" value={fc(valuation.totals.retailValue)} icon="storefront-outline" tone="in" />
            <Kpi
              label="Potential profit"
              value={fc(valuation.totals.potentialProfit)}
              icon="trending-up-outline"
              tone="warn"
              hint={valuation.totals.marginPct !== null ? `${valuation.totals.marginPct.toFixed(1)}% margin` : null}
            />
            <Kpi label="Units in stock" value={fmtQty(valuation.totals.units)} icon="cube-outline" hint={`${valuation.totals.productCount} products`} />
          </KpiGrid>
          {recon ? (
            <ReconciliationCard
              data={recon}
              canWrite={canWrite("Finance")}
              onMoveIn={() => setTab("opening")}
              onChanged={() => void loadValuation(false)}
            />
          ) : null}
          <Card>
            <View style={styles.groupHead}>
              <Text style={styles.cardTitle}>By {groupBy}</Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Chip label="Location" active={groupBy === "location"} onPress={() => setGroupBy("location")} />
                <Chip label="Category" active={groupBy === "category"} onPress={() => setGroupBy("category")} />
              </View>
            </View>
            {groups.length === 0 ? (
              <Text style={fs.muted}>No stock on hand.</Text>
            ) : (
              groups.map((g, i) => (
                <View key={`${g.id ?? "none"}-${i}`} style={{ gap: 4 }}>
                  <View style={styles.groupRow}>
                    <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.groupValue}>{fc(g.costValue)}</Text>
                  </View>
                  <Bar ratio={g.costValue / groupMax} color={colors.info} />
                  <Text style={fs.muted}>
                    {fmtQty(g.units)} units · at price {fc(g.retailValue)} · profit {fc(g.potentialProfit)}
                  </Text>
                </View>
              ))
            )}
          </Card>
        </View>
      ) : null}
    </View>
  );

  const ledgerHeader = (
    <View style={{ gap: 6, paddingBottom: 8 }}>
      {tabs}
      <SearchBox value={search} onChange={setSearch} placeholder="Search product, SKU, reference…" />
      <FinanceFilterBar showChannel={false} />
      {locationChips}
      <ChipRow>
        <Chip label="In & out" active={direction === "all"} onPress={() => setDirection("all")} />
        <Chip label="Stock in" active={direction === "in"} onPress={() => setDirection("in")} icon="arrow-down" />
        <Chip label="Stock out" active={direction === "out"} onPress={() => setDirection("out")} icon="arrow-up" />
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
        {MOVE_TYPES.map((t) => (
          <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
        ))}
      </ChipRow>
      {cogs ? (
        <View style={{ paddingHorizontal: 16 }}>
          <Card>
            <KeyValue label="Cost of goods sold" value={fc(cogs.totals.cogs)} tone="out" bold />
            <KeyValue label="Revenue" value={fc(cogs.totals.revenue)} />
            <KeyValue
              label={`Gross profit${cogs.totals.marginPct !== null ? ` (${cogs.totals.marginPct.toFixed(1)}%)` : ""}`}
              value={fc(cogs.totals.grossProfit)}
              tone={cogs.totals.grossProfit >= 0 ? "in" : "out"}
            />
            <Text style={fs.muted}>{fmtQty(cogs.totals.units)} units sold in {cogs.totals.orders} orders</Text>
          </Card>
        </View>
      ) : null}
      {list?.totals ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>In · {fmtQty(list.totals.qtyIn)}</Text>
            <Text style={[fs.totalValue, { color: colors.primaryDark }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.valueIn)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Out · {fmtQty(list.totals.qtyOut)}</Text>
            <Text style={[fs.totalValue, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.valueOut)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Movements</Text>
            <Text style={fs.totalValue}>{list.totals.count}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader title="Inventory & ledger" subtitle="Stock value, opening stock, history" />
      <FlatList
        data={tab === "ledger" && !loading ? rows : []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          tab === "valuation" ? (
            valuationHeader
          ) : tab === "opening" ? (
            <View style={{ gap: 8, paddingBottom: 8 }}>
              {tabs}
              <OpeningStockPanel canWrite={canWrite("Finance")} onPosted={() => void loadValuation(false)} />
            </View>
          ) : (
            ledgerHeader
          )
        }
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        renderItem={({ item }) => {
          const isIn = item.qtyIn > 0;
          return (
            <View style={{ paddingHorizontal: 16 }}>
              <View style={fs.rowCard}>
                <View style={[fs.dirIcon, { backgroundColor: isIn ? "#dcfce7" : "#fee2e2" }]}>
                  <Ionicons name={isIn ? "arrow-down" : "arrow-up"} size={16} color={isIn ? colors.primaryDark : colors.danger} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[fs.rowTitle, { flexShrink: 1 }]} numberOfLines={1}>
                      {item.productName}
                      {item.variantName ? ` · ${item.variantName}` : ""}
                    </Text>
                    {item.isOpening ? <Badge label="Opening" color="#1d4ed8" bg="#dbeafe" /> : null}
                    {item.backfilled ? <Badge label="Backfilled" color={colors.muted} bg="#f1f5f9" /> : null}
                  </View>
                  <Text style={fs.rowMeta} numberOfLines={1}>
                    {[item.typeLabel, item.referenceLabel, item.locationName].filter(Boolean).join(" · ")}
                  </Text>
                  <Text style={fs.rowMeta} numberOfLines={1}>
                    {[fmtShortDate(item.date), item.sku, `@ ${fc(item.unitCost)}`, item.reason].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 2 }}>
                  <Text style={isIn ? fs.amountIn : fs.amountOut}>
                    {isIn ? "+" : "−"}{fmtQty(isIn ? item.qtyIn : item.qtyOut)}
                  </Text>
                  <Text style={fs.rowMeta}>{fc(item.value)}</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={fs.footer} /> : null}
        ListEmptyComponent={
          tab !== "ledger" ? null : loading ? (
            <Loading />
          ) : error ? (
            <EmptyState error title="Couldn't load movements" text={error} onRetry={() => void loadLedger()} />
          ) : (
            <EmptyState icon="list-outline" title="No movements" text="No stock movements match these filters." />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  groupRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  groupName: { color: colors.text, fontSize: 13, fontWeight: "700", flex: 1 },
  groupValue: { color: colors.text, fontSize: 13, fontWeight: "800" },
});
