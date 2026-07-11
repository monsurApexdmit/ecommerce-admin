"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type React from "react"
import { saasCompanyApi, type CompanySettings } from "@/lib/saasCompanyApi"

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", INR: "₹", AUD: "A$", CAD: "C$",
  JPY: "¥", CNY: "¥", BRL: "R$", MXN: "$", SGD: "S$", HKD: "HK$",
  SEK: "kr", NOK: "kr", DKK: "kr", CHF: "CHF", NZD: "NZ$",
  AED: "د.إ", SAR: "﷼", KRW: "₩", TRY: "₺", EGP: "£", GHS: "₵",
  BDT: "৳", PKR: "₨",
}

interface CompanySettingsContextType {
  settings: CompanySettings | null
  taxRate: number
  currency: string
  timezone: string
  formatCurrency: (amount: number) => string
  formatTaxLabel: () => string
  refreshSettings: () => Promise<void>
}

const defaultSettings: CompanySettingsContextType = {
  settings: null,
  taxRate: 0,
  currency: "USD",
  timezone: "UTC",
  formatCurrency: (amount) => `${CURRENCY_SYMBOLS["USD"]}${amount.toFixed(2)}`,
  formatTaxLabel: () => "Tax",
  refreshSettings: async () => {},
}

const CompanySettingsContext = createContext<CompanySettingsContextType>(defaultSettings)

export function CompanySettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings | null>(null)

  const buildFormatter = useCallback((s: CompanySettings | null) => {
    return (amount: number): string => {
      if (!s) return `${CURRENCY_SYMBOLS["USD"]}${amount.toFixed(2)}`

      const decimalPlaces = s.currencyDecimalPlaces ?? 2
      const decSep = s.currencyDecimalSeparator ?? "."
      const thouSep = s.currencyThousandsSeparator ?? ","
      const symbol = CURRENCY_SYMBOLS[s.currency] ?? s.currency
      const position = s.currencySymbolPosition ?? "before"

      const [intPart, decPart] = amount.toFixed(decimalPlaces).split(".")

      let formattedInt = intPart
      if (thouSep) {
        formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thouSep)
      }

      const formatted = decimalPlaces > 0 ? `${formattedInt}${decSep}${decPart}` : formattedInt
      return position === "before" ? `${symbol}${formatted}` : `${formatted}${symbol}`
    }
  }, [])

  const fetchSettings = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) return
    try {
      const res = await saasCompanyApi.getSettings()
      setSettings(res.data)
    } catch {
      // silently fail — defaults remain in effect
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const taxRate = settings?.taxRate ?? 0
  const currency = settings?.currency ?? "USD"
  const timezone = settings?.timezone ?? "UTC"
  const formatCurrency = buildFormatter(settings)
  const formatTaxLabel = () =>
    taxRate > 0 ? `Tax (${taxRate}%)` : "Tax"

  return (
    <CompanySettingsContext.Provider value={{
      settings,
      taxRate,
      currency,
      timezone,
      formatCurrency,
      formatTaxLabel,
      refreshSettings: fetchSettings,
    }}>
      {children}
    </CompanySettingsContext.Provider>
  )
}

export function useCompanySettings() {
  return useContext(CompanySettingsContext)
}
