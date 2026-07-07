import { setupServer } from "msw/node";

// Empty by default — each test installs the handlers it needs via
// `server.use(...)`. `onUnhandledRequest: "error"` in setup.ts ensures any
// un-mocked network call fails loudly instead of hitting the real API.
export const server = setupServer();
