"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation(["ui", "common"])
  const [regenerating, setRegenerating] = useState(false)

  const handleCopyBarcode = () => {
    navigator.clipboard.writeText(barcodeNumber)
    toast.success(t("ui:barcode.copied"))
  }

  const handleRegenerateBarcode = async () => {
    if (!confirm(t("ui:barcode.confirmRegenerate"))) {
      return
    }

    setRegenerating(true)

    try {
      const response = await barcodeApi.regenerateProductBarcode(productId)

      if (response.success) {
        toast.success(t("ui:barcode.regenerated"))
        if (onRegenerate) {
          onRegenerate()
        }
      }
    } catch (err: any) {
      const message = err.response?.data?.message || t("ui:barcode.regenerateFailed")
      toast.error(message)
    } finally {
      setRegenerating(false)
    }
  }

  const handleDownloadBarcode = async () => {
    if (!barcodeImagePath) {
      toast.error(t("ui:barcode.imageMissing"))
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

      toast.success(t("ui:barcode.downloaded"))
    } catch (err) {
      toast.error(t("ui:barcode.downloadFailed"))
    }
  }

  return (
    <SectionCard
      title={t("ui:barcode.title")}
      actions={<>
        <WithTooltip content={t("ui:barcode.copyNumber")}>
          <Button size="sm" variant="outline" onClick={handleCopyBarcode}>
            <Copy className="size-4" />
            {t("common:actions.copy")}
          </Button>
        </WithTooltip>

        {barcodeImagePath && (
          <WithTooltip content={t("ui:barcode.downloadImage")}>
            <Button size="sm" variant="outline" onClick={handleDownloadBarcode}>
              <Download className="size-4" />
              {t("common:actions.download")}
            </Button>
          </WithTooltip>
        )}

        <WithTooltip content={t("ui:barcode.regenerateHint")}>
          <span tabIndex={regenerating ? 0 : undefined}>
            <Button size="sm" variant="outline" onClick={handleRegenerateBarcode} disabled={regenerating}>
              {regenerating ? (
                <>
                  <Spinner />
                  {t("ui:barcode.regenerating")}
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  {t("ui:barcode.regenerate")}
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
            alt={t("ui:barcode.imageAlt", { code: barcodeNumber })}
            className="max-h-32 w-auto"
          />
        </Card>
      ) : (
        <EmptyState bordered title={t("ui:barcode.imageMissing")} className="p-4 md:p-6" />
      )}

      {/* Barcode Number */}
      <FormField label={t("ui:barcode.number")} htmlFor={`barcode-number-${productId}`}>
        <div className="flex items-center gap-2">
          <Input id={`barcode-number-${productId}`} readOnly value={barcodeNumber} className="flex-1 font-mono" />
          <WithTooltip content={t("ui:barcode.copyNumber")}><Button size="icon" variant="ghost" aria-label={t("ui:barcode.copyNumber")} onClick={handleCopyBarcode}>
            <Copy className="size-4" />
          </Button></WithTooltip>
        </div>
      </FormField>

      {/* Info */}
      <Alert>
        <Info />
        <AlertDescription>
          {t("ui:barcode.info")}
        </AlertDescription>
      </Alert>
    </SectionCard>
  )
}
