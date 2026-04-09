"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { settingsApi, type RegionalSettings } from "@/lib/settingsApi"
import { DollarSign, Clock, Globe, Ruler, Calendar, Hash, Loader2 } from "lucide-react"
import { toast } from "sonner"

const CURRENCY_LIST = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "INR", name: "Indian Rupee" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "ZAR", name: "South African Rand" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "DKK", name: "Danish Krone" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "THB", name: "Thai Baht" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "KRW", name: "South Korean Won" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "GHS", name: "Ghanaian Cedi" },
]

const TIMEZONE_LIST = [
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (Eastern)" },
  { value: "America/Chicago", label: "America/Chicago (Central)" },
  { value: "America/Denver", label: "America/Denver (Mountain)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (Pacific)" },
  { value: "America/Anchorage", label: "America/Anchorage (Alaska)" },
  { value: "America/Toronto", label: "America/Toronto (Eastern Canada)" },
  { value: "America/Mexico_City", label: "America/Mexico_City" },
  { value: "America/Sao_Paulo", label: "America/Sao_Paulo (Brazil)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "Europe/Paris", label: "Europe/Paris (CET)" },
  { value: "Europe/Berlin", label: "Europe/Berlin (CET)" },
  { value: "Europe/Moscow", label: "Europe/Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dhaka", label: "Asia/Dhaka (BST)" },
  { value: "Asia/Bangkok", label: "Asia/Bangkok (ICT)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai (CST)" },
  { value: "Asia/Seoul", label: "Asia/Seoul (KST)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEDT)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEDT)" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST)" },
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZDT)" },
  { value: "Pacific/Fiji", label: "Pacific/Fiji (FJT)" },
  { value: "Africa/Cairo", label: "Africa/Cairo (EET)" },
  { value: "Africa/Lagos", label: "Africa/Lagos (WAT)" },
  { value: "Africa/Nairobi", label: "Africa/Nairobi (EAT)" },
  { value: "Africa/Johannesburg", label: "Africa/Johannesburg (SAST)" },
]

const LANGUAGE_LIST = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "it", name: "Italiano (Italian)" },
  { code: "pt", name: "Português (Portuguese)" },
  { code: "ru", name: "Русский (Russian)" },
  { code: "ar", name: "العربية (Arabic)" },
  { code: "zh", name: "中文 (Chinese Simplified)" },
  { code: "zh-TW", name: "繁體中文 (Chinese Traditional)" },
  { code: "ja", name: "日本語 (Japanese)" },
  { code: "ko", name: "한국어 (Korean)" },
  { code: "hi", name: "हिन्दी (Hindi)" },
  { code: "bn", name: "বাংলা (Bengali)" },
  { code: "tr", name: "Türkçe (Turkish)" },
  { code: "nl", name: "Nederlands (Dutch)" },
  { code: "sv", name: "Svenska (Swedish)" },
  { code: "pl", name: "Polski (Polish)" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "vi", name: "Tiếng Việt (Vietnamese)" },
  { code: "th", name: "ไทย (Thai)" },
]

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
  BRL: "R$",
  MXN: "$",
  SGD: "S$",
  HKD: "HK$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  CHF: "CHF",
  NZD: "NZ$",
  AED: "د.إ",
  SAR: "﷼",
  KRW: "₩",
  TRY: "₺",
  EGP: "£",
  GHS: "₵",
}

