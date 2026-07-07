import { z } from "zod";

/** Currencies the create form offers (ISO 4217). */
export const CURRENCIES = ["GBP", "USD", "EUR", "LKR", "AUD", "SGD", "INR"] as const;

/** Units of measure offered for the single line item. */
export const UOMS = ["UNIT", "HOUR", "DAY", "KG", "ITEM"] as const;

const money = z
  .number({ message: "Enter a valid number" })
  .nonnegative("Must be zero or greater")
  .max(1_000_000_000, "Value is too large");

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

    // Optional adjustments (mapped to upstream `extensions`)
    taxPercentage: z
      .number()
      .min(0, "Tax cannot be negative")
      .max(100, "Tax cannot exceed 100%")
      .optional(),
    discountValue: money.optional(),
  })
  .refine((v) => v.dueDate >= v.invoiceDate, {
    message: "Due date cannot be before the invoice date",
    path: ["dueDate"],
  });

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;

/**
 * Compute the invoice total from the line item, applying tax (add) then a fixed
 * discount (deduct). Used both for the live preview in the form and could be
 * reused server-side. Kept pure and dependency-free for easy unit testing.
 */
export function computeInvoiceTotals(input: {
  quantity: number;
  rate: number;
  taxPercentage?: number;
  discountValue?: number;
}) {
  const subtotal = round2(input.quantity * input.rate);
  const tax = round2(subtotal * ((input.taxPercentage ?? 0) / 100));
  const discount = round2(input.discountValue ?? 0);
  const total = round2(subtotal + tax - discount);
  return { subtotal, tax, discount, total };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
