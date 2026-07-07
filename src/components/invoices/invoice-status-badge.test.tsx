import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";

describe("InvoiceStatusBadge", () => {
  it("renders the status label", () => {
    render(<InvoiceStatusBadge status="Paid" />);
    expect(screen.getByText("Paid")).toBeInTheDocument();
  });

  it("renders unknown statuses without crashing", () => {
    render(<InvoiceStatusBadge status="Something" />);
    expect(screen.getByText("Something")).toBeInTheDocument();
  });
});
