import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const hero = readFileSync(
	join(root, "components", "editorial-hero.tsx"),
	"utf8",
);
const en = readFileSync(
	join(
		root,
		"..",
		"..",
		"packages",
		"i18n",
		"src",
		"messages",
		"en",
		"customer.ts",
	),
	"utf8",
);
const es = readFileSync(
	join(
		root,
		"..",
		"..",
		"packages",
		"i18n",
		"src",
		"messages",
		"es",
		"customer.ts",
	),
	"utf8",
);
const rail = readFileSync(
	join(root, "components", "angled-category-rail.tsx"),
	"utf8",
);
const header = readFileSync(
	join(root, "components", "home-header.tsx"),
	"utf8",
);
const search = readFileSync(
	join(root, "components", "hero-search.tsx"),
	"utf8",
);

describe("editorial hero copy", () => {
	test("keeps the specified line breaks and destinations", () => {
		expect(hero).toContain('t("home.editorial.line1")');
		expect(hero).toContain('t("home.editorial.line2")');
		expect(hero).toContain('t("home.editorial.line3")');
		expect(hero).toContain('t("home.editorial.lede1")');
		expect(hero).toContain('t("home.editorial.sticker1")');
		expect(hero).toContain('router.push("/featured")');
		expect(hero).toContain("hero-bowl.jpg");
		expect(hero).toContain('rotate: "-8deg"');
		expect(hero).toContain("fontSize: 56");
		expect(hero).not.toContain("PymesHub");
	});

	test("pages horizontally through the campaign and live promotions", () => {
		expect(hero).toContain("pagingEnabled");
		expect(hero).toContain("promotions.map");
		expect(hero).toContain("onMomentumScrollEnd");
		expect(hero).toContain("rememberOfferSelection");
	});
});

describe("editorial locale purity", () => {
	test("English campaign strings are English", () => {
		expect(en).toContain('"home.editorial.line1": "Good"');
		expect(en).toContain('"home.editorial.line2": "things"');
		expect(en).toContain('"home.editorial.line3": "nearby"');
		expect(en).toContain('"home.editorial.sticker1": "Support"');
		expect(en).toContain('"home.editorial.cat.comida": "Food"');
		expect(en).not.toContain('"home.editorial.line1": "Lo"');
		expect(en).not.toContain('"home.editorial.sticker1": "Apoyá"');
	});

	test("Spanish campaign strings stay Spanish", () => {
		expect(es).toContain('"home.editorial.line1": "Lo"');
		expect(es).toContain('"home.editorial.line2": "bueno"');
		expect(es).toContain('"home.editorial.sticker1": "Apoyá"');
		expect(es).toContain('"home.editorial.cat.comida": "Comida"');
	});
});

describe("angled category ribbon", () => {
	test("uses the five specified labels and real routes", () => {
		expect(rail).toContain("home.editorial.cat.comida");
		expect(rail).toContain("home.editorial.cat.supermercado");
		expect(rail).toContain("home.editorial.cat.tiendas");
		expect(rail).toContain("home.editorial.cat.farmacia");
		expect(rail).toContain("home.editorial.cat.express");
		expect(rail).toContain('"food-beverage"');
		expect(rail).toContain('"groceries"');
		expect(rail).toContain("category-groceries.jpg");
		expect(rail).not.toMatch(
			/super: require\("\.\.\/assets\/categories\/category-food-beverage/,
		);
		expect(rail).toContain('"pharmacy-otc"');
		expect(rail).toContain('href: "/nearby"');
		expect(rail).toContain('t("home.editorial.cat.more")');
		expect(rail).toContain('router.push("/categories")');
		expect(rail).toContain("grid-outline");
	});
});

describe("header and search", () => {
	test("search is a capsule that opens universal search filters as search", () => {
		expect(search).toContain('t("home.search.editorial")');
		expect(search).toContain("options-outline");
		expect(search).toContain("borderRadius: 24");
		expect(header).not.toMatch(/t\("home\.brand/);
		expect(header).toContain("onNotificationsPress");
	});
});
