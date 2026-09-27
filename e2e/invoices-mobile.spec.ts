import { expect, test, type Page } from "@playwright/test";

async function invoiceFixture(page: Page, role = "OWNER") {
  const user = { id: "11111111-1111-4111-8111-111111111111", name: "Ana Prueba", email: "invoices@example.invalid", role, workspace: { id: "22222222-2222-4222-8222-222222222222", name: "Negocio de prueba", slug: "mobile-test", plan: "STARTER" } };
  const invoice = { id: "invoice-one", number: "F-001", amount: "100.00", amount_paid: 60, balance_due: 40, currency: "USD", due_date: "2026-12-01T12:00:00Z", status: "PARTIALLY_PAID", hacienda_status: "DRAFT", issuance_mode: "MANUAL_ONLY", contact: { id: "contact-one", full_name: "Cliente de prueba", email: "client@example.invalid" }, payments: [], lines: [] };
  const state = { failList: false, failPayment: false, failContacts: false, failCreate: false, failCabys: false, failAction: false, holdAction: false, releaseAction: null as (() => void) | null, actionCount: 0, actionPayload: null as any, payment: null as any, created: null as any };
  const requests: URL[] = [];
  const reminderState = { failGenerate: false, holdGenerate: false, releaseGenerate: null as (() => void) | null, failChannels: false, failSend: false, holdSend: false, releaseSend: null as (() => void) | null, sent: null as any, sendCount: 0, channels: [{ id: "mail-one", name: "Cobros", type: "EMAIL", status: "ACTIVE" }, { id: "wa-one", name: "Ventas", type: "WHATSAPP", status: "ACTIVE" }, { id: "mail-off", name: "Desconectado", type: "EMAIL", status: "INACTIVE" }] };
  await page.addInitScript(() => {
    localStorage.setItem("pymes_token", "isolated-test-token");
    localStorage.setItem("pymes_slug", "mobile-test");
    localStorage.setItem("pymes_last_activity", String(Date.now()));
  });
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
    if (path === "/api/contacts") return route.fulfill({ json: { data: [invoice.contact] } });
    if (path === "/api/invoices/templates") return route.fulfill({ json: [] });
    if (path === "/api/channels") return route.fulfill(reminderState.failChannels ? { status: 503, json: { message: "Canales no disponibles" } } : { json: reminderState.channels });
    if (path === "/api/invoices/invoice-one/reminder") {
      if (reminderState.holdGenerate) await new Promise<void>(resolve => { reminderState.releaseGenerate = resolve; });
      return route.fulfill(reminderState.failGenerate ? { status: 503, json: { message: "No se pudo preparar el borrador" } } : { json: { draft_text: "Hola, tienes un saldo pendiente de USD 40.00." } });
    }
    if (path === "/api/invoices/invoice-one/reminder/send") {
      reminderState.sent = route.request().postDataJSON(); reminderState.sendCount++;
      if (reminderState.holdSend) await new Promise<void>(resolve => { reminderState.releaseSend = resolve; });
      return route.fulfill(reminderState.failSend ? { status: 502, json: { message: "El proveedor no confirmó el envío" } } : { json: { reminder: { sent_at: "2026-09-23" } } });
    }
    if (path.endsWith("/hacienda-validate")) return route.fulfill({ json: { valid: false, issues: Array.from({ length: 12 }, (_, i) => ({ field: `Campo ${i}`, message: "Revisa los datos del receptor y la dirección fiscal antes de continuar.", severity: "error" })), ai_review: "Revisión extensa ".repeat(30) } });
    if (path.endsWith("/hacienda-error-explain")) return route.fulfill({ json: { technical_message: "Detalle técnico completo ".repeat(40), plain_explanation: "Revisa el comprobante y corrige los datos de identificación. ".repeat(30), suggested_fix: "Actualiza la información del receptor." } });
    if (path.endsWith("/xml-preview")) return route.fulfill({ json: { xml: `<Factura>${"ContenidoLargoSinEspacios".repeat(100)}</Factura>` } });
    if (path === "/api/invoices/contacts") {
      if (state.failContacts) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      const next = url.searchParams.get("page") === "2" || !!url.searchParams.get("q");
      return route.fulfill({ json: { data: [next ? { id: "client-21", full_name: "Cliente número veintiuno", company_name: "Empresa de prueba" } : invoice.contact], meta: { total: 21, page: next ? 2 : 1, pages: 2 } } });
    }
    if (path === "/api/inventory/products") return route.fulfill({ json: { data: [{ id: "product-one", name: "Servicio de instalación", unit_price: "120.50", sku: "SRV-1", cabys_code: "1234567890123" }] } });
    if (path.includes("cabys")) return route.fulfill(state.failCabys ? { status: 503, json: { message: "Unavailable" } } : { json: [{ codigo: "1234567890123", descripcion: "Servicio de instalación", impuesto: "13" }] });
    if (path === "/api/invoices/invoice-one" || path === "/api/invoices/invoice-one/credit-note") {
      state.actionCount++;
      state.actionPayload = route.request().postDataJSON();
      if (state.holdAction) await new Promise<void>(resolve => { state.releaseAction = resolve; });
      return route.fulfill(state.failAction ? { status: 400, json: { message: "Operación rechazada. Vuelve a intentar." } } : { json: invoice });
    }
    if (path === "/api/invoices") {
      if (route.request().method() === "POST") {
        state.created = route.request().postDataJSON();
        return route.fulfill(state.failCreate ? { status: 400, json: { message: "Número duplicado" } } : { json: { ...invoice, ...state.created } });
      }
      if (state.failList) return route.fulfill({ status: 503, json: { message: "Unavailable" } });
      const q = url.searchParams.get("q");
      const currentPage = Number(url.searchParams.get("page") ?? 1);
      return route.fulfill({ json: { data: q ? [{ ...invoice, number: "F-023" }] : currentPage === 2 ? [{ ...invoice, number: "F-021" }] : [invoice, { ...invoice, id: "invoice-two", number: "F-002", currency: "CRC", amount: "100000", amount_paid: 60000, balance_due: 40000 }], meta: { total: q ? 1 : 23, page: currentPage, pages: q ? 1 : 2, limit: 20 } } });
    }
    if (path === "/api/invoices/invoice-one/payments") {
      state.payment = route.request().postDataJSON();
      if (state.failPayment) return route.fulfill({ status: 400, json: { message: "Revisa el pago" } });
      invoice.amount_paid = 100; invoice.balance_due = 0; invoice.status = "PAID";
      return route.fulfill({ json: { invoice } });
    }
    return route.fulfill({ status: 404, json: { message: "Not provided by isolated invoice fixture" } });
  });
  return { user, state, requests, invoice, reminderState };
}

