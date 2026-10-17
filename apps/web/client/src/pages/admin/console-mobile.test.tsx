import { DEFAULT_MOBILE_CONFIGURATION, MOBILE_HOME_CATEGORY_CONTROLS, type MobileConfiguration } from "@pymeshub/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "@/lib/admin";
import { mobileAdminApi } from "@/lib/mobile-admin";
import { MobileAppTab } from "./console-mobile";

vi.mock("@/lib/admin", () => ({ adminApi: { categories: vi.fn() } }));
vi.mock("@/lib/marketplace", () => ({ MARKETPLACE_API_URL: "https://api.example.test" }));
vi.mock("@/lib/mobile-admin", () => ({ mobileAdminApi: { draft: vi.fn(), history: vi.fn(), preview: vi.fn(), save: vi.fn(), publish: vi.fn(), restore: vi.fn(), discard: vi.fn(), upload: vi.fn(), destinations: vi.fn() } }));

const configuration: MobileConfiguration = { ...DEFAULT_MOBILE_CONFIGURATION, hiddenCategoryIds: ["cat_food"] };
const reply = (canPublish = false, draft: MobileConfiguration | null = configuration, version = 1) => ({ version, draft, canPublish, published: { revisionId: null, revision: 0, publishedAt: null, configuration: DEFAULT_MOBILE_CONFIGURATION } });
function setup(canPublish = false, draft = configuration) {
	vi.mocked(mobileAdminApi.draft).mockResolvedValue(reply(canPublish, draft));
	const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
	render(<QueryClientProvider client={client}><MobileAppTab /></QueryClientProvider>);
	return client;
}
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(adminApi.categories).mockResolvedValue([{ id: "cat_food", slug: "food", name: "Comida", nameEn: "Food", iconName: null, imageUrl: null, parentId: null, sortOrder: 0 }]);
	vi.mocked(mobileAdminApi.history).mockResolvedValue({ items: [], next: undefined });
	vi.mocked(mobileAdminApi.preview).mockResolvedValue({ shops: [], products: [], orders: [], couriers: [] });
});

