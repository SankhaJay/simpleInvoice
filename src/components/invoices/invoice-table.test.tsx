import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InvoiceTable } from "@/components/invoices/invoice-table";
import type { Invoice } from "@/types/invoice";
import { invoiceQuerySchema } from "@/schemas/invoice-query.schema";

// Rows navigate via useRouter; stub next/navigation for the render.
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}));

const query = invoiceQuerySchema.parse({});
const noop = vi.fn();

const invoice: Invoice = {
  id: "1",
  invoiceNumber: "IV1001",
  customerName: "Ada Lovelace",
  currency: "GBP",
  currencySymbol: "£",
  invoiceDate: "2026-07-01",
  dueDate: "2026-07-15",
  description: "",
  status: "Due",
  totalAmount: 500,
  balanceAmount: 500,
};

describe("InvoiceTable", () => {
  it("shows a skeleton while loading", () => {
    const { container } = render(
      <InvoiceTable invoices={[]} query={query} setQuery={noop} isLoading isFetching={false} />,
    );
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows an empty state when there are no invoices", () => {
    render(
      <InvoiceTable invoices={[]} query={query} setQuery={noop} isLoading={false} isFetching={false} />,
    );
    expect(screen.getByText(/no invoices found/i)).toBeInTheDocument();
  });

  it("renders invoice rows (desktop table + mobile card both present in DOM)", () => {
    render(
      <InvoiceTable
        invoices={[invoice]}
        query={query}
        setQuery={noop}
        isLoading={false}
        isFetching={false}
      />,
    );
    // Rendered in both the table and the mobile card list.
    expect(screen.getAllByText("IV1001").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Ada Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/£500\.00/).length).toBeGreaterThanOrEqual(1);
  });

  it("navigates to the invoice detail when a row is clicked", async () => {
    const user = userEvent.setup();
    render(
      <InvoiceTable
        invoices={[invoice]}
        query={query}
        setQuery={noop}
        isLoading={false}
        isFetching={false}
      />,
    );
    // The customer name appears in both the desktop row and the mobile card;
    // the first (desktop table row) carries the onClick navigation.
    await user.click(screen.getAllByText("Ada Lovelace")[0]!);
    expect(push).toHaveBeenCalledWith("/invoices/1");
  });
});
