import { getSession, isSessionValid } from "@/lib/session";
import { fetchInvoice } from "@/lib/upstream";
import { withUpstreamAuth } from "@/lib/upstream-auth";
import { UpstreamError } from "@/lib/http";
import { apiOk, Errors } from "@/lib/api-response";

/**
 * GET /api/invoices/[id] — proxy a single invoice by id.
 *
 * Reads the sealed session, attaches the upstream tokens (with the same
 * silent‑refresh recovery as the list), and returns the normalised detail.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!isSessionValid(session)) return Errors.unauthorized();

  try {
    const invoice = await withUpstreamAuth(session, (auth) => fetchInvoice(id, auth));
    return apiOk(invoice);
  } catch (err) {
    if (err instanceof UpstreamError) return Errors.upstream(err.status, err.message);
    return Errors.internal();
  }
}
