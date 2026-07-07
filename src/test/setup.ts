import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, afterAll, beforeAll } from "vitest";
import { server } from "@/test/msw/server";

// Start the Mock Service Worker before the suite, reset handlers between tests,
// and tear it down at the end. This lets us exercise BFF handlers and hooks
// against realistic upstream responses without hitting the network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
