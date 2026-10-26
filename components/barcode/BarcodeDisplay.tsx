"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SectionCard } from "@/components/common/SectionCard"
import { WithTooltip } from "@/components/common/WithTooltip"
import { EmptyState } from "@/components/common/EmptyState"
import { FormField } from "@/components/common/FormField"
import { barcodeApi } from "@/lib/barcodeApi"
import { Copy, RefreshCw, Download, Info } from "lucide-react"
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
    <SectionCard
      title="Product Barcode"
      actions={<>
        <WithTooltip content="Copy barcode number">
          <Button size="sm" variant="outline" onClick={handleCopyBarcode}>
            <Copy className="size-4" />
            Copy
          </Button>
        </WithTooltip>

        {barcodeImagePath && (
          <WithTooltip content="Download barcode image">
            <Button size="sm" variant="outline" onClick={handleDownloadBarcode}>
              <Download className="size-4" />
              Download
            </Button>
          </WithTooltip>
        )}

        <WithTooltip content="Regenerate new barcode">
          <span tabIndex={regenerating ? 0 : undefined}>
            <Button size="sm" variant="outline" onClick={handleRegenerateBarcode} disabled={regenerating}>
              {regenerating ? (
                <>
                  <Spinner />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Regenerate
                </>
              )}
            </Button>
          </span>
        </WithTooltip>
      </>}
      contentClassName="space-y-4"
    >
      {/* Barcode Image */}
      {barcodeImagePath ? (
        <Card className="items-center bg-white p-4">
          <img
            src={barcodeImagePath}
            alt={`Barcode for ${barcodeNumber}`}
            className="max-h-32 w-auto"
          />
        </Card>
      ) : (
        <EmptyState bordered title="Barcode image not available" className="p-4 md:p-6" />
      )}

      {/* Barcode Number */}
      <FormField label="Barcode Number" htmlFor={`barcode-number-${productId}`}>
        <div className="flex items-center gap-2">
          <Input id={`barcode-number-${productId}`} readOnly value={barcodeNumber} className="flex-1 font-mono" />
          <Button size="icon" variant="ghost" aria-label="Copy barcode number" onClick={handleCopyBarcode}>
            <Copy className="size-4" />
          </Button>
        </div>
      </FormField>

      {/* Info */}
      <Alert>
        <Info />
        <AlertDescription>
          This barcode uniquely identifies the product. Scan or enter it
          to retrieve product details during checkout or inventory operations.
        </AlertDescription>
      </Alert>
    </SectionCard>
  )
}
