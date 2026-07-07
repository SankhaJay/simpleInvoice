import { CURRENCIES, UOMS, type CreateInvoiceInput } from "@/schemas/invoice.schema";
import type { InvoiceDetail } from "@/types/invoice";

/** ISO `YYYY-MM-DD` for a date offset from today by `days`. */
function isoDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Sensible starting values for the create form: today's invoice date and a
 * 14-day due date. The invoice number is left blank — the backend generates and
 * stores it unless the user types their own.
 */
export function defaultInvoiceValues(): CreateInvoiceInput {
  return {
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerMobile: "",
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

function toCurrency(code: string): CreateInvoiceInput["currency"] {
  return (CURRENCIES as readonly string[]).includes(code)
    ? (code as CreateInvoiceInput["currency"])
    : "GBP";
}

function toUom(uom: string | undefined): CreateInvoiceInput["itemUOM"] {
  return uom && (UOMS as readonly string[]).includes(uom)
    ? (uom as CreateInvoiceInput["itemUOM"])
    : "UNIT";
}

/** Split a combined "First Last" name into first + remaining. */
function splitName(customer: InvoiceDetail["customer"]): [string, string] {
  if (customer.firstName || customer.lastName) {
    return [customer.firstName ?? "", customer.lastName ?? ""];
  }
  const parts = customer.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || customer.name === "—") return ["", ""];
  if (parts.length === 1) return [parts[0]!, ""];
  return [parts[0]!, parts.slice(1).join(" ")];
}

/**
 * Map a fetched invoice into create-form values for the "Duplicate" flow.
 * Everything is copied EXCEPT the invoice number, which is left blank so the
 * backend assigns a new one (avoiding a collision with the original). Dates are
 * kept as-is. Values outside the form's allowed sets (unknown currency/UOM) fall
 * back to a sensible default so the pre-filled form stays valid.
 */
export function invoiceDetailToFormValues(detail: InvoiceDetail): CreateInvoiceInput {
  const base = defaultInvoiceValues();
  const item = detail.items[0];
  const addr = detail.customer.address;
  const bank = detail.bankAccount;
  const [firstName, lastName] = splitName(detail.customer);

  return {
    ...base,
    customerFirstName: firstName,
    customerLastName: lastName,
    customerEmail: detail.customer.email ?? "",
    customerMobile: detail.customer.mobile ?? "",
    invoiceReference: detail.reference ?? "",
    currency: toCurrency(detail.currency),
    invoiceDate: detail.invoiceDate || base.invoiceDate,
    dueDate: detail.dueDate || base.dueDate,
    description: detail.description ?? "",

    itemName: item?.itemName ?? "",
    itemDescription: item?.description ?? "",
    quantity: item?.quantity || 1,
    rate: item?.rate ?? 0,
    itemUOM: toUom(item?.itemUOM),
    itemExtensions: (item?.extensions ?? []).map((e) => ({
      // The form's name is limited to tax/discount; coerce the upstream label
      // (which may be capitalised, e.g. "Tax") into that set.
      name: e.name.toLowerCase() === "discount" ? "discount" : "tax",
      addDeduct: e.addDeduct === "DEDUCT" ? "DEDUCT" : "ADD",
      type: e.type === "PERCENTAGE" ? "PERCENTAGE" : "FIXED_VALUE",
      value: e.value,
    })),

    addressPremise: addr?.premise ?? "",
    addressCity: addr?.city ?? "",
    addressCounty: addr?.county ?? "",
    addressPostcode: addr?.postcode ?? "",
    addressCountryCode: addr?.countryCode ?? "",

    bankId: bank?.bankId ?? "",
    bankAccountName: bank?.accountName ?? "",
    bankSortCode: bank?.sortCode ?? "",
    bankAccountNumber: bank?.accountNumber ?? "",

    documents: detail.documents.map((d) => ({
      documentName: d.documentName ?? "",
      documentUrl: d.documentUrl ?? "",
    })),
    customFields: detail.customFields.map((c) => ({ key: c.key, value: c.value })),
    itemCustomFields: (item?.customFields ?? []).map((c) => ({ key: c.key, value: c.value })),
  };
}
