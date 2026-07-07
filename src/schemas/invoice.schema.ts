import { z } from "zod";

/** Currencies the create form offers (ISO 4217). */
export const CURRENCIES = ["GBP", "USD", "EUR", "LKR", "AUD", "SGD", "INR"] as const;

/** Units of measure offered for the single line item. */
export const UOMS = ["UNIT", "HOUR", "DAY", "KG", "ITEM"] as const;

const money = z
  .number({ message: "Enter a valid number" })
  .nonnegative("Must be zero or greater")
  .max(1_000_000_000, "Value is too large");

/** Optional free-text: accepts an empty string or a trimmed value up to `max`. */
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));

/** Accepted invoice-date year range (guards against typos like 0202 / 9999). */
export const MIN_YEAR = 2000;
export const MAX_YEAR = 2100;

/** True only for a real `YYYY-MM-DD` calendar date (rejects 2026-13-45, 2026-02-30). */
function isRealCalendarDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** Whether a URL string uses the http or https scheme. */
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * A required date field: must be present in `YYYY-MM-DD` format, a real calendar
 * date, and within the accepted year bounds. Emits one message at a time.
 */
function dateField(missingMessage: string) {
  return z.string().superRefine((value, ctx) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      ctx.addIssue({ code: "custom", message: missingMessage });
      return;
    }
    if (!isRealCalendarDate(value)) {
      ctx.addIssue({ code: "custom", message: "Enter a real calendar date" });
      return;
    }
    const year = Number(value.slice(0, 4));
    if (year < MIN_YEAR || year > MAX_YEAR) {
      ctx.addIssue({ code: "custom", message: `Year must be between ${MIN_YEAR} and ${MAX_YEAR}` });
    }
  });
}

/**
 * A repeatable key/value pair (upstream `customFields[]`).
 * A fully-empty row is allowed (it is dropped before submit); a row with a value
 * but no key is flagged so nothing is silently lost.
 */
export const customFieldSchema = z
  .object({
    key: z.string().trim().max(80),
    value: z.string().trim().max(255),
  })
  .superRefine((row, ctx) => {
    if (!row.key && !row.value) return; // empty row → dropped later
    if (!row.key) ctx.addIssue({ code: "custom", path: ["key"], message: "Key is required" });
  });

/**
 * A repeatable attachment (upstream `documents[]`). Empty rows are allowed and
 * dropped; a partially-filled row must have both a name and a valid http(s) URL.
 */
export const documentSchema = z
  .object({
    documentName: z.string().trim().max(120),
    documentUrl: z.string().trim().max(2000),
  })
  .superRefine((row, ctx) => {
    if (!row.documentName && !row.documentUrl) return; // empty row → dropped later
    if (!row.documentName) {
      ctx.addIssue({ code: "custom", path: ["documentName"], message: "Name is required" });
    }
    if (!row.documentUrl) {
      ctx.addIssue({ code: "custom", path: ["documentUrl"], message: "Enter a URL" });
    } else if (!isHttpUrl(row.documentUrl)) {
      ctx.addIssue({ code: "custom", path: ["documentUrl"], message: "Must be an http(s) URL" });
    }
  });

/** Adjustment name, direction and type (upstream `extensions[]`). */
export const ADJUSTMENT_NAMES = ["tax", "discount"] as const;
export const ADJUSTMENT_DIRECTIONS = ["ADD", "DEDUCT"] as const;
export const ADJUSTMENT_TYPES = ["FIXED_VALUE", "PERCENTAGE"] as const;

/**
 * A repeatable line-item adjustment (upstream `extensions[]`). The `name` is
 * limited to the two kinds the API documents (tax / discount) so we never push
 * an unrecognised adjustment; direction (ADD/DEDUCT) and type (FIXED/PERCENTAGE)
 * stay free per the API samples. A row with no positive amount is treated as
 * absent and dropped on submit; a PERCENTAGE value is capped at 100.
 */
export const extensionSchema = z
  .object({
    name: z.enum(ADJUSTMENT_NAMES),
    addDeduct: z.enum(ADJUSTMENT_DIRECTIONS),
    type: z.enum(ADJUSTMENT_TYPES),
    value: money.optional(),
  })
  .superRefine((row, ctx) => {
    // No amount → the row is treated as empty and dropped before submit.
    if (row.value === undefined || row.value === 0) return;
    if (row.type === "PERCENTAGE" && row.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "Percentage cannot exceed 100" });
    }
  });

export type ExtensionInput = z.infer<typeof extensionSchema>;

/**
 * Invoice creation form. One line item, per the assessment. This flat,
 * user-friendly shape is validated identically on the client (react-hook-form)
 * and the server (BFF route); `toUpstreamInvoicePayload` maps it to the nested
 * 101 Digital request body.
 */
