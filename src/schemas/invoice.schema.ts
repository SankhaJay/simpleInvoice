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

/** A repeatable key/value pair (upstream `customFields[]`). */
export const customFieldSchema = z.object({
  key: z.string().trim().min(1, "Key is required").max(80),
  value: z.string().trim().max(255).optional().or(z.literal("")),
});

/** A repeatable attachment reference (upstream `documents[]`). */
export const documentSchema = z.object({
  documentName: z.string().trim().min(1, "Name is required").max(120),
  documentUrl: z.url("Enter a valid URL").max(2000),
});

/** Adjustment direction and type (upstream `extensions[].addDeduct` / `.type`). */
export const ADJUSTMENT_DIRECTIONS = ["ADD", "DEDUCT"] as const;
export const ADJUSTMENT_TYPES = ["FIXED_VALUE", "PERCENTAGE"] as const;

/**
 * A repeatable line-item adjustment (upstream `extensions[]`). Supports the full
 * matrix — any name, ADD or DEDUCT, FIXED_VALUE or PERCENTAGE, any value.
 */
export const extensionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  addDeduct: z.enum(ADJUSTMENT_DIRECTIONS),
  type: z.enum(ADJUSTMENT_TYPES),
  value: money,
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

    // Invoice header
    invoiceNumber: z
      .string()
      .trim()
      .min(3, "Invoice number is required")
      .max(64)
      .regex(/^[A-Za-z0-9#/_-]+$/, "Only letters, numbers and # / _ - are allowed"),
    invoiceReference: z.string().trim().max(64).optional().or(z.literal("")),
    currency: z.enum(CURRENCIES),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select an invoice date"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a due date"),
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
  .refine((v) => v.dueDate >= v.invoiceDate, {
    message: "Due date cannot be before the invoice date",
    path: ["dueDate"],
  })
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
