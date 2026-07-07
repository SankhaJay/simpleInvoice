import "server-only";
import { env } from "@/lib/env";
import { fetchWithTimeout, parseJsonSafe, UpstreamError } from "@/lib/http";
import type { CreateInvoiceInput } from "@/schemas/invoice.schema";
import type { InvoiceQuery } from "@/schemas/invoice-query.schema";
import type {
  Invoice,
  InvoicePage,
  UpstreamInvoice,
  UpstreamPaging,
} from "@/types/invoice";
import type { SessionUser } from "@/types/session";

/**
 * The 101 Digital integration layer. This is the ONLY module that knows the
 * upstream URLs, header conventions and token semantics. Everything else in the
 * app talks to our own BFF, which delegates here.
 */

interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** Credentials attached to every authenticated upstream call. */
export interface UpstreamAuth {
  accessToken: string;
  orgToken: string;
}

/**
 * Step 1 of login — OAuth2 password grant. Runs server-side only; the
 * client_id/client_secret come from non-public env vars and never touch the
 * browser.
 */
export async function exchangePasswordForToken(
  username: string,
  password: string,
): Promise<TokenResult> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      grant_type: "password",
      scope: env.OAUTH_SCOPE,
      username,
      password,
    }),
    "Invalid username or password.",
  );
}

/**
 * Exchange a refresh token for a fresh access token. Used to recover silently
 * from upstream 401s.
 *
 * Context: the 101 Digital identity server issues a single active access token
 * per (client, user) and revokes the previous one on each new password‑grant
 * login. On the SHARED sandbox credentials, another login elsewhere therefore
 * revokes ours mid‑session. The refresh token survives a competing login (it is
 * not revoked by a password grant), so refreshing recovers the session without
 * forcing the user to sign in again.
 */
