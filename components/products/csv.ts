/** RFC-4180-ish CSV parser (quoted fields, escaped quotes, commas/newlines in quotes). Header keys are lower_snake_case. */
export function parseCsvRows(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let cur = ""
  let q = false
  const src = text.replace(/^﻿/, "")
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cur += '"'; i++ } else q = false }
      else cur += c
    } else if (c === '"') q = true
    else if (c === ",") { row.push(cur); cur = "" }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++
      row.push(cur); cur = ""
      if (row.some((v) => v.trim() !== "")) rows.push(row)
      row = []
    } else cur += c
  }
  row.push(cur)
  if (row.some((v) => v.trim() !== "")) rows.push(row)
  if (rows.length < 2) return []
  const headers = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"))
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {}
    headers.forEach((h, i) => { if (h) o[h] = (r[i] ?? "").trim() })
    return o
  })
}
