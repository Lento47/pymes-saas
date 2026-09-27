import { test, expect, type Page } from "@playwright/test";

// Isolated API fixtures for interaction tests; never used by the application.
async function taskFixture(page: Page, role = "OWNER") {
  const workspace = { id: "22222222-2222-4222-8222-222222222222", name: "Negocio de prueba", slug: "mobile-test", plan: "STARTER" };
  const user = { id: "11111111-1111-4111-8111-111111111111", name: "Cuenta de prueba", email: "tasks@example.invalid", role, workspace };
  const rows = [
    { id: "task-one", title: "Confirmar entrega y revisar los detalles con el cliente", description: "Detalle de la entrega", priority: "HIGH", status: "TODO", due_at: "2026-08-11T18:35:17.000Z", assigned_user_id: user.id, assigned_user: { id: user.id, name: user.name } },
    { id: "task-two", title: "Preparar propuesta", description: "", priority: "MEDIUM", status: "IN_PROGRESS", due_at: null, assigned_user_id: null, assigned_user: null },
  ];
  const requests: { method: string; path: string; query: Record<string, string>; body: Record<string, unknown> | null }[] = [];
  const state = { failList: false, failSave: false, failComplete: false, failDelete: false };
  await page.addInitScript(() => {
    localStorage.setItem("pymes_token", "isolated-test-token");
    localStorage.setItem("pymes_slug", "mobile-test");
    localStorage.setItem("pymes_last_activity", String(Date.now()));
  });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", route => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = route.request().postData() ? route.request().postDataJSON() : null;
    requests.push({ method, path, query: Object.fromEntries(url.searchParams), body });
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/auth/my-workspaces") return route.fulfill({ json: [workspace] });
    if (path === "/api/workspaces/current/features") return route.fulfill({ json: { plan: "STARTER", features: {} } });
    if (path === "/api/workspaces/current/members") return route.fulfill({ json: [{ user }] });
    if (path === "/api/notifications/unread-count") return route.fulfill({ json: { count: 0 } });
    if (path === "/api/tasks/overdue") return route.fulfill({ json: { total_overdue: 1, tasks: [rows[0]] } });
    if (path === "/api/tasks" && method === "GET") {
      if (state.failList) return route.fulfill({ status: 503, json: { message: "No se pudo conectar. Reintenta." } });
      const q = url.searchParams.get("q");
      const status = url.searchParams.get("status");
      const data = q ? (q === "ausente" ? [] : [rows[1]]) : status ? rows.filter(row => row.status === status) : rows;
      return route.fulfill({ json: { data, meta: { total: q ? data.length : 21, page: Number(url.searchParams.get("page")) || 1, pages: q ? 1 : 2 } } });
    }
    if (path.endsWith("/complete")) {
      if (state.failComplete) return route.fulfill({ status: 409, json: { message: "No se pudo completar. Reintenta." } });
      const row = rows.find(row => path.includes(row.id));
      if (row) row.status = "DONE";
      return route.fulfill({ json: row });
    }
    if (method === "DELETE" && path.startsWith("/api/tasks/")) {
      if (state.failDelete) return route.fulfill({ status: 409, json: { message: "No se pudo eliminar. Reintenta." } });
      rows.splice(rows.findIndex(row => path.endsWith(row.id)), 1);
      return route.fulfill({ json: {} });
    }
    if ((method === "PATCH" || method === "POST") && path.startsWith("/api/tasks")) {
      if (state.failSave) return route.fulfill({ status: 400, json: { message: "No se pudo guardar. Reintenta." } });
      return route.fulfill({ json: { id: "saved-task", ...body } });
    }
    return route.fulfill({ status: 404, json: { message: "Not provided by isolated task fixture" } });
  });
  return { rows, requests, state };
}

test("mobile tasks show readable cards, server counts and paginated search", async ({ page }) => {
  const fixture = await taskFixture(page);
  await page.goto("/mobile-test/tasks");
  await expect(page.getByTestId("task-card-task-one")).toBeVisible();
  await expect(page.getByTestId("alert-overdue")).toContainText("1 tarea vencida");
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toContainText("1 vencidas");
  await page.screenshot({ path: ".design-reference/tasks-mobile.png", fullPage: true, scale: "css" });
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect.poll(() => fixture.requests.some(request => request.path === "/api/tasks" && request.query.page === "2")).toBe(true);
  await page.getByRole("searchbox", { name: "Buscar tareas" }).fill("propuesta");
  await page.getByRole("search").getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page).toHaveURL(/q=propuesta/);
  await expect.poll(() => fixture.requests.some(request => request.query.q === "propuesta" && request.query.page === "1")).toBe(true);
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue("propuesta");
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByTestId("alert-overdue").click();
  await expect.poll(() => fixture.requests.some(request => request.query.overdue === "true" && !request.query.status)).toBe(true);
});

