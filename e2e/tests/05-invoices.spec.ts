import { test, expect } from "@playwright/test";

/**
 * Flow 5 — Invoices: view list and initiate creation
 * Critical: billing is a revenue-generating flow.
 */
test.describe("Invoices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/invoices");
    await expect(page.locator("h1, [data-testid='invoices-header']")).toBeVisible({ timeout: 10_000 });
  });

  test("invoices page renders without 5xx errors", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText(/error\s+500|internal server error/i);
  });

  test("new invoice button is accessible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /nueva factura|crear factura|new invoice/i }),
    ).toBeVisible();
  });

  test("invoice list or empty state renders", async ({ page }) => {
    const listOrEmpty = page
      .locator("table, [role='table'], [data-testid='invoice-row']")
      .or(page.getByText(/no hay facturas|sin facturas|empty/i));
    await expect(listOrEmpty).toBeVisible({ timeout: 8_000 });
  });

  test("create invoice dialog opens and has required fields", async ({ page }) => {
    await page.getByRole("button", { name: /nueva factura|crear factura|new invoice/i }).click();

    const dialog = page.locator(
      "dialog, [role='dialog'], [data-testid='invoice-form'], .sheet-content",
    );
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // Contact/client selector should be present
    await expect(
      dialog.locator(
        "input[placeholder*='cliente'], input[placeholder*='contact'], [data-testid='contact-select']",
      ),
    ).toBeVisible();

    // Close without submitting (cancel or press Escape)
    await page.keyboard.press("Escape");
  });
});
