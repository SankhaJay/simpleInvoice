import { Suspense } from "react";
import { InvoiceList } from "@/components/invoices/invoice-list";
import { Skeleton } from "@/components/ui/skeleton";

/** The authenticated landing screen: the invoice list. */
export default function InvoicesPage() {
  return (
    // useSearchParams (inside InvoiceList) requires a Suspense boundary.
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
      <InvoiceList />
    </Suspense>
  );
}
