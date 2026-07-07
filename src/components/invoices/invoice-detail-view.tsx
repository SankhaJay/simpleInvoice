"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Copy, FileX2, Landmark, Paperclip, Tags, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { useInvoice } from "@/hooks/use-invoice";
import { ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import type { InvoiceDetail, InvoiceItemDetail } from "@/types/invoice";

export function InvoiceDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { data, isLoading, isError, error, refetch } = useInvoice(id);

  // A 401 means the session couldn't be refreshed — route to login.
  React.useEffect(() => {
    if (error instanceof ApiClientError && error.status === 401) router.replace("/login");
  }, [error, router]);

  const notFound = error instanceof ApiClientError && error.status === 404;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/invoices">
          <ArrowLeft /> Back to invoices
        </Link>
      </Button>

      {isLoading && <DetailSkeleton />}

      {isError && notFound && (
        <EmptyState
          title="Invoice not found"
          message="This invoice doesn’t exist or you don’t have access to it."
        />
      )}

      {isError && !notFound && (
        <EmptyState
          title="Couldn’t load this invoice"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
        />
      )}

      {data && <Detail invoice={data} />}
    </div>
  );
}

function Detail({ invoice }: { invoice: InvoiceDetail }) {
  const { currency } = invoice;
  const money = (n: number) => formatCurrency(n, currency);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          {invoice.reference && (
            <p className="text-sm text-muted-foreground">Ref: {invoice.reference}</p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href={`/invoices/new?from=${invoice.id}`}>
              <Copy /> Duplicate
            </Link>
          </Button>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-semibold tabular-nums">{money(invoice.totals.total)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Line items */}
          <Card>
            <CardHeader>
              <CardTitle>Line items</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {/* Tablet / desktop: table (unchanged) */}
              <div className="hidden rounded-lg border border-border md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium">{item.itemName}</p>
                          {item.description && (
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          )}
                          <div className="mt-1">
                            <ItemExtras item={item} money={money} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {item.quantity} {item.itemUOM}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{money(item.rate)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {money(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile: one stacked card per line item */}
              <ul className="space-y-3 md:hidden">
                {invoice.items.map((item, i) => (
                  <li key={i} className="space-y-3 rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium">{item.itemName}</p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Row label="Quantity" value={`${item.quantity} ${item.itemUOM}`} />
                      <Row label="Rate" value={money(item.rate)} />
                      <Row label="Amount" value={money(item.amount)} strong />
                    </div>
                    {(item.extensions.length > 0 || item.customFields.length > 0) && (
                      <div className="space-y-0.5 border-t border-border pt-2">
                        <ItemExtras item={item} money={money} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Customer */}
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
              <Detail.Field label="Name" value={invoice.customer.name} />
              <Detail.Field label="Email" value={invoice.customer.email} />
              <Detail.Field label="Mobile" value={invoice.customer.mobile} />
              {invoice.customer.address && (
                <Detail.Field
                  label="Billing address"
                  value={formatAddress(invoice.customer.address)}
                  className="sm:col-span-2"
                />
              )}
            </CardContent>
          </Card>

          {/* Bank account */}
          {invoice.bankAccount && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-4 w-4" /> Bank account
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
                <Detail.Field label="Account name" value={invoice.bankAccount.accountName} />
                <Detail.Field label="Account number" value={invoice.bankAccount.accountNumber} />
                <Detail.Field label="Sort code" value={invoice.bankAccount.sortCode} />
                <Detail.Field label="Bank ID" value={invoice.bankAccount.bankId} />
              </CardContent>
            </Card>
          )}

          {/* Documents */}
          {invoice.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" /> Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {invoice.documents.map((doc, i) => (
                  <a
                    key={i}
                    href={doc.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {doc.documentName || doc.documentUrl}
                  </a>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Custom fields */}
          {invoice.customFields.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="h-4 w-4" /> Custom fields
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 pt-0 sm:grid-cols-2">
                {invoice.customFields.map((f, i) => (
                  <Detail.Field key={i} label={f.key} value={f.value} />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary rail */}
        <div className="lg:col-span-1">
          <Card className="lg:sticky lg:top-24">
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="space-y-2 text-sm">
                <Detail.Field label="Invoice date" value={formatDate(invoice.invoiceDate)} inline />
                <Detail.Field label="Due date" value={formatDate(invoice.dueDate)} inline />
                <Detail.Field label="Currency" value={invoice.currency} inline />
              </div>
              <div className="space-y-2 border-t border-border pt-4">
                <Row label="Subtotal" value={money(invoice.totals.subtotal)} />
                <Row label="Tax" value={money(invoice.totals.tax)} />
                <Row label="Discount" value={`- ${money(invoice.totals.discount)}`} />
                <Row label="Total" value={money(invoice.totals.total)} strong />
                <Row label="Paid" value={money(invoice.totals.paid)} />
                <Row label="Balance due" value={money(invoice.totals.balance)} strong />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

/** A line item's adjustments (tax/discount) and custom fields — shared by the
 *  desktop table cell and the mobile stacked card so the markup stays in sync. */
function ItemExtras({
  item,
  money,
}: {
  item: InvoiceItemDetail;
  money: (n: number) => string;
}) {
  if (item.extensions.length === 0 && item.customFields.length === 0) return null;
  return (
    <>
      {item.extensions.length > 0 && (
        <ul className="space-y-0.5">
          {item.extensions.map((ext, j) => (
            <li key={j} className="text-xs text-muted-foreground">
              {ext.addDeduct === "DEDUCT" ? "−" : "+"} {ext.name}:{" "}
              {ext.type === "PERCENTAGE" ? `${ext.value}%` : money(ext.value)}
            </li>
          ))}
        </ul>
      )}
      {item.customFields.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {item.customFields.map((f) => `${f.key}: ${f.value}`).join(" · ")}
        </p>
      )}
    </>
  );
}

Detail.Field = function Field({
  label,
  value,
  className,
  inline,
}: {
  label: string;
  value?: string;
  className?: string;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div className={cn("flex items-center justify-between gap-4", className)}>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-right font-medium">{value || "—"}</span>
      </div>
    );
  }
  return (
    <div className={className}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
};

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "text-base font-semibold tabular-nums" : "tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

function formatAddress(a: NonNullable<InvoiceDetail["customer"]["address"]>): string {
  return [a.premise, a.city, a.county, a.postcode, a.countryCode].filter(Boolean).join(", ");
}

function EmptyState({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <FileX2 className="h-10 w-10 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw /> Retry
        </Button>
      ) : (
        <Button asChild variant="outline" size="sm">
          <Link href="/invoices">Back to invoices</Link>
        </Button>
      )}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
