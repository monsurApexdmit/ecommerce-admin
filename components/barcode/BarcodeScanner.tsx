"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { FormField } from "@/components/common/FormField"
import { SectionCard } from "@/components/common/SectionCard"
import { SectionTitle } from "@/components/common/SectionTitle"
import { InfoList, InfoRow } from "@/components/common/InfoList"
import { barcodeApi, type ProductWithBarcode } from "@/lib/barcodeApi"
import { AlertCircle, Lightbulb, Search, X } from "lucide-react"
import { toast } from "sonner"
import { useCompanySettings } from "@/contexts/company-settings-context"
import { WithTooltip } from "@/components/common/WithTooltip"

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
  const { formatCurrency } = useCompanySettings()
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
      <Card className="p-6">
        <FormField
          label="Barcode Scanner / Search"
          htmlFor="barcode-scanner-input"
          description="Scan a barcode or enter it manually. Press Enter to search, Escape to clear."
        >
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                id="barcode-scanner-input"
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
                <WithTooltip content="Clear barcode"><Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Clear barcode"
                  onClick={() => setBarcodeInput("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                >
                  <X className="size-4" />
                </Button></WithTooltip>
              )}
            </div>

            <Button
              onClick={() => handleSearch(barcodeInput)}
              disabled={loading || !barcodeInput.trim()}
            >
              {loading ? (
                <>
                  <Spinner />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </FormField>
      </Card>

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Search Failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Found Product */}
      {foundProduct && (
        <SectionCard
          title={foundProduct.name}
          description="Product Found"
          actions={<Button variant="outline" size="sm" onClick={handleClear}>Clear</Button>}
          contentClassName="space-y-4"
        >
          <InfoList className="grid-cols-2 gap-4 md:grid-cols-4">
            <InfoRow layout="stacked" label="SKU" value={foundProduct.sku || "N/A"} />
            <InfoRow layout="stacked" label="Barcode" value={<span className="font-mono">{foundProduct.barcode}</span>} />
            <InfoRow layout="stacked" label="Stock" value={`${foundProduct.stock} units`} />
            <InfoRow layout="stacked" label="Sale Price" value={formatCurrency(foundProduct.sale_price)} />
          </InfoList>

          {foundProduct.barcode_image_path && (
            <div className="space-y-2">
              <SectionTitle>Barcode Image</SectionTitle>
              <Card className="items-center bg-white p-2">
                <img
                  src={foundProduct.barcode_image_path}
                  alt="Barcode"
                  className="max-h-20"
                />
              </Card>
            </div>
          )}

          {foundProduct.description && (
            <InfoList>
              <InfoRow layout="stacked" label="Description" value={<span className="font-normal">{foundProduct.description}</span>} />
            </InfoList>
          )}
        </SectionCard>
      )}

      {/* Help Text */}
      <Alert>
        <Lightbulb />
        <AlertTitle>Tip</AlertTitle>
        <AlertDescription>
          This component works with physical barcode scanners that emulate
          keyboard input. Just ensure the scanner is connected and scan the barcode. The scanner
          will input the barcode and press Enter automatically.
        </AlertDescription>
      </Alert>
    </div>
  )
}
