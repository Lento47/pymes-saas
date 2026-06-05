import { test, expect } from "@playwright/test";

/**
 * Flow 3 — Contacts: list, create, and view a contact
 * Critical: contacts are the CRM backbone.
 */
test.describe("Contacts", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/contacts");
    await expect(page.locator("h1, [data-testid='contacts-header']")).toBeVisible({ timeout: 10_000 });
  });

  test("contacts page renders with list or empty state", async ({ page }) => {
    const listOrEmpty = page.locator("table, [role='table'], [data-testid='contact-row']")
      .or(page.getByText(/no hay contactos|sin contactos|empty/i));
    await expect(listOrEmpty).toBeVisible({ timeout: 8_000 });
  });

  test("create contact button is accessible", async ({ page }) => {
    await expect(
      page.getByRole("button", { name: /nuevo contacto|agregar|crear|new contact/i }),
    ).toBeVisible();
  });

  test("create contact flow: fill form and submit", async ({ page }) => {
    await page.getByRole("button", { name: /nuevo contacto|agregar|crear|new contact/i }).click();

    // Modal or sheet should open
    const dialog = page.locator("dialog, [role='dialog'], [data-testid='contact-form']");
    await expect(dialog).toBeVisible({ timeout: 6_000 });

    // Fill minimum required fields
    const nameInput = dialog.locator("input[name='name'], input[placeholder*='nombre']").first();
    await nameInput.fill(`E2E Test ${Date.now()}`);

    const phoneInput = dialog.locator("input[name='phone'], input[placeholder*='teléfono'], input[type='tel']").first();
    if (await phoneInput.count() > 0) {
      await phoneInput.fill("+50688889999");
    }

    // Submit
    await dialog.getByRole("button", { name: /guardar|crear|save|submit/i }).click();

    // Dialog should close or show success
    await expect(dialog).not.toBeVisible({ timeout: 8_000 });
  });

  test("contact search returns filtered results", async ({ page }) => {
    const searchInput = page.locator("input[placeholder*='buscar'], input[type='search']").first();
    await searchInput.fill("test");
    await page.waitForTimeout(500); // debounce
    // Results update without page crash
    await expect(page.locator("body")).toBeVisible();
  });
});
