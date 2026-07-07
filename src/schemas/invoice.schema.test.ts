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
