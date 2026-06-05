import { test, expect } from "@playwright/test";

/**
 * Flow 6 — Settings: workspace profile update
 * Critical: settings control workspace identity and integrations.
 */
test.describe("Settings", () => {
  test("workspace settings page loads", async ({ page }) => {
    await page.goto("/#/settings/workspace");
    await expect(
      page.locator("h1, h2, [data-testid='settings-header']").first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("workspace name field is editable", async ({ page }) => {
    await page.goto("/#/settings/workspace");
    const nameInput = page.locator(
      "input[name='name'], input[placeholder*='nombre'], input[id*='name']",
    ).first();
    await expect(nameInput).toBeVisible({ timeout: 8_000 });
    await expect(nameInput).toBeEditable();
  });

  test("members settings page renders member list", async ({ page }) => {
    await page.goto("/#/settings/members");
    await expect(page.locator("body")).not.toContainText(/error\s+500/i);
    const memberListOrEmpty = page
      .locator("[data-testid='member-row'], table, [role='table']")
      .or(page.getByText(/no hay miembros|invite/i));
    await expect(memberListOrEmpty).toBeVisible({ timeout: 8_000 });
  });

  test("audit log page is accessible to admin", async ({ page }) => {
    await page.goto("/#/settings/audit");
    await expect(page.locator("body")).not.toContainText(/forbidden|403/i);
    await expect(
      page.locator("h1, h2, table, [data-testid='audit-log']").first(),
    ).toBeVisible({ timeout: 8_000 });
  });
});
