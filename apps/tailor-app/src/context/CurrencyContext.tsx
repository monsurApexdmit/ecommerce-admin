import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRegionalSettings } from "@/services/settings";
import { useAuth } from "@/context/AuthContext";

const SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", INR: "₹", PKR: "₨",
  AED: "د.إ", SAR: "﷼", MYR: "RM", THB: "฿",
};

type CurrencyContextValue = {
  currency: string;
  formatCurrency: (value: number | string | undefined | null) => string;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "BDT",
  formatCurrency: (v) => `৳${v.toFixed(2)}`,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [currency, setCurrency] = useState("BDT");

  const load = useCallback(async () => {
    try {
      const s = await getRegionalSettings();
      if (s.currency) setCurrency(s.currency);
    } catch {}
  }, []);

  useEffect(() => {
    if (session) void load();
    else setCurrency("BDT");
  }, [session, load]);

  const formatCurrency = useCallback((value: number | string | undefined | null) => {
    const sym = SYMBOLS[currency] ?? currency;
    const n = parseFloat(String(value ?? 0));
    return `${sym}${isNaN(n) ? "0.00" : n.toFixed(2)}`;
  }, [currency]);

  const value = useMemo(() => ({ currency, formatCurrency }), [currency, formatCurrency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
