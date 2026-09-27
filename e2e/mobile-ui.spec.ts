import { test, expect, type Page } from "@playwright/test";

// Isolated presentation/interaction fixtures. No production data or API mutations.
// These tests do not prove backend authorization or live API integration.
async function accountFixture(page: Page, role = "OWNER") {
  const user = {
    avatar_url: undefined as string | undefined,
    id: "11111111-1111-4111-8111-111111111111", name: "Cuenta de prueba",
    email: "mobile-test@example.invalid", role, email_verified: true,
    workspace: { id: "22222222-2222-4222-8222-222222222222", name: "Negocio de prueba", slug: "mobile-test", plan: "STARTER", locale: "es" },
  };
  await page.addInitScript(() => {
    localStorage.setItem("pymes_token", "isolated-test-token");
    localStorage.setItem("pymes_slug", "mobile-test");
    localStorage.setItem("pymes_last_activity", String(Date.now()));
  });
  await page.route("**/socket.io/**", route => route.abort());
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/auth/my-workspaces") return route.fulfill({ json: [user.workspace] });
    if (path === "/api/workspaces/current/features") return route.fulfill({ json: { plan: "STARTER", features: {} } });
    if (path === "/api/notifications/unread-count") return route.fulfill({ json: { count: 0 } });
    if (path === "/api/tasks/overdue") return route.fulfill({ json: { total_overdue: 0, tasks: [] } });
    if (path === "/api/users/me" && route.request().method() === "PATCH") {
      user.name = route.request().postDataJSON().name;
      return route.fulfill({ json: user });
    }
    if (path === "/api/users/me/password") return route.fulfill({ json: { message: "Updated" } });
    return route.fulfill({ status: 404, json: { message: "Not provided by isolated UI fixture" } });
  });
  return user;
}

