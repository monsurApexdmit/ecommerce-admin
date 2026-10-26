// Helpers for the print-barcode page: paper layouts and barcode format resolution.
import { barcodeMisfit } from "@/components/products/form-barcode"

export interface PaperSize {
  id: string
  label: string
  sub: string
  cols: number
  perSheet: number
  heightPx: number
  pageCss: string
}

export const PAPER_SIZES: PaperSize[] = [
  { id: "a4-24", label: "A4 · 24 per sheet", sub: "3 across · 70×37 mm", cols: 3, perSheet: 24, heightPx: 84, pageCss: "A4" },
  { id: "a4-40", label: "A4 · 40 per sheet", sub: "4 across · 48×25 mm", cols: 4, perSheet: 40, heightPx: 84, pageCss: "A4" },
  { id: "letter-20", label: "Letter · 20 per sheet", sub: "2 across · 4×1 in", cols: 2, perSheet: 20, heightPx: 96, pageCss: "letter" },
  { id: "letter-30", label: "Letter · 30 per sheet", sub: "3 across · 2.6×1 in", cols: 3, perSheet: 30, heightPx: 96, pageCss: "letter" },
  { id: "letter-50", label: "Letter · 50 per sheet", sub: "5 across · 1.5×1 in", cols: 5, perSheet: 50, heightPx: 96, pageCss: "letter" },
  { id: "roll", label: "Label roll", sub: "Thermal · 50×25 mm · one label per page", cols: 1, perSheet: 1, heightPx: 96, pageCss: "50mm 25mm" },
]

const ean = (v: string, len: number) => {
  if (v.length !== len) return true // JsBarcode computes the check digit
  let sum = 0
  for (let i = 0; i < len - 1; i++) {
    const fromRight = len - i - 1
    sum += Number(v[i]) * (fromRight % 2 === 1 ? 3 : 1)
  }
  return String((10 - (sum % 10)) % 10) === v[len - 1]
}

/** JsBarcode format for a value and the product's barcode type. Anything that does not fit (or QR) prints as Code 128. */
export function resolveFormat(type: string | undefined, value: string): { format: string; fallback: boolean } {
  const t = type || "C128"
  if (t === "C128") return { format: "CODE128", fallback: false }
  if (t === "QR" || barcodeMisfit(t, value)) return { format: "CODE128", fallback: true }
  if (t === "EAN13") return ean(value, 13) ? { format: "EAN13", fallback: false } : { format: "CODE128", fallback: true }
  if (t === "EAN8") return ean(value, 8) ? { format: "EAN8", fallback: false } : { format: "CODE128", fallback: true }
  if (t === "UPCA") return ean(value, 12) ? { format: "UPC", fallback: false } : { format: "CODE128", fallback: true }
  if (t === "UPCE") return value.length <= 7 ? { format: "UPCE", fallback: false } : { format: "CODE128", fallback: true }
  if (t === "C39") return { format: "CODE39", fallback: false }
  return { format: "CODE128", fallback: true }
}

export const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
