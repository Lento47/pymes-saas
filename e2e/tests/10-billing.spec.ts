import { test, expect } from "@playwright/test";

/**
 * Flow 10 — Billing: plan page renders and plan change requires confirmation
 * Critical: billing changes affect revenue and must never be one-click silent.
 */
test.describe("Billing", () => {
  test("billing page loads without errors", async ({ page }) => {
    await page.goto("/#/billing");
    await expect(page.locator("h1, [data-testid='billing-header']")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator("body")).not.toContainText(/error\s+500|internal server error/i);
  });

  test("current plan is displayed", async ({ page }) => {
    await page.goto("/#/billing");
    // Should show SOME plan name
    const planIndicator = page.locator(
      "[data-testid='current-plan'], .plan-name, [class*='plan']",
    ).or(page.getByText(/free|emprende|starter|growth|business/i));
    await expect(planIndicator).toBeVisible({ timeout: 8_000 });
  });

  test("plan change requires a confirmation step (not one-click)", async ({ page }) => {
    await page.goto("/#/billing");

    const upgradeButton = page.getByRole("button", { name: /upgrade|actualizar|cambiar plan/i }).first();
    const upgradeCount = await upgradeButton.count();
    if (upgradeCount === 0) {
      test.skip(); // Current plan may already be highest tier
      return;
    }

    await upgradeButton.click();

    // A confirmation dialog or plan selection sheet must appear BEFORE any charge
    const confirmStep = page.locator(
      "dialog, [role='dialog'], [data-testid='plan-confirm'], .sheet-content",
    );
    await expect(confirmStep).toBeVisible({ timeout: 8_000 });

    // Should not have already executed the change (no success toast visible yet)
    await expect(page.getByText(/plan actualizado|success|facturado/i)).not.toBeVisible();
  });
});
