import { expect, type Page } from "@playwright/test";

// Credentials the mock upstream accepts. Fictional and non-secret (the E2E
// suite never talks to the real API); override via E2E_USERNAME/E2E_PASSWORD
// in .env.local if desired.
export const TEST_USER = process.env.E2E_USERNAME ?? "e2e-user";
export const TEST_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-password";

/** Sign in with the mock's valid test credentials and land on the invoice list. */
export async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(TEST_USER);
  await page.getByLabel("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/invoices$/);
}
