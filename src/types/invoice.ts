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

// --- Single-invoice detail -------------------------------------------------

/** Raw upstream address (billing/shipping). */
export interface RawAddress {
  premise?: string;
  city?: string;
  county?: string;
  postcode?: string;
  countryCode?: string;
  addressType?: string;
}

/** Raw upstream line-item extension (adjustment). */
export interface RawItemExtension {
  name?: string;
  addDeduct?: string;
  type?: string;
  value?: number;
  total?: number;
}

/** Raw upstream line item. */
export interface RawItem {
  itemName?: string;
  description?: string;
  quantity?: number;
  rate?: number;
  itemUOM?: string;
  amount?: number;
  netAmount?: number;
  extensions?: RawItemExtension[];
  customFields?: { key?: string; value?: string }[];
}

/** The full invoice object returned by `GET /invoices/{id}` (fields we use). */
export interface RawInvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference?: string;
  referenceNo?: string;
  currency: string;
  currencySymbol?: string;
  invoiceDate: string;
  dueDate: string;
  description?: string;
  status?: UpstreamStatusFlag[];
  invoiceSubTotal?: number;
  totalTax?: number;
  totalDiscount?: number;
  totalAmount?: number;
  totalPaid?: number;
  balanceAmount?: number;
  customer?: {
    id?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    contact?: { email?: string; mobileNumber?: string } | null;
    addresses?: RawAddress[];
  } | null;
  bankAccount?: {
    bankId?: string;
    sortCode?: string;
    accountNumber?: string;
    accountName?: string;
  } | null;
  documents?: { documentId?: string; documentName?: string; documentUrl?: string }[];
  items?: RawItem[];
  customFields?: { key?: string; value?: string }[];
}

export interface InvoiceItemExtension {
  name: string;
  addDeduct: string;
  type: string;
  value: number;
}

export interface InvoiceItemDetail {
  itemName: string;
  description: string;
  quantity: number;
  rate: number;
  itemUOM: string;
  amount: number;
  extensions: InvoiceItemExtension[];
  customFields: { key: string; value: string }[];
}

export interface InvoiceAddress {
  premise?: string;
  city?: string;
  county?: string;
  postcode?: string;
  countryCode?: string;
  addressType?: string;
}

/** The normalised, UI-facing single invoice. */
export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  reference?: string;
  status: string;
  currency: string;
  currencySymbol: string;
  invoiceDate: string;
  dueDate: string;
  description: string;
  customer: {
    name: string;
    email?: string;
    mobile?: string;
    address?: InvoiceAddress;
  };
  items: InvoiceItemDetail[];
  bankAccount?: { accountName?: string; accountNumber?: string; sortCode?: string; bankId?: string };
  documents: { documentId?: string; documentName?: string; documentUrl?: string }[];
  customFields: { key: string; value: string }[];
  totals: {
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paid: number;
    balance: number;
  };
}
