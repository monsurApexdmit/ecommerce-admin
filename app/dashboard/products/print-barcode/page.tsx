'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { productApi, type ProductResponse } from '@/lib/productApi'
import { useSaasAuth } from '@/contexts/saas-auth-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Barcode, Search, Trash2, Printer, RotateCcw, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ============ TYPES ============

interface PrintItem {
  product: ProductResponse
  quantity: number
}

interface LabelSettings {
  showProductName: boolean
  showPrice: boolean
  showPromoPrice: boolean
  showBrand: boolean
  showBusinessName: boolean
}

interface FontSizes {
  productName: number
  price: number
  promoPrice: number
  brand: number
  businessName: number
}

interface PaperSize {
  id: string
  label: string
  cols: number
  labelWidthPx: number
  labelHeightPx: number
  description: string
}

// ============ CONSTANTS ============

const PAPER_SIZES: PaperSize[] = [
  { id: '20-per-sheet', label: '20 Labels/Sheet', cols: 4, labelWidthPx: 384, labelHeightPx: 96, description: '4" × 1"' },
  { id: '14-per-sheet', label: '14 Labels/Sheet', cols: 3, labelWidthPx: 264, labelHeightPx: 128, description: '4" × 1.33"' },
  { id: '10-per-sheet', label: '10 Labels/Sheet', cols: 2, labelWidthPx: 384, labelHeightPx: 192, description: '4" × 2"' },
  { id: '6-per-sheet', label: '6 Labels/Sheet', cols: 2, labelWidthPx: 384, labelHeightPx: 320, description: '4" × 3.33"' },
  { id: '30-per-sheet', label: '30 Labels/Sheet', cols: 3, labelWidthPx: 189, labelHeightPx: 96, description: '1" × 1"' },
]

const LABEL_FIELDS = [
  { key: 'showProductName', label: 'Product Name', sizeKey: 'productName' },
  { key: 'showPrice', label: 'Price', sizeKey: 'price' },
  { key: 'showPromoPrice', label: 'Promotional Price', sizeKey: 'promoPrice' },
  { key: 'showBrand', label: 'Brand', sizeKey: 'brand' },
  { key: 'showBusinessName', label: 'Business Name', sizeKey: 'businessName' },
]

// ============ PAGE COMPONENT ============

