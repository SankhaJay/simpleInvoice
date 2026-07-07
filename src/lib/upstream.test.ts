import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  toUpstreamInvoicePayload,
  normalizeInvoice,
  exchangePasswordForToken,
  refreshAccessToken,
  fetchUserProfile,
  fetchInvoices,
} from "@/lib/upstream";
import type { CreateInvoiceInput } from "@/schemas/invoice.schema";
import type { UpstreamInvoice } from "@/types/invoice";

const baseInput: CreateInvoiceInput = {
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  customerEmail: "ada@example.com",
  customerMobile: "+6597594971",
  invoiceNumber: "INV1001",
  currency: "GBP",
  invoiceDate: "2026-07-07",
  dueDate: "2026-07-21",
  itemName: "Design",
  quantity: 2,
  rate: 100,
  itemUOM: "HOUR",
};

describe("toUpstreamInvoicePayload", () => {
  it("wraps a single line item under invoices[0].items", () => {
    const payload = toUpstreamInvoicePayload(baseInput);
    expect(payload.invoices).toHaveLength(1);
    expect(payload.invoices[0].items).toHaveLength(1);
    expect(payload.invoices[0].items[0]).toMatchObject({
      itemName: "Design",
      quantity: 2,
      rate: 100,
      itemUOM: "HOUR",
    });
  });

  it("maps adjustments to item-level extensions (full matrix, named)", () => {
    const payload = toUpstreamInvoicePayload({
      ...baseInput,
      itemExtensions: [
        { name: "tax", addDeduct: "ADD", type: "FIXED_VALUE", value: 10 },
        { name: "loyalty", addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5 },
        { name: "  ", addDeduct: "ADD", type: "PERCENTAGE", value: 1 }, // dropped (no name)
      ],
    });
    expect(payload.invoices[0].items[0].extensions).toEqual([
      { addDeduct: "ADD", type: "FIXED_VALUE", value: 10, name: "tax" },
      { addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5, name: "loyalty" },
    ]);
  });

  it("puts no extensions at the invoice level and omits them when none given", () => {
    const payload = toUpstreamInvoicePayload(baseInput);
    expect(payload.invoices[0]).not.toHaveProperty("extensions");
    expect(payload.invoices[0].items[0]).not.toHaveProperty("extensions");
  });

  it("keeps a minimal invoice minimal (no optional blocks)", () => {
    const inv = toUpstreamInvoicePayload(baseInput).invoices[0];
    expect(inv).not.toHaveProperty("bankAccount");
    expect(inv).not.toHaveProperty("documents");
    expect(inv).not.toHaveProperty("customFields");
    expect(inv.customer).not.toHaveProperty("addresses");
  });

  it("includes the bank account (with the required bankId) when provided", () => {
    const inv = toUpstreamInvoicePayload({
      ...baseInput,
      bankId: "bank-123",
      bankAccountName: "John Terry",
      bankSortCode: "09-01-01",
      bankAccountNumber: "12345678",
    }).invoices[0];
    expect(inv.bankAccount).toEqual({
      bankId: "bank-123",
      sortCode: "09-01-01",
      accountNumber: "12345678",
      accountName: "John Terry",
    });
  });

  it("includes a billing address (uppercasing the country code) when provided", () => {
    const inv = toUpstreamInvoicePayload({
      ...baseInput,
      addressPremise: "CT11",
      addressCity: "London",
      addressCountryCode: "gb",
    }).invoices[0];
    expect(inv.customer.addresses).toEqual([
      {
        premise: "CT11",
        city: "London",
        county: undefined,
        postcode: undefined,
        countryCode: "GB",
        addressType: "BILLING",
      },
    ]);
  });

  it("maps documents with a generated documentId and drops empty rows", () => {
    const inv = toUpstreamInvoicePayload({
      ...baseInput,
      documents: [
        { documentName: "Bill", documentUrl: "https://example.com/bill.pdf" },
        { documentName: "", documentUrl: "" },
      ],
    }).invoices[0];
    expect(inv.documents).toHaveLength(1);
    expect(inv.documents![0]).toMatchObject({
      documentName: "Bill",
      documentUrl: "https://example.com/bill.pdf",
    });
    expect(typeof inv.documents![0].documentId).toBe("string");
  });

  it("maps invoice- and item-level custom fields, dropping keyless rows", () => {
    const inv = toUpstreamInvoicePayload({
      ...baseInput,
      customFields: [
        { key: "PO", value: "1234" },
        { key: "", value: "ignored" },
      ],
      itemCustomFields: [{ key: "VAT", value: "20%" }],
    }).invoices[0];
    expect(inv.customFields).toEqual([{ key: "PO", value: "1234" }]);
    expect(inv.items[0].customFields).toEqual([{ key: "VAT", value: "20%" }]);
  });
});

