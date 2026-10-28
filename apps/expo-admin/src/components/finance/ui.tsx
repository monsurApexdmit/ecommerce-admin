import { useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import type { FinancePeriodPreset, FinancePeriodQuery } from "@/types/finance";

// ---------------------------------------------------------------------------
// Dates & periods (typed YYYY-MM-DD; no date picker package)
//
// FND-3: every date is shown in the company time zone (company settings, default
// Asia/Dhaka), never the device zone or UTC. `YYYY-MM-DD` values from the API are
// already calendar dates in that zone, so they are formatted as-is; timestamps are
// converted. Output is built from fixed month names, so it is the same on every device.
// ---------------------------------------------------------------------------

export type PeriodPreset = FinancePeriodPreset;

/** Local period state: preset (sent to the API) + dates (shown, and sent for `custom`). */
export type Period = { preset: PeriodPreset; from: string; to: string };

export const DEFAULT_FINANCE_TZ = "Asia/Dhaka";
let financeTz = DEFAULT_FINANCE_TZ;

/** Set by the finance filters provider from company settings / API responses. */
export function setFinanceTimezone(tz?: string | null) {
  if (!tz) return;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    financeTz = tz;
  } catch {
    // unknown zone: keep the previous one
  }
}

export const getFinanceTimezone = () => financeTz;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");
/** Date → YYYY-MM-DD using its UTC fields (used for calendar arithmetic). */
export const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

type Parts = { y: number; m: number; d: number; hh: number; mm: number };

/** Wall-clock parts of an instant in the company time zone. */
function partsInTz(date: Date, tz = financeTz): Parts {
  try {
    const text = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date); // "10/28/2026, 14:05"
    const m = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}),?\s+(\d{1,2}):(\d{2})/);
    if (m) return { y: Number(m[3]), m: Number(m[1]), d: Number(m[2]), hh: Number(m[4]) % 24, mm: Number(m[5]) };
  } catch {
    // fall through
  }
  // No Intl time zone support: use the device clock.
  return { y: date.getFullYear(), m: date.getMonth() + 1, d: date.getDate(), hh: date.getHours(), mm: date.getMinutes() };
}

/** Today's date (YYYY-MM-DD) in the company time zone. */
export const todayIso = () => {
  const p = partsInTz(new Date());
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};

export const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());

function partsOf(value: string): Parts | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return { y, m, d, hh: 0, mm: 0 };
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return partsInTz(date);
}

export const PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "7 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_quarter", label: "Quarter" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom" },
];

/** Same presets plus "All time" (shared finance filter bar). */
export const LIST_PERIOD_PRESETS: { value: PeriodPreset; label: string }[] = [
  ...PERIOD_PRESETS.slice(0, -1),
  { value: "all_time", label: "All time" },
  PERIOD_PRESETS[PERIOD_PRESETS.length - 1],
];

/** Preset → dates, worked out from "today" in the company time zone. */
export function periodFor(preset: PeriodPreset, custom?: { from: string; to: string }): Period {
  const [y, mo, d] = todayIso().split("-").map(Number);
  const m = mo - 1;
  const day = (yy: number, mm: number, dd: number) => isoOf(new Date(Date.UTC(yy, mm, dd)));
  const today = day(y, m, d);
  switch (preset) {
    case "today":
      return { preset, from: today, to: today };
    case "last_7_days":
      return { preset, from: day(y, m, d - 6), to: today };
    case "last_month":
      return { preset, from: day(y, m - 1, 1), to: day(y, m, 0) };
    case "this_quarter": {
      const q = Math.floor(m / 3) * 3;
      return { preset, from: day(y, q, 1), to: day(y, q + 3, 0) };
    }
    case "this_year":
      return { preset, from: day(y, 0, 1), to: day(y, 11, 31) };
    case "all_time":
      return { preset, from: "", to: "" };
    case "custom":
      return { preset, from: custom?.from ?? day(y, m, 1), to: custom?.to ?? today };
    case "this_month":
    default:
      return { preset: "this_month", from: day(y, m, 1), to: day(y, m + 1, 0) };
  }
}

/** Period → query params for the service layer. */
export function periodQuery(p: Period): FinancePeriodQuery {
  return p.preset === "custom" ? { preset: "custom", from: p.from, to: p.to } : { preset: p.preset };
}

