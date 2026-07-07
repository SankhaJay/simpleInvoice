import type { z } from "zod";

/**
 * Flatten a ZodError into a `{ fieldPath: message }` map suitable for the
 * `fields` block of our API error envelope and for react-hook-form's setError.
 */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
