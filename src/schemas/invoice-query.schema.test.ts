import { describe, it, expect } from "vitest";
import { invoiceQuerySchema } from "@/schemas/invoice-query.schema";

describe("invoiceQuerySchema", () => {
  it("applies sensible defaults for an empty query", () => {
    const q = invoiceQuerySchema.parse({});
    expect(q).toMatchObject({
      sortBy: "CREATED_DATE",
      ordering: "DESCENDING",
      pageNum: 1,
      pageSize: 10,
    });
  });

  it("coerces numeric string params from the URL", () => {
    const q = invoiceQuerySchema.parse({ pageNum: "3", pageSize: "20" });
    expect(q.pageNum).toBe(3);
    expect(q.pageSize).toBe(20);
  });

  it("clamps pageSize to its maximum via rejection", () => {
    const result = invoiceQuerySchema.safeParse({ pageSize: "1000" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status value", () => {
    const result = invoiceQuerySchema.safeParse({ status: "Unknown" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    const result = invoiceQuerySchema.safeParse({ fromDate: "07-07-2026" });
    expect(result.success).toBe(false);
  });

  it("accepts a full valid query", () => {
    const q = invoiceQuerySchema.parse({
      keyword: "IV123",
      status: "Paid",
      sortBy: "DUE_DATE",
      ordering: "ASCENDING",
      pageNum: "2",
      pageSize: "50",
      fromDate: "2026-01-01",
      toDate: "2026-12-31",
    });
    expect(q.keyword).toBe("IV123");
    expect(q.status).toBe("Paid");
    expect(q.sortBy).toBe("DUE_DATE");
  });
});
