import { CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf-constants";
import type { ApiError, ApiResponse } from "@/types/api";

/**
 * Client-side helper for calling our own BFF (`/api/*`). It:
 *  - unwraps the `{ ok, data | error }` envelope, throwing a typed error on
 *    failure so callers/react-query see a rejected promise;
 *  - attaches the double-submit CSRF header (read from the readable cookie) to
 *    every mutating request.
 *
 * This module is browser-safe — it imports no server-only code.
 */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message);
    this.name = "ApiClientError";
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);

  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) headers.set(CSRF_HEADER, csrf);
  }

  const res = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!json) {
    throw new ApiClientError(res.status, {
      code: "NETWORK_ERROR",
      message: "Unexpected response from the server.",
    });
  }
  if (!json.ok) {
    throw new ApiClientError(res.status, json.error);
  }
  return json.data;
}
