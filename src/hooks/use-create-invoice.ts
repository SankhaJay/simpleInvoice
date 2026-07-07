"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CreateInvoiceInput } from "@/schemas/invoice.schema";

/** Submit a new invoice through the BFF and refresh the cached list on success. */
export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInvoiceInput) =>
      apiFetch<{ invoiceNumber: string; invoiceId?: string }>("/api/invoices", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      // New invoice exists upstream — invalidate every cached list page.
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });
}
