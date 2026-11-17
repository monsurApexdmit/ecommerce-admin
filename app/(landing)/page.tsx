"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  ShoppingCart,
  BarChart3,
  Package,
  Users,
  Store,
  Zap,
  Shield,
  Globe,
  ChevronRight,
  Check,
  Star,
  Menu,
  X,
  ArrowRight,
  TrendingUp,
  Layers,
  Cpu,
  CreditCard,
  Truck,
  Tag,
  Warehouse,
  RefreshCcw,
  Bell,
  Scissors,
  MapPin,
  TicketPercent,
  BadgeCheck,
} from "lucide-react"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Trans, useTranslation } from "react-i18next"
import { LanguageSwitcher } from "@/components/shell/language-switcher"

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Navbar() {
  const { t } = useTranslation(["auth", "common"])
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      className={cn("fixed top-0 left-0 right-0 z-50 transition-all duration-300", scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" : "bg-transparent")}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className={cn("font-bold text-lg", scrolled ? "text-gray-900" : "text-white")}>StockFlow</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className={cn("text-sm hover:text-emerald-400 transition-colors", scrolled ? "text-gray-600" : "text-white/80")}>{t("auth:landing.nav.features")}</a>
            <a href="#modules" className={cn("text-sm hover:text-emerald-400 transition-colors", scrolled ? "text-gray-600" : "text-white/80")}>{t("auth:landing.nav.modules")}</a>
            <a href="#pricing" className={cn("text-sm hover:text-emerald-400 transition-colors", scrolled ? "text-gray-600" : "text-white/80")}>{t("auth:landing.nav.pricing")}</a>
            <a href="#testimonials" className={cn("text-sm hover:text-emerald-400 transition-colors", scrolled ? "text-gray-600" : "text-white/80")}>{t("auth:landing.nav.reviews")}</a>
          </div>

          <div className="flex items-center gap-3">
            {/* Language: visible on every screen size, top-right */}
            <LanguageSwitcher />

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/auth/login" className={cn("text-sm font-medium transition-colors whitespace-nowrap", scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/80 hover:text-white")}>{t("auth:login.signIn")}</Link>
              <Button asChild>
                <Link href="/auth/signup">{t("auth:login.startTrial")}</Link>
              </Button>
            </div>

            {/* Mobile menu */}
            <WithTooltip content={t("auth:landing.nav.toggleMenu")}><Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label={t("auth:landing.nav.toggleMenu")}>
              {open ? <X className={cn("w-5 h-5", scrolled ? "text-gray-900" : "text-white")} /> : <Menu className={cn("w-5 h-5", scrolled ? "text-gray-900" : "text-white")} />}
            </Button></WithTooltip>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>{t("auth:landing.nav.features")}</a>
          <a href="#modules" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>{t("auth:landing.nav.modules")}</a>
          <a href="#pricing" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>{t("auth:landing.nav.pricing")}</a>
          <a href="#testimonials" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>{t("auth:landing.nav.reviews")}</a>
          <div className="pt-2 flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link href="/auth/login">{t("auth:login.signIn")}</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/signup">{t("auth:login.startTrial")}</Link>
            </Button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
const HERO_STATS = [
  { value: "auth:landing.hero.stats.modulesValue", label: "auth:landing.hero.stats.modules" },
  { value: "auth:landing.hero.stats.trialValue", label: "auth:landing.hero.stats.trial" },
  { value: "auth:landing.hero.stats.locationsValue", label: "auth:landing.hero.stats.locations" },
  { value: "auth:landing.hero.stats.syncValue", label: "auth:landing.hero.stats.sync" },
] as const

function Hero() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section className="relative min-h-screen flex items-center bg-gradient-to-br from-gray-950 via-gray-900 to-emerald-950 overflow-hidden">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <Badge variant="secondary" className="mb-8">
          <BadgeCheck />
          {t("auth:landing.hero.badge")}
        </Badge>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
          <Trans
            t={t}
            i18nKey="auth:landing.hero.title"
            components={{
              hl: <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300" />,
              br: <br />,
            }}
          />
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("auth:landing.hero.subtitle")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/auth/signup">
              {t("auth:landing.hero.ctaTrial")}
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href="#features">{t("auth:landing.hero.ctaFeatures")}</a>
          </Button>
        </div>

        <p className="text-gray-500 text-sm mt-5">{t("auth:landing.hero.note")}</p>

        {/* Stats row */}
        <Separator className="mt-20 bg-gray-800" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 pt-12">
          {HERO_STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">{t(s.value)}</div>
              <div className="text-sm text-gray-500 mt-1">{t(s.label)}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
const features = [
  {
    icon: Package,
    title: "auth:landing.features.inventoryTitle",
    desc: "auth:landing.features.inventoryDesc",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: ShoppingCart,
    title: "auth:landing.features.posTitle",
    desc: "auth:landing.features.posDesc",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Store,
    title: "auth:landing.features.storefrontTitle",
    desc: "auth:landing.features.storefrontDesc",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Users,
    title: "auth:landing.features.staffTitle",
    desc: "auth:landing.features.staffDesc",
    color: "bg-orange-50 text-orange-600",
  },
  {
    icon: BarChart3,
    title: "auth:landing.features.analyticsTitle",
    desc: "auth:landing.features.analyticsDesc",
    color: "bg-pink-50 text-pink-600",
  },
  {
    icon: Truck,
    title: "auth:landing.features.shipmentsTitle",
    desc: "auth:landing.features.shipmentsDesc",
    color: "bg-teal-50 text-teal-600",
  },
] as const

function Features() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">
            <Zap /> {t("auth:landing.features.badge")}
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t("auth:landing.features.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("auth:landing.features.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <Card key={f.title} className="gap-0 p-6">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", f.color)}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2 text-lg">{t(f.title)}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{t(f.desc)}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Modules Grid ─────────────────────────────────────────────────────────────
const modules = [
  { icon: Package, label: "auth:landing.modules.products" },
  { icon: Warehouse, label: "auth:landing.modules.multiLocation" },
  { icon: ShoppingCart, label: "auth:landing.modules.sells" },
  { icon: CreditCard, label: "auth:landing.modules.paymentMethods" },
  { icon: Tag, label: "auth:landing.modules.coupons" },
  { icon: Truck, label: "auth:landing.modules.shipments" },
  { icon: RefreshCcw, label: "auth:landing.modules.returns" },
  { icon: Users, label: "auth:landing.modules.customers" },
  { icon: Globe, label: "auth:landing.modules.suppliers" },
  { icon: Layers, label: "auth:landing.modules.categories" },
  { icon: BarChart3, label: "auth:landing.modules.inventoryReports" },
  { icon: Bell, label: "auth:landing.modules.notifications" },
  { icon: Shield, label: "auth:landing.modules.roles" },
  { icon: TrendingUp, label: "auth:landing.modules.billing" },
  { icon: Scissors, label: "auth:landing.modules.tailor" },
  { icon: MapPin, label: "auth:landing.modules.locations" },
  { icon: TicketPercent, label: "auth:landing.modules.support" },
  { icon: Cpu, label: "auth:landing.modules.barcode" },
] as const

function Modules() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section id="modules" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("auth:landing.modules.title")}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("auth:landing.modules.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((m) => (
            <Card key={m.label} className="items-center gap-3 p-4 text-center">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <m.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium leading-tight">{t(m.label)}</span>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Dual App Section ─────────────────────────────────────────────────────────
const ADMIN_POINTS = [
  "auth:landing.dual.adminInventory",
  "auth:landing.dual.adminPos",
  "auth:landing.dual.adminStaff",
  "auth:landing.dual.adminSuppliers",
  "auth:landing.dual.adminAnalytics",
  "auth:landing.dual.adminBilling",
] as const

const STORE_POINTS = [
  "auth:landing.dual.storeCatalog",
  "auth:landing.dual.storeAccounts",
  "auth:landing.dual.storeWishlist",
  "auth:landing.dual.storeCheckout",
  "auth:landing.dual.storeTracking",
  "auth:landing.dual.storeBranding",
] as const

function DualApp() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t("auth:landing.dual.title")}
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("auth:landing.dual.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Admin card */}
          <Card className="p-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t("auth:landing.dual.adminEyebrow")}</p>
                  <p className="font-bold text-lg">StockFlow Dashboard</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {ADMIN_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    {t(item)}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <Link href="/auth/signup">
                  {t("auth:landing.dual.adminCta")} <ChevronRight />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Storefront card */}
          <Card className="p-8">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{t("auth:landing.dual.storeEyebrow")}</p>
                  <p className="font-bold text-lg">Aura Shop</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {STORE_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    {t(item)}
                  </li>
                ))}
              </ul>
              <Button asChild>
                <a href="#pricing">
                  {t("auth:landing.dual.storeCta")} <ChevronRight />
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
// Plan names and prices are product tiers (not translated); copy is translated at render
const plans = [
  {
    name: "Starter",
    price: "$29",
    desc: "auth:landing.pricing.starterDesc",
    features: [
      "auth:landing.pricing.members2",
      "auth:landing.pricing.products1k",
      "auth:landing.pricing.branches1",
      "auth:landing.pricing.posOrders",
      "auth:landing.pricing.basicInventory",
      "auth:landing.pricing.customerMgmt",
      "auth:landing.pricing.storeSettings",
      "auth:landing.pricing.emailSupport",
    ],
    cta: "auth:login.startTrial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$79",
    desc: "auth:landing.pricing.growthDesc",
    features: [
      "auth:landing.pricing.members10",
      "auth:landing.pricing.products10k",
      "auth:landing.pricing.branches3",
      "auth:landing.pricing.everythingStarter",
      "auth:landing.pricing.suppliersReturns",
      "auth:landing.pricing.staffRoles",
      "auth:landing.pricing.storefront",
      "auth:landing.pricing.priorityChat",
    ],
    cta: "auth:login.startTrial",
    highlight: true,
  },
  {
    name: "Professional",
    price: "$149",
    desc: "auth:landing.pricing.professionalDesc",
    features: [
      "auth:landing.pricing.members25",
      "auth:landing.pricing.products50k",
      "auth:landing.pricing.branches10",
      "auth:landing.pricing.everythingGrowth",
      "auth:landing.pricing.salary",
      "auth:landing.pricing.tailor",
      "auth:landing.pricing.advancedAnalytics",
      "auth:landing.pricing.dedicatedSupport",
    ],
    cta: "auth:login.startTrial",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "$299",
    desc: "auth:landing.pricing.enterpriseDesc",
    features: [
      "auth:landing.pricing.membersUnlimited",
      "auth:landing.pricing.productsUnlimited",
      "auth:landing.pricing.branchesUnlimited",
      "auth:landing.pricing.everythingProfessional",
      "auth:landing.pricing.whiteLabel",
      "auth:landing.pricing.integrations",
      "auth:landing.pricing.accountManager",
      "auth:landing.pricing.support247",
    ],
    cta: "auth:landing.pricing.contactSales",
    highlight: false,
  },
] as const

function Pricing() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("auth:landing.pricing.title")}</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            {t("auth:landing.pricing.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={cn("relative", plan.highlight && "border-primary ring-1 ring-primary")}
            >
              {plan.highlight && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">{t("auth:landing.pricing.popular")}</Badge>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>{t(plan.desc)}</CardDescription>
                <div className="flex items-end gap-1 pt-2">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-sm mb-1 text-muted-foreground">{t("auth:landing.pricing.perMonth")}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      {t(f)}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button asChild className="w-full" variant={plan.highlight ? "default" : "outline"}>
                  <Link href="/auth/signup">{t(plan.cta)}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const testimonials = [
  {
    name: "Sarah Karim",
    role: "auth:landing.testimonials.sarahRole",
    body: "auth:landing.testimonials.sarahBody",
    stars: 5,
  },
  {
    name: "Mohammed Al-Rashid",
    role: "auth:landing.testimonials.mohammedRole",
    body: "auth:landing.testimonials.mohammedBody",
    stars: 5,
  },
  {
    name: "Priya Sharma",
    role: "auth:landing.testimonials.priyaRole",
    body: "auth:landing.testimonials.priyaBody",
    stars: 5,
  },
] as const

function Testimonials() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("auth:landing.testimonials.title")}</h2>
          <p className="text-muted-foreground text-lg">{t("auth:landing.testimonials.subtitle")}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((r) => (
            <Card key={r.name} className="gap-0 p-8">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: r.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-sm leading-relaxed mb-6">"{t(r.body)}"</p>
              <div>
                <p className="font-semibold text-sm">{r.name}</p>
                <p className="text-muted-foreground text-xs">{t(r.role)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTA() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 to-emerald-950">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
          {t("auth:landing.cta.title")}
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          {t("auth:landing.cta.subtitle")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/auth/signup">
              {t("auth:landing.hero.ctaTrial")}
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/login">{t("auth:login.signIn")}</Link>
          </Button>
        </div>
        <p className="text-gray-600 text-sm mt-5">{t("auth:landing.cta.note")}</p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const { t } = useTranslation(["auth", "common"])
  return (
    <footer className="bg-gray-950 text-gray-500 py-12 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold">StockFlow</span>
            </div>
            <p className="text-sm leading-relaxed">
              {t("auth:landing.footer.tagline")}
            </p>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">{t("auth:landing.footer.product")}</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">{t("auth:landing.nav.features")}</a></li>
              <li><a href="#modules" className="hover:text-white transition-colors">{t("auth:landing.nav.modules")}</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">{t("auth:landing.nav.pricing")}</a></li>
            </ul>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">{t("auth:landing.footer.platform")}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/signup" className="hover:text-white transition-colors">{t("auth:landing.footer.adminPanel")}</Link></li>
              <li><span className="text-gray-600">{t("auth:landing.footer.storefront")}</span></li>
              <li><span className="text-gray-600">{t("auth:landing.footer.mobileApp")}</span></li>
            </ul>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">{t("auth:landing.footer.account")}</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/signup" className="hover:text-white transition-colors">{t("auth:landing.footer.signUp")}</Link></li>
              <li><Link href="/auth/login" className="hover:text-white transition-colors">{t("auth:login.signIn")}</Link></li>
              <li><Link href="/auth/forgot-password" className="hover:text-white transition-colors">{t("auth:landing.footer.forgotPassword")}</Link></li>
            </ul>
          </div>
        </div>

        <Separator className="mb-6 bg-gray-800" />
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">{t("auth:landing.footer.rights", { year: new Date().getFullYear() })}</p>
          <p className="text-xs">{t("auth:landing.footer.builtWith")}</p>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="font-sans">
      <Navbar />
      <Hero />
      <Features />
      <Modules />
      <DualApp />
      <Pricing />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  )
}
