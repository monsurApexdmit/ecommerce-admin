import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/constants/theme";
import { useAuth } from "@/context/AuthContext";
import { useCurrency } from "@/context/CurrencyContext";
import { AccessDenied } from "@/components/AccessDenied";
import { apiErrorMessage } from "@/lib/format";
import { useLocalSearchParams } from "expo-router";
import {
  getFinancePayoutSummary,
  getFinancePayouts,
  getPayableParty,
  getPayablesSummary,
  payDorji,
  paySalary,
  paySupplierDue,
} from "@/services/finance";
import type {
  FinancePartyType,
  FinancePayableParty,
  FinancePayablesSummary,
  FinancePayout,
  FinancePayoutList,
  FinancePayoutSummary,
} from "@/types/finance";
import {
  Badge,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  FinanceHeader,
  KeyValue,
  Loading,
  SearchBox,
  fmtDate,
  fmtShortDate,
  fs,
  NowTag,
  todayIso,
} from "@/components/finance/ui";
import { FinanceFilterBar, useFinanceFilters, useFinanceQuery } from "@/components/finance/filters";
import { PaymentSheet, type PaymentSheetValues } from "@/components/finance/forms";
import { PayableBreakdown } from "@/components/finance/v2";

const PAGE_SIZE = 25;

type Group = "supplier" | "salary" | "dorji";

const TYPE_TONES: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  supplier: { color: "#b45309", bg: "#fef3c7", icon: "storefront-outline" },
  salary: { color: "#7c3aed", bg: "#ede9fe", icon: "people-outline" },
  dorji: { color: "#0e7490", bg: "#cffafe", icon: "cut-outline" },
};

const PARTY_TONES: Record<FinancePartyType, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  supplier: TYPE_TONES.supplier,
  staff: TYPE_TONES.salary,
  dorji: TYPE_TONES.dorji,
};

type PayTarget = {
  group: Group;
  /** vendorId / salaryPaymentId / dorjiId — what the pay endpoint takes. */
  id: number;
  name: string;
  amount: number;
  subtitle: string;
  party: FinancePayableParty | null;
};

/** Older backend without /payouts/payable: derive payable-now from the v1 summary. */
function partiesFromV1(summary: FinancePayoutSummary, today: string): FinancePayablesSummary {
  const party = (type: FinancePartyType, id: number, name: string, owed: number, notYetDue: number, nextDue: string | null): FinancePayableParty => {
    const payableNow = owed - notYetDue;
    return {
      key: `${type}:${id}`, type, id, name, deleted: false, owed, notYetDue, credits: 0, payableNow,
      breakdown: [], nextDue: nextDue && notYetDue > 0 ? { date: nextDue, amount: notYetDue } : null,
      status: payableNow > 0 ? "payable" : "nothing_payable",
    };
  };
  const staff = new Map<number, { name: string; owed: number }>();
  summary.unpaidSalaries.rows.forEach((r) => {
    const cur = staff.get(r.staffId) ?? { name: r.name, owed: 0 };
    cur.owed += r.net;
    staff.set(r.staffId, cur);
  });
  const parties: FinancePayableParty[] = [
    ...summary.supplierDues.rows.map((r) =>
      party("supplier", r.vendorId, r.name, r.due, r.dueDate && r.dueDate > today ? r.due : 0, r.dueDate),
    ),
    ...[...staff.entries()].map(([id, v]) => party("staff", id, v.name, v.owed, 0, null)),
    ...summary.dorjiOwed.rows.map((r) => party("dorji", r.dorjiId, r.name, r.owed, 0, null)),
  ];
  parties.sort((a, b) => b.payableNow - a.payableNow || b.owed - a.owed);
  const sum = (k: "owed" | "notYetDue" | "credits" | "payableNow") => parties.reduce((a, p) => a + p[k], 0);
  return {
    meta: { currency: null, channel: null, channelLabel: null, tz: null, asOf: null, currentState: true, channelScope: null },
    totals: { owed: sum("owed"), notYetDue: sum("notYetDue"), credits: sum("credits"), payableNow: sum("payableNow"), theyOweYou: 0, parties: parties.length },
    parties,
  };
}

