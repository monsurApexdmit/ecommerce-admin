export function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateTime(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function formatCompactDate(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}
