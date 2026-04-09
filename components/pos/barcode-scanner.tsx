'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Barcode, AlertCircle } from 'lucide-react'
import { type Product, type Variant } from '@/contexts/product-context'
import { toast } from 'sonner'

interface BarcodeScannerProps {
  products: Product[]
  selectedWarehouseId: string
  getStock: (product: Product, variant?: Variant) => number
  getAvailableStock: (product: Product, variant?: Variant) => number
  onProductScanned: (product: Product, variant?: Variant) => void
}

export function BarcodeScanner({
  products,
  selectedWarehouseId,
  getAvailableStock,
  onProductScanned,
}: BarcodeScannerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [barcode, setBarcode] = useState('')
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null)
  const [scannedVariant, setScannedVariant] = useState<Variant | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectingVariant, setSelectingVariant] = useState(false)

  // Auto-focus scanner input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Listen for barcode scan (works with physical scanners in HID mode)
  const handleBarcodeInput = (value: string) => {
    setBarcode(value)

    if (value.length < 5) return // Skip very short inputs

    // Search for product or variant by barcode
    let foundProduct: Product | null = null
    let foundVariant: Variant | null = null

    // First, search by product barcode
    foundProduct = products.find(p => p.barcode === value)

    // If not found, search by variant barcode
    if (!foundProduct) {
      for (const product of products) {
        const variant = product.variants?.find(v => v.barcode === value)
        if (variant) {
          foundProduct = product
          foundVariant = variant
          break
        }
      }
    }

    if (!foundProduct) {
      toast.error('Barcode not found')
      setBarcode('')
      inputRef.current?.focus()
      return
    }

    // If product has variants and no specific variant was scanned
    if (foundProduct.variants && foundProduct.variants.length > 0 && !foundVariant) {
      // Show variant selection dialog
      setScannedProduct(foundProduct)
      setSelectingVariant(true)
      setIsDialogOpen(true)
      setBarcode('')
      return
    }

    // Check available stock
    if (getAvailableStock(foundProduct, foundVariant || undefined) <= 0) {
      toast.error('Not enough stock for this item')
      setBarcode('')
      inputRef.current?.focus()
      return
    }

    // Add to cart
    onProductScanned(foundProduct, foundVariant || undefined)

    // Reset
    setBarcode('')
    setScannedProduct(null)
    setScannedVariant(null)
    inputRef.current?.focus()
    toast.success(`Added "${foundProduct.name}" to cart`)
  }

  const handleSelectVariant = (variant: Variant) => {
    if (!scannedProduct) return

    // Check available stock
    if (getAvailableStock(scannedProduct, variant) <= 0) {
      toast.error('Not enough stock for this variant')
      return
    }

    onProductScanned(scannedProduct, variant)
    setIsDialogOpen(false)
    setScannedProduct(null)
    setSelectingVariant(false)
    setBarcode('')
    inputRef.current?.focus()
    toast.success(`Added "${scannedProduct.name} - ${variant.name}" to cart`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBarcodeInput(barcode)
    }
    if (e.key === 'Escape') {
      setBarcode('')
      setIsDialogOpen(false)
      setSelectingVariant(false)
    }
  }

  return (
    <>
      {/* Scanner Input */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          <Barcode className="h-4 w-4" />
        </div>
        <Input
          ref={inputRef}
          type="text"
          placeholder="Scan barcode here... (or type barcode code)"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-10 py-2 text-sm"
          autoFocus
        />
      </div>

      {/* Variant Selection Dialog */}
      <Dialog open={isDialogOpen && selectingVariant} onOpenChange={(open) => {
        if (!open) {
          setScannedProduct(null)
          setSelectingVariant(false)
          setBarcode('')
          inputRef.current?.focus()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Select Variant
            </DialogTitle>
            <DialogDescription>
              This product has multiple variants. Select which one you want to add:
            </DialogDescription>
          </DialogHeader>

          {scannedProduct && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <h3 className="font-semibold text-gray-900">{scannedProduct.name}</h3>
                <p className="text-sm text-gray-600 mt-1">SKU: {scannedProduct.sku}</p>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {scannedProduct.variants?.map((variant) => {
                  const stock = getAvailableStock(scannedProduct, variant)
                  const isOutOfStock = stock <= 0

                  return (
                    <Button
                      key={variant.id}
                      variant="outline"
                      className="w-full justify-between h-auto py-3 px-4"
                      onClick={() => handleSelectVariant(variant)}
                      disabled={isOutOfStock}
                    >
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium">{variant.name}</span>
                        <div className="flex gap-2 text-xs">
                          {Object.entries(variant.attributes || {}).map(([key, value]) => (
                            <span key={key} className="text-gray-600">
                              {key}: <span className="font-semibold">{value as string}</span>
                            </span>
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">
                          ${variant.salePrice || variant.price}
                        </span>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={isOutOfStock ? 'destructive' : stock < 5 ? 'secondary' : 'default'}
                        >
                          {stock} {stock === 1 ? 'unit' : 'units'}
                        </Badge>
                      </div>
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsDialogOpen(false)
                  setSelectingVariant(false)
                  setBarcode('')
                  inputRef.current?.focus()
                }}
              >
                Cancel (ESC)
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
