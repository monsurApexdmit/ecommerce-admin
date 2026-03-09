"use client"

import { use, useRef, useState } from "react"
import { useProduct } from "@/contexts/product-context"
import Barcode from 'react-barcode'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProductBarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { products } = useProduct()
  const product = products.find(p => p.id === resolvedParams.id)

  const [printCount, setPrintCount] = useState(1)
  const [selectedVariant, setSelectedVariant] = useState<string>("product")
  const [labelSize, setLabelSize] = useState<"small" | "medium" | "large">("medium")
  const printAreaRef = useRef<HTMLDivElement>(null)

  if (!product) {
    return <div className="p-8 text-gray-500">Product not found</div>
  }

  const hasVariants = (product.variants?.length ?? 0) > 0

  // Determine what to print
  const getLabelData = () => {
    if (selectedVariant === "product" || !hasVariants) {
      return [{
        name: product.name,
        sku: product.sku,
        barcode: product.barcode || product.sku,
        price: product.salePrice,
      }]
    }
    if (selectedVariant === "all") {
      return product.variants!.map(v => ({
        name: `${product.name} — ${v.name}`,
        sku: v.sku,
        barcode: v.sku,
        price: v.salePrice,
      }))
    }
    const v = product.variants!.find(v => v.id === selectedVariant)
    if (!v) return []
    return [{
      name: `${product.name} — ${v.name}`,
      sku: v.sku,
      barcode: v.sku,
      price: v.salePrice,
    }]
  }

  const labels = getLabelData()

  const sizeConfig = {
    small:  { width: 1.2, height: 30, fontSize: 10, cardClass: "w-36 p-2" },
    medium: { width: 1.5, height: 45, fontSize: 12, cardClass: "w-48 p-3" },
    large:  { width: 2,   height: 60, fontSize: 14, cardClass: "w-64 p-4" },
  }
  const cfg = sizeConfig[labelSize]

  const handlePrint = () => {
    window.print()
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #barcode-print-area, #barcode-print-area * { visibility: visible; }
          #barcode-print-area {
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            padding: 16px;
          }
        }
      `}</style>

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Controls — hidden on print */}
        <div className="print:hidden flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="print:hidden flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Barcode Labels</h1>
            <p className="text-gray-500 text-sm">{product.name}</p>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {hasVariants && (
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Variant</Label>
                <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product (no variant)</SelectItem>
                    <SelectItem value="all">All Variants</SelectItem>
                    {product.variants!.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Label Size</Label>
              <Select value={labelSize} onValueChange={v => setLabelSize(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Copies per label</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={printCount}
                onChange={e => setPrintCount(Math.max(1, Number(e.target.value)))}
                className="w-20"
              />
            </div>

            <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
              <Printer className="w-4 h-4 mr-2" />
              Print Labels
            </Button>
          </div>
        </div>

        {/* Preview + print area */}
        <div className="bg-gray-50 border rounded-lg p-6">
          <p className="text-xs text-gray-400 mb-4 print:hidden">Preview</p>
          <div id="barcode-print-area" ref={printAreaRef}>
            <div className="flex flex-wrap gap-4">
              {labels.flatMap((label, li) =>
                Array.from({ length: printCount }, (_, ci) => (
                  <div
                    key={`${li}-${ci}`}
                    className={`bg-white border border-dashed border-gray-300 rounded flex flex-col items-center justify-center ${cfg.cardClass}`}
                  >
                    <p className="text-center font-semibold leading-tight mb-1 w-full truncate"
                       style={{ fontSize: cfg.fontSize }}>
                      {label.name}
                    </p>
                    {label.barcode ? (
                      <Barcode
                        value={label.barcode}
                        width={cfg.width}
                        height={cfg.height}
                        fontSize={cfg.fontSize - 2}
                        margin={2}
                        displayValue={false}
                      />
                    ) : (
                      <div className="text-xs text-gray-400 italic my-2">No barcode / SKU</div>
                    )}
                    <p className="text-center mt-0.5 text-gray-500" style={{ fontSize: cfg.fontSize - 2 }}>
                      {label.sku}
                    </p>
                    <p className="font-bold mt-0.5" style={{ fontSize: cfg.fontSize }}>
                      ${label.price.toFixed(2)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
