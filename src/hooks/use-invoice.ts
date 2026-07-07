"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { InvoiceDetail } from "@/types/invoice";

/** Fetch a single invoice's full detail by id. */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: ["invoice", id],
    queryFn: () => apiFetch<InvoiceDetail>(`/api/invoices/${encodeURIComponent(id)}`),
    enabled: Boolean(id),
  });
}
