import { describe, it, expect } from "vitest";
import { invoiceDetailToFormValues } from "@/lib/invoice-defaults";
import { createInvoiceSchema } from "@/schemas/invoice.schema";
import type { InvoiceDetail } from "@/types/invoice";

const detail: InvoiceDetail = {
  id: "inv-1",
  invoiceNumber: "IV1000",
  reference: "#PO-9",
  status: "Due",
  currency: "GBP",
  currencySymbol: "£",
  invoiceDate: "2026-05-01",
  dueDate: "2026-05-15",
  description: "Original invoice",
  customer: {
    name: "Ada Lovelace",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    mobile: "+6591234567",
    address: { premise: "CT11", city: "London", countryCode: "GB", addressType: "BILLING" },
  },
  items: [
    {
      itemName: "Consulting",
      description: "Advisory",
      quantity: 3,
      rate: 200,
      itemUOM: "HOUR",
      amount: 600,
      extensions: [{ name: "Tax", addDeduct: "ADD", type: "PERCENTAGE", value: 10 }],
      customFields: [{ key: "VAT", value: "20%" }],
    },
  ],
  bankAccount: { accountName: "Ada", accountNumber: "12345678", sortCode: "09-01-01", bankId: "b1" },
  documents: [{ documentId: "d1", documentName: "Contract", documentUrl: "https://x.io/c.pdf" }],
  customFields: [{ key: "PO", value: "9" }],
  totals: { subtotal: 600, tax: 60, discount: 0, total: 660, paid: 0, balance: 660 },
};

describe("invoiceDetailToFormValues", () => {
  const values = invoiceDetailToFormValues(detail);

  it("keeps the original invoice and due dates", () => {
    expect(values.invoiceDate).toBe("2026-05-01");
    expect(values.dueDate).toBe("2026-05-15");
  });

  it("copies customer, item, bank, address, documents and custom fields", () => {
    expect(values.customerFirstName).toBe("Ada");
    expect(values.customerLastName).toBe("Lovelace");
    expect(values.customerEmail).toBe("ada@example.com");
    expect(values.itemName).toBe("Consulting");
    expect(values.quantity).toBe(3);
    expect(values.rate).toBe(200);
    expect(values.itemUOM).toBe("HOUR");
    expect(values.bankAccountNumber).toBe("12345678");
    expect(values.addressCity).toBe("London");
    expect(values.documents).toEqual([{ documentName: "Contract", documentUrl: "https://x.io/c.pdf" }]);
    expect(values.customFields).toEqual([{ key: "PO", value: "9" }]);
    expect(values.itemCustomFields).toEqual([{ key: "VAT", value: "20%" }]);
  });

  it("coerces the adjustment name to the tax/discount set", () => {
    expect(values.itemExtensions).toEqual([
      { name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: 10 },
    ]);
  });

  it("carries BOTH tax and discount adjustments into the duplicate form", () => {
    const v = invoiceDetailToFormValues({
      ...detail,
      items: [
        {
          ...detail.items[0]!,
          extensions: [
            { name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: 10 },
            { name: "discount", addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 15 },
          ],
        },
      ],
    });
    expect(v.itemExtensions).toEqual([
      { name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: 10 },
      { name: "discount", addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 15 },
    ]);
  });

  it("produces values that pass the create schema", () => {
    expect(createInvoiceSchema.safeParse(values).success).toBe(true);
  });

  it("falls back for an unknown currency / UOM and splits a combined name", () => {
    const v = invoiceDetailToFormValues({
      ...detail,
      currency: "ZZZ",
      customer: { name: "Terry the Cus" }, // no firstName/lastName
      items: [{ ...detail.items[0]!, itemUOM: "WEIRD" }],
    });
    expect(v.currency).toBe("GBP");
    expect(v.itemUOM).toBe("UNIT");
    expect(v.customerFirstName).toBe("Terry");
    expect(v.customerLastName).toBe("the Cus");
  });
});
