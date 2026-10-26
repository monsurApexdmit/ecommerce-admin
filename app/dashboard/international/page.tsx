"use client"

import { useState, useEffect } from "react"
import { Spinner } from "@/components/ui/spinner"
import { PageHeader } from "@/components/common/PageHeader"
import { SectionCard } from "@/components/common/SectionCard"
import { FormField } from "@/components/common/FormField"
import { StatTile } from "@/components/common/StatTile"
import { Button } from "@/components/ui/button"
import { settingsApi, type RegionalSettings } from "@/lib/settingsApi"
import { DollarSign, Clock, Globe, Ruler, Calendar, Hash } from "lucide-react"
import { toast } from "sonner"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  const { canRead } = useSaasAuth()
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

  const blocked = useModuleGuard('International')
  if (blocked) return blocked

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
        <Spinner className="size-8" />
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader title="International Settings" description="Configure regional settings, currency, timezone, and language for your store" />

      {/* Currency Settings */}
      <SectionCard title={<span className="flex items-center gap-2"><DollarSign className="size-5 text-muted-foreground" />Currency</span>}>

        <div className="space-y-6">
          {/* Currency Code */}
          <FormField label="Currency" htmlFor="intl-currency">
            <Select value={String(currency)} onValueChange={(val) => setCurrency(val)}>
              <SelectTrigger id="intl-currency" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_LIST.map((c) => (
                  <SelectItem key={c.code} value={String(c.code)}>
                    {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Symbol Position */}
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Symbol Position" htmlFor="intl-symbol-position">
              <Select value={String(currencySymbolPosition)} onValueChange={(val) => setCurrencySymbolPosition(val as "before" | "after")}>
                <SelectTrigger id="intl-symbol-position" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">Before amount (e.g., $1,234.56)</SelectItem>
                  <SelectItem value="after">After amount (e.g., 1,234.56 $)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Decimal Separator */}
            <FormField label="Decimal Separator" htmlFor="intl-decimal-separator">
              <Select value={String(currencyDecimalSeparator)} onValueChange={(val) => setCurrencyDecimalSeparator(val as "." | ",")}>
                <SelectTrigger id="intl-decimal-separator" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=".">Period (.)</SelectItem>
                  <SelectItem value=",">Comma (,)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {/* Thousands Separator */}
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Thousands Separator" htmlFor="intl-thousands-separator">
              <Select value={String(currencyThousandsSeparator) === "" ? "__none" : String(currencyThousandsSeparator)} onValueChange={(val) => setCurrencyThousandsSeparator((val === "__none" ? "" : val) as any)}>
                <SelectTrigger id="intl-thousands-separator" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=",">Comma (,)</SelectItem>
                  <SelectItem value=".">Period (.)</SelectItem>
                  <SelectItem value=" ">Space</SelectItem>
                  <SelectItem value="__none">None</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Decimal Places */}
            <FormField label="Decimal Places" htmlFor="intl-decimal-places">
              <Select value={String(currencyDecimalPlaces)} onValueChange={(val) => setCurrencyDecimalPlaces(parseInt(val) as any)}>
                <SelectTrigger id="intl-decimal-places" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 decimal places (e.g., 1,235)</SelectItem>
                  <SelectItem value="1">1 decimal place (e.g., 1,234.5)</SelectItem>
                  <SelectItem value="2">2 decimal places (e.g., 1,234.56)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Regional Settings */}
      <SectionCard title={<span className="flex items-center gap-2"><Globe className="size-5 text-muted-foreground" />Regional Settings</span>}>

        <div className="space-y-6">
          {/* Timezone */}
          <FormField label="Timezone" htmlFor="intl-timezone">
            <Select value={String(timezone)} onValueChange={(val) => setTimezone(val)}>
              <SelectTrigger id="intl-timezone" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONE_LIST.map((tz) => (
                  <SelectItem key={tz.value} value={String(tz.value)}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {/* Language */}
          <FormField label="Language" htmlFor="intl-language">
            <Select value={String(language)} onValueChange={(val) => setLanguage(val)}>
              <SelectTrigger id="intl-language" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_LIST.map((lang) => (
                  <SelectItem key={lang.code} value={String(lang.code)}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </SectionCard>

      {/* Units of Measurement */}
      <SectionCard title={<span className="flex items-center gap-2"><Ruler className="size-5 text-muted-foreground" />Units of Measurement</span>}>

        <div className="space-y-6">
          {/* Weight Unit */}
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Weight Unit" htmlFor="intl-weight-unit">
              <Select value={String(weightUnit)} onValueChange={(val) => setWeightUnit(val as any)}>
                <SelectTrigger id="intl-weight-unit" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">Kilogram (kg)</SelectItem>
                  <SelectItem value="lb">Pound (lb)</SelectItem>
                  <SelectItem value="g">Gram (g)</SelectItem>
                  <SelectItem value="oz">Ounce (oz)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Dimension Unit */}
            <FormField label="Dimension Unit" htmlFor="intl-dimension-unit">
              <Select value={String(dimensionUnit)} onValueChange={(val) => setDimensionUnit(val as any)}>
                <SelectTrigger id="intl-dimension-unit" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">Centimeter (cm)</SelectItem>
                  <SelectItem value="in">Inch (in)</SelectItem>
                  <SelectItem value="mm">Millimeter (mm)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Date & Time Format */}
      <SectionCard title={<span className="flex items-center gap-2"><Calendar className="size-5 text-muted-foreground" />Date & Time Format</span>}>

        <div className="space-y-6">
          {/* Date Format */}
          <div className="grid grid-cols-2 gap-6">
            <FormField label="Date Format" htmlFor="intl-date-format">
              <Select value={String(dateFormat)} onValueChange={(val) => setDateFormat(val as any)}>
                <SelectTrigger id="intl-date-format" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Time Format */}
            <FormField label="Time Format" htmlFor="intl-time-format">
              <Select value={String(timeFormat)} onValueChange={(val) => setTimeFormat(val as any)}>
                <SelectTrigger id="intl-time-format" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour (2:30 PM)</SelectItem>
                  <SelectItem value="24h">24-hour (14:30)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
        </div>
      </SectionCard>

      {/* Number Format Preview */}
      <SectionCard title={<span className="flex items-center gap-2"><Hash className="size-5 text-muted-foreground" />Number Format Preview</span>}>

        <div className="grid gap-4">
          <StatTile label="Sample price: 1,234.56" value={formatNumberPreview(1234.56)} />
          <StatTile label="Sample price: 99.99" value={formatNumberPreview(99.99)} />
        </div>
      </SectionCard>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadSettings} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <Spinner />
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
