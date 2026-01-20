"use client"

import { use, useRef, useState } from "react"
import { useProduct } from "@/contexts/product-context"
import Barcode from 'react-barcode'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Printer, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProductBarcodePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { products } = useProduct()
  const product = products.find(p => p.id === resolvedParams.id)
  
  const [printCount, setPrintCount] = useState(1)
  const componentRef = useRef<HTMLDivElement>(null)

  if (!product) {
    return <div>Product not found</div>
  }

  const handlePrint = () => {
    const printContent = componentRef.current
    if (printContent) {
        const originalContents = document.body.innerHTML
        document.body.innerHTML = printContent.innerHTML
        window.print()
        document.body.innerHTML = originalContents
        window.location.reload() // Reload to restore event listeners
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
       <div className="flex items-center gap-4 no-print">
        <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
        </Button>
      </div>

      <div className="flex items-center justify-between no-print">
         <div>
            <h1 className="text-2xl font-bold text-gray-900">Print Labels: {product.name}</h1>
            <p className="text-gray-500">Generate and print barcodes for your inventory</p>
         </div>
         <div className="flex items-center gap-4">
             <div className="flex items-center gap-2">
                 <Label>Quantity</Label>
                 <Input 
                    type="number" 
                    min={1} 
                    value={printCount} 
                    onChange={e => setPrintCount(Number(e.target.value))} 
                    className="w-20"
                 />
             </div>
             <Button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700">
                 <Printer className="w-4 h-4 mr-2" />
                 Print Labels
             </Button>
         </div>
      </div>

      <div className="bg-white p-8 border rounded-lg overflow-auto" id="print-area">
          <div ref={componentRef} className="grid grid-cols-3 gap-6">
              {Array.from({ length: printCount }).map((_, i) => (
                  <div key={i} className="border border-dashed p-4 flex flex-col items-center justify-center rounded-md aspect-[3/2]">
                      <h3 className="font-bold text-sm mb-1 text-center truncate w-full">{product.name}</h3>
                      <Barcode value={product.barcode || product.sku} width={1.5} height={40} fontSize={12} />
                      <p className="text-xs mt-1">{product.sku}</p>
                      <p className="font-bold mt-1">${product.salePrice}</p>
                  </div>
              ))}
          </div>
      </div>
      
      <style jsx global>{`
        @media print {
            .no-print, header, nav {
                display: none !important;
            }
            #print-area {
                border: none;
                padding: 0;
            }
        }
      `}</style>
    </div>
  )
}
