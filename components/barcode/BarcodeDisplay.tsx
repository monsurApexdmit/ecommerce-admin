"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { barcodeApi } from "@/lib/barcodeApi"
import { Copy, RefreshCw, Download, Loader } from "lucide-react"
import { toast } from "sonner"

interface BarcodeDisplayProps {
  productId: number
  barcodeNumber: string
  barcodeImagePath?: string
  onRegenerate?: () => void
}

/**
 * BarcodeDisplay Component
 *
 * Shows:
 * 1. Barcode image (SVG/PNG)
 * 2. Barcode number
 * 3. Copy barcode button
 * 4. Regenerate barcode button
 * 5. Download barcode image button
 *
 * Usage:
 * <BarcodeDisplay
 *   productId={123}
 *   barcodeNumber="PROD-12345678-ABCD"
 *   barcodeImagePath="/storage/barcodes/prod-12345678-abcd.svg"
 *   onRegenerate={() => refetch()}
 * />
 */
export default function BarcodeDisplay({
  productId,
  barcodeNumber,
  barcodeImagePath,
  onRegenerate,
}: BarcodeDisplayProps) {
  const [regenerating, setRegenerating] = useState(false)

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeNumber)
    toast.success("Barcode copied to clipboard")
  }

  const handleRegenerateBarcode = async () => {
    if (!confirm("Are you sure you want to regenerate the barcode? This cannot be undone.")) {
      return
    }

    setRegenerating(true)

    try {
      const response = await barcodeApi.regenerateProductBarcode(productId)

      if (response.success) {
        toast.success("Barcode regenerated successfully")
        if (onRegenerate) {
          onRegenerate()
        }
      }
    } catch (err: any) {
      const message = err.response?.data?.message || "Failed to regenerate barcode"
      toast.error(message)
    } finally {
      setRegenerating(false)
    }
  }

  const handleDownloadBarcode = async () => {
    if (!barcodeImagePath) {
      toast.error("Barcode image not available")
      return
    }

    try {
      // Create a link element and trigger download
      const link = document.createElement("a")
      link.href = barcodeImagePath
      link.download = `barcode-${barcodeNumber}.svg`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success("Barcode image downloaded")
    } catch (err) {
      toast.error("Failed to download barcode image")
    }
  }

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Product Barcode</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyBarcode}
            title="Copy barcode number"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy
          </Button>

          {barcodeImagePath && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadBarcode}
              title="Download barcode image"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerateBarcode}
            disabled={regenerating}
            title="Regenerate new barcode"
          >
            {regenerating ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Barcode Image */}
      {barcodeImagePath ? (
        <div className="bg-white p-4 rounded border border-gray-200 flex justify-center">
          <img
            src={barcodeImagePath}
            alt={`Barcode for ${barcodeNumber}`}
            className="max-h-32 w-auto"
          />
        </div>
      ) : (
        <div className="bg-gray-50 p-4 rounded border border-gray-200 text-center text-gray-500">
          <p className="text-sm">Barcode image not available</p>
        </div>
      )}

      {/* Barcode Number */}
      <div className="bg-gray-50 p-3 rounded border border-gray-200">
        <p className="text-xs text-gray-600 font-semibold mb-1">Barcode Number</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm font-mono font-medium text-blue-600 bg-white px-3 py-2 rounded border border-gray-200">
            {barcodeNumber}
          </code>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopyBarcode}
            className="text-gray-600"
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 p-3 rounded border border-blue-200 text-xs text-blue-800">
        <p>
          <strong>ℹ️ Info:</strong> This barcode uniquely identifies the product. Scan or enter it
          to retrieve product details during checkout or inventory operations.
        </p>
      </div>
    </Card>
  )
}
