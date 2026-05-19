"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Building2, Mail, Phone, MapPin, Bell, Clock, Upload, Loader2, CreditCard } from "lucide-react"
import { settingsApi, type StoreHours, type SSLCommerzConfig, type PortWalletConfig, type StripeConfig, type PayPalConfig, type BkashConfig, type NagadConfig, type CodShippingDepositConfig } from "@/lib/settingsApi"
import { toast } from "sonner"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"

type SavingSection = "general" | "business" | "notifications" | "storeHours" | "logo" | "banner" | "gateways" | null

const DEFAULT_GENERAL_SETTINGS = {
  storeName: "Dashtar Store",
  storeEmail: "store@dashtar.com",
  storePhone: "+1 (555) 123-4567",
  storeAddress: "123 Business St, New York, NY 10001",
  storeDescription: "Your one-stop shop for all your electronic and accessory needs.",
}

const DEFAULT_BUSINESS_SETTINGS = {
  businessName: "Dashtar Store",
  businessType: "Retail",
  registrationNumber: "REG-2026-001",
  gstNumber: "GST-123456789",
  website: "https://dashtar.com",
  socialLinks: {
    facebook: "https://facebook.com/dashtar",
    instagram: "https://instagram.com/dashtar",
    twitter: "https://twitter.com/dashtar",
  },
  logoUrl: "",
  bannerUrl: "",
}

const DEFAULT_NOTIFICATION_SETTINGS = {
  emailNotifications: true,
  orderNotifications: true,
  marketingEmails: false,
}

const DEFAULT_STORE_HOURS: StoreHours = {
  monday: { open: "09:00", close: "17:00", isOpen: true },
  tuesday: { open: "09:00", close: "17:00", isOpen: true },
  wednesday: { open: "09:00", close: "17:00", isOpen: true },
  thursday: { open: "09:00", close: "17:00", isOpen: true },
  friday: { open: "09:00", close: "17:00", isOpen: true },
  saturday: { open: "10:00", close: "15:00", isOpen: true },
  sunday: { open: "", close: "", isOpen: false },
}

const mergeStoreHours = (storeHours: StoreHours = {}) => {
  return Object.entries(DEFAULT_STORE_HOURS).reduce<StoreHours>((hours, [day, defaults]) => {
    const dayHours = storeHours[day] ?? {}
    hours[day] = {
      open: dayHours.open ?? defaults.open,
      close: dayHours.close ?? defaults.close,
      isOpen: dayHours.isOpen ?? defaults.isOpen,
    }
    return hours
  }, {})
}

