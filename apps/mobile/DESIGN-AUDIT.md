# Mobile design audit

Status: in progress. Evidence recorded on 2026-10-07 against `501b75ea` plus
the local shared-control adjustments. This is not a sign-off for the whole app.

## Scope and method

Audit the existing Expo app across customer, merchant, courier, authentication,
and account flows. Preserve the shared theme and navigation design; make small,
observable improvements to readability, controls, motion, notifications, maps,
and overlapping surfaces.

Skills used: Expo overview, design system, native UI, UI component selection,
and animation, plus the repository engineering and development skills. Read the
current source and manifests where older design documents describe another app.

Source scan: 69 files under `app/`, 96 under `components/`, and the existing
`theme/` and `lib/motion.ts` token sources. Counts below exclude block comments,
comment-only lines, and the temporary verification screen. They are candidates
for review, not verified defects or a measure of visual quality.

| Candidate | Count | Per 100 nonblank source lines |
| --- | ---: | ---: |
| Hex colors outside theme | 15 | 0.04 |
| Numeric font sizes | 9 | 0.02 |
| Spacing outside 0/4/8/12/16/24/32/48 | 16 | 0.04 |
| Numeric corner radii | 14 | 0.04 |
| Legacy shadow properties | 7 | 0.02 |
| Legacy touchables | 0 | 0 |
| Explicitly disabled text scaling | 0 | 0 |

Denominator: 36,182 nonblank source lines after the comment filtering above.
Main candidates include gradient geometry, capsule shadows, merchant order
composition, and sign-out styling. Inspect each intent before replacing values.

## Native evidence: location picker

A fresh Android x86_64 debug APK built successfully. Tested current JavaScript
on an isolated Android API 36 emulator, including 360 x 640 dp, 200% font scale,
English and Spanish, gesture navigation and three-button navigation.

- No pin, draft pin, and applied pin states render.
- On the small screen, the primary action, save-address action, and Done scroll
  completely above the navigation capsule; the final separation is 24 dp.
- Applying a pin updates the browsing location. Done closes the sheet.
- A selected pin survives an app force-stop and restart.
- Save address opens Addresses; completing a save needs an authenticated session.
- Denying the location permission leaves the picker usable and its current-location
  action reachable. On October 8, granting permission and choosing the current
  location switched the header from the pinned location to the emulator GPS fix.
- Map pin taps work. Tiles loaded at overview and street zoom, but intermittent
  tile timeouts prevent a clean map reliability sign-off. Pan/zoom need a recorded
  gesture review, not just still images.

The existing picker-local footer clearance remains unchanged.

Open: iPhone bottom inset (EAS Simulator unavailable for this account), missing
native map-module fallback, authenticated address persistence, and physical-device
gesture/performance review.

## Shared-control adjustments

| Component | Finding | Adjustment |
| --- | --- | --- |
| Button | A label beside a tick, icon, or spinner can exceed the row at large text sizes | Constrain the content row and let the label shrink and wrap |
| Pressable | Disabling during a press can leave the press state active when press-out is absent | Reset press state and settle the scale when disabled |
| Toast | Bottom safe area alone puts messages over the navigation capsule | Add the existing route-aware capsule clearance |
| Toast | Fixed 2.8-second timeout ignores reading and accessibility needs | Five seconds for messages, eight for Undo, Android recommended timeout, explicit dismissal with a screen reader |

Rendered checks used a temporary native verification screen, removed afterward:

- Selected and loading buttons with long Spanish labels fit at 100% and 200%
  text on the 360 x 640 dp emulator. Both leading marks remain visible.
- Message and Undo toasts sit 12 dp above the capsule with three-button navigation.
  The Undo target remains readable, runs its callback, and dismisses the message.
- With Android's accessibility timeout set to 15 seconds, the message remains
  visible at 9.6 seconds and is gone at 19.9 seconds, respecting the extended limit.
- Disabling a control during a held press and re-enabling it returns its pressed
  background to rest. Checked with system animations disabled; physical-device
  motion feel and screen-reader announcements are still pending.

No new dependencies, public API, or palette changes are part of this increment.

