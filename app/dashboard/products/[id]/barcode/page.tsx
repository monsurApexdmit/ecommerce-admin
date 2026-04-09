'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { productApi } from '@/lib/productApi'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Download, Printer, ArrowLeft, Copy } from 'lucide-react'
import JsBarcode from 'jsbarcode'

interface Product {
  id: number
  name: string
  sku: string
  price?: number
  sale_price?: number
  salePrice?: number
  stock?: number
  barcode?: string
  barcode_code?: string
  [key: string]: any
}

export default function ProductBarcodePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const barcodeRef = useRef<SVGSVGElement>(null)

  const productId = parseInt(params.id as string)

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const loadProduct = async () => {
      try {
        setLoading(true)
        const response = await productApi.getById(productId)
        setProduct(response.data)
      } catch (error) {
        console.error('Error loading product:', error)
        toast({
          title: 'Error',
          description: 'Failed to load product details',
          variant: 'destructive',
        })
      } finally {
        setLoading(false)
      }
    }

    loadProduct()
  }, [productId, toast])

  // Generate barcode when product loads
  useEffect(() => {
    const codeToUse = product?.barcode_code || product?.barcode
    if (codeToUse && barcodeRef.current) {
      try {
        JsBarcode(barcodeRef.current, codeToUse, {
          format: 'CODE128',
          width: 2,
          height: 100,
          displayValue: false,
          margin: 10,
        })
      } catch (error) {
        console.error('Barcode generation error:', error)
      }
    }
  }, [product])

  const handleDownload = async () => {
    const barcodeCodeToUse = product?.barcode_code || product?.barcode
    if (!barcodeRef.current || !barcodeCodeToUse) {
      toast({
        title: 'Error',
        description: 'Barcode not available',
        variant: 'destructive',
      })
      return
    }

    try {
      setDownloading(true)

      // Get SVG content
      const svgData = new XMLSerializer().serializeToString(barcodeRef.current)
      const blob = new Blob([svgData], { type: 'image/svg+xml' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `barcode-${product.sku || productId}.svg`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)

      toast({
        title: 'Success',
        description: 'Barcode downloaded successfully',
      })
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: 'Error',
        description: 'Failed to download barcode',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  const handlePrint = () => {
    if (!barcodeRef.current) return

    const printWindow = window.open('', '', 'width=800,height=600')
    if (!printWindow) return

    const svgData = new XMLSerializer().serializeToString(barcodeRef.current)
    const barcodeCode = product?.barcode_code || product?.barcode || 'N/A'
    // Try multiple field names for price: sale_price, salePrice, price
    const priceValue = product?.sale_price ?? product?.salePrice ?? product?.price ?? 0
    const price = typeof priceValue === 'number' ? priceValue.toFixed(2) : '0.00'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Barcode - ${product?.name}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              padding: 10px;
              background: #f5f5f5;
            }
            /* Professional Retail Barcode Label Format */
            .barcode-label {
              background: white;
              width: 200px;
              padding: 15px;
              text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              border: 1px solid #ddd;
            }
            .product-name {
              font-size: 13px;
              font-weight: bold;
              color: #1a1a1a;
              margin-bottom: 5px;
              line-height: 1.2;
              max-height: 30px;
              overflow: hidden;
            }
            .product-sku {
              font-size: 10px;
              color: #666;
              margin-bottom: 8px;
            }
            /* Barcode Display Section */
            .barcode-section {
              margin: 10px 0;
              display: flex;
              justify-content: center;
            }
            .barcode-image {
              width: 100%;
              height: auto;
            }
            .barcode-number {
              font-size: 12px;
              font-weight: bold;
              font-family: 'Courier New', monospace;
              letter-spacing: 1px;
              margin: 5px 0 0 0;
              color: #000;
              word-break: break-all;
            }
            /* Price Section - PROMINENT DISPLAY */
            .price-section {
              background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
              color: white;
              padding: 12px;
              margin-top: 8px;
              border-radius: 4px;
              border: 2px solid #15803d;
            }
            .price-label {
              font-size: 9px;
              text-transform: uppercase;
              letter-spacing: 1px;
              opacity: 0.9;
              margin-bottom: 3px;
            }
            .price-value {
              font-size: 28px;
              font-weight: bold;
              line-height: 1;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.2);
            }
            .barcode-type {
              font-size: 8px;
              color: #999;
              margin-top: 5px;
            }
            @media print {
              body {
                background: white;
                padding: 0;
                display: block;
              }
              .barcode-label {
                box-shadow: none;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-label">
            <!-- Product Info -->
            <div class="product-name">${product?.name || 'Product'}</div>
            <div class="product-sku">SKU: ${product?.sku || 'N/A'}</div>

            <!-- Barcode Image -->
            <div class="barcode-section">
              <div class="barcode-image">
                ${svgData}
              </div>
            </div>

            <!-- Barcode Code -->
            <div class="barcode-number">${barcodeCode}</div>
            <div class="barcode-type">Code 128</div>

            <!-- Price - PROMINENT -->
            <div class="price-section">
              <div class="price-label">PRICE</div>
              <div class="price-value">$${price}</div>
            </div>
          </div>

          <script>
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 500);
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const handleCopyBarcode = () => {
    const barcodeCodeToCopy = product?.barcode_code || product?.barcode
    if (!barcodeCodeToCopy) return

    navigator.clipboard.writeText(barcodeCodeToCopy).then(() => {
      toast({
        title: 'Success',
        description: 'Barcode copied to clipboard',
      })
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-emerald-600" />
          <p className="text-gray-600">Loading barcode...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4 text-lg">Product not found</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    )
  }

  const barcodeCode = product.barcode_code || product.barcode || `SKU-${product.sku}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Products
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">Product Barcode</h1>
          <p className="text-gray-600 mt-2 text-lg">{product.name}</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Product Info Section */}
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 p-8 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">SKU</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{product.sku || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Format</p>
                <p className="text-lg font-bold text-gray-900 mt-1">Code 128</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Stock</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{product.stock} units</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 uppercase font-semibold">Price</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">${(product.sale_price ?? product.salePrice ?? product.price ?? 0)?.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Barcode Number Section */}
          <div className="p-8 border-b">
            <p className="text-sm text-gray-600 uppercase font-semibold mb-4">Barcode Code</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-900 rounded-lg p-4">
                <p className="text-2xl font-mono font-bold text-white tracking-wider text-center break-all">
                  {barcodeCode}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyBarcode}
                className="h-12 w-12"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Barcode Display Section */}
          <div className="p-8 border-b">
            <p className="text-sm text-gray-600 uppercase font-semibold mb-4">Barcode Display</p>
            <div className="flex justify-center bg-gradient-to-b from-slate-50 to-white border-2 border-dashed border-slate-300 rounded-lg p-8 min-h-64">
              {product.barcode_code || product.barcode ? (
                <div className="flex items-center justify-center w-full">
                  <svg ref={barcodeRef} className="max-w-full h-auto" />
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-gray-500 mb-2">No barcode available</p>
                  <p className="text-sm text-gray-400">Barcode will be generated when product is created</p>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-8 bg-gradient-to-r from-slate-50 to-white flex flex-wrap gap-3">
            <Button
              onClick={handlePrint}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              disabled={!product.barcode_code && !product.barcode}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print Barcode
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1 font-semibold"
              disabled={(!product.barcode_code && !product.barcode) || downloading}
            >
              {downloading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Download SVG
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-3">ℹ️ Barcode Information</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ <strong>Code 128:</strong> Industry-standard barcode format used worldwide</li>
            <li>✓ <strong>Scannable:</strong> Works with any standard barcode scanner</li>
            <li>✓ <strong>Print:</strong> Generate professional barcode labels ready for printing</li>
            <li>✓ <strong>Download:</strong> Save as SVG for digital use, email, or reprinting</li>
            <li>✓ <strong>Copy:</strong> Use the copy button to share barcode code with systems</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
