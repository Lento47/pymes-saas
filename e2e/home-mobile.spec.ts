import { test, expect, type Page } from "@playwright/test";

// Test-only API responses, isolated from production.
async function homeFixture(page: Page, role = "OWNER") {
  const user = { id: "11111111-1111-4111-8111-111111111111", name: "Ana Prueba", email: "home@example.invalid", role, workspace: { id: "22222222-2222-4222-8222-222222222222", name: "Negocio de prueba", slug: "mobile-test", plan: "STARTER" } };
  const state = { failTasks: false, failStats: false, failSummary: false, failGenerate: false, generated: false, features: {} as Record<string, boolean> };
  const requests: string[] = [];
  await page.addInitScript(() => {
    localStorage.setItem("pymes_token", "isolated-test-token");
    localStorage.setItem("pymes_slug", "mobile-test");
    localStorage.setItem("pymes_last_activity", String(Date.now()));
  });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    requests.push(path);
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/auth/my-workspaces") return route.fulfill({ json: [user.workspace] });
    if (path === "/api/workspaces/current/features") return route.fulfill({ json: { plan: "STARTER", features: state.features } });
    if (path === "/api/workspaces/current/setup") return route.fulfill({ json: { should_show: false } });
    if (path === "/api/notifications/unread-count") return route.fulfill({ json: { count: 0 } });
    if (path === "/api/tasks/overdue") return route.fulfill({ json: { total_overdue: 0, tasks: [] } });
    if (path === "/api/workspaces/current/stats/today") return route.fulfill(state.failStats ? { status: 503, json: { message: "Unavailable" } } : { json: { unanswered_conversations: 7 } });
    if (path === "/api/tasks") return route.fulfill(state.failTasks ? { status: 503, json: { message: "Unavailable" } } : { json: { data: [{ id: "task-one", title: "Llamar al cliente", priority: "URGENT", status: "TODO", due_at: "2026-10-04T12:00:00.000Z" }], meta: { total: 21 } } });
    if (path === "/api/conversations") return route.fulfill({ json: { data: [{ id: "conversation-one", contact: { full_name: "Cliente de prueba" }, messages: [{ body_text: "Consulta sobre la entrega" }] }], meta: { total: 30 } } });
    if (path === "/api/invoices") return route.fulfill({ json: { data: [
      { id: "invoice-one", number: "A-001", amount: "120.50", balance_due: 100, currency: "USD", due_date: "2026-09-01", contact: { full_name: "Cliente en dólares" } },
      { id: "invoice-two", number: "A-002", amount: "52000", balance_due: 50000, currency: "CRC", due_date: "2026-09-02", contact: { full_name: "Cliente en colones" } },
    ], meta: { total: url.searchParams.has("overdue_only") ? 19 : 45 } } });
    if (path === "/api/pipeline/stages") return route.fulfill({ json: [{ id: "stage-one", name: "Propuesta", deals: [{ id: "deal-one", value: 40, currency: "USD" }, { id: "deal-two", value: 1000, currency: "CRC" }] }] });
    if (path === "/api/summaries/daily/today") return route.fulfill(state.failSummary ? { status: 503, json: { message: "Unavailable" } } : state.generated ? { json: { generated_text: "Resumen guardado del negocio" } } : { status: 404, json: { message: "No summary found" } });
    if (path === "/api/summaries/generate") {
      if (state.failGenerate) return route.fulfill({ status: 503, json: { message: "No se pudo generar. Reintenta." } });
      state.generated = true;
      return route.fulfill({ json: { generated_text: "Resumen guardado del negocio" } });
    }
    return route.fulfill({ status: 404, json: { message: "Not provided by isolated home fixture" } });
  });
  return { user, state, requests };
}

test("home uses full API counts, actual previews and separate currencies", async ({ page }) => {
  await homeFixture(page);
  await page.goto("/mobile-test");
  await expect(page.getByRole("heading", { name: "Ana", exact: true })).toBeVisible();
  const metrics = page.getByRole("region", { name: "Tu negocio ahora" });
  await expect(metrics.getByRole("link", { name: "Tareas pendientes", exact: true })).toContainText("21");
  await expect(metrics.getByRole("link", { name: "Facturas", exact: true })).toContainText("45");
  await expect(metrics.getByRole("link", { name: "Vencimiento pasado", exact: true })).toContainText("19");
  await expect(page.getByRole("region", { name: "Conversaciones recientes" })).toContainText("Consulta sobre la entrega");
  const invoices = page.getByRole("region", { name: "Revisar vencimientos" });
  await expect(invoices).toContainText("USD");
  await expect(invoices).toContainText("CRC");
  const sales = page.getByRole("region", { name: "Ventas abiertas" });
  await expect(sales).toContainText("USD");
  await expect(sales).toContainText("CRC");
  await page.screenshot({ path: ".design-reference/home-mobile.png", scale: "css" });
  await page.getByRole("region", { name: "A tu alcance" }).getByRole("link", { name: "Tareas", exact: true }).click();
  await expect(page).toHaveURL(/\/mobile-test\/tasks$/);
});

