import { test, expect } from "@playwright/test";
import { login, TEST_USER } from "./helpers";

test.describe("authentication", () => {
  test("signs in and lands on the invoice list", async ({ page }) => {
    await login(page);
    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible();
  });

  test("rejects invalid credentials and stays on the login page", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(TEST_USER);
    await page.getByLabel("Password").fill("WrongPassword123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("protects the app: an unauthenticated visit redirects to login", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page).toHaveURL(/\/login/);
  });

  test("signs out back to the login page", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