test("editing starts with the selected task, clears optional fields and preserves failed input", async ({ page }) => {
  const fixture = await taskFixture(page);
  await page.goto("/mobile-test/tasks");
  await page.getByTestId("task-card-task-one").getByRole("button", { name: fixture.rows[0].title, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue(fixture.rows[0].title);
  await expect(dialog.getByLabel("Fecha de vencimiento (opcional)")).not.toHaveValue("");
  await dialog.getByLabel("Descripción (opcional)").fill("");
  await dialog.getByLabel("Responsable").selectOption("");
  await dialog.getByLabel("Fecha de vencimiento (opcional)").fill("");
  fixture.state.failSave = true;
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue(fixture.rows[0].title);
  expect(fixture.requests.find(request => request.method === "PATCH")?.body).toMatchObject({ assigned_user_id: null, due_at: null, description: "" });
  fixture.state.failSave = false;
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByTestId("task-card-task-two").getByRole("button", { name: "Preparar propuesta", exact: true }).click();
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue("Preparar propuesta");
  await expect(dialog.getByLabel("Fecha de vencimiento (opcional)")).toHaveValue("");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("create sheet validates, protects drafts, and exposes keyboard priority selection", async ({ page }) => {
  const fixture = await taskFixture(page);
  await page.goto("/mobile-test/tasks");
  const create = page.getByRole("button", { name: "Nueva tarea", exact: true });
  await create.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Nueva tarea" })).toBeFocused();
  await dialog.getByRole("button", { name: "Crear tarea", exact: true }).click();
  expect(fixture.requests.filter(request => request.method === "POST" && request.path === "/api/tasks")).toHaveLength(0);
  await dialog.getByLabel("Título", { exact: true }).fill("Llamar mañana");
  await dialog.getByRole("radio", { name: "Urgente", exact: true }).check();
  await dialog.screenshot({ path: ".design-reference/task-editor-mobile.png", scale: "css" });
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("¿Descartar los cambios sin guardar?")).toBeVisible();
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue("Llamar mañana");
  await dialog.getByRole("button", { name: "Crear tarea", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(create).toBeFocused();
  expect(fixture.requests.find(request => request.method === "POST" && request.path === "/api/tasks")?.body).toMatchObject({ title: "Llamar mañana", priority: "URGENT" });
  await create.click();
  await expect(dialog.getByLabel("Título", { exact: true })).toHaveValue("");
});

test("task load failures have retry and filtered empty states", async ({ page }) => {
  const fixture = await taskFixture(page);
  fixture.state.failList = true;
  await page.goto("/mobile-test/tasks");
  await expect(page.getByRole("heading", { name: "No se pudieron cargar las tareas" })).toBeVisible();
  await expect(page.getByText("Todo despejado por aquí")).not.toBeVisible();
  fixture.state.failList = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByTestId("task-card-task-one")).toBeVisible();
  await page.getByRole("searchbox").fill("ausente");
  await page.getByRole("search").getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("Sin coincidencias")).toBeVisible();
});

test("deletion requires confirmation and errors retain the task", async ({ page }) => {
  const fixture = await taskFixture(page);
  await page.goto("/mobile-test/tasks");
  await page.getByTestId("task-card-task-two").getByRole("button", { name: "Opciones: Preparar propuesta" }).click();
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  expect(fixture.requests.filter(request => request.method === "DELETE")).toHaveLength(0);
  fixture.state.failDelete = true;
  await dialog.getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(dialog.getByRole("alert")).toContainText("No se pudo eliminar");
  fixture.state.failDelete = false;
  await dialog.getByRole("button", { name: "Eliminar tarea" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByTestId("task-card-task-two")).toHaveCount(0);
});

test("viewer cannot fetch or mutate tasks through a direct route", async ({ page }) => {
  const fixture = await taskFixture(page, "VIEWER");
  await page.goto("/mobile-test/tasks");
  await expect(page.getByText("Tu rol no permite gestionar tareas", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva tarea", exact: true })).toHaveCount(0);
  expect(fixture.requests.filter(request => request.path.startsWith("/api/tasks"))).toHaveLength(0);
});

test("completion failure can retry and the resulting state comes from the API", async ({ page }) => {
  const fixture = await taskFixture(page);
  fixture.state.failComplete = true;
  await page.goto("/mobile-test/tasks");
  const card = page.getByTestId("task-card-task-two");
  await card.getByRole("button", { name: "Completar: Preparar propuesta" }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo completar");
  await expect(card).toContainText("En progreso");
  fixture.state.failComplete = false;
  await page.getByRole("button", { name: "Reintentar completar" }).click();
  await expect(card.getByRole("button", { name: "Completada: Preparar propuesta" })).toBeDisabled();
});

test("large text works at 320px and desktop retains a usable task table", async ({ page }) => {
  await taskFixture(page);
  await page.addInitScript(() => {
    localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true }));
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/tasks");
  const card = page.getByTestId("task-card-task-one");
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const targets = await card.locator("button").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  expect(targets.every(height => height >= 44)).toBe(true);
  await page.screenshot({ path: ".design-reference/tasks-small-large-text.png", scale: "css" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByTestId("task-row-task-one")).toContainText("Confirmar entrega");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
