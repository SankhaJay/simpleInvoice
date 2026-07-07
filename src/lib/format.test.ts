import { describe, it, expect } from "vitest";
import { formatCurrency, formatDate } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats a known currency", () => {
    expect(formatCurrency(1234.5, "GBP")).toContain("1,234.50");
  });

  it("renders a well-formed but uncommon currency code", () => {
    const out = formatCurrency(10, "XYZ");
    expect(out).toContain("XYZ");
    expect(out).toContain("10.00");
  });

  it("falls back gracefully for a malformed currency code", () => {
    // `Intl` throws for codes that are not 3 letters — the catch path handles it.
    expect(formatCurrency(10, "X")).toBe("X 10.00");
  });
});

describe("formatDate", () => {
  it("formats a YYYY-MM-DD date", () => {
    expect(formatDate("2026-07-02")).toBe("2 Jul 2026");
  });

  it("returns an em-dash for empty input", () => {
    expect(formatDate("")).toBe("—");
  });

  it("returns the original string for an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });
});
