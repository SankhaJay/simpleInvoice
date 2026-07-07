"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { InvoiceQuery } from "@/schemas/invoice-query.schema";
import type { InvoicePage } from "@/types/invoice";

/** Serialise a typed query into a stable querystring for the BFF + cache key. */
function toSearchParams(query: InvoiceQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

/**
 * Fetch a page of invoices for the given query. `keepPreviousData` keeps the
 * current page visible while the next one loads, avoiding a flash of empty
 * state during pagination/filtering.
 */
export function useInvoices(query: InvoiceQuery) {
  const qs = toSearchParams(query);
  return useQuery({
    queryKey: ["invoices", qs],
    queryFn: () => apiFetch<InvoicePage>(`/api/invoices?${qs}`),
    placeholderData: keepPreviousData,
  });
}
