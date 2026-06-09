import { test, expect } from "@playwright/test";

/**
 * Flow 7 — Automations: view automation rules
 * Critical: automations must be visible and manageable.
 */
test.describe("Automations", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/automations");
    await expect(page.locator("h1, [data-testid='automations-header']")).toBeVisible({ timeout: 10_000 });
  });

  test("automations page loads without errors", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText(/error\s+500|internal server error/i);
  });

  test("create automation button is present", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /nueva automatización|crear|nueva regla/i }),
    ).toBeVisible();
  });

  test("automation list or empty state renders", async ({ page }) => {
    const content = page
      .locator("[data-testid='automation-item'], [role='listitem'], table")
      .or(page.getByText(/no hay automatizaciones|empty|sin automatizaciones/i));
    await expect(content).toBeVisible({ timeout: 8_000 });
  });
});
