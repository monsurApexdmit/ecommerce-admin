/** Small RFC-4180-ish CSV helpers for customer import/export */

export function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const t = String(v ?? "")
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
}

export function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Parses CSV text into objects keyed by lower-cased, camel-ish header names (spaces and underscores removed). */
export function parseCSVRows(text: string): Record<string, string>[] {
  const out: string[][] = []
  let row: string[] = []
  let cur = ""
  let q = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++ }
      else if (ch === '"') q = false
      else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ",") { row.push(cur); cur = "" }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++
      row.push(cur); cur = ""
      if (row.some((c) => c.trim())) out.push(row)
      row = []
    } else cur += ch
  }
  row.push(cur)
  if (row.some((c) => c.trim())) out.push(row)
  if (out.length < 2) return []
  const keys = out[0].map((h) => h.trim().toLowerCase().replace(/[\s_\-/]+/g, ""))
  return out.slice(1).map((r) => {
    const o: Record<string, string> = {}
    keys.forEach((k, i) => { o[k] = (r[i] ?? "").trim() })
    return o
  })
}
