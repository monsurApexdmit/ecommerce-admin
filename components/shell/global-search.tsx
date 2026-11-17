"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { FileText, Package, Receipt, Search, User, X } from "lucide-react"
import { productApi } from "@/lib/productApi"
import { sellsApi } from "@/lib/sellsApi"
import { customerApi } from "@/lib/customerApi"
import { useSaasAuth } from "@/contexts/saas-auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { SectionTitle } from "@/components/common/SectionTitle"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { WithTooltip } from "@/components/common/WithTooltip"

const PAGES = [
  { label: "nav:search.pages.dashboard", href: "/dashboard", module: "Dashboard" },
  { label: "nav:search.pages.pos", href: "/dashboard/pos", module: "POS" },
  { label: "nav:search.pages.sales", href: "/dashboard/sales", module: "Orders" },
  { label: "nav:search.pages.orders", href: "/dashboard/orders", module: "Orders" },
  { label: "nav:search.pages.shipments", href: "/dashboard/orders/shipments", module: "Shipments" },
  { label: "nav:search.pages.customers", href: "/dashboard/customers", module: "Customers" },
  { label: "nav:search.pages.adOrderLinks", href: "/dashboard/marketing/links", module: "Marketing" },
  { label: "nav:search.pages.products", href: "/dashboard/products", module: "Products" },
  { label: "nav:search.pages.categories", href: "/dashboard/categories", module: "Categories" },
  { label: "nav:search.pages.collections", href: "/dashboard/collections", module: "Collections" },
  { label: "nav:search.pages.stockOverview", href: "/dashboard/inventory", module: "Inventory" },
  { label: "nav:search.pages.purchaseOrders", href: "/dashboard/vendors/purchase-orders", module: "Vendors" },
  { label: "nav:search.pages.suppliers", href: "/dashboard/vendors", module: "Vendors" },
  { label: "nav:search.pages.financeOverview", href: "/dashboard/finance", module: "Finance" },
  { label: "nav:search.pages.inventoryLedger", href: "/dashboard/finance/inventory", module: "Finance" },
  { label: "nav:search.pages.expenses", href: "/dashboard/expenses", module: "Expenses" },
  { label: "nav:search.pages.payouts", href: "/dashboard/finance/payouts", module: "Finance" },
  { label: "nav:search.pages.receivables", href: "/dashboard/finance/receivables", module: "Finance" },
  { label: "nav:search.pages.paymentsReceived", href: "/dashboard/finance/payments", module: "Finance" },
  { label: "nav:search.pages.transactions", href: "/dashboard/finance/transactions", module: "Finance" },
  { label: "nav:search.pages.financeReports", href: "/dashboard/finance/reports", module: "Finance" },
  { label: "nav:search.pages.analytics", href: "/dashboard/reports", module: "Reports" },
  { label: "nav:search.pages.customerDues", href: "/dashboard/dues/customers", module: "Dues" },
  { label: "nav:search.pages.vendorDues", href: "/dashboard/dues/vendors", module: "Dues" },
  { label: "nav:search.pages.salaryManagement", href: "/dashboard/staff/salary", module: "Salary Management" },
  { label: "nav:search.pages.settings", href: "/dashboard/settings", module: "Settings" },
] as const

type Kind = "Product" | "Invoice" | "Customer" | "Page"
type Hit = { id: string; kind: Kind; label: string; hint?: string; href: string }
const GROUPS: Kind[] = ["Product", "Invoice", "Customer", "Page"]
const ICONS: Record<Kind, React.ElementType> = { Product: Package, Invoice: Receipt, Customer: User, Page: FileText }
const GROUP_LABEL = {
  Product: "nav:search.groups.product",
  Invoice: "nav:search.groups.invoice",
  Customer: "nav:search.groups.customer",
  Page: "nav:search.groups.page",
} as const satisfies Record<Kind, string>

