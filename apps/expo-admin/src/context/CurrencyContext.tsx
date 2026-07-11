import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getRegionalSettings } from "@/services/settings";
import { useAuth } from "@/context/AuthContext";

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", JPY: "¥", CNY: "¥",
  BDT: "৳", INR: "₹", PKR: "₨", NPR: "₨", LKR: "₨",
  AUD: "A$", CAD: "C$", HKD: "HK$", SGD: "S$", NZD: "NZ$",
  AED: "د.إ", SAR: "﷼", KWD: "KD", QAR: "﷼", BHD: "BD",
  MYR: "RM", THB: "฿", IDR: "Rp", PHP: "₱", VND: "₫",
  KRW: "₩", TRY: "₺", BRL: "R$", MXN: "MX$", ZAR: "R",
  NGN: "₦", GHS: "₵", KES: "KSh", EGP: "£", MAD: "MAD",
};

function getSymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code;
}

type CurrencyContextValue = {
  currency: string;
  formatCurrency: (value: number) => string;
  reload: () => Promise<void>;
};

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  formatCurrency: (v) => `$${v.toFixed(2)}`,
  reload: async () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [currency, setCurrency] = useState("USD");

  const load = useCallback(async () => {
    try {
      const settings = await getRegionalSettings();
      if (settings.currency) setCurrency(settings.currency);
    } catch {
      // keep default
    }
  }, []);

  useEffect(() => {
    if (session) void load();
    else setCurrency("USD");
  }, [session, load]);

  const formatCurrency = useCallback((value: number) => {
    const symbol = getSymbol(currency);
    try {
      const formatted = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
      return `${symbol}${formatted}`;
    } catch {
      return `${symbol}${value.toFixed(2)}`;
    }
  }, [currency]);

  const value = useMemo<CurrencyContextValue>(
    () => ({ currency, formatCurrency, reload: load }),
    [currency, formatCurrency, load],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
