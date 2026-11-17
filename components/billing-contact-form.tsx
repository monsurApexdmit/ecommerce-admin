"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import { FormField } from "@/components/common/FormField"
import { saasCompanyApi, type BillingContactPayload } from "@/lib/saasCompanyApi"
import { AlertCircle, CheckCircle2, Save, MapPin } from "lucide-react"

/**
 * Billing address + tax-ID form. Loads and saves through the company billing
 * endpoint. Extracted from the former /company/billing-contact page so it can
 * live inside Company Settings.
 */
export function BillingContactForm() {
  const { t } = useTranslation(["account", "common"])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<BillingContactPayload>({
    email: "", phone: "", address: "", city: "", state: "",
    zipCode: "", country: "", taxId: "", taxIdType: "gst",
  })

  useEffect(() => {
    saasCompanyApi.getBillingContact()
      .then((response) => {
        setFormData({
          email: response.data.email,
          phone: response.data.phone,
          address: response.data.address,
          city: response.data.city,
          state: response.data.state,
          zipCode: response.data.zipCode,
          country: response.data.country,
          taxId: response.data.taxId || "",
          taxIdType: (response.data.taxIdType as "vat" | "ein" | "gst" | "other") || "gst",
        })
      })
      .catch((err: any) => setError(err.response?.data?.message || t("account:billing.contact.loadFailed")))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field: keyof BillingContactPayload, value: string) =>
    setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!formData.email || !formData.phone || !formData.address || !formData.city) {
      setError(t("account:billing.contact.required"))
      return
    }
    setSaving(true)
    setError("")
    setSuccessMessage("")
    try {
      await saasCompanyApi.updateBillingContact(formData)
      setSuccessMessage(t("account:billing.contact.updated"))
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || t("account:billing.contact.updateFailed"))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert>
          <CheckCircle2 />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Billing Address */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <MapPin className="w-5 h-5 text-brand-fg" />
          <h3 className="text-lg font-semibold text-foreground">{t("account:billing.contact.address")}</h3>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t("common:fields.email")} required htmlFor="billing-email">
              <Input id="billing-email" type="email" value={formData.email || ""} onChange={(e) => handleChange("email", e.target.value)} placeholder={t("account:billing.contact.emailPlaceholder")} />
            </FormField>
            <FormField label={t("common:fields.phone")} required htmlFor="billing-phone">
              <Input id="billing-phone" type="tel" value={formData.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} placeholder={t("account:billing.contact.phonePlaceholder")} />
            </FormField>
          </div>
          <FormField label={t("account:billing.contact.street")} required htmlFor="billing-address">
            <Input id="billing-address" value={formData.address || ""} onChange={(e) => handleChange("address", e.target.value)} placeholder={t("account:billing.contact.streetPlaceholder")} />
          </FormField>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <FormField label={t("account:billing.contact.city")} required htmlFor="billing-city">
              <Input id="billing-city" value={formData.city || ""} onChange={(e) => handleChange("city", e.target.value)} placeholder={t("account:billing.contact.cityPlaceholder")} />
            </FormField>
            <FormField label={t("account:billing.contact.state")} htmlFor="billing-state">
              <Input id="billing-state" value={formData.state || ""} onChange={(e) => handleChange("state", e.target.value)} placeholder={t("account:billing.contact.statePlaceholder")} />
            </FormField>
            <FormField label={t("account:billing.contact.zip")} htmlFor="billing-zipCode">
              <Input id="billing-zipCode" value={formData.zipCode || ""} onChange={(e) => handleChange("zipCode", e.target.value)} placeholder={t("account:billing.contact.zipPlaceholder")} />
            </FormField>
            <FormField label={t("account:billing.contact.country")} htmlFor="billing-country">
              <Input id="billing-country" value={formData.country || ""} onChange={(e) => handleChange("country", e.target.value)} placeholder={t("account:billing.contact.countryPlaceholder")} />
            </FormField>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <><Spinner />{t("common:actions.saving")}</> : <><Save />{t("account:billing.contact.save")}</>}
        </Button>
      </div>
    </div>
  )
}
