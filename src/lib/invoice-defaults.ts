import type { CreateInvoiceInput } from "@/schemas/invoice.schema";

/** ISO `YYYY-MM-DD` for a date offset from today by `days`. */
function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/** A human-friendly, reasonably-unique suggested invoice number. */
export function suggestInvoiceNumber(): string {
  return `INV${Date.now()}`;
}

/**
 * Sensible starting values for the create form: today's invoice date, a 14-day
 * due date, and a suggested invoice number the user can override.
 */
export function defaultInvoiceValues(): CreateInvoiceInput {
  return {
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerMobile: "",
    invoiceNumber: suggestInvoiceNumber(),
    invoiceReference: "",
    currency: "GBP",
    invoiceDate: isoDate(0),
    dueDate: isoDate(14),
    description: "",
    itemName: "",
    itemDescription: "",
    quantity: 1,
    rate: 0,
    itemUOM: "UNIT",
    itemExtensions: [],

    // Optional billing address
    addressPremise: "",
    addressCity: "",
    addressCounty: "",
    addressPostcode: "",
    addressCountryCode: "",

    // Optional payee bank account
    bankId: "",
    bankAccountName: "",
    bankSortCode: "",
    bankAccountNumber: "",

    // Optional attachments + custom fields (start empty)
    documents: [],
    customFields: [],
    itemCustomFields: [],
  };
}
