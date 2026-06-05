import { test, expect } from "@playwright/test";

/**
 * Flow 8 — Notifications: bell icon and notification feed
 * Critical: notifications drive action on invoices, certs, and AI events.
 */
test.describe("Notifications", () => {
  test("notification bell icon is visible in the layout", async ({ page }) => {
    await page.goto("/");
    const bell = page.locator(
      "[data-testid='notification-bell'], button[aria-label*='notificaciones'], button[aria-label*='notification']",
    );
    await expect(bell).toBeVisible({ timeout: 10_000 });
  });

  test("notifications page renders feed or empty state", async ({ page }) => {
    await page.goto("/#/notifications");
    const content = page
      .locator("[data-testid='notification-item'], [role='listitem']")
      .or(page.getByText(/no hay notificaciones|sin notificaciones|empty/i));
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("notifications page does not throw a 5xx error", async ({ page }) => {
    await page.goto("/#/notifications");
    await expect(page.locator("body")).not.toContainText(/error\s+500/i);
  });
});
