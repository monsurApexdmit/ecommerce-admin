"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { saasCompanyApi, type CompanyProfile } from "@/lib/saasCompanyApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AlertCircle, Loader, Save, Building2 } from "lucide-react"
import { toast } from "sonner"

export default function CompanyProfilePage() {
  const router = useRouter()
  const { company } = useSaasAuth()

  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true)
        setError("")
        const response = await saasCompanyApi.getProfile()
        setProfile(response.data)
        setForm({
          name: response.data.name || "",
          industry: response.data.industry || "",
          website: response.data.website || "",
          phone: response.data.phone || "",
          address: response.data.address || "",
          city: response.data.city || "",
          state: response.data.state || "",
          zipCode: response.data.zipCode || "",
          country: response.data.country || "",
          description: response.data.description || "",
        })
      } catch (err: any) {
        const message = err.response?.data?.message || "Failed to load company profile"
        setError(message)
        toast.error(message)
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError("")

      await saasCompanyApi.updateProfile(form)

      toast.success("Company profile updated successfully")
      setProfile(form as any)
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to update company profile"
      setError(message)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-gray-900">Company Profile</h1>
          </div>
          <p className="text-gray-600">Manage your company information</p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Profile Form */}
        <Card className="p-6 md:p-8">
          <div className="space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">
                    Company Name *
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter company name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="industry" className="text-sm font-medium">
                    Industry
                  </Label>
                  <Input
                    id="industry"
                    value={form.industry}
                    onChange={(e) => handleChange("industry", e.target.value)}
                    placeholder="e.g., Technology, Retail"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="website" className="text-sm font-medium">
                    Website
                  </Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website}
                    onChange={(e) => handleChange("website", e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Address</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="address" className="text-sm font-medium">
                    Street Address
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                    placeholder="123 Business Street"
                    className="mt-1"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city" className="text-sm font-medium">
                      City
                    </Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="New York"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="state" className="text-sm font-medium">
                      State/Province
                    </Label>
                    <Input
                      id="state"
                      value={form.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="NY"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="zipCode" className="text-sm font-medium">
                      ZIP/Postal Code
                    </Label>
                    <Input
                      id="zipCode"
                      value={form.zipCode}
                      onChange={(e) => handleChange("zipCode", e.target.value)}
                      placeholder="10001"
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="country" className="text-sm font-medium">
                      Country
                    </Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => handleChange("country", e.target.value)}
                      placeholder="United States"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
              <div>
                <Label htmlFor="description" className="text-sm font-medium">
                  Company Description
                </Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Tell us about your company..."
                  rows={5}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-6 flex items-center gap-3">
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
              <Button
                variant="outline"
                onClick={() => router.back()}
                disabled={saving}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>

        {/* Info Box */}
        <Card className="mt-6 p-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            💡 <strong>Tip:</strong> Keep your company information up-to-date to ensure accurate invoices and professional communication with clients.
          </p>
        </Card>
      </div>
    </div>
  )
}
