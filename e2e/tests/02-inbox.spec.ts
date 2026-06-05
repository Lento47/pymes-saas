import { test, expect } from "@playwright/test";

/**
 * Flow 2 — Inbox: conversation list and message reply
 * Critical: inbox is the core daily workflow.
 */
test.describe("Inbox", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/inbox");
    await expect(page.locator("h1, [data-testid='inbox-header']")).toBeVisible({ timeout: 10_000 });
  });

  test("inbox loads and shows conversation list or empty state", async ({ page }) => {
    // Either a list of conversations or an empty state is acceptable
    const conversationList = page.locator(
      "[data-testid='conversation-list'], [role='list'], .conversation-item",
    );
    const emptyState = page.getByText(/no hay conversaciones|bandeja vacía|empty/i);

    await expect(conversationList.or(emptyState)).toBeVisible({ timeout: 8_000 });
  });

  test("inbox search / filter bar is present", async ({ page }) => {
    await expect(
      page.locator("input[placeholder*='buscar'], input[type='search'], [data-testid='inbox-search']"),
    ).toBeVisible();
  });

  test("clicking a conversation opens the message thread", async ({ page }) => {
    const firstConv = page.locator(
      "[data-testid='conversation-item'], [role='listitem']",
    ).first();

    // Skip if inbox is empty
    const count = await firstConv.count();
    if (count === 0) {
      test.skip();
      return;
    }

    await firstConv.click();
    // Message thread should appear
    await expect(
      page.locator("[data-testid='message-thread'], .message-bubble, [data-testid='chat-panel']"),
    ).toBeVisible({ timeout: 8_000 });
  });
});
