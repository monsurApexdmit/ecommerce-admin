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

/**
 * The server's message for a failed request, verbatim (e.g. a 422 rule like "Price is out of date…").
 * Validation errors are joined so every field problem is shown.
 */
export function apiErrorMessage(error: any, fallback = "Something went wrong. Please try again."): string {
  const data = error?.response?.data;
  const fieldErrors = data?.errors && typeof data.errors === "object"
    ? Object.values(data.errors as Record<string, unknown>).flat().filter(Boolean).map(String)
    : [];
  if (fieldErrors.length > 0) return Array.from(new Set(fieldErrors)).join("\n");
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;
  if (error?.request && !error?.response) return "Unable to reach the server. Check your connection.";
  return fallback;
}

/** Field -> first message from a Laravel 422 validation response. */
export function apiFieldErrors(error: any): Record<string, string> {
  const errors = error?.response?.data?.errors;
  if (!errors || typeof errors !== "object") return {};
  return Object.fromEntries(
    Object.entries(errors as Record<string, unknown>).map(([k, v]) => [k, String(Array.isArray(v) ? v[0] : v)]),
  );
}

/** Short relative day + time, e.g. "3:00 pm", "tomorrow 10:00 am", "Oct 30, 9:15 am". */
export function formatShortDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase();
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return time;
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}