export default function InternationalPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const [currency, setCurrency] = useState("USD")
  const [currencySymbolPosition, setCurrencySymbolPosition] = useState<"before" | "after">("before")
  const [currencyDecimalSeparator, setCurrencyDecimalSeparator] = useState<"." | ",">(".")
  const [currencyThousandsSeparator, setCurrencyThousandsSeparator] = useState<"," | "." | " " | "">(",")
  const [currencyDecimalPlaces, setCurrencyDecimalPlaces] = useState<0 | 1 | 2>(2)

  const [timezone, setTimezone] = useState("UTC")
  const [language, setLanguage] = useState("en")

  const [weightUnit, setWeightUnit] = useState<"kg" | "lb" | "g" | "oz">("kg")
  const [dimensionUnit, setDimensionUnit] = useState<"cm" | "in" | "mm">("cm")

  const [dateFormat, setDateFormat] = useState<"MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD">("MM/DD/YYYY")
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h")

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const res = await settingsApi.getAll()
      const regional = res.data.regional

      setCurrency(regional.currency || "USD")
      setCurrencySymbolPosition(regional.currencySymbolPosition || "before")
      setCurrencyDecimalSeparator(regional.currencyDecimalSeparator || ".")
      setCurrencyThousandsSeparator(regional.currencyThousandsSeparator || ",")
      setCurrencyDecimalPlaces(regional.currencyDecimalPlaces || 2)
      setTimezone(regional.timezone || "UTC")
      setLanguage(regional.language || "en")
      setWeightUnit(regional.weightUnit || "kg")
      setDimensionUnit(regional.dimensionUnit || "cm")
      setDateFormat(regional.dateFormat || "MM/DD/YYYY")
      setTimeFormat(regional.timeFormat || "12h")
    } catch (error) {
      console.error("Failed to load settings:", error)
      toast.error("Failed to load international settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateRegional({
        currency,
        currencySymbolPosition,
        currencyDecimalSeparator,
        currencyThousandsSeparator,
        currencyDecimalPlaces,
        timezone,
        language,
        weightUnit,
        dimensionUnit,
        dateFormat,
        timeFormat,
      })
      toast.success("International settings updated successfully")
    } catch (error) {
      console.error("Failed to save settings:", error)
      toast.error("Failed to save international settings")
    } finally {
      setIsSaving(false)
    }
  }

  // Format number preview
  const formatNumberPreview = (value: number = 1234.56): string => {
    const symbol = CURRENCY_SYMBOLS[currency] || currency
    let formattedValue = value.toFixed(currencyDecimalPlaces)

    // Apply thousands separator
    const [intPart, decPart] = formattedValue.split(".")
    let formatted = intPart

    if (currencyThousandsSeparator) {
      formatted = parseInt(intPart).toLocaleString("en", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      // Replace the default comma with our separator
      formatted = formatted.replace(/,/g, currencyThousandsSeparator)
    }

    // Add decimal part
    if (currencyDecimalPlaces > 0) {
      formatted += currencyDecimalSeparator + decPart.padEnd(currencyDecimalPlaces, "0")
    }

    // Add currency symbol
    return currencySymbolPosition === "before" ? `${symbol}${formatted}` : `${formatted} ${symbol}`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">International Settings</h1>
        <p className="text-gray-600 mt-1">Configure regional settings, currency, timezone, and language for your store</p>
      </div>

      {/* Currency Settings */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Currency</h2>
        </div>

        <div className="space-y-6">
          {/* Currency Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Symbol Position */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Symbol Position</label>
              <select
                value={currencySymbolPosition}
                onChange={(e) => setCurrencySymbolPosition(e.target.value as "before" | "after")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="before">Before amount (e.g., $1,234.56)</option>
                <option value="after">After amount (e.g., 1,234.56 $)</option>
              </select>
            </div>

            {/* Decimal Separator */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Decimal Separator</label>
              <select
                value={currencyDecimalSeparator}
                onChange={(e) => setCurrencyDecimalSeparator(e.target.value as "." | ",")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value=".">Period (.)</option>
                <option value=",">Comma (,)</option>
              </select>
            </div>
          </div>

          {/* Thousands Separator */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Thousands Separator</label>
              <select
                value={currencyThousandsSeparator}
                onChange={(e) => setCurrencyThousandsSeparator(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value=",">Comma (,)</option>
                <option value=".">Period (.)</option>
                <option value=" ">Space</option>
                <option value="">None</option>
              </select>
            </div>

            {/* Decimal Places */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Decimal Places</label>
              <select
                value={currencyDecimalPlaces}
                onChange={(e) => setCurrencyDecimalPlaces(parseInt(e.target.value) as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="0">0 decimal places (e.g., 1,235)</option>
                <option value="1">1 decimal place (e.g., 1,234.5)</option>
                <option value="2">2 decimal places (e.g., 1,234.56)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Regional Settings */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Regional Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Timezone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {TIMEZONE_LIST.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {LANGUAGE_LIST.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Units of Measurement */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Ruler className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Units of Measurement</h2>
        </div>

        <div className="space-y-6">
          {/* Weight Unit */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Weight Unit</label>
              <select
                value={weightUnit}
                onChange={(e) => setWeightUnit(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="kg">Kilogram (kg)</option>
                <option value="lb">Pound (lb)</option>
                <option value="g">Gram (g)</option>
                <option value="oz">Ounce (oz)</option>
              </select>
            </div>

            {/* Dimension Unit */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dimension Unit</label>
              <select
                value={dimensionUnit}
                onChange={(e) => setDimensionUnit(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cm">Centimeter (cm)</option>
                <option value="in">Inch (in)</option>
                <option value="mm">Millimeter (mm)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Date & Time Format */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Date & Time Format</h2>
        </div>

        <div className="space-y-6">
          {/* Date Format */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</option>
              </select>
            </div>

            {/* Time Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Time Format</label>
              <select
                value={timeFormat}
                onChange={(e) => setTimeFormat(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="12h">12-hour (2:30 PM)</option>
                <option value="24h">24-hour (14:30)</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Number Format Preview */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Hash className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Number Format Preview</h2>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Sample price: 1,234.56</p>
            <p className="text-3xl font-bold text-emerald-600">{formatNumberPreview(1234.56)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Sample price: 99.99</p>
            <p className="text-3xl font-bold text-emerald-600">{formatNumberPreview(99.99)}</p>
          </div>
        </div>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadSettings} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </div>
  )
}
