'use client'

import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { productApi, type ProductResponse, type ProductVariantResponse } from '@/lib/productApi'
import purchaseOrderApi from '@/lib/purchaseOrderApi'
import { settingsApi } from '@/lib/settingsApi'
import { PAPER_SIZES, resolveFormat, escHtml } from '@/lib/barcode-labels'
import { useSaasAuth } from '@/contexts/saas-auth-context'
import { useModuleGuard } from '@/hooks/use-module-guard'
import Barcode from 'react-barcode'
import { Checkbox } from '@/components/ui/checkbox'
import { bricolage, instrument } from '@/components/dashboard/fonts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Loader2, Minus, Plus, Printer, Eye, ChevronLeft, ChevronRight, ShoppingCart, Eraser } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useCompanySettings } from '@/contexts/company-settings-context'

// ============ TYPES ============

interface PrintItem {
  key: string
  product: ProductResponse
  variant: ProductVariantResponse | null
  quantity: number
  packingDate: string
}

interface LabelSettings {
  showProductName: boolean
  showProductVariation: boolean
  showProductPrice: boolean
  showBusinessName: boolean
  showSku: boolean
  showPackingDate: boolean
}

interface FontSizes {
  productName: number
  productVariation: number
  productPrice: number
  businessName: number
  sku: number
  packingDate: number
}

// ============ CONSTANTS ============

const LABEL_FIELDS: { key: keyof LabelSettings; sizeKey: keyof FontSizes; label: string }[] = [
  { key: 'showProductName', sizeKey: 'productName', label: 'Product name' },
  { key: 'showProductVariation', sizeKey: 'productVariation', label: 'Variant (size/colour)' },
  { key: 'showProductPrice', sizeKey: 'productPrice', label: 'Price' },
  { key: 'showBusinessName', sizeKey: 'businessName', label: 'Business name' },
  { key: 'showSku', sizeKey: 'sku', label: 'SKU' },
  { key: 'showPackingDate', sizeKey: 'packingDate', label: 'Packing date' },
]

const DEFAULT_LABELS: LabelSettings = { showProductName: true, showProductVariation: true, showProductPrice: true, showBusinessName: true, showSku: false, showPackingDate: false }
const DEFAULT_SIZES: FontSizes = { productName: 12, productVariation: 11, productPrice: 13, businessName: 11, sku: 9, packingDate: 9 }
const PREF_KEY = 'barcode-label-prefs'

const FIELD_CLS = 'h-11 rounded-[10px] border border-dash-border bg-dash-bg px-3 text-sm text-dash-ink outline-none focus:border-dash-accent'

const todayStr = () => new Date().toISOString().slice(0, 10)

const offerActive = (p: ProductResponse) => {
  const v = Number(p.offerPrice ?? p.offer_price ?? 0)
  if (!(v > 0)) return false
  const end = (p as any).offerEndsAt ?? p.offer_ends_at
  return !end || new Date(end).getTime() >= Date.now()
}

// ============ PAGE COMPONENT ============

export default function PrintBarcodePage() {
  return <Suspense fallback={null}><PrintBarcodeInner /></Suspense>
}