The timeout follows the platform capability documented in
[React Native AccessibilityInfo](https://reactnative.dev/docs/accessibilityinfo).
Placement must also be checked against action bars, keyboards, and other overlays;
clearing the capsule alone does not prove those combinations are clear.

## Follow-up: floating action bars and location feedback

Verified on October 8 against `0e4b917f` plus these local changes:

- Floating action bars now register their measured bottom clearance while their
  screen is focused. Toasts use the larger of that clearance and the capsule's.
- On the 360 x 640 dp Android emulator at 200% text, a Spanish toast remained
  12 dp above the bar. Expanding its summary increased the bar's height and moved
  the visible toast with it. Navigating to Home removed the old reservation and
  placed the toast 12 dp above the capsule again.
- The picker now displays its existing denied/unavailable location explanations
  and shows a loading button while requesting location. Permission copy describes
  device location without implying permission is needed to pick a map pin.
- With permission revoked, the complete Spanish explanation and current-location
  action scrolled above the capsule at 200% text, retaining the 24 dp gap. Tapping
  the action opened Android's permission prompt. Granting it and choosing current
  location dismissed the picker and changed the Home header to current location.
- The temporary overlap-verification screen and its navigation entry were deleted.

This registration covers floating bars; docked bars, keyboards, and sheet overlay
combinations still need rendered verification. Location loading was too brief to
capture in this GPS run; the unavailable-provider message still needs a native check.

Checks: mobile TypeScript and focused Biome passed. The full working-tree suite
reported 279 passing tests and two failures: the known palette uniqueness assertion
and business tab/layout coverage while a separate merchant-support change was in
progress. Those unrelated files were not included in this increment.

## Follow-up: Home shortcut text

The four catalogue shortcuts were clipped to one line at 200% text sizing on a
360 x 640 dp Android screen; Spanish labels appeared as fragments. Home now uses
two rows when the system font scale exceeds 125%, and shortcut labels may wrap.
The four destinations and their press targets remain the same. Native checks on
October 8 show complete Spanish labels in two rows at 200%, and the original
single row with complete labels at 100%. Mobile TypeScript, focused Biome, and
27 Home/navigation/scroll tests passed. This is a Home-specific finding, not a
sign-off on other browse or account screens.

At 200%, the active Home search field's long one-line placeholder also ended
mid-word. It now uses the existing short search title at enlarged text sizes;
the accessibility label still names products and businesses. Android rendered
the full short placeholder. Entering a query showed live results, and pressing
the keyboard's search action dismissed the keyboard to reveal them.

## Follow-up: authentication at enlarged text

On a 360 x 640 dp Android emulator with Spanish labels, three-button navigation,
and 200% text, the sign-in role selector broke labels midword. Three-or-more
segment groups now stack into full-width rows at enlarged scales; the same selector
remains horizontal at 100%. A follow-up at 150% exposed labels broken midword
below the original 175% threshold, so the phone-size fallback now begins at 125%.
The 150% native recheck showed complete labels in full-width rows, while the 100%
layout stayed horizontal. Sign-in and sign-up no longer open the keyboard on
entry, so the page title and action remain visible until a field is chosen.

The Android form scroller now follows focused inputs when the keyboard opens.
The docked action yields that space while typing and returns when the keyboard
closes. Native checks confirmed focused sign-in email/password and sign-up
name/email remain visible above the keyboard at 200%, and the action returns
after dismissal. iOS and physical-device keyboard behavior remain open checks.
Mobile TypeScript, focused Biome, frozen lockfile validation, and
`git diff --check` pass. The full mobile suite reports 279 pass and two
unrelated failures: the known palette uniqueness assertion and business tab
coverage while merchant support routes are being developed separately.

## Follow-up: inbox signed-out state

At 200% Spanish text on the small Android emulator, the signed-out inbox title,
explanation, and sign-in action remained readable. Its list still supplied a
pull-to-refresh control even though notifications cannot be read until sign-in;
the gesture could issue a pointless unauthenticated request. The control is now
absent while signed out and remains available to signed-in readers. Subsequent
native interaction testing was interrupted by repeated emulator app-not-responding
dialogs, so this interaction has code and type-check evidence rather than a
completed post-change gesture check.

## Verification baseline


- Mobile and API TypeScript passed before shared-control edits.
- Location, gradient, navigation, and scroll coverage: 35 passing tests.
- API offers and rate-limit coverage: 10 passing tests.
- Full mobile baseline: 268 pass, 1 known failure. Light confirmed purchase-band
  colors collapse two palettes into one (12 unique colors, expected 13). Kept
  separate from the location clearance work; do not weaken the assertion.
- After shared-control edits and removal of the temporary screen: mobile TypeScript,
  focused Biome checks, and `git diff --check` pass. The full mobile suite remains
  268 pass and the same one palette failure.

## Remaining audit

- [ ] Verify shared-control adjustments at normal and 200% text, including Undo,
      repeated messages, dismissal, loading, disabled controls, and reduced motion.
      Initial native checks above pass; repeated-message replacement, screen-reader
      behavior, and physical-device motion still need verification.
- [ ] Audit bottom action bars with toasts, sheets, keyboards, and tabs together.
- [ ] Customer: search, category, store, product/options, cart, checkout, orders,
      tracking, reviews, empty/error/retry states, and long content.
- [ ] Account/authentication: sign-in, validation, profile, settings, addresses,
      password, permissions, notifications/inbox, and sign-out.
- [ ] Merchant: board and order actions, products/options, promotions, locations,
      hours, settings, reviews, onboarding, and restricted-access states.
- [ ] Courier: availability, assignments, tracking, delivery completion, profile,
      and permission/network recovery.
- [ ] Dark and light palettes, contrast, focus and screen-reader semantics.
- [ ] Real-device release-build motion: interruption, gesture handoff, haptic
      timing, reduced motion, and slow-device performance.
- [ ] iOS safe areas and platform behavior; Android keyboard/system navigation.

Keep this list open until each requirement has current rendered or behavioral
evidence. A green static scan or test suite is not whole-design verification.

## Design-system audit: borders, spacing, cards, colour, shadows

Status: source-level pass on 2026-10-08 against the current working tree. This is a
static audit of how the primitives and screens *use* the tokens in `theme/tokens.ts`
— borders, spacing, card composition, colour and shadow. It is not a rendered review;
every claim below is a `file:line` a reader can open. Counts exclude tests, comments,
and block-comment prose. Severity: **P1** is a visible defect or a broken invariant,
**P2** is an inconsistency a reader can see, **P3** is hygiene.

### At a glance

| Area | Signal | Count | Verdict |
| --- | --- | ---: | --- |
| Line borders | `border` vs `input` token split honoured | 87 / 10 | Good; one scheme inconsistency |
| Line borders | Light merchant `border` written as 8-digit alpha | 13 of 13 | **P2** — contradicts the token's own note |
| Line borders | `borderWidth` 1 / 2 / 0 | 40 / 6 / 5 | 2s are ad hoc (**P3**) |
| Line borders | Dividers as `hairlineWidth` vs `1` | ~30 vs many | Mixed weight (**P2**) |
| Spacing | Values on the 4/8/…/32 scale | majority | Good |
| Spacing | Off-scale literals | 20 sites | **P2** — ~6 undocumented |
| Cards | `Card` primitive shadows/padding/radius | one source | Good |
| Cards | Custom `colors.card` surfaces | 50 sites | **P2** — a second card shape |
| Colour | Real hex outside `theme/` | 5 files | 4 justified, 1 deliberate |
| Colour | Home band ink measured on lime only | 12 of 13 themes | **P1** — see §4 |
| Shadow | `shadow.card` / `shadow.raised` use | 8 / 6 | Good |
| Shadow | Bespoke shadow literals | 2 files | **P2** — a second shadow system |

---

### 1. Line borders

The system is two tokens with two jobs, and it holds: `colors.border` is the decorative
hairline (87 uses) and `colors.input` is the control edge that owes WCAG 1.4.11's 3:1
(10 uses — text fields, the two search boxes, the sign-in account-type card, and the home
filter chips; every one a control boundary, which is the token's whole job).
`components/card.tsx`, `./list-row`, `./field` and `./button`
name a token and never a hex. Nothing to fix in the general case.

**P2 — the light merchant themes write `border` as an alpha hex.** `theme/tokens.ts`
declares `border` solid in its consumer dark block with an explicit reason — *"they are
solid here because React Native cannot blend a border into an unknown parent"* — and the
consumer palette obeys it (`#e1ded9`). But all thirteen merchant themes' **light**
schemes use an 8-digit alpha value instead: `#11111114` (lime, `tokens.ts:560`),
`#14121014` (amber, `:602`), `#170E0B14` (coral, `:644`) … `#171C2D14` (vine, `:1097`).
Their dark schemes are solid (`#2E2E2C` …). So the same token is an 8% wash on light and
a solid line on dark, and the file's stated rule is broken by thirteen rows — the exact
kind of drift the docblock exists to prevent. The alpha is ~1.1:1 on white, so a light
merchant card's edge is fainter than the consumer card's; on dark the border *is* the card
(see §3), so the two schemes do not read as one system.

**P2 — divider weight is not one number.** `StyleSheet.hairlineWidth` is used for dividers
in ~30 places (`(business)/analytics.tsx:494,849,855,1103`, `(business)/index.tsx:1499`,
`(business)/menu.tsx:391`, `products.tsx:680`, `reviews.tsx:257` …) while the same job — a
separator between two rows — is drawn as `borderWidth: 1` in `components/card.tsx` and
`./list-row`'s own hairline is `hairlineWidth`. On a 3x device `hairlineWidth` is ~0.33pt:
two rows separated by a hairline and a card separated by a point are two weights for one
decorative line.

**P3 — the 2pt borders are ad hoc.** Six sites `borderWidth: 2` for four different
meanings: field focus / error (`field.tsx:266,268`), a selected swatch
(`business-theme-picker.tsx:203`), a purchase pill (`(customer)/purchase-preview.tsx:247`),
and the completion overlay (`delivery-completion-overlay.tsx:276`). Only `button.tsx`
exports a named width (`BUTTON_BORDER_WIDTH = 1`); the emphasis width has no name, so it is
six copies of a number the system does not state.

**P3 — `borderRadius: 9999` (`band-geometry.tsx:129`) duplicates `radius.full`.** Nine
truly off-token radii remain elsewhere (1, 2, 10, 13, 14, 16, 22, 40 — `merchant-order-hero.tsx:335`,
`courier-directory-card.tsx:125`, `delivery-completion-overlay.tsx:275`), a couple of which
are deliberate (the `2`/`1` are 2–12pt skeleton bars in the theme picker).

### 2. Spacing

`space` is a 4-point rhythm (`4/8/12/16/20/24/32`) plus `TEXT_STACK_GAP = 2`, and the vast
majority of `padding`/`margin`/`gap` literals land on it. Twenty sites do not:

- **P2, undocumented:** `(business)/index.tsx:1420` `paddingTop: 10`,
  `:1459,1471` `paddingHorizontal: 14`, `:1469` `gap: 7`; `product-form.tsx:901` `gap: 10`;
  `merchant-order-hero.tsx:284` `gap: 18`; `sheet.tsx:761` `paddingBottom: 22`;
  `field.tsx:406` `paddingHorizontal: 14`; `merchant-order/[id].tsx:965,976`
  `paddingVertical: 10/5`; `switch.tsx:112` `padding: 3`.
- **P3, deliberate but typed as a literal:** `gap: 2` appears in `merchant-order/[id].tsx:894,923`
  and `products.tsx:684` where the token is `TEXT_STACK_GAP`; the two `-1` margins in
  `field.tsx:266,268` are the documented optical fix for the focus border, and
  `status-badge` derives its insets from `space.xs / 2` and `space.md / 2` in prose but not
  in code.
- `components/crash-screen.tsx:126,134` (`48`, `18`) is a standalone error screen with its
own palette; excluded from the token contract on purpose.

A literal `14` beside `space.lg`'s 16 and `space.xs`'s 4 is the one that most reads as a
slip: `field.tsx`'s soft box is the only field that does not use a `space` step for its
horizontal padding.

### 3. Cards

`Card` is the single card primitive and it is composed correctly — `radius.md`, 1pt
`colors.border`, `space.lg` padding, `shadow.card` spread from the token so no screen picks
a platform. Two issues sit around it, not in it.

**P2 — `./coupon-strip` uses a `Card` and cancels it.** `coupon-strip.tsx:67` passes
`style={{ elevation: 0, shadowOpacity: 0, boxShadow: "none" }}` to turn the primitive back
into a flat box. The reasoning (two lifted cards 8pt apart read as one) is sound; the
execution reaches past the primitive to its shadow props. `Card` already has `tone`; a
`tone="flat"` (or a dedicated strip) is the shape that keeps the decision inside the
primitive the rest of the app relies on.

**P2 — there is a second card surface with its own rules.** `./merchant-module` documents
itself as "the other shape: `shadow.card` plus `shadow.raised`, a hairline", and ~50 sites
set `backgroundColor: colors.(card|muted|secondary)` on hand-built surfaces
(`merchant-module`, `merchant-pulse`, the pulse band, `tab-capsule`, `sheet`). Two card
recipes means a change to the card (a radius, a padding, a lift) reaches only one of them.

**Observation, not a defect:** on the **light** theme the card fill is 1.017:1 against the
page and `shadow.card` is 8% black, so the *border* is what makes the card legible; on
**dark** the shadow is black-on-near-black and the border is the only thing there. That is
stated in `tokens.ts` and is coherent — but it means the `P2` alpha-border finding in §1
directly weakens every light merchant card.

### 4. Colour

The token layer is strong: 55 keys, a semantic set fixed across all thirteen themes, and
measured contrast pairs documented beside every value. The audit found real hex **outside**
`theme/` in only five files, and all five are defensible — `crash-screen.tsx:70-73` (a
standalone failure screen with its own palette), `fluid-preview.tsx:34,66` (a scratch screen),
`delivery-completion-overlay.tsx:188` (`mixHex(color, "#FFFFFF", 0.2)` — a white blend, not
a surface), and `home-gradient.tsx:52-53`'s `LIME_LIGHT`/`LIME_DARK`, which are the two
hand-authored ramps the file argues for at length (they are the only opaque ones, and
their geometry is load-bearing).

**P1 — the home band's ink was measured on lime only. (Corrected 2026-10-08: this section
first claimed a non-lime theme "still gets a bright-lime home band". It does not, and the
finding is restated here against the measurement that disproved it.)**

`home-gradient.tsx` already follows the theme: `browsingColors` branches on `isLime`, and
the twelve other themes get `withAlpha(color, strengths)` — the theme's own primary at
`[0.8, 0.6, 0.16, 0]` (light) or `[0.42, 0.24, 0.04, 0]` (dark), so the ramp reads as the
selected palette. What did **not** follow the theme was the ink. `home-header.tsx:124`
computed the band's ink inside a lime-only gate —
`const bandInk = onLimeGradient ? inkOnBand(…) : undefined` — so on the other twelve themes
during browsing **nothing was measured at all**: the greeting fell back to `foreground`,
the meta line to its own `mutedForeground`, and the pin was drawn at `colors.primary` on a
band that *is* that primary composited over the page (roughly 1:1, invisible).

Measured on the light themes, the meta line's `mutedForeground` against the ramp's top stop
(`mixHex(primary, background, 0.8)`) reads: berry **1.09:1**, orchid 1.36, vine 1.53,
harbor 1.73, forest 1.87, sunset 1.89, dune 1.91, ocean 2.13, coral 2.43, citrus 2.77,
sky 3.21, amber 3.40, lime 4.19 — **all thirteen under the 4.5** a 13px line owes. Lime is
in that list and was the one line that was legible, because lime was the one theme the gate
measured. A second, quieter defect sat in the same gate: because the lime ink was applied
unconditionally rather than only when a band is drawn, a signed-in reader whose order list
had not yet loaded got `#0F0F0F` lettering on the `#0F0F0F` page in the dark scheme.

**Fixed** (this pass): `lib/purchase-colors.ts` gained `BROWSING_RAMP_ALPHA` and
`browsingBandTop` — the one stop of the browsing ramp the ink is measured against, sharing
its alphas with `./home-gradient` — and `home-header` now measures a single ink for every
mark on the band, on every theme, gated on the band actually being drawn. The meta line now
runs **4.4967:1 to 15.98:1** in light and **6.41:1 to 16.22:1** in dark. Twenty-five of the
twenty-six theme/scheme pairs clear 4.5; the exception is `berry` in light at **4.4967:1**,
whose composite `#b549bf` has relative luminance 0.1835 — inside the narrow range where
neither white (which needs `L ≤ 0.1833`) nor its own `foreground` `#140A16` (4.31 there)
reaches 4.5. That is its ramp's top stop, not its ink, and it is pinned as a value in
`lib/purchase-colors.test.ts` rather than rounded to a pass.

**P3 — `tab-capsule.tsx:64` writes `shadowColor: "#000000"`** where `theme/tokens.ts`
already exports `shadow.color`. A literal that duplicates a token can drift from it.

### 5. Button and control shadows

Buttons themselves are intentionally **flat**: `components/button.tsx` draws no shadow, and
its primary variant is a `primary` fill with a 1pt *transparent* border
(`BUTTON_BORDER_WIDTH`). The lift belongs to the floating controls, and there it is the
`shadow.raised` token — `action-bar.tsx:310`, `active-order-bar.tsx:122`,
`orders-fab.tsx:115`, `toast.tsx:337`. That division (persistent surface = flat, floating
surface = raised) is coherent and worth keeping.

Two inconsistencies sit underneath it:

- **P2 — a second shadow system in `./tab-capsule`.** It defines its own
  `CAPSULE_SHADOW` (`tab-capsule.tsx:62-68`): `0 4 12 rgba(0,0,0,.07)`, `elevation: 2`. The
  justification is real — no shared step carries that diffusion — but it reimplements the
  platform split (web `boxShadow` vs native `shadow*`+`elevation`) that the token exists to
  own, and it re-uses `elevation: 2`, which `shadow.card` already uses at a *different* blur
  (4). So elevation 2 now means two things, and a third place knows how to write a shadow.
- **P2 — `shadow.raised` is very weak where it matters most.** It is 8% black (blur 8 /
  offset 4 / elevation 3, `tokens.ts`'s `shadow`), on a canvas that is `#fefdfa`/`#FFFFFF`.
  The floating order pill, the FAB and the action bar are the surfaces that most need to
  read as *above* the page, and 8% over near-white is a few points of grey. On dark the
  same shadow is invisible, which `tokens.ts` acknowledges; there it relies on the border.
  The observation is that a single 8% opacity serves both a whisper card and a floating bar,
  and only one of them can afford to be a whisper.

### Severity-ranked follow-up

1. ~~**P1** Make the home band follow `colors.primary` (or gate the lime ramp on the lime
   theme) so a non-lime theme does not render a lime band~~ — **done 2026-10-08, and the
   premise was wrong.** The ramp already followed the theme; the *ink* did not, because it
   was computed inside a lime-only gate. `home-header.tsx` now measures one ink against
   `browsingBandTop` on every theme. See §4 for the measurement and the one pair (`berry`
   light, 4.4967:1) that still wants its ramp's top stop moved.
2. **P2** Decide one `border` treatment: composite the alpha to a solid value on the light
   merchant themes (as the consumer palette already does), or delete the "they are solid"
   note. Right now the file states a rule thirteen rows break.
3. **P2** Give the flat card a `tone` instead of `coupon-strip` zeroing shadow props, and
   fold `tab-capsule`'s shadow into a named step so there is one shadow vocabulary.
4. **P2** Reconcile divider weight (`hairlineWidth` vs `1`) and pull the off-scale spacing
   literals in `field`, `index`, `merchant-order-hero` and `sheet` onto `space` steps, or
   name them.
5. **P3** Replace `gap: 2` with `TEXT_STACK_GAP`, `borderRadius: 9999` with `radius.full`,
   and `tab-capsule`'s `#000000` with `shadow.color`.

A rendered pass is still owed: these are all static findings, and the two scheme-dependent
ones (alpha borders, invisible dark shadows) need a light/dark screenshot pair to confirm.
