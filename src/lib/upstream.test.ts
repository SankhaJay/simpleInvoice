import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  toUpstreamInvoicePayload,
  normalizeInvoice,
  normalizeInvoiceDetail,
  exchangePasswordForToken,
  refreshAccessToken,
  fetchUserProfile,
  fetchProfile,
  fetchInvoices,
  fetchInvoice,
} from "@/lib/upstream";
import type { CreateInvoiceInput } from "@/schemas/invoice.schema";
import type { UpstreamInvoice } from "@/types/invoice";

const baseInput: CreateInvoiceInput = {
  customerFirstName: "Ada",
  customerLastName: "Lovelace",
  customerEmail: "ada@example.com",
  customerMobile: "+6597594971",
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

  it("maps tax/discount adjustments to item-level extensions and drops amount-less rows", () => {
    const payload = toUpstreamInvoicePayload({
      ...baseInput,
      itemExtensions: [
        { name: "tax", addDeduct: "ADD", type: "FIXED_VALUE", value: 10 },
        { name: "discount", addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5 },
        { name: "tax", addDeduct: "ADD", type: "PERCENTAGE", value: undefined }, // dropped (no amount)
      ],
    });
    expect(payload.invoices[0].items[0].extensions).toEqual([
      { addDeduct: "ADD", type: "FIXED_VALUE", value: 10, name: "tax" },
      { addDeduct: "DEDUCT", type: "PERCENTAGE", value: 5, name: "discount" },
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

  it("never sends an invoice number (backend generates it) but sends a non-blank itemReference", () => {
    const inv = toUpstreamInvoicePayload(baseInput).invoices[0];
    expect(inv).not.toHaveProperty("invoiceNumber");
    expect(inv.items[0].itemReference).toBeTruthy();
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

describe("normalizeInvoiceDetail", () => {
  const rawDetail = {
    invoiceId: "id-9",
    invoiceNumber: "IV999",
    invoiceReference: "#PO-1",
    currency: "SGD",
    currencySymbol: "S$",
    invoiceDate: "2026-07-02",
    dueDate: "2026-07-10",
    description: "Detail test",
    status: [{ key: "Due", value: true }],
    invoiceSubTotal: 1335,
    totalTax: 0,
    totalDiscount: 100,
    totalAmount: 1235,
    totalPaid: 200,
    balanceAmount: 1035,
    customer: {
      firstName: "Shane",
      lastName: "Gomez",
      contact: { email: "shane@example.com", mobileNumber: "+497846567" },
      addresses: [{ premise: "Park Rd", city: "Colorado", countryCode: "US", addressType: "BILLING" }],
    },
    bankAccount: { bankId: "123", sortCode: "09-01-01", accountNumber: "123456", accountName: "Shane" },
    documents: [{ documentId: "d1", documentName: "Tax File", documentUrl: "http://url.com/#1" }],
    items: [
      {
        itemName: "Teddy Bears",
        description: "toys",
        quantity: 89,
        rate: 15,
        itemUOM: "KG",
        amount: 1335,
        extensions: [{ name: "Tax", addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 100 }],
        customFields: [{ key: "k", value: "v" }],
      },
    ],
    customFields: [{ key: "Key1", value: "Value1" }, { key: "", value: "drop" }],
  };

  it("flattens the full detail into the UI shape", () => {
    const d = normalizeInvoiceDetail(rawDetail);
    expect(d.customer.name).toBe("Shane Gomez");
    expect(d.customer.email).toBe("shane@example.com");
    expect(d.customer.address?.city).toBe("Colorado");
    expect(d.items).toHaveLength(1);
    expect(d.items[0].extensions[0]).toEqual({
      name: "Tax",
      addDeduct: "DEDUCT",
      type: "FIXED_VALUE",
      value: 100,
    });
    expect(d.bankAccount?.accountNumber).toBe("123456");
    expect(d.documents).toHaveLength(1);
    expect(d.customFields).toEqual([{ key: "Key1", value: "Value1" }]); // keyless dropped
    expect(d.totals).toEqual({
      subtotal: 1335,
      tax: 0,
      discount: 100,
      total: 1235,
      paid: 200,
      balance: 1035,
    });
  });

  it("omits the bank account when there is no account number", () => {
    const d = normalizeInvoiceDetail({
      ...rawDetail,
      bankAccount: { bankId: "x", sortCode: "", accountNumber: "", accountName: "" },
    });
    expect(d.bankAccount).toBeUndefined();
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

  it("fetchProfile normalises the full profile (token-free)", async () => {
    server.use(
      http.get("https://api.test/membership-service/1.0.0/users/me", () =>
        HttpResponse.json({
          data: {
            userId: "u1",
            firstName: "James",
            lastName: "Vand",
            fullName: "James Vand xyz",
            mobileNumber: "94700000000",
            status: "Active",
            createdAt: "2026-06-05T07:32:01.896",
            contacts: [{ contactType: "EMAIL", value: "james@corp.io" }],
            memberships: [
              {
                token: "ORG_TOKEN",
                organisationId: "o1",
                organisationName: "James Corp",
                roleName: "OrganisationOwner",
                organisationRole: "MERCHANT",
              },
            ],
          },
        }),
      ),
    );
    const profile = await fetchProfile("AT");
    expect(profile).toMatchObject({
      userId: "u1",
      displayName: "James Vand", // prefers first+last over the messy fullName
      mobileNumber: "94700000000",
      email: "james@corp.io",
      status: "Active",
      organisation: { name: "James Corp", role: "OrganisationOwner", organisationRole: "MERCHANT" },
    });
    // Never leak the org token into the profile payload.
    expect(JSON.stringify(profile)).not.toContain("ORG_TOKEN");
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

  it("fetchInvoice returns the normalised detail on 200", async () => {
    server.use(
      http.get("https://api.test/invoice-service/1.0.0/invoices/abc-123", () =>
        HttpResponse.json({
          data: {
            invoiceId: "abc-123",
            invoiceNumber: "IV42",
            currency: "GBP",
            invoiceDate: "2026-07-01",
            dueDate: "2026-07-15",
            status: [{ key: "Paid", value: true }],
            invoiceSubTotal: 100,
            totalAmount: 100,
            customer: { firstName: "Ada", lastName: "Lovelace" },
            items: [{ itemName: "Work", quantity: 1, rate: 100, amount: 100 }],
          },
        }),
      ),
    );
    const detail = await fetchInvoice("abc-123", { accessToken: "AT", orgToken: "ORG" });
    expect(detail.invoiceNumber).toBe("IV42");
    expect(detail.status).toBe("Paid");
    expect(detail.customer.name).toBe("Ada Lovelace");
    expect(detail.items[0].amount).toBe(100);
  });

  it.each([404, 400])("fetchInvoice maps upstream %i to a 404 not-found", async (status) => {
    server.use(
      http.get("https://api.test/invoice-service/1.0.0/invoices/missing", () =>
        HttpResponse.json({ error: "nope" }, { status }),
      ),
    );
    await expect(fetchInvoice("missing", { accessToken: "AT", orgToken: "ORG" })).rejects.toMatchObject(
      { status: 404 },
    );
  });
});
