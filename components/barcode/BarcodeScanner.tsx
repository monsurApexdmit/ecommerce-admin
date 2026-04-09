"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { barcodeApi, type ProductWithBarcode } from "@/lib/barcodeApi"
import { AlertCircle, Loader, Search, X } from "lucide-react"
import { toast } from "sonner"

interface BarcodeScannerProps {
  onProductFound?: (product: ProductWithBarcode) => void
  onError?: (error: string) => void
  autoFocus?: boolean
}

/**
 * BarcodeScanner Component
 *
 * Allows users to:
 * 1. Scan a barcode (physical scanner or manual input)
 * 2. Search by barcode code manually
 * 3. Display matched product information
 *
 * Usage:
 * <BarcodeScanner onProductFound={(product) => console.log(product)} />
 */
export default function BarcodeScanner({
  onProductFound,
  onError,
  autoFocus = true,
}: BarcodeScannerProps) {
  const [barcodeInput, setBarcodeInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [foundProduct, setFoundProduct] = useState<ProductWithBarcode | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when component mounts
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleSearch = async (barcode: string) => {
    const trimmedBarcode = barcode.trim()

    if (!trimmedBarcode) {
      setError("Please enter or scan a barcode")
      return
    }

    setLoading(true)
    setError("")
    setFoundProduct(null)

    try {
      const response = await barcodeApi.findProductByBarcode(trimmedBarcode)

      if (response.success && response.data) {
        setFoundProduct(response.data)
        toast.success(`Product found: ${response.data.name}`)

        if (onProductFound) {
          onProductFound(response.data)
        }

        // Clear input for next scan
        setBarcodeInput("")
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to find product by barcode"
      setError(message)
      toast.error(message)

      if (onError) {
        onError(message)
      }
    } finally {
      setLoading(false)
      // Re-focus input for continuous scanning
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcodeInput(e.target.value)
  }

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter key to search
    if (e.key === "Enter") {
      e.preventDefault()
      handleSearch(barcodeInput)
    }

    // Escape key to clear
    if (e.key === "Escape") {
      setBarcodeInput("")
      setFoundProduct(null)
      setError("")
    }
  }

  const handleClear = () => {
    setBarcodeInput("")
    setFoundProduct(null)
    setError("")
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }

  return (
    <div className="space-y-6">
      {/* Scanner Input */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Barcode Scanner / Search
            </label>
            <p className="text-xs text-gray-600 mb-3">
              Scan a barcode or enter it manually. Press Enter to search, Escape to clear.
            </p>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                placeholder="Scan or enter barcode (e.g., PROD-12345678-ABCD)"
                disabled={loading}
                className="pr-10"
              />
              {barcodeInput && (
                <button
                  onClick={() => setBarcodeInput("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <Button
              onClick={() => handleSearch(barcodeInput)}
              disabled={loading || !barcodeInput.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-800">Search Failed</p>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Found Product */}
      {foundProduct && (
        <Card className="p-6 bg-green-50 border-green-200">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600">Product Found</p>
                <h3 className="text-2xl font-bold text-green-900">{foundProduct.name}</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="text-gray-600"
              >
                Clear
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-xs text-gray-600 font-semibold">SKU</p>
                <p className="text-sm font-medium">{foundProduct.sku || "N/A"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold">Barcode</p>
                <p className="text-sm font-mono font-medium text-blue-600">
                  {foundProduct.barcode}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold">Stock</p>
                <p className="text-sm font-medium">{foundProduct.stock} units</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-semibold">Sale Price</p>
                <p className="text-sm font-medium text-green-700">
                  ${foundProduct.sale_price.toFixed(2)}
                </p>
              </div>
            </div>

            {foundProduct.barcode_image_path && (
              <div className="bg-white p-4 rounded border">
                <p className="text-xs text-gray-600 font-semibold mb-2">Barcode Image</p>
                <div className="flex justify-center bg-white p-2 rounded border border-gray-200">
                  <img
                    src={foundProduct.barcode_image_path}
                    alt="Barcode"
                    className="max-h-20"
                  />
                </div>
              </div>
            )}

            {foundProduct.description && (
              <div>
                <p className="text-xs text-gray-600 font-semibold mb-1">Description</p>
                <p className="text-sm text-gray-700">{foundProduct.description}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Help Text */}
      <Card className="p-4 bg-blue-50 border-blue-200">
        <p className="text-xs text-blue-800">
          <strong>💡 Tip:</strong> This component works with physical barcode scanners that emulate
          keyboard input. Just ensure the scanner is connected and scan the barcode. The scanner
          will input the barcode and press Enter automatically.
        </p>
      </Card>
    </div>
  )
}