test("home shortcuts persist per account and survive unavailable browser storage", async ({ page }) => {
  const fixture = await homeFixture(page);
  await page.goto("/mobile-test");
  await page.getByRole("button", { name: "Personalizar accesos" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox", { name: "Clientes", exact: true }).uncheck();
  await dialog.getByRole("checkbox", { name: "Archivos", exact: true }).check();
  await dialog.getByRole("button", { name: "Listo", exact: true }).click();
  await page.reload();
  const shortcuts = page.getByRole("region", { name: "A tu alcance" });
  await expect(shortcuts.getByRole("link", { name: "Archivos", exact: true })).toBeVisible();
  await expect(shortcuts.getByRole("link", { name: "Clientes", exact: true })).toHaveCount(0);
  fixture.user.id = "33333333-3333-4333-8333-333333333333";
  await page.reload();
  await expect(shortcuts.getByRole("link", { name: "Clientes", exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) { if (key.startsWith("pymes-home:")) throw new Error("Blocked"); original.call(this, key, value); };
  });
  await page.getByRole("button", { name: "Personalizar accesos" }).click();
  await dialog.getByRole("checkbox", { name: "Clientes", exact: true }).uncheck();
  await expect(dialog.getByRole("status")).toContainText("duran esta sesión");
  await dialog.getByRole("button", { name: "Listo", exact: true }).click();
  await expect(shortcuts.getByRole("link", { name: "Clientes", exact: true })).toHaveCount(0);
});

test("home failures never report a false zero and sections can retry", async ({ page }) => {
  const fixture = await homeFixture(page);
  fixture.state.failTasks = fixture.state.failStats = true;
  await page.goto("/mobile-test");
  const metrics = page.getByRole("region", { name: "Tu negocio ahora" });
  await expect(metrics.getByRole("link", { name: "Tareas pendientes", exact: true })).toContainText("No disponible");
  await expect(metrics.getByRole("link", { name: "Por responder", exact: true })).toContainText("—");
  const tasks = page.getByRole("region", { name: "Lo siguiente" });
  await expect(tasks.getByRole("alert")).toContainText("No se pudo cargar");
  fixture.state.failTasks = fixture.state.failStats = false;
  await tasks.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(tasks).toContainText("Llamar al cliente");
  await page.getByRole("button", { name: "Reintentar indicadores" }).click();
  await expect(metrics.getByRole("link", { name: "Por responder", exact: true })).toContainText("7");
});

test("summary distinguishes absent, failed and generated data", async ({ page }) => {
  const fixture = await homeFixture(page);
  fixture.state.failSummary = true;
  await page.goto("/mobile-test");
  const summary = page.getByRole("region", { name: "Resumen del día" });
  await expect(summary.getByRole("alert")).toBeVisible();
  fixture.state.failSummary = false;
  await summary.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(summary).toContainText("Todavía no has generado");
  fixture.state.failGenerate = true;
  await summary.getByRole("button", { name: "Generar resumen" }).click();
  await expect(summary.getByRole("alert")).toContainText("No se pudo generar");
  fixture.state.failGenerate = false;
  await summary.getByRole("button", { name: "Generar resumen" }).click();
  await expect(summary).toContainText("Resumen guardado del negocio");
});

test("billing home avoids forbidden requests and feature flags hide unavailable actions", async ({ page }) => {
  const fixture = await homeFixture(page, "BILLING");
  await page.goto("/mobile-test");
  const shortcuts = page.getByRole("region", { name: "A tu alcance" });
  await expect(shortcuts.getByRole("link", { name: "Facturas", exact: true })).toBeVisible();
  await expect(shortcuts.getByRole("link", { name: "Bandeja", exact: true })).toHaveCount(0);
  expect(fixture.requests.some(path => ["/api/tasks", "/api/conversations", "/api/summaries/daily/today", "/api/pipeline/stages"].includes(path))).toBe(false);
  fixture.user.role = "OWNER";
  fixture.state.features.billing = false;
  await page.reload();
  await expect(shortcuts.getByRole("link", { name: "Facturas", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Revisar vencimientos" })).toHaveCount(0);
});

test("home stays readable with large text at 320px and shortcuts modal returns focus", async ({ page }) => {
  await homeFixture(page);
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test");
  const trigger = page.getByRole("button", { name: "Personalizar accesos" });
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/home-small-large-text.png", scale: "css" });
});
