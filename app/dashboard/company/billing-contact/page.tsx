"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  saasCompanyApi,
  type BillingContact,
  type BillingContactPayload,
} from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Save, MapPin, FileText } from "lucide-react"

export default function BillingContactPage() {
  const router = useRouter()
  const { company } = useSaasAuth()

  const [billingContact, setBillingContact] = useState<BillingContact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState<BillingContactPayload>({
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    taxId: "",
    taxIdType: "gst",
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError("")

        const response = await saasCompanyApi.getBillingContact()
        setBillingContact(response.data)
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
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load billing contact")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleChange = (field: keyof BillingContactPayload, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.email || !formData.phone || !formData.address || !formData.city) {
      setError("Please fill in all required fields")
      return
    }

    setSaving(true)
    setError("")
    setSuccessMessage("")

    try {
      await saasCompanyApi.updateBillingContact(formData)
      setSuccessMessage("Billing contact updated successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update billing contact")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading billing contact...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing Contact</h1>
        <p className="text-gray-600">
          Update your billing address and tax information for invoices and payments
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-6">
          <div className="flex items-center gap-3 text-red-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        </Card>
      )}

      {/* Success Message */}
      {successMessage && (
        <Card className="bg-emerald-50 border-emerald-200 p-6">
          <div className="flex items-center gap-3 text-emerald-800">
            <div className="w-5 h-5 flex-shrink-0">✓</div>
            <p>{successMessage}</p>
          </div>
        </Card>
      )}

      {/* Billing Information */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Billing Address</h2>
        </div>

        <div className="space-y-6">
          {/* Email & Phone */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="billing@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Street Address <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          {/* City, State, Zip, Country */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.city}
                onChange={(e) => handleChange("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <Input
                value={formData.state}
                onChange={(e) => handleChange("state", e.target.value)}
                placeholder="NY"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zip Code</label>
              <Input
                value={formData.zipCode}
                onChange={(e) => handleChange("zipCode", e.target.value)}
                placeholder="10001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <Input
                value={formData.country}
                onChange={(e) => handleChange("country", e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tax Information */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Tax Information</h2>
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-600">
            Provide your tax identification number for invoicing purposes. This information will
            appear on your invoices.
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
              <Input
                value={formData.taxId}
                onChange={(e) => handleChange("taxId", e.target.value)}
                placeholder="e.g., 12-3456789"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID Type</label>
              <select
                value={formData.taxIdType || "gst"}
                onChange={(e) =>
                  handleChange(
                    "taxIdType",
                    e.target.value as "vat" | "ein" | "gst" | "other"
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="gst">GST (Goods & Services Tax)</option>
                <option value="vat">VAT (Value Added Tax)</option>
                <option value="ein">EIN (Employer ID Number)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 Tip:</strong> Your tax ID will be displayed on all invoices and tax
              documents. Keep this information up to date to ensure accurate billing.
            </p>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          {saving ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>

      {/* Info Card */}
      <Card className="p-6 bg-gray-50">
        <h3 className="font-semibold text-gray-900 mb-3">About Billing Contact</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>• Used for sending invoices and payment receipts</li>
          <li>• Required for tax compliance and reporting</li>
          <li>• Displayed on all official billing documents</li>
          <li>• Must be kept current for legal purposes</li>
        </ul>
      </Card>
    </div>
  )
}
