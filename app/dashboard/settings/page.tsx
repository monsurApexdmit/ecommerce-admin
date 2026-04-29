"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Building2, Mail, Phone, MapPin, Bell, Clock, Upload, Loader2 } from "lucide-react"
import { settingsApi } from "@/lib/settingsApi"
import { toast } from "sonner"

export default function SettingsPage() {
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // General Settings
  const [storeName, setStoreName] = useState("Dashtar Store")
  const [storeEmail, setStoreEmail] = useState("store@dashtar.com")
  const [storePhone, setStorePhone] = useState("+1 (555) 123-4567")
  const [storeAddress, setStoreAddress] = useState("123 Business St, New York, NY 10001")
  const [storeDescription, setStoreDescription] = useState(
    "Your one-stop shop for all your electronic and accessory needs.",
  )

  // Business Settings
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("Retail")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [website, setWebsite] = useState("")
  const [facebook, setFacebook] = useState("")
  const [instagram, setInstagram] = useState("")
  const [twitter, setTwitter] = useState("")
  const [logoUrl, setLogoUrl] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true)
  const [orderNotifications, setOrderNotifications] = useState(true)
  const [marketingEmails, setMarketingEmails] = useState(false)

  // Store Hours
  const [storeHours, setStoreHours] = useState({
    monday: { open: "09:00", close: "17:00", isOpen: true },
    tuesday: { open: "09:00", close: "17:00", isOpen: true },
    wednesday: { open: "09:00", close: "17:00", isOpen: true },
    thursday: { open: "09:00", close: "17:00", isOpen: true },
    friday: { open: "09:00", close: "17:00", isOpen: true },
    saturday: { open: "10:00", close: "15:00", isOpen: true },
    sunday: { open: "", close: "", isOpen: false },
  })

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const res = await settingsApi.getAll()
      const data = res.data

      // Load all settings
      if (data.general) {
        setStoreName(data.general.storeName || "")
        setStoreEmail(data.general.storeEmail || "")
        setStorePhone(data.general.storePhone || "")
        setStoreAddress(data.general.storeAddress || "")
        setStoreDescription(data.general.storeDescription || "")
      }

      if (data.business) {
        setBusinessName(data.business.businessName || "")
        setBusinessType(data.business.businessType || "Retail")
        setRegistrationNumber(data.business.registrationNumber || "")
        setGstNumber(data.business.gstNumber || "")
        setWebsite(data.business.website || "")
        setFacebook(data.business.socialLinks?.facebook || "")
        setInstagram(data.business.socialLinks?.instagram || "")
        setTwitter(data.business.socialLinks?.twitter || "")
        setLogoUrl(data.business.logoUrl || "")
        setBannerUrl(data.business.bannerUrl || "")
      }

      if (data.notifications) {
        setEmailNotifications(data.notifications.emailNotifications || true)
        setOrderNotifications(data.notifications.orderNotifications || true)
        setMarketingEmails(data.notifications.marketingEmails || false)
      }

      if (data.storeHours) {
        setStoreHours(data.storeHours)
      }

      toast.success("Settings loaded successfully")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveGeneral = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateGeneral({
        storeName,
        storeEmail,
        storePhone,
        storeAddress,
        storeDescription,
      })
      toast.success("General settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveBusiness = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateBusiness({
        businessName,
        businessType,
        registrationNumber,
        gstNumber,
        website,
        socialLinks: { facebook, instagram, twitter },
      })
      toast.success("Business settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateNotifications({
        emailNotifications,
        orderNotifications,
        marketingEmails,
      })
      toast.success("Notification settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveStoreHours = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateStoreHours(storeHours)
      toast.success("Store hours saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadLogo = async (file: File) => {
    try {
      setIsSaving(true)
      const res = await settingsApi.uploadLogo(file)
      setLogoUrl(res.data.logoUrl)
      toast.success("Logo uploaded successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload logo")
    } finally {
      setIsSaving(false)
    }
  }

  const handleUploadBanner = async (file: File) => {
    try {
      setIsSaving(true)
      const res = await settingsApi.uploadBanner(file)
      setBannerUrl(res.data.bannerUrl)
      toast.success("Banner uploaded successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload banner")
    } finally {
      setIsSaving(false)
    }
  }

  const handleStoreHourChange = (day: string, field: string, value: string | boolean) => {
    setStoreHours(prev => ({
      ...prev,
      [day]: { ...prev[day as keyof typeof prev], [field]: value }
    }))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your store information, notifications, and operating hours</p>
      </div>

      {/* Business Information */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Business Information</h2>
            <p className="text-sm text-gray-600">Update your business details and branding</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Logo Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="logo">Store Logo</Label>
              <div className="space-y-3">
                {logoUrl && (
                  <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-2">Current Logo:</p>
                    <img src={logoUrl} alt="Logo" className="h-32 mx-auto rounded object-contain" />
                  </div>
                )}
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadLogo(e.target.files[0])}
                    className="hidden"
                    id="logo-input"
                  />
                  <label htmlFor="logo-input" className="cursor-pointer block">
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {logoUrl ? "Change Logo" : "Click to upload"}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="banner">Store Banner</Label>
              <div className="space-y-3">
                {bannerUrl && (
                  <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                    <p className="text-xs text-blue-600 font-medium mb-2">Current Banner:</p>
                    <img src={bannerUrl} alt="Banner" className="h-32 mx-auto rounded w-full object-cover" />
                  </div>
                )}
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleUploadBanner(e.target.files[0])}
                    className="hidden"
                    id="banner-input"
                  />
                  <label htmlFor="banner-input" className="cursor-pointer block">
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                      <div>
                        <p className="text-sm font-medium text-blue-600 hover:text-blue-700">
                          {bannerUrl ? "Change Banner" : "Click to upload"}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Business Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter business name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessType">Business Type</Label>
              <select
                id="businessType"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="Retail">Retail</option>
                <option value="Wholesale">Wholesale</option>
                <option value="B2B">B2B</option>
                <option value="Service">Service</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number</Label>
              <Input
                id="registrationNumber"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="Business registration number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gstNumber">GST/Tax ID</Label>
              <Input
                id="gstNumber"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="GST or Tax identification number"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
              />
            </div>
          </div>

          {/* Social Links */}
          <div className="pt-4 border-t">
            <p className="font-medium text-sm mb-4">Social Media Links</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  type="url"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  type="url"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitter">Twitter</Label>
                <Input
                  id="twitter"
                  type="url"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://twitter.com/..."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveBusiness}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
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
      </Card>

      {/* General Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">General Settings</h2>
            <p className="text-sm text-gray-600">Update your store information</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store Name</Label>
              <Input id="storeName" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeEmail">Store Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storeEmail"
                  type="email"
                  value={storeEmail}
                  onChange={(e) => setStoreEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storePhone">Store Phone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storePhone"
                  value={storePhone}
                  onChange={(e) => setStorePhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeAddress">Store Address</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeDescription">Store Description</Label>
            <Textarea
              id="storeDescription"
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveGeneral}
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
      </Card>

      {/* Store Hours */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Store Hours</h2>
            <p className="text-sm text-gray-600">Set your operating hours for each day</p>
          </div>
        </div>

        <div className="space-y-3">
          {Object.entries(storeHours).map(([day, hours]) => (
            <div key={day} className="flex items-center gap-4 py-2 border-b last:border-0">
              <div className="w-24 font-medium capitalize">{day}</div>

              <Switch
                checked={hours.isOpen}
                onCheckedChange={(checked) => handleStoreHourChange(day, "isOpen", checked)}
              />

              {hours.isOpen && (
                <>
                  <Input
                    type="time"
                    value={hours.open}
                    onChange={(e) => handleStoreHourChange(day, "open", e.target.value)}
                    className="w-28"
                  />
                  <span className="text-gray-600">to</span>
                  <Input
                    type="time"
                    value={hours.close}
                    onChange={(e) => handleStoreHourChange(day, "close", e.target.value)}
                    className="w-28"
                  />
                </>
              )}

              {!hours.isOpen && <span className="text-gray-500 text-sm">Closed</span>}
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSaveStoreHours}
            disabled={isSaving}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Hours"
            )}
          </Button>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Notification Settings</h2>
            <p className="text-sm text-gray-600">Manage how you receive notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-gray-600">Receive email updates about your account</p>
            </div>
            <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <p className="font-medium">Order Notifications</p>
              <p className="text-sm text-gray-600">Get notified when orders are placed or updated</p>
            </div>
            <Switch checked={orderNotifications} onCheckedChange={setOrderNotifications} />
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">Marketing Emails</p>
              <p className="text-sm text-gray-600">Receive promotional emails and updates</p>
            </div>
            <Switch checked={marketingEmails} onCheckedChange={setMarketingEmails} />
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveNotifications}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Preferences"
              )}
            </Button>
          </div>
        </div>
      </Card>

    </div>
  )
}
