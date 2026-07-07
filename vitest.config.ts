import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Inject the env the server modules validate at import time. These are
    // throwaway test values — the real secrets live only in `.env.local`.
    env: {
      AUTH_BASE_URL: "https://auth.test",
      API_BASE_URL: "https://api.test",
      OAUTH_CLIENT_ID: "test-client-id",
      OAUTH_CLIENT_SECRET: "test-client-secret",
      OAUTH_SCOPE: "openid",
      SESSION_SECRET: "test-session-secret-at-least-32-chars-long",
      SESSION_COOKIE_NAME: "si_session",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/schemas/**", "src/components/**", "src/app/api/**"],
      exclude: ["src/components/ui/**", "**/*.d.ts"],
    },
  },
  resolve: {
    alias: [
      // Neutralise the RSC-only marker packages under test.
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)) },
      { find: /^client-only$/, replacement: fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)) },
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
    ],
  },
});