function SearchBox({ autoFocus, className, inputRef, onDone }: {
  autoFocus?: boolean
  className?: string
  inputRef: React.RefObject<HTMLInputElement | null>
  onDone?: () => void
}) {
  const { t } = useTranslation(["nav", "common"])
  const router = useRouter()
  const { canRead } = useSaasAuth()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [products, setProducts] = useState<Hit[]>([])
  const [invoices, setInvoices] = useState<Hit[]>([])
  const [customers, setCustomers] = useState<Hit[]>([])
  const wrapRef = useRef<HTMLDivElement>(null)

  const q = query.trim()

  useEffect(() => {
    if (q.length < 2) { setProducts([]); setInvoices([]); setCustomers([]); return }
    let stale = false
    const timer = setTimeout(() => {
      const enc = encodeURIComponent(q)
      if (canRead("Products")) {
        productApi.getAll({ search: q, limit: 5 })
          .then((r: any) => !stale && setProducts((r?.data ?? []).slice(0, 5).map((p: any): Hit => ({
            id: `p${p.id}`, kind: "Product", label: p.name, hint: p.sku, href: `/dashboard/products?q=${encodeURIComponent(p.sku || p.name)}`,
          }))))
          .catch(() => !stale && setProducts([]))
      }
      if (canRead("Orders")) {
        sellsApi.getAll({ search: q, limit: 5 })
          .then((r) => !stale && setInvoices((r.data ?? []).slice(0, 5).map((s): Hit => ({
            id: `i${s.id}`, kind: "Invoice", label: `#${s.invoiceNo}`, hint: s.customerName, href: `/dashboard/sales?q=${encodeURIComponent(s.invoiceNo)}`,
          }))))
          .catch(() => !stale && setInvoices([]))
      }
      if (canRead("Customers")) {
        customerApi.getAll({ search: q, limit: 5 })
          .then((r) => !stale && setCustomers((r.data ?? []).slice(0, 5).map((c): Hit => ({
            id: `c${c.id}`, kind: "Customer", label: c.name, hint: c.phone ?? c.email ?? undefined, href: `/dashboard/customers?q=${encodeURIComponent(c.name)}`,
          }))))
          .catch(() => !stale && setCustomers([]))
      }
      void enc
    }, 250)
    return () => { stale = true; clearTimeout(timer) }
  }, [q, canRead])

  const pages = useMemo<Hit[]>(() => {
    if (!q) return []
    const n = q.toLowerCase()
    // Match the label in the staff member's language, and the English one too (people type either)
    return PAGES.filter((p) => canRead(p.module) && [t(p.label), t(p.label, { lng: "en" })].some((l) => l.toLowerCase().includes(n)))
      .slice(0, 5).map((p) => ({ id: `g${p.href}`, kind: "Page" as const, label: t(p.label), href: p.href }))
  }, [q, canRead, t])

  const groups = useMemo(
    () => GROUPS.map((k) => ({ kind: k, hits: ({ Product: products, Invoice: invoices, Customer: customers, Page: pages } as const)[k] })).filter((g) => g.hits.length),
    [products, invoices, customers, pages],
  )
  const flat = useMemo(() => groups.flatMap((g) => g.hits), [groups])

  useEffect(() => setActive(0), [q, flat.length])

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  const go = (h: Hit) => {
    setOpen(false); setQuery(""); onDone?.()
    inputRef.current?.blur()
    router.push(h.href)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      if (query) setQuery(""); else { setOpen(false); inputRef.current?.blur(); onDone?.() }
    } else if (e.key === "ArrowDown") {
      e.preventDefault(); setOpen(true); if (flat.length) setActive((a) => (a + 1) % flat.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); if (flat.length) setActive((a) => (a - 1 + flat.length) % flat.length)
    } else if (e.key === "Enter" && flat[active]) {
      e.preventDefault(); go(flat[active])
    }
  }

  const showPanel = open && q.length > 0
  let idx = -1

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          ref={inputRef}
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-list"
          aria-label={t("nav:search.label")}
          placeholder={t("nav:search.placeholder")}
          className="min-w-0"
        />
        <InputGroupAddon align="inline-end">
          {query ? (
            <InputGroupButton size="icon-xs" aria-label={t("nav:search.clear")} onClick={() => { setQuery(""); inputRef.current?.focus() }}>
              <X aria-hidden />
            </InputGroupButton>
          ) : (
            <KbdGroup className="hidden flex-none sm:inline-flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          )}
        </InputGroupAddon>
      </InputGroup>
      {showPanel && (
        <Card id="global-search-list" role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] gap-0 overflow-auto p-1.5 shadow-xl">
          {flat.length === 0 && <div className="px-3 py-6 text-center text-sm text-muted-foreground">{q.length < 2 ? t("nav:search.keepTyping") : t("common:status.noResults")}</div>}
          {groups.map((g) => {
            const Icon = ICONS[g.kind]
            return (
              <div key={g.kind} className="py-1">
                <SectionTitle as="p" className="px-2.5 pb-1 pt-1">{t(GROUP_LABEL[g.kind])}</SectionTitle>
                {g.hits.map((h) => {
                  idx += 1
                  const i = idx
                  return (
                    <Button
                      key={h.id}
                      type="button"
                      variant="ghost"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => go(h)}
                      className={cn("w-full justify-start gap-2.5 text-left font-normal", i === active && "bg-accent")}
                    >
                      <Icon className="size-4 flex-none text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{h.label}</span>
                      {h.hint && <span className="flex-none truncate text-xs text-muted-foreground">{h.hint}</span>}
                    </Button>
                  )
                })}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

/**
 * Header search: inline field with a grouped dropdown (Product / Invoice / Customer / Page).
 * Ctrl/⌘ K focuses it. `icon` collapses to a 44px button that reveals the field as an overlay on narrow screens.
 */
export function GlobalSearch({ variant = "bar", className }: { variant?: "bar" | "icon"; className?: string }) {
  const { t } = useTranslation(["nav", "common"])
  const inputRef = useRef<HTMLInputElement>(null)
  const [overlay, setOverlay] = useState(false)

  const onKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [])

  // Only the bar registers the shortcut, so it isn't handled twice when both variants are mounted
  useEffect(() => {
    if (variant !== "bar") return
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onKey, variant])

  if (variant === "icon") {
    return (
      <>
        <WithTooltip content={t("common:actions.search")}><Button type="button" variant="outline" size="icon" onClick={() => setOverlay(true)} aria-label={t("common:actions.search")} className={className}>
          <Search className="size-[18px]" aria-hidden />
        </Button></WithTooltip>
        {overlay && (
          <div className="fixed inset-x-0 top-0 z-50 bg-background/95 p-3 shadow-lg backdrop-blur">
            <SearchBox autoFocus inputRef={inputRef} onDone={() => setOverlay(false)} />
          </div>
        )}
      </>
    )
  }
  return <SearchBox inputRef={inputRef} className={className} />
}