export default function PrintBarcodePage() {
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ProductResponse[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Print list
  const [printItems, setPrintItems] = useState<PrintItem[]>([])

  // Label settings
  const [labelSettings, setLabelSettings] = useState<LabelSettings>({
    showProductName: true,
    showPrice: true,
    showPromoPrice: false,
    showBrand: false,
    showBusinessName: false,
  })

  // Font sizes
  const [fontSizes, setFontSizes] = useState<FontSizes>({
    productName: 11,
    price: 14,
    promoPrice: 10,
    brand: 9,
    businessName: 9,
  })

  // Paper size
  const [selectedPaperSizeId, setSelectedPaperSizeId] = useState('20-per-sheet')

  // Auth & UI
  const { company } = useSaasAuth()
  const { toast } = useToast()

  // ============ HANDLERS ============

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const res = await productApi.getAll({ search: value, limit: 10 })
        setSearchResults(res.data ?? [])
        setShowDropdown(true)
      } catch (error) {
        console.error('Search error:', error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }, [])

  const handleAddProduct = useCallback((product: ProductResponse) => {
    const alreadyAdded = printItems.some(item => item.product.id === product.id)
    if (alreadyAdded) {
      toast({
        title: 'Already added',
        description: `${product.name} is already in the print list`,
        variant: 'default',
      })
    } else {
      setPrintItems(prev => [...prev, { product, quantity: 1 }])
    }
    setSearchQuery('')
    setSearchResults([])
    setShowDropdown(false)
  }, [printItems, toast])

  const handleRemoveItem = useCallback((productId: number) => {
    setPrintItems(prev => prev.filter(item => item.product.id !== productId))
  }, [])

  const handleQuantityChange = useCallback((productId: number, qty: number) => {
    setPrintItems(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity: Math.max(1, qty) } : item
      )
    )
  }, [])

  const handleReset = useCallback(() => {
    setPrintItems([])
    setSearchQuery('')
    setSearchResults([])
  }, [])

  const getPrice = (product: ProductResponse) => {
    return product.sale_price ?? (product as any).salePrice ?? product.price ?? 0
  }

  const handlePrint = useCallback(() => {
    if (printItems.length === 0) {
      toast({
        title: 'No products',
        description: 'Add at least one product to the print list',
        variant: 'destructive',
      })
      return
    }

    const paperSize = PAPER_SIZES.find(p => p.id === selectedPaperSizeId) ?? PAPER_SIZES[1]

    // Expand items by quantity
    const expandedLabels = printItems.flatMap(item =>
      Array.from({ length: item.quantity }, () => item.product)
    )

    const businessName = company?.name ?? 'Business'

    // Generate label HTML
    const labelHtml = expandedLabels
      .map((product, index) => {
        const barcodeValue = product.barcode || (product as any).barcode_code || product.sku || String(product.id)
        const price = getPrice(product).toFixed(2)

        let html = '<div class="label">'

        if (labelSettings.showBusinessName) {
          html += `<div class="business-name" style="font-size:${fontSizes.businessName}px">${businessName}</div>`
        }

        if (labelSettings.showProductName) {
          html += `<div class="product-name" style="font-size:${fontSizes.productName}px">${product.name}</div>`
        }

        if (labelSettings.showBrand) {
          html += `<div class="brand" style="font-size:${fontSizes.brand}px">${(product as any).brand ?? 'Brand'}</div>`
        }

        html += `<svg id="barcode-${index}" class="barcode-svg"></svg>`
        html += `<div class="barcode-code">${barcodeValue}</div>`

        if (labelSettings.showPrice) {
          html += `<div class="price" style="font-size:${fontSizes.price}px">$${price}</div>`
        }

        if (labelSettings.showPromoPrice) {
          html += `<div class="promo-price" style="font-size:${fontSizes.promoPrice}px">Sale: $${price}</div>`
        }

        html += '</div>'
        return html
      })
      .join('')

    // Generate JsBarcode calls
    const jsbarcodeCalls = expandedLabels
      .map((product, index) => {
        const barcodeValue = product.barcode || (product as any).barcode_code || product.sku || String(product.id)
        return `JsBarcode("#barcode-${index}", ${JSON.stringify(barcodeValue)}, { format: "CODE128", width: 1.5, height: 40, displayValue: false, margin: 4 });`
      })
      .join('\n')

    // Open print window
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast({
        title: 'Popup blocked',
        description: 'Please allow popups to print barcodes',
        variant: 'destructive',
      })
      return
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Barcode Labels</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"><\/script>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 8px; background: white; }
            .label-grid {
              display: grid;
              grid-template-columns: repeat(${paperSize.cols}, 1fr);
              gap: 2px;
            }
            .label {
              border: 1px solid #ddd;
              padding: 6px 4px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-inside: avoid;
              overflow: hidden;
              min-height: ${paperSize.labelHeightPx}px;
            }
            .business-name {
              font-weight: bold;
              margin-bottom: 2px;
              font-size: 10px;
            }
            .product-name {
              font-weight: 600;
              margin-bottom: 2px;
              line-height: 1.2;
              word-break: break-word;
            }
            .brand {
              color: #555;
              margin-bottom: 2px;
              font-size: 9px;
            }
            .barcode-svg {
              max-width: 100%;
              height: auto;
              margin: 2px 0;
            }
            .barcode-code {
              font-family: monospace;
              font-size: 8px;
              color: #333;
              margin-top: 2px;
            }
            .price {
              font-weight: bold;
              color: #16a34a;
              margin-top: 2px;
            }
            .promo-price {
              color: #dc2626;
              font-size: 9px;
              text-decoration: line-through;
            }
            @media print {
              body { padding: 0; }
              .label-grid { gap: 0; }
              .label { border: 1px dashed #ccc; }
            }
          </style>
        </head>
        <body>
          <div class="label-grid">
            ${labelHtml}
          </div>
          <script>
            window.onload = function() {
              ${jsbarcodeCalls}
              setTimeout(function() {
                window.print();
              }, 600);
            };
          <\/script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }, [printItems, labelSettings, fontSizes, selectedPaperSizeId, company?.name, toast])

  // ============ JSX ============

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Print Barcode Labels</h1>
          <p className="text-gray-600 mt-1">Search products and configure barcode label settings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT COLUMN - Search + Table */}
          <div className="lg:col-span-2 space-y-6">
            {/* Search Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Products</h2>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  className="pl-10 pr-10"
                  placeholder="Search by product name or SKU..."
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                />
                {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-600 animate-spin" />}

                {/* Dropdown */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 shadow-lg rounded-md max-h-64 overflow-y-auto">
                    {searchResults.map(product => (
                      <button
                        key={product.id}
                        onClick={() => handleAddProduct(product)}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-600">${getPrice(product).toFixed(2)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="text-sm text-gray-500 mt-2">No products found</p>
              )}
            </Card>

            {/* Products Table Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Products to Print</h2>
                <Badge variant="secondary">{printItems.length}</Badge>
              </div>

              {printItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Product Name</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">SKU / Code</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600 w-20">Qty</th>
                        <th className="text-left py-2 px-3 font-semibold text-gray-600 w-24">Price</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600 w-12">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printItems.map(item => (
                        <tr key={item.product.id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-3 text-gray-900">{item.product.name}</td>
                          <td className="py-3 px-3 text-gray-600 text-xs">{item.product.sku}</td>
                          <td className="py-3 px-3">
                            <Input
                              type="number"
                              min={1}
                              value={item.quantity}
                              onChange={e => handleQuantityChange(item.product.id, parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                            />
                          </td>
                          <td className="py-3 px-3">
                            <Input
                              readOnly
                              value={`$${getPrice(item.product).toFixed(2)}`}
                              className="w-24 bg-gray-100 text-gray-600 text-xs"
                            />
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => handleRemoveItem(item.product.id)}
                              className="text-red-500 hover:text-red-700 inline-flex"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No products added yet. Use the search above to add products.</p>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN - Settings */}
          <div className="space-y-6">
            {/* Label Settings Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Label Content</h2>
              <div className="space-y-3">
                {LABEL_FIELDS.map(field => {
                  const isChecked = labelSettings[field.key as keyof LabelSettings]
                  return (
                    <div key={field.key} className="flex items-center gap-3">
                      <Checkbox
                        id={field.key}
                        checked={isChecked}
                        onCheckedChange={checked =>
                          setLabelSettings(prev => ({
                            ...prev,
                            [field.key]: !!checked,
                          }))
                        }
                      />
                      <Label htmlFor={field.key} className="flex-1 cursor-pointer">
                        {field.label}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={6}
                          max={32}
                          value={fontSizes[field.sizeKey as keyof FontSizes]}
                          onChange={e =>
                            setFontSizes(prev => ({
                              ...prev,
                              [field.sizeKey]: parseInt(e.target.value) || 10,
                            }))
                          }
                          className="w-14 text-center text-sm"
                          disabled={!isChecked}
                        />
                        <span className="text-xs text-gray-500">pt</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Paper Size Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Paper / Label Size</h2>
              <Select value={selectedPaperSizeId} onValueChange={setSelectedPaperSizeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map(ps => (
                    <SelectItem key={ps.id} value={ps.id}>
                      {ps.label} ({ps.description})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-3">
                {PAPER_SIZES.find(p => p.id === selectedPaperSizeId)?.description} • {PAPER_SIZES.find(p => p.id === selectedPaperSizeId)?.cols} columns per sheet
              </p>
            </Card>

            {/* Action Buttons Card */}
            <Card className="p-6 space-y-3">
              <Button
                onClick={handlePrint}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={printItems.length === 0}
              >
                <Printer className="h-4 w-4 mr-2" />
                Preview & Print
              </Button>
              <Button onClick={handleReset} variant="outline" className="w-full">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
