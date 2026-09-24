import { describe, expect, test } from "bun:test";

import { account as accountEn } from "./en/account";
import { admin as adminEn } from "./en/admin";
import { auth as authEn } from "./en/auth";
import { basket as basketEn } from "./en/basket";
import { business as businessEn } from "./en/business";
import { common as commonEn } from "./en/common";
import { customer as customerEn } from "./en/customer";
import { discovery as discoveryEn } from "./en/discovery";
import { en } from "./en/index";
import { settings as settingsEn } from "./en/settings";
import { storefront as storefrontEn } from "./en/storefront";
import { tracking as trackingEn } from "./en/tracking";
import { account as accountEs } from "./es/account";
import { admin as adminEs } from "./es/admin";
import { auth as authEs } from "./es/auth";
import { basket as basketEs } from "./es/basket";
import { business as businessEs } from "./es/business";
import { common as commonEs } from "./es/common";
import { customer as customerEs } from "./es/customer";
import { discovery as discoveryEs } from "./es/discovery";
import { es } from "./es/index";
import { settings as settingsEs } from "./es/settings";
import { storefront as storefrontEs } from "./es/storefront";
import { tracking as trackingEs } from "./es/tracking";

/**
 * Two invariants the types cannot state, which is why this file exists.
 *
 * `Messages = Record<MessageKey, string>` proves English has every Spanish key. It says
 * nothing about the reverse — an English key with no Spanish original compiles fine,
 * because `es` is a variable rather than a fresh literal by the time it is compared, so
 * excess-property checking never fires. And it says nothing at all about two domain
 * files inside one locale claiming the same key, which a spread resolves by silently
 * keeping the last one. Both failures ship a plausible-looking screen.
 *
 * **Every domain file must be listed in both objects below.** These are the inputs to
 * both checks, so a file that is spread by the barrel but missing here does not weaken
 * the check — it breaks it the other way, failing "the merge lost nothing" on a
 * dictionary that is in fact fine. That is what happened when `discovery`, `storefront`,
 * `basket`, `tracking` and `settings` were added to the barrels and not to this list: the
 * merge was correct and the guard reported 815 keys against 779.
 */

// The same eleven as `./es/index` and `./en/index`, in the same order, so a domain added to
// a barrel and forgotten here is visible by reading the three lists side by side.
const DOMAINS_ES = {
	account: accountEs,
	common: commonEs,
	auth: authEs,
	customer: customerEs,
	business: businessEs,
	admin: adminEs,
	discovery: discoveryEs,
	storefront: storefrontEs,
	basket: basketEs,
	tracking: trackingEs,
	settings: settingsEs,
};
const DOMAINS_EN = {
	account: accountEn,
	common: commonEn,
	auth: authEn,
	customer: customerEn,
	business: businessEn,
	admin: adminEn,
	discovery: discoveryEn,
	storefront: storefrontEn,
	basket: basketEn,
	tracking: trackingEn,
	settings: settingsEn,
};

/** `["auth", "auth.title"]` — the file a key came from, so a collision names it. */
function keyOrigins(domains: Record<string, Record<string, string>>): string[] {
	return Object.entries(domains).flatMap(([domain, messages]) =>
		Object.keys(messages).map((key) => `${domain}:${key}`),
	);
}

describe.each([
	["es", DOMAINS_ES, es],
	["en", DOMAINS_EN, en],
] as const)("%s dictionary", (_locale, domains, merged) => {
	test("no key is defined by two domain files", () => {
		const seen = new Map<string, string>();
		const collisions: string[] = [];

		for (const origin of keyOrigins(domains)) {
			const key = origin.slice(origin.indexOf(":") + 1);
			const previous = seen.get(key);
			if (previous)
				collisions.push(
					`${key} (${previous} and ${origin.slice(0, origin.indexOf(":"))})`,
				);
			else seen.set(key, origin.slice(0, origin.indexOf(":")));
		}

		expect(collisions).toEqual([]);
	});

	test("the merge lost nothing", () => {
		// A collision would also show up here as a missing key, but this catches the
		// opposite mistake too: a domain file the barrel forgot to spread.
		expect(Object.keys(merged).length).toBe(keyOrigins(domains).length);
	});

	test("every message is a non-empty string", () => {
		const blank = Object.entries(merged)
			.filter(
				([, value]) => typeof value !== "string" || value.trim().length === 0,
			)
			.map(([key]) => key);
		expect(blank).toEqual([]);
	});

	test("placeholders are balanced", () => {
		// `"Hola, {name"` renders as literal text and nobody notices until a customer
		// sees a brace. Checking the braces pair up costs nothing and catches the typo.
		const unbalanced = Object.entries(merged)
			.filter(
				([, value]) =>
					(value.match(/\{/g)?.length ?? 0) !==
					(value.match(/\}/g)?.length ?? 0),
			)
			.map(([key]) => key);
		expect(unbalanced).toEqual([]);
	});
});

test("both locales carry the identical key set", () => {
	// The type checks one direction (English has everything Spanish has). This is the
	// other one: a key that exists only in English is a string written for one language.
	const onlyEs = Object.keys(es).filter((key) => !(key in en));
	const onlyEn = Object.keys(en).filter((key) => !(key in es));

	expect({ onlyEs, onlyEn }).toEqual({ onlyEs: [], onlyEn: [] });
});

test("every plural key has both forms", () => {
	// `tp()` will not compile without the `_plural` sibling, so a missing one is already
	// caught. This catches the other half: a `_plural` whose singular base was deleted,
	// which leaves an orphan no call site can reach and no type complains about.
	const singulars = Object.keys(es).filter((key) => !key.endsWith("_plural"));
	const orphans = Object.keys(es)
		.filter((key) => key.endsWith("_plural"))
		.filter((key) => !singulars.includes(key.slice(0, -"_plural".length)));

	expect(orphans).toEqual([]);
});
