"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES, type InvoiceQuery } from "@/schemas/invoice-query.schema";
import type { InvoicePage } from "@/types/invoice";

type SetQuery = (patch: Partial<Record<keyof InvoiceQuery, string | number | undefined>>) => void;

export function InvoicePagination({
  page,
  setQuery,
}: {
  page: InvoicePage;
  setQuery: SetQuery;
}) {
  const { pageNum, pageSize, totalRecords, totalPages } = page;
  const from = totalRecords === 0 ? 0 : (pageNum - 1) * pageSize + 1;
  const to = Math.min(pageNum * pageSize, totalRecords);

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {totalRecords === 0 ? "No results" : `${from}–${to} of ${totalRecords}`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => setQuery({ pageSize: Number(v), pageNum: 1 })}
          >
            <SelectTrigger className="h-9 w-[72px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Page {pageNum} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery({ pageNum: pageNum - 1 })}
          disabled={pageNum <= 1}
        >
          <ChevronLeft /> Prev
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setQuery({ pageNum: pageNum + 1 })}
          disabled={pageNum >= totalPages}
        >
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
