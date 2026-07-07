import { test, expect } from "@playwright/test";
import { login } from "./helpers";

// Sign in before each invoice test (the E2E login limiter is relaxed).
test.beforeEach(async ({ page }) => {
  await login(page);
});

test.describe("invoices", () => {
  test("lists invoices from the backend", async ({ page }) => {
    await expect(page.getByRole("link", { name: "IV1001", exact: true })).toBeVisible();
    // Names render in both the desktop table and the (hidden) mobile cards.
    await expect(page.getByText("Ada Lovelace").first()).toBeVisible();
  });

  test("searches the list", async ({ page }) => {
    await page.getByLabel("Search").fill("IV1002");
    await expect(page.getByRole("link", { name: "IV1002", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "IV1001", exact: true })).toHaveCount(0);
  });

  test("opens an invoice detail", async ({ page }) => {
    await page.getByRole("link", { name: "IV1001", exact: true }).click();
    await expect(page).toHaveURL(/\/invoices\/seed-1$/);
    await expect(page.getByRole("heading", { name: "IV1001" })).toBeVisible();
    await expect(page.getByText("Line items")).toBeVisible();
    await expect(page.getByText("Consulting").first()).toBeVisible();
  });

  test("creates an invoice end-to-end", async ({ page }) => {
    await page.getByRole("link", { name: /new invoice/i }).first().click();
    await expect(page).toHaveURL(/\/invoices\/new$/);

    await page.getByLabel("First name").fill("Zed");
    await page.getByLabel("Last name").fill("Uniqueman");
    await page.getByLabel("Email").fill("zed@example.com");
    await page.getByLabel("Mobile number").fill("+6591234567");
    await page.getByLabel("Item name").fill("Compiler work");
    await page.getByLabel("Quantity").fill("3");
    await page.getByLabel("Rate").fill("200");
    // Currency (GBP), unit (UNIT) and dates are pre-filled defaults.

    await page.getByRole("button", { name: /create invoice/i }).click();

    // Success toast, then a redirect back to the list where the new invoice shows.
    await expect(page.getByText(/invoice created/i)).toBeVisible();
    await expect(page).toHaveURL(/\/invoices$/);
    await expect(page.getByText("Zed Uniqueman").first()).toBeVisible();
  });

  test("validates the create form", async ({ page }) => {
    await page.getByRole("link", { name: /new invoice/i }).first().click();
    await page.getByRole("button", { name: /create invoice/i }).click();

    await expect(page.getByText("First name is required")).toBeVisible();
    await expect(page).toHaveURL(/\/invoices\/new$/);
  });
});
