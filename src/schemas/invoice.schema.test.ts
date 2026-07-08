import { describe, it, expect } from "vitest";
import { createInvoiceSchema, computeInvoiceTotals } from "@/schemas/invoice.schema";

const validInvoice = {
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  customerEmail: "ada@example.com",
  customerMobile: "+6597594971",
  currency: "GBP" as const,
  invoiceDate: "2026-07-07",
  dueDate: "2026-07-21",
  itemName: "Design",
  quantity: 2,
  rate: 100,
  itemUOM: "HOUR" as const,
};

describe("createInvoiceSchema", () => {
  it("accepts a valid single-line-item invoice", () => {
    const result = createInvoiceSchema.safeParse(validInvoice);
    expect(result.success).toBe(true);
  });

  // The upstream invoice-service rejects a set of special characters in
  // free-text fields (verified against the live API). The schema mirrors that
  // so the user gets a clear inline error instead of a cryptic 400 on submit.
  it("rejects characters the upstream API disallows in the description", () => {
    for (const bad of [":", ";", "?", '"', "*", "£", "€", "—", "…", "“", "”", "‘", "’", "•"]) {
      const result = createInvoiceSchema.safeParse({
        ...validInvoice,
        description: `Invoice ${bad} note`,
      });
      expect(result.success, `expected ${JSON.stringify(bad)} to be rejected`).toBe(false);
    }
  });

  it("names the unsupported character(s) in the message", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, description: "a : b ; c" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(":");
      expect(result.error.issues[0].message).toContain(";");
    }
  });

  it("accepts letters (incl. accents), digits and the allowed punctuation", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      description: "Café & Co. (2026) — no wait, hyphen-ok: order #12/3 @ 50% + $5 = done!",
      itemDescription: "José's item_reference/A (v2) #7 <tag> 100%",
    });
    // The em-dash and colon above make this specific string invalid; assert the
    // allowed subset separately to avoid coupling to those two characters.
    const ok = createInvoiceSchema.safeParse({
      ...validInvoice,
      description: "Café & Co. (2026), hyphen-ok, order #12/3 @ 50% + $5 = done!",
      itemDescription: "José's item_reference/A (v2) #7 <tag> 100%",
    });
    expect(result.success).toBe(false); // contains — and :
    expect(ok.success, JSON.stringify(ok.success ? "" : ok.error.issues)).toBe(true);
  });

  it("also guards the item description field", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemDescription: "line : item",
    });
    expect(result.success).toBe(false);
  });

  // The upstream character restriction is API-wide — verified against the live
  // API across every free-text field — so the guard is applied to all of them.
  it("guards every free-text field the API restricts", () => {
    const fields: Array<[string, unknown]> = [
      ["customerFirstName", "Ada:"],
      ["customerLastName", "Lovelace;"],
      ["invoiceReference", "PO-1234 *"],
      ["itemName", "Design ?"],
      ["addressPremise", "CT11 : road"],
      ["addressCity", "London;"],
      ["addressCounty", "Kent*"],
      ["addressPostcode", "AB1:2CD"],
      ["bankId", "bank:id"],
      ["bankAccountName", "John : Terry"],
    ];
    for (const [field, bad] of fields) {
      const result = createInvoiceSchema.safeParse({ ...validInvoice, [field]: bad });
      expect(result.success, `expected ${field}=${JSON.stringify(bad)} to be rejected`).toBe(false);
    }
  });

  it("guards custom field keys/values and document names, but not document URLs", () => {
    expect(
      createInvoiceSchema.safeParse({ ...validInvoice, customFields: [{ key: "k:1", value: "v" }] })
        .success,
    ).toBe(false);
    expect(
      createInvoiceSchema.safeParse({ ...validInvoice, customFields: [{ key: "k", value: "v:1" }] })
        .success,
    ).toBe(false);
    expect(
      createInvoiceSchema.safeParse({
        ...validInvoice,
        documents: [{ documentName: "Bill : 1", documentUrl: "https://example.com/x" }],
      }).success,
    ).toBe(false);
    // A URL legitimately contains ':' — it must still be accepted.
    expect(
      createInvoiceSchema.safeParse({
        ...validInvoice,
        documents: [{ documentName: "Bill 1", documentUrl: "https://example.com/x" }],
      }).success,
    ).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, customerEmail: "not-an-email" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "customerEmail")).toBe(true);
    }
  });

  it("rejects a due date before the invoice date", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: "2026-07-21",
      dueDate: "2026-07-07",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("dueDate"))).toBe(true);
    }
  });

  it("accepts a due date equal to the invoice date", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: "2026-07-07",
      dueDate: "2026-07-07",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a due date after the invoice date", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: "2026-07-07",
      dueDate: "2026-07-08",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive quantity", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, quantity: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed phone number", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, customerMobile: "abc" });
    expect(result.success).toBe(false);
  });

  it("rejects an adjustment with a negative value", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [{ name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: -5 }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts tax/discount adjustments across the add/deduct × fixed/percentage matrix", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [
        { name: "tax", addDeduct: "ADD", type: "FIXED_VALUE", value: 10 },
        { name: "discount", addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an adjustment name outside tax/discount", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [{ name: "surcharge", addDeduct: "ADD", type: "FIXED_VALUE", value: 10 }],
    });
    expect(result.success).toBe(false);
  });

  it("requires the full bank block once any bank field is entered", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, bankAccountNumber: "12345678" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("bankId");
      expect(paths).toContain("bankAccountName");
      expect(paths).toContain("bankSortCode");
    }
  });

  it("accepts a complete bank block", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      bankId: "bank-123",
      bankAccountName: "John Terry",
      bankSortCode: "09-01-01",
      bankAccountNumber: "12345678",
    });
    expect(result.success).toBe(true);
  });

  // --- dates ---
  it("rejects an impossible calendar date", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, invoiceDate: "2026-13-45" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === "invoiceDate")).toBe(true);
    }
  });

  it("rejects a year outside the accepted bounds", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, invoiceDate: "1999-01-01", dueDate: "1999-02-01" }).success).toBe(false);
    expect(createInvoiceSchema.safeParse({ ...validInvoice, invoiceDate: "2101-01-01", dueDate: "2101-02-01" }).success).toBe(false);
  });

  // --- optional rows: drop empty, flag partial ---
  it("treats fully-empty optional rows as absent (valid)", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [{ name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: undefined }],
      customFields: [{ key: "", value: "" }],
      documents: [{ documentName: "", documentUrl: "" }],
    });
    expect(result.success).toBe(true);
  });

  it("flags a partially-filled document row", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      documents: [{ documentName: "Bill", documentUrl: "" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a document URL that is not http(s)", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      documents: [{ documentName: "Bill", documentUrl: "ftp://example.com/x" }],
    });
    expect(result.success).toBe(false);
  });

  it("flags a custom-field value with no key", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      customFields: [{ key: "", value: "orphan" }],
    });
    expect(result.success).toBe(false);
  });

  // --- percentage cap ---
  it("rejects a PERCENTAGE adjustment above 100", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [{ name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: 150 }],
    });
    expect(result.success).toBe(false);
  });

  it("allows a FIXED_VALUE adjustment above 100 (only percentages are capped)", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [{ name: "discount", addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 500 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("computeInvoiceTotals", () => {
  it("supports the full matrix (percentage add, fixed add, percentage deduct, fixed deduct)", () => {
    const totals = computeInvoiceTotals({
      quantity: 3,
      rate: 200, // subtotal = 600
      extensions: [
        { addDeduct: "ADD", type: "PERCENTAGE", value: 10 }, // +60
        { addDeduct: "ADD", type: "FIXED_VALUE", value: 15 }, // +15
        { addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5 }, // -30
        { addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 25 }, // -25
      ],
    });
    expect(totals.subtotal).toBe(600);
    expect(totals.additions).toBe(75);
    expect(totals.deductions).toBe(55);
    expect(totals.total).toBe(620);
  });

  it("handles no adjustments as just the subtotal", () => {
    const totals = computeInvoiceTotals({ quantity: 1, rate: 99.99 });
    expect(totals.subtotal).toBe(99.99);
    expect(totals.additions).toBe(0);
    expect(totals.deductions).toBe(0);
    expect(totals.total).toBe(99.99);
  });

  it("rounds to two decimals", () => {
    const totals = computeInvoiceTotals({ quantity: 3, rate: 0.1 });
    expect(totals.subtotal).toBe(0.3);
  });
});
