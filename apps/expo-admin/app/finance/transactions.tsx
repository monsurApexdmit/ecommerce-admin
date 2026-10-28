import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { deleteFinanceEntry, deleteFinanceTransfer, getFinanceAccounts, getFinanceTransactions } from "@/services/finance";
import type { FinanceAccount, FinanceDirection, FinanceTransaction, FinanceTransactionList } from "@/types/finance";
import {
  Chip,
  ChipRow,
  EmptyState,
  FinanceHeader,
  HeaderButton,
  Loading,
  SearchBox,
  fmtDate,
  fs,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";
import { TransactionRow } from "@/components/finance/TransactionRow";
import { EntrySheet, TransferSheet } from "@/components/finance/forms";

const PAGE_SIZE = 25;

const SOURCES: { value: string; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "sale", label: "Sales" },
  { value: "cod", label: "COD" },
  { value: "tailor_payment", label: "Tailor" },
  { value: "refund", label: "Refunds" },
  { value: "supplier_payment", label: "Suppliers" },
  { value: "supplier_refund", label: "Supplier refunds" },
  { value: "expense", label: "Expenses" },
  { value: "expense_void", label: "Voided expenses" },
  { value: "salary", label: "Salary" },
  { value: "dorji_payout", label: "Dorji" },
  { value: "manual", label: "Manual" },
  { value: "transfer", label: "Transfers" },
];

