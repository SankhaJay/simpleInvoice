/**
 * Mock 101 Digital upstream for end-to-end tests.
 *
 * The Next.js app under test is real (BFF, session, CSRF, routing) — only the
 * external 101 Digital calls are stubbed here so the E2E suite is deterministic
 * and needs no real credentials. The app is pointed at this server via
 * AUTH_BASE_URL / API_BASE_URL in playwright.config.ts.
 */
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_PORT ?? 4100);

/** Test credentials the E2E specs use. */
// Fictional, non-secret credentials (must match e2e/helpers.ts). Override via
// E2E_USERNAME / E2E_PASSWORD in .env.local.
const TEST_USER = process.env.E2E_USERNAME ?? "e2e-user";
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-password";

/** In-memory invoice store (full records; the list + detail project from these). */
let invoices = seed();

function seed() {
  return [
    record({
      invoiceId: "seed-1",
      invoiceNumber: "IV1001",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      itemName: "Consulting",
      quantity: 2,
      rate: 100,
      invoiceDate: "2026-07-01",
      dueDate: "2026-07-15",
      status: "Due",
    }),
    record({
      invoiceId: "seed-2",
      invoiceNumber: "IV1002",
      firstName: "Grace",
      lastName: "Hopper",
      email: "grace@example.com",
      itemName: "Design",
      quantity: 1,
      rate: 250,
      invoiceDate: "2026-06-20",
      dueDate: "2026-07-04",
      status: "Paid",
    }),
  ];
}

function record(o) {
  const amount = o.quantity * o.rate;
  return {
    invoiceId: o.invoiceId,
    invoiceNumber: o.invoiceNumber,
    invoiceReference: o.invoiceReference ?? "",
    currency: "GBP",
    currencySymbol: "£",
    invoiceDate: o.invoiceDate,
    dueDate: o.dueDate,
    description: o.description ?? "",
    status: [{ key: o.status ?? "Due", value: true }],
    invoiceSubTotal: amount,
    totalTax: 0,
    totalDiscount: 0,
    totalAmount: amount,
    totalPaid: o.status === "Paid" ? amount : 0,
    balanceAmount: o.status === "Paid" ? 0 : amount,
    customer: {
      id: "cust-" + o.invoiceId,
      firstName: o.firstName,
      lastName: o.lastName,
      contact: { email: o.email ?? "", mobileNumber: o.mobile ?? "+6591234567" },
      addresses: [],
    },
    bankAccount: null,
    documents: [],
    customFields: [],
    items: [
      {
        itemName: o.itemName,
        description: o.itemName,
        quantity: o.quantity,
        rate: o.rate,
        itemUOM: "UNIT",
        amount,
        netAmount: amount,
        extensions: [],
        customFields: [],
      },
    ],
  };
}

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const { pathname } = url;
  const method = req.method ?? "GET";

  // --- OAuth2 token (password + refresh grants) ---
  if (method === "POST" && pathname === "/t/101digital.core/oauth2/token") {
    const params = new URLSearchParams(await readBody(req));
    const grant = params.get("grant_type");
    if (grant === "password") {
      if (params.get("username") === TEST_USER && params.get("password") === TEST_PASSWORD) {
        return send(res, 200, token());
      }
      return send(res, 400, { error: "invalid_grant" });
    }
    if (grant === "refresh_token") return send(res, 200, token());
    return send(res, 400, { error: "unsupported_grant_type" });
  }

  // --- Profile ---
  if (method === "GET" && pathname === "/membership-service/1.0.0/users/me") {
    return send(res, 200, {
      data: {
        userId: "user-1",
        userName: "user-uuid",
        firstName: "Test",
        lastName: "User",
        fullName: "Test User",
        mobileNumber: TEST_USER,
        status: "Active",
        createdAt: "2026-06-01T00:00:00.000",
        contacts: [],
        memberships: [
          {
            membershipId: "mem-1",
            token: "mock-org-token",
            organisationId: "org-1",
            organisationName: "Test Corp",
            roleName: "OrganisationOwner",
            organisationRole: "MERCHANT",
          },
        ],
      },
    });
  }

  // --- Invoice by id ---
  const byId = pathname.match(/^\/invoice-service\/1\.0\.0\/invoices\/([^/]+)$/);
  if (method === "GET" && byId) {
    const found = invoices.find((i) => i.invoiceId === decodeURIComponent(byId[1]));
    if (!found) return send(res, 404, { errors: [{ message: "not found" }] });
    return send(res, 200, { data: found });
  }

  // --- Invoice list + create ---
  if (pathname === "/invoice-service/1.0.0/invoices") {
    if (method === "GET") {
      const pageNum = Number(url.searchParams.get("pageNum") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 10);
      const keyword = url.searchParams.get("keyword")?.toLowerCase();
      const filtered = keyword
        ? invoices.filter((i) => i.invoiceNumber.toLowerCase().includes(keyword))
        : invoices;
      const start = (pageNum - 1) * pageSize;
      return send(res, 200, {
        data: filtered.slice(start, start + pageSize),
        paging: { pageNumber: pageNum, pageSize, totalRecords: filtered.length },
      });
    }
    if (method === "POST") {
      const payload = JSON.parse((await readBody(req)) || "{}");
      const inv = payload.invoices?.[0] ?? {};
      const item = inv.items?.[0] ?? {};
      const created = record({
        invoiceId: "inv-" + Date.now(),
        invoiceNumber: "IV" + Date.now(),
        invoiceReference: inv.invoiceReference ?? "",
        firstName: inv.customer?.firstName ?? "",
        lastName: inv.customer?.lastName ?? "",
        email: inv.customer?.contact?.email ?? "",
        mobile: inv.customer?.contact?.mobileNumber ?? "",
        itemName: item.itemName ?? "Item",
        quantity: item.quantity ?? 1,
        rate: item.rate ?? 0,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        description: inv.description ?? "",
        status: "Due",
      });
      invoices = [created, ...invoices];
      return send(res, 201, { data: [created] });
    }
  }

  send(res, 404, { errors: [{ message: `no mock for ${method} ${pathname}` }] });
});

function token() {
  return {
    access_token: "mock-access-" + Date.now(),
    refresh_token: "mock-refresh",
    expires_in: 3600,
    token_type: "Bearer",
    scope: "openid",
    id_token: "mock-id",
  };
}

server.listen(PORT, () => {
  console.log(`[mock-upstream] listening on http://localhost:${PORT}`);
});
