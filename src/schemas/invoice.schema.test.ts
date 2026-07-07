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

  it("rejects tax above 100%", () => {
    const result = createInvoiceSchema.safeParse({ ...validInvoice, taxPercentage: 150 });
    expect(result.success).toBe(false);
  });
});

describe("computeInvoiceTotals", () => {
  it("computes subtotal, tax (add) and discount (deduct)", () => {
    const totals = computeInvoiceTotals({
      quantity: 3,
      rate: 200,
      taxPercentage: 10,
      discountValue: 50,
    });
    expect(totals.subtotal).toBe(600);
    expect(totals.tax).toBe(60);
    expect(totals.discount).toBe(50);
    expect(totals.total).toBe(610);
  });

  it("handles missing tax/discount as zero", () => {
    const totals = computeInvoiceTotals({ quantity: 1, rate: 99.99 });
    expect(totals.subtotal).toBe(99.99);
    expect(totals.tax).toBe(0);
    expect(totals.total).toBe(99.99);
  });

  it("rounds to two decimals", () => {
    const totals = computeInvoiceTotals({ quantity: 3, rate: 0.1 });
    expect(totals.subtotal).toBe(0.3);
  });
});
