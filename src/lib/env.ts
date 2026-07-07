import "server-only";
import { z } from "zod";

/**
 * Server-only environment configuration.
 *
 * `import "server-only"` guarantees this module can never be pulled into a
 * client bundle — if a client component imports it (directly or transitively)
 * the build fails. That is our compile-time guard that secrets stay on the
 * server. None of these variables use the `NEXT_PUBLIC_` prefix, so they are
 * never inlined into browser JavaScript.
 */
const envSchema = z.object({
  AUTH_BASE_URL: z.url(),
  API_BASE_URL: z.url(),
  OAUTH_CLIENT_ID: z.string().min(1, "OAUTH_CLIENT_ID is required"),
  OAUTH_CLIENT_SECRET: z.string().min(1, "OAUTH_CLIENT_SECRET is required"),
  OAUTH_SCOPE: z.string().min(1).default("openid"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters for AES sealing"),
  SESSION_COOKIE_NAME: z.string().min(1).default("si_session"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Surface a precise, actionable message at boot rather than a vague runtime
  // failure deep inside a request. Field names only — never the values.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
