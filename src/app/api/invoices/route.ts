import type { NextRequest } from "next/server";
import { getSession, isSessionValid } from "@/lib/session";
import { createInvoice, fetchInvoices } from "@/lib/upstream";
import { UpstreamError } from "@/lib/http";
import { invoiceQuerySchema } from "@/schemas/invoice-query.schema";
import { createInvoiceSchema } from "@/schemas/invoice.schema";
import { assertSameOrigin, assertCsrfToken } from "@/lib/csrf";
import { apiOk, Errors } from "@/lib/api-response";
import { fieldErrors } from "@/lib/zod-errors";

/**
 * GET /api/invoices — proxy the invoice list.
 *
 * The BFF reads the sealed session, attaches the Bearer + org-token upstream,
 * and returns a normalised page. The browser never sees either token.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!isSessionValid(session)) return Errors.unauthorized();

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = invoiceQuerySchema.safeParse(params);
  if (!parsed.success) return Errors.validation(fieldErrors(parsed.error));

  try {
    const page = await fetchInvoices(parsed.data, {
      accessToken: session.accessToken,
      orgToken: session.orgToken,
    });
    return apiOk(page);
  } catch (err) {
    if (err instanceof UpstreamError) return Errors.upstream(err.status, err.message);
    return Errors.internal();
  }
}

/**
 * POST /api/invoices — create a single-line-item invoice.
 * Requires a valid session AND passes the same-origin + double-submit CSRF checks.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!isSessionValid(session)) return Errors.unauthorized();

  if (!assertSameOrigin(request) || !assertCsrfToken(request, session.csrfToken)) {
    return Errors.forbidden();
  }

  const raw = await request.json().catch(() => null);
  const parsed = createInvoiceSchema.safeParse(raw);
  if (!parsed.success) return Errors.validation(fieldErrors(parsed.error));

  try {
    const result = await createInvoice(parsed.data, {
      accessToken: session.accessToken,
      orgToken: session.orgToken,
    });
    return apiOk(result, { status: 201 });
  } catch (err) {
    if (err instanceof UpstreamError) return Errors.upstream(err.status, err.message);
    return Errors.internal();
  }
}