test("account has phone layout, working destinations and persistent navigation", async ({ page }) => {
  await accountFixture(page);
  await page.goto("/mobile-test/account");
  await expect(page.getByRole("heading", { name: "Mi cuenta", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
  await expect(page.locator(".auth-ui")).toHaveCSS("background-color", "rgb(18, 18, 18)");
  await page.screenshot({ path: ".design-reference/account-mobile-dark.png", fullPage: true, scale: "css" });
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.viewport);
  await page.getByRole("link", { name: "A tu manera", exact: false }).click();
  await expect(page).toHaveURL(/\/mobile-test\/account\/preferences$/);
  await page.getByRole("switch", { name: /Modo claro/ }).check();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("link", { name: "Mi cuenta", exact: true }).first().click();
  await page.screenshot({ path: ".design-reference/account-mobile-light.png", fullPage: true, scale: "css" });
});

test("More contains billing and closes with Escape, returning focus", async ({ page }) => {
  await accountFixture(page);
  await page.goto("/mobile-test/account");
  const trigger = page.getByRole("button", { name: "Más", exact: true });
  await trigger.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('a[href="/invoices"]')).toBeVisible();
  await page.screenshot({ path: ".design-reference/mobile-feature-menu.png", fullPage: true, scale: "css" });
  await page.keyboard.press("Escape");
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("viewer can reach account but cannot see task or invoice actions", async ({ page }) => {
  await accountFixture(page, "VIEWER");
  await page.goto("/mobile-test/account");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav.locator('a[href="/account"]')).toBeVisible();
  await expect(nav.locator('a[href="/tasks"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Más", exact: true }).click();
  await expect(page.getByRole("dialog").locator('a[href="/invoices"]')).toHaveCount(0);
});

test("name save refreshes the shared identity and preserves failed input", async ({ page }) => {
  await accountFixture(page);
  await page.goto("/mobile-test/account/profile");
  const name = page.getByLabel("Nombre", { exact: true });
  await name.fill("Nombre actualizado");
  await page.getByRole("button", { name: "Guardar nombre", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Nombre actualizado.");
  await expect(page.locator("aside")).toContainText("Nombre actualizado");
  await page.route("**/api/users/me", route => route.fulfill({ status: 400, json: { message: "No se pudo guardar. Reintenta." } }));
  await name.fill("Nombre que no se guardó");
  await page.getByRole("button", { name: "Guardar nombre", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("No se pudo guardar");
  await expect(name).toHaveValue("Nombre que no se guardó");
});

test("password mismatch sends no request and valid submit clears passwords", async ({ page }) => {
  await accountFixture(page);
  let submissions = 0;
  page.on("request", request => { if (request.url().endsWith("/api/users/me/password")) submissions++; });
  await page.goto("/mobile-test/account/security");
  await page.getByLabel("Contraseña actual", { exact: true }).fill("current-password");
  await page.getByLabel("Nueva contraseña", { exact: true }).fill("new-password-123");
  await page.getByLabel("Repite la nueva contraseña").fill("different-password");
  await page.getByRole("button", { name: "Actualizar contraseña", exact: true }).click();
  expect(submissions).toBe(0);
  await expect(page.getByLabel("Repite la nueva contraseña")).toHaveJSProperty("validationMessage", "Las contraseñas no coinciden.");
  await page.getByLabel("Repite la nueva contraseña").fill("new-password-123");
  await page.getByRole("button", { name: "Actualizar contraseña", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Contraseña actualizada.");
  await expect(page.getByLabel("Contraseña actual", { exact: true })).toHaveValue("");
  expect(submissions).toBe(1);
});

test("oversize avatar is rejected before network upload", async ({ page }) => {
  await accountFixture(page);
  let uploads = 0;
  page.on("request", request => { if (request.url().includes("/api/users/me/avatar")) uploads++; });
  await page.goto("/mobile-test/account/profile");
  await page.locator('input[type="file"]').setInputFiles({ name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  await expect(page.getByRole("alert")).toContainText("hasta 2 MB");
  expect(uploads).toBe(0);
});

test("uploaded photo is fetched with authentication and remains visible after reload", async ({ page }) => {
  const user = await accountFixture(page);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  const avatarPath = `/api/users/${user.id}/avatar`;
  const requests: { authorization?: string; workspace?: string }[] = [];
  await page.route(`**${avatarPath}`, route => {
    const headers = route.request().headers();
    requests.push({ authorization: headers.authorization, workspace: headers["x-workspace-slug"] });
    return route.fulfill({ contentType: "image/png", body: png });
  });
  await page.route("**/api/users/me/avatar", route => {
    user.avatar_url = `${avatarPath}?v=33333333-3333-4333-8333-333333333333`;
    return route.fulfill({ json: { avatar_url: user.avatar_url } });
  });
  await page.goto("/mobile-test/account/profile");
  await page.locator('input[type="file"]').setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Foto actualizada.", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toHaveAttribute("src", /^blob:/);
  await page.reload();
  await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toBeVisible();
  await page.getByRole("link", { name: "Mi cuenta", exact: true }).first().click();
  await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toBeVisible();
  expect(requests.length).toBeGreaterThanOrEqual(2);
  expect(requests.every(request => request.authorization === "Bearer isolated-test-token" && request.workspace === "mobile-test")).toBe(true);
});

test("photo load failure offers a working retry without losing profile edits", async ({ page }) => {
  const user = await accountFixture(page);
  user.avatar_url = `/api/users/${user.id}/avatar`;
  let fail = true;
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
  await page.route(`**${user.avatar_url}`, route => fail
    ? route.fulfill({ status: 404, json: { message: "Avatar no encontrado." } })
    : route.fulfill({ contentType: "image/png", body: png }));
  await page.goto("/mobile-test/account/profile");
  await expect(page.getByText("No se pudo cargar tu foto.")).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).fill("Nombre sin guardar");
  fail = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByRole("img", { name: "Tu foto de perfil" })).toBeVisible();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue("Nombre sin guardar");
});

test("reading preferences survive navigation when writes are blocked", async ({ page }) => {
  await accountFixture(page);
  await page.addInitScript(() => {
    const key = "pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222";
    localStorage.setItem(key, JSON.stringify({ largeText: false, reducedMotion: false }));
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(name, value) {
      if (name.startsWith("pymes-display:")) throw new DOMException("blocked", "QuotaExceededError");
      original.call(this, name, value);
    };
  });
  await page.goto("/mobile-test/account/preferences");
  await page.getByRole("switch", { name: /Texto más grande/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-large-text", "true");
  await page.getByRole("switch", { name: /Reducir movimiento/ }).check();
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  await page.getByRole("link", { name: "Mi cuenta", exact: true }).first().click();
  await page.getByRole("link", { name: "A tu manera", exact: false }).click();
  await expect(page.getByRole("switch", { name: /Texto más grande/ })).toBeChecked();
});

test("320px large text and system reduced motion remain usable", async ({ page }) => {
  await accountFixture(page);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/mobile-test/account/preferences");
  await page.getByRole("switch", { name: /Texto más grande/ }).check();
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();
  const sizes = await nav.locator("a, button").evaluateAll(elements => elements.map(el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })));
  expect(sizes.every(size => size.width >= 44 && size.height >= 44)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/account-small-large-text.png", fullPage: true, scale: "css" });
});

test("device permissions reflect browser state and changes without opening devices", async ({ page, context }) => {
  await accountFixture(page);
  await context.grantPermissions(["camera"], { origin: "http://127.0.0.1:5173" });
  await page.addInitScript(() => {
    let requests = 0;
    navigator.mediaDevices.getUserMedia = async () => { requests++; throw new Error("Unexpected device request"); };
    Object.defineProperty(window, "deviceRequestCount", { get: () => requests });
  });
  await page.goto("/mobile-test/account/access");
  const devices = page.getByRole("region", { name: "Permisos del dispositivo" });
  const camera = devices.getByRole("listitem").filter({ hasText: "Cámara" });
  const microphone = devices.getByRole("listitem").filter({ hasText: "Micrófono" });
  await expect(camera).toContainText("Permitido");
  await expect(microphone).toContainText("Bloqueado");
  await context.grantPermissions(["camera", "microphone"], { origin: "http://127.0.0.1:5173" });
  await expect(microphone).toContainText("Permitido");
  await context.clearPermissions();
  await devices.getByRole("button", { name: "Revisar permisos" }).click();
  await expect(camera).toContainText("Se pedirá al usar");
  expect(await page.evaluate(() => (window as unknown as { deviceRequestCount: number }).deviceRequestCount)).toBe(0);
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await devices.screenshot({ path: ".design-reference/device-permissions-mobile.png", scale: "css" });
});

test("unsupported device queries show an honest unknown state", async ({ page }) => {
  await accountFixture(page);
  await page.addInitScript(() => {
    navigator.permissions.query = async () => { throw new TypeError("Permission name unsupported"); };
  });
  await page.goto("/mobile-test/account/access");
  const devices = page.getByRole("region", { name: "Permisos del dispositivo" });
  await expect(devices.getByText("Estado no disponible", { exact: true })).toHaveCount(2);
  await devices.getByRole("button", { name: "Revisar permisos" }).click();
  await expect(devices.getByText("Estado no disponible", { exact: true })).toHaveCount(2);
});