export const createInvoiceSchema = z
  .object({
    // Customer
    customerFirstName: z.string().trim().min(1, "First name is required").max(80),
    customerLastName: z.string().trim().min(1, "Last name is required").max(80),
    customerEmail: z.email("Enter a valid email address").max(160),
    customerMobile: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{7,15}$/, "Enter a valid phone number (7–15 digits, optional +)"),

    // Invoice header. The invoice number is intentionally not collected — the
    // backend generates and stores it.
    invoiceReference: z.string().trim().max(64).optional().or(z.literal("")),
    currency: z.enum(CURRENCIES),
    invoiceDate: dateField("Select an invoice date"),
    dueDate: dateField("Select a due date"),
    description: z.string().trim().max(500).optional().or(z.literal("")),

    // Single line item
    itemName: z.string().trim().min(1, "Item name is required").max(120),
    itemDescription: z.string().trim().max(300).optional().or(z.literal("")),
    quantity: z
      .number({ message: "Enter a quantity" })
      .positive("Quantity must be greater than zero")
      .max(1_000_000),
    rate: money,
    // Required enum (the form supplies "UNIT" as its default value) — kept
    // non-`.default()` so the schema's input and output types stay identical,
    // which keeps react-hook-form's resolver generics happy.
    itemUOM: z.enum(UOMS),

    // Optional line-item adjustments (mapped to item-level upstream `extensions`)
    itemExtensions: z.array(extensionSchema).optional(),

    // --- Optional billing address (customer.addresses[0]) ---
    addressPremise: optionalText(120),
    addressCity: optionalText(80),
    addressCounty: optionalText(80),
    addressPostcode: optionalText(16),
    addressCountryCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2}$/, "Use a 2-letter ISO country code, e.g. GB")
      .optional()
      .or(z.literal("")),

    // --- Optional payee bank account (bankAccount). All-or-nothing: if any
    // field is provided the whole block is required, because the upstream API
    // mandates a non-empty `bankId` whenever a bankAccount is present. ---
    bankId: optionalText(64),
    bankAccountName: optionalText(120),
    bankSortCode: z
      .string()
      .trim()
      .regex(/^\d{2}-\d{2}-\d{2}$/, "Format as 00-00-00")
      .optional()
      .or(z.literal("")),
    bankAccountNumber: z
      .string()
      .trim()
      .regex(/^\d{6,10}$/, "6–10 digits")
      .optional()
      .or(z.literal("")),

    // --- Optional attachments and custom fields (arrays; no `.default()` so
    // the schema's input and output types stay identical for the RHF resolver) ---
    documents: z.array(documentSchema).optional(),
    customFields: z.array(customFieldSchema).optional(),
    itemCustomFields: z.array(customFieldSchema).optional(),
  })
  .refine(
    (v) =>
      // Only compare once both are real dates, so we don't stack a spurious
      // ordering error on top of a format/calendar error. The due date may be
      // on or after the invoice date (equal is allowed).
      !isRealCalendarDate(v.invoiceDate) ||
      !isRealCalendarDate(v.dueDate) ||
      v.dueDate >= v.invoiceDate,
    { message: "Due date cannot be before the invoice date", path: ["dueDate"] },
  )
  .superRefine((v, ctx) => {
    // Bank account is all-or-nothing (see field comment above).
    const bank = {
      bankId: v.bankId,
      bankAccountName: v.bankAccountName,
      bankSortCode: v.bankSortCode,
      bankAccountNumber: v.bankAccountNumber,
    };
    if (Object.values(bank).some((x) => x && x.length > 0)) {
      for (const [field, value] of Object.entries(bank)) {
        if (!value) {
          ctx.addIssue({
            code: "custom",
            path: [field],
            message: "Required when adding a bank account",
          });
        }
      }
    }
  });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/** A single adjustment for total computation (a subset of `ExtensionInput`). */
export interface AdjustmentLike {
  addDeduct: (typeof ADJUSTMENT_DIRECTIONS)[number];
  type: (typeof ADJUSTMENT_TYPES)[number];
  value: number;
}

/**
 * Compute the invoice total from the line item and its adjustments. Each
 * adjustment is a full combination of direction (ADD/DEDUCT) and type
 * (FIXED_VALUE/PERCENTAGE), so this supports the entire upstream `extensions`
 * matrix. Percentages apply to the line subtotal. Pure and dependency-free.
 */
export function computeInvoiceTotals(input: {
  quantity: number;
  rate: number;
  extensions?: AdjustmentLike[];
}) {
  const subtotal = round2(input.quantity * input.rate);
  let additions = 0;
  let deductions = 0;

  for (const ext of input.extensions ?? []) {
    const value = Number(ext.value) || 0;
    const amount = ext.type === "PERCENTAGE" ? subtotal * (value / 100) : value;
    if (ext.addDeduct === "ADD") additions += amount;
    else deductions += amount;
  }

  additions = round2(additions);
  deductions = round2(deductions);
  const total = round2(subtotal + additions - deductions);
  return { subtotal, additions, deductions, total };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
