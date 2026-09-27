import { expect, test, type Page } from "@playwright/test";

async function inboxFixture(page: Page, role = "OWNER") {
  const user = { id: "11111111-1111-4111-8111-111111111111", name: "Ana Prueba", email: "inbox@example.invalid", role, workspace: { id: "22222222-2222-4222-8222-222222222222", name: "Negocio de prueba", slug: "mobile-test", plan: "STARTER" } };
  const conversation = { id: "33333333-3333-4333-8333-333333333333", subject: "Entrega pendiente", status: "OPEN", priority: "MEDIUM", updated_at: "2026-09-22T12:00:00Z", channel: { id: "channel-a", name: "Atención", type: "EMAIL" }, contact: { id: "contact-a", full_name: "Distribuidora del barrio central", email: "client@example.invalid" }, messages: [{ body_text: "Quisiera conocer el estado de mi entrega. ¿Podrían confirmarme cuándo llegará?" }] };
  const state = { failList: false, failDetail: false, empty: false, count: 0 };
  const requests: URL[] = [];
  await page.addInitScript(() => { localStorage.setItem("pymes_token", "isolated-test-token"); localStorage.setItem("pymes_slug", "mobile-test"); localStorage.setItem("pymes_last_activity", String(Date.now())); });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const url = new URL(route.request().url()); requests.push(url);
    const path = url.pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/auth/my-workspaces") return route.fulfill({ json: [user.workspace] });
    if (path === "/api/workspaces/current/features") return route.fulfill({ json: { features: {}, plan: "STARTER" } });
    if (path === "/api/workspaces/current") return route.fulfill({ json: user.workspace });
    if (path === "/api/notifications/unread-count") return route.fulfill({ json: { count: 0 } });
    if (path === "/api/tasks/overdue") return route.fulfill({ json: { total_overdue: 0, tasks: [] } });
    if (path === "/api/conversations") {
      state.count++;
      if (state.failList) return route.fulfill({ status: 503, json: { message: "No disponible" } });
      const currentPage = Number(url.searchParams.get("page") ?? 1);
      const name = url.searchParams.get("q") ? "Cliente encontrado" : currentPage === 2 ? "Cliente de la segunda página" : conversation.contact.full_name;
      return route.fulfill({ json: { data: state.empty ? [] : [{ ...conversation, contact: { ...conversation.contact, full_name: name } }], meta: { total: state.empty ? 0 : 24, page: currentPage, limit: 20, pages: state.empty ? 0 : 2 } } });
    }
    if (path === `/api/conversations/${conversation.id}`) return route.fulfill(state.failDetail ? { status: 503, json: { message: "No disponible" } } : { json: conversation });
    if (path === `/api/conversations/${conversation.id}/messages`) return route.fulfill({ json: { data: [], meta: { total: 0 } } });
    if (path.endsWith("/agent-run")) return route.fulfill({ json: null });
    if (path === "/api/workspaces/current/members" || path.includes("templates")) return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: "Not provided by isolated inbox fixture" } });
  });
  return { user, conversation, state, requests };
}

test("inbox uses API totals, server search and URL pagination", async ({ page }) => {
  const fixture = await inboxFixture(page);
  await page.goto("/mobile-test/inbox");
  await expect(page.getByRole("status").filter({ hasText: "24 conversaciones" })).toBeVisible();
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("button", { name: "Abrir conversación con Cliente de la segunda página", exact: true })).toBeVisible();
  await page.getByLabel("Buscar asunto o cliente").fill("Ana");
  await page.getByRole("button", { name: "Buscar conversaciones", exact: true }).click();
  await expect(page.getByRole("button", { name: "Abrir conversación con Cliente encontrado", exact: true })).toBeVisible();
  expect(fixture.requests.some(url => url.pathname === "/api/conversations" && url.searchParams.get("q") === "Ana" && url.searchParams.get("page") === "1")).toBe(true);
  await page.reload(); await expect(page.getByLabel("Buscar asunto o cliente")).toHaveValue("Ana");
});

test("empty inbox retains every channel and keyboard-accessible status filter", async ({ page }) => {
  const fixture = await inboxFixture(page); fixture.state.empty = true;
  await page.goto("/mobile-test/inbox");
  const attention = page.getByRole("button", { name: "Requieren atención", exact: true });
  await attention.focus(); await page.keyboard.press("Enter");
  await expect(attention).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Canal o asignación").selectOption("EMAIL");
  await expect(page).toHaveURL(/channel=EMAIL/);
  await expect(page.getByRole("heading", { name: "Sin conversaciones", exact: true })).toBeVisible();
  expect(fixture.requests.some(url => url.searchParams.get("status") === "REQUIRES_HUMAN" && url.searchParams.get("channel_type") === "EMAIL")).toBe(true);
  await page.getByLabel("Canal o asignación").selectOption("MINE");
  await expect.poll(() => fixture.requests.some(url => url.searchParams.get("assigned_user_id") === fixture.user.id)).toBe(true);
  await page.getByLabel("Canal o asignación").selectOption("UNASSIGNED");
  await expect.poll(() => fixture.requests.some(url => url.searchParams.get("unassigned") === "true")).toBe(true);
});