export default function SettingsPage() {
  const { canRead } = useSaasAuth()
  // Loading state
  const [isLoading, setIsLoading] = useState(true)
  const [savingSection, setSavingSection] = useState<SavingSection>(null)

  // General Settings
  const [storeName, setStoreName] = useState(DEFAULT_GENERAL_SETTINGS.storeName)
  const [storeEmail, setStoreEmail] = useState(DEFAULT_GENERAL_SETTINGS.storeEmail)
  const [storePhone, setStorePhone] = useState(DEFAULT_GENERAL_SETTINGS.storePhone)
  const [storeAddress, setStoreAddress] = useState(DEFAULT_GENERAL_SETTINGS.storeAddress)
  const [storeDescription, setStoreDescription] = useState(DEFAULT_GENERAL_SETTINGS.storeDescription)
  const [primaryColor, setPrimaryColor] = useState("#6B1A2A")
  const [accentColor, setAccentColor] = useState("#B8963E")
  const [backgroundColor, setBackgroundColor] = useState("#F0EBE3")

  // Business Settings
  const [businessName, setBusinessName] = useState(DEFAULT_BUSINESS_SETTINGS.businessName)
  const [businessType, setBusinessType] = useState(DEFAULT_BUSINESS_SETTINGS.businessType)
  const [registrationNumber, setRegistrationNumber] = useState(DEFAULT_BUSINESS_SETTINGS.registrationNumber)
  const [gstNumber, setGstNumber] = useState(DEFAULT_BUSINESS_SETTINGS.gstNumber)
  const [website, setWebsite] = useState(DEFAULT_BUSINESS_SETTINGS.website)
  const [facebook, setFacebook] = useState(DEFAULT_BUSINESS_SETTINGS.socialLinks.facebook)
  const [instagram, setInstagram] = useState(DEFAULT_BUSINESS_SETTINGS.socialLinks.instagram)
  const [twitter, setTwitter] = useState(DEFAULT_BUSINESS_SETTINGS.socialLinks.twitter)
  const [logoUrl, setLogoUrl] = useState(DEFAULT_BUSINESS_SETTINGS.logoUrl)
  const [bannerUrl, setBannerUrl] = useState(DEFAULT_BUSINESS_SETTINGS.bannerUrl)

  // Promo Banner Settings
  const [promoBannerEnabled, setPromoBannerEnabled] = useState(false)
  const [promoBannerTitle, setPromoBannerTitle] = useState("Flash Sale — Up to 60% Off Everything")
  const [promoBannerSubtitle, setPromoBannerSubtitle] = useState("Limited time offer on thousands of products. Don't miss out!")
  const [promoBannerCta, setPromoBannerCta] = useState("Shop the Sale")
  const [promoBannerLink, setPromoBannerLink] = useState("/shop")

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(DEFAULT_NOTIFICATION_SETTINGS.emailNotifications)
  const [orderNotifications, setOrderNotifications] = useState(DEFAULT_NOTIFICATION_SETTINGS.orderNotifications)
  const [marketingEmails, setMarketingEmails] = useState(DEFAULT_NOTIFICATION_SETTINGS.marketingEmails)

  // Store Hours
  const [storeHours, setStoreHours] = useState<StoreHours>(mergeStoreHours())

  // Payment Gateway Credentials
  const [sslcommerz, setSslcommerz] = useState<SSLCommerzConfig>({
    enabled: false, store_id: "", store_passwd: "", sandbox: true,
  })
  const [portwallet, setPortwallet] = useState<PortWalletConfig>({
    enabled: false, app_key: "", app_secret: "", sandbox: true,
  })
  const [stripe, setStripe] = useState<StripeConfig>({
    enabled: false, publishable_key: "", secret_key: "", webhook_secret: "",
  })
  const [paypal, setPaypal] = useState<PayPalConfig>({
    enabled: false, client_id: "", client_secret: "", sandbox: true,
  })
  const [bkash, setBkash] = useState<BkashConfig>({
    enabled: false, app_key: "", app_secret: "", username: "", password: "", sandbox: true,
  })
  const [nagad, setNagad] = useState<NagadConfig>({
    enabled: false, merchant_id: "", private_key: "", nagad_public_key: "", sandbox: true,
  })
  const [codDeposit, setCodDeposit] = useState<CodShippingDepositConfig>({
    enabled: false, gateway: "sslcommerz", custom_amount: 0,
  })

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const blocked = useModuleGuard('Settings')
  if (blocked) return blocked

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const [res, hoursRes] = await Promise.all([
        settingsApi.getAll(),
        settingsApi.getStoreHours(),
      ])
      const data = res.data

      // Load all settings
      const general = data.general ?? {}
      setStoreName(general.storeName ?? DEFAULT_GENERAL_SETTINGS.storeName)
      setStoreEmail(general.storeEmail ?? DEFAULT_GENERAL_SETTINGS.storeEmail)
      setStorePhone(general.storePhone ?? DEFAULT_GENERAL_SETTINGS.storePhone)
      setStoreAddress(general.storeAddress ?? DEFAULT_GENERAL_SETTINGS.storeAddress)
      setStoreDescription(general.storeDescription ?? DEFAULT_GENERAL_SETTINGS.storeDescription)
      if (general.primaryColor) setPrimaryColor(general.primaryColor)
      if (general.accentColor) setAccentColor(general.accentColor)
      if (general.backgroundColor) setBackgroundColor(general.backgroundColor)

      const business = data.business ?? {}
      const socialLinks = business.socialLinks ?? {}
      setBusinessName(business.businessName ?? DEFAULT_BUSINESS_SETTINGS.businessName)
      setBusinessType(business.businessType ?? DEFAULT_BUSINESS_SETTINGS.businessType)
      setRegistrationNumber(business.registrationNumber ?? "")
      setGstNumber(business.gstNumber ?? DEFAULT_BUSINESS_SETTINGS.gstNumber)
      setWebsite(business.website ?? DEFAULT_BUSINESS_SETTINGS.website)
      setFacebook(socialLinks.facebook ?? DEFAULT_BUSINESS_SETTINGS.socialLinks.facebook)
      setInstagram(socialLinks.instagram ?? DEFAULT_BUSINESS_SETTINGS.socialLinks.instagram)
      setTwitter(socialLinks.twitter ?? DEFAULT_BUSINESS_SETTINGS.socialLinks.twitter)
      setLogoUrl(business.logoUrl ?? "")
      setBannerUrl(business.bannerUrl ?? "")
      const promo = (business.promoBanner ?? {}) as any
      if (promo.title) setPromoBannerTitle(promo.title)
      if (promo.subtitle) setPromoBannerSubtitle(promo.subtitle)
      if (promo.cta) setPromoBannerCta(promo.cta)
      if (promo.link) setPromoBannerLink(promo.link)
      if (typeof promo.enabled === "boolean") setPromoBannerEnabled(promo.enabled)

      const notifications = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(data.notifications ?? {}) }
      setEmailNotifications(notifications.emailNotifications)
      setOrderNotifications(notifications.orderNotifications)
      setMarketingEmails(notifications.marketingEmails)

      // Load store hours from dedicated endpoint (not included in getAll)
      setStoreHours(mergeStoreHours(hoursRes.data))

      // Load gateway credentials
      const payment = data.payment ?? {}
      if (payment.sslcommerz) {
        const s = payment.sslcommerz
        setSslcommerz({ enabled: Boolean(s.enabled), store_id: s.store_id ?? "", store_passwd: s.store_passwd ?? "", sandbox: s.sandbox ?? true })
      }
      if (payment.portwallet) {
        const p = payment.portwallet
        setPortwallet({ enabled: Boolean(p.enabled), app_key: p.app_key ?? "", app_secret: p.app_secret ?? "", sandbox: p.sandbox ?? true })
      }
      if (payment.stripe) {
        const s = payment.stripe
        setStripe({ enabled: Boolean(s.enabled), publishable_key: s.publishable_key ?? "", secret_key: s.secret_key ?? "", webhook_secret: s.webhook_secret ?? "" })
      }
      if (payment.paypal) {
        const p = payment.paypal
        setPaypal({ enabled: Boolean(p.enabled), client_id: p.client_id ?? "", client_secret: p.client_secret ?? "", sandbox: p.sandbox ?? true })
      }
      if (payment.bkash) {
        const b = payment.bkash
        setBkash({ enabled: Boolean(b.enabled), app_key: b.app_key ?? "", app_secret: b.app_secret ?? "", username: b.username ?? "", password: b.password ?? "", sandbox: b.sandbox ?? true })
      }
      if (payment.nagad) {
        const n = payment.nagad
        setNagad({ enabled: Boolean(n.enabled), merchant_id: n.merchant_id ?? "", private_key: n.private_key ?? "", nagad_public_key: n.nagad_public_key ?? "", sandbox: n.sandbox ?? true })
      }
      if (payment.cod_shipping_deposit) setCodDeposit({ ...{ enabled: false, gateway: "sslcommerz" as const, custom_amount: 0 }, ...payment.cod_shipping_deposit })

    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSaveGeneral = async () => {
    try {
      setSavingSection("general")
      await settingsApi.updateGeneral({
        storeName,
        storeEmail,
        storePhone,
        storeAddress,
        storeDescription,
        primaryColor,
        accentColor,
        backgroundColor,
      })
      toast.success("General settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveBusiness = async () => {
    try {
      setSavingSection("business")
      await settingsApi.updateBusiness({
        businessName,
        businessType,
        registrationNumber,
        gstNumber,
        website,
        socialLinks: { facebook, instagram, twitter },
        promoBanner: {
          enabled: promoBannerEnabled,
          title: promoBannerTitle,
          subtitle: promoBannerSubtitle,
          cta: promoBannerCta,
          link: promoBannerLink,
        },
      })
      toast.success("Business settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveGateways = async () => {
    try {
      setSavingSection("gateways")
      await settingsApi.updatePayment({ sslcommerz, portwallet, stripe, paypal, bkash, nagad, cod_shipping_deposit: codDeposit })
      toast.success("Gateway credentials saved!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save gateway credentials")
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveNotifications = async () => {
    try {
      setSavingSection("notifications")
      await settingsApi.updateNotifications({
        emailNotifications,
        orderNotifications,
        marketingEmails,
      })
      toast.success("Notification settings saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setSavingSection(null)
    }
  }

  const handleSaveStoreHours = async () => {
    try {
      setSavingSection("storeHours")
      const res = await settingsApi.updateStoreHours(mergeStoreHours(storeHours))
      if (Object.keys(res.data).length > 0) {
        setStoreHours(mergeStoreHours(res.data))
      }
      toast.success("Store hours saved successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save settings")
    } finally {
      setSavingSection(null)
    }
  }

  const handleUploadLogo = async (file: File) => {
    try {
      setSavingSection("logo")
      const res = await settingsApi.uploadLogo(file)
      setLogoUrl(res.data.logoUrl)
      toast.success("Logo uploaded successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload logo")
    } finally {
      setSavingSection(null)
    }
  }

  const handleUploadBanner = async (file: File) => {
    try {
      setSavingSection("banner")
      const res = await settingsApi.uploadBanner(file)
      setBannerUrl(res.data.bannerUrl)
      toast.success("Banner uploaded successfully!")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload banner")
    } finally {
      setSavingSection(null)
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

          {/* Promo Banner */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Promo Banner</h3>
                <p className="text-xs text-gray-500">Shown on homepage between hero and products</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-600">{promoBannerEnabled ? "Enabled" : "Disabled"}</span>
                <button
                  type="button"
                  onClick={() => setPromoBannerEnabled(!promoBannerEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${promoBannerEnabled ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${promoBannerEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Banner Title</Label>
                <Input value={promoBannerTitle} onChange={(e) => setPromoBannerTitle(e.target.value)} placeholder="Flash Sale — Up to 60% Off Everything" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Subtitle</Label>
                <Input value={promoBannerSubtitle} onChange={(e) => setPromoBannerSubtitle(e.target.value)} placeholder="Limited time offer on thousands of products." />
              </div>
              <div className="space-y-1">
                <Label>CTA Button Text</Label>
                <Input value={promoBannerCta} onChange={(e) => setPromoBannerCta(e.target.value)} placeholder="Shop the Sale" />
              </div>
              <div className="space-y-1">
                <Label>CTA Link</Label>
                <Input value={promoBannerLink} onChange={(e) => setPromoBannerLink(e.target.value)} placeholder="/shop" />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSaveBusiness}
              disabled={savingSection === "business"}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingSection === "business" ? (
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

          {/* Brand Colors */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Brand Colors</Label>
            <p className="text-xs text-gray-500">These colors are applied to the storefront automatically.</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Primary Color", value: primaryColor, setter: setPrimaryColor },
                { label: "Accent Color", value: accentColor, setter: setAccentColor },
                { label: "Background Color", value: backgroundColor, setter: setBackgroundColor },
              ].map(({ label, value, setter }) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="text-xs text-gray-600">{label}</label>
                  <div className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent shrink-0"
                    />
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => {
                        const v = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setter(v)
                      }}
                      maxLength={7}
                      className="w-full text-xs font-mono uppercase bg-transparent outline-none text-gray-700"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveGeneral}
              disabled={savingSection === "general"}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {savingSection === "general" ? (
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
            disabled={savingSection === "storeHours"}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {savingSection === "storeHours" ? (
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
              disabled={savingSection === "notifications"}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {savingSection === "notifications" ? (
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

      {/* Payment Gateway Credentials */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Payment Gateway Credentials</h3>
            <p className="text-sm text-gray-600">SSLCommerz, PortWallet, Stripe, and PayPal credentials for online payments</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* SSLCommerz */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">SSLCommerz</p>
                <p className="text-xs text-gray-500">Covers bKash, Nagad, Rocket, Cards, Net Banking</p>
              </div>
              <Switch
                checked={sslcommerz.enabled}
                onCheckedChange={(v) => setSslcommerz((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Store ID</Label>
                <Input
                  value={sslcommerz.store_id}
                  onChange={(e) => setSslcommerz((p) => ({ ...p, store_id: e.target.value }))}
                  placeholder="your_store_id"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Store Password</Label>
                <Input
                  type="password"
                  value={sslcommerz.store_passwd}
                  onChange={(e) => setSslcommerz((p) => ({ ...p, store_passwd: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={sslcommerz.sandbox}
                onCheckedChange={(v) => setSslcommerz((p) => ({ ...p, sandbox: v }))}
              />
              <Label className="text-xs text-gray-600">Sandbox mode (disable for live payments)</Label>
            </div>
            {sslcommerz.sandbox && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700">SSLCommerz Sandbox</p>
                <p className="text-amber-600">Register at <a href="https://developer.sslcommerz.com/registration/" target="_blank" rel="noreferrer" className="underline">developer.sslcommerz.com</a> to get a free sandbox Store ID &amp; Password.</p>
                <p className="text-amber-600 font-mono">Sandbox URL: https://sandbox.sslcommerz.com</p>
                <p className="text-amber-500 mt-1">⚠ Callback URLs (success/fail/cancel/IPN) must be publicly accessible (use ngrok/localtunnel for local testing)</p>
              </div>
            )}
          </div>

          {/* PortWallet */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">PortWallet</p>
                <p className="text-xs text-gray-500">Cards and Mobile Banking</p>
              </div>
              <Switch
                checked={portwallet.enabled}
                onCheckedChange={(v) => setPortwallet((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">App Key</Label>
                <Input
                  value={portwallet.app_key}
                  onChange={(e) => setPortwallet((p) => ({ ...p, app_key: e.target.value }))}
                  placeholder="your_app_key"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">App Secret</Label>
                <Input
                  type="password"
                  value={portwallet.app_secret}
                  onChange={(e) => setPortwallet((p) => ({ ...p, app_secret: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={portwallet.sandbox}
                onCheckedChange={(v) => setPortwallet((p) => ({ ...p, sandbox: v }))}
              />
              <Label className="text-xs text-gray-600">Sandbox mode (disable for live payments)</Label>
            </div>
            {portwallet.sandbox && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700">PortWallet Sandbox</p>
                <p className="text-amber-600">Register at <a href="https://portwallet.com" target="_blank" rel="noreferrer" className="underline">portwallet.com</a> to get sandbox App Key &amp; Secret.</p>
                <p className="text-amber-600 font-mono">Sandbox URL: https://sandbox.portwallet.com</p>
                <p className="text-amber-500 mt-1">⚠ Callback URL must be publicly accessible (use ngrok/localtunnel for local testing)</p>
              </div>
            )}
          </div>

          {/* Stripe */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Stripe</p>
                <p className="text-xs text-gray-500">Credit / Debit Card payments globally</p>
              </div>
              <Switch
                checked={stripe.enabled}
                onCheckedChange={(v) => setStripe((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Publishable Key</Label>
                <Input
                  value={stripe.publishable_key}
                  onChange={(e) => setStripe((p) => ({ ...p, publishable_key: e.target.value }))}
                  placeholder="pk_test_..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Secret Key</Label>
                <Input
                  type="password"
                  value={stripe.secret_key}
                  onChange={(e) => setStripe((p) => ({ ...p, secret_key: e.target.value }))}
                  placeholder="sk_test_..."
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Webhook Secret</Label>
                <Input
                  type="password"
                  value={stripe.webhook_secret}
                  onChange={(e) => setStripe((p) => ({ ...p, webhook_secret: e.target.value }))}
                  placeholder="whsec_..."
                />
              </div>
            </div>
            {(stripe.secret_key.startsWith("sk_test_") || stripe.secret_key === "") && (
              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-blue-700">Stripe Test Mode</p>
                <p className="text-blue-600">Use <span className="font-mono">pk_test_...</span> / <span className="font-mono">sk_test_...</span> keys from <a href="https://dashboard.stripe.com/test/apikeys" target="_blank" rel="noreferrer" className="underline">dashboard.stripe.com</a></p>
                <p className="text-blue-600 font-mono">Test card: 4242 4242 4242 4242 · Any future date · Any CVC</p>
                <p className="text-blue-600 font-mono">Decline card: 4000 0000 0000 0002</p>
                <p className="text-blue-500 mt-1">⚠ For webhooks: run <span className="font-mono">stripe listen --forward-to localhost:8005/api/gateway/stripe/webhook</span> locally, or use ngrok and register endpoint in Stripe dashboard</p>
              </div>
            )}
          </div>

          {/* PayPal */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">PayPal</p>
                <p className="text-xs text-gray-500">PayPal account and card payments</p>
              </div>
              <Switch
                checked={paypal.enabled}
                onCheckedChange={(v) => setPaypal((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Client ID</Label>
                <Input
                  value={paypal.client_id}
                  onChange={(e) => setPaypal((p) => ({ ...p, client_id: e.target.value }))}
                  placeholder="AY..."
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Client Secret</Label>
                <Input
                  type="password"
                  value={paypal.client_secret}
                  onChange={(e) => setPaypal((p) => ({ ...p, client_secret: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={paypal.sandbox}
                onCheckedChange={(v) => setPaypal((p) => ({ ...p, sandbox: v }))}
              />
              <Label className="text-xs text-gray-600">Sandbox mode (disable for live payments)</Label>
            </div>
            {paypal.sandbox && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700">PayPal Sandbox</p>
                <p className="text-amber-600">Get sandbox Client ID &amp; Secret from <a href="https://developer.paypal.com/dashboard/applications/sandbox" target="_blank" rel="noreferrer" className="underline">developer.paypal.com</a> → My Apps &amp; Credentials → Sandbox.</p>
                <p className="text-amber-600">Create a sandbox buyer account at <a href="https://sandbox.paypal.com" target="_blank" rel="noreferrer" className="underline">sandbox.paypal.com</a> to test payments.</p>
                <p className="text-amber-600 font-mono">Sandbox API: https://api-m.sandbox.paypal.com</p>
                <p className="text-amber-500 mt-1">⚠ Return/cancel URLs must be publicly accessible (use ngrok/localtunnel for local testing)</p>
              </div>
            )}
          </div>

          {/* bKash */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">bKash</p>
                <p className="text-xs text-gray-500">Direct bKash merchant payments — no SSLCommerz needed</p>
              </div>
              <Switch
                checked={bkash.enabled}
                onCheckedChange={(v) => setBkash((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">App Key</Label>
                <Input
                  value={bkash.app_key}
                  onChange={(e) => setBkash((p) => ({ ...p, app_key: e.target.value }))}
                  placeholder="bkash_app_key"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">App Secret</Label>
                <Input
                  type="password"
                  value={bkash.app_secret}
                  onChange={(e) => setBkash((p) => ({ ...p, app_secret: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Username</Label>
                <Input
                  value={bkash.username}
                  onChange={(e) => setBkash((p) => ({ ...p, username: e.target.value }))}
                  placeholder="merchant username"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input
                  type="password"
                  value={bkash.password}
                  onChange={(e) => setBkash((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={bkash.sandbox}
                onCheckedChange={(v) => setBkash((p) => ({ ...p, sandbox: v }))}
              />
              <Label className="text-xs text-gray-600">Sandbox mode (disable for live payments)</Label>
            </div>
            {bkash.sandbox && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700">Sandbox Test Credentials</p>
                <p className="text-amber-600 font-mono">App Key: 4f6o0cjiki2rfm34kfdadl1eqq</p>
                <p className="text-amber-600 font-mono">App Secret: 2is7hdktrekvrbljjh44ll3d9l1dtjo4pasmjvs5vl5qr3fug4b</p>
                <p className="text-amber-600 font-mono">Username: sandboxTokenizedUser02</p>
                <p className="text-amber-600 font-mono">Password: sandboxTokenizedUser02@12345</p>
                <p className="text-amber-500 mt-1">⚠ Callback URL must be publicly accessible (use ngrok/localtunnel for local testing)</p>
              </div>
            )}
          </div>

          {/* Nagad */}
          <div className="border rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Nagad</p>
                <p className="text-xs text-gray-500">Direct Nagad merchant payments — no SSLCommerz needed</p>
              </div>
              <Switch
                checked={nagad.enabled}
                onCheckedChange={(v) => setNagad((p) => ({ ...p, enabled: v }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Merchant ID</Label>
                <Input
                  value={nagad.merchant_id}
                  onChange={(e) => setNagad((p) => ({ ...p, merchant_id: e.target.value }))}
                  placeholder="686969"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nagad Public Key (leave blank for sandbox default)</Label>
                <Input
                  value={nagad.nagad_public_key}
                  onChange={(e) => setNagad((p) => ({ ...p, nagad_public_key: e.target.value }))}
                  placeholder="Nagad-provided RSA public key"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Your RSA Private Key (base64, no headers)</Label>
                <Input
                  type="password"
                  value={nagad.private_key}
                  onChange={(e) => setNagad((p) => ({ ...p, private_key: e.target.value }))}
                  placeholder="MIIEpAIBAAKCAQEA..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={nagad.sandbox}
                onCheckedChange={(v) => setNagad((p) => ({ ...p, sandbox: v }))}
              />
              <Label className="text-xs text-gray-600">Sandbox mode (disable for live payments)</Label>
            </div>
            {nagad.sandbox && (
              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs space-y-1">
                <p className="font-semibold text-amber-700">Sandbox Test Credentials (seeded)</p>
                <p className="text-amber-600 font-mono">Merchant ID: 683002007104225</p>
                <p className="text-amber-600 font-mono">Private Key: from anovob/laravel-nagad-api example (already in DB)</p>
                <p className="text-amber-500 mt-1">⚠ Nagad sandbox requires merchant registration at <a href="https://auth.mynagad.com:10900/" target="_blank" rel="noreferrer" className="underline">auth.mynagad.com:10900</a> for a real sandbox account</p>
                <p className="text-amber-500">⚠ Callback URL must be publicly accessible (use ngrok/localtunnel for local testing)</p>
              </div>
            )}
          </div>

          {/* COD Shipping Deposit */}
          <div className="border rounded-lg p-4 space-y-4 bg-amber-50 border-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-amber-900">COD Shipping Deposit</p>
                <p className="text-xs text-amber-700">
                  Require customers to pay shipping cost upfront before Cash on Delivery order is confirmed
                </p>
              </div>
              <Switch
                checked={codDeposit.enabled}
                onCheckedChange={(v) => setCodDeposit((p) => ({ ...p, enabled: v }))}
              />
            </div>
            {codDeposit.enabled && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Payment Gateway for Deposit</Label>
                  <select
                    value={codDeposit.gateway}
                    onChange={(e) => setCodDeposit((p) => ({ ...p, gateway: e.target.value as "sslcommerz" | "portwallet" | "bkash" | "nagad" | "stripe" | "paypal" }))}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="sslcommerz">SSLCommerz (bKash, Nagad, Rocket, Cards)</option>
                    <option value="portwallet">PortWallet (Cards, Mobile Banking)</option>
                    <option value="bkash">bKash (Direct)</option>
                    <option value="nagad">Nagad (Direct)</option>
                    <option value="stripe">Stripe (Card)</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fixed Deposit Amount (BDT) — 0 = use actual shipping cost</Label>
                  <Input
                    type="number"
                    min={0}
                    value={codDeposit.custom_amount}
                    onChange={(e) => setCodDeposit((p) => ({ ...p, custom_amount: Number(e.target.value) }))}
                    placeholder="0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSaveGateways} disabled={savingSection === "gateways"}>
            {savingSection === "gateways" ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : "Save Gateway Credentials"}
          </Button>
        </div>
      </Card>

    </div>
  )
}
