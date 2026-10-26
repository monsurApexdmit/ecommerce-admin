'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { productApi } from '@/lib/productApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PageHeader } from '@/components/common/PageHeader'
import { SectionTitle } from '@/components/common/SectionTitle'
import { InfoList, InfoRow } from '@/components/common/InfoList'
import { EmptyState } from '@/components/common/EmptyState'
import { WithTooltip } from '@/components/common/WithTooltip'
import { useToast } from '@/hooks/use-toast'
import { useCompanySettings } from '@/contexts/company-settings-context'
import { useSaasAuth } from '@/contexts/saas-auth-context'
import { AccessDenied } from '@/components/ui/access-denied'
import { useModuleGuard } from '@/hooks/use-module-guard'
import { Download, Printer, ArrowLeft, Copy, Info } from 'lucide-react'
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
  const { canRead } = useSaasAuth()
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { formatCurrency } = useCompanySettings()
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

  const blocked = useModuleGuard('Print Barcode')
  if (blocked) return blocked

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
              <div class="price-value">${formatCurrency(Number(price))}</div>
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
        <div className="flex flex-col items-center gap-4 text-center">
          <Spinner className="size-8" />
          <p className="text-muted-foreground">Loading barcode...</p>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <EmptyState title="Product not found" action={<Button onClick={() => router.back()}>Go Back</Button>} />
      </div>
    )
  }

  const barcodeCode = product.barcode_code || product.barcode || `SKU-${product.sku}`

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="mb-4"
          >
            <ArrowLeft className="size-4" />
            Back to Products
          </Button>
          <PageHeader title="Product Barcode" description={product.name} />
        </div>

        {/* Main Card */}
        <Card className="gap-0 overflow-hidden py-0">
          {/* Product Info Section */}
          <CardContent className="p-8">
            <InfoList className="grid-cols-2 gap-4 md:grid-cols-4">
              <InfoRow layout="stacked" label="SKU" value={product.sku || 'N/A'} />
              <InfoRow layout="stacked" label="Format" value="Code 128" />
              <InfoRow layout="stacked" label="Stock" value={`${product.stock} units`} />
              <InfoRow layout="stacked" label="Price" value={formatCurrency(product.sale_price ?? product.salePrice ?? product.price ?? 0)} />
            </InfoList>
          </CardContent>
          <Separator />

          {/* Barcode Number Section */}
          <CardContent className="space-y-4 p-8">
            <SectionTitle>Barcode Code</SectionTitle>
            <div className="flex items-center gap-2">
              <Card className="flex-1 bg-muted p-4">
                <p className="text-2xl font-mono font-bold tracking-wider text-center break-all">
                  {barcodeCode}
                </p>
              </Card>
              <WithTooltip content="Copy barcode">
                <Button
                  variant="outline"
                  size="icon-lg"
                  aria-label="Copy barcode"
                  onClick={handleCopyBarcode}
                >
                  <Copy className="size-4" />
                </Button>
              </WithTooltip>
            </div>
          </CardContent>
          <Separator />

          {/* Barcode Display Section */}
          <CardContent className="space-y-4 p-8">
            <SectionTitle>Barcode Display</SectionTitle>
            {product.barcode_code || product.barcode ? (
              <Card className="min-h-64 items-center justify-center border-dashed bg-white p-8">
                <svg ref={barcodeRef} className="max-w-full h-auto" />
              </Card>
            ) : (
              <EmptyState bordered className="min-h-64" title="No barcode available" description="Barcode will be generated when product is created" />
            )}
          </CardContent>
          <Separator />

          {/* Action Buttons */}
          <CardFooter className="flex flex-wrap gap-3 p-8">
            <Button
              onClick={handlePrint}
              className="flex-1"
              disabled={!product.barcode_code && !product.barcode}
            >
              <Printer className="size-4" />
              Print Barcode
            </Button>
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
              disabled={(!product.barcode_code && !product.barcode) || downloading}
            >
              {downloading ? (
                <>
                  <Spinner />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="size-4" />
                  Download SVG
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Banner */}
        <Alert>
          <Info />
          <AlertTitle>Barcode Information</AlertTitle>
          <AlertDescription>
            <ul className="space-y-2">
              <li>✓ <strong>Code 128:</strong> Industry-standard barcode format used worldwide</li>
              <li>✓ <strong>Scannable:</strong> Works with any standard barcode scanner</li>
              <li>✓ <strong>Print:</strong> Generate professional barcode labels ready for printing</li>
              <li>✓ <strong>Download:</strong> Save as SVG for digital use, email, or reprinting</li>
              <li>✓ <strong>Copy:</strong> Use the copy button to share barcode code with systems</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  )
}
