"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { invoiceQuerySchema, type InvoiceQuery } from "@/schemas/invoice-query.schema";

/**
 * The invoice list keeps ALL of its state (search, filter, sort, page) in the
 * URL. This makes every view shareable and bookmarkable and gives correct
 * browser back/forward behaviour "for free". This hook is the single adapter
 * between `URLSearchParams` and our typed, validated `InvoiceQuery`.
 */
export function useInvoiceQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Parse+validate current URL into a typed query (defaults fill the gaps).
  const query: InvoiceQuery = React.useMemo(() => {
    const raw = Object.fromEntries(searchParams.entries());
    const parsed = invoiceQuerySchema.safeParse(raw);
    return parsed.success ? parsed.data : invoiceQuerySchema.parse({});
  }, [searchParams]);

  /**
   * Merge a partial patch into the URL. Any change other than paging resets to
   * page 1 so the user never lands on an out-of-range page after filtering.
   */
  const setQuery = React.useCallback(
    (patch: Partial<Record<keyof InvoiceQuery, string | number | undefined>>) => {
      const next = new URLSearchParams(searchParams.toString());
      const resetsPage = !("pageNum" in patch);

      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === null) next.delete(key);
        else next.set(key, String(value));
      }
      if (resetsPage) next.delete("pageNum");

      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { query, setQuery };
}