/** "28 Oct 2026" in the company time zone. */
export function fmtDate(value?: string | null) {
  if (!value) return "—";
  const p = partsOf(value);
  if (!p) return value;
  return `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
}

/** "28 Oct". */
export function fmtShortDate(value?: string | null) {
  if (!value) return "—";
  const p = partsOf(value);
  if (!p) return value;
  return `${p.d} ${MONTHS[p.m - 1]}`;
}

/** "31 August 2026". */
export function fmtLongDate(value?: string | null) {
  if (!value) return "—";
  const p = partsOf(value);
  if (!p) return value;
  return `${p.d} ${MONTHS_LONG[p.m - 1]} ${p.y}`;
}

/** "28 Oct 2026, 14:05" (timestamps) in the company time zone. */
export function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const p = partsOf(value);
  if (!p) return value;
  return value.length <= 10 ? fmtDate(value) : `${p.d} ${MONTHS[p.m - 1]} ${p.y}, ${pad(p.hh)}:${pad(p.mm)}`;
}

/** "2026-09" → "September 2026". */
export function fmtMonth(key?: string | null) {
  if (!key) return "—";
  const m = key.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS_LONG[Number(m[2]) - 1]} ${m[1]}` : key;
}

export const titleCase = (v?: string | null) =>
  (v ?? "").replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();

// ---------------------------------------------------------------------------
// Layout pieces
// ---------------------------------------------------------------------------