export default function FinanceTransactionsScreen() {
  const params = useLocalSearchParams<{ accountId?: string; direction?: string; sourceType?: string }>();
  const { canRead, canWrite, canDelete } = useAuth();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);

  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const filterQuery = useFinanceQuery();
  const { noteTimezone } = useFinanceFilters();
  const [accountId, setAccountId] = useState<number | null>(params.accountId ? Number(params.accountId) || null : null);
  const [direction, setDirection] = useState<FinanceDirection | "all">(
    params.direction === "in" || params.direction === "out" ? params.direction : "all",
  );
  const [source, setSource] = useState<string>(params.sourceType ?? "all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  const [list, setList] = useState<FinanceTransactionList | null>(null);
  const [rows, setRows] = useState<FinanceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const [entrySheet, setEntrySheet] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });
  const [transferSheet, setTransferSheet] = useState<{ open: boolean; id: number | null }>({ open: false, id: null });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await getFinanceAccounts();
      setAccounts(res.accounts);
    } catch {
      // filters just won't list accounts
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  const query = useMemo(
    () => ({
      ...filterQuery,
      accountId: accountId ?? undefined,
      direction: direction === "all" ? undefined : direction,
      sourceType: source === "all" ? undefined : source,
      search: debounced || undefined,
      perPage: PAGE_SIZE,
    }),
    [filterQuery, accountId, direction, source, debounced],
  );

  const load = useCallback(
    async (spinner = true) => {
      const id = ++reqId.current;
      if (spinner) setLoading(true);
      try {
        const res = await getFinanceTransactions({ ...query, page: 1 });
        if (id !== reqId.current) return;
        noteTimezone(res.meta?.tz);
        setList(res);
        setRows(res.data);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, "Could not load transactions."));
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

  if (!canRead("Finance")) return <AccessDenied />;

  const loadMore = async () => {
    if (!list || loading || loadingMore || list.page >= list.totalPages) return;
    setLoadingMore(true);
    const id = reqId.current;
    try {
      const res = await getFinanceTransactions({ ...query, page: list.page + 1 });
      if (id !== reqId.current) return;
      setRows((prev) => [...prev, ...res.data.filter((r) => !prev.some((p) => p.id === r.id))]);
      setList((cur) => (cur ? { ...cur, page: res.page, totalPages: res.totalPages, total: res.total } : res));
    } catch {
      // keep what we have
    } finally {
      setLoadingMore(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([load(false), loadAccounts()]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const onSaved = () => {
    setEntrySheet({ open: false, id: null });
    setTransferSheet({ open: false, id: null });
    void refreshAll();
  };

  const confirmDelete = (row: FinanceTransaction) => {
    const isTransfer = row.transferId !== null;
    Alert.alert(isTransfer ? "Delete transfer" : "Delete entry", "This removes it from the ledger and account balances.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            if (isTransfer) await deleteFinanceTransfer(row.transferId!);
            else if (row.entryId) await deleteFinanceEntry(row.entryId);
            void refreshAll();
          } catch (err) {
            Alert.alert("Delete failed", apiErrorMessage(err));
          }
        },
      },
    ]);
  };

  const openRow = (row: FinanceTransaction) => {
    const lines = [
      `${row.direction === "in" ? "Money in" : "Money out"} · gross ${row.gross < 0 ? "−" : ""}${fc(Math.abs(row.gross))}`,
      `Fee ${fc(row.fee)} · net ${row.net < 0 ? "−" : ""}${fc(Math.abs(row.net))}`,
      row.channel ? `Channel: ${row.channel === "pos" ? "POS" : row.channel === "online" ? "Online store" : "Manual"}` : null,
      `Date: ${fmtDate(row.date)}`,
      row.accountName ? `Account: ${row.accountName}` : null,
      row.methodLabel ? `Method: ${row.methodLabel}` : null,
      row.party ? `Party: ${row.party}` : null,
      row.reference ? `Reference: ${row.reference}` : null,
      row.category ? `Category: ${row.category}` : null,
      row.note ? `Note: ${row.note}` : null,
      row.runningBalance !== null ? `Balance after: ${fc(row.runningBalance)}` : null,
    ].filter(Boolean) as string[];
    const actions: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
    if (row.editable && canWrite("Finance")) {
      actions.push({
        text: "Edit",
        onPress: () =>
          row.transferId !== null
            ? setTransferSheet({ open: true, id: row.transferId })
            : setEntrySheet({ open: true, id: row.entryId }),
      });
    }
    if (row.editable && canDelete("Finance") && (row.entryId || row.transferId)) {
      actions.push({ text: "Delete", style: "destructive", onPress: () => confirmDelete(row) });
    }
    actions.push({ text: "Close", style: "cancel" });
    Alert.alert(row.sourceLabel || "Transaction", lines.join("\n"), actions);
  };

  const selectedAccount = list?.account ?? accounts.find((a) => a.id === accountId) ?? null;

  const header = (
    <View style={{ gap: 6, paddingBottom: 8 }}>
      <SearchBox value={search} onChange={setSearch} placeholder="Search party, reference, note…" />
      <FinanceFilterBar currencyCode={list?.meta?.currency?.code} />
      <ChipRow>
        <Chip label="All accounts" active={accountId === null} onPress={() => setAccountId(null)} icon="wallet-outline" />
        {accounts.map((a) => (
          <Chip key={a.id} label={a.name} active={accountId === a.id} onPress={() => setAccountId(a.id)} />
        ))}
      </ChipRow>
      <ChipRow>
        <Chip label="In & out" active={direction === "all"} onPress={() => setDirection("all")} />
        <Chip label="Money in" active={direction === "in"} onPress={() => setDirection("in")} icon="arrow-down" />
        <Chip label="Money out" active={direction === "out"} onPress={() => setDirection("out")} icon="arrow-up" />
        <View style={{ width: 1, backgroundColor: colors.border, marginHorizontal: 2 }} />
        {SOURCES.map((s) => (
          <Chip key={s.value} label={s.label} active={source === s.value} onPress={() => setSource(s.value)} />
        ))}
      </ChipRow>

      {list ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>In</Text>
            <Text style={[fs.totalValue, { color: colors.primaryDark }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.moneyIn)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Out</Text>
            <Text style={[fs.totalValue, { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.moneyOut)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Gross</Text>
            <Text style={[fs.totalValue, (list.totals.gross ?? list.totals.net) < 0 && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {fc(list.totals.gross ?? list.totals.net)}
            </Text>
          </View>
        </View>
      ) : null}
      {list && list.totals.fees !== null ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Fees</Text>
            <Text style={[fs.totalValue, { color: colors.warning }]} numberOfLines={1} adjustsFontSizeToFit>−{fc(list.totals.fees)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Net after fees</Text>
            <Text style={[fs.totalValue, (list.totals.netAfterFees ?? 0) < 0 && { color: colors.danger }]} numberOfLines={1} adjustsFontSizeToFit>
              {fc(list.totals.netAfterFees ?? list.totals.net)}
            </Text>
          </View>
        </View>
      ) : null}
      {list && selectedAccount && list.openingBalance !== null ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>{selectedAccount.name} opening</Text>
            <Text style={fs.totalValue} numberOfLines={1} adjustsFontSizeToFit>{fc(list.openingBalance)}</Text>
          </View>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Closing</Text>
            <Text style={fs.totalValue} numberOfLines={1} adjustsFontSizeToFit>{fc(list.closingBalance ?? 0)}</Text>
          </View>
        </View>
      ) : null}
      {list ? <Text style={[fs.muted, { paddingHorizontal: 18 }]}>{list.totals.count} transaction{list.totals.count === 1 ? "" : "s"}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader
        title="Transactions"
        subtitle="Gross, fee and net of every money movement"
        right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <HeaderButton icon="wallet-outline" tone="plain" onPress={() => router.push("/finance/accounts" as any)} />
            {canWrite("Finance") ? (
              <>
                <HeaderButton icon="swap-horizontal" tone="plain" onPress={() => setTransferSheet({ open: true, id: null })} />
                <HeaderButton icon="add" onPress={() => setEntrySheet({ open: true, id: null })} />
              </>
            ) : null}
          </View>
        }
      />

      <FlatList
        data={loading ? [] : rows}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaryDark} />}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <TransactionRow item={item} onPress={() => openRow(item)} showBalance={accountId !== null} showFee />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={fs.footer} /> : null}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <EmptyState error title="Couldn't load transactions" text={error} onRetry={() => void load()} />
          ) : (
            <View>
              <EmptyState
                icon="swap-vertical-outline"
                title="No transactions"
                text={search || source !== "all" || direction !== "all" || accountId ? "Try different filters." : "Money movements will appear here."}
              />
              {canWrite("Finance") ? (
                <Pressable
                  style={[fs.linkBtn, { alignSelf: "center", marginTop: 12 }]}
                  onPress={() => setEntrySheet({ open: true, id: null })}
                >
                  <Ionicons name="add" size={16} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontWeight: "800" }}>Add entry</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      <EntrySheet
        visible={entrySheet.open}
        entryId={entrySheet.id}
        accounts={accounts}
        defaultAccountId={accountId}
        onClose={() => setEntrySheet({ open: false, id: null })}
        onSaved={onSaved}
      />
      <TransferSheet
        visible={transferSheet.open}
        transferId={transferSheet.id}
        accounts={accounts}
        onClose={() => setTransferSheet({ open: false, id: null })}
        onSaved={onSaved}
      />
    </SafeAreaView>
  );
}
