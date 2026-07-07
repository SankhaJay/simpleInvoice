import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// Load .env.local (git-ignored) so E2E_USERNAME/E2E_PASSWORD, if set there, are
// available to the specs and inherited by the mock server. Not required —
// non-secret defaults are used when unset.
loadEnvConfig(process.cwd());

const APP_PORT = 3100;
const MOCK_PORT = 4100;

/**
 * E2E config. Two servers are started:
 *  1. the mock 101 Digital upstream (deterministic, no real secrets), and
 *  2. the real Next.js app, pointed at the mock via AUTH_BASE_URL/API_BASE_URL.
 *
 * The app itself is exercised for real (login, sealed session, CSRF, BFF).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node e2e/mock-server.mjs`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- -p ${APP_PORT}`,
      port: APP_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        AUTH_BASE_URL: `http://localhost:${MOCK_PORT}`,
        API_BASE_URL: `http://localhost:${MOCK_PORT}`,
        OAUTH_CLIENT_ID: "e2e-client",
        OAUTH_CLIENT_SECRET: "e2e-secret",
        OAUTH_SCOPE: "openid",
        SESSION_SECRET: "e2e-session-secret-at-least-32-characters-long",
        SESSION_COOKIE_NAME: "si_session",
        // Relaxed so each test can log in without tripping the limiter.
        LOGIN_RATE_LIMIT: "1000",
      },
    },
  ],
});
