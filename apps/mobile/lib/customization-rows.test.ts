import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { moveItem } from "./reorder";

const ROOT = join(import.meta.dir, "..");
const board = readFileSync(
	join(ROOT, "components", "customization-rows.tsx"),
	"utf8",
);
const shopScreen = readFileSync(
	join(ROOT, "app", "(business)", "customize-shop.tsx"),
	"utf8",
);
const dashScreen = readFileSync(
	join(ROOT, "app", "(business)", "customize-dashboard.tsx"),
	"utf8",
);

function exportedFn(source: string, name: string): string {
	const start = source.indexOf(`export function ${name}`);
	if (start < 0) throw new Error(`missing ${name}`);
	const nextExport = source.indexOf("\nexport function ", start + 1);
	const styles = source.indexOf("\nconst styles", start + 1);
	const end = Math.min(
		nextExport === -1 ? source.length : nextExport,
		styles === -1 ? source.length : styles,
	);
	return source.slice(start, end);
}

function idBranch(fn: string, id: string): string {
	const start = fn.indexOf(`if (id === "${id}")`);
	if (start < 0) throw new Error(`missing branch ${id}`);
	const brace = fn.indexOf("{", start);
	let depth = 0;
	for (let i = brace; i < fn.length; i++) {
		if (fn[i] === "{") depth += 1;
		else if (fn[i] === "}") {
			depth -= 1;
			if (depth === 0) return fn.slice(start, i + 1);
		}
	}
	throw new Error(`unclosed branch ${id}`);
}

function fallbackReturn(fn: string): string {
	const start = fn.lastIndexOf("\n\treturn (");
	if (start < 0) throw new Error("missing fallback return");
	return fn.slice(start);
}

describe("reorder helper", () => {
	test("the board swaps neighbours through the shipped moveItem", () => {
		expect(board).toContain('from "@/lib/reorder"');
		expect(board).toContain(
			"onReorder(moveItem(items, items.indexOf(item), direction, hidden))",
		);
		expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
		expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
		expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
	});

	test("a drag skips a hidden mid-item so the visible order actually changes", () => {
		const items = ["a", "b", "c"];
		const hidden = ["b"];
		const visible = (list: readonly string[]) =>
			list.filter((id) => !hidden.includes(id));

		const cUp = moveItem(items, items.indexOf("c"), -1, hidden);
		expect(visible(cUp)).toEqual(["c", "a"]);
		expect(cUp).toContain("b");
		expect(cUp).toHaveLength(items.length);

		const aDown = moveItem(items, items.indexOf("a"), 1, hidden);
		expect(visible(aDown)).toEqual(["c", "a"]);
		expect(aDown).toContain("b");
		expect(aDown).toHaveLength(items.length);
	});
});

describe("personalization board", () => {
	test("a tap opens a tile and compact/detailed are two pictures", () => {
		expect(board).toContain("Gesture.Tap()");
		expect(board).toContain("export function DensityToggle");
		expect(exportedFn(board, "DensityToggle")).toContain(
			't("customize.density.compact")',
		);
		expect(exportedFn(board, "DensityToggle")).toContain(
			't("customize.density.detailed")',
		);
		expect(board).toContain(
			"{selected === item ? renderToolbar?.(item) : null}",
		);
		expect(board).toContain("export function PaletteChip");
	});

	test("holds to edit, jiggles, X removes, and + wells add hidden blocks", () => {
		expect(board).toContain("Gesture.LongPress()");
		expect(board).toContain("Gesture.Pan()");
		expect(board).toContain("withRepeat");
		expect(board).toContain('accessibilityLabel={t("customize.remove")}');
		expect(board).toContain("×");
		expect(board).toContain("styles.addWell");
		expect(board).toContain('borderStyle: "dashed"');
		expect(board).toContain('t("customize.addWidget"');
		expect(board).toContain(
			"!canHide || canHide(item) ? () => onToggle(item) : undefined",
		);
		expect(board).toContain('name: "moveUp", label: t("customize.up")');
		expect(board).toContain('name: "moveDown", label: t("customize.down")');
		expect(board).not.toContain('t("customize.show")');
		expect(board).toContain('name: "hide", label: t("customize.hide")');
	});
});

