import { NextResponse } from "next/server";
import type { ApiError, ApiResponse } from "@/types/api";

/** Build a successful JSON envelope. */
export function apiOk<T>(data: T, init?: ResponseInit): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ ok: true, data }, init);
}

/** Build an error JSON envelope with the given HTTP status. */
export function apiError(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
): NextResponse<ApiResponse<never>> {
  const error: ApiError = { code, message, ...(fields ? { fields } : {}) };
  return NextResponse.json({ ok: false, error }, { status });
}

export const Errors = {
  unauthorized: () => apiError(401, "UNAUTHORIZED", "You are not signed in."),
  forbidden: () => apiError(403, "FORBIDDEN", "This request was blocked for security reasons."),
  validation: (fields: Record<string, string>) =>
    apiError(422, "VALIDATION_ERROR", "Please correct the highlighted fields.", fields),
  tooManyRequests: (retryAfter: number) => {
    const res = apiError(429, "RATE_LIMITED", "Too many attempts. Please try again shortly.");
    res.headers.set("Retry-After", String(retryAfter));
    return res;
  },
  upstream: (status: number, message: string) =>
    apiError(status >= 400 && status < 600 ? status : 502, "UPSTREAM_ERROR", message),
  internal: () => apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again."),
};
