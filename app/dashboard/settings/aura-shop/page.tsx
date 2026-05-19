"use client"

import { useEffect, useState } from "react"
import { Globe, Loader2, Upload } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { settingsApi, type AuraShopHeroSlide } from "@/lib/settingsApi"
import { toast } from "sonner"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { AccessDenied } from "@/components/ui/access-denied"
import { useModuleGuard } from "@/hooks/use-module-guard"

const defaultAuraShopHeroSlides: AuraShopHeroSlide[] = [
  {
    imagePath: "",
    tag: "New Collection 2026",
    title: "Discover Products That Define Your Style",
    subtitle: "Curated selections across fashion, electronics, health & more — all in one place.",
    cta: "Explore Now",
    link: "/shop",
    gradient: "from-primary/80 via-primary/40 to-transparent",
    enabled: true,
  },
  {
    imagePath: "",
    tag: "Farm Fresh",
    title: "Fresh Grocery Delivered in 30 Minutes",
    subtitle: "Handpicked organic fruits, vegetables, and daily essentials at your doorstep.",
    cta: "Order Fresh",
    link: "/shop?category=grocery",
    gradient: "from-accent/70 via-accent/30 to-transparent",
    enabled: true,
  },
  {
    imagePath: "",
    tag: "Wellness Hub",
    title: "Your Health, Our Priority",
    subtitle: "Shop vitamins, supplements, and medical essentials with certified quality.",
    cta: "Shop Health",
    link: "/shop?category=health",
    gradient: "from-foreground/70 via-foreground/30 to-transparent",
    enabled: true,
  },
]

const resolveStorefrontPreviewUrl = (imagePath?: string) => {
  if (!imagePath) return ""
  if (imagePath.startsWith("http")) return imagePath

  const clean = imagePath.replace(/^\/+/, "")
  if (clean.startsWith("storage/")) return `http://localhost:8005/${clean}`
  if (clean.startsWith("uploads/")) return `/api/proxy/${clean}`
  return `/api/proxy/uploads/${clean}`
}

export default function AuraShopSettingsPage() {
  const { canRead } = useSaasAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("Retail")
  const [registrationNumber, setRegistrationNumber] = useState("")
  const [gstNumber, setGstNumber] = useState("")
  const [website, setWebsite] = useState("")
  const [facebook, setFacebook] = useState("")
  const [instagram, setInstagram] = useState("")
  const [twitter, setTwitter] = useState("")
  const [auraShopHeroAutoplayMs, setAuraShopHeroAutoplayMs] = useState(6000)
  const [auraShopHeroSlides, setAuraShopHeroSlides] = useState<AuraShopHeroSlide[]>(defaultAuraShopHeroSlides)

  useEffect(() => {
    loadSettings()
  }, [])

  const blocked = useModuleGuard('Aura Shop')
  if (blocked) return blocked

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const res = await settingsApi.getAll()
      const business = res.data.business || {}

      setBusinessName(business.businessName || "")
      setBusinessType(business.businessType || "Retail")
      setRegistrationNumber(business.registrationNumber || "")
      setGstNumber(business.gstNumber || "")
      setWebsite(business.website || "")
      setFacebook(business.socialLinks?.facebook || "")
      setInstagram(business.socialLinks?.instagram || "")
      setTwitter(business.socialLinks?.twitter || "")
      setAuraShopHeroAutoplayMs(business.auraShopHero?.autoplayMs || 6000)
      setAuraShopHeroSlides(
        business.auraShopHero?.slides?.length ? business.auraShopHero.slides : defaultAuraShopHeroSlides
      )
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to load Aura Shop settings")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAuraHeroSlideChange = (index: number, field: keyof AuraShopHeroSlide, value: string | boolean) => {
    setAuraShopHeroSlides((current) =>
      current.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, [field]: value } : slide
      )
    )
  }

  const handleUploadStorefrontImage = async (index: number, file: File) => {
    try {
      setIsSaving(true)
      const res = await settingsApi.uploadStorefrontImage(file)
      handleAuraHeroSlideChange(index, "imagePath", res.data.imagePath)
      toast.success(`Slide ${index + 1} image uploaded successfully`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to upload storefront image")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      await settingsApi.updateBusiness({
        businessName,
        businessType,
        registrationNumber,
        gstNumber,
        website,
        socialLinks: { facebook, instagram, twitter },
        auraShopHero: {
          autoplayMs: auraShopHeroAutoplayMs,
          slides: auraShopHeroSlides,
        },
      })
      toast.success("Aura Shop settings saved successfully")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save Aura Shop settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="text-gray-600">Loading Aura Shop settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Aura Shop</h1>
        <p className="mt-1 text-gray-600">Manage the Aura Shop storefront homepage hero slider.</p>
      </div>

      <Card className="p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
            <Globe className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Homepage Hero</h2>
            <p className="text-sm text-gray-600">Control the large slider shown on the Aura Shop landing page.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="hero-autoplay">Autoplay Interval (milliseconds)</Label>
            <Input
              id="hero-autoplay"
              type="number"
              min="2000"
              step="500"
              value={auraShopHeroAutoplayMs}
              onChange={(e) => setAuraShopHeroAutoplayMs(parseInt(e.target.value || "6000", 10))}
            />
            <p className="text-xs text-gray-500">Example: `6000` rotates slides every 6 seconds.</p>
          </div>

          <div className="space-y-4">
            {auraShopHeroSlides.map((slide, index) => (
              <div key={index} className="space-y-4 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Slide {index + 1}</h3>
                    <p className="text-sm text-gray-500">Edit image, headline, CTA, and link.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Enabled</span>
                    <Switch
                      checked={slide.enabled}
                      onCheckedChange={(checked) => handleAuraHeroSlideChange(index, "enabled", checked)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
                  <div className="space-y-3">
                    {slide.imagePath ? (
                      <img
                        src={resolveStorefrontPreviewUrl(slide.imagePath)}
                        alt={`Slide ${index + 1}`}
                        className="h-40 w-full rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400">
                        No image uploaded
                      </div>
                    )}

                    <div className="cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition hover:bg-gray-50">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files?.[0] && handleUploadStorefrontImage(index, e.target.files[0])}
                        className="hidden"
                        id={`hero-slide-image-${index}`}
                      />
                      <label htmlFor={`hero-slide-image-${index}`} className="block cursor-pointer">
                        <Upload className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                        <p className="text-sm font-medium text-violet-600 hover:text-violet-700">
                          {slide.imagePath ? "Change slide image" : "Upload slide image"}
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG, WEBP up to 10MB</p>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Badge Tag</Label>
                      <Input value={slide.tag} onChange={(e) => handleAuraHeroSlideChange(index, "tag", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>CTA Label</Label>
                      <Input value={slide.cta} onChange={(e) => handleAuraHeroSlideChange(index, "cta", e.target.value)} />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Title</Label>
                      <Textarea value={slide.title} onChange={(e) => handleAuraHeroSlideChange(index, "title", e.target.value)} rows={2} />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Subtitle</Label>
                      <Textarea value={slide.subtitle} onChange={(e) => handleAuraHeroSlideChange(index, "subtitle", e.target.value)} rows={3} />
                    </div>

                    <div className="space-y-2">
                      <Label>Button Link</Label>
                      <Input value={slide.link} onChange={(e) => handleAuraHeroSlideChange(index, "link", e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Overlay Gradient Classes</Label>
                      <Input value={slide.gradient} onChange={(e) => handleAuraHeroSlideChange(index, "gradient", e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="bg-violet-600 hover:bg-violet-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Aura Shop Settings"
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
