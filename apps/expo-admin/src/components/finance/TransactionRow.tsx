import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { FINANCE_SOURCE_LABELS, type FinanceTransaction } from "@/types/finance";
import { fmtShortDate, titleCase } from "./ui";

const SOURCE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sale: "bag-handle-outline",
  refund: "return-down-back-outline",
  supplier_payment: "storefront-outline",
  expense: "receipt-outline",
  expense_void: "close-circle-outline",
  salary: "people-outline",
  dorji_payout: "cut-outline",
  tailor_payment: "shirt-outline",
  cod: "bicycle-outline",
  supplier_refund: "arrow-undo-outline",
  manual: "create-outline",
  transfer: "swap-horizontal-outline",
};

export function sourceLabel(type?: string | null) {
  if (!type) return "—";
  return FINANCE_SOURCE_LABELS[type] ?? titleCase(type);
}

export function TransactionRow({
  item,
  onPress,
  showBalance,
  showFee,
}: {
  item: FinanceTransaction;
  onPress?: () => void;
  showBalance?: boolean;
  /** TXN-1: show "Fee · Net" under the gross amount. */
  showFee?: boolean;
}) {
  const { formatCurrency } = useCurrency();
  const isIn = item.direction === "in";
  const meta = [fmtShortDate(item.date), item.accountName, item.methodLabel]
    .filter(Boolean)
    .join(" · ");
  const label = item.sourceLabel || sourceLabel(item.sourceType);
  const title = item.party || item.reference || item.category || label;
  const sub = [label, item.party ? item.reference : null, item.category && item.category !== title ? item.category : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable style={st.row} onPress={onPress} disabled={!onPress}>
      <View style={[st.icon, { backgroundColor: isIn ? "#dcfce7" : "#fee2e2" }]}>
        <Ionicons name={SOURCE_ICONS[item.sourceType] ?? (isIn ? "arrow-down" : "arrow-up")} size={17} color={isIn ? colors.primaryDark : colors.danger} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.title} numberOfLines={1}>{title}</Text>
        <Text style={st.sub} numberOfLines={1}>{sub}</Text>
        <Text style={st.meta} numberOfLines={1}>{meta}</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 2 }}>
        <Text style={[st.amount, { color: isIn ? colors.primaryDark : colors.danger }]}>
          {isIn ? "+" : "−"}{formatCurrency(item.amount)}
        </Text>
        {showFee && item.fee > 0 ? (
          <Text style={st.meta}>
            Fee −{formatCurrency(item.fee)} · Net {item.net < 0 ? "−" : ""}{formatCurrency(Math.abs(item.net))}
          </Text>
        ) : null}
        {showBalance && item.runningBalance !== null ? (
          <Text style={st.meta}>Bal {formatCurrency(item.runningBalance)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  icon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 11 },
  amount: { fontSize: 14, fontWeight: "800" },
});
