"use client";

import Link from "next/link";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceFilters } from "@/components/invoices/invoice-filters";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import { InvoicePagination } from "@/components/invoices/invoice-pagination";
import { useInvoiceQueryState } from "@/hooks/use-invoice-query-state";
import { useInvoices } from "@/hooks/use-invoices";

export function InvoiceList() {
  const { query, setQuery } = useInvoiceQueryState();
  const { data, isLoading, isFetching, isError, error, refetch } = useInvoices(query);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Search, filter and manage every invoice you&apos;ve created.
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <Plus /> New invoice
          </Link>
        </Button>
      </div>

      <InvoiceFilters query={query} setQuery={setQuery} />

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <p className="font-medium">Couldn&apos;t load invoices</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Please try again."}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw /> Retry
          </Button>
        </div>
      ) : (
        <>
          <InvoiceTable
            invoices={data?.items ?? []}
            query={query}
            setQuery={setQuery}
            isLoading={isLoading}
            isFetching={isFetching}
          />
          {data && data.totalRecords > 0 && (
            <InvoicePagination page={data} setQuery={setQuery} />
          )}
        </>
      )}
    </div>
  );
}
