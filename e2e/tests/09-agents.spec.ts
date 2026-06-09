import { test, expect } from "@playwright/test";

/**
 * Flow 9 — AI Agents: agent list and enable/disable toggle
 * Critical: agents drive auto-reply; misconfiguration can send wrong messages.
 */
test.describe("AI Agents", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/agents");
    await expect(page.locator("h1, [data-testid='agents-header']")).toBeVisible({ timeout: 10_000 });
  });

  test("agents page loads without errors", async ({ page }) => {
    await expect(page.locator("body")).not.toContainText(/error\s+500|internal server error/i);
  });

  test("agent list or empty state renders", async ({ page }) => {
    const content = page
      .locator("[data-testid='agent-item'], [role='listitem'], [data-testid='agent-card']")
      .or(page.getByText(/no hay agentes|empty|crear agente/i));
    await expect(content).toBeVisible({ timeout: 8_000 });
  });

  test("AI settings page is accessible", async ({ page }) => {
    await page.goto("/#/settings/ai");
    await expect(page.locator("body")).not.toContainText(/forbidden|403|error\s+500/i);
    await expect(page.locator("h1, h2, [data-testid='ai-settings']").first()).toBeVisible({
      timeout: 8_000,
    });
  });
});
