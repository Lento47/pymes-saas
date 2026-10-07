import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * `foundation.css` is the adapter between two design systems, and it fails in a way nothing
 * else can see.
 *
 * This app's `index.css` declares its palette as **raw HSL channels** — `--border: 258 15% 23%`
 * — so every consumer must supply the colour function itself, which is why shadcn writes
 * `hsl(var(--border))` in all four hundred of its rules. Arc never wraps: its modules ask for
 * `var(--surface)` and `var(--border)` directly, because in Arc's own `foundation.css` those
 * *are* colours.
 *
 * So a mapping written as `--surface: var(--bg-card)` does not produce a slightly-off surface.
 * It produces the string `258 20% 10%`, every declaration consuming it is invalid at
 * computed-value time and is **dropped**, and the component renders with no fill, no border and
 * inherited text colour. It still lays out perfectly, still typechecks, still builds — a dropped
 * declaration is indistinguishable from an absent rule in a screenshot.
 *
 * That is what happened: eight Arc components were rendering flat and borderless while the one
 * hand-adapted component, which happened to write `hsl(var(--border))`, rendered correctly. It
 * was only visible by diffing against `kuratlielia/arc-library`, where the same rule reads
 * `border: 1px solid var(--border)` and the app's own value is plainly not a colour.
 *
 * ## Why this is a test and not a comment
 *
 * The comment in `foundation.css` explains it. A comment is read once; this is read on every
 * run, and the failure names the token that regressed. The assertion is deliberately about
 * *shape* — "is this mapping wrapped in a colour function" — rather than about specific values,
 * so adding a token is a normal edit and cannot quietly bypass the check.
 */

/** Arc's adapter. The file under test. */
const FOUNDATION_PATH = join(import.meta.dirname, "foundation.css");
/** The app palette the adapter resolves against: `client/src/index.css`. */
const INDEX_PATH = join(import.meta.dirname, "..", "..", "index.css");

const foundation = readFileSync(FOUNDATION_PATH, "utf-8");
const index = readFileSync(INDEX_PATH, "utf-8");

/**
 * `foundation.css` with its block comments removed.
 *
 * Done once, here, because the file's own documentation quotes the rules it is *not* shipping —
 * including verbatim, `:is(*:focus) { outline: none !important }` — and several assertions below
 * would otherwise match the explanation of the bug instead of the bug. A guard that reads its
 * own comments is worse than no guard: it fails for the wrong reason and gets deleted.
 */
