import { z } from "zod";

/**
 * Login credentials. The same schema validates the form in the browser
 * (react-hook-form) AND the request body on the server (BFF route) — a single
 * source of truth so client and server never disagree.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(128, "Username is too long"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .max(256, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