export function FinanceHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
}) {
  return (
    <View style={s.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function HeaderButton({
  icon,
  onPress,
  tone = "primary",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: "primary" | "plain";
}) {
  return (
    <Pressable style={[s.headerBtn, tone === "plain" && s.headerBtnPlain]} onPress={onPress} hitSlop={6}>
      <Ionicons name={icon} size={19} color={tone === "plain" ? colors.text : "#fff"} />
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      {icon ? <Ionicons name={icon} size={13} color={active ? "#fff" : colors.muted} /> : null}
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[s.chipRow, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

/** Quick period chips + YYYY-MM-DD inputs for "Custom". */
export function PeriodBar({
  value,
  onChange,
  presets = PERIOD_PRESETS,
}: {
  value: Period;
  onChange: (p: Period) => void;
  presets?: { value: PeriodPreset; label: string }[];
}) {
  const [from, setFrom] = useState(value.from);
  const [to, setTo] = useState(value.to);
  const [err, setErr] = useState<string | null>(null);

  const pick = (preset: PeriodPreset) => {
    if (preset === "custom") {
      const base = value.from && value.to ? value : periodFor("this_month");
      setFrom(base.from);
      setTo(base.to);
      setErr(null);
      onChange({ preset: "custom", from: base.from, to: base.to });
      return;
    }
    onChange(periodFor(preset));
  };

  const apply = () => {
    if (!isIsoDate(from) || !isIsoDate(to)) {
      setErr("Use YYYY-MM-DD dates.");
      return;
    }
    if (from > to) {
      setErr("Start date is after end date.");
      return;
    }
    setErr(null);
    onChange({ preset: "custom", from, to });
  };

  return (
    <View>
      <ChipRow>
        {presets.map((p) => (
          <Chip key={p.value} label={p.label} active={value.preset === p.value} onPress={() => pick(p.value)} />
        ))}
      </ChipRow>
      {value.preset === "custom" ? (
        <View style={s.customRow}>
          <TextInput
            style={s.dateInput}
            value={from}
            onChangeText={setFrom}
            placeholder="From YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            maxLength={10}
          />
          <Text style={{ color: colors.muted }}>–</Text>
          <TextInput
            style={s.dateInput}
            value={to}
            onChangeText={setTo}
            placeholder="To YYYY-MM-DD"
            placeholderTextColor="#94a3b8"
            autoCorrect={false}
            maxLength={10}
          />
          <Pressable style={s.applyBtn} onPress={apply}>
            <Text style={s.applyText}>Apply</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={s.periodHint}>
          {value.preset === "all_time" ? "All dates" : `${fmtDate(value.from)} – ${fmtDate(value.to)}`}
        </Text>
      )}
      {err ? <Text style={s.errText}>{err}</Text> : null}
    </View>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={s.searchWrap}>
      <Ionicons name="search" size={16} color={colors.muted} />
      <TextInput
        style={s.searchInput}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Ionicons name="close-circle" size={16} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={s.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function KeyValue({
  label,
  value,
  tone,
  bold,
}: {
  label: string;
  value: string;
  tone?: "in" | "out" | "muted" | "warn";
  bold?: boolean;
}) {
  const color =
    tone === "in" ? colors.primaryDark : tone === "out" ? colors.danger : tone === "warn" ? colors.warning : colors.text;
  return (
    <View style={s.kv}>
      <Text style={[s.kvLabel, bold && { color: colors.text, fontWeight: "800" }]}>{label}</Text>
      <Text style={[s.kvValue, { color }, bold && { fontWeight: "900", fontSize: 15 }]}>{value}</Text>
    </View>
  );
}

/** Two-column grid of small KPI tiles. */
export function KpiGrid({ children }: PropsWithChildren) {
  return <View style={s.kpiGrid}>{children}</View>;
}

export function Kpi({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "neutral" | "in" | "out" | "info" | "warn";
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}) {
  const t = KPI_TONES[tone];
  return (
    <Pressable style={[s.kpi, { backgroundColor: t.bg }]} onPress={onPress} disabled={!onPress}>
      <View style={s.kpiTop}>
        {icon ? (
          <View style={[s.kpiIcon, { backgroundColor: t.iconBg }]}>
            <Ionicons name={icon} size={15} color={t.fg} />
          </View>
        ) : null}
        <Text style={s.kpiLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[s.kpiValue, { color: t.value }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      {hint ? <Text style={s.kpiHint} numberOfLines={1}>{hint}</Text> : null}
    </Pressable>
  );
}

const KPI_TONES = {
  neutral: { bg: colors.surface, iconBg: "#f1f5f9", fg: colors.text, value: colors.text },
  in: { bg: "#ecfdf5", iconBg: "#bbf7d0", fg: colors.primaryDark, value: colors.primaryDark },
  out: { bg: "#fef2f2", iconBg: "#fecaca", fg: "#991b1b", value: "#b91c1c" },
  info: { bg: "#eff6ff", iconBg: "#bfdbfe", fg: "#1d4ed8", value: colors.text },
  warn: { bg: "#fffbeb", iconBg: "#fde68a", fg: "#92400e", value: colors.text },
};

/** PAY-3 / FND-2: marks figures that ignore the period filter. */
export function NowTag({ label = "As things stand now" }: { label?: string }) {
  return (
    <View style={s.nowTag}>
      <Ionicons name="time-outline" size={11} color="#475569" />
      <Text style={s.nowTagText}>{label}</Text>
    </View>
  );
}

export function Badge({ label, color = colors.muted, bg = "#f1f5f9" }: { label: string; color?: string; bg?: string }) {
  return (
    <View style={[s.badge, { backgroundColor: bg }]}>
      <Text style={[s.badgeText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Horizontal bar used for the simple in/out and category charts. */
export function Bar({ ratio, color, height = 8 }: { ratio: number; color: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <View style={[s.barTrack, { height, borderRadius: height / 2 }]}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

export function EmptyState({
  icon = "file-tray-outline",
  title,
  text,
  error,
  onRetry,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string | null;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={s.empty}>
      <Ionicons name={error ? "alert-circle-outline" : icon} size={42} color={error ? colors.danger : colors.muted} />
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {onRetry ? (
        <Pressable style={s.retryBtn} onPress={onRetry}>
          <Text style={s.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={s.center}>
      <ActivityIndicator color={colors.primaryDark} size="large" />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Bottom sheet form helpers
// ---------------------------------------------------------------------------

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={s.sheetWrap}
        pointerEvents="box-none"
      >
        <View style={s.sheet}>
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{title}</Text>
            <Pressable onPress={onClose} style={s.closeBtn} hitSlop={6}>
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={s.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  error?: string | null;
}) {
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && s.inputMulti, error ? { borderColor: colors.danger } : null]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCorrect={false}
      />
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  );
}

export function OptionField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
  isSelected,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null;
  /** Multi-select: overrides `value === option`. */
  isSelected?: (v: T) => boolean;
}) {
  const on = (v: T) => (isSelected ? isSelected(v) : value === v);
  return (
    <View style={{ gap: 5 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.optionWrap}>
        {options.map((o) => (
          <Pressable
            key={String(o.value)}
            style={[s.option, on(o.value) && s.optionActive]}
            onPress={() => onChange(o.value)}
          >
            <Text style={[s.optionText, on(o.value) && s.optionTextActive]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={s.errText}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  busy,
  disabled,
  tone = "primary",
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  return (
    <Pressable
      style={[s.saveBtn, tone === "danger" && { backgroundColor: colors.danger }, (busy || disabled) && { opacity: 0.55 }]}
      onPress={onPress}
      disabled={busy || disabled}
    >
      {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnText}>{label}</Text>}
    </Pressable>
  );
}

export const fs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },
  listContent: { padding: 16, paddingTop: 8, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  dirIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  rowMeta: { color: colors.muted, fontSize: 12 },
  amountIn: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  amountOut: { color: colors.danger, fontSize: 14, fontWeight: "800" },
  amount: { color: colors.text, fontSize: 14, fontWeight: "800" },
  divider: { height: 1, backgroundColor: colors.border },
  muted: { color: colors.muted, fontSize: 12 },
  totalsBar: {
    flexDirection: "row", gap: 8, marginHorizontal: 16, marginTop: 8,
  },
  totalBox: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10,
  },
  totalLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  totalValue: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 2 },
  footer: { marginVertical: 12 },
  smallBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 10, backgroundColor: colors.primaryDark, paddingHorizontal: 10, paddingVertical: 6,
  },
  smallBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  linkBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
    paddingHorizontal: 12, paddingVertical: 10,
  },
});

const s = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 12 },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: colors.primaryDark, alignItems: "center", justifyContent: "center",
  },
  headerBtnPlain: { backgroundColor: "#f1f5f9" },
  chipRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 4 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  customRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 6 },
  dateInput: {
    flex: 1, height: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 10, color: colors.text, fontSize: 13,
  },
  applyBtn: { height: 38, borderRadius: 10, backgroundColor: colors.primaryDark, paddingHorizontal: 12, justifyContent: "center" },
  applyText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  periodHint: { color: colors.muted, fontSize: 11, paddingHorizontal: 18, paddingTop: 2 },
  errText: { color: colors.danger, fontSize: 12, paddingHorizontal: 2 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 6, height: 42,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14 },
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sectionAction: { color: colors.primaryDark, fontSize: 13, fontWeight: "700" },
  kv: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  kvLabel: { color: colors.muted, fontSize: 13, flex: 1 },
  kvValue: { fontSize: 14, fontWeight: "700" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    width: "48.5%", flexGrow: 1, borderRadius: 16, padding: 12, gap: 6,
    borderWidth: 1, borderColor: colors.border,
  },
  kpiTop: { flexDirection: "row", alignItems: "center", gap: 6 },
  kpiIcon: { width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", flex: 1 },
  kpiValue: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  kpiHint: { color: colors.muted, fontSize: 11 },
  nowTag: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    backgroundColor: "#f1f5f9", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  nowTagText: { color: "#475569", fontSize: 10, fontWeight: "700" },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  badgeText: { fontSize: 10, fontWeight: "800" },
  barTrack: { flex: 1, backgroundColor: "#f1f5f9", overflow: "hidden" },
  empty: { alignItems: "center", paddingTop: 50, gap: 8, paddingHorizontal: 24 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center" },
  retryBtn: { marginTop: 6, borderRadius: 12, backgroundColor: colors.primaryDark, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: "#fff", fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheetWrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "88%",
  },
  sheetHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f1f5f9", alignItems: "center", justifyContent: "center" },
  sheetBody: { padding: 20, gap: 14, paddingBottom: 36 },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, height: 46, color: colors.text, fontSize: 14, backgroundColor: "#f8fafc",
  },
  inputMulti: { height: 74, textAlignVertical: "top", paddingTop: 10 },
  optionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 8, paddingHorizontal: 12,
  },
  optionActive: { borderColor: colors.primaryDark, backgroundColor: "#ecfdf5" },
  optionText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  optionTextActive: { color: colors.primaryDark },
  saveBtn: { borderRadius: 14, backgroundColor: colors.primaryDark, paddingVertical: 15, alignItems: "center", marginTop: 4 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