test("invoice cards retain currencies, complete totals, pagination and server search", async ({ page }) => {
  const fixture = await invoiceFixture(page);
  await page.goto("/mobile-test/invoices");
  const card = page.getByRole("article", { name: "Factura F-001", exact: true });
  await expect(card).toContainText("USD 40.00");
  await expect(page.getByRole("article", { name: "Factura F-002", exact: true })).toContainText("CRC 40,000.00");
  await expect(page.getByRole("status").filter({ hasText: "23 facturas" })).toBeVisible();
  await page.screenshot({ path: ".design-reference/invoices-mobile.png", scale: "css" });
  await page.getByRole("button", { name: "Siguiente", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("article", { name: "Factura F-021" })).toBeVisible();
  await page.getByLabel("Buscar factura o contacto").fill("F-023");
  await page.getByRole("button", { name: "Buscar facturas" }).click();
  await expect(page.getByRole("article", { name: "Factura F-023" })).toBeVisible();
  expect(fixture.requests.some(url => url.searchParams.get("q") === "F-023" && url.searchParams.get("page") === "1")).toBe(true);
  await page.reload();
  await expect(page.getByLabel("Buscar factura o contacto")).toHaveValue("F-023");
});

test("billing creates an invoice using scoped client search and retains failed input", async ({ page }) => {
  const fixture = await invoiceFixture(page, "BILLING"); fixture.state.failContacts = true; fixture.state.failCreate = true;
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("button", { name: "Nueva factura", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Nueva factura", exact: true });
  await expect(dialog.getByRole("heading", { name: "Nueva factura" })).toBeFocused();
  await expect(dialog.getByText("No se pudieron cargar los clientes.")).toBeVisible();
  fixture.state.failContacts = false;
  await dialog.getByRole("button", { name: "Reintentar clientes" }).click();
  await dialog.getByRole("button", { name: "Más clientes" }).click();
  await dialog.getByRole("button", { name: "Cliente número veintiuno Empresa de prueba" }).click();
  await dialog.locator("#invoice-number").fill("F-NUEVA");
  await dialog.locator("#invoice-amount").fill("19.95");
  await dialog.locator("#invoice-due_date").fill("2026-12-31");
  await dialog.getByRole("button", { name: "Crear factura", exact: true }).click();
  await expect(dialog.getByText("No se pudo crear la factura. Revisa los datos y vuelve a intentar.")).toBeVisible();
  await expect(dialog.locator("#invoice-number")).toHaveValue("F-NUEVA");
  fixture.state.failCreate = false;
  await dialog.getByRole("button", { name: "Crear factura", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(fixture.state.created).toMatchObject({ contact_id: "client-21", number: "F-NUEVA", amount: 19.95, currency: "USD" });
  expect(fixture.requests.some(url => url.pathname === "/api/contacts")).toBe(false);
});

test("invoice creation protects drafts and restores a clean form after discard", async ({ page }) => {
  await invoiceFixture(page);
  await page.goto("/mobile-test/invoices");
  await page.getByRole("button", { name: "Nueva factura", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva factura", exact: true });
  await dialog.locator("#invoice-number").fill("BORRADOR");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  await expect(dialog.locator("#invoice-number")).toHaveValue("BORRADOR");
  await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
  await dialog.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Nueva factura", exact: true }).click();
  await expect(dialog.locator("#invoice-number")).toHaveValue("");
});

test("fiscal creation supports keyboard lookup, retry and large text at 320px", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.state.failCabys = true;
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  await page.getByRole("button", { name: "Nueva factura", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nueva factura", exact: true });
  await dialog.getByLabel("Modo", { exact: true }).click();
  await page.getByRole("option", { name: "Hacienda", exact: true }).click();
  await dialog.getByLabel("Producto de inventario", { exact: true }).fill("instalar");
  const product = dialog.getByRole("button", { name: /Servicio de instalación SRV-1/ });
  await product.focus(); await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Detalle línea", { exact: true })).toHaveValue("Servicio de instalación");
  await dialog.getByLabel("CABYS", { exact: true }).fill("servicio");
  await expect(dialog.getByText("No se pudo consultar CABYS.")).toBeVisible();
  fixture.state.failCabys = false;
  await dialog.getByRole("button", { name: "Reintentar CABYS" }).click();
  const cabys = dialog.getByRole("button", { name: /1234567890123 Servicio de instalación/ });
  await cabys.focus(); await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("CABYS", { exact: true })).toHaveValue("1234567890123");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await dialog.locator("fieldset").first().evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByLabel("Modo", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".design-reference/invoice-create-small.png", scale: "css" });
});

test("invoice errors stay distinct from empty results and allow retry", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.state.failList = true;
  await page.goto("/mobile-test/invoices");
  await expect(page.getByRole("alert")).toContainText("No se pudieron cargar");
  await expect(page.getByText("Sin facturas", { exact: true })).toHaveCount(0);
  fixture.state.failList = false;
  await page.getByRole("button", { name: "Reintentar", exact: true }).click();
  await expect(page.getByRole("article", { name: "Factura F-001", exact: true })).toBeVisible();
});

test("invoice cancellation keeps confirmation open during pending and failed requests", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.state.failAction = true; fixture.state.holdAction = true;
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Cancelar factura", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Cancelar factura", exact: true });
  await expect(dialog.getByRole("button", { name: "Volver" })).toBeFocused();
  expect(fixture.state.actionCount).toBe(0);
  await dialog.getByRole("button", { name: "Sí, cancelar factura" }).click();
  await expect(dialog.getByRole("button", { name: "Procesando…" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect.poll(() => fixture.state.releaseAction !== null).toBe(true);
  fixture.state.releaseAction!();
  await expect(dialog.getByRole("alert")).toContainText("Operación rechazada");
  expect(fixture.state.actionCount).toBe(1);
  fixture.state.failAction = fixture.state.holdAction = false;
  await dialog.getByRole("button", { name: "Sí, cancelar factura" }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.actionCount).toBe(2);
  expect(fixture.state.actionPayload).toEqual({ status: "CANCELLED" });
  await expect(trigger).toBeFocused();
});

test("invoice edits preserve timestamps, clear optional values and retain failed changes", async ({ page }) => {
  const fixture = await invoiceFixture(page, "BILLING"); fixture.state.failAction = true;
  Object.assign(fixture.invoice, { description: "Texto anterior", issue_date: "2026-09-15T17:42:12Z", activity_code: "123", sale_condition: "01", payment_method: "01" });
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar factura", exact: true });
  await expect(dialog.getByRole("heading", { name: "Editar factura", exact: true })).toBeFocused();
  await expect(dialog.getByLabel("Moneda", { exact: true })).toBeDisabled();
  await expect(dialog.getByText("Cliente de prueba", { exact: true })).toBeVisible();
  await dialog.getByLabel("Descripción", { exact: true }).fill("");
  await dialog.getByLabel("Actividad", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Operación rechazada");
  await expect(dialog.getByLabel("Descripción", { exact: true })).toHaveValue("");
  fixture.state.failAction = false;
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.actionPayload).toEqual({ description: "", activity_code: null });
  await expect(trigger).toBeFocused();
  expect(fixture.requests.some(url => url.pathname === "/api/contacts")).toBe(false);
});

test("editing on a small phone protects changes and supports scoped client replacement", async ({ page }) => {
  const fixture = await invoiceFixture(page, "BILLING");
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  await page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" }).click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Editar factura", exact: true });
  await dialog.getByRole("button", { name: "Cambiar cliente" }).click();
  await dialog.getByLabel("Buscar por nombre o empresa").fill("veintiuno");
  await dialog.getByRole("button", { name: "Buscar cliente", exact: true }).click();
  await dialog.getByRole("button", { name: "Cliente número veintiuno Empresa de prueba" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await dialog.getByLabel("Número", { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".design-reference/invoice-edit-small.png", scale: "css" });
  await dialog.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.actionPayload).toEqual({ contact_id: "client-21" });
});

test("deletion requires confirmation and returns focus to the invoice heading", async ({ page }) => {
  const fixture = await invoiceFixture(page);
  await page.goto("/mobile-test/invoices");
  await page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" }).click();
  await page.getByRole("menuitem", { name: "Eliminar", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Eliminar factura", exact: true });
  expect(fixture.state.actionCount).toBe(0);
  await expect(dialog).toContainText("F-001");
  await dialog.getByRole("button", { name: "Eliminar factura", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Facturas", exact: true })).toBeFocused();
  expect(fixture.state.actionCount).toBe(1);
});

test("credit note confirmation includes its required client and permits correcting the number", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.issuance_mode = "HACIENDA"; fixture.invoice.hacienda_status = "ACEPTADO";
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  await page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" }).click();
  await expect(page.getByRole("menuitem", { name: "Eliminar", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Nota de crédito", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: "Crear nota de crédito", exact: true });
  await dialog.getByLabel("Número de la nota").fill("NC-002");
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/invoice-credit-confirm.png", scale: "css" });
  await dialog.getByRole("button", { name: "Crear borrador" }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.actionPayload).toMatchObject({ number: "NC-002", contact_id: "contact-one", amount: 100, currency: "USD" });
});

test("payments require review, reject excessive amounts and retain failed input", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.state.failPayment = true;
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" });
  await trigger.click();
  await page.getByRole("menuitem", { name: "Saldar", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Registrar pago" });
  const amount = dialog.getByLabel("Monto abonado", { exact: false });
  await expect(amount).toHaveValue("40.00");
  expect(fixture.state.payment).toBeNull();
  await amount.fill("45");
  await dialog.getByRole("button", { name: "Guardar pago" }).click();
  expect(fixture.state.payment).toBeNull();
  await amount.fill("40");
  await dialog.getByLabel("Referencia", { exact: true }).fill("Transferencia 17");
  await dialog.getByRole("button", { name: "Guardar pago" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.getByLabel("Referencia", { exact: true })).toHaveValue("Transferencia 17");
  fixture.state.failPayment = false;
  await dialog.getByRole("button", { name: "Guardar pago" }).click();
  await expect(dialog).toHaveCount(0);
  expect(fixture.state.payment).toMatchObject({ amount: 40, currency: "USD", reference: "Transferencia 17" });
  await expect(trigger).toBeFocused();
});

test("invoice role restrictions avoid denied API calls", async ({ page }) => {
  const fixture = await invoiceFixture(page, "VIEWER");
  await page.goto("/mobile-test/invoices");
  await expect(page.getByText("Tu rol no tiene acceso a facturación.")).toBeVisible();
  expect(fixture.requests.some(url => url.pathname.startsWith("/api/invoices"))).toBe(false);
  fixture.user.role = "BILLING";
  await page.reload();
  await expect(page.getByRole("article", { name: "Factura F-001", exact: true })).toBeVisible();
  expect(fixture.requests.some(url => url.pathname === "/api/contacts" || url.pathname === "/api/channels")).toBe(false);
});

test("invoices and detail fit 320px with large text and keyboard focus restoration", async ({ page }) => {
  const fixture = await invoiceFixture(page);
  fixture.invoice.contact.full_name = "Distribuidora de productos y servicios del barrio central";
  fixture.invoice.payments = Array.from({ length: 7 }, (_, i) => ({ id: `payment-${i}`, amount: 10, paid_at: "2026-09-15", method: "Transferencia interbancaria de referencia larga" })) as any;
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Ver", exact: true });
  await expect(trigger).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/invoices-small-large-text.png", scale: "css" });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Detalle de factura" })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Detalle de factura" });
  await expect(dialog.getByText("Transferencia interbancaria de referencia larga", { exact: true })).toHaveCount(7);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});


test("reminders retain edits through generation and send errors and block duplicate pending sends", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.status = "OVERDUE";
  fixture.reminderState.failGenerate = true;
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" });
  await trigger.click(); await page.getByRole("menuitem", { name: "Redactar cobro" }).click();
  const dialog = page.getByRole("dialog", { name: "Recordatorio de pago" });
  await expect(dialog.getByRole("heading", { name: "Recordatorio de pago" })).toBeFocused();
  await expect(dialog.getByRole("alert")).toContainText("No se pudo preparar");
  await dialog.getByLabel("Borrador del recordatorio").fill("Mi recordatorio revisado");
  fixture.reminderState.failGenerate = false;
  await dialog.getByRole("button", { name: "Reintentar borrador" }).click();
  await expect(dialog.getByRole("button", { name: "Enviar recordatorio", exact: true })).toBeEnabled();
  await expect(dialog.getByLabel("Borrador del recordatorio")).toHaveValue("Mi recordatorio revisado");
  await expect(dialog.getByLabel("Canal de envío").locator("option")).toHaveCount(1);
  await expect(dialog).toContainText("client@example.invalid");
  fixture.reminderState.failSend = fixture.reminderState.holdSend = true;
  await dialog.getByRole("button", { name: "Enviar recordatorio", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Enviando…" })).toBeDisabled();
  await expect(dialog.getByLabel("Borrador del recordatorio")).toBeDisabled();
  await page.keyboard.press("Escape"); await expect(dialog).toBeVisible();
  await expect.poll(() => fixture.reminderState.releaseSend !== null).toBe(true);
  fixture.reminderState.releaseSend!();
  await expect(dialog.getByRole("alert")).toContainText("El proveedor no confirmó");
  fixture.reminderState.failSend = fixture.reminderState.holdSend = false;
  await dialog.getByRole("button", { name: "Enviar recordatorio", exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  expect(fixture.reminderState.sendCount).toBe(2);
  expect(fixture.reminderState.sent).toEqual({ channel_id: "mail-one", draft_text: "Mi recordatorio revisado" });
});

test("reminder channels distinguish errors from no compatible recipient", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.status = "OVERDUE"; fixture.reminderState.failChannels = true;
  fixture.invoice.contact.email = "";
  await page.goto("/mobile-test/invoices");
  await page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" }).click();
  await page.getByRole("menuitem", { name: "Redactar cobro" }).click();
  const dialog = page.getByRole("dialog", { name: "Recordatorio de pago" });
  await expect(dialog.getByRole("alert")).toContainText("No se pudieron cargar los canales");
  fixture.reminderState.failChannels = false;
  await dialog.getByRole("button", { name: "Reintentar canales" }).click();
  await expect(dialog.getByText(/No hay canales activos compatibles/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Enviar recordatorio", exact: true })).toBeDisabled();
  expect(fixture.reminderState.sendCount).toBe(0);
});

test("small-phone reminders protect drafts and disclose WhatsApp template delivery", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.status = "OVERDUE";
  Object.assign(fixture.invoice.contact, { phone: "+50688888888" });
  await page.addInitScript(() => localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true })));
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  await page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" }).click();
  await page.getByRole("menuitem", { name: "Redactar cobro" }).click();
  const dialog = page.getByRole("dialog", { name: "Recordatorio de pago" });
  await expect(dialog.getByLabel("Borrador del recordatorio")).toHaveValue(/saldo pendiente/);
  await dialog.getByLabel("Canal de envío").selectOption("wa-one");
  await expect(dialog.getByText(/WhatsApp envía la plantilla/)).toBeVisible();
  await dialog.getByLabel("Borrador del recordatorio").fill("Cambios sin enviar");
  await page.keyboard.press("Escape");
  await expect(dialog.getByRole("button", { name: "Seguir editando" })).toBeFocused();
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  await dialog.getByLabel("Canal de envío").scrollIntoViewIfNeeded();
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: ".design-reference/invoice-reminder-small.png", scale: "css" });
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await dialog.getByRole("button", { name: "Descartar cambios" }).click();
  await expect(dialog).toHaveCount(0);
});

test("closing during draft generation cannot reopen the reminder or change another dialog", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.status = "OVERDUE"; fixture.reminderState.holdGenerate = true;
  await page.goto("/mobile-test/invoices");
  const card = page.getByRole("article", { name: "Factura F-001", exact: true });
  await card.getByRole("button", { name: "Acciones de F-001" }).click();
  await page.getByRole("menuitem", { name: "Redactar cobro" }).click();
  const reminder = page.getByRole("dialog", { name: "Recordatorio de pago" });
  await expect(reminder.getByRole("status").filter({ hasText: "Preparando borrador" })).toBeVisible();
  await reminder.getByRole("button", { name: "Cancelar", exact: true }).click();
  await card.getByRole("button", { name: "Ver", exact: true }).click();
  await expect.poll(() => fixture.reminderState.releaseGenerate !== null).toBe(true);
  const response = page.waitForResponse(url => url.url().endsWith("/reminder"));
  fixture.reminderState.releaseGenerate!(); await response;
  await expect(reminder).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Detalle de factura" })).toBeVisible();
});

test("fiscal dialogs handle long content, clipboard denial and focus on a small phone", async ({ page }) => {
  const fixture = await invoiceFixture(page); fixture.invoice.issuance_mode = "HACIENDA"; fixture.invoice.hacienda_status = "RECHAZADO";
  Object.assign(fixture.invoice, { hacienda_last_error: "Validación rechazada" });
  await page.addInitScript(() => {
    localStorage.setItem("pymes-display:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222", JSON.stringify({ largeText: true, reducedMotion: true }));
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async () => { throw new Error("Permission denied"); } } });
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/mobile-test/invoices");
  const trigger = page.getByRole("article", { name: "Factura F-001", exact: true }).getByRole("button", { name: "Acciones de F-001" });
  for (const [action, title] of [["Validar MH", "Validación Hacienda"], ["Error MH", "Error de Hacienda explicado"], ["XML", "Vista previa XML"]]) {
    await trigger.click(); await page.getByRole("menuitem", { name: action, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: new RegExp(title) });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: new RegExp(title) })).toBeFocused();
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height <= innerHeight)).toBe(true);
    if (action === "XML") {
      await dialog.getByRole("button", { name: "Copiar XML" }).click();
      await expect(dialog.getByRole("status")).toContainText("No se pudo copiar");
      const download = page.waitForEvent("download");
      await dialog.getByRole("button", { name: "Descargar XML" }).click();
      expect((await download).suggestedFilename()).toBe("factura-electronica.xml");
      await page.screenshot({ path: ".design-reference/invoice-xml-small.png", scale: "css" });
    }
    await page.keyboard.press("Escape"); await expect(trigger).toBeFocused();
  }
  await page.getByText("Herramientas y ayuda fiscal", { exact: true }).click();
  const guideTrigger = page.getByRole("button", { name: "Guía Hacienda", exact: true });
  await guideTrigger.click();
  const guide = page.getByRole("dialog", { name: "Guía de conceptos de facturación y Hacienda" });
  await expect(guide.getByRole("heading")).toBeFocused();
  expect(await guide.evaluate(el => el.scrollWidth <= el.clientWidth && el.getBoundingClientRect().height <= innerHeight)).toBe(true);
  await guide.getByRole("button", { name: "Cerrar ventana", exact: true }).click();
  await expect(guideTrigger).toBeFocused();
});
