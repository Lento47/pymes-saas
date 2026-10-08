import { readdirSync, readFileSync } from "node:fs";
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

  it("carries no stray comment markers", () => {
    // A CSS comment ends at the first closing marker it meets, whatever the author intended — so
    // backticking one inside prose, or showing commented-out code, ends the comment early and
    // turns the rest of the paragraph into declarations the parser will act on. This file's
    // header did both, in the very paragraph explaining the rule, and the symptom was a stray
    // marker left in the stylesheet and this test reading its own documentation as
    // configuration. Described in words here; never reproduced.
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

  it("is imported after index.css, because index.css also declares these tokens — bare", () => {
    /*
      The one thing that makes every assertion above true at runtime.
       *
      `index.css` declares `--surface` itself, in shadcn's token block, and declares it **bare**:

          --surface: var(--bg-card);

      which is the same defect this file exists to catch, sitting in the app's own stylesheet.
      Both stylesheets target `:root`, so specificity cannot break the tie — only source order
      can. `main.tsx` imports `index.css` first and `foundation.css` second, so the adapter's
      `hsl(...)` wins and the Arc components get colours.

      That is the whole margin, and it was invisible until someone read the built bundle: the
      fixed declaration sits at a later byte offset than the bare one, which is the only reason
      the console's tables have a border. Reorder those two imports — a tidy-up, an added import,
      anything — and every surface, border and muted string in the Arc set silently drops again,
      with no build error and no failing test.

      So the ordering is asserted. It is an odd thing to assert and it is exactly the kind of
      invariant that is load-bearing, undocumented and untested until the day it breaks.
     */
    const main = readFileSync(
      join(import.meta.dirname, "..", "..", "main.tsx"),
      "utf-8",
    );
    const indexAt = main.indexOf("./index.css");
    const foundationAt = main.indexOf("arc/foundation.css");

    expect(indexAt).toBeGreaterThan(-1);
    expect(foundationAt).toBeGreaterThan(-1);
    expect(foundationAt).toBeGreaterThan(indexAt);
  });
});

/**
 * The vendored modules must not ask for shadcn's token names.
 *
 * Six names are shared between Arc and this app's `index.css` — `--border`, `--foreground`,
 * `--accent`, `--success`, `--warning`, `--danger` — and they mean opposite things on the two
 * sides. Arc's are complete colours; shadcn's are raw HSL channels that every consumer must
 * wrap in `hsl()` itself. A vendored module asking for `var(--border)` therefore receives the
 * string `258 15% 23%`, and every declaration reading it is invalid at computed-value time and
 * **dropped** — no border, no fill, no type hierarchy, on a component that still lays out
 * perfectly, so nothing in review or in a screenshot reveals it.
 *
 * Seventy-five such references shipped across eight modules before this was found. The vendored
 * CSS now asks for `-base` names, which `foundation.css` defines as colours.
 *
 * ## Why this scans the directory rather than a fixed list of files
 *
 * Because new components arrive using Arc's original names. `vendor-arc.mjs` writes upstream
 * source verbatim, so every component added from here on contains `var(--border)` and its
 * siblings until somebody renames them. A guard scoped to the eight modules that happen to be
 * vendored today would keep passing and then fail on the eleventh component — which is exactly
 * when it is needed, and exactly when nobody is looking.
 *
 * `ACCEPTED` is the narrow escape hatch: a module may be listed there once a human has looked
 * at a specific rule and decided the collision is harmless there.
 */
const ARC_DIR = import.meta.dirname;

/** The shadcn-owned names an Arc module must not consume bare. */
const COLLIDING = [
  "--border",
  "--foreground",
  "--accent",
  "--success",
  "--warning",
  "--danger",
];

/** Modules whose collisions were reviewed and accepted, one path per line, each with a reason. */
const ACCEPTED: string[] = [];

/** Every vendored CSS module. `foundation.css` is excluded: it is the adapter, not a consumer. */
function vendoredModules(): { file: string; source: string }[] {
  return readdirSync(ARC_DIR, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith(".module.css"))
    .map((name) => name.replace(/\\/g, "/"))
    .filter((name) => !ACCEPTED.includes(name))
    .map((name) => ({
      file: name,
      source: readFileSync(join(ARC_DIR, name), "utf8"),
    }));
}

describe("vendored Arc modules", () => {
  it("finds the modules rather than matching nothing", () => {
    // A directory scan that returned zero files would make the assertion below pass without
    // having looked at anything.
    expect(vendoredModules().length).toBeGreaterThanOrEqual(8);
  });

  it("never asks for a shadcn-owned token name", () => {
    const offenders: string[] = [];
    for (const { file, source } of vendoredModules()) {
      for (const name of COLLIDING) {
        // The closing paren is part of the pattern, so `var(--border)` cannot match inside
        // `var(--border-subtle)` or `var(--border-base)`.
        const hits = source.split(`var(${name})`).length - 1;
        if (hits > 0) offenders.push(`${file}: var(${name}) x${hits}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("defines every -base token the modules actually ask for", () => {
    // The rename is only safe if the adapter defines what the modules now reference. A typo
    // here would resolve to nothing and reproduce the original bug in a new place, with no
    // error and no warning — so the set is read from the modules rather than restated.
    const asked = new Set<string>();
    for (const { source } of vendoredModules()) {
      for (const match of source.matchAll(
        /var\((--(?:foreground|border|accent|success|warning|danger)-base)\)/g,
      )) {
        asked.add(match[1] as string);
      }
    }

    expect([...asked].sort()).toEqual([
      "--accent-base",
      "--border-base",
      "--danger-base",
      "--foreground-base",
      "--success-base",
      "--warning-base",
    ]);
    for (const token of asked) {
      // Asserted against the stylesheet, not against a label: an earlier draft passed the label
      // to `toMatch`, which passes or fails for reasons that have nothing to do with the CSS.
      expect(foundationCss).toMatch(
        new RegExp(`${token}:\\s*(hsl|rgb|oklch|color-mix)\\(`),
      );
    }
  });
});
