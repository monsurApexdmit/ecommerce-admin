"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
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

// ─── Nav ──────────────────────────────────────────────────────────────────────
function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">StockFlow</span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Features</a>
            <a href="#modules" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Modules</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm text-gray-600 hover:text-emerald-600 transition-colors">Reviews</a>
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link href="/auth/login" className="text-sm text-gray-600 hover:text-gray-900 font-medium">Sign In</Link>
            <Link
              href="/auth/signup"
              className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Start Free Trial
            </Link>
          </div>

          {/* Mobile menu */}
          <button className="md:hidden p-2" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
          <a href="#features" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>Features</a>
          <a href="#modules" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>Modules</a>
          <a href="#pricing" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>Pricing</a>
          <a href="#testimonials" className="block text-sm text-gray-600 py-2" onClick={() => setOpen(false)}>Reviews</a>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/auth/login" className="text-center text-sm border border-gray-300 rounded-lg py-2 font-medium">Sign In</Link>
            <Link href="/auth/signup" className="text-center text-sm bg-emerald-600 text-white rounded-lg py-2 font-medium">Start Free Trial</Link>
          </div>
        </div>
      )}
    </nav>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
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
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-sm font-medium mb-8">
          <BadgeCheck className="w-4 h-4" />
          All-in-one inventory + storefront platform
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold text-white leading-tight tracking-tight mb-6">
          Run your entire{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            business
          </span>
          <br />
          from one platform
        </h1>

        <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Inventory management, POS, online storefront, vendors, staff, salary, shipments — everything connected, nothing missed.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Start 10-Day Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <a
            href="#features"
            className="flex items-center gap-2 border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-8 py-4 rounded-xl text-base transition-all"
          >
            See all features
          </a>
        </div>

        <p className="text-gray-500 text-sm mt-5">No credit card required · Cancel anytime</p>

        {/* Stats row */}
        <div className="mt-20 grid grid-cols-2 sm:grid-cols-4 gap-8 border-t border-gray-800 pt-12">
          {[
            { value: "30+", label: "Modules" },
            { value: "10-day", label: "Free trial" },
            { value: "Multi", label: "Location support" },
            { value: "Real-time", label: "POS & inventory sync" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-white">{s.value}</div>
              <div className="text-sm text-gray-500 mt-1">{s.label}</div>
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
    title: "Inventory Management",
    desc: "Track stock across multiple locations with real-time updates, variant-level control, and automatic low-stock alerts.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    icon: ShoppingCart,
    title: "Point of Sale (POS)",
    desc: "Built-in POS with barcode scanning, coupon support, payment methods, and automatic stock deduction.",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Store,
    title: "Online Storefront",
    desc: "Full-featured customer-facing shop with product pages, cart, checkout, wishlists, and order tracking.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    icon: Users,
    title: "Staff & HR",
    desc: "Manage staff, roles, permissions, salary payments, and attendance all in one place.",
    color: "bg-orange-50 text-orange-600",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    desc: "Revenue, gross profit, cost tracking, sell stats, and inventory reports with date-range filtering.",
    color: "bg-pink-50 text-pink-600",
  },
  {
    icon: Truck,
    title: "Shipments & Vendors",
    desc: "Manage purchase orders from vendors, track shipments, handle returns, and restock inventory automatically.",
    color: "bg-teal-50 text-teal-600",
  },
]

function Features() {
  return (
    <section id="features" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5 text-emerald-700 text-sm font-medium mb-4">
            <Zap className="w-4 h-4" /> Core Features
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything your business needs
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            From buying to selling to shipping — one platform handles the full lifecycle.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f) => (
            <div
              key={f.title}
              className="group p-6 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-50 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 text-lg">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Modules Grid ─────────────────────────────────────────────────────────────
const modules = [
  { icon: Package, label: "Products & Variants" },
  { icon: Warehouse, label: "Multi-Location Stock" },
  { icon: ShoppingCart, label: "Sells / Orders" },
  { icon: CreditCard, label: "Payment Methods" },
  { icon: Tag, label: "Coupons & Discounts" },
  { icon: Truck, label: "Shipments" },
  { icon: RefreshCcw, label: "Returns (Customer & Vendor)" },
  { icon: Users, label: "Customers" },
  { icon: Globe, label: "Vendors" },
  { icon: Layers, label: "Categories & Attributes" },
  { icon: BarChart3, label: "Inventory Reports" },
  { icon: Bell, label: "Notifications" },
  { icon: Shield, label: "Staff Roles & Permissions" },
  { icon: TrendingUp, label: "Billing & Subscriptions" },
  { icon: Scissors, label: "Tailor / Custom Orders" },
  { icon: MapPin, label: "Locations & Transfers" },
  { icon: TicketPercent, label: "Support Tickets" },
  { icon: Cpu, label: "Barcode / QR Scanning" },
]

function Modules() {
  return (
    <section id="modules" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">30+ built-in modules</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            No plugins. No add-ons. Everything ships out of the box.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {modules.map((m) => (
            <div
              key={m.label}
              className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 hover:border-emerald-200 hover:shadow-md transition-all text-center"
            >
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                <m.icon className="w-5 h-5 text-emerald-600" />
              </div>
              <span className="text-xs font-medium text-gray-700 leading-tight">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Dual App Section ─────────────────────────────────────────────────────────
function DualApp() {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Two apps. One ecosystem.
          </h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Your team manages inventory from the admin. Your customers shop from the storefront. Both sync in real time.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Admin card */}
          <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-800 p-8 text-white">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Admin Panel</p>
                  <p className="font-bold text-lg">StockFlow Dashboard</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Full inventory & multi-location management",
                  "POS with barcode scanner & coupons",
                  "Staff, roles, salary & HR management",
                  "Vendor purchases & returns",
                  "Sales analytics & profit reports",
                  "Billing, subscriptions & team invites",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Open Admin Panel <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Storefront card */}
          <div className="relative rounded-3xl overflow-hidden border border-gray-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-8">
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-200/40 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Store className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-medium uppercase tracking-widest">Storefront</p>
                  <p className="font-bold text-gray-900 text-lg">Aura Shop</p>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Beautiful product catalog with categories",
                  "Customer accounts, orders & returns",
                  "Wishlist, deals & featured products",
                  "Checkout with coupon & shipping support",
                  "Order tracking & support tickets",
                  "Fully branded with company colors & logo",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                Get storefront access <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
const plans = [
  {
    name: "Starter",
    price: "$29",
    period: "/mo",
    desc: "Perfect for solo entrepreneurs and small stores just getting started.",
    features: [
      "Up to 2 team members",
      "Up to 1,000 products",
      "1 branch / location",
      "POS & order management",
      "Basic inventory tracking",
      "Customer management",
      "Store settings & payments",
      "Email support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$79",
    period: "/mo",
    desc: "For growing businesses that need multi-location support and advanced features.",
    features: [
      "Up to 10 team members",
      "Up to 10,000 products",
      "Up to 3 branches / locations",
      "Everything in Starter",
      "Vendor & returns module",
      "Staff & role management",
      "Online storefront (Aura Shop)",
      "Priority chat support",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
  {
    name: "Professional",
    price: "$149",
    period: "/mo",
    desc: "For established businesses needing full operational control.",
    features: [
      "Up to 25 team members",
      "Up to 50,000 products",
      "Up to 10 branches / locations",
      "Everything in Growth",
      "Salary management",
      "Tailor shop module",
      "Advanced analytics & reports",
      "Dedicated support",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    name: "Enterprise",
    price: "$299",
    period: "/mo",
    desc: "Unlimited everything. Undercuts Cin7 ($349+) with no order caps.",
    features: [
      "Unlimited team members",
      "Unlimited products",
      "Unlimited branches / locations",
      "Everything in Professional",
      "White-label options",
      "Custom integrations & API",
      "Dedicated account manager",
      "24/7 phone & email support",
    ],
    cta: "Contact Sales",
    highlight: false,
  },
]

function Pricing() {
  return (
    <section id="pricing" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            All plans include a 10-day free trial. No credit card required.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plan.highlight
                  ? "bg-gray-900 text-white shadow-2xl shadow-gray-900/20 ring-2 ring-emerald-500"
                  : "bg-white border border-gray-200"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}
              <div className="mb-6">
                <p className={`font-semibold text-lg mb-1 ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                  {plan.name}
                </p>
                <p className={`text-sm mb-4 ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>{plan.desc}</p>
                <div className="flex items-end gap-1">
                  <span className={`text-4xl font-extrabold ${plan.highlight ? "text-white" : "text-gray-900"}`}>
                    {plan.price}
                  </span>
                  <span className={`text-sm mb-1 ${plan.highlight ? "text-gray-400" : "text-gray-500"}`}>
                    {plan.period}
                  </span>
                </div>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${plan.highlight ? "text-gray-300" : "text-gray-600"}`}>
                    <Check className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? "text-emerald-400" : "text-emerald-600"}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/signup"
                className={`text-center text-sm font-semibold px-6 py-3 rounded-xl transition-colors ${
                  plan.highlight
                    ? "bg-emerald-500 hover:bg-emerald-400 text-white"
                    : "border border-gray-300 hover:border-emerald-500 hover:text-emerald-700 text-gray-700"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
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
    role: "Owner, Sarah's Fashion Emporium",
    body: "Replaced 3 different tools with this one. Inventory, POS, and the online shop all work together seamlessly. The multi-location stock tracking alone saved us hours every week.",
    stars: 5,
  },
  {
    name: "Mohammed Al-Rashid",
    role: "Manager, TechZone Electronics",
    body: "The barcode scanning POS is incredibly fast. Our cashiers picked it up in minutes. Vendor purchase orders and returns are now fully tracked — no more spreadsheets.",
    stars: 5,
  },
  {
    name: "Priya Sharma",
    role: "Founder, FarmGlow Organics",
    body: "Staff role permissions are exactly what we needed. Different team members see only what they should. The salary payment module was a surprise bonus we didn't expect to love.",
    stars: 5,
  },
]

function Testimonials() {
  return (
    <section id="testimonials" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Loved by business owners</h2>
          <p className="text-gray-500 text-lg">Real feedback from real teams.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex gap-1 mb-4">
                {Array.from({ length: t.stars }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-700 text-sm leading-relaxed mb-6">"{t.body}"</p>
              <div>
                <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                <p className="text-gray-500 text-xs">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── CTA ──────────────────────────────────────────────────────────────────────
function CTA() {
  return (
    <section className="py-24 bg-gradient-to-br from-gray-900 to-emerald-950">
      <div className="max-w-3xl mx-auto px-4 text-center">
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
          Ready to take control of your business?
        </h2>
        <p className="text-gray-400 text-lg mb-10">
          Join businesses that run their inventory, POS, and storefront from one platform. Start free — no credit card needed.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:shadow-lg hover:shadow-emerald-500/25"
          >
            Start 10-Day Free Trial
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/auth/login"
            className="border border-gray-700 hover:border-gray-500 text-gray-300 font-medium px-8 py-4 rounded-xl text-base transition-all"
          >
            Sign In
          </Link>
        </div>
        <p className="text-gray-600 text-sm mt-5">No credit card · No setup fee · Cancel anytime</p>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
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
              All-in-one inventory, POS, and storefront platform for modern businesses.
            </p>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">Product</p>
            <ul className="space-y-2 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#modules" className="hover:text-white transition-colors">Modules</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
            </ul>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">Platform</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/signup" className="hover:text-white transition-colors">Admin Panel</Link></li>
              <li><span className="text-gray-600">Storefront (Aura Shop)</span></li>
              <li><span className="text-gray-600">Mobile App (coming soon)</span></li>
            </ul>
          </div>

          <div>
            <p className="text-white text-sm font-semibold mb-3">Account</p>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/signup" className="hover:text-white transition-colors">Sign Up</Link></li>
              <li><Link href="/auth/login" className="hover:text-white transition-colors">Sign In</Link></li>
              <li><Link href="/auth/forgot-password" className="hover:text-white transition-colors">Forgot Password</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs">© {new Date().getFullYear()} StockFlow. All rights reserved.</p>
          <p className="text-xs">Built with Next.js · Laravel · Tailwind CSS</p>
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
