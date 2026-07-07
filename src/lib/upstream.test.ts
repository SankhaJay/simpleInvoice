import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  toUpstreamInvoicePayload,
  normalizeInvoice,
  exchangePasswordForToken,
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

  it("maps tax and discount to upstream extensions", () => {
    const payload = toUpstreamInvoicePayload({
      ...baseInput,
      taxPercentage: 10,
      discountValue: 25,
    });
    const ext = payload.invoices[0].extensions;
    expect(ext).toEqual([
      { addDeduct: "ADD", type: "PERCENTAGE", value: 10, name: "tax" },
      { addDeduct: "DEDUCT", type: "FIXED_VALUE", value: 25, name: "discount" },
    ]);
  });

  it("omits extensions when no tax/discount given", () => {
    const payload = toUpstreamInvoicePayload(baseInput);
    expect(payload.invoices[0]).not.toHaveProperty("extensions");
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