export async function refreshAccessToken(refreshToken: string): Promise<TokenResult> {
  return postTokenRequest(
    new URLSearchParams({
      client_id: env.OAUTH_CLIENT_ID,
      client_secret: env.OAUTH_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    "Your session has expired. Please sign in again.",
  );
}

/** Shared OAuth2 token-endpoint POST used by the password and refresh grants. */
async function postTokenRequest(
  body: URLSearchParams,
  failureMessage: string,
): Promise<TokenResult> {
  const res = await fetchWithTimeout(`${env.AUTH_BASE_URL}/t/101digital.core/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    // Send the pre-encoded string (byte-identical to the URLSearchParams body)
    // with an explicit content-type.
    body: body.toString(),
  });

  if (!res.ok) {
    // A 400/401 here means bad credentials or an invalid/expired refresh token.
    // We deliberately do not forward the (noisy) upstream body to the client.
    throw new UpstreamError(res.status === 400 ? 401 : res.status, failureMessage);
  }

  const json = await parseJsonSafe<{
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  }>(res);

  if (!json?.access_token) {
    throw new UpstreamError(502, "Identity server did not return an access token.");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

/**
 * Step 2 of login — fetch the profile and derive the org token from
 * `memberships[0].token`, plus the safe user fields we surface to the client.
 */
export async function fetchUserProfile(
  accessToken: string,
): Promise<{ user: SessionUser; orgToken: string }> {
  const res = await fetchWithTimeout(
    `${env.API_BASE_URL}/membership-service/1.0.0/users/me`,
    { headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" } },
  );

  if (!res.ok) {
    throw new UpstreamError(res.status, "Could not load your user profile.");
  }

  const json = await parseJsonSafe<{ data?: RawProfile }>(res);
  const data = json?.data;
  const membership = data?.memberships?.[0];

  if (!data || !membership?.token) {
    throw new UpstreamError(502, "Profile response did not include an organisation token.");
  }

  const user: SessionUser = {
    userId: data.userId ?? "",
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    fullName: data.fullName ?? `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim(),
    organisationId: membership.organisationId ?? "",
    organisationName: membership.organisationName ?? "",
    roleName: membership.roleName ?? "",
  };

  return { user, orgToken: membership.token };
}

interface RawProfile {
  userId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  memberships?: Array<{
    token?: string;
    organisationId?: string;
    organisationName?: string;
    roleName?: string;
  }>;
}

/** Fetch a page of invoices with search / sort / filter / pagination. */
export async function fetchInvoices(
  query: InvoiceQuery,
  auth: UpstreamAuth,
): Promise<InvoicePage> {
  const params = new URLSearchParams({
    sortBy: query.sortBy,
    ordering: query.ordering,
    pageNum: String(query.pageNum),
    pageSize: String(query.pageSize),
  });
  if (query.keyword) params.set("keyword", query.keyword);
  if (query.status) params.set("status", query.status);
  if (query.fromDate) params.set("fromDate", query.fromDate);
  if (query.toDate) params.set("toDate", query.toDate);

  const res = await fetchWithTimeout(
    `${env.API_BASE_URL}/invoice-service/1.0.0/invoices?${params.toString()}`,
    { headers: authHeaders(auth) },
  );

  if (!res.ok) {
    throw new UpstreamError(res.status, "Could not load invoices.");
  }

  const json = await parseJsonSafe<{ data?: UpstreamInvoice[]; paging?: UpstreamPaging }>(res);
  const items = (json?.data ?? []).map(normalizeInvoice);
  const paging = json?.paging ?? {
    pageNumber: query.pageNum,
    pageSize: query.pageSize,
    totalRecords: items.length,
  };

  return {
    items,
    pageNum: paging.pageNumber,
    pageSize: paging.pageSize,
    totalRecords: paging.totalRecords,
    totalPages: Math.max(1, Math.ceil(paging.totalRecords / paging.pageSize)),
  };
}

/** Create a single-line-item invoice. Returns the created invoice number. */
export async function createInvoice(
  input: CreateInvoiceInput,
  auth: UpstreamAuth,
): Promise<{ invoiceNumber: string; invoiceId?: string }> {
  const res = await fetchWithTimeout(`${env.API_BASE_URL}/invoice-service/1.0.0/invoices`, {
    method: "POST",
    headers: { ...authHeaders(auth), "Content-Type": "application/json", "Operation-Mode": "SYNC" },
    body: JSON.stringify(toUpstreamInvoicePayload(input)),
  });

  if (!res.ok) {
    throw new UpstreamError(res.status, "The invoice could not be created.");
  }

  const json = await parseJsonSafe<{ data?: UpstreamInvoice }>(res);
  const created = json?.data;
  return {
    invoiceNumber: created?.invoiceNumber ?? input.invoiceNumber,
    invoiceId: created?.invoiceId,
  };
}

function authHeaders(auth: UpstreamAuth): Record<string, string> {
  return { Authorization: `Bearer ${auth.accessToken}`, "org-token": auth.orgToken };
}

/**
 * Map our flat form input to the nested 101 Digital create-invoice body.
 * Every optional block (bank account, billing address, documents, custom
 * fields) is included only when the user actually provided data, so a minimal
 * invoice stays minimal on the wire.
 */
export function toUpstreamInvoicePayload(input: CreateInvoiceInput) {
  const bankAccount = buildBankAccount(input);
  const address = buildAddress(input);
  const documents = buildDocuments(input.documents);
  const invoiceCustomFields = buildCustomFields(input.customFields);
  const itemCustomFields = buildCustomFields(input.itemCustomFields);
  const itemExtensions = buildExtensions(input.itemExtensions);

  return {
    invoices: [
      {
        ...(bankAccount ? { bankAccount } : {}),
        customer: {
          firstName: input.customerFirstName,
          lastName: input.customerLastName,
          contact: { email: input.customerEmail, mobileNumber: input.customerMobile },
          ...(address ? { addresses: [address] } : {}),
        },
        ...(documents.length ? { documents } : {}),
        invoiceReference: input.invoiceReference || undefined,
        invoiceNumber: input.invoiceNumber,
        currency: input.currency,
        invoiceDate: input.invoiceDate,
        dueDate: input.dueDate,
        description: input.description || undefined,
        ...(invoiceCustomFields.length ? { customFields: invoiceCustomFields } : {}),
        items: [
          {
            itemReference: input.invoiceNumber,
            itemName: input.itemName,
            description: input.itemDescription || input.itemName,
            quantity: input.quantity,
            rate: input.rate,
            itemUOM: input.itemUOM,
            ...(itemExtensions.length ? { extensions: itemExtensions } : {}),
            ...(itemCustomFields.length ? { customFields: itemCustomFields } : {}),
          },
        ],
      },
    ],
  };
}

/** Map adjustment rows to the upstream `extensions` shape, dropping unnamed rows. */
function buildExtensions(extensions: CreateInvoiceInput["itemExtensions"]) {
  return (extensions ?? [])
    .filter((e) => e.name.trim())
    .map((e) => ({
      addDeduct: e.addDeduct,
      type: e.type,
      value: e.value,
      name: e.name.trim(),
    }));
}

/** Build the payee bank account block, or undefined when nothing meaningful is set. */
function buildBankAccount(input: CreateInvoiceInput) {
  if (!input.bankId && !input.bankAccountNumber && !input.bankSortCode && !input.bankAccountName) {
    return undefined;
  }
  return {
    // The upstream API requires a non-empty bankId when a bankAccount is present.
    bankId: input.bankId || undefined,
    sortCode: input.bankSortCode || undefined,
    accountNumber: input.bankAccountNumber || undefined,
    accountName: input.bankAccountName || undefined,
  };
}

/** Build the billing address, or undefined when no address field is filled. */
function buildAddress(input: CreateInvoiceInput) {
  const parts = [
    input.addressPremise,
    input.addressCity,
    input.addressCounty,
    input.addressPostcode,
    input.addressCountryCode,
  ];
  if (parts.every((p) => !p)) return undefined;
  return {
    premise: input.addressPremise || undefined,
    city: input.addressCity || undefined,
    county: input.addressCounty || undefined,
    postcode: input.addressPostcode || undefined,
    countryCode: input.addressCountryCode ? input.addressCountryCode.toUpperCase() : undefined,
    addressType: "BILLING",
  };
}

/** Map document rows to the upstream shape, generating a documentId per row. */
function buildDocuments(documents: CreateInvoiceInput["documents"]) {
  return (documents ?? [])
    .filter((d) => d.documentName && d.documentUrl)
    .map((d) => ({
      documentId: crypto.randomUUID(),
      documentName: d.documentName,
      documentUrl: d.documentUrl,
    }));
}

/** Map key/value rows to the upstream shape, dropping empty keys. */
function buildCustomFields(fields: CreateInvoiceInput["customFields"]) {
  return (fields ?? [])
    .filter((f) => f.key.trim())
    .map((f) => ({ key: f.key.trim(), value: f.value ?? "" }));
}

/** Flatten an upstream invoice into the stable shape the UI renders. */
export function normalizeInvoice(raw: UpstreamInvoice): Invoice {
  const activeStatus = raw.status?.find((s) => s.value)?.key ?? "Draft";
  return {
    id: raw.invoiceId,
    invoiceNumber: raw.invoiceNumber,
    reference: raw.invoiceReference,
    customerName: resolveCustomerName(raw.customer),
    currency: raw.currency,
    currencySymbol: raw.currencySymbol || raw.currency,
    invoiceDate: raw.invoiceDate,
    dueDate: raw.dueDate,
    description: raw.description?.trim() || "",
    status: activeStatus,
    totalAmount: raw.totalAmount ?? 0,
    balanceAmount: raw.balanceAmount ?? 0,
  };
}

/**
 * Resolve a display name from either upstream customer shape: a combined
 * `name`, or `firstName`/`lastName` (the shape returned for invoices created
 * through this app). Falls back to an em-dash when nothing is present.
 */
function resolveCustomerName(customer: UpstreamInvoice["customer"]): string {
  if (!customer) return "—";
  const combined = customer.name?.trim();
  if (combined) return combined;
  const fromParts = [customer.firstName, customer.lastName]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return fromParts || "—";
}