describe("visual variations", () => {
	test("shop information, offers, and featured use different sketches", () => {
		const shop = exportedFn(board, "ShopSectionPreview");
		const information = idBranch(shop, "information");
		const offers = idBranch(shop, "offers");
		const featured = fallbackReturn(shop);

		expect(information).toContain("styles.avatar");
		expect(offers).not.toContain("styles.avatar");
		expect(featured).not.toContain("styles.avatar");

		expect(offers).toContain("styles.pill");
		expect(information).not.toContain("styles.pill");
		expect(featured).not.toContain("styles.pill");

		expect(featured).toContain("styles.productTile");
		expect(information).not.toContain("styles.productTile");
		expect(offers).not.toContain("styles.productTile");
	});

	test("dashboard shortcuts, pulse, insights, and catalog use different sketches", () => {
		const dash = exportedFn(board, "DashboardWidgetPreview");
		const shortcuts = idBranch(dash, "shortcuts");
		const pulse = idBranch(dash, "pulse");
		const insights = idBranch(dash, "insights");
		const catalog = fallbackReturn(dash);

		expect(shortcuts).toContain("styles.shortcut");
		expect(pulse).not.toContain("styles.shortcut");
		expect(insights).not.toContain("styles.shortcut");
		expect(catalog).not.toContain("styles.shortcut");

		expect(pulse).toContain("styles.metric");
		expect(shortcuts).not.toContain("styles.metric");
		expect(insights).not.toContain("styles.metric");
		expect(catalog).not.toContain("styles.metric");

		expect(insights).toContain('width: "88%"');
		expect(shortcuts).not.toContain('width: "88%"');
		expect(pulse).not.toContain('width: "88%"');
		expect(catalog).not.toContain('width: "88%"');

		expect(catalog).toContain("styles.thumb");
		expect(shortcuts).not.toContain("styles.thumb");
		expect(pulse).not.toContain("styles.thumb");
		expect(insights).not.toContain("styles.thumb");
	});

	test("attention, queue, and commands use sketches the four original widgets do not", () => {
		const dash = exportedFn(board, "DashboardWidgetPreview");
		const attention = idBranch(dash, "attention");
		const queue = idBranch(dash, "queue");
		const commands = idBranch(dash, "commands");

		expect(attention).toContain("styles.attentionRail");
		expect(attention).toContain("styles.chip");
		expect(queue).not.toContain("styles.attentionRail");
		expect(commands).not.toContain("styles.attentionRail");

		expect(queue).toContain("styles.queueRow");
		expect(queue).toContain("styles.queueCompact");
		expect(attention).not.toContain("styles.queueRow");
		expect(commands).not.toContain("styles.queueRow");

		expect(commands).toContain("styles.commandRail");
		expect(commands).toContain("styles.commandDot");
		expect(attention).not.toContain("styles.commandRail");
		expect(queue).not.toContain("styles.commandRail");
	});

	test("pulse, catalog, and shortcut sketches change with the chosen layout", () => {
		const dash = exportedFn(board, "DashboardWidgetPreview");
		expect(idBranch(dash, "pulse")).toContain('layout === "cards"');
		expect(idBranch(dash, "pulse")).toContain('layout === "hero"');
		expect(idBranch(dash, "pulse")).toContain('layout === "stack"');
		expect(idBranch(dash, "pulse")).toContain("styles.pulseBand");
		expect(idBranch(dash, "pulse")).toContain("styles.pulseHero");
		expect(idBranch(dash, "pulse")).toContain("styles.pulseStackRow");
		expect(idBranch(dash, "shortcuts")).toContain('layout === "grid"');
		expect(idBranch(dash, "shortcuts")).toContain('layout === "list"');
		expect(idBranch(dash, "queue")).toContain('layout === "cards"');
		expect(idBranch(dash, "commands")).toContain('layout === "stack"');
		expect(dash).toContain('layout === "rail"');
		expect(board).toContain("export function WidgetLayoutPicker");
		expect(idBranch(dash, "insights")).toContain('layout === "stack"');
		expect(dash).toContain('layout === "tiles"');
	});

	test("product count and theme are pictures rather than text-only buttons", () => {
		expect(board).toContain("export function ProductCountPicker");
		expect(board).toContain("export function ThemeSwatchPicker");
		expect(exportedFn(board, "ProductCountPicker")).toContain(
			"styles.countThumb",
		);
		expect(exportedFn(board, "ThemeSwatchPicker")).toContain(
			"styles.themeWash",
		);
		expect(exportedFn(board, "ThemeSwatchPicker")).toContain(
			"businessThemeColors",
		);
	});

	test("each widget can pick a named palette well", () => {
		expect(board).toContain("export function WidgetPaletteStrip");
		expect(exportedFn(board, "WidgetPaletteStrip")).toContain(
			"styles.paletteDot",
		);
		expect(exportedFn(board, "WidgetPaletteStrip")).toContain(
			't("customize.paintInherit")',
		);
		expect(exportedFn(board, "WidgetPaletteStrip")).toContain(
			"businessThemeOrder()",
		);
	});

	test("cover and compact are two different header pictures", () => {
		const header = exportedFn(board, "HeaderStylePicker");
		expect(header).toContain("styles.coverSketch");
		expect(header).toContain("styles.compactSketch");
		expect(header).toContain("LinearGradient");
		expect(header).toContain("styles.logoDotSmall");
		expect(header).not.toContain('variant="secondary"');
		expect(board).toContain("coverSketch: {\n\t\theight: 72");
		expect(board).toContain("compactSketch: {\n\t\theight: 44");
	});
});

