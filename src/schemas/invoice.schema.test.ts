import { describe, it, expect } from "vitest";
import { createInvoiceSchema, computeInvoiceTotals } from "@/schemas/invoice.schema";

const validInvoice = {
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  customerEmail: "ada@example.com",
  customerMobile: "+6597594971",
  invoiceNumber: "INV1001",
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

  it("accepts adjustments across the full add/deduct × fixed/percentage matrix", () => {
    const result = createInvoiceSchema.safeParse({
      ...validInvoice,
      itemExtensions: [
        { name: "surcharge", addDeduct: "ADD", type: "FIXED_VALUE", value: 10 },
        { name: "loyalty", addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5 },
      ],
    });
    expect(result.success).toBe(true);
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