describe("App móvil draft console", () => {
	it("hides all home shortcuts, then saves only Food for the first rollout phase", async () => {
		const user = userEvent.setup();
		setup();
		const section = await screen.findByRole("region", { name: "Categorías de inicio" });
		within(section).getByRole("button", { name: "Ocultar todas" }).focus();
		await user.keyboard("{Enter}");
		for (const toggle of within(section).getAllByRole("switch")) expect(toggle).not.toBeChecked();
		within(section).getByRole("switch", { name: "Mostrar Comida en Inicio" }).focus();
		await user.keyboard(" ");
		expect(within(section).getByRole("switch", { name: "Mostrar Comida en Inicio" })).toBeChecked();
		expect(within(section).getAllByRole("switch").filter((toggle) => toggle.getAttribute("aria-checked") === "true")).toHaveLength(1);
		const visibility = Object.fromEntries(MOBILE_HOME_CATEGORY_CONTROLS.map((control) => [control.id, control.label.es === "Comida"]));
		const next = { ...configuration, visibility: { ...visibility, categories: true } };
		vi.mocked(mobileAdminApi.save).mockResolvedValue(reply(false, next, 2));
		fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
		await waitFor(() => expect(mobileAdminApi.save).toHaveBeenCalledWith({ expectedVersion: 1, configuration: next }, expect.anything()));
		const preview = screen.getByLabelText("Categorías de inicio en la vista previa");
		expect(preview).toHaveTextContent("Comida");
		expect(preview).not.toHaveTextContent("Supermercado");
		expect(preview).not.toHaveTextContent("Ver más");
		expect(mobileAdminApi.publish).not.toHaveBeenCalled();
	});
	it("enabling one shortcut after globally hiding categories does not enable the others", async () => {
		setup(false, { ...configuration, visibility: { categories: false } });
		const section = await screen.findByRole("region", { name: "Categorías de inicio" });
		fireEvent.click(within(section).getByRole("switch", { name: "Mostrar Comida en Inicio" }));
		expect(screen.getByRole("switch", { name: "Explorar categorías" })).toBeChecked();
		expect(within(section).getAllByRole("switch").filter((toggle) => toggle.getAttribute("aria-checked") === "true")).toHaveLength(1);
		fireEvent.click(within(section).getByRole("switch", { name: "Mostrar Supermercado en Inicio" }));
		expect(within(section).getAllByRole("switch").filter((toggle) => toggle.getAttribute("aria-checked") === "true")).toHaveLength(2);
		fireEvent.click(within(section).getByRole("button", { name: "Mostrar todas" }));
		for (const toggle of within(section).getAllByRole("switch")) expect(toggle).toBeChecked();
	});
	it("lets general admins edit private drafts but gives no publish or restore permission", async () => {
		setup();
		const categories = await screen.findByRole("switch", { name: "Explorar categorías" });
		expect(screen.getByRole("button", { name: "Publicar" })).toBeDisabled();
		fireEvent.click(categories);
		vi.mocked(mobileAdminApi.save).mockResolvedValue(reply(false, { ...configuration, visibility: { categories: false } }, 2));
		fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
		await waitFor(() => expect(mobileAdminApi.save).toHaveBeenCalledWith({ expectedVersion: 1, configuration: { ...configuration, visibility: { categories: false } } }, expect.anything()));
		expect(mobileAdminApi.publish).not.toHaveBeenCalled();
	});
	it("global category hiding retains individual visibility choices for restoration", async () => {
		setup();
		const global = await screen.findByRole("switch", { name: "Explorar categorías" });
		fireEvent.click(global);
		fireEvent.click(screen.getByText("Categorías individuales", { selector: "summary" }));
		expect(screen.getByRole("switch", { name: "Mostrar Comida en la app" })).not.toBeChecked();
		fireEvent.click(global);
		expect(screen.getByRole("switch", { name: "Mostrar Comida en la app" })).not.toBeChecked();
		expect(adminApi.categories).toHaveBeenCalledTimes(1);
	});
	it("requires explicit confirmation and a reason to publish a saved draft", async () => {
		setup(true);
		const publish = await screen.findByRole("button", { name: "Publicar" });
		await waitFor(() => expect(publish).not.toBeDisabled());
		fireEvent.click(publish);
		const dialog = screen.getByRole("alertdialog");
		expect(within(dialog).getByRole("button", { name: "Publicar" })).toBeDisabled();
		fireEvent.change(within(dialog).getByLabelText("Motivo"), { target: { value: "Ocultar categorías en móvil" } });
		vi.mocked(mobileAdminApi.publish).mockResolvedValue({ ...reply(true, null, 2), published: { revisionId: "mcr_1", revision: 1, publishedAt: "2026-01-01T00:00:00Z", configuration } });
		fireEvent.click(within(dialog).getByRole("button", { name: "Publicar" }));
		await waitFor(() => expect(mobileAdminApi.publish).toHaveBeenCalledWith({ expectedVersion: 1, reason: "Ocultar categorías en móvil" }, expect.anything()));
	});
	it("does not overwrite unsaved edits when another admin changes the draft", async () => {
		const client = setup(true);
		fireEvent.click(await screen.findByRole("switch", { name: "Explorar categorías" }));
		vi.mocked(mobileAdminApi.draft).mockResolvedValue(reply(true, DEFAULT_MOBILE_CONFIGURATION, 2));
		await client.invalidateQueries({ queryKey: ["admin", "mobile", "draft"] });
		await screen.findByText(/Otra persona cambió la configuración/);
		expect(screen.getByRole("switch", { name: "Explorar categorías" })).not.toBeChecked();
		expect(screen.getByRole("button", { name: "Guardar borrador" })).toBeDisabled();
	});
	it("searches controls locally without changing visibility", async () => {
		setup(); await screen.findByRole("switch", { name: "Explorar categorías" });
		fireEvent.change(screen.getByLabelText("Buscar control"), { target: { value: "Aceptar nuevas entregas" } });
		expect(screen.getByRole("switch", { name: "Aceptar nuevas entregas" })).toBeChecked();
		expect(screen.queryByRole("switch", { name: "Explorar categorías" })).toBeNull();
		expect(mobileAdminApi.save).not.toHaveBeenCalled();
	});
});