function PrintBarcodeInner() {
  const searchParams = useSearchParams()
  const { formatCurrency, taxRate } = useCompanySettings() as any
  const { toast } = useToast()
  const { company } = useSaasAuth()

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductResponse[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Print list
  const [printItems, setPrintItems] = useState<PrintItem[]>([])
  const [loadingPo, setLoadingPo] = useState(false)

  // Label settings (remembered)
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(DEFAULT_LABELS)
  const [fontSizes, setFontSizes] = useState<FontSizes>(DEFAULT_SIZES)
  const [showPrice, setShowPrice] = useState<'inc' | 'exc'>('inc')
  const [selectedPaperSizeId, setSelectedPaperSizeId] = useState('a4-24')
  const [prefsLoaded, setPrefsLoaded] = useState(false)
  const [storeName, setStoreName] = useState<string>('')
  const [sheetNo, setSheetNo] = useState(1)

  const blocked = useModuleGuard('Print Barcode')

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.labels) setLabelSettings({ ...DEFAULT_LABELS, ...d.labels })
        if (d.sizes) setFontSizes({ ...DEFAULT_SIZES, ...d.sizes })
        if (d.showPrice === 'inc' || d.showPrice === 'exc') setShowPrice(d.showPrice)
        if (PAPER_SIZES.some(p => p.id === d.paper)) setSelectedPaperSizeId(d.paper)
      }
    } catch { /* ignore */ }
    setPrefsLoaded(true)
  }, [])

  useEffect(() => {
    if (!prefsLoaded) return
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ labels: labelSettings, sizes: fontSizes, showPrice, paper: selectedPaperSizeId })) } catch { /* ignore */ }
  }, [prefsLoaded, labelSettings, fontSizes, showPrice, selectedPaperSizeId])

  useEffect(() => {
    settingsApi.getGeneral().then(r => setStoreName(r.data?.storeName?.trim() || '')).catch(() => {})
  }, [])

  const businessName = storeName || company?.name || 'Business'

  const rowsFor = (product: ProductResponse): PrintItem[] => {
    const vs = product.variants ?? []
    if (vs.length) return vs.map(v => ({ key: `${product.id}:${v.id}`, product, variant: v, quantity: 1, packingDate: todayStr() }))
    return [{ key: String(product.id), product, variant: null, quantity: 1, packingDate: todayStr() }]
  }

  const mergeRows = (rows: PrintItem[]) =>
    setPrintItems(prev => [...prev, ...rows.filter(r => !prev.some(i => i.key === r.key))])

  // Deep link: ?ids=1,2,3 pre-selects products
  const idsParam = searchParams.get('ids')
  useEffect(() => {
    const ids = Array.from(new Set((idsParam ?? '').split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n) && n > 0)))
    if (!ids.length) return
    let cancelled = false
    Promise.all(ids.map(id => productApi.getById(id).then(r => r.data).catch(() => null))).then(list => {
      if (cancelled) return
      mergeRows(list.filter((p): p is ProductResponse => !!p).flatMap(rowsFor))
    })
    return () => { cancelled = true }
  }, [idsParam])

  // ============ HANDLERS ============

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setSearchResults([]); setShowDropdown(false); return }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await productApi.getAll({ search: value, limit: 10 })
        setSearchResults(res.data ?? [])
        setShowDropdown(true)
      } catch { setSearchResults([]) } finally { setIsSearching(false) }
    }, 300)
  }, [])

  const handleAddProduct = async (product: ProductResponse) => {
    setSearchQuery(''); setSearchResults([]); setShowDropdown(false)
    let full = product
    if (!product.variants) {
      try { full = (await productApi.getById(product.id)).data ?? product } catch { /* use list row */ }
    }
    mergeRows(rowsFor(full))
  }

  const addFromLastPurchase = async () => {
    setLoadingPo(true)
    try {
      const res = await purchaseOrderApi.getAll({ page: 1, limit: 20 })
      const list: any[] = (res.data?.data?.data ?? []).filter((o: any) => o.status !== 'cancelled' && o.status !== 'draft')
      if (!list.length) { toast({ title: 'No purchase orders', description: 'There is no purchase order to take products from.', variant: 'destructive' }); return }
      const last = list.reduce((a, b) => (new Date(b.createdAt).getTime() > new Date(a.createdAt).getTime() ? b : a))
      const full = (await purchaseOrderApi.getById(last.id)).data?.data ?? last
      const items: any[] = full.items ?? []
      const rows: PrintItem[] = []
      for (const it of items) {
        const product = (await productApi.getById(it.productId).catch(() => null))?.data
        if (!product) continue
        const variant = it.variantId ? (product.variants ?? []).find(v => v.id === it.variantId) ?? null : null
        rows.push({ key: variant ? `${product.id}:${variant.id}` : String(product.id), product, variant, quantity: Math.max(1, Number(it.quantityOrdered) || 1), packingDate: todayStr() })
      }
      setPrintItems(prev => {
        const next = [...prev]
        rows.forEach(r => { const i = next.findIndex(x => x.key === r.key); if (i >= 0) next[i] = { ...next[i], quantity: r.quantity }; else next.push(r) })
        return next
      })
      toast({ title: `Added from ${full.poNumber ?? 'last purchase'}`, description: `${rows.length} item(s), label counts set to the ordered quantities.` })
    } catch {
      toast({ title: 'Could not load the last purchase', variant: 'destructive' })
    } finally { setLoadingPo(false) }
  }

  const updateItem = (key: string, patch: Partial<PrintItem>) =>
    setPrintItems(prev => prev.map(i => i.key === key ? { ...i, ...patch } : i))
  const removeItem = (key: string) => setPrintItems(prev => prev.filter(i => i.key !== key))

  const rate = Number(taxRate) || 0

  // Label data for one row
  const labelOf = (item: PrintItem) => {
    const p = item.product, v = item.variant
    let base: number
    let offer = false
    if (v) base = Number(v.sale_price ?? v.price) || 0
    else {
      base = Number(p.sale_price ?? p.salePrice ?? p.price) || 0
      if (offerActive(p)) {
        const ov = Number(p.offerPrice ?? p.offer_price)
        const type = p.offerType ?? p.offer_type
        base = type === 'percentage' ? base * (1 - ov / 100) : base - ov
        offer = true
      }
    }
    base = Math.max(0, base)
    const price = showPrice === 'inc' && rate ? base * (1 + rate / 100) : base
    const sku = (v?.sku || p.sku || '')
    const code = String((v ? (v.barcode || v.sku) : (p.barcode || (p as any).barcode_code || p.sku)) || p.id)
    const type = v ? (v.barcode ? (v.barcodeType || (p as any).barcodeType) : 'C128') : ((p as any).barcodeType || 'C128')
    const { format } = resolveFormat(type, code)
    return { name: p.name, variant: v?.name ?? '', sku, code, format, price, offer }
  }

  const paper = PAPER_SIZES.find(p => p.id === selectedPaperSizeId) ?? PAPER_SIZES[0]
  const expanded = printItems.flatMap(item => Array.from({ length: item.quantity }, () => item))
  const totalLabels = expanded.length
  const sheets = Math.max(1, Math.ceil(totalLabels / paper.perSheet))
  const pageN = Math.min(sheetNo, sheets)
  const previewLabels = expanded.slice((pageN - 1) * paper.perSheet, pageN * paper.perSheet)
  const hasOffer = printItems.some(i => !i.variant && offerActive(i.product))

  const buildLabelsHtml = () => {
    const calls: string[] = []
    const cells = expanded.map((item, index) => {
      const l = labelOf(item)
      let html = '<div class="label">'
      if (labelSettings.showBusinessName) html += `<div class="business-name" style="font-size:${fontSizes.businessName}px">${escHtml(businessName)}</div>`
      if (labelSettings.showProductName) html += `<div class="product-name" style="font-size:${fontSizes.productName}px">${escHtml(l.name)}</div>`
      if (labelSettings.showProductVariation && l.variant) html += `<div class="variation" style="font-size:${fontSizes.productVariation}px">${escHtml(l.variant)}</div>`
      html += `<svg id="barcode-${index}" class="barcode-svg"></svg>`
      html += `<div class="barcode-code">${escHtml(l.code)}</div>`
      if (labelSettings.showProductPrice) html += `<div class="price" style="font-size:${fontSizes.productPrice}px">${escHtml(formatCurrency(l.price))}</div>`
      if (labelSettings.showSku && l.sku) html += `<div class="sku" style="font-size:${fontSizes.sku}px">SKU ${escHtml(l.sku)}</div>`
      if (labelSettings.showPackingDate) html += `<div class="packing-date" style="font-size:${fontSizes.packingDate}px">Packed: ${escHtml(item.packingDate)}</div>`
      html += '</div>'
      calls.push(`bc(${index}, ${JSON.stringify(l.code)}, "${l.format}");`)
      return html
    })
    let sheetsHtml = ''
    for (let i = 0; i < cells.length; i += paper.perSheet) sheetsHtml += `<div class="sheet">${cells.slice(i, i + paper.perSheet).join('')}</div>`
    return { sheetsHtml, calls: calls.join('\n') }
  }

  const openPrint = (autoPrint: boolean) => {
    if (printItems.length === 0) {
      toast({ title: 'No products', description: 'Add at least one product to print', variant: 'destructive' })
      return
    }
    const { sheetsHtml, calls } = buildLabelsHtml()
    const win = window.open('', '_blank')
    if (!win) {
      toast({ title: 'Popup blocked', description: 'Allow popups to print labels', variant: 'destructive' })
      return
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Print Labels</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
      <style>
        @page{size:${paper.pageCss};margin:${paper.id === 'roll' ? '0' : '8mm'}}
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:Arial,sans-serif;background:#fff}
        .sheet{display:grid;grid-template-columns:repeat(${paper.cols},1fr);gap:2px;padding:8px;page-break-after:always;break-after:page}
        .sheet:last-child{page-break-after:auto;break-after:auto}
        .label{border:1px dashed #bbb;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-inside:avoid;overflow:hidden;min-height:${paper.heightPx}px}
        .business-name{font-weight:bold;margin-bottom:2px}
        .product-name{font-weight:600;margin-bottom:2px;line-height:1.2;word-break:break-word}
        .variation{color:#555;margin-bottom:2px}
        .barcode-svg{max-width:100%;height:auto;margin:2px 0}
        .barcode-code{font-family:monospace;font-size:8px;color:#333;margin-top:2px}
        .price{font-weight:bold;margin-top:2px}
        .sku,.packing-date{color:#555;margin-top:2px}
        @media print{.sheet{padding:0;gap:0}}
      </style></head><body>
      ${sheetsHtml}
      <script>function bc(i,v,f){var o={format:f,width:1.5,height:40,displayValue:false,margin:4};try{JsBarcode("#barcode-"+i,v,o)}catch(e){try{o.format="CODE128";JsBarcode("#barcode-"+i,v,o)}catch(e2){}}}
      window.onload=function(){${calls}${autoPrint ? 'setTimeout(function(){window.print()},600);' : ''}};<\/script>
      </body></html>`)
    win.document.close()
  }

  if (blocked) return blocked

  // ============ JSX ============

  return (
    <div className={`${bricolage.variable} ${instrument.variable} font-dash-body flex flex-col gap-5 text-dash-ink`}>
      <div>
        <h1 className="font-dash-display text-[32px] font-bold tracking-tight">Print barcode labels</h1>
        <p className="mt-1 text-sm text-dash-muted">Pick products, choose what to show, and print, with a live preview.</p>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1 Products */}
          <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
            <h2 className="font-dash-display text-lg font-bold">1 · Products</h2>
            <div className="relative mt-3">
              <label className="flex h-11 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-bg px-3.5 text-dash-muted">
                <Search className="size-[18px]" aria-hidden />
                <span className="sr-only">Search products</span>
                <input
                  type="search"
                  placeholder="Search products to add…"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="min-w-0 flex-1 border-0 bg-transparent text-sm text-dash-ink outline-none placeholder:text-dash-muted"
                />
                {isSearching && <Loader2 className="size-4 animate-spin text-dash-accent" aria-hidden />}
              </label>
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-[10px] border border-dash-border bg-dash-card shadow-lg">
                  {searchResults.map(product => (
                    <button key={product.id} type="button" onClick={() => handleAddProduct(product)}
                      className="flex w-full items-center justify-between border-b border-dash-border-soft px-4 py-2.5 text-left last:border-0 hover:bg-dash-neutral-soft">
                      <span>
                        <span className="block text-sm font-semibold">{product.name}</span>
                        <span className="block text-xs text-dash-muted">{product.sku}</span>
                      </span>
                      <span className="text-sm font-semibold">{(product.variants?.length ?? 0) > 0 ? `${product.variants!.length} variants` : formatCurrency(labelOf({ key: '', product, variant: null, quantity: 1, packingDate: '' }).price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={addFromLastPurchase} disabled={loadingPo}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-50">
                {loadingPo ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ShoppingCart className="size-4" aria-hidden />} Add from last purchase
              </button>
              <button type="button" onClick={() => setPrintItems([])} disabled={printItems.length === 0}
                className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-3.5 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">
                <Eraser className="size-4" aria-hidden /> Clear list
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dash-border-soft text-left text-xs font-semibold uppercase tracking-wide text-dash-muted">
                    <th className="px-3 py-2.5">Product</th>
                    <th className="px-3 py-2.5">Labels</th>
                    <th className="px-3 py-2.5">Packed on</th>
                    <th className="w-12 px-3 py-2.5"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dash-border-soft">
                  {printItems.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-dash-muted">Search and add products above, or pick them on the Products page.</td></tr>
                  ) : printItems.map(item => (
                    <tr key={item.key}>
                      <td className="px-3 py-2.5">
                        <div className="font-semibold">{item.product.name}{item.variant ? <span className="font-normal text-dash-muted"> · {item.variant.name}</span> : null}</div>
                        <div className="text-xs text-dash-muted">{labelOf(item).code} · {formatCurrency(labelOf(item).price)}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" aria-label="Fewer labels" onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })}
                            className="grid size-9 place-items-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft"><Minus className="size-4" aria-hidden /></button>
                          <input type="number" min={1} aria-label={`Labels for ${item.product.name}`} value={item.quantity}
                            onChange={e => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="h-9 w-14 rounded-[10px] border border-dash-border bg-dash-bg text-center text-sm outline-none focus:border-dash-accent" />
                          <button type="button" aria-label="More labels" onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })}
                            className="grid size-9 place-items-center rounded-[10px] border border-dash-border hover:bg-dash-neutral-soft"><Plus className="size-4" aria-hidden /></button>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <input type="date" aria-label="Packing date" value={item.packingDate}
                          onChange={e => updateItem(item.key, { packingDate: e.target.value })}
                          className={`${FIELD_CLS} h-10 w-40`} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" aria-label={`Remove ${item.product.name}`} onClick={() => removeItem(item.key)}
                          className="grid size-9 place-items-center rounded-[10px] text-dash-danger-fg hover:bg-dash-danger-soft"><Trash2 className="size-4" aria-hidden /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs font-semibold text-dash-muted">{totalLabels} labels · {sheets} sheet{sheets === 1 ? '' : 's'}</p>
          </section>

          {/* 2 What to show */}
          <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
            <h2 className="font-dash-display text-lg font-bold">2 · What to show</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {LABEL_FIELDS.map(field => {
                const checked = labelSettings[field.key]
                return (
                  <div key={field.key}
                    className={`flex items-center justify-between gap-3 rounded-[10px] border px-3.5 py-2.5 ${checked ? 'border-dash-accent bg-dash-accent-soft' : 'border-dash-border bg-dash-card'}`}>
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
                      <Checkbox checked={checked} onCheckedChange={v => setLabelSettings(prev => ({ ...prev, [field.key]: !!v }))} />
                      {field.label}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-dash-muted">
                      <span>Size</span>
                      <input type="number" min={6} max={40} disabled={!checked} value={fontSizes[field.sizeKey]}
                        aria-label={`${field.label} font size`}
                        onChange={e => setFontSizes(prev => ({ ...prev, [field.sizeKey]: parseInt(e.target.value) || 10 }))}
                        className="h-8 w-14 rounded-lg border border-dash-border bg-dash-bg px-2 text-center text-sm text-dash-ink outline-none focus:border-dash-accent disabled:opacity-40" />
                    </label>
                  </div>
                )
              })}
            </div>
            <label className="mt-4 block text-sm font-semibold">
              Price shown
              <Select value={showPrice} onValueChange={v => setShowPrice(v as 'inc' | 'exc')}>
                <SelectTrigger className="mt-1.5 h-[42px] w-full max-w-xs rounded-[10px] border-dash-border bg-dash-card font-normal"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inc">Including tax{rate ? ` (${rate}%)` : ''}</SelectItem>
                  <SelectItem value="exc">Excluding tax</SelectItem>
                </SelectContent>
              </Select>
              <span className="mt-1.5 block text-xs font-normal text-dash-muted">
                Products with an active offer print the offer price{hasOffer ? ' (some in your list do)' : ''}. Variants print their own selling price.
              </span>
            </label>
          </section>

          {/* 3 Paper */}
          <section className="rounded-[14px] border border-dash-border bg-dash-card p-5">
            <h2 className="font-dash-display text-lg font-bold">3 · Paper</h2>
            <div role="radiogroup" aria-label="Paper" className="mt-3 grid gap-3 sm:grid-cols-2">
              {PAPER_SIZES.map(ps => {
                const on = ps.id === selectedPaperSizeId
                return (
                  <button key={ps.id} type="button" role="radio" aria-checked={on} onClick={() => { setSelectedPaperSizeId(ps.id); setSheetNo(1) }}
                    className={`rounded-[10px] border px-3.5 py-3 text-left ${on ? 'border-dash-accent bg-dash-accent-soft' : 'border-dash-border bg-dash-card hover:bg-dash-neutral-soft'}`}>
                    <span className="block text-sm font-semibold">{ps.label}</span>
                    <span className="mt-0.5 block text-xs text-dash-muted">{ps.sub}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-dash-muted">Tip: for thermal label printers choose “Label roll” — one label per page. Codes follow each product’s barcode type; values that do not fit it (and QR) print as Code 128.</p>
          </section>
        </div>

        {/* Preview */}
        <aside aria-label="Preview" className="flex flex-col gap-4 rounded-[14px] border border-dash-border bg-dash-card p-5 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <h2 className="font-dash-display text-lg font-bold">Preview</h2>
            <span className="text-xs text-dash-muted">{totalLabels} labels · {sheets} sheet{sheets === 1 ? '' : 's'}</span>
          </div>
          <div className="rounded-[10px] border border-dash-border-soft bg-dash-bg p-3">
            {previewLabels.length === 0 ? (
              <p className="py-10 text-center text-sm text-dash-muted">Add products to see a preview.</p>
            ) : (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${paper.cols}, minmax(0, 1fr))` }}>
                {previewLabels.map((item, idx) => {
                  const l = labelOf(item)
                  const z = (n: number) => Math.max(6, Math.round(n * 0.7))
                  return (
                    <div key={idx} className="flex min-h-20 flex-col items-center justify-center overflow-hidden rounded-md border border-dash-border bg-white p-1.5 text-center text-black">
                      {labelSettings.showBusinessName && <span className="max-w-full truncate font-bold uppercase" style={{ fontSize: z(fontSizes.businessName) }}>{businessName}</span>}
                      {labelSettings.showProductName && <span className="line-clamp-2 font-semibold leading-tight" style={{ fontSize: z(fontSizes.productName) }}>{l.name}</span>}
                      {labelSettings.showProductVariation && l.variant && <span className="max-w-full truncate text-neutral-600" style={{ fontSize: z(fontSizes.productVariation) }}>{l.variant}</span>}
                      <Barcode value={l.code} format={l.format as any} height={24} width={1} fontSize={8} margin={2} background="#ffffff" lineColor="#000000" />
                      {labelSettings.showProductPrice && <span className="font-bold" style={{ fontSize: z(fontSizes.productPrice) }}>{formatCurrency(l.price)}</span>}
                      {labelSettings.showSku && l.sku && <span className="text-neutral-600" style={{ fontSize: z(fontSizes.sku) }}>SKU {l.sku}</span>}
                      {labelSettings.showPackingDate && <span className="text-neutral-600" style={{ fontSize: z(fontSizes.packingDate) }}>Packed: {item.packingDate}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {sheets > 1 && (
            <div className="flex items-center justify-between text-xs text-dash-muted">
              <button type="button" aria-label="Previous sheet" disabled={pageN <= 1} onClick={() => setSheetNo(pageN - 1)}
                className="grid size-8 place-items-center rounded-lg border border-dash-border hover:bg-dash-neutral-soft disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden /></button>
              <span>Sheet {pageN} of {sheets}</span>
              <button type="button" aria-label="Next sheet" disabled={pageN >= sheets} onClick={() => setSheetNo(pageN + 1)}
                className="grid size-8 place-items-center rounded-lg border border-dash-border hover:bg-dash-neutral-soft disabled:opacity-40"><ChevronRight className="size-4" aria-hidden /></button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openPrint(false)} disabled={printItems.length === 0}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-dash-border bg-dash-card px-4 text-sm font-semibold hover:bg-dash-neutral-soft disabled:opacity-40">
              <Eye className="size-4" aria-hidden /> Preview
            </button>
            <button type="button" onClick={() => openPrint(true)} disabled={printItems.length === 0}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] bg-dash-accent px-4 text-sm font-semibold text-white disabled:opacity-40">
              <Printer className="size-4" aria-hidden /> Print {totalLabels} labels
            </button>
          </div>
        </aside>
      </div>
    </div>
  )
}
