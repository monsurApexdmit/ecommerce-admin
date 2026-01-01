// Utility functions for exporting and importing data

export function exportToCSV(data: any[], filename: string, headers: string[]) {
  // Create CSV content
  const csvRows = []

  // Add headers
  csvRows.push(headers.join(","))

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const key = header.toLowerCase().replace(/ /g, "_")
      let value = row[key] || ""

      // Handle special cases
      if (typeof value === "object" && value !== null) {
        value = JSON.stringify(value)
      }

      // Escape commas and quotes
      value = String(value).replace(/"/g, '""')
      return `"${value}"`
    })
    csvRows.push(values.join(","))
  }

  // Create blob and download
  const csvContent = csvRows.join("\n")
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")
  const url = URL.createObjectURL(blob)

  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  link.style.visibility = "hidden"
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function parseCSV(csvText: string): any[] {
  const lines = csvText.split("\n").filter((line) => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/"/g, ""))
    const row: any = {}

    headers.forEach((header, index) => {
      const key = header.toLowerCase().replace(/ /g, "_")
      row[key] = values[index] || ""
    })

    data.push(row)
  }

  return data
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11).toUpperCase()
}
