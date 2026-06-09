import { test, expect } from "@playwright/test";

/**
 * Flow 1 — Authentication & session persistence
 * Critical: no auth = no access to any feature.
 */
test.describe("Authentication", () => {
  test("dashboard loads after login (session from setup)", async ({ page }) => {
    await page.goto("/");
    // Hash-routed app — authenticated root should redirect into the workspace
    await expect(page).not.toHaveURL(/\/login/);
    // Sidebar or main layout should be visible
    await expect(page.locator("nav, [data-sidebar], aside")).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated request redirects to /login", async ({ browser }) => {
    // Fresh context with no auth state
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/#/inbox");
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
    await ctx.close();
  });

  test("login page is reachable and renders the form", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /iniciar sesión|login|entrar/i })).toBeVisible();
    await ctx.close();
  });
});
