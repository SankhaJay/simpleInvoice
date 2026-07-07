import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { Button } from "@/components/ui/button";

export default function NewInvoicePage() {
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/invoices">
            <ArrowLeft /> Back to invoices
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the details below to create and submit a new invoice.
        </p>
      </div>
      <InvoiceForm />
    </div>
  );
}
