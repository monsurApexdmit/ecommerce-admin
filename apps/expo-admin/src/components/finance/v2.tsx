import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { apiErrorMessage, apiFieldErrors } from "@/lib/format";
import {
  backfillSaleMovements,
  closeMonth,
  getCloseStatus,
  reopenMonth,
  getOpeningStockPreview,
  getProductsWithoutCost,
  postOpeningStock,
} from "@/services/finance";
import type {
  FinanceCloseStatus,
  FinanceHealth,
  FinanceInventoryReconciliation,
  FinanceOpeningStockPreview,
  FinanceOpeningStockRow,
  FinancePayableParty,
  FinanceProductWithoutCost,
  FinanceReconLine,
} from "@/types/finance";
import { Badge, Field, KeyValue, PrimaryButton, Sheet, fmtDate, fmtLongDate, fmtMonth, fmtShortDate, fs, isIsoDate, todayIso } from "./ui";

/** OV-1 "Set costs": products (with stock or sales) that have no cost price. */
export function ProductsWithoutCostSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { formatCurrency: fc } = useCurrency();
  const [rows, setRows] = useState<FinanceProductWithoutCost[]>([]);
  const [totals, setTotals] = useState<{ products: number; uncostedSales: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getProductsWithoutCost({ preset: "all_time", perPage: 50 })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotals(res.totals);
        setError(null);
      })
      .catch((err) => !cancelled && setError(apiErrorMessage(err, "Could not load products without a cost.")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Sheet visible={visible} title="Products without a cost" onClose={onClose}>
      {totals ? (
        <Text style={fs.muted}>
          {totals.products} product{totals.products === 1 ? "" : "s"} · {fc(totals.uncostedSales)} of sales without a cost (all time). Open a
          product to set its cost price.
        </Text>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primaryDark} /> : null}
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {!loading && !error && rows.length === 0 ? <Text style={fs.muted}>Every product has a cost.</Text> : null}
      {rows.map((p) => (
        <Pressable
          key={p.productId}
          style={st.row}
          onPress={() => {
            onClose();
            router.push(`/products/${p.productId}` as any);
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={fs.rowTitle} numberOfLines={1}>{p.name}</Text>
            <Text style={fs.rowMeta} numberOfLines={1}>
              {[p.sku, `${p.stock} in stock`, `${p.unitsSold} sold`, p.price ? `price ${fc(p.price)}` : null].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <Text style={[fs.amount, { color: colors.warning }]}>{fc(p.uncostedSales)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      ))}
    </Sheet>
  );
}

/** PO-2: owed → not yet due → credits → payable now (always adds up). */
export function PayableBreakdown({ party }: { party: FinancePayableParty }) {
  const { formatCurrency: fc } = useCurrency();
  const signed = (n: number) => (n < 0 ? `−${fc(Math.abs(n))}` : fc(n));
  const lines =
    party.breakdown.length > 0
      ? party.breakdown
      : [
          { key: "owed", label: "Owed", amount: party.owed },
          { key: "not_yet_due", label: "Not yet due", amount: -party.notYetDue },
          ...(party.type === "supplier" ? [{ key: "credits", label: "Credits they owe you", amount: -party.credits }] : []),
          { key: "payable_now", label: "Payable now", amount: party.payableNow },
        ];
  return (
    <View style={st.breakdown}>
      {lines.map((l) => {
        const total = l.key === "payable_now";
        const label =
          l.key === "not_yet_due" && party.nextDue && l.amount !== 0 ? `${l.label} (next due ${fmtShortDate(party.nextDue.date)})` : l.label;
        return (
          <View key={l.key} style={{ gap: 6 }}>
            {total ? <View style={fs.divider} /> : null}
            <KeyValue
              label={total ? `= ${label}` : label}
              value={signed(l.amount)}
              tone={total ? (l.amount > 0 ? "in" : "muted") : l.key === "owed" ? undefined : "muted"}
              bold={total}
            />
          </View>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: "800" },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 11, fontWeight: "800" },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  actionText: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  closeText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  outlineBtn: { borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 7 },
  monthRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  mathToggle: { flexDirection: "row", alignItems: "center", gap: 4 },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  openRow: {
    flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  costInput: {
    width: 100, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: "#f8fafc", paddingHorizontal: 10, color: colors.text, fontSize: 14, textAlign: "right",
  },
  breakdown: { gap: 6, backgroundColor: "#f8fafc", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: colors.border },
  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12,
  },
});

// ---------------------------------------------------------------------------
// INV-3: stock value vs movements, with "Show the math"
// ---------------------------------------------------------------------------

export function ReconciliationCard({
  data,
  canWrite,
  onMoveIn,
  onChanged,
}: {
  data: FinanceInventoryReconciliation;
  canWrite: boolean;
  onMoveIn: () => void;
  onChanged: () => void;
}) {
  const { formatCurrency: fc } = useCurrency();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ok = Math.abs(data.difference) < 0.005;

  const backfill = () => {
    Alert.alert(
      "Create missing sale movements",
      `${data.missingSaleMovements.lines} sale line${data.missingSaleMovements.lines === 1 ? "" : "s"} (${fc(
        data.missingSaleMovements.value,
      )}) have no stock movement. Create them now? Stock on hand does not change.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Create",
          onPress: async () => {
            setBusy(true);
            try {
              const res = await backfillSaleMovements(false);
              Alert.alert("Done", res.message ?? `${res.created} movements created.`);
              onChanged();
            } catch (err) {
              Alert.alert("Couldn't create movements", apiErrorMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const act = (line: FinanceReconLine) => {
    const t = line.action?.type;
    if (t === "move_in_opening_stock") onMoveIn();
    else if (t === "backfill_sale_movements") backfill();
    else if (t === "set_cost" && line.productId) router.push(`/products/${line.productId}` as any);
    else if (t === "adjust") router.push("/inventory" as any);
  };

  return (
    <View style={[st.card, !ok && { borderColor: "#fcd34d" }]}>
      <View style={st.head}>
        <Text style={st.title}>Stock value vs movements</Text>
        <View style={[st.pill, { backgroundColor: ok ? "#dcfce7" : "#fef3c7" }]}>
          <Text style={[st.pillText, { color: ok ? colors.primaryDark : "#92400e" }]}>{ok ? "Matches" : `Off by ${fc(Math.abs(data.difference))}`}</Text>
        </View>
      </View>
      <KeyValue label="Stock value (at cost)" value={fc(data.stockValue)} />
      <KeyValue label="Explained by stock movements" value={fc(data.movementValue)} />
      <View style={fs.divider} />
      <KeyValue label="Difference" value={fc(data.difference)} tone={ok ? "in" : "warn"} bold />
      {data.text ? <Text style={fs.muted}>{data.text}</Text> : null}
      {data.missingSaleMovements.lines > 0 && canWrite ? (
        <Pressable style={st.action} onPress={backfill} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.primaryDark} size="small" /> : <Ionicons name="construct-outline" size={14} color={colors.primaryDark} />}
          <Text style={st.actionText}>
            Create {data.missingSaleMovements.lines} missing sale movement{data.missingSaleMovements.lines === 1 ? "" : "s"}
          </Text>
        </Pressable>
      ) : null}
      {!ok ? (
        <Pressable style={st.mathToggle} onPress={() => setOpen((v) => !v)}>
          <Text style={st.actionText}>{open ? "Hide the math" : "Show the math"}</Text>
          <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.primaryDark} />
        </Pressable>
      ) : null}
      {open ? (
        <View style={{ gap: 8 }}>
          {data.byKind.map((k) => (
            <KeyValue key={k.kind} label={`${k.label} · ${k.count}`} value={fc(k.value)} />
          ))}
          {data.unexplained ? <KeyValue label="Not explained" value={fc(data.unexplained)} tone="out" /> : null}
          <View style={fs.divider} />
          {data.lines.slice(0, 30).map((l) => (
            <View key={l.key} style={st.line}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={fs.rowTitle} numberOfLines={1}>{l.name ?? l.label}</Text>
                <Text style={fs.rowMeta} numberOfLines={2}>{[l.label, l.explanation].filter(Boolean).join(" · ")}</Text>
                {l.action && canWrite ? (
                  <Pressable onPress={() => act(l)} hitSlop={6}>
                    <Text style={st.actionText}>{l.action.label}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={fs.amount}>{fc(l.value)}</Text>
            </View>
          ))}
          {data.lines.length > 30 ? <Text style={fs.muted}>Showing the 30 largest of {data.lines.length} lines.</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// INV-1: move in opening stock (preview → unit costs → cutover date → post)
// ---------------------------------------------------------------------------

export function OpeningStockPanel({ canWrite, onPosted }: { canWrite: boolean; onPosted: () => void }) {
  const { formatCurrency: fc } = useCurrency();
  const [preview, setPreview] = useState<FinanceOpeningStockPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [costs, setCosts] = useState<Record<number, string>>({});
  const [cutover, setCutover] = useState("");
  const [cutoverError, setCutoverError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getOpeningStockPreview();
      setPreview(res);
      setCutover((c) => c || res.cutoverDate || todayIso());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load opening stock."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const costOf = (r: FinanceOpeningStockRow): number | null => {
    const typed = costs[r.productId];
    if (typed !== undefined) {
      const n = Number(typed.replace(/,/g, "").trim());
      return Number.isFinite(n) && n >= 0.01 ? n : null;
    }
    return r.unitCost;
  };

  const rows = preview?.rows ?? [];
  const ready = rows.filter((r) => costOf(r) !== null);
  const readyValue = ready.reduce((a, r) => a + r.quantity * (costOf(r) ?? 0), 0);
  const stillNeed = rows.length - ready.length;

  const post = async () => {
    if (!isIsoDate(cutover)) {
      setCutoverError("Use YYYY-MM-DD.");
      return;
    }
    if (cutover > todayIso()) {
      setCutoverError("Cutover date cannot be in the future.");
      return;
    }
    setCutoverError(null);
    setPosting(true);
    try {
      const res = await postOpeningStock({
        cutoverDate: cutover,
        productIds: ready.map((r) => r.productId),
        items: ready.map((r) => ({ productId: r.productId, unitCost: costOf(r)! })),
        setProductCost: true,
      });
      Alert.alert(
        res.message ?? "Opening stock moved in",
        [
          `${res.posted} product${res.posted === 1 ? "" : "s"} · ${fc(res.value)}`,
          res.remaining ? `${res.remaining} still need a cost.` : null,
          res.skipped.filter((x) => x.reason === "already_moved_in").length
            ? `${res.skipped.filter((x) => x.reason === "already_moved_in").length} were already moved in.`
            : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      setCosts({});
      onPosted();
      void load();
    } catch (err) {
      const fe = apiFieldErrors(err);
      if (fe.cutoverDate) setCutoverError(fe.cutoverDate);
      else Alert.alert("Couldn't move in opening stock", apiErrorMessage(err));
    } finally {
      setPosting(false);
    }
  };

  if (loading && !preview) return <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 30 }} />;
  if (error && !preview)
    return (
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: colors.danger }}>{error}</Text>
        <Pressable onPress={() => void load()}>
          <Text style={st.actionText}>Try again</Text>
        </Pressable>
      </View>
    );
  if (!preview) return null;

  return (
    <View style={{ paddingHorizontal: 16, gap: 10 }}>
      <View style={st.card}>
        <Text style={st.title}>Move in opening stock</Text>
        {rows.length === 0 ? (
          <Text style={fs.muted}>
            Every product's stock is explained by stock movements.
            {preview.alreadyMovedIn ? ` ${preview.alreadyMovedIn} products were moved in already.` : ""}
          </Text>
        ) : (
          <>
            <Text style={fs.muted}>
              Opening stock for {preview.totals.products} product{preview.totals.products === 1 ? "" : "s"} hasn't been moved in yet. Posting
              records where this stock came from; stock on hand doesn't change. Products already moved in are skipped.
            </Text>
            <KeyValue label="Ready to post" value={`${ready.length} · ${fc(readyValue)}`} tone="in" />
            {stillNeed ? <KeyValue label="Needs cost (not posted)" value={String(stillNeed)} tone="warn" /> : null}
            <Field
              label="Cutover date (YYYY-MM-DD)"
              value={cutover}
              onChange={setCutover}
              placeholder={preview.cutoverDate ?? todayIso()}
              error={cutoverError}
            />
            {preview.cutoverReason ? <Text style={fs.muted}>Suggested: {preview.cutoverReason}.</Text> : null}
            {canWrite ? (
              <PrimaryButton
                label={ready.length ? `Move in ${ready.length} product${ready.length === 1 ? "" : "s"}` : "Add a unit cost to post"}
                onPress={post}
                busy={posting}
                disabled={ready.length === 0}
              />
            ) : null}
          </>
        )}
      </View>
      {rows.map((r) => {
        const cost = costOf(r);
        return (
          <View key={r.productId} style={st.openRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={fs.rowTitle} numberOfLines={1}>{r.name}</Text>
                {cost === null ? <Badge label="Needs cost" color="#92400e" bg="#fef3c7" /> : null}
              </View>
              <Text style={fs.rowMeta} numberOfLines={1}>
                {[r.sku, `${r.quantity} units`, cost !== null ? `= ${fc(r.quantity * cost)}` : null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <TextInput
              style={[st.costInput, cost === null && { borderColor: "#fcd34d" }]}
              value={costs[r.productId] ?? (r.unitCost !== null ? String(r.unitCost) : "")}
              onChangeText={(v) => setCosts((c) => ({ ...c, [r.productId]: v }))}
              placeholder="Unit cost"
              placeholderTextColor="#94a3b8"
              keyboardType="decimal-pad"
              editable={canWrite}
            />
          </View>
        );
      })}
      {preview.total > rows.length ? (
        <Text style={fs.muted}>Showing {rows.length} of {preview.total}. Post these, then the rest will load.</Text>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// RPT-1 / RPT-3: month-end close
// ---------------------------------------------------------------------------

export function MonthClosePanel({ canWrite, refreshKey }: { canWrite: boolean; refreshKey?: number }) {
  const { formatCurrency: fc } = useCurrency();
  const [status, setStatus] = useState<FinanceCloseStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ mode: "close" | "reopen"; month: string; label: string } | null>(null);
  const [text, setText] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setStatus(await getCloseStatus());
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load month close."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [refreshKey]);

  const open = (mode: "close" | "reopen", month: string, label: string) => {
    setText("");
    setTextError(null);
    setSheet({ mode, month, label });
  };

  const submit = async () => {
    if (!sheet) return;
    if (sheet.mode === "reopen" && !text.trim()) {
      setTextError("Give a reason for reopening.");
      return;
    }
    setSaving(true);
    try {
      const res = sheet.mode === "close" ? await closeMonth(sheet.month, text.trim()) : await reopenMonth(sheet.month, text.trim());
      setSheet(null);
      Alert.alert(res.message ?? (sheet.mode === "close" ? `${sheet.label} closed` : `${sheet.label} reopened`));
      void load();
    } catch (err) {
      const fe = apiFieldErrors(err);
      const msg = fe.reason ?? fe.note ?? fe.month ?? null;
      if (msg) setTextError(msg);
      else Alert.alert(sheet.mode === "close" ? "Couldn't close the month" : "Couldn't reopen the month", apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading && !status) return <ActivityIndicator color={colors.primaryDark} style={{ marginTop: 30 }} />;
  if (error && !status) return <Text style={{ color: colors.danger }}>{error}</Text>;
  if (!status) return null;

  return (
    <View style={{ gap: 12 }}>
      <View style={st.card}>
        <View style={st.head}>
          <Text style={st.title}>Month-end close</Text>
          <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />
        </View>
        <Text style={st.closeText}>
          {status.text ??
            (status.closedThrough ? `Everything up to ${fmtLongDate(status.closedThrough)} is closed.` : "No months closed yet.")}
        </Text>
        <Text style={fs.muted}>
          A closed month's figures stop moving: anything dated in it is locked. Voids and corrections post in the open month.
        </Text>
        {status.suggestion && canWrite ? (
          <PrimaryButton
            label={status.suggestion.text ?? `Close ${status.suggestion.label}`}
            onPress={() => open("close", status.suggestion!.month, status.suggestion!.label)}
          />
        ) : status.suggestion ? (
          <Text style={fs.muted}>Next to close: {status.suggestion.label}.</Text>
        ) : (
          <Text style={fs.muted}>Every month that has ended is closed.</Text>
        )}
        {status.olderOpenMonth && canWrite ? (
          <Pressable onPress={() => open("close", status.olderOpenMonth!.month, status.olderOpenMonth!.label)} hitSlop={6}>
            <Text style={st.actionText}>{status.olderOpenMonth.text ?? "Close an older month instead"} ({status.olderOpenMonth.label})</Text>
          </Pressable>
        ) : null}
      </View>

      {status.months.map((m) => {
        const closed = m.status === "closed";
        return (
          <View key={m.month} style={st.monthRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={fs.rowTitle}>{m.label || fmtMonth(m.month)}</Text>
                <Badge label={closed ? "Closed" : "Open"} color={closed ? colors.text : colors.primaryDark} bg={closed ? "#e2e8f0" : "#dcfce7"} />
              </View>
              <Text style={fs.rowMeta} numberOfLines={2}>
                {closed
                  ? [
                      m.netAtClose !== null ? `Net at close ${fc(m.netAtClose)}` : null,
                      m.closedAt ? `closed ${fmtDate(m.closedAt)}${m.closedByName ? ` by ${m.closedByName}` : ""}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : m.liveNet !== null
                    ? `Net so far ${fc(m.liveNet)}`
                    : ""}
              </Text>
              {closed && m.drift ? <Text style={[fs.rowMeta, { color: colors.warning }]}>Changed since close: {fc(m.drift)}</Text> : null}
              {m.reopenReason ? (
                <Text style={fs.rowMeta} numberOfLines={2}>
                  Reopened{m.reopenedAt ? ` ${fmtDate(m.reopenedAt)}` : ""}: {m.reopenReason}
                </Text>
              ) : null}
            </View>
            {canWrite && closed ? (
              <Pressable style={st.outlineBtn} onPress={() => open("reopen", m.month, m.label)}>
                <Text style={st.actionText}>Reopen</Text>
              </Pressable>
            ) : canWrite && m.canClose ? (
              <Pressable style={st.outlineBtn} onPress={() => open("close", m.month, m.label)}>
                <Text style={st.actionText}>Close</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}

      <Sheet visible={sheet !== null} title={sheet ? `${sheet.mode === "close" ? "Close" : "Reopen"} ${sheet.label}` : ""} onClose={() => setSheet(null)}>
        <Text style={fs.muted}>
          {sheet?.mode === "close"
            ? "Locks everything dated in this month (expenses, entries, transfers, payments). The net profit is saved as it is now."
            : "Unlocks the month so its entries can change again. The reason is kept in the history."}
        </Text>
        <Field
          label={sheet?.mode === "close" ? "Note (optional)" : "Reason"}
          value={text}
          onChange={setText}
          multiline
          placeholder={sheet?.mode === "close" ? "e.g. Checked by accountant" : "e.g. Late supplier bill"}
          error={textError}
        />
        <PrimaryButton
          label={sheet?.mode === "close" ? `Close ${sheet?.label ?? ""}` : `Reopen ${sheet?.label ?? ""}`}
          onPress={submit}
          busy={saving}
          tone={sheet?.mode === "reopen" ? "danger" : "primary"}
        />
      </Sheet>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Health checks (R2–R11)
// ---------------------------------------------------------------------------

export function HealthChecksPanel({ health }: { health: FinanceHealth }) {
  const { formatCurrency: fc } = useCurrency();
  return (
    <View style={{ gap: 10 }}>
      <View style={[st.card, { borderColor: health.ok ? "#bbf7d0" : "#fecaca" }]}>
        <View style={st.head}>
          <Text style={st.title}>Health checks</Text>
          <Badge
            label={health.ok ? "All good" : `${health.failed} failing`}
            color={health.ok ? colors.primaryDark : colors.danger}
            bg={health.ok ? "#dcfce7" : "#fee2e2"}
          />
        </View>
        <Text style={fs.muted}>
          {health.passed} passed · {health.failed} failed. Cross-checks that every finance screen shows the same numbers.
        </Text>
      </View>
      {health.checks.map((c) => {
        const icon = c.status === "pass" ? "checkmark-circle" : c.status === "fail" ? "close-circle" : "information-circle";
        const color = c.status === "pass" ? colors.primaryDark : c.status === "fail" ? colors.danger : colors.info;
        return (
          <View key={c.id} style={st.monthRow}>
            <Ionicons name={icon} size={20} color={color} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={fs.rowTitle}>
                {c.id} · {c.title}
              </Text>
              {c.explanation ? <Text style={fs.rowMeta}>{c.explanation}</Text> : null}
              {c.status !== "pass" && c.difference ? <Text style={[fs.rowMeta, { color }]}>Difference {fc(c.difference)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
