import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, SUPPORTED_LOCALES, translations } from "./i18n";

/**
 * Locale parity.
 *
 * `translations` is declared `as const`, which makes each locale its own object
 * literal rather than two views of one type. Nothing in the type system therefore
 * requires a key added to Spanish to exist in English, and the failure is silent: a
 * consumer reading `messages.site.hero.badge` gets `undefined`, and the component
 * renders an empty element rather than throwing. Two pages already defend against
 * exactly this with a `|| "fallback string"`, which is the symptom showing up in
 * the components instead of here.
 *
 * This test is the guard that makes a new marketing section safe to add.
 */

/** Every leaf key path in an object, depth-first. */
function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  if (Array.isArray(value)) return [prefix];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

const locales = SUPPORTED_LOCALES;
const reference = locales[0];

describe("translations", () => {
  it("has more than one locale to compare", () => {
    expect(locales.length).toBeGreaterThan(1);
  });

  it.each(locales.filter((locale) => locale !== reference))(
    "%s carries exactly the keys the reference locale does",
    (locale) => {
      const expected = new Set(keyPaths(translations[reference]));
      const actual = new Set(keyPaths(translations[locale]));

      const missing = [...expected].filter((key) => !actual.has(key));
      const extra = [...actual].filter((key) => !expected.has(key));

      // Both directions are reported: a key only in the reference locale renders blank
      // in `locale`, and a key only in `locale` is a string no component can reach.
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    },
  );

  it("leaves no marketing string empty", () => {
    const empty: string[] = [];

    for (const locale of locales) {
      for (const path of keyPaths(translations[locale].site)) {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown> | undefined)?.[key],
            translations[locale],
          );
        if (typeof value === "string" && value.trim() === "") empty.push(`${locale}: site.${path}`);
      }
    }

    expect(empty).toEqual([]);
  });

  it("has a default locale that exists", () => {
    expect(locales).toContain(DEFAULT_LOCALE);
  });
});
