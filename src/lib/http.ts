import "server-only";

/** Error thrown when an upstream call fails. Carries a safe status + message. */
export class UpstreamError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

interface FetchOptions extends RequestInit {
  /** Abort the request after this many milliseconds (default 15s). */
  timeoutMs?: number;
}

/**
 * `fetch` with a hard timeout. Prevents a slow/hung upstream from tying up a
 * server worker indefinitely.
 */
export async function fetchWithTimeout(
  url: string,
  { timeoutMs = 15_000, ...init }: FetchOptions = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new UpstreamError(504, "The upstream service timed out.");
    }
    throw new UpstreamError(502, "Could not reach the upstream service.");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a JSON response, tolerating empty bodies. Returns `null` when there is
 * no body to parse.
 */
export async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