const foundationCss = foundation.replace(/\/\*[\s\S]*?\*\//g, "");

/** Functions that turn a value into a colour, and so may legitimately wrap a channel token. */
const COLOUR_FUNCTIONS = [
  "hsl(",
  "hwb(",
  "rgb(",
  "oklch(",
  "oklab(",
  "lab(",
  "lch(",
  "color(",
  "color-mix(",
];

/** The token names `index.css` declares, so a forwarding can be told apart from a literal. */
const appTokens = new Set(
  [...index.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map(
    (match) => match[1] as string,
  ),
);

type Mapping = { token: string; value: string };

/** Every `--token: value` declaration in `foundation.css`. */
function mappings(): Mapping[] {
  return [...foundationCss.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(
    (match) => ({
      token: match[1] as string,
      value: (match[2] ?? "").trim(),
    }),
  );
}

/**
 * The subset that is an **adapter mapping**: one whose value forwards a token this app owns.
 *
 * Keyed on the *value* rather than on the token's own name, because that is what makes it an
 * adapter entry. `--surface` is not declared in `index.css` and is not an Arc token either — it
 * is Arc's name bound to one of this app's values, which is the entire job of this file.
 *
 * `--font-*` is excluded: those forward `var(--font-sans)`, which is already a complete value.
 * Including them would mean demanding a colour function around a font stack, which is the kind
 * of guard that gets disabled rather than fixed.
 */
const adapterMappings = mappings().filter(
  ({ token, value }) =>
    !token.startsWith("--font-") &&
    [...value.matchAll(/var\((--[a-z0-9-]+)\)/g)].some((match) =>
      appTokens.has(match[1] as string),
    ),
);

describe("foundation.css token adapter", () => {
  it("finds the adapter mappings rather than matching nothing", () => {
    // Two empty lists compare equal, so the assertions below are only meaningful while the
    // derivation still produces something. This is the anti-vacuity guard, and it is why the
    // first draft of this file — which filtered on the token's *name* and found 4 — was wrong:
    // the count is a claim about the derivation, so it has to be checked against what the
    // derivation actually yields.
    //
    // Deliberately a floor and a membership check rather than an exhaustive list. Pinning all
    // twenty-one entries would mean editing this test whenever a token is added or removed,
    // which is the brittleness that makes guards get deleted. The exhaustive claim lives in the
    // next test, where it is about correctness rather than inventory.
    expect(adapterMappings.length).toBeGreaterThanOrEqual(15);
    expect(adapterMappings.map((entry) => entry.token)).toEqual(
      expect.arrayContaining([
        "--surface",
        "--surface-raised",
        "--surface-muted",
        "--text-secondary",
        "--text-muted",
        "--border-subtle",
        "--border-strong",
        "--accent-strong",
        "--accent-foreground",
        "--control-on",
        "--control-glyph",
        "--control-track",
        "--control-thumb",
        "--control-fill",
        "--focus-ring",
      ]),
    );
  });

  it("wraps every channel token it forwards in a colour function", () => {
    // The bug, stated as an assertion. A mapping that forwards a raw channel — one this app's
    // `index.css` declares as `258 20% 10%` rather than as a colour — resolves to a string that
    // is not a colour, and every declaration reading it is dropped.
    const unwrapped = adapterMappings
      .filter(({ value }) => !COLOUR_FUNCTIONS.some((fn) => value.includes(fn)))
      .map(({ token, value }) => `${token}: ${value}`);

    expect(unwrapped).toEqual([]);
  });

  it("wraps the four tokens that were broken when this was found", () => {
    // Named individually because they are the ones that shipped broken, and because the test
    // above reports only the head of a longer list — which is exactly the case where a reader
    // needs to be told which fix is being protected.
    //
    // `--text-muted` and `--control-glyph` were bare in the original adapter; the last two were
    // still bare *after* the obvious nine had been fixed. All four were found by this file
    // rather than by inspection.
    const byToken = new Map(
      adapterMappings.map((entry) => [entry.token, entry.value]),
    );
    for (const token of [
      "--text-muted",
      "--control-glyph",
      "--control-track-hover",
      "--control-thumb-on",
    ]) {
      expect(`${token}: ${byToken.get(token)}`).toMatch(
        new RegExp(`${token}: (hsl|rgb|oklch|color-mix)\\(`),
      );
    }
  });

  it("leaves the font tokens unwrapped, because those forward a complete value", () => {
    // The deliberate exception. `--font-body: var(--font-sans)` is correct, and a guard that
    // demanded a colour function here would be enforcing a bug — so the exception is asserted
    // rather than merely permitted.
    expect(foundationCss).toMatch(/--font-body:\s*var\(--font-sans\)/);
  });

  it("carries no nested block comments", () => {
    // CSS comments do not nest: the first `*/` closes the comment and everything after it is
    // parsed as live CSS. This file's header originally demonstrated the broken form *inside its
    // own explanation of it*, which made the explanation the bug — the comment stripper above
    // read the example as a real declaration, and a browser would have disagreed with this file
    // about what it contains.
    const openers = (foundationCss.match(/\/\*/g) ?? []).length;
    const closers = (foundationCss.match(/\*\//g) ?? []).length;

    expect({ openers, closers }).toEqual({ openers: 0, closers: 0 });
  });

  it("confirms the app palette really is raw channels, so the guard is not vacuous", () => {
    // If `index.css` ever moves to complete colours — `hsl(258 20% 10%)` — then the wrapping
    // above would be wrong (`hsl(hsl(...))` is invalid) and this guard would be enforcing a
    // bug. This assertion is what makes the previous one trustworthy rather than merely strict:
    // it states the precondition the whole adapter rests on.
    const rawChannels = [
      ...index.matchAll(/^\s*--(border|bg-card|fg-2|accent)\s*:\s*([^;]+);/gim),
    ]
      .map((match) => (match[2] ?? "").trim())
      .filter((value) => !COLOUR_FUNCTIONS.some((fn) => value.includes(fn)));

    expect(rawChannels.length).toBeGreaterThan(0);
  });

  it("keeps the focus ring visible", () => {
    // Arc's own foundation ends with `:is(*:focus) { outline: none !important }`, which would
    // strip the focus ring from every keyboard control in the console. The adapter substitutes
    // the app's accent instead, and this is the only place that is asserted.
    expect(foundationCss).toMatch(/--focus-ring:\s*hsl\(var\(--accent\)\)/);
    // Read from the comment-stripped source: the raw file quotes that rule in its header, and
    // asserting against the raw text fails on the explanation rather than on a regression.
    expect(foundationCss).not.toMatch(/outline:\s*none\s*!important/);
  });
});
