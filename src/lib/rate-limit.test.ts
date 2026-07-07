import { describe, it, expect, vi } from "vitest";
import { rateLimit, clientIp } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(true);
    const blocked = rateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, { limit: 1, windowMs: 60_000 });
    expect(rateLimit(a, { limit: 1, windowMs: 60_000 }).allowed).toBe(false);
    expect(rateLimit(b, { limit: 1, windowMs: 60_000 }).allowed).toBe(true);
  });

  it("resets after the window elapses", () => {
    vi.useFakeTimers();
    try {
      const key = `win-${Math.random()}`;
      const opts = { limit: 1, windowMs: 1000 };
      expect(rateLimit(key, opts).allowed).toBe(true);
      expect(rateLimit(key, opts).allowed).toBe(false); // window not yet elapsed
      vi.advanceTimersByTime(1001);
      expect(rateLimit(key, opts).allowed).toBe(true); // window reset
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("clientIp", () => {
  it("reads the first hop of x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then 'unknown'", () => {
    expect(clientIp(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(new Headers({}))).toBe("unknown");
  });
});
