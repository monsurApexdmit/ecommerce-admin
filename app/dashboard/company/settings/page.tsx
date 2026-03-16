"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { saasCompanyApi, type CompanyProfile, type CompanySettings } from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Save, Building2, Globe, DollarSign, Clock } from "lucide-react"

export default function CompanySettingsPage() {
  const router = useRouter()
  const { company } = useSaasAuth()

  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [saving, setSaving] = useState(false)

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    industry: "",
    website: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    description: "",
  })

  // Settings form state
  const [settingsForm, setSettingsForm] = useState({
    companyName: "",
    taxId: "",
    taxIdType: "gst" as "vat" | "ein" | "gst" | "other",
    taxRate: 0,
    currency: "USD",
    timezone: "UTC",
    language: "en",
  })

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError("")

        // Load company profile
        const profileResponse = await saasCompanyApi.getProfile()
        setProfile(profileResponse.data)
        setProfileForm({
          name: profileResponse.data.name || "",
          industry: profileResponse.data.industry || "",
          website: profileResponse.data.website || "",
          phone: profileResponse.data.phone || "",
          address: profileResponse.data.address || "",
          city: profileResponse.data.city || "",
          state: profileResponse.data.state || "",
          zipCode: profileResponse.data.zipCode || "",
          country: profileResponse.data.country || "",
          description: profileResponse.data.description || "",
        })

        // Load company settings
        const settingsResponse = await saasCompanyApi.getSettings()
        setSettings(settingsResponse.data)
        setSettingsForm({
          companyName: settingsResponse.data.companyName || "",
          taxId: settingsResponse.data.taxId || "",
          taxIdType: (settingsResponse.data.taxIdType as "vat" | "ein" | "gst" | "other") || "gst",
          taxRate: settingsResponse.data.taxRate || 0,
          currency: settingsResponse.data.currency || "USD",
          timezone: settingsResponse.data.timezone || "UTC",
          language: settingsResponse.data.language || "en",
        })
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load company settings")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleProfileChange = (field: string, value: string) => {
    setProfileForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSettingsChange = (field: string, value: string | number) => {
    setSettingsForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    setError("")
    setSuccessMessage("")

    try {
      await saasCompanyApi.updateProfile({
        companyProfile: profileForm,
      })
      setSuccessMessage("Company profile updated successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update company profile")
    } finally {
      setSaving(false)
    }
  }

  const handleSaveSettings = async () => {
    setSaving(true)
    setError("")
    setSuccessMessage("")

    try {
      await saasCompanyApi.updateSettings({
        companyName: settingsForm.companyName,
        taxId: settingsForm.taxId,
        taxIdType: settingsForm.taxIdType,
        taxRate: settingsForm.taxRate,
        currency: settingsForm.currency,
        timezone: settingsForm.timezone,
        language: settingsForm.language,
      })
      setSuccessMessage("Company settings updated successfully")
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update company settings")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600">Loading company settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Settings</h1>
        <p className="text-gray-600">Manage your company profile and general settings</p>
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

      {/* Company Profile */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Company Profile</h2>
        </div>

        <div className="space-y-6">
          {/* Company Name & Industry */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
              <Input
                value={profileForm.name}
                onChange={(e) => handleProfileChange("name", e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
              <Input
                value={profileForm.industry}
                onChange={(e) => handleProfileChange("industry", e.target.value)}
                placeholder="e.g., Retail, Technology"
              />
            </div>
          </div>

          {/* Website & Phone */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Website</label>
              <Input
                type="url"
                value={profileForm.website}
                onChange={(e) => handleProfileChange("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <Input
                value={profileForm.phone}
                onChange={(e) => handleProfileChange("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
            <Input
              value={profileForm.address}
              onChange={(e) => handleProfileChange("address", e.target.value)}
              placeholder="123 Main Street"
            />
          </div>

          {/* City, State, Zip, Country */}
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
              <Input
                value={profileForm.city}
                onChange={(e) => handleProfileChange("city", e.target.value)}
                placeholder="New York"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
              <Input
                value={profileForm.state}
                onChange={(e) => handleProfileChange("state", e.target.value)}
                placeholder="NY"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Zip Code</label>
              <Input
                value={profileForm.zipCode}
                onChange={(e) => handleProfileChange("zipCode", e.target.value)}
                placeholder="10001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
              <Input
                value={profileForm.country}
                onChange={(e) => handleProfileChange("country", e.target.value)}
                placeholder="United States"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={profileForm.description}
              onChange={(e) => handleProfileChange("description", e.target.value)}
              placeholder="Brief description of your company..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <Button
            onClick={handleSaveProfile}
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
                Save Profile
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Company Settings */}
      <Card className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <Globe className="w-5 h-5 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Tax Information */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax & Compliance</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID</label>
                <Input
                  value={settingsForm.taxId}
                  onChange={(e) => handleSettingsChange("taxId", e.target.value)}
                  placeholder="e.g., 12-3456789"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tax ID Type</label>
                <select
                  value={settingsForm.taxIdType}
                  onChange={(e) =>
                    handleSettingsChange(
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

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax Rate (%)</label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settingsForm.taxRate}
                  onChange={(e) => handleSettingsChange("taxRate", parseFloat(e.target.value))}
                  placeholder="18"
                  className="flex-1"
                />
                <span className="text-gray-600">%</span>
              </div>
            </div>
          </div>

          {/* Regional Settings */}
          <div className="border-b pb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Regional</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={settingsForm.currency}
                  onChange={(e) => handleSettingsChange("currency", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="INR">INR - Indian Rupee</option>
                  <option value="AUD">AUD - Australian Dollar</option>
                  <option value="CAD">CAD - Canadian Dollar</option>
                  <option value="JPY">JPY - Japanese Yen</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                <select
                  value={settingsForm.timezone}
                  onChange={(e) => handleSettingsChange("timezone", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="EST">EST (Eastern Standard Time)</option>
                  <option value="CST">CST (Central Standard Time)</option>
                  <option value="MST">MST (Mountain Standard Time)</option>
                  <option value="PST">PST (Pacific Standard Time)</option>
                  <option value="GMT">GMT (Greenwich Mean Time)</option>
                  <option value="IST">IST (Indian Standard Time)</option>
                  <option value="AEST">AEST (Australian Eastern Standard Time)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Language & Localization */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Localization</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
              <select
                value={settingsForm.language}
                onChange={(e) => handleSettingsChange("language", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="en">English</option>
                <option value="es">Español (Spanish)</option>
                <option value="fr">Français (French)</option>
                <option value="de">Deutsch (German)</option>
                <option value="it">Italiano (Italian)</option>
                <option value="pt">Português (Portuguese)</option>
                <option value="ja">日本語 (Japanese)</option>
                <option value="zh">中文 (Chinese)</option>
              </select>
            </div>
          </div>

          <Button
            onClick={handleSaveSettings}
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
                Save Settings
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
