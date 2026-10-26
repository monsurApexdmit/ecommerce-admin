// Barcode + code helpers for the product form.

export const BARCODE_TYPES = [
  { value: "C128", label: "Code 128 (C128)" },
  { value: "C39", label: "Code 39 (C39)" },
  { value: "EAN13", label: "EAN-13" },
  { value: "EAN8", label: "EAN-8" },
  { value: "UPCA", label: "UPC-A" },
  { value: "UPCE", label: "UPC-E" },
  { value: "QR", label: "QR code" },
] as const

export const barcodeTypeLabel = (t: string) => BARCODE_TYPES.find(b => b.value === t)?.label ?? t

const RULES: Record<string, { re: RegExp; hint: string }> = {
  EAN13: { re: /^\d{12,13}$/, hint: "12-13 digits" },
  EAN8: { re: /^\d{7,8}$/, hint: "7-8 digits" },
  UPCA: { re: /^\d{11,12}$/, hint: "11-12 digits" },
  UPCE: { re: /^\d{6,8}$/, hint: "6-8 digits" },
  C39: { re: /^[0-9A-Z\-. $/+%]+$/, hint: "A-Z, 0-9 and - . $ / + %" },
}

/** Returns null when the value fits the type (or the type has no rule), else a short rule hint. */
export function barcodeMisfit(type: string, value: string): string | null {
  const v = value.trim()
  const rule = RULES[type]
  if (!v || !rule) return null
  return rule.re.test(v) ? null : rule.hint
}

export const isNumericBarcodeType = (t: string) => ["EAN13", "EAN8", "UPCA", "UPCE"].includes(t)

const randDigits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("")
const randAlnum = (n: number) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
}

// EAN-13 / EAN-8 weight from the left: odd positions x1 (EAN-13) ; for 8 and UPC the
// first digit has weight 3. Using "weight 3 on the digit nearest the check digit" for all.
function checkDigit(body: string): string {
  let sum = 0
  for (let i = 0; i < body.length; i++) {
    const fromRight = body.length - i // 1 = digit next to the check digit
    sum += Number(body[i]) * (fromRight % 2 === 1 ? 3 : 1)
  }
  return String((10 - (sum % 10)) % 10)
}

/** Generate a code that is valid for the given barcode type (with a correct check digit). */
export function generateBarcode(type: string): string {
  switch (type) {
    case "EAN13": { const d = randDigits(12); return d + checkDigit(d) }
    case "EAN8": { const d = randDigits(7); return d + checkDigit(d) }
    case "UPCA": { const d = randDigits(11); return d + checkDigit(d) }
    case "UPCE": { const d = "0" + randDigits(6); return d + checkDigit(d) }
    default: return `P${randAlnum(8)}`
  }
}

export function generateSku(): string {
  return `SKU-${randAlnum(8)}`
}

/** Three-letter suffix for a variant SKU part, e.g. "Medium" -> "MED". */
export function skuSuffix(part: string): string {
  return part.replace(/[^A-Za-z0-9]/g, "").substring(0, 3).toUpperCase()
}