describe("normalizeInvoice", () => {
  it("derives the active status from the flag array and flattens fields", () => {
    const raw: UpstreamInvoice = {
      invoiceId: "id-1",
      invoiceNumber: "IV900",
      currency: "LKR",
      currencySymbol: "SLRs",
      invoiceDate: "2026-07-02",
      dueDate: "2026-07-02",
      status: [{ key: "Overdue", value: true }],
      totalAmount: 1000,
      balanceAmount: 250,
      customer: { id: "c1", name: "Terry" },
    };
    const inv = normalizeInvoice(raw);
    expect(inv).toMatchObject({
      id: "id-1",
      invoiceNumber: "IV900",
      customerName: "Terry",
      status: "Overdue",
      totalAmount: 1000,
    });
  });

  it("builds the customer name from firstName/lastName when no combined name", () => {
    const inv = normalizeInvoice({
      invoiceId: "id-3",
      invoiceNumber: "IV902",
      currency: "GBP",
      invoiceDate: "2026-07-02",
      dueDate: "2026-07-02",
      customer: { id: "c3", firstName: "Ada", lastName: "Lovelace" },
    });
    expect(inv.customerName).toBe("Ada Lovelace");
  });

  it("falls back to Draft status and em-dash customer when missing", () => {
    const inv = normalizeInvoice({
      invoiceId: "id-2",
      invoiceNumber: "IV901",
      currency: "GBP",
      invoiceDate: "2026-07-02",
      dueDate: "2026-07-02",
    });
    expect(inv.status).toBe("Draft");
    expect(inv.customerName).toBe("—");
  });
});

describe("upstream HTTP calls (mocked)", () => {
  it("exchangePasswordForToken returns tokens on 200", async () => {
    server.use(
      http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
        HttpResponse.json({ access_token: "AT", refresh_token: "RT", expires_in: 3600 }),
      ),
    );
    const result = await exchangePasswordForToken("user", "pass");
    expect(result).toEqual({ accessToken: "AT", refreshToken: "RT", expiresIn: 3600 });
  });

  it("exchangePasswordForToken maps a 400 to a 401 auth error", async () => {
    server.use(
      http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );
    await expect(exchangePasswordForToken("user", "bad")).rejects.toMatchObject({ status: 401 });
  });

  it("refreshAccessToken exchanges a refresh token for a fresh access token", async () => {
    server.use(
      http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
        HttpResponse.json({ access_token: "fresh", refresh_token: "rt2", expires_in: 3600 }),
      ),
    );
    const result = await refreshAccessToken("rt1");
    expect(result).toEqual({ accessToken: "fresh", refreshToken: "rt2", expiresIn: 3600 });
  });

  it("refreshAccessToken maps an invalid/expired refresh token to a 401", async () => {
    server.use(
      http.post("https://auth.test/t/101digital.core/oauth2/token", () =>
        HttpResponse.json({ error: "invalid_grant" }, { status: 400 }),
      ),
    );
    await expect(refreshAccessToken("dead")).rejects.toMatchObject({ status: 401 });
  });

  it("fetchUserProfile extracts org token from memberships[0]", async () => {
    server.use(
      http.get("https://api.test/membership-service/1.0.0/users/me", () =>
        HttpResponse.json({
          data: {
            userId: "u1",
            firstName: "James",
            lastName: "Vand",
            memberships: [
              { token: "ORG_TOKEN", organisationId: "o1", organisationName: "Corp", roleName: "Owner" },
            ],
          },
        }),
      ),
    );
    const { user, orgToken } = await fetchUserProfile("AT");
    expect(orgToken).toBe("ORG_TOKEN");
    expect(user.organisationName).toBe("Corp");
  });

  it("fetchInvoices normalises items and paging", async () => {
    server.use(
      http.get("https://api.test/invoice-service/1.0.0/invoices", () =>
        HttpResponse.json({
          data: [
            {
              invoiceId: "id-1",
              invoiceNumber: "IV1",
              currency: "GBP",
              invoiceDate: "2026-07-01",
              dueDate: "2026-07-15",
              status: [{ key: "Due", value: true }],
              totalAmount: 500,
              customer: { name: "Ada" },
            },
          ],
          paging: { pageNumber: 1, pageSize: 10, totalRecords: 42 },
        }),
      ),
    );
    const page = await fetchInvoices(
      { sortBy: "CREATED_DATE", ordering: "DESCENDING", pageNum: 1, pageSize: 10 },
      { accessToken: "AT", orgToken: "ORG" },
    );
    expect(page.totalRecords).toBe(42);
    expect(page.totalPages).toBe(5);
    expect(page.items[0].status).toBe("Due");
  });
});
