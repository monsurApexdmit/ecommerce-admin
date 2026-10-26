/** Currency symbol (e.g. ৳) taken from the app's own formatter, not the ISO code. */
export function currencySymbol(format: (n: number) => string): string {
  return format(0).replace(/[\d.,\s-]/g, "") || ""
}

/** Whole-number money (drops the .00) for headline figures, e.g. ৳3,115. */
export function wholeMoney(format: (n: number) => string, value: number): string {
  return format(Math.round(value)).replace(/\.00$/, "")
}

/** Axis with 3 equal steps on round numbers, e.g. max 1340 → step 500, max 1500. */
export function niceAxis(value: number): { max: number; step: number } {
  const raw = Math.max(value, 1) / 3
  const exp = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  const step = nice * exp
  return { max: step * 3, step }
}

/** Round a max value up to a "nice" axis maximum (1, 2, 2.5, 5 × 10ⁿ). */
export function niceMax(value: number): number {
  if (value <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(value)))
  const f = value / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * exp
}

export function compactMoney(value: number, symbol: string): string {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${symbol}${trim(value / 1_000_000)}M`
  if (abs >= 1_000) return `${symbol}${trim(value / 1_000)}k`
  return `${symbol}${Math.round(value)}`
}

const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "")

export function signedPct(value: number | null): string | null {
  if (value === null) return null
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
}

/** "4 days", "6 hrs", "12 min" — used for order and alert ages. */
export function ageLabel(iso: string | null): string {
  if (!iso) return "—"
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.floor(ms / 60000))
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"}`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? "" : "s"}`
}

export function ageDays(iso: string | null): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** "14" -> "2pm" */
export function hourLabel(key: string | number): string {
  const h = Number(key)
  return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`
}

export function bucketLabel(key: string, bucket: "hour" | "day" | "month"): string {
  if (bucket === "hour") return hourLabel(key)
  if (bucket === "month") {
    const [y, m] = key.split("-")
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" })
  }
  const d = new Date(`${key}T00:00:00`)
  return d.toLocaleString("en-US", { day: "numeric", month: "short" })
}

export function bucketLongLabel(key: string, bucket: "hour" | "day" | "month"): string {
  if (bucket === "hour") return hourLabel(key)
  if (bucket === "month") {
    const [y, m] = key.split("-")
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" })
  }
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
}

export function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "Yesterday"
  if (days < 30) return `${days} days ago`
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
}
