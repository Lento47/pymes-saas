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
