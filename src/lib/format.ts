/**
 * Presentation helpers. Pure and locale-aware; safe to use on client or server.
 */

/** Format a numeric amount as currency using the ISO code (falls back gracefully). */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown/invalid currency code — show the code and a fixed-decimal amount.
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Format an ISO `YYYY-MM-DD` (or full ISO) date as e.g. "2 Jul 2026". */
export function formatDate(value: string): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