export default function FinancePayoutsScreen() {
  const { canRead, canWrite } = useAuth();
  const { formatCurrency } = useCurrency();
  const fc = (n: number) => formatCurrency(n);

  const params = useLocalSearchParams<{ type?: string; id?: string; create?: string }>();
  const [summary, setSummary] = useState<FinancePayablesSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [group, setGroup] = useState<"all" | FinancePartyType>(
    params.type === "supplier" || params.type === "staff" || params.type === "dorji" ? params.type : "all",
  );
  const [opening, setOpening] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const deepLinkDone = useRef(false);

  const { noteTimezone } = useFinanceFilters();
  const fq = useFinanceQuery({ withChannel: false });
  const [type, setType] = useState<"all" | Group>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [list, setList] = useState<FinancePayoutList | null>(null);
  const [rows, setRows] = useState<FinancePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadSummary = useCallback(async () => {
    try {
      const res = await getPayablesSummary().catch(async (err) => {
        // Older backend without per-party payable: derive it from the v1 summary.
        if ((err as any)?.response?.status !== 404) throw err;
        return partiesFromV1(await getFinancePayoutSummary(), todayIso());
      });
      noteTimezone(res.meta.tz);
      setSummary(res);
      setSummaryError(null);
    } catch (err) {
      setSummaryError(apiErrorMessage(err, "Could not load amounts to pay."));
    }
  }, [noteTimezone]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // PO-4: /finance/payouts?type=supplier&id=5&create=1 opens Pay pre-filled.
  useEffect(() => {
    if (deepLinkDone.current || !summary || params.create !== "1" || !params.id) return;
    deepLinkDone.current = true;
    const t = params.type === "salary" ? "staff" : params.type ?? "supplier";
    const party = summary.parties.find((p) => p.type === t && String(p.id) === String(params.id));
    if (!party) {
      Alert.alert("Nothing owed", "There is no open balance for this payee.");
      return;
    }
    void openPay(party);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, params.create, params.id, params.type]);

  const query = useMemo(
    () => ({ ...fq, type: type === "all" ? undefined : type, search: debounced || undefined, perPage: PAGE_SIZE }),
    [fq, type, debounced],
  );

  const load = useCallback(
    async (spinner = true) => {
      const id = ++reqId.current;
      if (spinner) setLoading(true);
      try {
        const res = await getFinancePayouts({ ...query, page: 1 });
        if (id !== reqId.current) return;
        setList(res);
        setRows(res.data);
        setError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        setError(apiErrorMessage(err, "Could not load payouts."));
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
      const res = await getFinancePayouts({ ...query, page: list.page + 1 });
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

  const canPay = (g: Group) =>
    g === "supplier" ? canWrite("Dues") : g === "salary" ? canWrite("Salary Management") : canWrite("TailorPayments");

  async function openPay(party: FinancePayableParty) {
    if (party.type === "staff") {
      // Staff are paid per payslip: pay the oldest payslip of an ended month.
      setOpening(true);
      try {
        const detail = await getPayableParty("staff", party.id);
        const slip = detail.documents.filter((d) => !d.notYetDue && d.due > 0).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))[0];
        if (!slip) {
          Alert.alert("Nothing payable yet", "This month's payslip can be paid once the month ends.");
          return;
        }
        setPayTarget({
          group: "salary",
          id: slip.documentId,
          name: party.name,
          amount: slip.due,
          subtitle: `${party.name} · ${slip.label ?? slip.no ?? "Payslip"} · ${fc(slip.due)}`,
          party,
        });
      } catch (err) {
        Alert.alert("Couldn't load payslips", apiErrorMessage(err));
      } finally {
        setOpening(false);
      }
      return;
    }
    setPayTarget({
      group: party.type === "dorji" ? "dorji" : "supplier",
      id: party.id,
      name: party.name,
      amount: party.payableNow > 0 ? party.payableNow : party.owed,
      subtitle: `${party.name} · payable now ${fc(party.payableNow)}`,
      party,
    });
  }

  const submitPay = async (v: PaymentSheetValues) => {
    if (!payTarget) return;
    if (payTarget.group === "supplier") {
      await paySupplierDue(payTarget.id, { amount: v.amount, method: v.method, date: v.date, reference: v.reference, notes: v.notes });
    } else if (payTarget.group === "salary") {
      await paySalary(payTarget.id, { method: v.method, date: v.date });
    } else {
      await payDorji(payTarget.id, {
        amount: v.amount,
        method: v.method,
        date: v.date,
        reference: v.reference,
        notes: v.notes,
        expectedBalance: payTarget.party?.owed ?? payTarget.amount,
      });
    }
    setPayTarget(null);
    Alert.alert("Payment recorded", `${fc(v.amount || payTarget.amount)} paid to ${payTarget.name}.`);
    void Promise.all([load(false), loadSummary()]);
  };

  const shown = (summary?.parties ?? []).filter((p) => group === "all" || p.type === group);
  const payable = shown.filter((p) => p.payableNow > 0.004);
  const nothing = shown.filter((p) => p.payableNow <= 0.004);
  const groupTotal = (g: FinancePartyType) => (summary?.parties ?? []).filter((p) => p.type === g).reduce((a, p) => a + p.payableNow, 0);

  const renderParty = (p: FinancePayableParty, i: number) => {
    const tone = PARTY_TONES[p.type] ?? TYPE_TONES.supplier;
    const zero = p.payableNow <= 0.004;
    const open = expanded === p.key;
    const can = canPay(p.type === "staff" ? "salary" : p.type);
    return (
      <View key={p.key} style={[styles.oweRow, i > 0 && styles.oweBorder, zero && { opacity: 0.6 }]}>
        <Pressable style={styles.oweMain} onPress={() => setExpanded(open ? null : p.key)}>
          <View style={[styles.partyIcon, { backgroundColor: tone.bg }]}>
            <Ionicons name={tone.icon} size={14} color={tone.color} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={fs.rowTitle} numberOfLines={1}>{p.name}</Text>
              {p.status === "they_owe_you" ? <Badge label="They owe you" color="#1d4ed8" bg="#dbeafe" /> : null}
            </View>
            <Text style={fs.rowMeta} numberOfLines={1}>
              Owed {fc(p.owed)}
              {p.notYetDue ? ` · ${fc(p.notYetDue)} not yet due` : ""}
              {p.credits ? ` · credits ${fc(p.credits)}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[fs.amount, zero && { color: colors.muted }]}>{fc(p.payableNow)}</Text>
            <Text style={fs.muted}>payable now</Text>
          </View>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
        </Pressable>
        {open ? (
          <View style={{ gap: 8, paddingTop: 8 }}>
            <PayableBreakdown party={p} />
            {can ? (
              <Pressable
                style={[fs.smallBtn, styles.payBtn, zero && { backgroundColor: "#94a3b8" }]}
                disabled={zero || opening}
                onPress={() => void openPay(p)}
              >
                <Text style={fs.smallBtnText}>{zero ? "Nothing payable yet" : `Pay ${fc(p.payableNow)}`}</Text>
              </Pressable>
            ) : null}
            {zero && p.nextDue ? (
              <Text style={fs.muted}>{fc(p.nextDue.amount)} becomes payable on {fmtDate(p.nextDue.date)}.</Text>
            ) : null}
            {p.status === "they_owe_you" ? (
              <Text style={fs.muted}>Their credits are more than you owe. Collect it under Receivables → Suppliers.</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const header = (
    <View style={{ gap: 10, paddingBottom: 8 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
        <Card>
          <View style={styles.sumHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sumLabel}>Payable now</Text>
              <Text style={styles.sumValue}>{summary ? fc(summary.totals.payableNow) : "—"}</Text>
              {summary ? (
                <Text style={fs.muted}>
                  Owed {fc(summary.totals.owed)}
                  {summary.totals.notYetDue ? ` · not yet due ${fc(summary.totals.notYetDue)}` : ""}
                  {summary.totals.credits ? ` · credits ${fc(summary.totals.credits)}` : ""}
                </Text>
              ) : null}
            </View>
            <NowTag />
          </View>
          {summaryError ? <Text style={{ color: colors.danger, fontSize: 12 }}>{summaryError}</Text> : null}
          <ChipRow style={{ paddingHorizontal: 0 }}>
            <Chip label="Everyone" active={group === "all"} onPress={() => setGroup("all")} />
            <Chip label={`Suppliers · ${fc(groupTotal("supplier"))}`} active={group === "supplier"} onPress={() => setGroup("supplier")} />
            <Chip label={`Staff · ${fc(groupTotal("staff"))}`} active={group === "staff"} onPress={() => setGroup("staff")} />
            <Chip label={`Dorji · ${fc(groupTotal("dorji"))}`} active={group === "dorji"} onPress={() => setGroup("dorji")} />
          </ChipRow>
          {summary ? (
            shown.length === 0 ? (
              <Text style={fs.muted}>Nothing owed here.</Text>
            ) : (
              <>
                {payable.map(renderParty)}
                {nothing.length > 0 ? (
                  <>
                    <Text style={styles.nothingHead}>Nothing payable · {nothing.length}</Text>
                    {nothing.map(renderParty)}
                  </>
                ) : null}
              </>
            )
          ) : !summaryError ? (
            <ActivityIndicator color={colors.primaryDark} />
          ) : null}
        </Card>
        <Text style={styles.sectionTitle}>Paid out</Text>
      </View>
      <SearchBox value={search} onChange={setSearch} placeholder="Search payee, reference…" />
      <FinanceFilterBar showChannel={false} />
      <ChipRow>
        <Chip label="All" active={type === "all"} onPress={() => setType("all")} />
        <Chip label="Suppliers" active={type === "supplier"} onPress={() => setType("supplier")} />
        <Chip label="Salaries" active={type === "salary"} onPress={() => setType("salary")} />
        <Chip label="Dorji" active={type === "dorji"} onPress={() => setType("dorji")} />
      </ChipRow>
      {list ? (
        <View style={fs.totalsBar}>
          <View style={fs.totalBox}>
            <Text style={fs.totalLabel}>Total paid · {list.totals.count}</Text>
            <Text style={[fs.totalValue, { color: colors.danger }]} numberOfLines={1}>{fc(list.totals.total)}</Text>
          </View>
          {(["supplier", "salary", "dorji"] as const).map((k) => (
            <View key={k} style={fs.totalBox}>
              <Text style={fs.totalLabel}>{k}</Text>
              <Text style={fs.totalValue} numberOfLines={1} adjustsFontSizeToFit>{fc(list.totals.byType[k] ?? 0)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={fs.safe} edges={["top", "bottom"]}>
      <FinanceHeader title="Payouts" subtitle="Suppliers, salaries, dorji" />
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
        renderItem={({ item }) => {
          const tone = TYPE_TONES[item.type] ?? TYPE_TONES.supplier;
          return (
            <View style={{ paddingHorizontal: 16 }}>
              <Pressable
                style={fs.rowCard}
                onPress={() =>
                  Alert.alert(
                    item.typeLabel,
                    [
                      `${item.payee ?? "—"} · ${fc(item.amount)}`,
                      `Date: ${fmtDate(item.date)}`,
                      item.accountName ? `Account: ${item.accountName}` : null,
                      item.methodLabel ? `Method: ${item.methodLabel}` : null,
                      item.reference ? `Reference: ${item.reference}` : null,
                      item.note && item.note !== item.reference ? `Note: ${item.note}` : null,
                    ]
                      .filter(Boolean)
                      .join("\n"),
                  )
                }
              >
                <View style={[fs.dirIcon, { backgroundColor: tone.bg }]}>
                  <Ionicons name={tone.icon} size={17} color={tone.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={fs.rowTitle} numberOfLines={1}>{item.payee ?? "—"}</Text>
                  <Text style={fs.rowMeta} numberOfLines={1}>
                    {[item.typeLabel, item.reference].filter(Boolean).join(" · ")}
                  </Text>
                  <Text style={fs.rowMeta} numberOfLines={1}>
                    {[fmtShortDate(item.date), item.accountName, item.methodLabel].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                <Text style={fs.amountOut}>−{fc(item.amount)}</Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primaryDark} style={fs.footer} /> : null}
        ListEmptyComponent={
          loading ? (
            <Loading />
          ) : error ? (
            <EmptyState error title="Couldn't load payouts" text={error} onRetry={() => void load()} />
          ) : (
            <EmptyState icon="arrow-up-circle-outline" title="No payouts" text="Supplier, salary and dorji payments will appear here." />
          )
        }
      />

      <PaymentSheet
        visible={payTarget !== null}
        title={payTarget?.group === "supplier" ? "Pay supplier" : payTarget?.group === "salary" ? "Pay salary" : "Pay dorji"}
        subtitle={payTarget?.subtitle}
        extra={payTarget?.party ? <PayableBreakdown party={payTarget.party} /> : null}
        defaultAmount={payTarget?.amount}
        maxAmount={payTarget?.group === "salary" ? undefined : payTarget?.party?.owed ?? payTarget?.amount}
        withAmount={payTarget?.group !== "salary"}
        withReference={payTarget?.group !== "salary"}
        submitLabel="Record payment"
        onClose={() => setPayTarget(null)}
        onSubmit={submitPay}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sumHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sumLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  sumValue: { color: colors.text, fontSize: 24, fontWeight: "900", letterSpacing: -0.4 },
  groupRow: { flexDirection: "row", gap: 8 },
  groupBox: {
    flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 10, gap: 2, backgroundColor: "#f8fafc",
  },
  groupBoxActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  groupLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  groupAmount: { color: colors.text, fontSize: 14, fontWeight: "900" },
  oweRow: { paddingVertical: 8 },
  oweBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  oweMain: { flexDirection: "row", alignItems: "center", gap: 10 },
  partyIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  payBtn: { alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 8 },
  nothingHead: { color: colors.muted, fontSize: 11, fontWeight: "800", textTransform: "uppercase", marginTop: 6 },
  breakdown: { gap: 6, backgroundColor: "#f8fafc", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
});
