"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, FileX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { SORT_FIELDS, type InvoiceQuery } from "@/schemas/invoice-query.schema";
import type { Invoice } from "@/types/invoice";

type SortField = (typeof SORT_FIELDS)[number];
type SetQuery = (patch: Partial<Record<keyof InvoiceQuery, string | number | undefined>>) => void;

/** Columns that map to an upstream sort field are clickable to sort. */
const COLUMNS: Array<{ label: string; sort?: SortField; align?: "right" }> = [
  { label: "Invoice #" },
  { label: "Customer" },
  { label: "Invoice date", sort: "INVOICE_DATE" },
  { label: "Due date", sort: "DUE_DATE" },
  { label: "Status" },
  { label: "Amount", align: "right" },
];

export function InvoiceTable({
  invoices,
  query,
  setQuery,
  isLoading,
  isFetching,
}: {
  invoices: Invoice[];
  query: InvoiceQuery;
  setQuery: SetQuery;
  isLoading: boolean;
  isFetching: boolean;
}) {
  function toggleSort(field: SortField) {
    const nextOrdering =
      query.sortBy === field && query.ordering === "DESCENDING" ? "ASCENDING" : "DESCENDING";
    setQuery({ sortBy: field, ordering: nextOrdering });
  }

  function sortIcon(field?: SortField) {
    if (!field) return null;
    if (query.sortBy !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return query.ordering === "DESCENDING" ? (
      <ArrowDown className="h-3.5 w-3.5" />
    ) : (
      <ArrowUp className="h-3.5 w-3.5" />
    );
  }

  if (isLoading) return <TableSkeleton />;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
        <FileX2 className="h-10 w-10 text-muted-foreground" />
        <p className="font-medium">No invoices found</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Try adjusting your search or filters, or create a new invoice to get started.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "transition-opacity",
        isFetching && "pointer-events-none opacity-60",
      )}
      aria-busy={isFetching}
    >
      {/* Desktop / tablet: table */}
      <div className="hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead
                  key={col.label}
                  className={col.align === "right" ? "text-right" : undefined}
                >
                  {col.sort ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sort!)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {col.label} {sortIcon(col.sort)}
                    </button>
                  ) : (
                    col.label
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.customerName}</TableCell>
                <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                <TableCell>{formatDate(inv.dueDate)}</TableCell>
                <TableCell>
                  <InvoiceStatusBadge status={inv.status} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(inv.totalAmount, inv.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: cards */}
      <ul className="space-y-3 md:hidden">
        {invoices.map((inv) => (
          <li key={inv.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{inv.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">{inv.customerName}</p>
              </div>
              <InvoiceStatusBadge status={inv.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Invoice date</dt>
                <dd>{formatDate(inv.invoiceDate)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Due date</dt>
                <dd>{formatDate(inv.dueDate)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Amount</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(inv.totalAmount, inv.currency)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg border border-border p-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-20" />
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