test("inbox failures offer retry without pretending the queue is empty and polling stays active", async ({ page }) => {
  const fixture = await inboxFixture(page); fixture.state.failList = true;
  await page.goto("/mobile-test/inbox");
  await expect(page.getByRole("alert")).toContainText("No se pudieron cargar las conversaciones");
  await expect(page.getByRole("heading", { name: "Sin conversaciones", exact: true })).toHaveCount(0);
  fixture.state.failList = false;
  await page.getByRole("button", { name: "Reintentar conversaciones" }).click();
  await expect(page.getByRole("button", { name: `Abrir conversación con ${fixture.conversation.contact.full_name}` })).toBeVisible();
  const before = fixture.state.count;
  await expect.poll(() => fixture.state.count, { timeout: 8000 }).toBeGreaterThan(before);
});

test("billing cannot load the inbox and viewers get read-only conversation controls", async ({ page }) => {
  const fixture = await inboxFixture(page, "BILLING");
  await page.goto("/mobile-test/inbox");
  await expect(page.getByText("Tu rol no tiene acceso a conversaciones.")).toBeVisible();
  expect(fixture.requests.some(url => url.pathname.startsWith("/api/conversations"))).toBe(false);
  fixture.user.role = "VIEWER";
  await page.goto(`/mobile-test/inbox/${fixture.conversation.id}`);
  await expect(page.getByText("Tu rol permite leer esta conversación. Necesitas permiso para responder.")).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  await page.getByRole("button", { name: "Más opciones", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: /Crear tarea|Crear factura|Eliminar|Agente IA/ })).toHaveCount(0);
  expect(fixture.requests.some(url => url.pathname.endsWith("/agent-run") || url.pathname.endsWith("/members"))).toBe(false);
});

test("only one conversation panel mounts and back navigation keeps inbox filters", async ({ page }) => {
  const fixture = await inboxFixture(page);
  await page.goto(`/mobile-test/inbox/${fixture.conversation.id}?channel=EMAIL&status=OPEN&page=2`);
  await expect(page.getByPlaceholder("Escribe un mensaje...", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Volver", exact: true }).filter({ visible: true }).click();
  await expect(page).toHaveURL(/\/inbox\?channel=EMAIL&status=OPEN&page=2/);
  await expect(page.getByLabel("Canal o asignación")).toHaveValue("EMAIL");
});

test("a failed conversation detail offers retry and a route back to the queue", async ({ page }) => {
  const fixture = await inboxFixture(page); fixture.state.failDetail = true;
  await page.goto(`/mobile-test/inbox/${fixture.conversation.id}`);
  await expect(page.getByRole("alert")).toContainText("No se pudo cargar la conversación");
  await expect(page.getByRole("button", { name: "Volver a la bandeja" })).toBeVisible();
  await expect(page.locator("textarea")).toHaveCount(0);
  fixture.state.failDetail = false;
  await page.getByRole("button", { name: "Reintentar conversación", exact: true }).click();
  await expect(page.getByPlaceholder("Escribe un mensaje...", { exact: true })).toHaveCount(1);
});

test("desktop viewer context keeps workspace links and hides AI controls", async ({ page }) => {
  const fixture = await inboxFixture(page, "VIEWER");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/mobile-test/inbox/${fixture.conversation.id}`);
  await expect(page.getByText("Tu rol permite leer esta conversación. Necesitas permiso para responder.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver en contactos", exact: true })).toHaveAttribute("href", "/mobile-test/contacts/contact-a");
  await expect(page.getByRole("button", { name: "Tomar control y responder", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nueva conversación", exact: true })).toHaveCount(0);
  expect(fixture.requests.some(url => url.pathname === "/api/ai-tokens" || url.pathname.endsWith("/agent-run"))).toBe(false);
});

test("the inbox fits small phones and tablets with large text and reduced motion", async ({ page }) => {
  await inboxFixture(page);
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/inbox");
  await expect(page.getByRole("button", { name: "Siguiente", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/inbox-small.png", scale: "css" });
  await page.setViewportSize({ width: 768, height: 1024 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/inbox-tablet.png", scale: "css" });
});
