/**
 * Domain types for invoices.
 *
 * The 101 Digital invoice-service returns a large, loosely-typed object. We
 * model only the fields the UI needs and normalise them into a stable shape so
 * the rest of the app is insulated from upstream quirks (e.g. `status` arriving
 * as an array of `{ key, value }` flags rather than a plain string).
 */

/** Upstream status flag, e.g. `{ key: "Overdue", value: true }`. */
export interface UpstreamStatusFlag {
  key: string;
  value: boolean;
}

/** A single invoice as returned inside the upstream `data[]` array (partial). */
export interface UpstreamInvoice {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference?: string;
  currency: string;
  currencySymbol?: string;
  invoiceDate: string;
  dueDate: string;
  description?: string;
  status?: UpstreamStatusFlag[];
  subStatus?: UpstreamStatusFlag[];
  totalAmount?: number;
  balanceAmount?: number;
  totalPaid?: number;
  createdAt?: string;
  // The upstream customer arrives in two shapes: some records carry a combined
  // `name`, others carry `firstName`/`lastName` (e.g. invoices created via our
  // own form). We handle both when normalising.
  customer?: { id?: string; name?: string; firstName?: string; lastName?: string } | null;
  merchant?: { id?: string; name?: string } | null;
}

/** Upstream paging block. */
export interface UpstreamPaging {
  pageNumber: number;
  pageSize: number;
  totalRecords: number;
}

/** The normalised invoice the UI consumes. */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  reference?: string;
  customerName: string;
  currency: string;
  currencySymbol: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  /** Primary human-readable status derived from the upstream flags. */
  status: string;
  totalAmount: number;
  balanceAmount: number;
}

/** A page of normalised invoices, ready for the table + pagination controls. */
export interface InvoicePage {
  items: Invoice[];
  pageNum: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}
