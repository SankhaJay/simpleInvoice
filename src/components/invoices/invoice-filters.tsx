"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { STATUS_FILTERS, type InvoiceQuery } from "@/schemas/invoice-query.schema";

const ALL = "ALL";

type SetQuery = (patch: Partial<Record<keyof InvoiceQuery, string | number | undefined>>) => void;

export function InvoiceFilters({
  query,
  setQuery,
}: {
  query: InvoiceQuery;
  setQuery: SetQuery;
}) {
  // Local, immediately-responsive search text; pushed to the URL after a pause.
  const [search, setSearch] = React.useState(query.keyword ?? "");
  const debouncedSearch = useDebouncedValue(search, 400);
  const lastPushed = React.useRef(query.keyword ?? "");

  React.useEffect(() => {
    if (debouncedSearch !== lastPushed.current) {
      lastPushed.current = debouncedSearch;
      setQuery({ keyword: debouncedSearch || undefined });
    }
  }, [debouncedSearch, setQuery]);

  function clearAll() {
    setSearch("");
    lastPushed.current = "";
    setQuery({ keyword: undefined, status: undefined, fromDate: undefined, toDate: undefined });
  }

  const hasActiveFilters =
    !!query.keyword || !!query.status || !!query.fromDate || !!query.toDate;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invoice-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="invoice-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Invoice number or keyword…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-status">Status</Label>
          <Select
            value={query.status ?? ALL}
            onValueChange={(v) => setQuery({ status: v === ALL ? undefined : v })}
          >
            <SelectTrigger id="invoice-status" className="w-full lg:w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {STATUS_FILTERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-from">From</Label>
          <Input
            id="invoice-from"
            type="date"
            value={query.fromDate ?? ""}
            max={query.toDate || undefined}
            onChange={(e) => setQuery({ fromDate: e.target.value || undefined })}
            className="w-full lg:w-40"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice-to">To</Label>
          <Input
            id="invoice-to"
            type="date"
            value={query.toDate ?? ""}
            min={query.fromDate || undefined}
            onChange={(e) => setQuery({ toDate: e.target.value || undefined })}
            className="w-full lg:w-40"
          />
        </div>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearAll}>
            <X /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}
