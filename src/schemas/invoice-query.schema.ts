import { z } from "zod";

/** Fields the invoice list can be sorted by (mapped to upstream `sortBy`). */
export const SORT_FIELDS = ["CREATED_DATE", "INVOICE_DATE", "DUE_DATE"] as const;
export const ORDERINGS = ["ASCENDING", "DESCENDING"] as const;

/** Status filter values derived from the upstream status flags. */
// The invoice-service only accepts these status values (confirmed via the API,
// which 400s on anything else). Draft/Void are NOT valid statuses here.
export const STATUS_FILTERS = ["Due", "Overdue", "Paid", "Cancelled", "Rejected"] as const;

/** Page-size options offered in the pagination control. */
export const PAGE_SIZES = [10, 20, 50] as const;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

/**
 * Query parameters for the invoice list. Uses coercion so it can validate raw
 * URLSearchParams (all strings) directly. Defaults mirror the assessment's
 * sample request (CREATED_DATE / DESCENDING / page 1 / size 10).
 */
export const invoiceQuerySchema = z.object({
  keyword: z.string().trim().max(128).optional(),
  status: z.enum(STATUS_FILTERS).optional(),
  sortBy: z.enum(SORT_FIELDS).default("CREATED_DATE"),
  ordering: z.enum(ORDERINGS).default("DESCENDING"),
  pageNum: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  fromDate: dateString.optional(),
  toDate: dateString.optional(),
});

export type InvoiceQuery = z.infer<typeof invoiceQuerySchema>;
