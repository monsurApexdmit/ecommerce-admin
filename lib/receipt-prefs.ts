import { settingsApi } from "@/lib/settingsApi"

export interface ReceiptPrefs {
  paper: "58" | "80" | "a4"
  footer: string
}

let cached: ReceiptPrefs | null = null
let inflight: Promise<ReceiptPrefs> | null = null

/** Loads receipt paper size + footer message from general settings (cached; safe to call often). */
export function loadReceiptPrefs(): Promise<ReceiptPrefs> {
  if (cached) return Promise.resolve(cached)
  inflight ??= settingsApi
    .getAll()
    .then((res) => {
      const g = res.data?.general
      const p = g?.receiptPaper
      cached = { paper: p === "58" || p === "a4" ? p : "80", footer: (g?.receiptFooter ?? "").trim() }
      return cached
    })
    .catch(() => ({ paper: "80" as const, footer: "" }))
    .finally(() => { inflight = null })
  return inflight
}

/** Synchronous read of the last loaded prefs (null until loaded). */
export const getCachedReceiptPrefs = () => cached
/** Call after saving general settings so the next print re-reads them. */
export const resetReceiptPrefs = () => { cached = null }

if (typeof window !== "undefined") {
  window.addEventListener("receipt-prefs-stale", () => { resetReceiptPrefs(); void loadReceiptPrefs() })
  void loadReceiptPrefs()
}
