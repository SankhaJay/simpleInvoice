/**
 * The uniform envelope every BFF (`/api/*`) route returns. A discriminated
 * union on `ok` lets the client narrow success vs. failure without guessing.
 */
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError };

export interface ApiError {
  /** Stable machine-readable code, e.g. "VALIDATION_ERROR", "UNAUTHORIZED". */
  code: string;
  /** Human-readable, safe-to-display message (never leaks upstream secrets). */
  message: string;
  /** Optional field-level validation messages keyed by form field path. */
  fields?: Record<string, string>;
}