describe("customize screens", () => {
	test("shop board gets section sketches and writes sections plus hidden", () => {
		expect(shopScreen).toContain("<CustomizationRows");
		expect(shopScreen).toContain(
			"renderPreview={(id) => <ShopSectionPreview id={id} />}",
		);
		expect(shopScreen).toContain(
			"onReorder={(sections) => setDraft({ ...draft, sections })}",
		);
		expect(shopScreen).toContain("hidden: draft.hidden.includes(id)");
		expect(shopScreen).toContain("<HeaderStylePicker");
		expect(shopScreen).toContain(
			"onChange={(header) => setDraft({ ...draft, header })}",
		);
		expect(shopScreen).not.toContain('label={t("customize.cover")}');
		expect(shopScreen).not.toContain('label={t("customize.compact")}');
		expect(shopScreen).toContain("<WidgetPaletteStrip");
		expect(shopScreen).toContain("<Field");
		expect(shopScreen).toContain("brandAccentCheck(draft.accentColor)");
	});

	test("dashboard board gets widget sketches and writes widgets plus hidden", () => {
		expect(dashScreen).toContain("<CustomizationRows");
		expect(dashScreen).toContain(
			"onReorder={(widgets) => setDraft({ ...draft, widgets })}",
		);
		expect(dashScreen).toContain("hidden: hidden(id)");
		expect(dashScreen).toContain("[...draft.hidden, id]");
		expect(dashScreen).toContain("shortcutIds");
		expect(dashScreen).toContain("<ProductCountPicker");
		expect(dashScreen).toContain("<ThemeSwatchPicker");
		expect(dashScreen).toContain("COMPACT_LAYOUTS");
		expect(dashScreen).toContain("DETAILED_LAYOUTS");
		expect(dashScreen).toContain("<DensityToggle");
		expect(dashScreen).toContain("<PulseLayoutPicker");
		expect(board).toContain("export function PulseLayoutPicker");
		expect(dashScreen).toContain("styles.canvas");
		expect(dashScreen).not.toContain("<ScreenSection");
		expect(dashScreen).toContain("resolveDashboardPreferences");
		expect(dashScreen).toContain("SHORTCUT_ICONS");
		expect(dashScreen).not.toContain("ellipse-outline");
		expect(dashScreen).not.toContain('choiceRole="checkbox"');
		expect(dashScreen).toContain("widgetThemes");
		expect(dashScreen).toContain("commandColors");
		expect(dashScreen).toContain("<WidgetPaletteStrip");
		expect(dashScreen).toContain('t("customize.paintAll")');
		expect(dashScreen).toContain('t("customize.paintCommand")');
		expect(dashScreen).toContain('paint={painted ? "accent" : "invert"}');
		expect(dashScreen).toContain('from "@/components/sheet"');
		expect(dashScreen).toContain("<Sheet");
		expect(dashScreen).toContain("renderChip");
		expect(dashScreen).not.toContain("renderToolbar");
		expect(dashScreen).toContain('setEditor({ kind: "widget", id })');
	});
});
