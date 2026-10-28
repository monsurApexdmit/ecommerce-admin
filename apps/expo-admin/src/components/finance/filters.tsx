import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/constants/theme";
import { useCurrency } from "@/context/CurrencyContext";
import { getRegionalSettings } from "@/services/settings";
import type { FinanceChannel } from "@/types/finance";
import { FINANCE_CHANNELS } from "@/types/finance";
import {
  Chip,
  ChipRow,
  DEFAULT_FINANCE_TZ,
  LIST_PERIOD_PRESETS,
  PeriodBar,
  getFinanceTimezone,
  periodFor,
  periodQuery,
  setFinanceTimezone,
  type Period,
} from "./ui";

// FND-2: one Period + Channel selection shared by every finance screen. The provider
// wraps the finance stack (app/finance/_layout.tsx), so moving between finance
// screens keeps the selection; leaving Finance resets it.

type FinanceFiltersValue = {
  period: Period;
  setPeriod: (p: Period) => void;
  channel: FinanceChannel;
  setChannel: (c: FinanceChannel) => void;
  /** Company IANA time zone used for period boundaries and every date label. */
  timezone: string;
  /** Called with the `tz` an API response carries (keeps labels in step with the server). */
  noteTimezone: (tz?: string | null) => void;
};

const FinanceFiltersContext = createContext<FinanceFiltersValue | null>(null);

export function FinanceFiltersProvider({ children }: PropsWithChildren) {
  const [period, setPeriodState] = useState<Period>(() => periodFor("this_month"));
  const [channel, setChannelState] = useState<FinanceChannel>("all");
  const [timezone, setTimezone] = useState<string>(getFinanceTimezone());

  const noteTimezone = useCallback((tz?: string | null) => {
    if (!tz || tz === getFinanceTimezone()) return;
    setFinanceTimezone(tz);
    setTimezone(getFinanceTimezone());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRegionalSettings()
      .then((r) => {
        if (cancelled) return;
        // "UTC" is the settings fallback when nothing is stored; the company default is Dhaka.
        const tz = r.timezone && r.timezone !== "UTC" ? r.timezone : DEFAULT_FINANCE_TZ;
        noteTimezone(tz);
      })
      .catch(() => {
        // keep the default zone
      });
    return () => {
      cancelled = true;
    };
  }, [noteTimezone]);

  // Presets are recomputed in the company zone once it is known.
  useEffect(() => {
    setPeriodState((p) => (p.preset === "custom" ? p : periodFor(p.preset)));
  }, [timezone]);

  // One state update per change (G-5): ignore taps that don't change anything.
  const setPeriod = useCallback((p: Period) => {
    setPeriodState((cur) => (cur.preset === p.preset && cur.from === p.from && cur.to === p.to ? cur : p));
  }, []);
  const setChannel = useCallback((c: FinanceChannel) => setChannelState(c), []);

  const value = useMemo<FinanceFiltersValue>(
    () => ({ period, setPeriod, channel, setChannel, timezone, noteTimezone }),
    [period, setPeriod, channel, setChannel, timezone, noteTimezone],
  );

  return <FinanceFiltersContext.Provider value={value}>{children}</FinanceFiltersContext.Provider>;
}

const FALLBACK: FinanceFiltersValue = {
  period: periodFor("this_month"),
  setPeriod: () => {},
  channel: "all",
  setChannel: () => {},
  timezone: DEFAULT_FINANCE_TZ,
  noteTimezone: () => {},
};

export function useFinanceFilters() {
  return useContext(FinanceFiltersContext) ?? FALLBACK;
}

/** Shared filter query (period params + channel) for service calls. */
export function useFinanceQuery(opts?: { withChannel?: boolean }) {
  const { period, channel } = useFinanceFilters();
  const withChannel = opts?.withChannel !== false;
  return useMemo(
    () => ({ ...periodQuery(period), channel: withChannel && channel !== "all" ? channel : undefined }),
    [period, channel, withChannel],
  );
}

/**
 * Period chips (+ custom dates) and Channel chips, bound to the shared selection,
 * with the currency / time zone the figures are shown in.
 */
export function FinanceFilterBar({
  showPeriod = true,
  showChannel = true,
  currencyCode,
}: {
  showPeriod?: boolean;
  showChannel?: boolean;
  /** Currency code a response reported (defaults to the company currency). */
  currencyCode?: string | null;
}) {
  const { period, setPeriod, channel, setChannel, timezone } = useFinanceFilters();
  const { currency } = useCurrency();
  return (
    <View style={{ gap: 4 }}>
      {showPeriod ? <PeriodBar value={period} onChange={setPeriod} presets={LIST_PERIOD_PRESETS} /> : null}
      {showChannel ? (
        <ChipRow>
          {FINANCE_CHANNELS.map((c) => (
            <Chip
              key={c.value}
              label={c.label}
              icon={c.value === "all" ? "git-branch-outline" : undefined}
              active={channel === c.value}
              onPress={() => setChannel(c.value)}
            />
          ))}
        </ChipRow>
      ) : null}
      {showChannel && channel !== "all" ? (
        <Text style={[s.noteText, { paddingHorizontal: 18 }]}>
          Channel narrows sales figures only; expenses, payouts and balances are company-wide.
        </Text>
      ) : null}
      <CurrencyNote code={currencyCode ?? currency} timezone={timezone} />
    </View>
  );
}

/** "Amounts in BDT · dates in Asia/Dhaka" — single-currency books, labelled on every screen. */
export function CurrencyNote({ code, timezone }: { code?: string | null; timezone?: string | null }) {
  const { currency } = useCurrency();
  const tz = timezone ?? getFinanceTimezone();
  return (
    <View style={s.note}>
      <Ionicons name="cash-outline" size={12} color={colors.muted} />
      <Text style={s.noteText}>
        Amounts in {code || currency} · dates in {tz}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  note: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 18, paddingTop: 2 },
  noteText: { color: colors.muted, fontSize: 11 },
});
