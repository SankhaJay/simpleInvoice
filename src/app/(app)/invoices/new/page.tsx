import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const duplicateFrom = typeof sp.from === "string" ? sp.from : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/invoices">
            <ArrowLeft /> Back to invoices
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          {duplicateFrom ? "Duplicate invoice" : "New invoice"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {duplicateFrom
            ? "We’ve copied the details from an existing invoice. Review and adjust before creating."
            : "Fill in the details below to create and submit a new invoice."}
        </p>
      </div>
      <InvoiceForm duplicateFrom={duplicateFrom} />
    </div>
  );
}
