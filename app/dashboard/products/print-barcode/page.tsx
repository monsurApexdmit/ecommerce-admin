'use client'

import { cn } from "@/lib/utils"
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Item, ItemActions, ItemContent } from '@/components/ui/item'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionCard } from '@/components/common/SectionCard'
import { EmptyState } from '@/components/common/EmptyState'
import { FormField } from '@/components/common/FormField'
import { ChoiceCard, ChoiceCardGroup } from '@/components/common/ChoiceCard'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bricolage, instrument } from '@/components/dashboard/fonts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Trash2, Minus, Plus, Printer, Eye, ChevronLeft, ChevronRight, ShoppingCart, Eraser } from 'lucide-react'
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
    <div className={cn(bricolage.variable, instrument.variable, "font-dash-body flex flex-col gap-5 text-dash-ink")}>
      <PageHeader title="Print barcode labels" description="Pick products, choose what to show, and print, with a live preview." />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* 1 Products */}
          <SectionCard title="1 · Products">
            <div className="relative">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Label htmlFor="barcode-product-search" className="sr-only">Search products</Label>
                <Input
                  id="barcode-product-search"
                  type="search"
                  placeholder="Search products to add…"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="pl-8 pr-8"
                />
                {isSearching && <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />}
              </div>
              {showDropdown && searchResults.length > 0 && (
                <Card className="absolute z-50 mt-1 max-h-64 w-full gap-0 overflow-y-auto py-0 shadow-lg">
                  {searchResults.map(product => (
                    <Button key={product.id} type="button" variant="ghost" onClick={() => handleAddProduct(product)}
                      className="h-auto w-full justify-between rounded-none text-left font-normal">
                      <span>
                        <span className="block text-sm font-semibold">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{product.sku}</span>
                      </span>
                      <span className="text-sm font-semibold">{(product.variants?.length ?? 0) > 0 ? `${product.variants!.length} variants` : formatCurrency(labelOf({ key: '', product, variant: null, quantity: 1, packingDate: '' }).price)}</span>
                    </Button>
                  ))}
                </Card>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={addFromLastPurchase} disabled={loadingPo}>
                {loadingPo ? <Spinner /> : <ShoppingCart className="size-4" aria-hidden />} Add from last purchase
              </Button>
              <Button type="button" variant="outline" onClick={() => setPrintItems([])} disabled={printItems.length === 0}>
                <Eraser className="size-4" aria-hidden /> Clear list
              </Button>
            </div>

            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Labels</TableHead>
                    <TableHead>Packed on</TableHead>
                    <TableHead className="w-12"><span className="sr-only">Remove</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {printItems.length === 0 ? (
                    <TableRow><TableCell colSpan={4}><EmptyState className="p-4 md:p-6" title="No products added" description="Search and add products above, or pick them on the Products page." /></TableCell></TableRow>
                  ) : printItems.map(item => (
                    <TableRow key={item.key}>
                      <TableCell>
                        <div className="font-semibold">{item.product.name}{item.variant ? <span className="font-normal text-muted-foreground"> · {item.variant.name}</span> : null}</div>
                        <div className="text-xs text-muted-foreground">{labelOf(item).code} · {formatCurrency(labelOf(item).price)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon" aria-label="Fewer labels" onClick={() => updateItem(item.key, { quantity: Math.max(1, item.quantity - 1) })}><Minus className="size-4" aria-hidden /></Button>
                          <Input type="number" min={1} aria-label={`Labels for ${item.product.name}`} value={item.quantity}
                            onChange={e => updateItem(item.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-14 text-center tabular-nums" />
                          <Button type="button" variant="outline" size="icon" aria-label="More labels" onClick={() => updateItem(item.key, { quantity: item.quantity + 1 })}><Plus className="size-4" aria-hidden /></Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input type="date" aria-label="Packing date" value={item.packingDate}
                          onChange={e => updateItem(item.key, { packingDate: e.target.value })}
                          className="w-40" />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.product.name}`} onClick={() => removeItem(item.key)}><Trash2 className="size-4" aria-hidden /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">{totalLabels} labels · {sheets} sheet{sheets === 1 ? '' : 's'}</p>
          </SectionCard>

          {/* 2 What to show */}
          <SectionCard title="2 · What to show">
            <div className="grid gap-3 sm:grid-cols-2">
              {LABEL_FIELDS.map(field => {
                const checked = labelSettings[field.key]
                return (
                  <Item key={field.key} variant="outline" size="sm" data-state={checked ? 'checked' : 'unchecked'}
                    className="justify-between data-[state=checked]:border-primary data-[state=checked]:bg-primary/5">
                    <ItemContent>
                      <Label className="cursor-pointer">
                        <Checkbox checked={checked} onCheckedChange={v => setLabelSettings(prev => ({ ...prev, [field.key]: !!v }))} />
                        {field.label}
                      </Label>
                    </ItemContent>
                    <ItemActions>
                      <Label className="text-xs text-muted-foreground">
                        <span>Size</span>
                        <Input type="number" min={6} max={40} disabled={!checked} value={fontSizes[field.sizeKey]}
                          aria-label={`${field.label} font size`}
                          onChange={e => setFontSizes(prev => ({ ...prev, [field.sizeKey]: parseInt(e.target.value) || 10 }))}
                          className="w-14 text-center tabular-nums" />
                      </Label>
                    </ItemActions>
                  </Item>
                )
              })}
            </div>
            <FormField label="Price shown" htmlFor="price-shown" className="mt-4"
              description={<>Products with an active offer print the offer price{hasOffer ? ' (some in your list do)' : ''}. Variants print their own selling price.</>}>
              <Select value={showPrice} onValueChange={v => setShowPrice(v as 'inc' | 'exc')}>
                <SelectTrigger id="price-shown" className="w-full max-w-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inc">Including tax{rate ? ` (${rate}%)` : ''}</SelectItem>
                  <SelectItem value="exc">Excluding tax</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </SectionCard>

          {/* 3 Paper */}
          <SectionCard title="3 · Paper">
            <ChoiceCardGroup aria-label="Paper" className="gap-3 sm:grid-cols-2"
              value={selectedPaperSizeId} onValueChange={(id) => { setSelectedPaperSizeId(id); setSheetNo(1) }}>
              {PAPER_SIZES.map(ps => (
                <ChoiceCard key={ps.id} value={ps.id} title={ps.label} description={ps.sub} />
              ))}
            </ChoiceCardGroup>
            <p className="mt-3 text-xs text-muted-foreground">Tip: for thermal label printers choose “Label roll” — one label per page. Codes follow each product’s barcode type; values that do not fit it (and QR) print as Code 128.</p>
          </SectionCard>
        </div>

        {/* Preview */}
        <aside aria-label="Preview" className="xl:sticky xl:top-4">
        <SectionCard title="Preview" contentClassName="flex flex-col gap-4"
          actions={<span className="text-xs text-muted-foreground">{totalLabels} labels · {sheets} sheet{sheets === 1 ? '' : 's'}</span>}>
          <Card className="bg-muted/50 p-3 shadow-none">
            {previewLabels.length === 0 ? (
              <EmptyState className="p-6 md:p-6" title="Add products to see a preview." />
            ) : (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${paper.cols}, minmax(0, 1fr))` }}>
                {previewLabels.map((item, idx) => {
                  const l = labelOf(item)
                  const z = (n: number) => Math.max(6, Math.round(n * 0.7))
                  return (
                    <div key={idx} className="flex min-h-20 flex-col items-center justify-center overflow-hidden rounded-md border bg-white p-1.5 text-center text-black">
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
          </Card>
          {sheets > 1 && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Previous sheet" disabled={pageN <= 1} onClick={() => setSheetNo(pageN - 1)}><ChevronLeft className="size-4" aria-hidden /></Button>
              <span>Sheet {pageN} of {sheets}</span>
              <Button type="button" variant="outline" size="icon-sm" aria-label="Next sheet" disabled={pageN >= sheets} onClick={() => setSheetNo(pageN + 1)}><ChevronRight className="size-4" aria-hidden /></Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => openPrint(false)} disabled={printItems.length === 0} className="flex-1">
              <Eye className="size-4" aria-hidden /> Preview
            </Button>
            <Button type="button" onClick={() => openPrint(true)} disabled={printItems.length === 0} className="flex-1">
              <Printer className="size-4" aria-hidden /> Print {totalLabels} labels
            </Button>
          </div>
        </SectionCard>
        </aside>
      </div>
    </div>
  )
}
